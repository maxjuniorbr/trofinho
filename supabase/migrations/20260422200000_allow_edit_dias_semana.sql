-- Migration: allow editing dias_semana on existing tasks
-- Fixes editar_tarefa RPC to use the effective (post-update) dias_semana value
-- when deciding whether to update points, so switching one-time↔recurring + changing
-- points works in a single save.

CREATE OR REPLACE FUNCTION public.editar_tarefa(
  p_tarefa_id uuid,
  p_titulo text,
  p_descricao text,
  p_pontos integer DEFAULT NULL,
  p_requer_evidencia boolean DEFAULT NULL,
  p_dias_semana smallint DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_dias_semana smallint;
  v_effective_dias_semana smallint;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem editar tarefas';
  END IF;

  IF trim(COALESCE(p_titulo, '')) = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  SELECT t.dias_semana INTO v_dias_semana
    FROM public.tarefas t
   WHERE t.id = p_tarefa_id AND t.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tarefas WHERE id = p_tarefa_id AND ativo = true) THEN
    RAISE EXCEPTION 'Não é possível editar uma tarefa desativada.';
  END IF;

  -- One-time tasks (dias_semana = 0) cannot be edited if any assignment was completed.
  IF v_dias_semana = 0
     AND EXISTS (
       SELECT 1 FROM public.atribuicoes a
        WHERE a.tarefa_id = p_tarefa_id
          AND (a.status IN ('aguardando_validacao', 'aprovada') OR a.concluida_em IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'Esta tarefa já foi concluída e não pode ser editada.';
  END IF;

  -- Use the effective (post-update) value for points validation and update logic.
  v_effective_dias_semana := COALESCE(p_dias_semana, v_dias_semana);

  -- Recurring tasks require valid points.
  IF v_effective_dias_semana > 0 AND (p_pontos IS NULL OR p_pontos <= 0) THEN
    RAISE EXCEPTION 'Pontos devem ser maiores que zero';
  END IF;

  UPDATE public.tarefas
     SET titulo = trim(p_titulo),
         descricao = NULLIF(trim(COALESCE(p_descricao, '')), ''),
         pontos = CASE WHEN v_effective_dias_semana > 0 THEN p_pontos ELSE pontos END,
         exige_evidencia = COALESCE(p_requer_evidencia, exige_evidencia),
         dias_semana = COALESCE(p_dias_semana, dias_semana)
   WHERE id = p_tarefa_id;
END;
$$;
