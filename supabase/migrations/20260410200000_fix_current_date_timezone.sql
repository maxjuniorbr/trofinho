-- Fix CURRENT_DATE timezone mismatch.
-- Supabase runs in UTC. When user is in America/Sao_Paulo (UTC-3),
-- CURRENT_DATE returns the next day after 21:00 local time, causing
-- daily task assignments to get the wrong competencia date.
-- Fix: pin all task/finance functions to America/Sao_Paulo timezone.

-- 1. Task functions
ALTER FUNCTION public.garantir_atribuicoes_diarias()
  SET timezone TO 'America/Sao_Paulo';

ALTER FUNCTION public.cancelar_envio_atribuicao(uuid)
  SET timezone TO 'America/Sao_Paulo';

ALTER FUNCTION public.criar_tarefa_com_atribuicoes(text, text, integer, public.tarefa_frequencia, boolean, uuid[])
  SET timezone TO 'America/Sao_Paulo';

-- 2. Finance functions (valorization uses CURRENT_DATE for interest scheduling)
ALTER FUNCTION public.configurar_valorizacao(uuid, numeric, public.periodo_valorizacao)
  SET timezone TO 'America/Sao_Paulo';

ALTER FUNCTION public.sincronizar_valorizacoes_automaticas(uuid)
  SET timezone TO 'America/Sao_Paulo';

ALTER FUNCTION public.cron_sincronizar_valorizacoes()
  SET timezone TO 'America/Sao_Paulo';

-- 3. Data repair: delete phantom pendente duplicates created by the timezone bug.
-- When the child opened the app after 21:00 Brazil, the RPC created assignments
-- for the NEXT day (UTC). The correct-date entries were created the next morning.
-- Delete the wrong-date pendente entry when a correct-date entry already exists.
DELETE FROM public.atribuicoes wrong
USING public.atribuicoes existing
WHERE wrong.competencia IS NOT NULL
  AND wrong.competencia != (wrong.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  AND existing.tarefa_id = wrong.tarefa_id
  AND existing.filho_id = wrong.filho_id
  AND existing.competencia = (wrong.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  AND existing.id != wrong.id
  AND wrong.status = 'pendente';

-- 4. For wrong-date entries that were acted upon (approved/rejected) with a
-- pendente counterpart on the correct date: delete the pendente, keep the
-- acted-upon entry and fix its date.
DELETE FROM public.atribuicoes existing
USING public.atribuicoes wrong
WHERE wrong.competencia IS NOT NULL
  AND wrong.competencia != (wrong.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  AND existing.tarefa_id = wrong.tarefa_id
  AND existing.filho_id = wrong.filho_id
  AND existing.competencia = (wrong.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  AND existing.id != wrong.id
  AND existing.status = 'pendente'
  AND wrong.status IN ('aprovada', 'rejeitada');

-- 5. Update remaining wrong-date entries that have NO conflict.
-- Skip entries where the correct date already has another assignment (both terminal).
UPDATE public.atribuicoes a
SET competencia = (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE a.competencia IS NOT NULL
  AND a.competencia != (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  AND NOT EXISTS (
    SELECT 1 FROM public.atribuicoes x
    WHERE x.tarefa_id = a.tarefa_id
      AND x.filho_id = a.filho_id
      AND x.competencia = (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date
      AND x.id != a.id
  );

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
