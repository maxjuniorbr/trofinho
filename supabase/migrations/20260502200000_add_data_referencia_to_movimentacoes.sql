-- Add data_referencia to movimentacoes: stores the original event date
-- (e.g. the assignment competencia for credito, the original request date
-- for estorno_resgate / resgate_cofrinho). This lets the UI clearly show
-- "when the event happened" vs "when it was recorded/approved" without
-- embedding presentation text in the description.
--
-- Idempotent: backfills check IS NULL, so re-running is safe.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Schema: add the column (nullable first for backfill, then NOT NULL)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS data_referencia DATE;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Backfill existing rows
-- ────────────────────────────────────────────────────────────────────────────

-- 2a. credito: event date = atribuicoes.competencia (or created_at::date)
UPDATE public.movimentacoes m
   SET data_referencia = COALESCE(a.competencia, m.created_at::date)
  FROM public.atribuicoes a
 WHERE m.tipo = 'credito'
   AND m.referencia_id = a.id
   AND m.data_referencia IS NULL;

-- 2b. credito without referencia_id (legacy edge case)
UPDATE public.movimentacoes
   SET data_referencia = created_at::date
 WHERE tipo = 'credito'
   AND referencia_id IS NULL
   AND data_referencia IS NULL;

-- 2c. estorno_resgate: event date = original resgate request date
UPDATE public.movimentacoes m
   SET data_referencia = r.created_at::date
  FROM public.resgates r
 WHERE m.tipo = 'estorno_resgate'
   AND m.referencia_id = r.id
   AND m.data_referencia IS NULL;

-- 2d. resgate_cofrinho: event date = original withdrawal request date
UPDATE public.movimentacoes m
   SET data_referencia = rc.created_at::date
  FROM public.resgates_cofrinho rc
 WHERE m.tipo = 'resgate_cofrinho'
   AND m.referencia_id = rc.id
   AND m.data_referencia IS NULL;

-- 2e. All remaining rows: event date = recording date
UPDATE public.movimentacoes
   SET data_referencia = created_at::date
 WHERE data_referencia IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Apply constraints
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.movimentacoes
  ALTER COLUMN data_referencia SET DEFAULT CURRENT_DATE;

ALTER TABLE public.movimentacoes
  ALTER COLUMN data_referencia SET NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Update RPCs to set data_referencia on INSERT
-- ────────────────────────────────────────────────────────────────────────────

-- 4a. aprovar_atribuicao: data_referencia = competencia or CURRENT_DATE
CREATE OR REPLACE FUNCTION "public"."aprovar_atribuicao"("atribuicao_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id UUID;
  v_familia_id UUID;
  v_filho_id UUID;
  v_pontos INTEGER;
  v_tarefa_familia UUID;
  v_titulo TEXT;
  v_competencia DATE;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aprovar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT a.filho_id,
         COALESCE(a.pontos_snapshot, t.pontos),
         t.familia_id,
         t.titulo,
         a.competencia
    INTO v_filho_id, v_pontos, v_tarefa_familia, v_titulo, v_competencia
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE a.id = atribuicao_id
     AND a.status = 'aguardando_validacao';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada ou não está aguardando validação';
  END IF;

  IF v_tarefa_familia != v_familia_id THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'aprovada',
         validada_em = now(),
         validada_por = v_caller_id
   WHERE id = atribuicao_id;

  INSERT INTO public.saldos (filho_id, saldo_livre)
  VALUES (v_filho_id, v_pontos)
  ON CONFLICT (filho_id) DO UPDATE
    SET saldo_livre = saldos.saldo_livre + EXCLUDED.saldo_livre,
        updated_at = now();

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id, data_referencia)
  VALUES (v_filho_id, 'credito', v_pontos, v_titulo, atribuicao_id, COALESCE(v_competencia, CURRENT_DATE));

  PERFORM public.registrar_audit(
    'aprovar_atribuicao', 'atribuicao', atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos', v_pontos)
  );
END;
$$;

