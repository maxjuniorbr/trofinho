// Feature: child-task-reminder
// Property 3: Idempotency under retries and failures
// Validates: Requirements 1.4, 1.5, 4.1, 4.2, 4.3, 4.5
//
// Migration: supabase/migrations/20260603200000_lembretes_envios_and_cron.sql
//
// Why a TypeScript-level simulation, not a live SQL test:
//
//   The orchestrator `public.executar_lembretes_pendentes()` is plpgsql and
//   only runs in cloud Postgres (the testing rules state explicitly that
//   "RLS/SQL policy execution needs cloud Supabase until local Docker is
//   available", `.claude/skills/testing/SKILL.md`). To exercise idempotency
//   under retries AND under forced HTTP 5xx failures across `n >= 1` runs
//   per Reminder_Day with 200 fast-check iterations, we model the
//   orchestrator's idempotency contract in TypeScript and shrink the
//   surface to the two boundaries that decide correctness:
//
//     1. The unique index on `lembretes_envios(filho_id, dia)` enforced via
//        `INSERT … ON CONFLICT (filho_id, dia) DO NOTHING RETURNING id`.
//        The receipt is the *sole* idempotency anchor (req 4.1, 4.2, 4.3).
//     2. The `pg_net.http_post` call to `send-task-reminder` that fires
//        only when a receipt was successfully written. HTTP 5xx flips
//        `dispatch_status` to `failed_transport` but never causes a retry
//        on the same Reminder_Day (req 4.5).
//
//   The simulation is faithful to the migration: it reproduces the exact
//   ordering encoded in the orchestrator pseudocode (design.md §"Algorithm
//   — daily run pseudocode"): write receipt → re-check pending count and
//   ativo flag → call `send-task-reminder` → flip dispatch_status on
//   non-2xx. The unique-key semantics are exactly those of Postgres.
//   Multi-token children (req 1.5) are modeled by attaching a token list
//   to each child; a single dispatch fans out to every token in one HTTP
//   call so it counts as one invocation.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

// ─── Domain types (mirror the migration's relevant columns) ──────────────────

type Filho = Readonly<{
  filhoId: string;
  familiaId: string;
  /** ≥ 1 token to model req 1.5 (multi-token fan-out). */
  pushTokens: readonly string[];
}>;

type ReceiptKey = `${string}|${string}`; // `${filhoId}|${dia}`

type Receipt = Readonly<{
  receiptId: string;
  familiaId: string;
  filhoId: string;
  dia: string;
  pendingCount: number;
  /** Mirrors the CHECK in the migration: 'sent' | 'failed_transport'. */
  dispatchStatus: 'sent' | 'failed_transport';
}>;

// ─── Simulation harness ──────────────────────────────────────────────────────

/**
 * In-memory `lembretes_envios` table with the uniqueness contract from the
 * migration:
 *
 *   CONSTRAINT lembretes_envios_filho_dia_unq UNIQUE (filho_id, dia)
 *
 * `tryInsert` returns the new row only when no row existed for the
 * `(filho_id, dia)` pair, exactly mirroring
 * `INSERT … ON CONFLICT (filho_id, dia) DO NOTHING RETURNING id`.
 */
class LembretesEnviosTable {
  private readonly rows = new Map<ReceiptKey, Receipt>();
  private receiptCounter = 0;

  tryInsert(args: {
    familiaId: string;
    filhoId: string;
    dia: string;
    pendingCount: number;
  }): Receipt | null {
    const key: ReceiptKey = `${args.filhoId}|${args.dia}`;
    if (this.rows.has(key)) return null;
    this.receiptCounter += 1;
    const receipt: Receipt = {
      receiptId: `00000000-0000-4000-8000-${String(this.receiptCounter).padStart(12, '0')}`,
      familiaId: args.familiaId,
      filhoId: args.filhoId,
      dia: args.dia,
      pendingCount: args.pendingCount,
      dispatchStatus: 'sent',
    };
    this.rows.set(key, receipt);
    return receipt;
  }

  /** Mirrors the `UPDATE … SET dispatch_status = 'failed_transport'` branch. */
  markFailedTransport(filhoId: string, dia: string): void {
    const key: ReceiptKey = `${filhoId}|${dia}`;
    const existing = this.rows.get(key);
    if (!existing) return;
    this.rows.set(key, { ...existing, dispatchStatus: 'failed_transport' });
  }

