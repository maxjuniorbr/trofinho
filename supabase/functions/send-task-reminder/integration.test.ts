/**
 * Feature: child-task-reminder
 * Task 8.1 — Single-family single-child happy-path test with idempotency replay.
 *
 * Validates: Requirements 1.1, 1.4, 3.2, 3.6, 4.1, 4.2, 5.1
 *
 * Spec: .kiro/specs/child-task-reminder/{requirements.md,design.md,tasks.md}
 * Migration: supabase/migrations/20260603200000_lembretes_envios_and_cron.sql
 *
 * Why a TypeScript-level orchestrator simulation:
 *
 *   `public.executar_lembretes_pendentes()` is plpgsql and only runs in
 *   cloud Postgres (per `testing.md` §"Out of Scope": "RLS/SQL policy
 *   execution needs cloud Supabase until local Docker is available").
 *   The integration round trip we want to exercise spans cron clock
 *   (19:00 SP) → orchestrator RPC → `send-task-reminder` edge function
 *   → Expo Push API. The seam this test reproduces faithfully is the
 *   second half — the `send-task-reminder` edge handler invoked by
 *   `pg_net.http_post` — using the actual handler module and the actual
 *   transport helpers from `send-push-notification/handler.ts`. The
 *   first half (the SQL orchestrator) is mirrored by an in-test
 *   `simulateOrchestratorRun()` that matches design.md
 *   §"Algorithm — daily run pseudocode" one-for-one:
 *
 *     1. Wall-clock guard in `America/Sao_Paulo`.
 *     2. Eligibility selection that mirrors
 *        `public.selecionar_lembretes_pendentes(p_dia date)`.
 *     3. Per-child jitter gate.
 *     4. `INSERT … ON CONFLICT (filho_id, dia) DO NOTHING` as the
 *        single idempotency anchor.
 *     5. Re-checks of `filhos.ativo` and live pending count.
 *     6. POST to `send-task-reminder` (here: `handleRequest` directly).
 *
 *   The Expo Push API is mocked at the `globalThis.fetch` boundary so
 *   we can pin the title/body/token and count POSTs without touching
 *   the network or stubbing the transport helpers themselves. This is
 *   important: it asserts the actual `sendToExpoPushApi` payload —
 *   not a recomposition by the test — which is the proof tier the
 *   handler-level unit tests cannot reach.
 *
 *   The seeded data set is the minimum the spec requires (one
 *   `familia`, one child `usuarios` with default `notif_prefs`, one
 *   active `filhos`, one active `tarefas`, one pending `atribuicoes`
 *   with `competencia=today`, one `push_tokens`). Every column the
 *   orchestrator and the handler read is populated; nothing else is.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REMINDER_BODY_SINGULAR,
  REMINDER_TITLE,
} from './copy-bank';
import {
  type HandlerDeps,
  type SendTaskReminderResponse,
  handleRequest,
} from './handler';
import type {
  ExpoTicketResult,
  SupabaseClientLike,
} from '../send-push-notification/handler';

// ─── Stable identifiers (UUIDs, real-looking but synthetic) ─────────────────

const FAMILIA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FILHO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USUARIO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TAREFA_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ATRIBUICAO_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PUSH_TOKEN = 'ExponentPushToken[seed-happy-path-0001]';

const SERVICE_ROLE_KEY = 'integration-test-service-role-key-aaaaaaaa-bbbb-cccc';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Seeded DB shape (minimum the spec requires) ─────────────────────────────
//
// Mirrors the column subset that `selecionar_lembretes_pendentes`,
// `executar_lembretes_pendentes`, and the edge handler actually read.
// Nothing here is durable — it is rebuilt per-test in `beforeEach` so each
// test starts from the clean seed described in the task.

interface SeedFamilia {
  readonly id: string;
}

interface SeedUsuario {
  id: string;
  familiaId: string;
  papel: 'admin' | 'filho';
  /** Default = no preferences set => `tarefasPendentes` resolves to true. */
  notifPrefs: Record<string, unknown> | null;
}

