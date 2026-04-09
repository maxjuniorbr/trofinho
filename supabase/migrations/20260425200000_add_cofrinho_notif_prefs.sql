-- Add piggy bank withdrawal notification preference keys to notif_prefs.
-- Preserves existing preferences and adds the 3 new cofrinho keys (default: true).

-- 1. Update the column default to include all 10 keys.
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
    "resgateCofrinhoCancelado": true
  }'::jsonb;

-- 2. Backfill existing rows: add missing cofrinho keys with default true.
UPDATE usuarios
SET notif_prefs = notif_prefs
  || jsonb_build_object(
       'resgateCofrinhoSolicitado', true,
       'resgateCofrinhoConfirmado', true,
       'resgateCofrinhoCancelado', true
     )
WHERE notif_prefs IS NOT NULL
  AND NOT (notif_prefs ? 'resgateCofrinhoSolicitado');
