-- Fix withdrawal rounding: recalculate at approval, add minimums, guarantee appreciation gain
--
-- Problems addressed:
-- 1. confirmar_resgate_cofrinho used rate frozen at request time — now re-reads current rate
-- 2. FLOOR(small * rate / 100) = 0 allowed zero-penalty withdrawals — now enforces minimum amount
-- 3. FLOOR(cofrinho * rate / 100) = 0 on small balances — now guarantees >= 1 pt appreciation

-- ============================================================
-- 1. Fix solicitar_resgate_cofrinho: add minimum withdrawal + consistent penalty
-- ============================================================
CREATE OR REPLACE FUNCTION public.solicitar_resgate_cofrinho(p_valor integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filho_id   uuid;
  v_cofrinho   integer;
  v_taxa       numeric(5,2);
  v_penalidade integer;
  v_liquido    integer;
  v_minimo     integer;
  v_resgate_id uuid;
BEGIN
  IF public.meu_papel() <> 'filho' THEN
    RAISE EXCEPTION 'Apenas filhos podem solicitar resgates do cofrinho';
  END IF;

  v_filho_id := public.meu_filho_id();

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  -- Sync appreciations before checking balance
  PERFORM public.sincronizar_valorizacoes_automaticas(v_filho_id);

  -- Lock saldos row and read balance + rate
  SELECT cofrinho, taxa_resgate_cofrinho
    INTO v_cofrinho, v_taxa
    FROM public.saldos
   WHERE filho_id = v_filho_id
   FOR UPDATE;

  -- Rate limit after lock
  PERFORM public.verificar_limite_frequencia(v_filho_id, 'resgate_cofrinho', INTERVAL '10 minutes', 5);

  IF v_cofrinho IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  -- Enforce minimum withdrawal when rate > 0 (ensures penalty >= 1)
  IF v_taxa > 0 THEN
    v_minimo := CEIL(100.0 / v_taxa)::integer;
    IF p_valor < v_minimo THEN
      RAISE EXCEPTION 'Valor mínimo para resgate com taxa de %\%%: % pts', v_taxa, v_minimo;
    END IF;
  END IF;

  IF v_cofrinho < p_valor THEN
    RAISE EXCEPTION 'Saldo do cofrinho insuficiente';
  END IF;

  -- Check no other pending withdrawal exists for this child
  IF EXISTS (
    SELECT 1 FROM public.resgates_cofrinho
     WHERE filho_id = v_filho_id AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Já existe um resgate do cofrinho pendente';
  END IF;

  -- Calculate penalty with guaranteed minimum of 1 when rate > 0
  IF v_taxa > 0 THEN
    v_penalidade := GREATEST(FLOOR(p_valor * v_taxa / 100)::integer, 1);
  ELSE
    v_penalidade := 0;
  END IF;
  v_liquido := p_valor - v_penalidade;

  INSERT INTO public.resgates_cofrinho (filho_id, valor_solicitado, taxa_aplicada, valor_liquido, status)
  VALUES (v_filho_id, p_valor, v_taxa, v_liquido, 'pendente')
  RETURNING id INTO v_resgate_id;

  RETURN v_resgate_id;
END;
$$;

-- ============================================================
-- 2. Fix confirmar_resgate_cofrinho: re-read current rate at approval time
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirmar_resgate_cofrinho(p_resgate_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filho_id     uuid;
  v_solicitado   integer;
  v_liquido      integer;
  v_taxa_atual   numeric(5,2);
  v_penalidade   integer;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem confirmar resgates do cofrinho';
  END IF;

  -- Lock the withdrawal row and read stored values
  SELECT rc.filho_id, rc.valor_solicitado
    INTO v_filho_id, v_solicitado
    FROM public.resgates_cofrinho rc
    JOIN public.filhos f ON f.id = rc.filho_id
   WHERE rc.id = p_resgate_id
     AND rc.status = 'pendente'
     AND f.familia_id = public.minha_familia_id()
   FOR UPDATE OF rc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate do cofrinho não encontrado ou não está pendente';
  END IF;

  -- Sync appreciations before balance mutation
  PERFORM public.sincronizar_valorizacoes_automaticas(v_filho_id);

  -- Re-read CURRENT rate from saldos (admin may have changed it)
  SELECT taxa_resgate_cofrinho
    INTO v_taxa_atual
    FROM public.saldos
   WHERE filho_id = v_filho_id;

  -- Recalculate penalty with current rate (guaranteed min 1 when rate > 0)
  IF v_taxa_atual > 0 THEN
    v_penalidade := GREATEST(FLOOR(v_solicitado * v_taxa_atual / 100)::integer, 1);
  ELSE
    v_penalidade := 0;
  END IF;
  v_liquido := v_solicitado - v_penalidade;

  -- Update the withdrawal record with actual rate/net used at approval
  UPDATE public.resgates_cofrinho
     SET taxa_aplicada = v_taxa_atual,
         valor_liquido = v_liquido
   WHERE id = p_resgate_id;

  -- Debit cofrinho, credit saldo_livre with recalculated net amount
  UPDATE public.saldos
     SET cofrinho    = cofrinho - v_solicitado,
         saldo_livre = saldo_livre + v_liquido,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  -- Record the transaction
  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (
    v_filho_id,
    'resgate_cofrinho',
    v_solicitado,
    'Resgate do cofrinho (taxa ' || v_taxa_atual || '%): recebeu ' || v_liquido || ' pts',
    p_resgate_id
  );

  -- Mark confirmed (after updating taxa/liquido)
  UPDATE public.resgates_cofrinho
     SET status     = 'confirmado',
         updated_at = now()
   WHERE id = p_resgate_id;

  PERFORM public.registrar_audit(
    'confirmar_resgate_cofrinho', 'resgate_cofrinho', p_resgate_id,
    jsonb_build_object(
      'filho_id', v_filho_id,
      'valor_solicitado', v_solicitado,
      'taxa_aplicada', v_taxa_atual,
      'valor_liquido', v_liquido
    )
  );
END;
$$;

-- ============================================================
-- 3. Fix sincronizar_valorizacoes_automaticas: guarantee min 1 pt gain
-- ============================================================
CREATE OR REPLACE FUNCTION public.sincronizar_valorizacoes_automaticas(p_filho_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
SET timezone TO 'America/Sao_Paulo'
AS $$
DECLARE
  v_alvos UUID[] := ARRAY[]::UUID[];
  v_alvo_id UUID;
  v_familia_id UUID;
  v_saldo public.saldos%ROWTYPE;
  v_proxima DATE;
  v_ganho INTEGER;
  v_total_geral INTEGER := 0;
  v_total_filho INTEGER := 0;
  v_ultima_valorizacao_efetiva DATE;
  v_indice_formatado TEXT;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF public.usuario_e_admin() THEN
    v_familia_id := public.minha_familia_id();

    IF p_filho_id IS NOT NULL THEN
      PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);
      v_alvos := ARRAY[p_filho_id];
    ELSE
      SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
        INTO v_alvos
        FROM public.filhos
       WHERE familia_id = v_familia_id
         AND ativo = true;
    END IF;
  ELSIF public.meu_filho_id() IS NOT NULL THEN
    IF p_filho_id IS NOT NULL AND p_filho_id <> public.meu_filho_id() THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
    v_alvos := ARRAY[public.meu_filho_id()];
  ELSE
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOREACH v_alvo_id IN ARRAY v_alvos LOOP
    SELECT * INTO v_saldo FROM public.saldos WHERE filho_id = v_alvo_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF v_saldo.indice_valorizacao <= 0 THEN
      IF v_saldo.proxima_valorizacao_em IS NOT NULL THEN
        UPDATE public.saldos SET proxima_valorizacao_em = NULL, updated_at = now() WHERE filho_id = v_alvo_id;
      END IF;
      CONTINUE;
    END IF;

    v_proxima := COALESCE(
      v_saldo.proxima_valorizacao_em,
      CASE
        WHEN v_saldo.data_ultima_valorizacao IS NOT NULL THEN public.avancar_data_valorizacao(v_saldo.data_ultima_valorizacao, v_saldo.periodo_valorizacao)
        ELSE public.avancar_data_valorizacao(CURRENT_DATE, v_saldo.periodo_valorizacao)
      END
    );

    v_total_filho := 0;
    v_ultima_valorizacao_efetiva := v_saldo.data_ultima_valorizacao;
    v_indice_formatado := replace(trim(to_char(v_saldo.indice_valorizacao, 'FM999999990D00')), '.', ',');

    WHILE v_proxima <= CURRENT_DATE LOOP
      IF v_saldo.cofrinho > 0 THEN
        -- Guarantee at least 1 pt gain when balance > 0 and rate > 0
        v_ganho := GREATEST(FLOOR(v_saldo.cofrinho * v_saldo.indice_valorizacao / 100)::INTEGER, 1);

        v_saldo.cofrinho := v_saldo.cofrinho + v_ganho;
        v_total_filho := v_total_filho + v_ganho;
        v_ultima_valorizacao_efetiva := v_proxima;
        INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
        VALUES (v_alvo_id, 'valorizacao', v_ganho,
          'Valorização automática do cofrinho (' || v_indice_formatado || '% · ref. ' || to_char(v_proxima, 'DD/MM/YYYY') || ')');
      END IF;
      v_proxima := public.avancar_data_valorizacao(v_proxima, v_saldo.periodo_valorizacao);
    END LOOP;

    UPDATE public.saldos
       SET cofrinho = v_saldo.cofrinho,
           data_ultima_valorizacao = v_ultima_valorizacao_efetiva,
           proxima_valorizacao_em = v_proxima,
           updated_at = CASE
             WHEN cofrinho IS DISTINCT FROM v_saldo.cofrinho
               OR data_ultima_valorizacao IS DISTINCT FROM v_ultima_valorizacao_efetiva
               OR proxima_valorizacao_em IS DISTINCT FROM v_proxima
             THEN now() ELSE updated_at END
     WHERE filho_id = v_alvo_id;

    v_total_geral := v_total_geral + v_total_filho;
  END LOOP;

  RETURN v_total_geral;
END;
$$;