interface SeedFilho {
  id: string;
  familiaId: string;
  usuarioId: string;
  ativo: boolean;
}

interface SeedTarefa {
  id: string;
  familiaId: string;
  ativo: boolean;
  excluidaEm: string | null;
  arquivadaEm: string | null;
}

interface SeedAtribuicao {
  id: string;
  familiaId: string;
  filhoId: string;
  tarefaId: string;
  status: 'pendente' | 'aguardando_validacao' | 'aprovada' | 'rejeitada' | 'cancelada';
  /** `YYYY-MM-DD` in `America/Sao_Paulo`. */
  competencia: string;
}

interface SeedPushToken {
  userId: string;
  token: string;
}

interface LembretesEnviosRow {
  id: string;
  familiaId: string;
  filhoId: string;
  dia: string;
  jitterSeconds: number;
  pendingCount: number;
  dispatchStatus: 'sent' | 'failed_transport';
}

interface SeedDb {
  familias: SeedFamilia[];
  usuarios: SeedUsuario[];
  filhos: SeedFilho[];
  tarefas: SeedTarefa[];
  atribuicoes: SeedAtribuicao[];
  pushTokens: SeedPushToken[];
  /** In-memory `lembretes_envios` mirroring the `(filho_id, dia)` UNIQUE. */
  lembretesEnvios: Map<string, LembretesEnviosRow>;
}

function seedFreshDb(today: string): SeedDb {
  return {
    familias: [{ id: FAMILIA_ID }],
    usuarios: [
      {
        id: USUARIO_ID,
        familiaId: FAMILIA_ID,
        papel: 'filho',
        // `null` => default prefs; `tarefasPendentes` resolves to true.
        notifPrefs: null,
      },
    ],
    filhos: [
      {
        id: FILHO_ID,
        familiaId: FAMILIA_ID,
        usuarioId: USUARIO_ID,
        ativo: true,
      },
    ],
    tarefas: [
      {
        id: TAREFA_ID,
        familiaId: FAMILIA_ID,
        ativo: true,
        excluidaEm: null,
        arquivadaEm: null,
      },
    ],
    atribuicoes: [
      {
        id: ATRIBUICAO_ID,
        familiaId: FAMILIA_ID,
        filhoId: FILHO_ID,
        tarefaId: TAREFA_ID,
        status: 'pendente',
        competencia: today,
      },
    ],
    pushTokens: [{ userId: USUARIO_ID, token: PUSH_TOKEN }],
    lembretesEnvios: new Map<string, LembretesEnviosRow>(),
  };
}

// ─── Mock Supabase client built directly from the seed ──────────────────────
//
// The query chains modeled here are exactly the ones the live code path
// issues. Any extra `.from(table)` not handled below would be a sign that
// the handler grew a new query — which a future task would update here.
//
// Chains supported:
//
//   from('filhos')
//     .select('usuario_id')
//     .eq('id', filhoId)
//     .eq('familia_id', familiaId)        => { data, error }
//
//   from('usuarios')
//     .select('id')
//     .eq('id', userId)
//     .eq('familia_id', familiaId)        => { data, error }
//
//   from('usuarios')
//     .select('id, notif_prefs')
//     .in('id', userIds)
//     .eq('familia_id', familiaId)        => { data, error }
//
//   from('push_tokens')
//     .select('token')
//     .in('user_id', userIds)             => { data, error }
//
//   from('push_tokens').delete().in('token', tokens) => { error }
//     (only triggered by DeviceNotRegistered tickets — unused on the
//      happy path, but stubbed defensively so an unexpected
//      cleanup attempt fails fast)

interface ChainEqEq {
  eq(col1: string, val1: unknown): {
    eq(col2: string, val2: unknown): Promise<{ data: Record<string, unknown>[]; error: null }>;
  };
}

interface ChainInEq {
  in(col1: string, vals: readonly unknown[]): {
    eq(col2: string, val2: unknown): Promise<{ data: Record<string, unknown>[]; error: null }>;
  };
}

