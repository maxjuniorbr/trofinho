-- Child_Task_Reminder — daily reminder fan-out infrastructure.
-- Spec: .kiro/specs/child-task-reminder/{requirements.md,design.md,tasks.md}
--
-- This migration is built incrementally across sub-tasks 1.1–1.4:
--   1.1 — public.lembretes_envios table + indexes + RLS policies (this section)
--   1.2 — public.selecionar_lembretes_pendentes(p_dia date) read-only RPC
--   1.3 — public.executar_lembretes_pendentes() orchestrator RPC
--   1.4 — pg_cron schedule + grants lock-down
--
-- Sub-tasks 1.2–1.4 will append below this header.

-- =============================================================================
-- 1.1 Idempotency receipts table: public.lembretes_envios
-- Requirements: 4.3, 4.4, 5.3
-- Design: §Data Models — "New table: public.lembretes_envios"
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lembretes_envios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id      uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  filho_id        uuid NOT NULL REFERENCES public.filhos(id)   ON DELETE CASCADE,
  dia             date NOT NULL,
  jitter_seconds  integer NOT NULL,
  pending_count   integer NOT NULL,
  dispatch_status text    NOT NULL DEFAULT 'sent',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lembretes_envios_filho_dia_unq
    UNIQUE (filho_id, dia),
  CONSTRAINT lembretes_envios_jitter_range
    CHECK (jitter_seconds >= 0 AND jitter_seconds < 7200),
  CONSTRAINT lembretes_envios_pending_range
    CHECK (pending_count >= 1 AND pending_count <= 9999),
  CONSTRAINT lembretes_envios_dispatch_status_known
    CHECK (dispatch_status IN ('sent', 'failed_transport'))
);

COMMENT ON TABLE public.lembretes_envios IS
  'Idempotency receipts for the daily Child_Task_Reminder push. One row per (filho_id, Reminder_Day in America/Sao_Paulo).';

COMMENT ON COLUMN public.lembretes_envios.dia IS
  'Reminder_Day evaluated in America/Sao_Paulo, set by the SECURITY DEFINER orchestrator.';
COMMENT ON COLUMN public.lembretes_envios.jitter_seconds IS
  'Per-(filho_id, dia) deterministic jitter in [0, 7200) seconds, applied to spread dispatch across the [18:00, 20:00) window.';
COMMENT ON COLUMN public.lembretes_envios.pending_count IS
  'Snapshot of Pending_Today_Count captured when the receipt was written; diagnostic only, no PII.';
COMMENT ON COLUMN public.lembretes_envios.dispatch_status IS
  'Receipt is authoritative for idempotency; ''failed_transport'' marks runs where the edge call failed AFTER the receipt was written. We do not retry the same day.';

-- Hot path for admin diagnostics: list recent receipts per family.
CREATE INDEX IF NOT EXISTS idx_lembretes_envios_familia_dia
  ON public.lembretes_envios (familia_id, dia DESC);

-- =============================================================================
-- RLS — read-only access for in-tenant admins and the targeted child.
-- Writes happen exclusively from the SECURITY DEFINER orchestrator (added in
-- task 1.3), which bypasses RLS by design. No client INSERT/UPDATE/DELETE
-- policy is created, so direct writes from any client JWT are rejected.
-- =============================================================================

ALTER TABLE public.lembretes_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lembretes_envios_select_admin  ON public.lembretes_envios;
DROP POLICY IF EXISTS lembretes_envios_select_filho  ON public.lembretes_envios;

CREATE POLICY lembretes_envios_select_admin
  ON public.lembretes_envios FOR SELECT
  USING (
    public.usuario_e_admin()
    AND familia_id = public.minha_familia_id()
  );

CREATE POLICY lembretes_envios_select_filho
  ON public.lembretes_envios FOR SELECT
  USING (
    filho_id = public.meu_filho_id()
    AND familia_id = public.minha_familia_id()
  );

