-- Finalize notification preference keys: ensure all 11 keys are present in the
-- column default, the column comment, and existing rows.
-- Adds the only missing key (penalidadeAplicada) with default true; preserves
-- all other existing values.

-- 1. Update the column default to include the full 11-key set.
ALTER TABLE usuarios
  ALTER COLUMN notif_prefs
  SET DEFAULT '{
    "tarefasPendentes": true,
    "tarefaAprovada": true,
    "tarefaRejeitada": true,
    "tarefaConcluida": true,
    "resgatesSolicitado": true,
    "resgateConfirmado": true,
    "resgateCancelado": true,
    "resgateCofrinhoSolicitado": true,
    "resgateCofrinhoConfirmado": true,
    "resgateCofrinhoCancelado": true,
    "penalidadeAplicada": true
  }'::jsonb;

-- 2. Refresh the column comment with the canonical key list.
COMMENT ON COLUMN public.usuarios.notif_prefs IS
  'Per-user push notification preferences. Keys: tarefasPendentes, tarefaAprovada, tarefaRejeitada, tarefaConcluida, resgatesSolicitado, resgateConfirmado, resgateCancelado, resgateCofrinhoSolicitado, resgateCofrinhoConfirmado, resgateCofrinhoCancelado, penalidadeAplicada.';

-- 3. Backfill existing rows: add missing penalidadeAplicada key with default true.
UPDATE usuarios
SET notif_prefs = notif_prefs
  || jsonb_build_object('penalidadeAplicada', true)
WHERE notif_prefs IS NOT NULL
  AND NOT (notif_prefs ? 'penalidadeAplicada');
