-- Harden co-admin invite grants. Only preview validation is intentionally
-- callable before authentication; all state-changing/admin listing RPCs require
-- an authenticated user and perform role checks internally.

REVOKE ALL ON TABLE public.convites_admin FROM anon;
REVOKE ALL ON TABLE public.tentativas_convite FROM anon;

GRANT SELECT ON TABLE public.convites_admin TO authenticated;
GRANT ALL ON TABLE public.convites_admin TO service_role;
GRANT ALL ON TABLE public.tentativas_convite TO service_role;

REVOKE EXECUTE ON FUNCTION public.gerar_convite_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.aceitar_convite_admin(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_convite_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remover_co_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_admins_familia() FROM anon;

GRANT EXECUTE ON FUNCTION public.gerar_convite_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_convite_admin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_convite_admin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_convite_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_co_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_admins_familia() TO authenticated;
