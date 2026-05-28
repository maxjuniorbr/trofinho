/**
 * Feature: child-task-reminder, Property 4: Per-family failure isolation
 *
 * **Validates: Requirements 5.4, 8.5**
 *
 * Pure-TypeScript simulation of the orchestrator's per-family loop in
 * `public.executar_lembretes_pendentes()` (see
 * `supabase/migrations/20260603200000_lembretes_envios_and_cron.sql`,
 * §"Algorithm — daily run pseudocode" of `design.md`).
 *
 * The simulator mirrors the SQL `BEGIN ... EXCEPTION WHEN OTHERS THEN
 * captureException(extras={familiaId}) ... END;` block one-for-one: each
 * `familia_id` is processed inside an isolated `try`/`catch`. A throw
 * raised by either the eligibility selection or by the dispatch is
 * funnelled into the per-family `catch`, which calls
 * `Sentry.captureException` exactly once with tags
 * `subsystem=push, event=tarefa_lembrete` and extras limited to
 * `{ familiaId }` — the contract pinned by Requirements 5.4 and 8.5.
 *
 * Property 4 (from `design.md`):
 *
 *   *For any* random partition of the familia_id set into Healthy and
 *   Throwing, where every selection or dispatch step for a Throwing
 *   family is forced to raise an exception, every Eligible_Child in a
 *   Healthy family still receives exactly one receipt and one
 *   send-task-reminder invocation; and Sentry.captureException is called
 *   once per Throwing family with extras { familiaId } and tags
 *   subsystem=push, event=tarefa_lembrete.
 *
 * Why a TypeScript simulation rather than a live SQL test: RLS/SQL
 * execution requires cloud Supabase (per `testing.md` "Out of Scope"), so
 * the contract is exercised here against a fast, deterministic mirror of
 * the orchestrator's per-family wrapper. The simulator is intentionally
 * narrow — only the per-family `BEGIN/EXCEPTION` boundary is modelled —
 * because that is the precise behaviour Requirements 5.4 and 8.5
 * constrain.
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

type EligibleChild = Readonly<{
  familiaId: string;
  filhoId: string;
  pendingCount: number;
}>;

type FailureMode = 'healthy' | 'selection-throw' | 'dispatch-throw';

type CaptureContext = Readonly<{
  tags: Record<string, string>;
  extra: Record<string, unknown>;
}>;

type DispatchRequest = Readonly<{
  familiaId: string;
  filhoId: string;
  pendingCount: number;
}>;

interface OrchestratorDeps {
  readonly selectFamilyEligibility: (familiaId: string) => readonly EligibleChild[];
  readonly insertReceipt: (child: EligibleChild) => boolean;
  readonly dispatch: (req: DispatchRequest) => Promise<void>;
  readonly captureException: (err: unknown, ctx: CaptureContext) => void;
}

// ─── Simulator ───────────────────────────────────────────────────────────────

/**
 * Mirrors the per-family `BEGIN/EXCEPTION` wrapper from
 * `executar_lembretes_pendentes()`. Iterates families in a stable order
 * (matching the SQL `ORDER BY s.familia_id`) so any failure-isolation
 * regression is reproducible from a fast-check counterexample.
 *
 * The inner per-child block intentionally does NOT model pg_net's
 * per-child transport-failure local catch (req 4.5): forcing dispatch to
 * throw escalates the error into the per-family handler, which is
 * exactly the contract Requirements 5.4 and 8.5 specify ("an error,
 * exception, or skip condition affecting one familia_id does not
 * prevent dispatch for Eligible_Child rows belonging to another
 * familia_id").
 */
async function runOrchestrator(
  familias: readonly string[],
  deps: OrchestratorDeps,
): Promise<void> {
  const ordered = [...familias].sort((a, b) => a.localeCompare(b));
  for (const familiaId of ordered) {
    try {
      const children = deps.selectFamilyEligibility(familiaId);
      for (const child of children) {
        const isNew = deps.insertReceipt(child);
        if (!isNew) continue;
        await deps.dispatch({
          familiaId: child.familiaId,
          filhoId: child.filhoId,
          pendingCount: child.pendingCount,
        });
      }
    } catch (err) {
      deps.captureException(err, {
        tags: { subsystem: 'push', event: 'tarefa_lembrete' },
        extra: { familiaId },
      });
    }
  }
}

