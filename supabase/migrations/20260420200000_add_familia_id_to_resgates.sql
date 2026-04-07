-- Add familia_id to resgates for efficient Realtime filtering.
-- Avoids unfiltered cross-family Realtime subscriptions on the admin side.

ALTER TABLE public.resgates
  ADD COLUMN IF NOT EXISTS familia_id UUID REFERENCES public.familias(id);

-- Back-fill from the linked filhos row
UPDATE public.resgates r
SET familia_id = f.familia_id
FROM public.filhos f
WHERE r.filho_id = f.id
  AND r.familia_id IS NULL;

ALTER TABLE public.resgates
  ALTER COLUMN familia_id SET NOT NULL;

-- Index for Realtime filter lookups
CREATE INDEX IF NOT EXISTS idx_resgates_familia_id ON public.resgates (familia_id);

-- Keep familia_id in sync on future inserts/updates
CREATE OR REPLACE FUNCTION public.sync_resgate_familia_id()
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

DROP TRIGGER IF EXISTS trg_sync_resgate_familia_id ON public.resgates;
CREATE TRIGGER trg_sync_resgate_familia_id
  BEFORE INSERT OR UPDATE OF filho_id ON public.resgates
  FOR EACH ROW EXECUTE FUNCTION public.sync_resgate_familia_id();
