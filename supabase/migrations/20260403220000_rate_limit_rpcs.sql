-- Rate limiting on abuse-prone RPCs (Q13)
-- Limits: solicitar_resgate 5/10min, transferir_para_cofrinho 10/10min, aplicar_penalizacao 10/10min

-- ─── Helper: check rate limit via movimentacoes table ─────────────────────────

CREATE OR REPLACE FUNCTION public.verificar_limite_frequencia(
  p_filho_id UUID,
  p_tipo     TEXT,
  p_janela   INTERVAL,
  p_limite   INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contagem INTEGER;
BEGIN
  SELECT count(*)::int
    INTO v_contagem
    FROM public.movimentacoes
   WHERE filho_id = p_filho_id
     AND tipo = p_tipo
     AND created_at > now() - p_janela;

  IF v_contagem >= p_limite THEN
    RAISE EXCEPTION 'Limite de operações atingido. Tente novamente em alguns minutos.';
  END IF;
END;
$$;

-- ─── solicitar_resgate: add rate check (5 per 10 min) ────────────────────────

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
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: % pts, necessário: % pts',
      v_saldo_livre, v_custo;
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

-- ─── transferir_para_cofrinho: add rate check (10 per 10 min) ────────────────

CREATE OR REPLACE FUNCTION public.transferir_para_cofrinho(
  p_filho_id UUID,
  p_valor INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_livre INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF public.meu_filho_id() != p_filho_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  -- Rate limit: max 10 transfers per 10 minutes
  PERFORM public.verificar_limite_frequencia(p_filho_id, 'transferencia_cofrinho', INTERVAL '10 minutes', 10);

  PERFORM public.sincronizar_valorizacoes_automaticas(p_filho_id);

  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id
   FOR UPDATE;

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < p_valor THEN
    RAISE EXCEPTION 'Saldo livre insuficiente';
  END IF;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre - p_valor,
         cofrinho = cofrinho + p_valor,
         updated_at = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'transferencia_cofrinho', p_valor, 'Transferência para o cofrinho');
END;
$$;

-- ─── aplicar_penalizacao: add rate check (10 per 10 min) ─────────────────────

DROP FUNCTION IF EXISTS public.aplicar_penalizacao(UUID, INTEGER, TEXT);

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
   WHERE filho_id = p_filho_id;

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