// ─── Property Test ───────────────────────────────────────────────────────────

type FamilyConfig = Readonly<{
  failureMode: FailureMode;
  childPendingCounts: readonly number[];
}>;

type Family = Readonly<{
  familiaId: string;
  failureMode: FailureMode;
  children: readonly EligibleChild[];
}>;

type Harness = Readonly<{
  deps: OrchestratorDeps;
  dispatchedCalls: DispatchRequest[];
  writtenReceipts: Set<string>;
  captures: { err: unknown; ctx: CaptureContext }[];
}>;

function buildFamilies(configs: readonly FamilyConfig[]): Family[] {
  // Materialize family/child IDs from indices so children are globally
  // unique without relying on UUID collision odds.
  return configs.map((cfg, familyIdx) => {
    const familiaId = `fam-${familyIdx.toString().padStart(2, '0')}`;
    return {
      familiaId,
      failureMode: cfg.failureMode,
      children: cfg.childPendingCounts.map((pendingCount, childIdx) => ({
        familiaId,
        filhoId: `${familiaId}-child-${childIdx}`,
        pendingCount,
      })),
    };
  });
}

function createHarness(familyById: ReadonlyMap<string, Family>): Harness {
  const dispatchedCalls: DispatchRequest[] = [];
  const writtenReceipts = new Set<string>();
  const captures: { err: unknown; ctx: CaptureContext }[] = [];

  const deps: OrchestratorDeps = {
    selectFamilyEligibility: (familiaId) => {
      const fam = familyById.get(familiaId);
      if (!fam) return [];
      if (fam.failureMode === 'selection-throw') {
        throw new Error(`forced selection failure for ${familiaId}`);
      }
      return fam.children;
    },
    insertReceipt: (child) => {
      // dia is fixed across this run, so the (filho_id, dia) idempotency
      // key collapses to filho_id.
      if (writtenReceipts.has(child.filhoId)) return false;
      writtenReceipts.add(child.filhoId);
      return true;
    },
    dispatch: async (req) => {
      const fam = familyById.get(req.familiaId);
      if (fam?.failureMode === 'dispatch-throw') {
        throw new Error(`forced dispatch failure for ${req.familiaId}`);
      }
      dispatchedCalls.push(req);
    },
    captureException: (err, ctx) => {
      captures.push({ err, ctx });
    },
  };

  return { deps, dispatchedCalls, writtenReceipts, captures };
}

/**
 * (1) Healthy children: exactly one receipt and exactly one dispatch
 * invocation, regardless of where Throwing families fall in the iteration
 * order. This is the "Healthy results unaffected" leg of Property 4.
 */
function assertHealthyDispatched(healthy: readonly Family[], harness: Harness): void {
  for (const fam of healthy) {
    for (const child of fam.children) {
      assertHealthyChildDispatched(fam, child, harness);
    }
  }
}

function assertHealthyChildDispatched(
  fam: Family,
  child: EligibleChild,
  harness: Harness,
): void {
  if (!harness.writtenReceipts.has(child.filhoId)) {
    throw new Error(
      `Healthy family ${fam.familiaId} child ${child.filhoId} has no receipt`,
    );
  }
  const calls = harness.dispatchedCalls.filter(
    (c) => c.familiaId === fam.familiaId && c.filhoId === child.filhoId,
  );
  if (calls.length !== 1) {
    throw new Error(
      `Healthy family ${fam.familiaId} child ${child.filhoId} dispatched ${calls.length} times; expected 1`,
    );
  }
  if (calls[0].pendingCount !== child.pendingCount) {
    throw new Error(
      `Healthy family ${fam.familiaId} child ${child.filhoId} pendingCount mismatch: got ${calls[0].pendingCount}, expected ${child.pendingCount}`,
    );
  }
}

/**
 * (2) Throwing families: the per-family BEGIN/EXCEPTION wrapper isolates
 * the failure, so no successful dispatch may leak through. Combined with
 * (1), this proves Healthy families' work is performed independently of
 * any Throwing family preceding or following them in the iteration order.
 */
