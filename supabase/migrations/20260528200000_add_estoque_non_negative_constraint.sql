-- Hardening: ensure premios.estoque can never go negative.
--
-- The solicitar_resgate RPC already serializes concurrent redemptions via
-- FOR UPDATE on the premios row, so negative stock is not reachable through
-- the app. This constraint is a safety net against direct SQL operations,
-- manual maintenance, future scripts, or new code paths that might bypass
-- the RPC.
--
-- Pre-check: abort if any row already has estoque < 0 so we don't silently
-- constrain data that needs manual review first.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.premios WHERE estoque < 0) THEN
    RAISE EXCEPTION
      'Cannot add estoque >= 0 constraint: one or more premios rows have negative estoque. '
      'Fix the affected rows manually before re-running this migration.';
  END IF;
END;
$$;

ALTER TABLE public.premios
  ADD CONSTRAINT premios_estoque_non_negative CHECK (estoque >= 0);
