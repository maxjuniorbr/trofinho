-- ============================================================
-- Trofinho — Security hardening (phase 3)
--
-- S36: Replace inline subquery with minha_familia_id() in
--      premios_select_filho policy for consistency.
-- S38: Add CHECK constraint requiring nota_rejeicao when
--      status = 'rejeitada'.
-- S4:  Add temporal guard to limpar_auth_user_orfao — only
--      allow deleting auth.users created in the last 5 minutes.
-- S15: Reorder rate limit after FOR UPDATE in solicitar_resgate
--      to eliminate window between check and lock.
-- ============================================================

-- ─── S36: Policy premios_select_filho — use helper ──────────

DROP POLICY IF EXISTS "premios_select_filho" ON public.premios;
CREATE POLICY "premios_select_filho"
  ON public.premios FOR SELECT
  USING (
    public.meu_papel() = 'filho'
    AND ativo = true
    AND familia_id = public.minha_familia_id()
  );

-- ─── S38: CHECK constraint — nota_rejeicao required on rejection

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atribuicoes_nota_rejeicao_required') THEN
    ALTER TABLE public.atribuicoes
      ADD CONSTRAINT atribuicoes_nota_rejeicao_required
      CHECK (status <> 'rejeitada' OR nota_rejeicao IS NOT NULL);
  END IF;
END;
$$;

-- ─── S4: Temporal guard on limpar_auth_user_orfao ───────────

CREATE OR REPLACE FUNCTION public.limpar_auth_user_orfao(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem remover contas órfãs';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_user_id) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.filhos WHERE usuario_id = p_user_id) THEN
    RETURN;
  END IF;

  -- S4: Only allow deleting users created in the last 5 minutes (cleanup window).
  -- Prevents abuse of this function to delete arbitrary auth.users.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
     WHERE id = p_user_id
       AND created_at >= now() - INTERVAL '5 minutes'
  ) THEN
    RETURN;
  END IF;

  DELETE FROM auth.users
   WHERE id = p_user_id;
END;
$$;

-- ─── S15: Reorder rate limit after FOR UPDATE in solicitar_resgate

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

  -- S15: Rate limit moved after FOR UPDATE to eliminate window between check and lock.
  PERFORM public.verificar_limite_frequencia(v_filho_id, 'resgate', INTERVAL '10 minutes', 5);

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < v_custo THEN
    RAISE EXCEPTION 'Saldo insuficiente para este resgate';
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
