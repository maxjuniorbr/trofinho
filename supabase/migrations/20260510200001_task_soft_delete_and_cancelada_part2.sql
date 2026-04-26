-- Migration 2/2: Task soft delete (excluida_em) and cancelada assignment status.
--
-- Depends on 20260510200000 which added 'cancelada' to atribuicao_status enum.
--
-- 1. Adds excluida_em column to tarefas (soft-delete timestamp)
-- 2. Creates partial index for non-deleted tasks
-- 3. Creates excluir_tarefa RPC (admin-only, idempotent)
-- 4. Updates desativar_tarefa: rejeitada → cancelada for pendente assignments
-- 5. Updates arquivar_tarefa: rejeitada → cancelada + excluida_em guard
-- 6. Updates desarquivar_tarefa: excluida_em guard
-- 7. Updates reativar_tarefa: excluida_em guard
-- 8. Updates garantir_atribuicoes_recorrentes: excluida_em filter
-- 9. Backfills existing system-rejected assignments → cancelada

-- 1. Add excluida_em column to tarefas
ALTER TABLE public.tarefas ADD COLUMN excluida_em timestamptz NULL;

COMMENT ON COLUMN public.tarefas.excluida_em IS
  'When non-null, the task is soft-deleted: hidden from all views, no new recurring assignments, history preserved.';

-- 2. Partial index for non-deleted tasks (accelerates list queries)
CREATE INDEX idx_tarefas_nao_excluidas
  ON public.tarefas (familia_id)
  WHERE excluida_em IS NULL;

-- 3. New excluir_tarefa RPC
CREATE OR REPLACE FUNCTION public.excluir_tarefa(p_tarefa_id uuid) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
  v_excluida_em TIMESTAMPTZ;
  v_pending_validation INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem excluir tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT t.excluida_em INTO v_excluida_em
    FROM public.tarefas t
   WHERE t.id = p_tarefa_id AND t.familia_id = v_familia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  -- Idempotent: already deleted → return 0
  IF v_excluida_em IS NOT NULL THEN
    RETURN 0;
  END IF;

  -- Soft-delete the task
  UPDATE public.tarefas
     SET excluida_em = now(),
         ativo = false
   WHERE id = p_tarefa_id;

  -- Cancel pendente assignments (no nota_rejeicao — left NULL)
  UPDATE public.atribuicoes
     SET status = 'cancelada'
   WHERE tarefa_id = p_tarefa_id AND status = 'pendente';

  -- Return count of aguardando_validacao assignments
  SELECT count(*)::INTEGER INTO v_pending_validation
    FROM public.atribuicoes
   WHERE tarefa_id = p_tarefa_id AND status = 'aguardando_validacao';

  RETURN v_pending_validation;
END;
$$;

ALTER FUNCTION public.excluir_tarefa(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.excluir_tarefa(uuid) TO authenticated;

-- 4. Update desativar_tarefa: rejeitada → cancelada for pendente assignments
CREATE OR REPLACE FUNCTION public.desativar_tarefa(p_tarefa_id uuid) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
  v_pending_validation INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem desativar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.ativo = true
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.tarefas SET ativo = false WHERE id = p_tarefa_id;

  UPDATE public.atribuicoes
     SET status = 'cancelada', nota_rejeicao = 'Tarefa desativada'
   WHERE tarefa_id = p_tarefa_id AND status = 'pendente';

  SELECT count(*)::INTEGER INTO v_pending_validation
    FROM public.atribuicoes
   WHERE tarefa_id = p_tarefa_id AND status = 'aguardando_validacao';

  RETURN v_pending_validation;
END;
$$;

-- 5. Update arquivar_tarefa: rejeitada → cancelada + excluida_em guard
CREATE OR REPLACE FUNCTION public.arquivar_tarefa(p_tarefa_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
  v_excluida_em TIMESTAMPTZ;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem arquivar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  -- Guard: deleted tasks cannot be archived
  SELECT t.excluida_em INTO v_excluida_em
    FROM public.tarefas t WHERE t.id = p_tarefa_id;
  IF v_excluida_em IS NOT NULL THEN
    RETURN;
  END IF;

  -- Idempotent: already archived → no-op.
  IF EXISTS (
    SELECT 1 FROM public.tarefas WHERE id = p_tarefa_id AND arquivada_em IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  UPDATE public.tarefas
     SET arquivada_em = now(),
         ativo = false
   WHERE id = p_tarefa_id;

  -- Cancel still-pending assignments
  UPDATE public.atribuicoes
     SET status = 'cancelada',
         nota_rejeicao = 'Tarefa arquivada'
   WHERE tarefa_id = p_tarefa_id AND status = 'pendente';
END;
$$;

-- 6. Update desarquivar_tarefa: excluida_em guard
CREATE OR REPLACE FUNCTION public.desarquivar_tarefa(p_tarefa_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
  v_excluida_em TIMESTAMPTZ;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem desarquivar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  -- Guard: deleted tasks cannot be unarchived
  SELECT t.excluida_em INTO v_excluida_em
    FROM public.tarefas t WHERE t.id = p_tarefa_id;
  IF v_excluida_em IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.tarefas
     SET arquivada_em = NULL,
         ativo = true
   WHERE id = p_tarefa_id AND arquivada_em IS NOT NULL;
END;
$$;

-- 7. Update reativar_tarefa: excluida_em guard
CREATE OR REPLACE FUNCTION public.reativar_tarefa(p_tarefa_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
  v_excluida_em TIMESTAMPTZ;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem reativar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
     WHERE t.id = p_tarefa_id AND t.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  -- Guard: deleted tasks cannot be reactivated
  SELECT t.excluida_em INTO v_excluida_em
    FROM public.tarefas t WHERE t.id = p_tarefa_id;
  IF v_excluida_em IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.tarefas SET ativo = true WHERE id = p_tarefa_id;
END;
$$;

-- 8. Update garantir_atribuicoes_recorrentes: excluida_em filter
CREATE OR REPLACE FUNCTION public.garantir_atribuicoes_recorrentes() RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
  SET timezone TO 'America/Sao_Paulo'
AS $$
DECLARE
  v_filho_id UUID;
  v_familia_id UUID;
  v_dow integer;
BEGIN
  v_filho_id := public.meu_filho_id();

  IF v_filho_id IS NULL THEN
    RETURN;
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (SELECT 1 FROM public.filhos WHERE id = v_filho_id AND ativo = true) THEN
    RETURN;
  END IF;

  v_dow := EXTRACT(DOW FROM CURRENT_DATE)::integer;

  INSERT INTO public.atribuicoes (tarefa_id, filho_id, status, competencia, pontos_snapshot)
  SELECT t.id, v_filho_id, 'pendente', CURRENT_DATE, t.pontos
    FROM public.tarefas t
   WHERE t.dias_semana > 0
     AND (t.dias_semana & (1 << v_dow)) > 0
     AND t.familia_id = v_familia_id
     AND t.ativo = true
     AND t.excluida_em IS NULL
     AND EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = v_filho_id
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.atribuicoes a
            WHERE a.tarefa_id = t.id AND a.filho_id = v_filho_id AND a.competencia = CURRENT_DATE
         )
  ON CONFLICT DO NOTHING;
END;
$$;

-- 9. Backfill: convert system-rejected assignments to cancelada
-- These are assignments that were rejected by the system (not by the admin)
-- when tasks were archived or deactivated. Preserve nota_rejeicao value.
UPDATE public.atribuicoes
   SET status = 'cancelada'
 WHERE status = 'rejeitada'
   AND nota_rejeicao IN ('Tarefa arquivada', 'Tarefa desativada');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
