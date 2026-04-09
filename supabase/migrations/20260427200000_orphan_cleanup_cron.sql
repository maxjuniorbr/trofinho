-- Scheduled cleanup of orphaned auth.users entries.
-- An "orphan" is an auth.users row with no matching usuarios or filhos record,
-- meaning the registration flow was started but never completed.
-- The existing limpar_auth_user_orfao() handles the 5-minute window at registration time;
-- this cron catches anything that slipped through and is older than 30 days.
-- Runs weekly via pg_cron.

CREATE OR REPLACE FUNCTION public.limpar_usuarios_orfaos_antigos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  DELETE FROM auth.users au
   WHERE au.created_at < now() - INTERVAL '30 days'
     AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = au.id)
     AND NOT EXISTS (SELECT 1 FROM public.filhos f WHERE f.usuario_id = au.id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('orphans_deleted', v_deleted);
END;
$$;

-- Weekly schedule: Sunday 04:00 AM (São Paulo time — UTC-3 → 07:00 UTC)
SELECT cron.schedule(
  'limpar-usuarios-orfaos-antigos',
  '0 7 * * 0',
  $$SELECT public.limpar_usuarios_orfaos_antigos()$$
);
