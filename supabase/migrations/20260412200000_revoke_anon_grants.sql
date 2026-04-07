-- A6: Revoke GRANT ALL for anon on all tables
-- RLS protects reads/writes, but anon can still call SECURITY DEFINER functions.
-- All RPCs already check auth.uid(), so anon access is unnecessary attack surface.

REVOKE ALL ON TABLE "public"."atribuicoes" FROM "anon";
REVOKE ALL ON TABLE "public"."audit_log" FROM "anon";
REVOKE ALL ON TABLE "public"."familias" FROM "anon";
REVOKE ALL ON TABLE "public"."filhos" FROM "anon";
REVOKE ALL ON TABLE "public"."movimentacoes" FROM "anon";
REVOKE ALL ON TABLE "public"."premios" FROM "anon";
REVOKE ALL ON TABLE "public"."push_tokens" FROM "anon";
REVOKE ALL ON TABLE "public"."resgates" FROM "anon";
REVOKE ALL ON TABLE "public"."saldos" FROM "anon";
REVOKE ALL ON TABLE "public"."tarefas" FROM "anon";
REVOKE ALL ON TABLE "public"."usuarios" FROM "anon";

-- Prevent future tables from inheriting anon grants
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM "anon";