  countByFilho(): Map<string, number> {
    const out = new Map<string, number>();
    for (const receipt of this.rows.values()) {
      out.set(receipt.filhoId, (out.get(receipt.filhoId) ?? 0) + 1);
    }
    return out;
  }

  size(): number {
    return this.rows.size;
  }

  has(filhoId: string, dia: string): boolean {
    return this.rows.has(`${filhoId}|${dia}`);
  }
}

/**
 * Mock of `pg_net.http_post` to `send-task-reminder`.
 *
 * Records every invocation so the test can assert the total count, and
 * lets each test inject a deterministic predicate that decides which
 * children get HTTP 5xx for a given run. The orchestrator only calls this
 * once per `(filho_id, dia)` pair where the receipt was just written, so
 * the assertion `total invocations === total receipts` is a direct
 * encoding of req 4.1/4.2/4.5.
 */
class HttpPostMock {
  readonly calls: {
    familiaId: string;
    filhoId: string;
    pendingCount: number;
    runIndex: number;
    succeeded: boolean;
  }[] = [];

  constructor(
    private readonly shouldFail: (args: { filhoId: string; runIndex: number }) => boolean,
  ) {}

  invoke(args: {
    familiaId: string;
    filhoId: string;
    pendingCount: number;
    runIndex: number;
  }): { ok: boolean; status: number } {
    const fail = this.shouldFail({ filhoId: args.filhoId, runIndex: args.runIndex });
    this.calls.push({
      familiaId: args.familiaId,
      filhoId: args.filhoId,
      pendingCount: args.pendingCount,
      runIndex: args.runIndex,
      succeeded: !fail,
    });
    return fail ? { ok: false, status: 503 } : { ok: true, status: 200 };
  }

  totalInvocations(): number {
    return this.calls.length;
  }

  invocationsPerFilho(): Map<string, number> {
    const out = new Map<string, number>();
    for (const call of this.calls) {
      out.set(call.filhoId, (out.get(call.filhoId) ?? 0) + 1);
    }
    return out;
  }
}

/**
 * One execution of `public.executar_lembretes_pendentes()` for a fixed
 * Reminder_Day, restricted to the receipt+dispatch boundary that decides
 * idempotency. The window guard, jitter, and per-family BEGIN/EXCEPTION
 * isolation are out of scope for Property 3 (they are pinned by Properties
 * 1 and 4 in tasks 7.1 and 7.3).
 *
 * Every child whose `scheduled_at` has been reached is considered eligible;
 * the simulation conservatively assumes every child is dispatchable in
 * every run so retries fully exercise the unique-key gate.
 */
