-- ============================================================
-- Trofinho — Harden concluir_atribuicao against inactive tasks
-- Revalidates pending status and task activity atomically to
-- prevent stale UI and admin/child races from reopening flow.
-- ============================================================

CREATE OR REPLACE FUNCTION public.concluir_atribuicao(
  p_atribuicao_id UUID,
  p_evidencia_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_tarefa_familia UUID;
  v_exige_evidencia BOOLEAN;
  v_status public.atribuicao_status;
  v_tarefa_ativa BOOLEAN;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT t.familia_id,
         t.exige_evidencia,
         a.status,
         t.ativo
    INTO v_tarefa_familia,
         v_exige_evidencia,
         v_status,
         v_tarefa_ativa
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
    JOIN public.filhos f ON f.id = a.filho_id
   WHERE a.id = p_atribuicao_id
     AND f.usuario_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada';
  END IF;

  IF v_tarefa_familia != public.minha_familia_id() THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  IF v_status != 'pendente' THEN
    RAISE EXCEPTION 'Esta atribuição não está pendente';
  END IF;

  IF v_tarefa_ativa = false THEN
    RAISE EXCEPTION 'Esta tarefa está desativada e não pode ser enviada para validação';
  END IF;

  IF v_exige_evidencia AND (p_evidencia_url IS NULL OR trim(p_evidencia_url) = '') THEN
    RAISE EXCEPTION 'Esta tarefa exige evidência';
  END IF;

  UPDATE public.atribuicoes a
     SET status = 'aguardando_validacao',
         evidencia_url = p_evidencia_url,
         concluida_em = now()
    FROM public.tarefas t
   WHERE a.id = p_atribuicao_id
     AND a.tarefa_id = t.id
     AND a.status = 'pendente'
     AND t.ativo = true;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
        FROM public.atribuicoes a
        JOIN public.tarefas t ON t.id = a.tarefa_id
       WHERE a.id = p_atribuicao_id
         AND t.ativo = false
    ) THEN
      RAISE EXCEPTION 'Esta tarefa está desativada e não pode ser enviada para validação';
    END IF;

    RAISE EXCEPTION 'Esta atribuição não está pendente';
  END IF;
END;
$$;
