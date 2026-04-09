-- Add familia_id to atribuicoes for efficient Realtime filtering.
-- Prevents cross-family data leaks (S2) and simplifies admin RLS policies.
-- Pattern identical to 20260420200000_add_familia_id_to_resgates.sql.

-- 1. Add nullable column first (allows backfill before enforcing NOT NULL).
ALTER TABLE public.atribuicoes
  ADD COLUMN IF NOT EXISTS familia_id UUID REFERENCES public.familias(id);

-- 2. Back-fill from the linked filhos row.
UPDATE public.atribuicoes a
SET familia_id = f.familia_id
FROM public.filhos f
WHERE a.filho_id = f.id
  AND a.familia_id IS NULL;

-- 3. Enforce NOT NULL after backfill.
ALTER TABLE public.atribuicoes
  ALTER COLUMN familia_id SET NOT NULL;

-- 4. Index for Realtime filter lookups.
CREATE INDEX IF NOT EXISTS idx_atribuicoes_familia_id ON public.atribuicoes (familia_id);

-- 5. Keep familia_id in sync on future inserts/updates.
CREATE OR REPLACE FUNCTION public.sync_atribuicao_familia_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT f.familia_id INTO NEW.familia_id
  FROM public.filhos f
  WHERE f.id = NEW.filho_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_atribuicao_familia_id ON public.atribuicoes;
CREATE TRIGGER trg_sync_atribuicao_familia_id
  BEFORE INSERT OR UPDATE OF filho_id ON public.atribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.sync_atribuicao_familia_id();

-- 6. Simplify admin RLS: direct familia_id check instead of JOIN to tarefas.
DROP POLICY IF EXISTS "atribuicoes_insert_admin" ON public.atribuicoes;
CREATE POLICY "atribuicoes_insert_admin" ON public.atribuicoes
  FOR INSERT WITH CHECK (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

DROP POLICY IF EXISTS "atribuicoes_select_admin" ON public.atribuicoes;
CREATE POLICY "atribuicoes_select_admin" ON public.atribuicoes
  FOR SELECT USING (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

DROP POLICY IF EXISTS "atribuicoes_update_admin" ON public.atribuicoes;
CREATE POLICY "atribuicoes_update_admin" ON public.atribuicoes
  FOR UPDATE
  USING (
    public.usuario_e_admin()
    AND status = 'aguardando_validacao'::public.atribuicao_status
    AND familia_id = public.minha_familia_id()
  )
  WITH CHECK (
    public.usuario_e_admin()
    AND status = 'rejeitada'::public.atribuicao_status
    AND familia_id = public.minha_familia_id()
  );

-- 7. Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
