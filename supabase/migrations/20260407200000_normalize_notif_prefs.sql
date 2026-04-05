-- Q9.2: Normalize legacy notification preference keys
-- Overwrites all notif_prefs with the canonical 7-key JSON.
-- Legacy English keys (pendingTasks, completedTask, requestedRedemption)
-- and Portuguese snake_case keys (tarefas_pendentes, tarefa_concluida, resgate_solicitado)
-- are migrated to the current camelCase schema.

UPDATE usuarios
SET notif_prefs = jsonb_build_object(
  'tarefasPendentes',    COALESCE(
    (notif_prefs->>'tarefasPendentes')::boolean,
    (notif_prefs->>'pendingTasks')::boolean,
    (notif_prefs->>'tarefas_pendentes')::boolean,
    true
  ),
  'tarefaAprovada',      COALESCE(
    (notif_prefs->>'tarefaAprovada')::boolean,
    true
  ),
  'tarefaRejeitada',     COALESCE(
    (notif_prefs->>'tarefaRejeitada')::boolean,
    true
  ),
  'tarefaConcluida',     COALESCE(
    (notif_prefs->>'tarefaConcluida')::boolean,
    (notif_prefs->>'completedTask')::boolean,
    (notif_prefs->>'tarefa_concluida')::boolean,
    true
  ),
  'resgatesSolicitado',  COALESCE(
    (notif_prefs->>'resgatesSolicitado')::boolean,
    (notif_prefs->>'requestedRedemption')::boolean,
    (notif_prefs->>'resgate_solicitado')::boolean,
    true
  ),
  'resgateConfirmado',   COALESCE(
    (notif_prefs->>'resgateConfirmado')::boolean,
    true
  ),
  'resgateCancelado',    COALESCE(
    (notif_prefs->>'resgateCancelado')::boolean,
    true
  )
);
