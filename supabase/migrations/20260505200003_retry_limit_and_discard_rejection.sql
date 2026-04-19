-- Migration: enforce a 2-attempt submission limit for assignments and add discard-rejection RPC.
-- Rules:
--   - Each call to concluir_atribuicao counts as one attempt (tentativas++).
--   - Maximum 2 attempts per assignment.
--   - concluir_atribuicao now accepts both 'pendente' and 'rejeitada' as starting status,
--     so the child can resubmit a rejected assignment up to one more time.
--   - descartar_rejeicao_atribuicao moves a 'rejeitada' assignment back to 'pendente' and
--     clears nota_rejeicao + evidencia_url. It does NOT reset tentativas — discarding feedback
--     is just a UX shortcut; the next submission still counts toward the limit.
--   - rejeitar_atribuicao does NOT change tentativas (only submissions do).

CREATE OR REPLACE FUNCTION public.concluir_atribuicao(
  p_atribuicao_id uuid,
  p_evidencia_url text DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_tarefa_familia UUID;
  v_exige_evidencia BOOLEAN;
  v_status public.atribuicao_status;
  v_tarefa_ativa BOOLEAN;
  v_tarefa_arquivada timestamptz;
  v_tentativas integer;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT t.familia_id, t.exige_evidencia, a.status, t.ativo, t.arquivada_em, a.tentativas
    INTO v_tarefa_familia, v_exige_evidencia, v_status, v_tarefa_ativa, v_tarefa_arquivada, v_tentativas
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

  IF v_status NOT IN ('pendente', 'rejeitada') THEN
    RAISE EXCEPTION 'Esta atribuição não pode ser enviada agora';
  END IF;

  IF v_tarefa_ativa = false OR v_tarefa_arquivada IS NOT NULL THEN
    RAISE EXCEPTION 'Esta tarefa está pausada ou arquivada e não pode ser enviada';
  END IF;

  IF v_tentativas >= 2 THEN
    RAISE EXCEPTION 'Você já usou todas as tentativas para esta tarefa';
  END IF;

  IF v_exige_evidencia AND (p_evidencia_url IS NULL OR trim(p_evidencia_url) = '') THEN
    RAISE EXCEPTION 'Esta tarefa exige evidência';
  END IF;

  UPDATE public.atribuicoes a
     SET status = 'aguardando_validacao',
         evidencia_url = p_evidencia_url,
         concluida_em = now(),
         nota_rejeicao = NULL,
         validada_em = NULL,
         validada_por = NULL,
         tentativas = a.tentativas + 1
    FROM public.tarefas t
   WHERE a.id = p_atribuicao_id
     AND a.tarefa_id = t.id
     AND a.status IN ('pendente', 'rejeitada')
     AND t.ativo = true
     AND t.arquivada_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta atribuição não pode ser enviada agora';
  END IF;
END;
$$;

ALTER FUNCTION public.concluir_atribuicao(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.concluir_atribuicao(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.descartar_rejeicao_atribuicao(p_atribuicao_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_owner_user_id UUID;
  v_tarefa_familia UUID;
  v_status public.atribuicao_status;
  v_tarefa_ativa BOOLEAN;
  v_tarefa_arquivada timestamptz;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  SELECT f.usuario_id, t.familia_id, a.status, t.ativo, t.arquivada_em
    INTO v_owner_user_id, v_tarefa_familia, v_status, v_tarefa_ativa, v_tarefa_arquivada
    FROM public.atribuicoes a
    JOIN public.filhos f ON f.id = a.filho_id
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE a.id = p_atribuicao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada';
  END IF;

  IF v_owner_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Apenas filhos podem descartar a própria rejeição';
  END IF;

  IF v_tarefa_familia != public.minha_familia_id() THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  IF v_status != 'rejeitada' THEN
    RAISE EXCEPTION 'Esta atribuição não foi rejeitada';
  END IF;

  IF v_tarefa_ativa = false OR v_tarefa_arquivada IS NOT NULL THEN
    RAISE EXCEPTION 'Esta tarefa está pausada ou arquivada';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'pendente',
         nota_rejeicao = NULL,
         evidencia_url = NULL,
         concluida_em = NULL,
         validada_em = NULL,
         validada_por = NULL
   WHERE id = p_atribuicao_id
     AND status = 'rejeitada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta atribuição não foi rejeitada';
  END IF;
END;
$$;

ALTER FUNCTION public.descartar_rejeicao_atribuicao(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.descartar_rejeicao_atribuicao(uuid) TO authenticated;