-- 4b. cancelar_resgate: data_referencia = original request date
CREATE OR REPLACE FUNCTION "public"."cancelar_resgate"("p_resgate_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_filho_id UUID;
  v_pontos   INTEGER;
  v_nome     TEXT;
  v_data_pedido DATE;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem cancelar resgates';
  END IF;

  SELECT r.filho_id, r.pontos_debitados, p.nome, r.created_at::date
    INTO v_filho_id, v_pontos, v_nome, v_data_pedido
    FROM public.resgates r
    JOIN public.filhos f ON f.id = r.filho_id
    JOIN public.premios p ON p.id = r.premio_id
   WHERE r.id = p_resgate_id
     AND r.status = 'pendente'
     AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado ou não está pendente';
  END IF;

  UPDATE public.resgates
     SET status     = 'cancelado',
         updated_at = now()
   WHERE id = p_resgate_id;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre + v_pontos,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id, data_referencia)
  VALUES (v_filho_id, 'estorno_resgate', v_pontos, v_nome, p_resgate_id, v_data_pedido);

  PERFORM public.registrar_audit(
    'cancelar_resgate', 'resgate', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos_estornados', v_pontos)
  );
END;
$$;

-- 4c. confirmar_resgate_cofrinho: data_referencia = original withdrawal request date
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
  v_taxa_str     text;
  v_penalidade   integer;
  v_data_pedido  date;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem confirmar resgates do cofrinho';
  END IF;

  SELECT rc.filho_id, rc.valor_solicitado, rc.created_at::date
    INTO v_filho_id, v_solicitado, v_data_pedido
    FROM public.resgates_cofrinho rc
    JOIN public.filhos f ON f.id = rc.filho_id
   WHERE rc.id = p_resgate_id
     AND rc.status = 'pendente'
     AND f.familia_id = public.minha_familia_id()
   FOR UPDATE OF rc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate do cofrinho não encontrado ou não está pendente';
  END IF;

  PERFORM public.sincronizar_valorizacoes_automaticas(v_filho_id);

  SELECT taxa_resgate_cofrinho
    INTO v_taxa_atual
    FROM public.saldos
   WHERE filho_id = v_filho_id;

  IF v_taxa_atual > 0 THEN
    v_penalidade := GREATEST(FLOOR(v_solicitado * v_taxa_atual / 100)::integer, 1);
  ELSE
    v_penalidade := 0;
  END IF;
  v_liquido := v_solicitado - v_penalidade;

  UPDATE public.resgates_cofrinho
     SET taxa_aplicada = v_taxa_atual,
         valor_liquido = v_liquido
   WHERE id = p_resgate_id;

  UPDATE public.saldos
     SET cofrinho    = cofrinho - v_solicitado,
         saldo_livre = saldo_livre + v_liquido,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  v_taxa_str := regexp_replace(to_char(v_taxa_atual, 'FM999990.00'), '0+$', '');
  v_taxa_str := regexp_replace(v_taxa_str, '\.$', '');

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id, data_referencia)
  VALUES (
    v_filho_id,
    'resgate_cofrinho',
    v_solicitado,
    'Taxa ' || v_taxa_str || '% · recebeu ' || v_liquido || ' pts',
    p_resgate_id,
    v_data_pedido
  );

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

-- 4d. sincronizar_valorizacoes_automaticas: data_referencia = appreciation date
CREATE OR REPLACE FUNCTION "public"."sincronizar_valorizacoes_automaticas"("p_filho_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
        v_ganho := FLOOR(v_saldo.cofrinho * v_saldo.indice_valorizacao / 100)::INTEGER;
        IF v_ganho > 0 THEN
          v_saldo.cofrinho := v_saldo.cofrinho + v_ganho;
          v_total_filho := v_total_filho + v_ganho;
          v_ultima_valorizacao_efetiva := v_proxima;
          INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, data_referencia)
          VALUES (v_alvo_id, 'valorizacao', v_ganho,
            'Valorização automática do cofrinho (' || v_indice_formatado || '% · ref. ' || to_char(v_proxima, 'DD/MM/YYYY') || ')',
            v_proxima);
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
             THEN now() ELSE updated_at END
     WHERE filho_id = v_alvo_id;

    v_total_geral := v_total_geral + v_total_filho;
  END LOOP;

  RETURN v_total_geral;
END;
$$;