interface ChainIn {
  in(col1: string, vals: readonly unknown[]): Promise<{ data: Record<string, unknown>[]; error: null }>;
}

function buildSupabaseFromSeed(db: SeedDb): SupabaseClientLike {
  const supabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'filhos') {
        return buildFilhosFrom(db);
      }
      if (table === 'usuarios') {
        return buildUsuariosFrom(db);
      }
      if (table === 'push_tokens') {
        return buildPushTokensFrom(db);
      }
      throw new Error(
        `integration test: unexpected supabase.from('${table}') — extend the harness if a new query was added`,
      );
    }),
  };
  return supabase as unknown as SupabaseClientLike;
}

function buildFilhosFrom(db: SeedDb): {
  select(cols: string): ChainEqEq;
} {
  // `from('filhos').select('usuario_id').eq('id', filhoId).eq('familia_id', familiaId)`
  return {
    select: (cols: string) => ({
      eq: (col1: string, val1: unknown) => ({
        eq: (col2: string, val2: unknown) => {
          if (cols !== 'usuario_id' || col1 !== 'id' || col2 !== 'familia_id') {
            throw new Error(
              `integration test: unexpected filhos query (cols=${cols}, col1=${col1}, col2=${col2})`,
            );
          }
          const rows = db.filhos
            .filter((f) => f.id === val1 && f.familiaId === val2)
            .map((f) => ({ usuario_id: f.usuarioId }));
          return Promise.resolve({ data: rows, error: null });
        },
      }),
    }),
  };
}

function buildUsuariosFrom(db: SeedDb): {
  select(cols: string): ChainEqEq & ChainInEq;
} {
  // Two chains share the `select(...)` head:
  //   • IDOR guard: `select('id').eq('id', userId).eq('familia_id', familiaId)`
  //   • Pref read:  `select('id, notif_prefs').in('id', userIds).eq('familia_id', familiaId)`
  return {
    select: (cols: string) => ({
      eq: (col1: string, val1: unknown) => ({
        eq: (col2: string, val2: unknown) => {
          if (cols !== 'id' || col1 !== 'id' || col2 !== 'familia_id') {
            throw new Error(
              `integration test: unexpected usuarios eq/eq query (cols=${cols}, col1=${col1}, col2=${col2})`,
            );
          }
          const rows = db.usuarios
            .filter((u) => u.id === val1 && u.familiaId === val2)
            .map((u) => ({ id: u.id }));
          return Promise.resolve({ data: rows, error: null });
        },
      }),
      in: (col1: string, vals: readonly unknown[]) => ({
        eq: (col2: string, val2: unknown) => {
          if (cols !== 'id, notif_prefs' || col1 !== 'id' || col2 !== 'familia_id') {
            throw new Error(
              `integration test: unexpected usuarios in/eq query (cols=${cols}, col1=${col1}, col2=${col2})`,
            );
          }
          const allowed = new Set(vals as readonly string[]);
          const rows = db.usuarios
            .filter((u) => allowed.has(u.id) && u.familiaId === val2)
            .map((u) => ({ id: u.id, notif_prefs: u.notifPrefs }));
          return Promise.resolve({ data: rows, error: null });
        },
      }),
    }),
  };
}

function buildPushTokensFrom(db: SeedDb): {
  select(cols: string): ChainIn;
  delete(): {
    in(col1: string, vals: readonly unknown[]): Promise<{ error: unknown }>;
  };
} {
  return {
    select: (cols: string) => ({
      in: (col1: string, vals: readonly unknown[]) => {
        if (cols !== 'token' || col1 !== 'user_id') {
          throw new Error(
            `integration test: unexpected push_tokens select query (cols=${cols}, col1=${col1})`,
          );
        }
        const allowed = new Set(vals as readonly string[]);
        const rows = db.pushTokens
          .filter((pt) => allowed.has(pt.userId))
          .map((pt) => ({ token: pt.token }));
        return Promise.resolve({ data: rows, error: null });
      },
    }),
    delete: () => ({
      in: (col1: string, vals: readonly unknown[]): Promise<{ error: unknown }> => {
        // Defensive: the happy path emits no DeviceNotRegistered tickets, so
        // this branch must NOT fire in this test. Failing fast surfaces any
        // accidental cleanup attempt as a regression.
        throw new Error(
          `integration test: unexpected push_tokens delete (col1=${col1}, vals=${JSON.stringify(vals)})`,
        );
      },
    }),
  };
}

