-- ============================================================
-- Trofinho — Security hardening (phase 2)
--
-- S12: Add DELETE policy on push_tokens (was missing — signOut
--      could never clean up tokens via direct table access).
-- S19: Add FOR UPDATE to aplicar_penalizacao saldo read
--      (prevents double-deduction under concurrency).
-- S8:  Add length constraints on TEXT columns.
-- S9:  Add upper-bound constraints on point/amount columns.
-- S16: Remove balance leak from solicitar_resgate error message.
-- S39: Add indexes for common query patterns.
-- ============================================================

-- ─── S12: DELETE policy on push_tokens ──────────────────────

DROP POLICY IF EXISTS "push_tokens_delete_self" ON public.push_tokens;
CREATE POLICY "push_tokens_delete_self"
  ON public.push_tokens
  FOR DELETE
  USING (user_id = auth.uid());

-- ─── S8: Text length constraints ────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_titulo_max_length') THEN
    ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_titulo_max_length CHECK (length(titulo) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_descricao_max_length') THEN
    ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_descricao_max_length CHECK (descricao IS NULL OR length(descricao) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'premios_nome_max_length') THEN
    ALTER TABLE public.premios ADD CONSTRAINT premios_nome_max_length CHECK (length(nome) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'premios_descricao_max_length') THEN
    ALTER TABLE public.premios ADD CONSTRAINT premios_descricao_max_length CHECK (descricao IS NULL OR length(descricao) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atribuicoes_nota_rejeicao_max_length') THEN
    ALTER TABLE public.atribuicoes ADD CONSTRAINT atribuicoes_nota_rejeicao_max_length CHECK (nota_rejeicao IS NULL OR length(nota_rejeicao) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'familias_nome_max_length') THEN
    ALTER TABLE public.familias ADD CONSTRAINT familias_nome_max_length CHECK (length(nome) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_nome_max_length') THEN
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_nome_max_length CHECK (length(nome) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'filhos_nome_max_length') THEN
    ALTER TABLE public.filhos ADD CONSTRAINT filhos_nome_max_length CHECK (length(nome) <= 100);
  END IF;

  -- S9: Numeric upper-bound constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_pontos_max') THEN
    ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_pontos_max CHECK (pontos <= 99999);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'premios_custo_pontos_max') THEN
    ALTER TABLE public.premios ADD CONSTRAINT premios_custo_pontos_max CHECK (custo_pontos <= 99999);
  END IF;
END;
$$;

-- ─── S39: Indexes for common query patterns ─────────────────

CREATE INDEX IF NOT EXISTS idx_atribuicoes_status
  ON public.atribuicoes (status);

CREATE INDEX IF NOT EXISTS idx_resgates_status
  ON public.resgates (status);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_rate_limit
  ON public.movimentacoes (filho_id, tipo, created_at);

CREATE INDEX IF NOT EXISTS idx_filhos_usuario_id
  ON public.filhos (usuario_id);

-- ─── S19: Fix aplicar_penalizacao — add FOR UPDATE ──────────

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
   FOR UPDATE;  -- S19: prevent concurrent double-deduction

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

  RETURN v_deducted;
END;
$$;

-- ─── S16: Remove balance leak from solicitar_resgate ────────

CREATE OR REPLACE FUNCTION public.solicitar_resgate(p_premio_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filho_id        UUID;
  v_familia_id      UUID;
  v_custo           INTEGER;
  v_saldo_livre     INTEGER;
  v_nome_premio     TEXT;
  v_resgate_id      UUID;
BEGIN
  IF public.meu_papel() <> 'filho' THEN
    RAISE EXCEPTION 'Apenas filhos podem solicitar resgates';
  END IF;

  v_filho_id   := public.meu_filho_id();

  -- Rate limit: max 5 resgates per 10 minutes
  PERFORM public.verificar_limite_frequencia(v_filho_id, 'resgate', INTERVAL '10 minutes', 5);

  v_familia_id := (
    SELECT u.familia_id
      FROM public.usuarios u
     WHERE u.id = auth.uid()
  );

  SELECT nome, custo_pontos
    INTO v_nome_premio, v_custo
    FROM public.premios
   WHERE id = p_premio_id
     AND familia_id = v_familia_id
     AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêmio não encontrado ou não disponível';
  END IF;

  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = v_filho_id
   FOR UPDATE;

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < v_custo THEN
    RAISE EXCEPTION 'Saldo insuficiente para este resgate';  -- S16: generic message, no balance leak
  END IF;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre - v_custo,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  INSERT INTO public.resgates (filho_id, premio_id, status, pontos_debitados)
  VALUES (v_filho_id, p_premio_id, 'pendente', v_custo)
  RETURNING id INTO v_resgate_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (
    v_filho_id,
    'resgate',
    v_custo,
    'Resgate: ' || v_nome_premio,
    v_resgate_id
  );

  RETURN v_resgate_id;
END;
$$;
