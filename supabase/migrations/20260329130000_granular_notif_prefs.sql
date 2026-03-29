-- Expand notif_prefs with granular preference keys.
-- Previously tarefaConcluida controlled approve/reject/complete notifications,
-- and resgatesSolicitado controlled both request and confirm.
-- Now each event has its own key.
--
-- Backward-compatible: the Edge Function falls back to true for missing keys,
-- so existing rows with the old 3-key JSON continue to work.

ALTER TABLE public.usuarios
  ALTER COLUMN notif_prefs
  SET DEFAULT '{"tarefasPendentes": true, "tarefaAprovada": true, "tarefaRejeitada": true, "tarefaConcluida": true, "resgatesSolicitado": true, "resgateConfirmado": true}'::jsonb;

COMMENT ON COLUMN public.usuarios.notif_prefs IS
  'Per-user push notification preferences. Keys: tarefasPendentes, tarefaAprovada, tarefaRejeitada, tarefaConcluida, resgatesSolicitado, resgateConfirmado.';
