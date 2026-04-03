-- ============================================================
-- Trofinho — Cancelar envio de atribuicao
-- Permite que o filho reverta um envio ainda aguardando validacao.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancelar_envio_atribuicao(
  p_atribuicao_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_owner_user_id UUID;
  v_tarefa_familia UUID;
  v_status public.atribuicao_status;
  v_competencia DATE;
  v_frequencia public.tarefa_frequencia;
  v_tarefa_ativa BOOLEAN;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT f.usuario_id,
         t.familia_id,
         a.status,
         a.competencia,
         t.frequencia,
         t.ativo
    INTO v_owner_user_id,
         v_tarefa_familia,
         v_status,
         v_competencia,
         v_frequencia,
         v_tarefa_ativa
    FROM public.atribuicoes a
    JOIN public.filhos f ON f.id = a.filho_id
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE a.id = p_atribuicao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada';
  END IF;

  IF v_owner_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Apenas filhos podem cancelar o próprio envio';
  END IF;

  IF v_tarefa_familia != public.minha_familia_id() THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  IF v_status != 'aguardando_validacao' THEN
    RAISE EXCEPTION 'Esta atribuição não está aguardando validação';
  END IF;

  IF v_tarefa_ativa = false THEN
    RAISE EXCEPTION 'Esta tarefa está desativada';
  END IF;

  IF v_frequencia = 'diaria'
     AND v_competencia IS NOT NULL
     AND v_competencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível cancelar envio de tarefa diária de data anterior';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'pendente',
         concluida_em = NULL,
         evidencia_url = NULL,
         nota_rejeicao = NULL,
         validada_em = NULL,
         validada_por = NULL
   WHERE id = p_atribuicao_id
     AND status = 'aguardando_validacao';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta atribuição não está aguardando validação';
  END IF;
END;
$$;
