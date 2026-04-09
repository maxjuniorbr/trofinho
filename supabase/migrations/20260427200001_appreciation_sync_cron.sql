-- Daily automatic appreciation sync via pg_cron.
-- Ensures piggy-bank interest compounding runs even if kids don't open the app.
-- The app still calls sincronizar_valorizacoes_automaticas() on startup as a
-- fast-path; this cron is the safety net for guaranteed daily execution.

-- Daily schedule: 03:00 AM (São Paulo time — UTC-3 → 06:00 UTC)
SELECT cron.schedule(
  'sincronizar-valorizacoes-automaticas',
  '0 6 * * *',
  $$SELECT public.sincronizar_valorizacoes_automaticas()$$
);
