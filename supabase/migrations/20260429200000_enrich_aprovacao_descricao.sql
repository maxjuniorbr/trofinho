-- Enrich the movimentacao description in aprovar_atribuicao with the
-- assignment's competencia date when the approval happens on a later day.
-- This makes it clear in balance screens which day a task was originally for.

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

  v_descricao := 'Tarefa aprovada: ' || v_titulo;
  IF v_competencia IS NOT NULL AND v_competencia < CURRENT_DATE THEN
    v_descricao := v_descricao || ' · ' || to_char(v_competencia, 'DD/MM');
  END IF;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'credito', v_pontos, v_descricao, atribuicao_id);

  PERFORM public.registrar_audit(
    'aprovar_atribuicao', 'atribuicao', atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos', v_pontos)
  );
END;
$$;
