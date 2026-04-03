-- Add resgateCancelado to notif_prefs default to match Edge Function expectations.
-- Existing rows are unaffected: the Edge Function treats missing keys as enabled (true).

ALTER TABLE public.usuarios
  ALTER COLUMN notif_prefs
  SET DEFAULT '{"tarefasPendentes": true, "tarefaAprovada": true, "tarefaRejeitada": true, "tarefaConcluida": true, "resgatesSolicitado": true, "resgateConfirmado": true, "resgateCancelado": true}'::jsonb;

COMMENT ON COLUMN public.usuarios.notif_prefs IS
  'Per-user push notification preferences. Keys: tarefasPendentes, tarefaAprovada, tarefaRejeitada, tarefaConcluida, resgatesSolicitado, resgateConfirmado, resgateCancelado.';