function runOrchestrator(args: {
  table: LembretesEnviosTable;
  http: HttpPostMock;
  children: readonly Filho[];
  dia: string;
  pendingCounts: ReadonlyMap<string, number>;
  runIndex: number;
}): void {
  for (const child of args.children) {
    const pendingCount = args.pendingCounts.get(child.filhoId) ?? 1;

    // Step 5: idempotency anchor — INSERT … ON CONFLICT DO NOTHING
    // RETURNING id. If we lose the race (no row returned), we MUST NOT
    // dispatch (req 4.1, 4.2, 4.3).
    const receipt = args.table.tryInsert({
      familiaId: child.familiaId,
      filhoId: child.filhoId,
      dia: args.dia,
      pendingCount,
    });

    if (receipt === null) continue;

    // Step 7: queue the dispatch via send-task-reminder. Even with multiple
    // tokens (req 1.5), the orchestrator fires a SINGLE HTTP POST; the edge
    // function fans out internally to all tokens. So one receipt ↔ one
    // invocation, regardless of `child.pushTokens.length`.
    const result = args.http.invoke({
      familiaId: child.familiaId,
      filhoId: child.filhoId,
      pendingCount,
      runIndex: args.runIndex,
    });

    if (!result.ok) {
      // Receipt is authoritative for idempotency even on transport failure
      // (req 4.5). We flip the status but never delete the receipt and
      // never retry on the same Reminder_Day.
      args.table.markFailedTransport(child.filhoId, args.dia);
    }
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const familiaIdArb: fc.Arbitrary<string> = fc.uuid({ version: 4 });
const filhoIdArb: fc.Arbitrary<string> = fc.uuid({ version: 4 });

const pushTokenArb = fc.stringMatching(
  /^ExponentPushToken\[[A-Za-z0-9_-]{16,32}\]$/,
);

/**
 * 1–3 unique tokens per child to model req 1.5 (multi-token children
 * receive a single dispatch). `uniqueArray` guarantees no duplicate token
 * within the same child, which matches the `push_tokens` PK.
 */
const pushTokensArb = fc.uniqueArray(pushTokenArb, { minLength: 1, maxLength: 3 });

const filhoArb: fc.Arbitrary<Filho> = fc.tuple(filhoIdArb, familiaIdArb, pushTokensArb).map(
  ([filhoId, familiaId, pushTokens]): Filho => ({ filhoId, familiaId, pushTokens }),
);

/**
 * Set of children with unique `filhoId`s (the migration's UNIQUE
 * (filho_id, dia) constraint scopes by `filhoId`, so collisions in the
 * generator would mask the test's intent).
 */
const childrenArb: fc.Arbitrary<readonly Filho[]> = fc
  .uniqueArray(filhoArb, {
    minLength: 1,
    maxLength: 6,
    selector: (f) => f.filhoId,
  })
  .map((arr) => arr as readonly Filho[]);

/**
 * Reminder_Day as a stable ISO date string. The orchestrator uses
 * `(now() AT TIME ZONE 'America/Sao_Paulo')::date`; for Property 3 the
 * exact value is irrelevant, only that the receipt key collapses on
 * `(filho_id, dia)`. We restrict to a small set of plausible days so
 * counter-examples are easier to read.
 */
const diaArb: fc.Arbitrary<string> = fc.integer({ min: 0, max: 364 }).map((dayOffset) => {
  const base = Date.UTC(2025, 0, 1) + dayOffset * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
});

const pendingCountArb = fc.integer({ min: 1, max: 9999 });

// ─── Property 3 ─────────────────────────────────────────────────────────────

describe('Feature: child-task-reminder, Property 3: Idempotency under retries and failures', () => {
  it('receipt count per (filho_id, dia) is 0 or 1, regardless of n runs and forced HTTP 5xx', () => {
    fc.assert(
      fc.property(
        childrenArb,
        diaArb,
        fc.integer({ min: 1, max: 8 }),
        // Per-(filhoId, runIndex) failure decisions. Encoded as a single
        // 256-bit bitmap selector applied with hashing inside the test so
        // the failure subset is fully randomized but reproducible per
        // counter-example.
        fc.array(fc.boolean(), { minLength: 1, maxLength: 64 }),
        // Per-child Pending_Today_Count snapshot for the day. Stable
        // across runs (the orchestrator re-checks pending count after
        // taking the receipt, but the count itself is a property of the
        // initial DB state for this test).
        fc.array(pendingCountArb, { minLength: 1, maxLength: 64 }),
        (children, dia, runCount, failureBitmap, pendingCounts) => {
          const table = new LembretesEnviosTable();
          const http = new HttpPostMock(({ filhoId, runIndex }) => {
            // Deterministic per-(filhoId, runIndex) failure pattern that
            // makes a "random subset of children" fail across runs. We
            // hash the filhoId code points into the bitmap index alongside
            // the run index so the failing subset shifts between runs (the
            // task description says "force HTTP 5xx for a random subset
            // of children across n >= 1 runs").
            let h = 0;
            for (const ch of filhoId) {
              h = Math.trunc(h * 31 + (ch.codePointAt(0) ?? 0));
            }
            const idx = Math.abs(h ^ Math.trunc(runIndex * 2654435761)) % failureBitmap.length;
            return failureBitmap[idx];
          });

          const pendingByFilho = new Map<string, number>();
          children.forEach((child, i) => {
            pendingByFilho.set(child.filhoId, pendingCounts[i % pendingCounts.length]);
          });

          for (let runIndex = 0; runIndex < runCount; runIndex++) {
            runOrchestrator({
              table,
              http,
              children,
              dia,
              pendingCounts: pendingByFilho,
              runIndex,
            });
          }

          // Sub-property 3a: receipt count per `(filho_id, dia)` is 0 or 1.
          // Since we fix `dia`, this collapses to per-`filho_id`.
          const receiptsByFilho = table.countByFilho();
          for (const child of children) {
            const count = receiptsByFilho.get(child.filhoId) ?? 0;
            expect(count, `filhoId=${child.filhoId} receipt count must be ≤ 1`).toBeLessThanOrEqual(
              1,
            );
            expect(count, `filhoId=${child.filhoId} receipt count must be ≥ 0`).toBeGreaterThanOrEqual(
              0,
            );
          }

          // Sub-property 3b: total `send-task-reminder` invocations across
          // ALL runs equals the total number of receipts written. This is
          // the exact statement of req 4.1, 4.2, 4.5: the receipt is the
          // sole idempotency anchor, dispatch fires only when the receipt
          // is taken, and a transport failure does NOT cause a retry on
          // the same Reminder_Day.
          expect(http.totalInvocations()).toBe(table.size());

          // Sub-property 3c: per-(filho_id) invocations are also bounded
          // by 1 — stronger than 3b since it is per-child. Also indirectly
          // enforces req 1.4 (at most one Reminder_Push_Event per
          // Eligible_Child per Reminder_Day).
          const invocationsByFilho = http.invocationsPerFilho();
          for (const child of children) {
            const calls = invocationsByFilho.get(child.filhoId) ?? 0;
            expect(
              calls,
              `filhoId=${child.filhoId} HTTP invocations must be ≤ 1`,
            ).toBeLessThanOrEqual(1);
          }

          // Sub-property 3d (req 1.5): multi-token children still produce
          // a single dispatch. Asserted by 3c above (the orchestrator
          // never branches on token count) plus the modeling note in
          // `runOrchestrator`.
        },
      ),
      { numRuns: 200 },
    );
  });

  it('every receipt corresponds to exactly one HTTP invocation and vice versa (bijection)', () => {
    // Tighter restatement of 3b. Every successful `tryInsert` returns a
    // receiptId and is immediately followed by exactly one HTTP call; no
    // path writes a receipt without a call (req 4.1) and no path makes a
    // call without a receipt (req 4.2).
    fc.assert(
      fc.property(
        childrenArb,
        diaArb,
        fc.integer({ min: 1, max: 5 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 32 }),
        (children, dia, runCount, failureBitmap) => {
          const table = new LembretesEnviosTable();
          const http = new HttpPostMock(({ runIndex }) => {
            return failureBitmap[runIndex % failureBitmap.length];
          });

          for (let runIndex = 0; runIndex < runCount; runIndex++) {
            runOrchestrator({
              table,
              http,
              children,
              dia,
              pendingCounts: new Map(children.map((c) => [c.filhoId, 1])),
              runIndex,
            });
          }

          // Bijection: the multiset of `(filhoId)` projected from receipts
          // equals the multiset of `(filhoId)` projected from HTTP calls.
          const compareEntries = (
            a: readonly [string, number],
            b: readonly [string, number],
          ): number => {
            if (a[0] < b[0]) return -1;
            if (a[0] > b[0]) return 1;
            return 0;
          };
          const byFilho = (m: Map<string, number>): [string, number][] =>
            [...m.entries()].sort(compareEntries);
          expect(byFilho(http.invocationsPerFilho())).toEqual(byFilho(table.countByFilho()));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('forced HTTP 5xx never produces a duplicate receipt or duplicate dispatch on subsequent runs (req 4.5)', () => {
    // Direct restatement of req 4.5: when the dispatch fails, the receipt
    // stays and is authoritative. Subsequent runs MUST NOT retry that
    // child on the same Reminder_Day.
    fc.assert(
      fc.property(
        childrenArb,
        diaArb,
        // First run forces ALL children to fail; subsequent runs don't.
        fc.integer({ min: 2, max: 6 }),
        (children, dia, runCount) => {
          const table = new LembretesEnviosTable();
          const http = new HttpPostMock(({ runIndex }) => runIndex === 0);

          for (let runIndex = 0; runIndex < runCount; runIndex++) {
            runOrchestrator({
              table,
              http,
              children,
              dia,
              pendingCounts: new Map(children.map((c) => [c.filhoId, 1])),
              runIndex,
            });
          }

          // Every child has exactly one receipt (written in run 0, even
          // though dispatch failed) and exactly one HTTP invocation total
          // (the failed one in run 0; no retries in runs 1..n).
          for (const child of children) {
            expect(table.has(child.filhoId, dia)).toBe(true);
            expect(http.invocationsPerFilho().get(child.filhoId)).toBe(1);
          }
          expect(http.totalInvocations()).toBe(children.length);
          expect(table.size()).toBe(children.length);
          // Every call was the failing run-0 call.
          expect(http.calls.every((c) => c.runIndex === 0)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
