-- ============================================================
-- Trofinho — Marco 5: Prêmios & Resgates
-- ============================================================

-- ─── TABELA: premios ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.premios (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id   UUID        NOT NULL REFERENCES public.familias (id) ON DELETE CASCADE,
  nome         TEXT        NOT NULL,
  descricao    TEXT,
  custo_pontos INTEGER     NOT NULL CHECK (custo_pontos > 0),
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premios_familia  ON public.premios (familia_id);
CREATE INDEX IF NOT EXISTS idx_premios_ativo    ON public.premios (ativo);

-- ─── TABELA: resgates ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resgates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filho_id         UUID        NOT NULL REFERENCES public.filhos (id) ON DELETE CASCADE,
  premio_id        UUID        NOT NULL REFERENCES public.premios (id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','confirmado','cancelado')),
  pontos_debitados INTEGER     NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resgates_filho   ON public.resgates (filho_id);
CREATE INDEX IF NOT EXISTS idx_resgates_premio  ON public.resgates (premio_id);
CREATE INDEX IF NOT EXISTS idx_resgates_status  ON public.resgates (status);
CREATE INDEX IF NOT EXISTS idx_resgates_created ON public.resgates (created_at DESC);

-- ─── RLS: premios ────────────────────────────────────────

ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;

-- Admin da família faz CRUD completo
CREATE POLICY "premios_select_admin"
  ON public.premios FOR SELECT
  USING (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

CREATE POLICY "premios_insert_admin"
  ON public.premios FOR INSERT
  WITH CHECK (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

CREATE POLICY "premios_update_admin"
  ON public.premios FOR UPDATE
  USING (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  )
  WITH CHECK (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

CREATE POLICY "premios_delete_admin"
  ON public.premios FOR DELETE
  USING (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

-- Filho lê apenas prêmios ativos da própria família
CREATE POLICY "premios_select_filho"
  ON public.premios FOR SELECT
  USING (
    public.meu_papel() = 'filho'
    AND ativo = true
    AND familia_id = (
      SELECT u.familia_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );

-- ─── RLS: resgates ───────────────────────────────────────

ALTER TABLE public.resgates ENABLE ROW LEVEL SECURITY;

-- Filho vê apenas os próprios resgates
CREATE POLICY "resgates_select_filho"
  ON public.resgates FOR SELECT
  USING (filho_id = public.meu_filho_id());

-- Admin vê todos os resgates da família
CREATE POLICY "resgates_select_admin"
  ON public.resgates FOR SELECT
  USING (
    public.usuario_e_admin()
    AND EXISTS (
      SELECT 1 FROM public.filhos f
       WHERE f.id = filho_id
         AND f.familia_id = public.minha_familia_id()
    )
  );

-- ─── TIPO DE MOVIMENTACAO: adicionar resgate ─────────────

-- Extensão do CHECK em movimentacoes para incluir 'resgate' e 'estorno_resgate'
ALTER TABLE public.movimentacoes
  DROP CONSTRAINT IF EXISTS movimentacoes_tipo_check;

ALTER TABLE public.movimentacoes
  ADD CONSTRAINT movimentacoes_tipo_check
  CHECK (tipo IN (
    'credito',
    'debito',
    'transferencia_cofrinho',
    'valorizacao',
    'penalizacao',
    'resgate',
    'estorno_resgate'
  ));

-- ─── FUNCTION: solicitar_resgate ─────────────────────────

CREATE OR REPLACE FUNCTION public.solicitar_resgate(p_premio_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filho_id       UUID;
  v_familia_id     UUID;
  v_custo          INTEGER;
  v_saldo_livre    INTEGER;
  v_nome_premio    TEXT;
  v_resgate_id     UUID;
BEGIN
  -- Valida papel
  IF public.meu_papel() <> 'filho' THEN
    RAISE EXCEPTION 'Apenas filhos podem solicitar resgates';
  END IF;

  v_filho_id   := public.meu_filho_id();
  v_familia_id := (SELECT u.familia_id FROM public.usuarios u WHERE u.id = auth.uid());

  -- Valida prêmio
  SELECT nome, custo_pontos
    INTO v_nome_premio, v_custo
    FROM public.premios
   WHERE id = p_premio_id
     AND familia_id = v_familia_id
     AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêmio não encontrado ou não disponível';
  END IF;

  -- Valida saldo
  SELECT saldo_livre
    INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = v_filho_id;

  IF v_saldo_livre IS NULL THEN
    RAISE EXCEPTION 'Saldo não encontrado';
  END IF;

  IF v_saldo_livre < v_custo THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: % pts, necessário: % pts',
      v_saldo_livre, v_custo;
  END IF;

  -- Debita saldo_livre
  UPDATE public.saldos
     SET saldo_livre = saldo_livre - v_custo,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  -- Insere resgate
  INSERT INTO public.resgates (filho_id, premio_id, status, pontos_debitados)
  VALUES (v_filho_id, p_premio_id, 'pendente', v_custo)
  RETURNING id INTO v_resgate_id;

  -- Registra movimentação
  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'resgate', v_custo,
          'Resgate: ' || v_nome_premio, v_resgate_id);

  RETURN v_resgate_id;
END;
$$;

-- ─── FUNCTION: confirmar_resgate ─────────────────────────

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

  -- Valida que o resgate é pendente e pertence à família
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
END;
$$;

-- ─── FUNCTION: cancelar_resgate ──────────────────────────

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

  -- Valida resgate pendente e pertencente à família
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

  -- Cancela resgate
  UPDATE public.resgates
     SET status     = 'cancelado',
         updated_at = now()
   WHERE id = p_resgate_id;

  -- Estorna saldo_livre
  UPDATE public.saldos
     SET saldo_livre = saldo_livre + v_pontos,
         updated_at  = now()
   WHERE filho_id = v_filho_id;

  -- Registra movimentação de estorno
  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'estorno_resgate', v_pontos,
          'Estorno: ' || v_nome, p_resgate_id);
END;
$$;
