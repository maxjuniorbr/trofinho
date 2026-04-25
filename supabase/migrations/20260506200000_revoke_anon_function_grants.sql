-- Security hardening: revoke anon access to all business RPCs and remaining tables.
--
-- Context:
--   The initial_squashed_schema (20260404) includes `GRANT ALL ON FUNCTION ... TO anon`
--   for every RPC, inherited from Supabase's default pg_dump output. Migration
--   20260412 already revoked anon from TABLES, but functions were missed.
--   Additionally, DEFAULT PRIVILEGES still auto-grant functions to anon.
--
--   The app NEVER calls RPCs as anon — all operations require an authenticated
--   session. Revoking anon reduces attack surface on SECURITY DEFINER functions.
--
-- What this migration does:
--   1. Revokes EXECUTE on ALL existing functions in schema public from anon.
--   2. Revokes ALL on table resgates_cofrinho from anon (missed by 20260412).
--   3. Fixes DEFAULT PRIVILEGES so future functions and tables don't auto-grant to anon.

-- 1. Revoke EXECUTE on all existing functions from anon (one-shot)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "public" FROM "anon";

-- 2. Revoke remaining table grants for anon (resgates_cofrinho was created after 20260412)
REVOKE ALL ON TABLE "public"."resgates_cofrinho" FROM "anon";

-- 3. Fix DEFAULT PRIVILEGES for functions (the initial schema grants ALL to anon)
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON FUNCTIONS FROM "anon";

-- Note: DEFAULT PRIVILEGES for tables was already fixed in 20260412.
-- Re-applying for safety (idempotent):
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM "anon";
