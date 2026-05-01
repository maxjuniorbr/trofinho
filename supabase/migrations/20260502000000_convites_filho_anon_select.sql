-- Historical migration kept idempotent for fresh database resets.
--
-- This policy was superseded by 20260502100000_validar_convite_rpc.sql because
-- opening SELECT on the table exposed all invite rows through the REST API.
-- Some migration histories may have already created convites_filho at this
-- point, while fresh resets create it later. In both cases this migration
-- should not leave the open anon policy behind.
DO $$
BEGIN
  IF to_regclass('public.convites_filho') IS NOT NULL THEN
    DROP POLICY IF EXISTS "validar_convite_filho" ON public.convites_filho;
  END IF;
END $$;
