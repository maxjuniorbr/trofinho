-- Cleanup movimentacoes descriptions: remove redundant type prefixes (the UI
-- already shows the type label) and standardize the credito suffix to
-- "(tarefa de DD/MM)" whenever the assignment has a competencia.
--
-- Affected RPCs:
--   • aprovar_atribuicao            credito         strip "Tarefa aprovada: "
--   • solicitar_resgate             resgate         strip "Resgate: "
--   • cancelar_resgate              estorno_resgate strip "Estorno: "
--   • confirmar_resgate_cofrinho    resgate_cofrinho strip "Resgate do cofrinho (taxa N%):"
--                                                    + format taxa without trailing zeros
--
-- Idempotent: backfills check NOT LIKE before mutating, so re-running is safe.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. RPCs
-- ────────────────────────────────────────────────────────────────────────────

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
  v_descricao TEXT;
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

  v_descricao := v_titulo;
  IF v_competencia IS NOT NULL THEN
    v_descricao := v_descricao || ' (tarefa de ' || to_char(v_competencia, 'DD/MM') || ')';
  END IF;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'credito', v_pontos, v_descricao, atribuicao_id);

  PERFORM public.registrar_audit(
    'aprovar_atribuicao', 'atribuicao', atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos', v_pontos)
  );
END;
$$;


CREATE OR REPLACE FUNCTION "public"."solicitar_resgate"("p_premio_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_filho_id        UUID;
  v_familia_id      UUID;
  v_custo           INTEGER;
  v_saldo_livre     INTEGER;
  v_nome_premio     TEXT;
  v_resgate_id      UUID;
BEGIN
  IF public.meu_papel() <> 'filho' THEN
    RAISE EXCEPTION 'Apenas filhos podem solicitar resgates';
  END IF;

  v_filho_id   := public.meu_filho_id();

  v_familia_id := (
    SELECT u.familia_id
      FROM public.usuarios u
     WHERE u.id = auth.uid()
  );

  SELECT nome, custo_pontos
    INTO v_nome_premio, v_custo
    FROM public.premios
   WHERE id = p_premio_id
     AND familia_id = v_familia_id
     AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêmio não encontrado ou não disponível';
  END IF;

  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = v_filho_id
   FOR UPDATE;

  PERFORM public.verificar_limite_frequencia(v_filho_id, 'resgate', INTERVAL '10 minutes', 5);

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < v_custo THEN
    RAISE EXCEPTION 'Saldo insuficiente para este resgate';
  END IF;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre - v_custo,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  INSERT INTO public.resgates (filho_id, premio_id, status, pontos_debitados)
  VALUES (v_filho_id, p_premio_id, 'pendente', v_custo)
  RETURNING id INTO v_resgate_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'resgate', v_custo, v_nome_premio, v_resgate_id);

  RETURN v_resgate_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."cancelar_resgate"("p_resgate_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_filho_id UUID;
  v_pontos   INTEGER;
  v_nome     TEXT;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem cancelar resgates';
  END IF;

  SELECT r.filho_id, r.pontos_debitados, p.nome
    INTO v_filho_id, v_pontos, v_nome
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

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'estorno_resgate', v_pontos, v_nome, p_resgate_id);

  PERFORM public.registrar_audit(
    'cancelar_resgate', 'resgate', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos_estornados', v_pontos)
  );
END;
$$;


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
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem confirmar resgates do cofrinho';
  END IF;

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

  -- Format taxa: drop trailing zeros and dangling decimal point so 5.00 → "5",
  -- 5.50 → "5.5", 5.55 → "5.55".
  v_taxa_str := regexp_replace(to_char(v_taxa_atual, 'FM999990.00'), '0+$', '');
  v_taxa_str := regexp_replace(v_taxa_str, '\.$', '');

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (
    v_filho_id,
    'resgate_cofrinho',
    v_solicitado,
    'Taxa ' || v_taxa_str || '% · recebeu ' || v_liquido || ' pts',
    p_resgate_id
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


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Backfills (idempotent)
-- ────────────────────────────────────────────────────────────────────────────

-- 2a. Strip "Tarefa aprovada: " prefix from credito descriptions
UPDATE public.movimentacoes
   SET descricao = regexp_replace(descricao, '^Tarefa aprovada: ', '')
 WHERE tipo = 'credito'
   AND descricao LIKE 'Tarefa aprovada: %';

-- 2b. Convert any legacy " · DD/MM" suffix into "(tarefa de DD/MM)"
UPDATE public.movimentacoes
   SET descricao = regexp_replace(descricao,
                                  ' · ([0-9]{2}/[0-9]{2})$',
                                  ' (tarefa de \1)')
 WHERE tipo = 'credito'
   AND descricao ~ ' · [0-9]{2}/[0-9]{2}$'
   AND descricao NOT LIKE '%(tarefa de %';

-- 2c. Backfill missing "(tarefa de DD/MM)" suffix for all credito with competencia
UPDATE public.movimentacoes m
   SET descricao = m.descricao || ' (tarefa de ' || to_char(a.competencia, 'DD/MM') || ')'
  FROM public.atribuicoes a
 WHERE m.tipo = 'credito'
   AND m.referencia_id = a.id
   AND a.competencia IS NOT NULL
   AND m.descricao NOT LIKE '%(tarefa de %';

-- 2d. Strip "Resgate: " prefix from resgate descriptions
UPDATE public.movimentacoes
   SET descricao = regexp_replace(descricao, '^Resgate: ', '')
 WHERE tipo = 'resgate'
   AND descricao LIKE 'Resgate: %';

-- 2e. Strip "Estorno: " prefix from estorno_resgate descriptions
UPDATE public.movimentacoes
   SET descricao = regexp_replace(descricao, '^Estorno: ', '')
 WHERE tipo = 'estorno_resgate'
   AND descricao LIKE 'Estorno: %';

-- 2f. Rewrite "Resgate do cofrinho (taxa X%): recebeu N pts" into the new
--     short form "Taxa X% · recebeu N pts", trimming trailing zeros on X.
UPDATE public.movimentacoes
   SET descricao = 'Taxa '
                  || regexp_replace(
                       regexp_replace((regexp_match(descricao, 'taxa ([0-9]+(?:\.[0-9]+)?)%'))[1],
                                      '0+$', ''),
                       '\.$', '')
                  || '% · recebeu '
                  || (regexp_match(descricao, 'recebeu ([0-9]+) pts'))[1]
                  || ' pts'
 WHERE tipo = 'resgate_cofrinho'
   AND descricao LIKE 'Resgate do cofrinho (taxa %';