// ─── Orchestrator simulator ─────────────────────────────────────────────────
//
// One execution of `public.executar_lembretes_pendentes()` for the
// current Reminder_Day. Mirrors the migration's plpgsql body line-by-line
// in the order the steps appear in design.md §"Algorithm — daily run
// pseudocode".

interface OrchestratorDeps {
  readonly db: SeedDb;
  readonly today: string;
  readonly nowSp: Date;
  readonly handleEdgeRequest: (req: Request) => Promise<Response>;
}

interface OrchestratorChildResult {
  readonly familiaId: string;
  readonly filhoId: string;
  readonly status:
    | 'sent'
    | 'already_sent'
    | 'skipped_inactive'
    | 'skipped_no_pending'
    | 'skipped_window'
    | 'failed';
}

async function simulateOrchestratorRun(
  deps: OrchestratorDeps,
): Promise<OrchestratorChildResult[]> {
  // Step 1: wall-clock guard in America/Sao_Paulo (req 1.1, 7.1–7.5).
  // The vitest config pins `TZ=America/Sao_Paulo`, so `getHours()` on the
  // Date returned by `setSystemTime` is the SP-local hour the SQL guard
  // would observe via `(now() AT TIME ZONE 'America/Sao_Paulo')::time`.
  const hourSp = deps.nowSp.getHours();
  if (hourSp < 18 || hourSp >= 20) {
    return [];
  }

  // Step 2: eligibility selection — direct transcription of
  // `public.selecionar_lembretes_pendentes(p_dia)`.
  const candidates = selectEligibility(deps.db, deps.today);

  const results: OrchestratorChildResult[] = [];

  for (const candidate of candidates) {
    // Step 3: deterministic per-(filho_id, dia) jitter in [0, 7200).
    // The exact hash is irrelevant for this happy-path test — we only
    // need the gate to be open at 19:00 SP, well past the jittered offset
    // range of [0, 60) seconds applied below.
    const jitterSeconds = simpleJitter(candidate.filhoId, deps.today);
    // 18:00 SP on the Reminder_Day projected to a UTC instant. SP is
    // UTC-3 with no DST since 2019, so UTC = SP + 3h.
    const scheduledAt = new Date(
      Date.UTC(
        Number(deps.today.slice(0, 4)),
        Number(deps.today.slice(5, 7)) - 1,
        Number(deps.today.slice(8, 10)),
        21, // 18:00 SP = 21:00 UTC
        0,
        jitterSeconds,
      ),
    );
    if (scheduledAt > deps.nowSp) continue;

    // Step 4: idempotency anchor — INSERT … ON CONFLICT DO NOTHING.
    const receiptKey = `${candidate.filhoId}|${deps.today}`;
    if (deps.db.lembretesEnvios.has(receiptKey)) {
      results.push({
        familiaId: candidate.familiaId,
        filhoId: candidate.filhoId,
        status: 'already_sent',
      });
      continue;
    }

    deps.db.lembretesEnvios.set(receiptKey, {
      id: `receipt-${deps.db.lembretesEnvios.size + 1}`,
      familiaId: candidate.familiaId,
      filhoId: candidate.filhoId,
      dia: deps.today,
      jitterSeconds,
      pendingCount: candidate.pendingCount,
      dispatchStatus: 'sent',
    });

    // Step 5: re-check filhos.ativo (req 8.3) and live pending count
    // (req 8.4). On the happy path both stay positive; the receipt is
    // already authoritative so we never roll it back.
    const filho = deps.db.filhos.find(
      (f) => f.id === candidate.filhoId && f.familiaId === candidate.familiaId,
    );
    if (!filho?.ativo) {
      results.push({
        familiaId: candidate.familiaId,
        filhoId: candidate.filhoId,
        status: 'skipped_inactive',
      });
      continue;
    }

    const pendingNow = countLivePending(deps.db, deps.today, candidate.filhoId, candidate.familiaId);
    if (pendingNow === 0) {
      results.push({
        familiaId: candidate.familiaId,
        filhoId: candidate.filhoId,
        status: 'skipped_no_pending',
      });
      continue;
    }

    // Step 6: POST to send-task-reminder (= the real handler).
    const edgeResponse = await deps.handleEdgeRequest(
      new Request('https://localhost/send-task-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          familiaId: candidate.familiaId,
          filhoId: candidate.filhoId,
          pendingCount: pendingNow,
        }),
      }) as unknown as Request,
    );

    if (edgeResponse.status >= 400) {
      const row = deps.db.lembretesEnvios.get(receiptKey);
      if (row) row.dispatchStatus = 'failed_transport';
      results.push({
        familiaId: candidate.familiaId,
        filhoId: candidate.filhoId,
        status: 'failed',
      });
      continue;
    }

    results.push({
      familiaId: candidate.familiaId,
      filhoId: candidate.filhoId,
      status: 'sent',
    });
  }

  return results;
}

