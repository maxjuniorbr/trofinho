-- ============================================================
-- Trofinho — Review Phases 1 & 2
-- RPC rejeitar_atribuicao, triggers, policies, aplicar_penalizacao fix
-- ============================================================

-- ─── 1. RPC: rejeitar_atribuicao ─────────────────────────────

CREATE OR REPLACE FUNCTION public.rejeitar_atribuicao(
  p_atribuicao_id UUID,
  p_nota_rejeicao TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_familia_id UUID;
  v_filho_id UUID;
  v_tarefa_familia UUID;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem rejeitar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT a.filho_id, t.familia_id
    INTO v_filho_id, v_tarefa_familia
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
   WHERE a.id = p_atribuicao_id
     AND a.status = 'aguardando_validacao';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada ou não está aguardando validação';
  END IF;

  IF v_tarefa_familia != v_familia_id THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'rejeitada',
         nota_rejeicao = p_nota_rejeicao,
         validada_em = now(),
         validada_por = v_caller_id
   WHERE id = p_atribuicao_id;
END;
$$;

-- ─── 2. Trigger: set_concluida_em_on_submit ──────────────────

CREATE OR REPLACE FUNCTION public.set_concluida_em_on_submit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status = 'aguardando_validacao' THEN
    NEW.concluida_em = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_concluida_em_on_submit ON public.atribuicoes;
CREATE TRIGGER set_concluida_em_on_submit
  BEFORE UPDATE ON public.atribuicoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_concluida_em_on_submit();

-- ─── 3. Policy: usuarios_update_self_limited ─────────────────

DROP POLICY IF EXISTS "usuarios_update_self_limited" ON public.usuarios;
CREATE POLICY "usuarios_update_self_limited"
  ON public.usuarios
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── 4. Trigger: prevent_usuarios_privilege_escalation ───────

CREATE OR REPLACE FUNCTION public.prevent_usuarios_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.papel != OLD.papel OR NEW.familia_id IS DISTINCT FROM OLD.familia_id THEN
    RAISE EXCEPTION 'Alteração de papel ou família não permitida.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_usuarios_privilege_escalation ON public.usuarios;
CREATE TRIGGER prevent_usuarios_privilege_escalation
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_usuarios_privilege_escalation();

-- ─── 5. Update: aplicar_penalizacao (add zero-balance check) ─

CREATE OR REPLACE FUNCTION public.aplicar_penalizacao(
  p_filho_id  UUID,
  p_valor     INTEGER,
  p_descricao TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
  v_saldo_livre INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aplicar penalização';
  END IF;

  v_familia_id := public.minha_familia_id();

  PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  IF p_descricao IS NULL OR trim(p_descricao) = '' THEN
    RAISE EXCEPTION 'Descrição obrigatória para penalização';
  END IF;

  SELECT saldo_livre INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id;

  IF v_saldo_livre = 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente para penalização.';
  END IF;

  -- Saldo não pode ficar negativo; desconta o máximo possível
  UPDATE public.saldos
     SET saldo_livre = GREATEST(0, saldo_livre - p_valor),
         updated_at  = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (
    p_filho_id,
    'penalizacao',
    LEAST(p_valor, GREATEST(0, v_saldo_livre)),
    trim(p_descricao)
  );
END;
$$;

-- ─── 6. Policy: push_tokens_delete_self ──────────────────────

DROP POLICY IF EXISTS "push_tokens_delete_self" ON public.push_tokens;
CREATE POLICY "push_tokens_delete_self"
  ON public.push_tokens
  FOR DELETE
  USING (user_id = auth.uid());
