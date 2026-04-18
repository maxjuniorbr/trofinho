-- Revert presentation suffix "(tarefa de DD/MM)" from movimentacoes.descricao.
--
-- Architectural rule: presentation strings are CLIENT-ONLY. The previous
-- migration (20260430200000) violated this by appending the cross-day suffix
-- both in the aprovar_atribuicao RPC and in backfill 2c. The same suffix is
-- already produced client-side (and conditionally — only when the validation
-- date differs from the competencia) by buildValidationLine in lib/tasks.ts.
--
-- This migration:
--   • Restores aprovar_atribuicao to write only the bare task title in
--     movimentacoes.descricao.
--   • Strips the "(tarefa de DD/MM)" suffix from existing credito rows.
--
-- Idempotent: backfill checks LIKE before mutating, so re-running is safe.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. RPC
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
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aprovar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT a.filho_id,
         COALESCE(a.pontos_snapshot, t.pontos),
         t.familia_id,
         t.titulo
    INTO v_filho_id, v_pontos, v_tarefa_familia, v_titulo
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

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'credito', v_pontos, v_titulo, atribuicao_id);

  PERFORM public.registrar_audit(
    'aprovar_atribuicao', 'atribuicao', atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos', v_pontos)
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Backfill (idempotent): strip "(tarefa de DD/MM)" suffix from credito rows
-- ────────────────────────────────────────────────────────────────────────────

UPDATE public.movimentacoes
   SET descricao = regexp_replace(descricao, ' \(tarefa de [0-9]{2}/[0-9]{2}\)$', '')
 WHERE tipo = 'credito'
   AND descricao ~ ' \(tarefa de [0-9]{2}/[0-9]{2}\)$';
