-- Retention policy: delete old audit_log (>12 months) and movimentacoes (>24 months).
-- Runs weekly via pg_cron.

CREATE OR REPLACE FUNCTION public.limpar_registros_antigos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_audit   bigint;
  v_movim   bigint;
BEGIN
  DELETE FROM public.audit_log
   WHERE created_at < now() - INTERVAL '12 months';
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  DELETE FROM public.movimentacoes
   WHERE created_at < now() - INTERVAL '24 months';
  GET DIAGNOSTICS v_movim = ROW_COUNT;

  RETURN jsonb_build_object(
    'audit_log_deleted', v_audit,
    'movimentacoes_deleted', v_movim
  );
END;
$$;

-- Weekly schedule: Sunday 03:00 AM (São Paulo time — UTC-3 → 06:00 UTC)
SELECT cron.schedule(
  'limpar-registros-antigos',
  '0 6 * * 0',
  $$SELECT public.limpar_registros_antigos()$$
);