function assertNoLeakFromThrowing(throwing: readonly Family[], harness: Harness): void {
  for (const fam of throwing) {
    const fromThrow = harness.dispatchedCalls.filter((c) => c.familiaId === fam.familiaId);
    if (fromThrow.length !== 0) {
      throw new Error(
        `Throwing family ${fam.familiaId} (mode=${fam.failureMode}) had ${fromThrow.length} successful dispatches; expected 0`,
      );
    }
  }
}

/**
 * (3) + (4) Sentry: exactly one captureException per Throwing family,
 * with the canonical tag pair { subsystem: 'push', event: 'tarefa_lembrete' }
 * and extras strictly limited to { familiaId } belonging to a distinct
 * Throwing family. Pinned by Requirements 5.4, 6.5, and 8.5.
 */
function assertCapturedExceptions(throwing: readonly Family[], harness: Harness): void {
  if (harness.captures.length !== throwing.length) {
    throw new Error(
      `captureException called ${harness.captures.length} times; expected exactly one per Throwing family (=${throwing.length})`,
    );
  }
  const seen = new Set<string>();
  for (const { ctx } of harness.captures) {
    assertCaptureTags(ctx);
    const familiaId = readSingleFamiliaIdExtra(ctx);
    if (!throwing.some((f) => f.familiaId === familiaId)) {
      throw new Error(
        `captureException extra.familiaId ${familiaId} does not belong to any Throwing family`,
      );
    }
    if (seen.has(familiaId)) {
      throw new Error(`captureException called more than once for familia ${familiaId}`);
    }
    seen.add(familiaId);
  }
}

function assertCaptureTags(ctx: CaptureContext): void {
  const tagKeys = Object.keys(ctx.tags).sort((a, b) => a.localeCompare(b));
  if (tagKeys.length !== 2 || tagKeys[0] !== 'event' || tagKeys[1] !== 'subsystem') {
    throw new Error(
      `captureException tags must be exactly {subsystem, event}; got ${JSON.stringify(ctx.tags)}`,
    );
  }
  if (ctx.tags.subsystem !== 'push') {
    throw new Error(
      `captureException tags.subsystem must be "push"; got ${JSON.stringify(ctx.tags.subsystem)}`,
    );
  }
  if (ctx.tags.event !== 'tarefa_lembrete') {
    throw new Error(
      `captureException tags.event must be "tarefa_lembrete"; got ${JSON.stringify(ctx.tags.event)}`,
    );
  }
}

function readSingleFamiliaIdExtra(ctx: CaptureContext): string {
  const extraKeys = Object.keys(ctx.extra);
  if (extraKeys.length !== 1 || extraKeys[0] !== 'familiaId') {
    throw new Error(
      `captureException extras must be limited to {familiaId}; got keys ${JSON.stringify(extraKeys)}`,
    );
  }
  const familiaId = ctx.extra.familiaId;
  if (typeof familiaId !== 'string') {
    throw new TypeError(
      `captureException extra.familiaId must be a string; got ${typeof familiaId}`,
    );
  }
  return familiaId;
}

const failureModeArb = fc.constantFrom<FailureMode>(
  'healthy',
  'selection-throw',
  'dispatch-throw',
);

/**
 * Generates a non-empty list of families. Pending counts span the full
 * constraint range from the migration (`pending_count >= 1 AND <= 9999`).
 *
 * Smart generator note: `dispatch-throw` families MUST have at least one
 * child. Property 4 binds the contract to families "where every selection
 * or dispatch step is forced to raise an exception". A zero-child
 * `dispatch-throw` family has no dispatch step that can throw, so the
 * property's precondition (a throw actually fires) is unsatisfiable for
 * that input — it would degenerate into a `healthy` empty family, which
 * the simulator (correctly) does not capture. Constraining the generator
 * keeps the input space aligned with the property's quantifier and avoids
 * a meaningless counterexample.
 *
 * `selection-throw` families may have any number of children (including
 * zero) because the selection step always executes, regardless of how
 * many children would have been returned.
 *
 * IDs are derived from indices after generation so children are globally
 * unique by construction (which mirrors the (filho_id, dia) idempotency
 * key in `lembretes_envios`).
 */
