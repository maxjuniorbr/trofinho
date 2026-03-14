-- ============================================================
-- Trofinho — Marco 3: Tarefas
-- ============================================================

-- ─── ATUALIZAR filhos: vincular com usuario da auth ───────

ALTER TABLE public.filhos
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_filhos_usuario ON public.filhos (usuario_id);

-- ─── FUNÇÃO AUXILIAR: meu_filho_id() ─────────────────────
-- Retorna o filhos.id correspondente ao usuário autenticado.
-- SECURITY DEFINER para evitar recursão em RLS.

CREATE OR REPLACE FUNCTION public.meu_filho_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.filhos WHERE usuario_id = auth.uid() LIMIT 1;
$$;

-- ─── TABELA: tarefas ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tarefas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id      UUID        NOT NULL REFERENCES public.familias  (id) ON DELETE CASCADE,
  titulo          TEXT        NOT NULL,
  descricao       TEXT,
  pontos          INTEGER     NOT NULL CHECK (pontos > 0),
  timebox_inicio  DATE        NOT NULL,
  timebox_fim     DATE        NOT NULL,
  exige_evidencia BOOLEAN     NOT NULL DEFAULT false,
  criado_por      UUID        NOT NULL REFERENCES public.usuarios  (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_familia ON public.tarefas (familia_id);

-- ─── TABELA: atribuicoes ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.atribuicoes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id     UUID        NOT NULL REFERENCES public.tarefas (id) ON DELETE CASCADE,
  filho_id      UUID        NOT NULL REFERENCES public.filhos  (id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','aguardando_validacao','aprovada','rejeitada')),
  evidencia_url TEXT,
  nota_rejeicao TEXT,
  concluida_em  TIMESTAMPTZ,
  validada_em   TIMESTAMPTZ,
  validada_por  UUID        REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, filho_id)
);

CREATE INDEX IF NOT EXISTS idx_atribuicoes_tarefa ON public.atribuicoes (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_filho  ON public.atribuicoes (filho_id);

-- ─── TABELA: saldos ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saldos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filho_id    UUID        NOT NULL REFERENCES public.filhos (id) ON DELETE CASCADE,
  saldo_livre INTEGER     NOT NULL DEFAULT 0,
  cofrinho    INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (filho_id)
);

CREATE INDEX IF NOT EXISTS idx_saldos_filho ON public.saldos (filho_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE public.tarefas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldos      ENABLE ROW LEVEL SECURITY;

-- ─── POLICIES: tarefas ────────────────────────────────────

CREATE POLICY "tarefas_select_familia"
  ON public.tarefas FOR SELECT
  USING (familia_id = public.minha_familia_id());

CREATE POLICY "tarefas_insert_admin"
  ON public.tarefas FOR INSERT
  WITH CHECK (
    familia_id = public.minha_familia_id()
    AND public.meu_papel() = 'admin'
  );

CREATE POLICY "tarefas_update_admin"
  ON public.tarefas FOR UPDATE
  USING (
    familia_id = public.minha_familia_id()
    AND public.meu_papel() = 'admin'
  );

-- ─── POLICIES: atribuicoes ────────────────────────────────

-- Admin vê todas as atribuições das tarefas da família
CREATE POLICY "atribuicoes_select_admin"
  ON public.atribuicoes FOR SELECT
  USING (
    public.meu_papel() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_id
        AND t.familia_id = public.minha_familia_id()
    )
  );

-- Filho vê apenas as próprias atribuições
CREATE POLICY "atribuicoes_select_filho"
  ON public.atribuicoes FOR SELECT
  USING (filho_id = public.meu_filho_id());

-- Admin cria atribuições para tarefas da família
CREATE POLICY "atribuicoes_insert_admin"
  ON public.atribuicoes FOR INSERT
  WITH CHECK (
    public.meu_papel() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_id
        AND t.familia_id = public.minha_familia_id()
    )
  );

-- Filho conclui tarefa: pendente → aguardando_validacao
CREATE POLICY "atribuicoes_update_filho"
  ON public.atribuicoes FOR UPDATE
  USING (
    filho_id = public.meu_filho_id()
    AND status = 'pendente'
  )
  WITH CHECK (
    filho_id = public.meu_filho_id()
    AND status = 'aguardando_validacao'
  );

-- Admin rejeita atribuições da família (aprovação via SECURITY DEFINER function)
CREATE POLICY "atribuicoes_update_admin"
  ON public.atribuicoes FOR UPDATE
  USING (
    public.meu_papel() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_id
        AND t.familia_id = public.minha_familia_id()
    )
  );

-- ─── POLICIES: saldos ─────────────────────────────────────

CREATE POLICY "saldos_select_filho"
  ON public.saldos FOR SELECT
  USING (filho_id = public.meu_filho_id());

CREATE POLICY "saldos_select_admin"
  ON public.saldos FOR SELECT
  USING (
    public.meu_papel() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.filhos f
      WHERE f.id = filho_id
        AND f.familia_id = public.minha_familia_id()
    )
  );

-- ─── FUNÇÃO: aprovar_atribuicao ───────────────────────────
-- SECURITY DEFINER para creditar saldo atomicamente sem depender de RLS.

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
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF public.meu_papel() != 'admin' THEN
    RAISE EXCEPTION 'Apenas admins podem aprovar tarefas';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT a.filho_id, t.pontos, t.familia_id
    INTO v_filho_id, v_pontos, v_tarefa_familia
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
     SET status      = 'aprovada',
         validada_em = now(),
         validada_por = v_caller_id
   WHERE id = atribuicao_id;

  INSERT INTO public.saldos (filho_id, saldo_livre)
  VALUES (v_filho_id, v_pontos)
  ON CONFLICT (filho_id) DO UPDATE
    SET saldo_livre = saldos.saldo_livre + EXCLUDED.saldo_livre,
        updated_at  = now();
END;
$$;

-- ─── STORAGE: bucket evidencias ───────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "evidencias_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'evidencias');

CREATE POLICY "evidencias_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'evidencias');