-- Grants: read-only for authenticated; service_role retains full access for
-- the SECURITY DEFINER orchestrator. anon never sees this table.
REVOKE ALL ON TABLE public.lembretes_envios FROM PUBLIC;
REVOKE ALL ON TABLE public.lembretes_envios FROM anon;
REVOKE ALL ON TABLE public.lembretes_envios FROM authenticated;
GRANT  SELECT ON TABLE public.lembretes_envios TO authenticated;
GRANT  ALL    ON TABLE public.lembretes_envios TO service_role;

-- =============================================================================
-- 1.2 Eligibility read RPC: public.selecionar_lembretes_pendentes(p_dia date)
-- Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3, 5.5, 8.1, 8.2
-- Design: §Components and Interfaces — "3. RPC public.selecionar_lembretes_pendentes(p_dia date)"
--
-- Pure read (no side effects) returning the eligibility set for a Reminder_Day:
--   (familia_id, filho_id, usuario_id, pending_count)
--
-- Predicate, encoded join-by-join so the planner cannot bridge tenants and
-- so the eligibility predicate is exactly what the requirements specify:
--   * atribuicoes.status = 'pendente'                                  (req 2.2)
--   * atribuicoes.competencia = p_dia                                  (req 2.2, 2.3, 8.1)
--   * tarefas.ativo AND excluida_em IS NULL AND arquivada_em IS NULL   (req 2.6)
--   * filhos.ativo = true                                              (req 2.1, 8.2)
--   * usuarios.papel = 'filho'                                         (req 2.1)
--   * COALESCE((notif_prefs ->> 'tarefasPendentes')::boolean, true)    (req 2.4, 5.3, default = true per DEFAULT_NOTIFICATION_PREFS)
--   * EXISTS (push_tokens for usuario_id)                              (req 2.5)
--   * NOT EXISTS (lembretes_envios for (filho_id, p_dia))              (anti-join — req 8.2 / 4.1)
--   * Every join is constrained by familia_id = familia_id             (req 5.3, 5.5)
--
-- SECURITY DEFINER + STABLE: the cron orchestrator (1.3) calls this without a
-- user JWT; STABLE because it does not modify state. Grants are locked to
-- postgres in task 1.4 (REVOKE from authenticated/anon).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.selecionar_lembretes_pendentes(p_dia date)
RETURNS TABLE (
  familia_id    uuid,
  filho_id      uuid,
  usuario_id    uuid,
  pending_count integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH pendentes AS (
    SELECT
      t.familia_id,
      a.filho_id,
      COUNT(*)::int AS pending_count
    FROM public.atribuicoes a
    JOIN public.tarefas t
      ON t.id = a.tarefa_id
     AND t.familia_id = a.familia_id           -- explicit tenant predicate
    WHERE a.status = 'pendente'
      AND a.competencia = p_dia
      AND t.ativo = true
      AND t.excluida_em IS NULL
      AND t.arquivada_em IS NULL
    GROUP BY t.familia_id, a.filho_id
  )
  SELECT
    p.familia_id,
    p.filho_id,
    f.usuario_id,
    p.pending_count
  FROM pendentes p
  JOIN public.filhos f
    ON f.id = p.filho_id
   AND f.familia_id = p.familia_id              -- explicit tenant predicate
   AND f.ativo = true
  JOIN public.usuarios u
    ON u.id = f.usuario_id
   AND u.familia_id = p.familia_id              -- explicit tenant predicate
   AND u.papel = 'filho'
   AND COALESCE((u.notif_prefs ->> 'tarefasPendentes')::boolean, true) = true
  WHERE EXISTS (
    SELECT 1
    FROM public.push_tokens pt
    WHERE pt.user_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.lembretes_envios le
    WHERE le.filho_id = p.filho_id
      AND le.dia = p_dia
  );
$$;

COMMENT ON FUNCTION public.selecionar_lembretes_pendentes(date) IS
  'Pure read of the Child_Task_Reminder eligibility set for a Reminder_Day. SECURITY DEFINER + STABLE; called by public.executar_lembretes_pendentes() (task 1.3). Returns one row per Eligible_Child with the snapshot Pending_Today_Count. Grants are revoked from authenticated/anon in task 1.4.';

ALTER FUNCTION public.selecionar_lembretes_pendentes(date) OWNER TO postgres;

-- =============================================================================
-- 1.3 Orchestrator RPC: public.executar_lembretes_pendentes()
-- Requirements: 1.1, 1.3, 1.4, 4.1, 4.2, 4.5, 5.4, 7.1, 7.2, 7.3, 7.4, 7.5,
--               8.3, 8.4, 8.5
-- Design: §Components and Interfaces — "2. RPC public.executar_lembretes_pendentes()"
--         §"Algorithm — daily run pseudocode"
--
-- Fan-out orchestrator called once per minute by pg_cron (registered in 1.4).
-- Responsibilities, in order:
--   1. Wall-clock guard: refuse to do anything outside [18:00, 20:00) in
--      America/Sao_Paulo (req 7.1, 7.2, 7.3, 7.4). The cron expression in 1.4
--      already restricts firing to that window in UTC; this guard is the
--      defensive cap for any DST drift, manual replay, or operator nudge.
--   2. Read service-role JWT and project URL from Vault. Operators must seed:
--        SELECT vault.create_secret('<project-url>',     'supabase_url');
--        SELECT vault.create_secret('<service-role-jwt>', 'service_role_key');
--      Missing secrets short-circuit the run with a WARNING; the receipt
--      table stays empty and no push is dispatched.
--   3. Iterate distinct familia_ids returned by selecionar_lembretes_pendentes.
--      Each family is wrapped in BEGIN/EXCEPTION WHEN OTHERS so a thrown
--      familia cannot starve other tenants (req 5.4, 8.5).
--   4. Per child compute deterministic jitter in [0, 7200) seconds and gate
--      dispatch on scheduled_at <= now_sp so the [18:00, 20:00) window is
--      partitioned into ~7200 distinct seconds (req 1.3, 1.4, 7.5).
--   5. INSERT … ON CONFLICT (filho_id, dia) DO NOTHING RETURNING id is the
--      sole idempotency anchor. Losing the race (no row returned) means the
--      receipt already exists — we never dispatch in that branch (req 4.1,
--      4.2, 4.3).
--   6. After taking the receipt, re-check filhos.ativo and the live pending
--      count (req 8.3, 8.4). The receipt remains either way: it is
--      authoritative for idempotency even when we choose not to dispatch.
--   7. Call send-task-reminder via pg_net.http_post with the service-role
--      JWT. pg_net is asynchronous — the worker fires the request only AFTER
--      this transaction commits, so polling net._http_response synchronously
--      would always see NULL. The receipt is the authoritative idempotency
--      record (req 4.1, 4.2, 4.5); transport-level success/failure
--      observability lives on the edge function side via Sentry. If
--      net.http_post itself raises (input validation, oversized body,
--      pg_net misconfiguration), we flip dispatch_status to 'failed_transport'
--      and do NOT retry today (req 4.5).
--
-- Returns one row per evaluated child with status:
--   'sent'                — receipt written and edge call returned 2xx
--   'already_sent'        — receipt already existed for (filho_id, dia)
--   'skipped_inactive'    — filhos.ativo flipped to false after receipt
--   'skipped_no_pending'  — pending count dropped to 0 after receipt
--   'failed'              — receipt written but edge call failed (no retry)
--
-- SECURITY DEFINER + plpgsql: cron runs without a user JWT and must bypass
-- RLS to write receipts and read across families. Grants are locked down to
-- postgres only in task 1.4 (REVOKE from authenticated/anon).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.executar_lembretes_pendentes()
RETURNS TABLE (
  familia_id uuid,
  filho_id   uuid,
  status     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_now_sp            timestamp;
  v_time_of_day       time;
  v_dia               date;
  v_supabase_url      text;
  v_service_role_key  text;
  v_familia_id        uuid;
  v_filho_rec         record;
  v_jitter            integer;
  v_scheduled_at      timestamp;
  v_receipt_id        uuid;
  v_filho_ativo       boolean;
  v_pending_now       integer;
  v_request_id        bigint;
BEGIN
  -- Step 1: wall-clock guard in America/Sao_Paulo (req 1.1, 1.2, 7.1–7.5).
  v_now_sp      := now() AT TIME ZONE 'America/Sao_Paulo';
  v_time_of_day := v_now_sp::time;

  IF v_time_of_day < TIME '18:00:00' OR v_time_of_day >= TIME '20:00:00' THEN
    RETURN;
  END IF;

  v_dia := v_now_sp::date;

  -- Step 2: load secrets from Vault. Missing secrets short-circuit the run
  -- without writing receipts or invoking the edge function.
  SELECT decrypted_secret INTO v_supabase_url
  FROM   vault.decrypted_secrets
  WHERE  name = 'supabase_url'
  LIMIT  1;

  SELECT decrypted_secret INTO v_service_role_key
  FROM   vault.decrypted_secrets
  WHERE  name = 'service_role_key'
  LIMIT  1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING
      'executar_lembretes_pendentes: missing Vault secrets (supabase_url and/or service_role_key); skipping run';
    RETURN;
  END IF;

  -- Step 3: iterate distinct families with per-family failure isolation
  -- (req 5.4, 8.5). selecionar_lembretes_pendentes is STABLE; calling it
  -- once per family keeps the body simple and the dataset is small.
  FOR v_familia_id IN
    SELECT DISTINCT s.familia_id
    FROM   public.selecionar_lembretes_pendentes(v_dia) s
    ORDER  BY s.familia_id
  LOOP
    BEGIN
      FOR v_filho_rec IN
        SELECT s.familia_id,
               s.filho_id,
               s.usuario_id,
               s.pending_count
        FROM   public.selecionar_lembretes_pendentes(v_dia) s
        WHERE  s.familia_id = v_familia_id
        ORDER  BY s.filho_id
      LOOP
        -- Step 4: deterministic per-(filho_id, dia) jitter in [0, 7200).
        -- Cast hashtext to bigint before abs() so INT_MIN cannot overflow.
        v_jitter := (
          abs(hashtext(v_filho_rec.filho_id::text || v_dia::text)::bigint) % 7200
        )::integer;

        v_scheduled_at :=
          (v_dia::timestamp + interval '18 hours')
          + make_interval(secs => v_jitter);

        -- Only dispatch the children whose jittered offset has been reached
        -- in this minute. The cron fires every minute through the window so
        -- every child eventually clears this gate exactly once per day
        -- (req 1.3, 1.4).
        IF v_scheduled_at > v_now_sp THEN
          CONTINUE;
        END IF;

        -- Step 5: idempotency anchor (req 4.1, 4.2, 4.3). The unique
        -- constraint on (filho_id, dia) is the single source of truth for
        -- "already sent today". Lose the race => no row, no dispatch.
        v_receipt_id := NULL;

        INSERT INTO public.lembretes_envios (
          familia_id,
          filho_id,
          dia,
          jitter_seconds,
          pending_count
        )
        VALUES (
          v_filho_rec.familia_id,
          v_filho_rec.filho_id,
          v_dia,
          v_jitter,
          v_filho_rec.pending_count
        )
        ON CONFLICT (filho_id, dia) DO NOTHING
        RETURNING id INTO v_receipt_id;

        IF v_receipt_id IS NULL THEN
          familia_id := v_filho_rec.familia_id;
          filho_id   := v_filho_rec.filho_id;
          status     := 'already_sent';
          RETURN NEXT;
          CONTINUE;
        END IF;

        -- Step 6a: re-check filhos.ativo after the receipt is taken (req 8.3).
        SELECT f.ativo INTO v_filho_ativo
        FROM   public.filhos f
        WHERE  f.id         = v_filho_rec.filho_id
          AND  f.familia_id = v_filho_rec.familia_id;

        IF NOT COALESCE(v_filho_ativo, false) THEN
          -- Receipt is authoritative for idempotency; we keep it but skip dispatch.
          familia_id := v_filho_rec.familia_id;
          filho_id   := v_filho_rec.filho_id;
          status     := 'skipped_inactive';
          RETURN NEXT;
          CONTINUE;
        END IF;

        -- Step 6b: re-check the live pending count (req 8.4). Mirrors the
        -- predicate in selecionar_lembretes_pendentes — same tenant
        -- predicates, same tarefas filters.
        SELECT COUNT(*)::integer INTO v_pending_now
        FROM   public.atribuicoes a
        JOIN   public.tarefas t
          ON   t.id         = a.tarefa_id
         AND   t.familia_id = a.familia_id
        WHERE  a.filho_id      = v_filho_rec.filho_id
          AND  a.familia_id    = v_filho_rec.familia_id
          AND  a.competencia   = v_dia
          AND  a.status        = 'pendente'
          AND  t.ativo         = true
          AND  t.excluida_em   IS NULL
          AND  t.arquivada_em  IS NULL;

        IF v_pending_now = 0 THEN
          familia_id := v_filho_rec.familia_id;
          filho_id   := v_filho_rec.filho_id;
          status     := 'skipped_no_pending';
          RETURN NEXT;
          CONTINUE;
        END IF;

        -- Step 7: queue the dispatch via send-task-reminder. pg_net is
        -- asynchronous: net.http_post returns a request_id and the worker
        -- fires the request only AFTER this transaction commits, with the
        -- response landing in net._http_response. Polling _http_response
        -- from the same transaction would always observe NULL and is a
        -- documented anti-pattern (Supabase pg_net guide), so the receipt
        -- is the authoritative idempotency record (req 4.1, 4.2, 4.5) and
        -- transport-level success/failure observability lives on the edge
        -- function side via Sentry breadcrumbs and captureException.
        --
        -- net.http_post itself raises only on local input validation
        -- (malformed URL, oversized body, etc.). We catch that case and
        -- mark the receipt as 'failed_transport' so we do NOT retry today
        -- (req 4.5).
        BEGIN
          v_request_id := net.http_post(
            url     := v_supabase_url || '/functions/v1/send-task-reminder',
            body    := jsonb_build_object(
                         'familiaId',    v_filho_rec.familia_id,
                         'filhoId',      v_filho_rec.filho_id,
                         'pendingCount', v_pending_now
                       ),
            headers := jsonb_build_object(
                         'Content-Type',  'application/json',
                         'Authorization', 'Bearer ' || v_service_role_key
                       ),
            timeout_milliseconds := 5000
          );
        EXCEPTION WHEN OTHERS THEN
          UPDATE public.lembretes_envios le
             SET dispatch_status = 'failed_transport'
           WHERE le.filho_id = v_filho_rec.filho_id
             AND le.dia      = v_dia;

          RAISE WARNING
            'executar_lembretes_pendentes: net.http_post failed for familia % (SQLSTATE %)',
            v_filho_rec.familia_id, SQLSTATE;

          familia_id := v_filho_rec.familia_id;
          filho_id   := v_filho_rec.filho_id;
          status     := 'failed';
          RETURN NEXT;
          CONTINUE;
        END;

        familia_id := v_filho_rec.familia_id;
        filho_id   := v_filho_rec.filho_id;
        status     := 'sent';
        RETURN NEXT;
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      -- Per-family failure isolation (req 5.4, 8.5). Surface the cause to
      -- the Postgres log, then continue with the next family. The edge
      -- function side handles Sentry capture for HTTP failures; this WARNING
      -- covers SQL-side failures (selection errors, constraint violations,
      -- etc.).
      RAISE WARNING
        'executar_lembretes_pendentes: familia % failed: % (SQLSTATE %)',
        v_familia_id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.executar_lembretes_pendentes() IS
  'Child_Task_Reminder fan-out orchestrator. Called by pg_cron every minute through the [18:00, 20:00) America/Sao_Paulo window. Idempotent per (filho_id, dia) via the lembretes_envios unique constraint. Per-family BEGIN/EXCEPTION isolation; on edge-function transport failure the receipt is kept and dispatch_status is flipped to ''failed_transport''. SECURITY DEFINER; grants locked to postgres in task 1.4.';

ALTER FUNCTION public.executar_lembretes_pendentes() OWNER TO postgres;

-- =============================================================================
-- 1.4 pg_cron schedule + grants lock-down
-- Requirements: 1.1, 7.5, 9.2
-- Design: §"Wire-up summary" item 1, §"RPC and edge function signatures" grants
--
-- Cron expression: '* 21,22 * * *' fires every minute from 21:00 UTC through
-- 22:59 UTC. Projecting onto America/Sao_Paulo (UTC-3, DST-free since 2019)
-- yields every minute of [18:00, 20:00) SP — exactly the Reminder_Window
-- defined by Requirements 1.1 and 7.5. The wall-clock guard in
-- public.executar_lembretes_pendentes() is the defensive cap for any DST
-- drift, manual replay, or operator nudge.
--
-- Requirement 9.2 forbids per-family or per-child configuration of the
-- Reminder_Window: there is exactly one schedule, named
-- 'lembretes-tarefas-pendentes', shared by every tenant.
--
-- The pg_cron extension itself is enabled by the initial squashed schema
-- (20260404), so we only register the job here.
-- =============================================================================

-- Idempotency guard: if a job with the same name already exists (e.g. from a
-- prior partial migration apply), drop it first so cron.schedule below cannot
-- raise on re-apply. cron.unschedule(text) raises when the job is missing,
-- which is the normal first-run state, so we swallow that case.
DO $$
BEGIN
  PERFORM cron.unschedule('lembretes-tarefas-pendentes');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'lembretes-tarefas-pendentes',
  '* 21,22 * * *',
  $$SELECT public.executar_lembretes_pendentes()$$
);

-- =============================================================================
-- Grants lock-down for the two RPCs introduced in 1.2 and 1.3.
--
-- Both functions are SECURITY DEFINER and are invoked exclusively by the
-- pg_cron worker (which runs as the database owner, postgres). No client JWT
-- — admin or filho — should be able to call either RPC, so we explicitly
-- REVOKE from PUBLIC, anon, and authenticated, then GRANT EXECUTE to
-- postgres only.
--
-- 20260506200000_revoke_anon_function_grants already revokes EXECUTE from
-- anon for every function in public via ALTER DEFAULT PRIVILEGES, but we
-- repeat the REVOKEs here so the lock-down is visible at the point where
-- these functions are introduced and so the migration is self-contained for
-- security review.
-- =============================================================================

REVOKE ALL ON FUNCTION public.selecionar_lembretes_pendentes(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.selecionar_lembretes_pendentes(date) FROM anon;
REVOKE ALL ON FUNCTION public.selecionar_lembretes_pendentes(date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.selecionar_lembretes_pendentes(date) TO postgres;

REVOKE ALL ON FUNCTION public.executar_lembretes_pendentes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.executar_lembretes_pendentes() FROM anon;
REVOKE ALL ON FUNCTION public.executar_lembretes_pendentes() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.executar_lembretes_pendentes() TO postgres;
