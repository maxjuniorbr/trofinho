-- ============================================================
-- Trofinho — Marco 4: Pontos & Cofrinho
-- ============================================================

-- ─── TABELA: movimentacoes ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.movimentacoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filho_id     UUID        NOT NULL REFERENCES public.filhos (id) ON DELETE CASCADE,
  tipo         TEXT        NOT NULL
               CHECK (tipo IN ('credito','debito','transferencia_cofrinho','valorizacao','penalizacao')),
  valor        INTEGER     NOT NULL CHECK (valor > 0),
  descricao    TEXT        NOT NULL,
  referencia_id UUID,     -- atribuicao_id quando tipo = 'credito'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_filho     ON public.movimentacoes (filho_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo      ON public.movimentacoes (tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_created   ON public.movimentacoes (created_at DESC);

-- ─── COLUNAS EXTRAS EM saldos ─────────────────────────────

DO $$
BEGIN
  CREATE TYPE public.periodo_valorizacao AS ENUM (
    'diario',
    'semanal',
    'mensal'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.saldos
  ADD COLUMN IF NOT EXISTS indice_valorizacao   NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodo_valorizacao  public.periodo_valorizacao NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS data_ultima_valorizacao DATE;

CREATE OR REPLACE FUNCTION public.validar_filho_da_familia(
  p_filho_id UUID,
  p_familia_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.filhos f
    WHERE f.id = p_filho_id AND f.familia_id = p_familia_id
  ) THEN
    RAISE EXCEPTION 'Filho não pertence a esta família';
  END IF;
END;
$$;

-- ─── RLS: movimentacoes ───────────────────────────────────

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimentacoes_select_filho"
  ON public.movimentacoes FOR SELECT
  USING (filho_id = public.meu_filho_id());

CREATE POLICY "movimentacoes_select_admin"
  ON public.movimentacoes FOR SELECT
  USING (
    public.usuario_e_admin()
    AND EXISTS (
      SELECT 1 FROM public.filhos f
       WHERE f.id = filho_id
         AND f.familia_id = public.minha_familia_id()
    )
  );

-- ─── ATUALIZAR aprovar_atribuicao (registra movimentação) ─

CREATE OR REPLACE FUNCTION public.aprovar_atribuicao(atribuicao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id      UUID;
  v_familia_id     UUID;
  v_filho_id       UUID;
  v_pontos         INTEGER;
  v_tarefa_familia UUID;
  v_titulo         TEXT;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aprovar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT a.filho_id, t.pontos, t.familia_id, t.titulo
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
     SET status       = 'aprovada',
         validada_em  = now(),
         validada_por = v_caller_id
   WHERE id = atribuicao_id;

  INSERT INTO public.saldos (filho_id, saldo_livre)
  VALUES (v_filho_id, v_pontos)
  ON CONFLICT (filho_id) DO UPDATE
    SET saldo_livre = saldos.saldo_livre + EXCLUDED.saldo_livre,
        updated_at  = now();

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao, referencia_id)
  VALUES (v_filho_id, 'credito', v_pontos, 'Tarefa aprovada: ' || v_titulo, atribuicao_id);
END;
$$;

-- ─── FUNÇÃO: transferir_para_cofrinho ─────────────────────

CREATE OR REPLACE FUNCTION public.transferir_para_cofrinho(p_filho_id UUID, p_valor INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_livre INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  -- Apenas o próprio filho pode transferir
  IF public.meu_filho_id() != p_filho_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  SELECT saldo_livre INTO v_saldo_livre
    FROM public.saldos
   WHERE filho_id = p_filho_id;

  IF v_saldo_livre IS NULL OR v_saldo_livre < p_valor THEN
    RAISE EXCEPTION 'Saldo livre insuficiente';
  END IF;

  UPDATE public.saldos
     SET saldo_livre = saldo_livre - p_valor,
         cofrinho    = cofrinho    + p_valor,
         updated_at  = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'transferencia_cofrinho', p_valor, 'Transferência para o cofrinho');
END;
$$;

-- ─── FUNÇÃO: aplicar_valorizacao ──────────────────────────

CREATE OR REPLACE FUNCTION public.aplicar_valorizacao(p_filho_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_familia_id     UUID;
  v_cofrinho       INTEGER;
  v_indice         NUMERIC(5,2);
  v_ganho          INTEGER;
BEGIN
  PERFORM public.usuario_autenticado_id();

  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem aplicar valorização';
  END IF;

  v_familia_id := public.minha_familia_id();

  PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);

  SELECT cofrinho, indice_valorizacao
    INTO v_cofrinho, v_indice
    FROM public.saldos
   WHERE filho_id = p_filho_id;

  IF NOT FOUND OR v_indice = 0 THEN
    RAISE EXCEPTION 'Sem índice de valorização configurado';
  END IF;

  v_ganho := FLOOR(v_cofrinho * v_indice / 100)::INTEGER;

  IF v_ganho <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.saldos
     SET cofrinho               = cofrinho + v_ganho,
         data_ultima_valorizacao = CURRENT_DATE,
         updated_at             = now()
   WHERE filho_id = p_filho_id;

  INSERT INTO public.movimentacoes (filho_id, tipo, valor, descricao)
  VALUES (p_filho_id, 'valorizacao', v_ganho,
          'Valorização do cofrinho (' || v_indice || '%)');

  RETURN v_ganho;
END;
$$;

-- ─── FUNÇÃO: aplicar_penalizacao ──────────────────────────

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

-- ─── FUNÇÃO: configurar_valorizacao (admin) ───────────────

CREATE OR REPLACE FUNCTION public.configurar_valorizacao(
  p_filho_id UUID,
  p_indice   NUMERIC,
  p_periodo  public.periodo_valorizacao
)
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
    RAISE EXCEPTION 'Apenas admins podem configurar valorização';
  END IF;

  v_familia_id := public.minha_familia_id();

  PERFORM public.validar_filho_da_familia(p_filho_id, v_familia_id);

  IF p_indice < 0 OR p_indice > 100 THEN
    RAISE EXCEPTION 'Índice deve estar entre 0 e 100';
  END IF;

  INSERT INTO public.saldos (filho_id, indice_valorizacao, periodo_valorizacao)
  VALUES (p_filho_id, p_indice, p_periodo)
  ON CONFLICT (filho_id) DO UPDATE
    SET indice_valorizacao  = EXCLUDED.indice_valorizacao,
        periodo_valorizacao = EXCLUDED.periodo_valorizacao,
        updated_at          = now();
END;
$$;