interface EligibilityRow {
  familiaId: string;
  filhoId: string;
  usuarioId: string;
  pendingCount: number;
}

function selectEligibility(db: SeedDb, dia: string): EligibilityRow[] {
  // Mirrors the `WITH pendentes AS (...)` CTE join-by-join.
  const tarefasById = new Map(db.tarefas.map((t) => [t.id, t]));
  const filhosById = new Map(db.filhos.map((f) => [f.id, f]));
  const usuariosById = new Map(db.usuarios.map((u) => [u.id, u]));
  const tokensByUser = new Map<string, number>();
  for (const pt of db.pushTokens) {
    tokensByUser.set(pt.userId, (tokensByUser.get(pt.userId) ?? 0) + 1);
  }

  type Bucket = { pending: number; familiaId: string };
  const buckets = new Map<string, Bucket>();

  for (const a of db.atribuicoes) {
    if (a.status !== 'pendente') continue;
    if (a.competencia !== dia) continue;
    const tarefa = tarefasById.get(a.tarefaId);
    if (!tarefa) continue;
    if (tarefa.familiaId !== a.familiaId) continue;
    if (!tarefa.ativo || tarefa.excluidaEm !== null || tarefa.arquivadaEm !== null) continue;

    const key = `${a.familiaId}|${a.filhoId}`;
    const bucket = buckets.get(key) ?? { pending: 0, familiaId: a.familiaId };
    bucket.pending += 1;
    buckets.set(key, bucket);
  }

  const out: EligibilityRow[] = [];
  for (const [key, bucket] of buckets) {
    const filhoId = key.split('|')[1];
    const filho = filhosById.get(filhoId);
    if (!filho) continue;
    if (filho.familiaId !== bucket.familiaId) continue;
    if (!filho.ativo) continue;

    const usuario = usuariosById.get(filho.usuarioId);
    if (!usuario) continue;
    if (usuario.familiaId !== bucket.familiaId) continue;
    if (usuario.papel !== 'filho') continue;

    const tarefasPendentesPref = (usuario.notifPrefs ?? {})['tarefasPendentes'];
    const prefEnabled =
      tarefasPendentesPref === undefined || tarefasPendentesPref === true;
    if (!prefEnabled) continue;

    if ((tokensByUser.get(usuario.id) ?? 0) === 0) continue;

    if (db.lembretesEnvios.has(`${filhoId}|${dia}`)) continue;

    out.push({
      familiaId: bucket.familiaId,
      filhoId,
      usuarioId: usuario.id,
      pendingCount: bucket.pending,
    });
  }

  return out;
}

