ALTER TABLE public.saldos
  ADD COLUMN IF NOT EXISTS proxima_valorizacao_em DATE;

CREATE OR REPLACE FUNCTION public.avancar_data_valorizacao(
  p_data_base DATE,
  p_periodo public.periodo_valorizacao
)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_periodo
    WHEN 'diario' THEN p_data_base + 1
    WHEN 'semanal' THEN p_data_base + 7
    WHEN 'mensal' THEN (p_data_base + INTERVAL '1 month')::DATE
  END;
$$;

UPDATE public.saldos
   SET proxima_valorizacao_em = CASE
     WHEN indice_valorizacao <= 0 THEN NULL
     WHEN data_ultima_valorizacao IS NOT NULL THEN public.avancar_data_valorizacao(
       data_ultima_valorizacao,
       periodo_valorizacao
     )
     ELSE public.avancar_data_valorizacao(CURRENT_DATE, periodo_valorizacao)
   END
 WHERE proxima_valorizacao_em IS NULL;

CREATE OR REPLACE FUNCTION public.sincronizar_valorizacoes_automaticas(
  p_filho_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
       WHERE familia_id = v_familia_id;
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
    SELECT *
      INTO v_saldo
      FROM public.saldos
     WHERE filho_id = v_alvo_id
     FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_saldo.indice_valorizacao <= 0 THEN
      IF v_saldo.proxima_valorizacao_em IS NOT NULL THEN
        UPDATE public.saldos
           SET proxima_valorizacao_em = NULL,
               updated_at = now()
         WHERE filho_id = v_alvo_id;
      END IF;

      CONTINUE;
    END IF;

    v_proxima := COALESCE(
      v_saldo.proxima_valorizacao_em,
      CASE
        WHEN v_saldo.data_ultima_valorizacao IS NOT NULL THEN public.avancar_data_valorizacao(
          v_saldo.data_ultima_valorizacao,
          v_saldo.periodo_valorizacao
        )
        ELSE public.avancar_data_valorizacao(CURRENT_DATE, v_saldo.periodo_valorizacao)
      END
    );

    v_total_filho := 0;
    v_ultima_valorizacao_efetiva := v_saldo.data_ultima_valorizacao;
    v_indice_formatado := replace(
      trim(to_char(v_saldo.indice_valorizacao, 'FM999999990D00')),
      '.',
      ','
    );

    WHILE v_proxima <= CURRENT_DATE LOOP
      IF v_saldo.cofrinho > 0 THEN
        v_ganho := FLOOR(v_saldo.cofrinho * v_saldo.indice_valorizacao / 100)::INTEGER;

        IF v_ganho > 0 THEN
          v_saldo.cofrinho := v_saldo.cofrinho + v_ganho;
          v_total_filho := v_total_filho + v_ganho;
          v_ultima_valorizacao_efetiva := v_proxima;

          INSERT INTO public.movimentacoes (
            filho_id,
            tipo,
            valor,
            descricao
          )
          VALUES (
            v_alvo_id,
            'valorizacao',
            v_ganho,
            'Valorização automática do cofrinho (' ||
              v_indice_formatado ||
              '% · ref. ' ||
              to_char(v_proxima, 'DD/MM/YYYY') ||
              ')'
          );
        END IF;
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
             THEN now()
             ELSE updated_at
           END
     WHERE filho_id = v_alvo_id;

    v_total_geral := v_total_geral + v_total_filho;
  END LOOP;

  RETURN v_total_geral;
END;
$$;

CREATE OR REPLACE FUNCTION public.transferir_para_cofrinho(
  p_filho_id UUID,
  p_valor INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_livre INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF public.meu_filho_id() != p_filho_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  PERFORM public.sincronizar_valorizacoes_automaticas(p_filho_id);

  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id
   FOR UPDATE;

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < p_valor THEN
    RAISE EXCEPTION 'Saldo livre insuficiente';
  END IF;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre - p_valor,
         cofrinho = cofrinho + p_valor,
         updated_at = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'transferencia_cofrinho', p_valor, 'Transferência para o cofrinho');
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_valorizacao(p_filho_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aplicar valorização';
  END IF;

  RETURN public.sincronizar_valorizacoes_automaticas(p_filho_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.configurar_valorizacao(
  p_filho_id UUID,
  p_indice NUMERIC,
  p_periodo public.periodo_valorizacao
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem configurar valorização';
  END IF;

  v_familia_id := public.minha_familia_id();

  PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);

  IF p_indice < 0 OR p_indice > 100 THEN
    RAISE EXCEPTION 'Índice deve estar entre 0 e 100';
  END IF;

  PERFORM public.sincronizar_valorizacoes_automaticas(p_filho_id);

  INSERT INTO public.saldos (
    filho_id,
    indice_valorizacao,
    periodo_valorizacao,
    proxima_valorizacao_em
  )
  VALUES (
    p_filho_id,
    p_indice,
    p_periodo,
    CASE
      WHEN p_indice > 0 THEN public.avancar_data_valorizacao(CURRENT_DATE, p_periodo)
      ELSE NULL
    END
  )
  ON CONFLICT (filho_id) DO UPDATE
    SET indice_valorizacao = EXCLUDED.indice_valorizacao,
        periodo_valorizacao = EXCLUDED.periodo_valorizacao,
        proxima_valorizacao_em = EXCLUDED.proxima_valorizacao_em,
        updated_at = now();
END;
$$;
