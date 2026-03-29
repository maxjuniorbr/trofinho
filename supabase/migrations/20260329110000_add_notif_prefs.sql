-- Add per-user push notification preferences to usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS notif_prefs JSONB
  NOT NULL DEFAULT '{"tarefasPendentes": true, "tarefaConcluida": true, "resgatesSolicitado": true}'::jsonb;

COMMENT ON COLUMN public.usuarios.notif_prefs IS
  'Per-user push notification preferences. Keys: tarefasPendentes, tarefaConcluida, resgatesSolicitado.';