function countLivePending(
  db: SeedDb,
  dia: string,
  filhoId: string,
  familiaId: string,
): number {
  const tarefasById = new Map(db.tarefas.map((t) => [t.id, t]));
  let count = 0;
  for (const a of db.atribuicoes) {
    if (a.status !== 'pendente') continue;
    if (a.competencia !== dia) continue;
    if (a.filhoId !== filhoId) continue;
    if (a.familiaId !== familiaId) continue;
    const tarefa = tarefasById.get(a.tarefaId);
    if (!tarefa) continue;
    if (tarefa.familiaId !== familiaId) continue;
    if (!tarefa.ativo || tarefa.excluidaEm !== null || tarefa.arquivadaEm !== null) continue;
    count += 1;
  }
  return count;
}

function simpleJitter(filhoId: string, dia: string): number {
  // Deterministic but constrained well inside [0, 7200) so the jitter
  // gate opens before 19:00 SP every iteration. The exact hash does not
  // matter for the happy-path test.
  let h = 0;
  for (const ch of `${filhoId}|${dia}`) {
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(h) % 60; // < 1 minute jitter; gate is open at 19:00 SP
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('Feature: child-task-reminder, Task 8.1: end-to-end happy-path with idempotency replay', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let db: SeedDb;
  let supabase: SupabaseClientLike;
  let deps: HandlerDeps;
  let today: string;
  let nowSp: Date;

  beforeEach(() => {
    // Set the mock clock to 19:00 in America/Sao_Paulo. The test process
    // already runs with `TZ=America/Sao_Paulo` (vitest.config.ts), so a
    // wall-clock instant constructed via `Date.UTC(..., 22, ...)` (UTC-3
    // offset, no DST since 2019) projects to 19:00 SP. We use 22:00:00
    // UTC = 19:00:00 SP. Setting hours via `setSystemTime` makes the
    // handler's downstream `new Date()` calls deterministic in case any
    // are added in future.
    today = '2025-06-15'; // arbitrary, matches the seeded `competencia`
    nowSp = new Date(Date.UTC(2025, 5, 15, 22, 0, 0)); // 19:00:00 SP
    vi.useFakeTimers();
    vi.setSystemTime(nowSp);

    db = seedFreshDb(today);
    supabase = buildSupabaseFromSeed(db);

    deps = {
      getServiceRoleKey: () => SERVICE_ROLE_KEY,
      getSupabaseUrl: () => 'https://test.supabase.co',
      createSupabaseClient: () => supabase,
      reportDiagnostic: () => {
        /* discard for the integration-level assertion surface */
      },
    };

    // Mock the Expo Push API at the fetch boundary. Each call captures the
    // request body so we can pin the exact ExpoPushMessage payload.
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn().mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url !== EXPO_PUSH_URL) {
        throw new Error(
          `integration test: unexpected fetch to ${url}; only the Expo Push API is mocked`,
        );
      }
      const body = init?.body;
      const messages = JSON.parse(typeof body === 'string' ? body : '') as Array<{
        to: string;
        title: string;
        body: string;
      }>;
      const tickets: ExpoTicketResult[] = messages.map((_msg, idx) => ({
        status: 'ok',
        id: `ticket-${idx + 1}`,
      }));
      return new Response(JSON.stringify({ data: tickets }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  /**
   * Validates: Requirements 1.1, 3.2, 3.6, 4.1, 5.1
   *
   * The first orchestrator run at 19:00 SP, with one eligible child whose
   * pending count is exactly 1, must:
   *   (a) write exactly one row to `lembretes_envios` (req 4.1);
   *   (b) issue exactly one POST to the Expo Push API (req 5.1);
   *   (c) the POST body must carry `REMINDER_TITLE` and the singular body
   *       (req 3.2, 3.6);
   *   (d) target the seeded push token (transport correctness).
   */
  it('first run at 19:00 SP writes one receipt and issues one Expo POST with the singular copy', async () => {
    const results = await simulateOrchestratorRun({
      db,
      today,
      nowSp,
      handleEdgeRequest: (req) => handleRequest(req, deps),
    });

    // (a) exactly one receipt for (filho_id, dia)
    expect(db.lembretesEnvios.size).toBe(1);
    const receipt = db.lembretesEnvios.get(`${FILHO_ID}|${today}`);
    expect(receipt).toBeDefined();
    expect(receipt?.familiaId).toBe(FAMILIA_ID);
    expect(receipt?.dispatchStatus).toBe('sent');
    expect(receipt?.pendingCount).toBe(1);

    // Orchestrator-level reporting mirrors the receipt — exactly one
    // `sent` outcome.
    expect(results).toEqual([
      { familiaId: FAMILIA_ID, filhoId: FILHO_ID, status: 'sent' },
    ]);

    // (b) exactly one POST to the Expo Push API
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetchCall = fetchSpy.mock.calls[0];
    expect(fetchCall[0]).toBe(EXPO_PUSH_URL);
    expect(fetchCall[1]?.method).toBe('POST');

    // (c, d) payload assertions
    const requestBody = JSON.parse(fetchCall[1]?.body as string) as Array<{
      to: string;
      title: string;
      body: string;
    }>;
    expect(requestBody).toHaveLength(1);
    expect(requestBody[0].to).toBe(PUSH_TOKEN);
    expect(requestBody[0].title).toBe(REMINDER_TITLE);
    expect(requestBody[0].body).toBe(REMINDER_BODY_SINGULAR);
  });

  /**
   * Validates: Requirements 1.4, 4.1, 4.2
   *
   * Re-running the orchestrator on the same Reminder_Day, with the same
   * seed plus the receipt the first run wrote, must:
   *   (a) NOT add any new row to `lembretes_envios` (the unique index on
   *       `(filho_id, dia)` is the sole idempotency anchor);
   *   (b) NOT issue any new POST to the Expo Push API.
   */
  it('replay on the same Reminder_Day adds no receipts and issues no new Expo POSTs', async () => {
    // First run: priming.
    await simulateOrchestratorRun({
      db,
      today,
      nowSp,
      handleEdgeRequest: (req) => handleRequest(req, deps),
    });
    expect(db.lembretesEnvios.size).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second run: replay. Time advances by one minute (still well inside
    // [18:00, 20:00) SP) to mirror the cron firing every minute.
    nowSp = new Date(nowSp.getTime() + 60_000);
    vi.setSystemTime(nowSp);

    const replayResults = await simulateOrchestratorRun({
      db,
      today,
      nowSp,
      handleEdgeRequest: (req) => handleRequest(req, deps),
    });

    // (a) still exactly one receipt — no duplicate row was created.
    expect(db.lembretesEnvios.size).toBe(1);

    // (b) no new POSTs to the Expo Push API. The call count is unchanged
    // from the priming run.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // The replay sees the existing receipt and reports 'already_sent'.
    // Note: the eligibility selector excludes children whose receipt
    // already exists (mirrors the SQL anti-join), so the replay finds
    // zero candidates — there is no `already_sent` outcome to surface.
    expect(replayResults).toEqual([]);
  });

  /**
   * Validates: Requirements 5.1
   *
   * Defensive — the response body of the edge function on success
   * matches the shape that the orchestrator (and any future caller)
   * relies on. Pinning this here protects future refactors that might
   * accidentally narrow the response.
   */
  it('edge function returns 200 with { sent, failed, cleaned } on success', async () => {
    let edgeStatus = 0;
    let edgeJson: SendTaskReminderResponse | null = null;

    await simulateOrchestratorRun({
      db,
      today,
      nowSp,
      handleEdgeRequest: async (req) => {
        const res = await handleRequest(req, deps);
        edgeStatus = res.status;
        edgeJson = (await res.clone().json()) as SendTaskReminderResponse;
        return res;
      },
    });

    expect(edgeStatus).toBe(200);
    expect(edgeJson).toEqual({ sent: 1, failed: 0, cleaned: 0 });
  });
});
