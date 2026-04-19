-- Migration: archive / unarchive RPCs for tasks.
-- Archiving cancels pendente assignments (mark as rejeitada with system note "Tarefa arquivada"),
-- preserves history (aprovada / rejeitada / aguardando_validacao stay), prevents future
-- recurring generation by also setting ativo=false, and hides the task from default lists.

CREATE OR REPLACE FUNCTION public.arquivar_tarefa(p_tarefa_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
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

  -- Cancel still-pending assignments. Awaiting validation is preserved so the admin can review.
  UPDATE public.atribuicoes
     SET status = 'rejeitada',
         nota_rejeicao = 'Tarefa arquivada'
   WHERE tarefa_id = p_tarefa_id AND status = 'pendente';
END;
$$;

ALTER FUNCTION public.arquivar_tarefa(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.arquivar_tarefa(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.desarquivar_tarefa(p_tarefa_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id UUID;
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

  UPDATE public.tarefas
     SET arquivada_em = NULL,
         ativo = true
   WHERE id = p_tarefa_id AND arquivada_em IS NOT NULL;
END;
$$;

ALTER FUNCTION public.desarquivar_tarefa(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.desarquivar_tarefa(uuid) TO authenticated;