const familyConfigArb: fc.Arbitrary<FamilyConfig> = fc
  .record({
    failureMode: failureModeArb,
    childPendingCounts: fc.array(fc.integer({ min: 1, max: 9999 }), {
      minLength: 0,
      maxLength: 3,
    }),
  })
  .chain((cfg) => {
    if (cfg.failureMode !== 'dispatch-throw' || cfg.childPendingCounts.length > 0) {
      return fc.constant(cfg);
    }
    // Force at least one child so the dispatch step actually executes.
    return fc.array(fc.integer({ min: 1, max: 9999 }), { minLength: 1, maxLength: 3 }).map(
      (counts) => ({ ...cfg, childPendingCounts: counts }),
    );
  });

const familiesArb = fc.array(familyConfigArb, { minLength: 1, maxLength: 6 });

describe('Feature: child-task-reminder, Property 4: per-family failure isolation', () => {
  it('a thrown selection or dispatch in one familia_id never prevents dispatch for other familias and emits exactly one Sentry.captureException per failing family', async () => {
    await fc.assert(
      fc.asyncProperty(familiesArb, async (configs) => {
        const families = buildFamilies(configs);
        const familyById = new Map(families.map((f) => [f.familiaId, f]));
        const harness = createHarness(familyById);

        await runOrchestrator(
          families.map((f) => f.familiaId),
          harness.deps,
        );

        const healthy = families.filter((f) => f.failureMode === 'healthy');
        const throwing = families.filter((f) => f.failureMode !== 'healthy');

        assertHealthyDispatched(healthy, harness);
        assertNoLeakFromThrowing(throwing, harness);
        assertCapturedExceptions(throwing, harness);
      }),
      { numRuns: 200 },
    );
  });

  // Direct example check that pins the cardinality of (1)+(3) to a fixed
  // input. Acts as a smoke test if the property test ever degenerates to
  // empty input — fast-check's shrinker will not strip this case because
  // it is hard-coded.
  it('mixed Healthy+Throwing input dispatches every healthy child and captures exactly one exception per throwing family', async () => {
    const families: readonly Family[] = [
      {
        familiaId: 'fam-healthy-a',
        failureMode: 'healthy',
        children: [
          { familiaId: 'fam-healthy-a', filhoId: 'fam-healthy-a-child-0', pendingCount: 3 },
        ],
      },
      {
        familiaId: 'fam-throw-sel',
        failureMode: 'selection-throw',
        children: [],
      },
      {
        familiaId: 'fam-healthy-b',
        failureMode: 'healthy',
        children: [
          { familiaId: 'fam-healthy-b', filhoId: 'fam-healthy-b-child-0', pendingCount: 1 },
          { familiaId: 'fam-healthy-b', filhoId: 'fam-healthy-b-child-1', pendingCount: 2 },
        ],
      },
      {
        familiaId: 'fam-throw-disp',
        failureMode: 'dispatch-throw',
        children: [
          { familiaId: 'fam-throw-disp', filhoId: 'fam-throw-disp-child-0', pendingCount: 5 },
        ],
      },
    ];

    const familyById = new Map(families.map((f) => [f.familiaId, f]));
    const harness = createHarness(familyById);

    await runOrchestrator(
      families.map((f) => f.familiaId),
      harness.deps,
    );

    // Three healthy dispatches, two captures, no leaks from throwing
    // families.
    if (harness.dispatchedCalls.length !== 3) {
      throw new Error(`expected 3 dispatched calls; got ${harness.dispatchedCalls.length}`);
    }
    if (harness.captures.length !== 2) {
      throw new Error(`expected 2 captureException calls; got ${harness.captures.length}`);
    }
    const capturedFamilias = harness.captures
      .map((c) => String(c.ctx.extra.familiaId))
      .sort((a, b) => a.localeCompare(b));
    if (capturedFamilias[0] !== 'fam-throw-disp' || capturedFamilias[1] !== 'fam-throw-sel') {
      throw new Error(
        `captureException familiaIds must be exactly [fam-throw-disp, fam-throw-sel]; got ${JSON.stringify(capturedFamilias)}`,
      );
    }
    for (const c of harness.captures) {
      if (c.ctx.tags.subsystem !== 'push' || c.ctx.tags.event !== 'tarefa_lembrete') {
        throw new Error(
          `captureException tags must be {subsystem:'push', event:'tarefa_lembrete'}; got ${JSON.stringify(c.ctx.tags)}`,
        );
      }
    }
  });
});
