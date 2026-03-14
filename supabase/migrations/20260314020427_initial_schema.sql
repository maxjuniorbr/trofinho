-- ============================================================
-- Trofinho — Schema inicial (Marco 1)
-- ============================================================

-- ─── TABELAS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.familias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usuarios (
  id         UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  familia_id UUID NOT NULL REFERENCES public.familias (id) ON DELETE CASCADE,
  papel      TEXT NOT NULL CHECK (papel IN ('admin', 'filho')),
  nome       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.filhos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id UUID NOT NULL REFERENCES public.familias (id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ÍNDICES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_usuarios_familia ON public.usuarios (familia_id);
CREATE INDEX IF NOT EXISTS idx_filhos_familia   ON public.filhos   (familia_id);

-- ─── FUNÇÕES AUXILIARES (SECURITY DEFINER) ──────────────────
-- Usam SECURITY DEFINER para consultar usuarios sem acionar RLS,
-- evitando recursão infinita nas policies.

CREATE OR REPLACE FUNCTION public.minha_familia_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT familia_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.meu_papel()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.usuario_e_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.meu_papel() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.usuario_autenticado_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  RETURN v_user_id;
END;
$$;

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filhos   ENABLE ROW LEVEL SECURITY;

-- ─── POLICIES: familias ──────────────────────────────────────

CREATE POLICY "familias_select_own"
  ON public.familias
  FOR SELECT
  USING (id = public.minha_familia_id());

-- ─── POLICIES: usuarios ──────────────────────────────────────

-- Cada usuário lê o próprio perfil
CREATE POLICY "usuarios_select_self"
  ON public.usuarios
  FOR SELECT
  USING (id = auth.uid());

-- Admin lê todos os membros da família
CREATE POLICY "usuarios_select_familia_admin"
  ON public.usuarios
  FOR SELECT
  USING (
    familia_id = public.minha_familia_id()
    AND public.usuario_e_admin()
  );

-- Usuário atualiza o próprio perfil
CREATE POLICY "usuarios_update_self"
  ON public.usuarios
  FOR UPDATE
  USING (id = auth.uid());

-- ─── POLICIES: filhos ────────────────────────────────────────

CREATE POLICY "filhos_select_familia"
  ON public.filhos
  FOR SELECT
  USING (familia_id = public.minha_familia_id());

CREATE POLICY "filhos_insert_admin"
  ON public.filhos
  FOR INSERT
  WITH CHECK (
    familia_id = public.minha_familia_id()
    AND public.usuario_e_admin()
  );

CREATE POLICY "filhos_update_admin"
  ON public.filhos
  FOR UPDATE
  USING (
    familia_id = public.minha_familia_id()
    AND public.usuario_e_admin()
  );

CREATE POLICY "filhos_delete_admin"
  ON public.filhos
  FOR DELETE
  USING (
    familia_id = public.minha_familia_id()
    AND public.usuario_e_admin()
  );
