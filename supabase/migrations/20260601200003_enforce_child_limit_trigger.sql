-- Enforce the 5-child limit at the table boundary. The app's invite flow
-- creates unlinked child rows directly in public.filhos, so the limit cannot
-- live only inside criar_filho_na_familia().

CREATE OR REPLACE FUNCTION public.enforce_family_child_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_count integer;
BEGIN
  SELECT count(*)::int INTO v_child_count
    FROM public.filhos
   WHERE familia_id = NEW.familia_id;

  IF v_child_count >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 filhos por família atingido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS filhos_limit_5_before_insert ON public.filhos;

CREATE TRIGGER filhos_limit_5_before_insert
BEFORE INSERT ON public.filhos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_family_child_limit();

REVOKE ALL ON FUNCTION public.enforce_family_child_limit() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_family_child_limit() TO service_role;
