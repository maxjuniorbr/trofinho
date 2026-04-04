-- ============================================================
-- Trofinho — S20: Audit trail for admin actions
--
-- Creates audit_log table and helper function, then instruments
-- all admin RPCs to record who did what.
-- ============================================================

-- ─── Table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id   UUID        NOT NULL REFERENCES public.familias (id) ON DELETE CASCADE,
  operador_id  UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  acao         TEXT        NOT NULL,
  alvo_tipo    TEXT        NOT NULL,
  alvo_id      UUID,
  detalhes     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_familia   ON public.audit_log (familia_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_operador  ON public.audit_log (operador_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin"
  ON public.audit_log FOR SELECT
  USING (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

-- ─── Helper ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_audit(
  p_acao       TEXT,
  p_alvo_tipo  TEXT,
  p_alvo_id    UUID DEFAULT NULL,
  p_detalhes   JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (familia_id, operador_id, acao, alvo_tipo, alvo_id, detalhes)
  VALUES (
    public.minha_familia_id(),
    auth.uid(),
    p_acao,
    p_alvo_tipo,
    p_alvo_id,
    p_detalhes
  );
END;
$$;

-- ─── Instrumented RPCs ──────────────────────────────────────

-- 1. aprovar_atribuicao

CREATE OR REPLACE FUNCTION public.aprovar_atribuicao(atribuicao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  VALUES (v_filho_id, 'credito', v_pontos, 'Tarefa aprovada: ' || v_titulo, atribuicao_id);

  PERFORM public.registrar_audit(
    'aprovar_atribuicao', 'atribuicao', atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos', v_pontos)
  );
END;
$$;

-- 2. rejeitar_atribuicao

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

  PERFORM public.registrar_audit(
    'rejeitar_atribuicao', 'atribuicao', p_atribuicao_id,
    jsonb_build_object('filho_id', v_filho_id, 'nota', p_nota_rejeicao)
  );
END;
$$;

-- 3. aplicar_penalizacao

CREATE OR REPLACE FUNCTION public.aplicar_penalizacao(
  p_filho_id  UUID,
  p_valor     INTEGER,
  p_descricao TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
  v_saldo_livre INTEGER;
  v_deducted INTEGER;
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

  -- Rate limit: max 10 penalties per 10 minutes
  PERFORM public.verificar_limite_frequencia(p_filho_id, 'penalizacao', INTERVAL '10 minutes', 10);

  SELECT saldo_livre INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id
   FOR UPDATE;

  IF v_saldo_livre = 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente para penalização.';
  END IF;

  v_deducted := LEAST(p_valor, GREATEST(0, v_saldo_livre));

  UPDATE public.saldos
     SET saldo_livre = GREATEST(0, saldo_livre - p_valor),
         updated_at  = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'penalizacao', v_deducted, trim(p_descricao));

  PERFORM public.registrar_audit(
    'aplicar_penalizacao', 'filho', p_filho_id,
    jsonb_build_object('valor', p_valor, 'deducted', v_deducted, 'descricao', trim(p_descricao))
  );

  RETURN v_deducted;
END;
$$;

-- 4. desativar_filho

CREATE OR REPLACE FUNCTION public.desativar_filho(p_filho_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
  v_pending_validation INTEGER;
  v_total_balance INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem desativar filhos';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
     WHERE f.id = p_filho_id AND f.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
     WHERE f.id = p_filho_id AND f.ativo = true
  ) THEN
    SELECT count(*)::INTEGER INTO v_pending_validation
      FROM public.atribuicoes WHERE filho_id = p_filho_id AND status = 'aguardando_validacao';

    SELECT COALESCE(s.saldo_livre, 0) + COALESCE(s.cofrinho, 0) INTO v_total_balance
      FROM public.saldos s WHERE s.filho_id = p_filho_id;
    v_total_balance := COALESCE(v_total_balance, 0);

    RETURN json_build_object('pendingValidationCount', v_pending_validation, 'totalBalance', v_total_balance);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.resgates r
     WHERE r.filho_id = p_filho_id AND r.status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Não é possível desativar um filho com resgates pendentes. Confirme ou cancele os resgates antes de desativar.';
  END IF;

  UPDATE public.filhos SET ativo = false WHERE id = p_filho_id;

  UPDATE public.atribuicoes
     SET status = 'rejeitada', nota_rejeicao = 'Filho desativado'
   WHERE filho_id = p_filho_id AND status = 'pendente';

  SELECT count(*)::INTEGER INTO v_pending_validation
    FROM public.atribuicoes WHERE filho_id = p_filho_id AND status = 'aguardando_validacao';

  SELECT COALESCE(s.saldo_livre, 0) + COALESCE(s.cofrinho, 0) INTO v_total_balance
    FROM public.saldos s WHERE s.filho_id = p_filho_id;
  v_total_balance := COALESCE(v_total_balance, 0);

  PERFORM public.registrar_audit(
    'desativar_filho', 'filho', p_filho_id, NULL
  );

  RETURN json_build_object('pendingValidationCount', v_pending_validation, 'totalBalance', v_total_balance);
END;
$$;

-- 5. reativar_filho

CREATE OR REPLACE FUNCTION public.reativar_filho(p_filho_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem reativar filhos';
  END IF;

  v_familia_id := public.minha_familia_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
     WHERE f.id = p_filho_id AND f.familia_id = v_familia_id
  ) THEN
    RAISE EXCEPTION 'Filho não encontrado';
  END IF;

  UPDATE public.filhos SET ativo = true WHERE id = p_filho_id;

  UPDATE public.saldos
     SET proxima_valorizacao_em = NULL, updated_at = now()
   WHERE filho_id = p_filho_id;

  PERFORM public.registrar_audit(
    'reativar_filho', 'filho', p_filho_id, NULL
  );
END;
$$;

-- 6. confirmar_resgate

CREATE OR REPLACE FUNCTION public.confirmar_resgate(p_resgate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filho_id UUID;
BEGIN
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem confirmar resgates';
  END IF;

  SELECT r.filho_id
    INTO v_filho_id
    FROM public.resgates r
    JOIN public.filhos f ON f.id = r.filho_id
   WHERE r.id = p_resgate_id
     AND r.status = 'pendente'
     AND f.familia_id = public.minha_familia_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado ou não está pendente';
  END IF;

  UPDATE public.resgates
     SET status     = 'confirmado',
         updated_at = now()
   WHERE id = p_resgate_id;

  PERFORM public.registrar_audit(
    'confirmar_resgate', 'resgate', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id)
  );
END;
$$;

-- 7. cancelar_resgate

CREATE OR REPLACE FUNCTION public.cancelar_resgate(p_resgate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  VALUES (v_filho_id, 'estorno_resgate', v_pontos,
          'Estorno: ' || v_nome, p_resgate_id);

  PERFORM public.registrar_audit(
    'cancelar_resgate', 'resgate', p_resgate_id,
    jsonb_build_object('filho_id', v_filho_id, 'pontos_estornados', v_pontos)
  );
END;
$$;
