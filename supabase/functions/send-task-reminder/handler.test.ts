// Tests for the send-task-reminder edge function handler.
//
// Task 3.4: Property test for PII redaction across observability surfaces.
// Subsequent example tests for auth, validation, IDOR, and the success
// path are appended to this file by task 3.5; the structure below leaves
// the bottom of the file open for those additions and keeps property
// scaffolding (PII generators, diagnostic capture helpers, mock factories)
// at the top so they can be reused.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// ─── Module mocks ────────────────────────────────────────────────────────────
//
// The handler imports `resolveTokens`, `sendToExpoPushApi`, and
// `processTicketResults` from the sibling `send-push-notification/handler.ts`
// module. We replace them with controllable spies so each property iteration
// can drive every reachable handler code path (success, no-token,
// transport-failure) without touching the network or a real Supabase client.
//
// The mock factory MUST be set up before importing `./handler` so the
// dynamic ESM linker rewires the dependency before the handler module is
// evaluated. `vi.hoisted` is unnecessary because vitest auto-hoists
// `vi.mock` to the top of the file.

const resolveTokensMock = vi.fn();
const sendToExpoPushApiMock = vi.fn();
const processTicketResultsMock = vi.fn();

vi.mock('../send-push-notification/handler.ts', () => ({
  resolveTokens: (...args: unknown[]) => resolveTokensMock(...args),
  sendToExpoPushApi: (...args: unknown[]) => sendToExpoPushApiMock(...args),
  processTicketResults: (...args: unknown[]) => processTicketResultsMock(...args),
}));

import {
  constantTimeEquals,
  handleRequest,
  type HandlerDeps,
  type SendTaskReminderResponse,
} from './handler';
import type {
  ExpoPushMessage,
  SupabaseClientLike,
} from '../send-push-notification/handler';

// ─── PII fixture and arbitraries ─────────────────────────────────────────────

type PiiFixture = Readonly<{
  childName: string;
  taskTitle: string;
  pushToken: string;
  email: string;
}>;

/**
 * Distinctive PII strings — long enough that the chance of a randomly
 * generated value coincidentally appearing inside the static handler copy
 * (`'Bora fechar o dia'`, `'Falta pouco pra fechar o dia'`, etc.) or inside
 * the breadcrumb event identifiers (`'reminder: dispatched'`, etc.) is
 * negligible. Each value is constrained to printable ASCII so JSON
 * stringification is bijective and comparisons remain stable.
 */
const piiFixtureArb: fc.Arbitrary<PiiFixture> = fc.record({
  childName: fc
    .stringMatching(/^[A-Za-z][A-Za-z ]{6,18}[A-Za-z]$/)
    .filter((s) => s.trim().length >= 6),
  taskTitle: fc
    .stringMatching(/^[A-Za-z][A-Za-z ]{6,28}[A-Za-z]$/)
    .filter((s) => s.trim().length >= 6),
  pushToken: fc.stringMatching(/^ExponentPushToken\[[A-Za-z0-9_-]{16,32}\]$/),
  email: fc.emailAddress(),
});

const familiaIdArb = fc.uuid({ version: 4 });
const filhoIdArb = fc.uuid({ version: 4 });
const usuarioIdArb = fc.uuid({ version: 4 });
const pendingCountArb = fc.integer({ min: 1, max: 9999 });

// ─── Diagnostic capture ──────────────────────────────────────────────────────

type CapturedDiagnostic = Readonly<{
  event: string;
  message?: string;
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
  level?: 'info' | 'warn' | 'error';
}>;

function makeDiagnosticCollector() {
  const captured: CapturedDiagnostic[] = [];
  return {
    captured,
    reportDiagnostic: (d: CapturedDiagnostic) => {
      captured.push(d);
    },
  };
}

/**
 * Concatenates every observable string surface of a diagnostic — the
 * `event` identifier, the optional `message`, every value of `context`,
 * and every value of `tags` — into a single string. PII assertions are
 * made over this concatenation, which mirrors the surface of a Sentry
 * payload (breadcrumb message + extras + tags) the upstream Deno entry
 * point will produce when it forwards these diagnostics to Sentry.
 */
function flattenDiagnosticSurface(d: CapturedDiagnostic): string {
  const parts: string[] = [d.event];
  if (typeof d.message === 'string') parts.push(d.message);
  if (d.context) {
    for (const value of Object.values(d.context)) {
      parts.push(typeof value === 'string' ? value : JSON.stringify(value));
    }
  }
  if (d.tags) parts.push(JSON.stringify(d.tags));
  return parts.join('\u0001'); // U+0001 cannot collide with PII fixtures
}

// ─── Mock Supabase factory (PII-loaded) ──────────────────────────────────────

type MockSupabaseConfig = Readonly<{
  pii: PiiFixture;
  filhoId: string;
  familiaId: string;
  usuarioId: string;
  /**
   * When `true`, the `filhos` lookup returns an empty result, exercising
   * the child-not-found path in `resolveChildUserId`.
   */
  filhoNotFound?: boolean;
}>;

/**
 * Builds a SupabaseClientLike whose returned rows carry the PII fixtures
 * (`nome`, `email`, `titulo`, `token`) alongside the columns the handler
 * actually selects. The handler must NOT propagate any of those extra
 * fields into diagnostics.
 *
 * Only the methods exercised by `resolveChildUserId` are implemented:
 * `from('filhos').select('usuario_id').eq(id).eq(familia_id)` and
 * `from('usuarios').select('id').eq(id).eq(familia_id)`. Everything else
 * is unreachable in this test because `resolveTokens` and friends are
 * mocked at the module boundary.
 */
function createMockSupabase(config: MockSupabaseConfig): SupabaseClientLike {
  const { pii, usuarioId, filhoNotFound = false } = config;

  const filhosRow = filhoNotFound
    ? null
    : {
        usuario_id: usuarioId,
        // Extra PII-laden columns intentionally left in the mock row to
        // verify the handler does not splat them into diagnostics.
        nome: pii.childName,
        email: pii.email,
      };

  const usuariosRow = {
    id: usuarioId,
    nome: pii.childName,
    email: pii.email,
  };

  return {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'filhos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: filhosRow ? [filhosRow] : [],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'usuarios') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [usuariosRow],
                error: null,
              }),
            }),
          }),
        };
      }
      // Unreached: every other table is touched only by the mocked
      // send-push-notification helpers.
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    }),
  } as unknown as SupabaseClientLike;
}

// ─── Request and dependency builders ─────────────────────────────────────────

const SERVICE_ROLE_KEY = 'test-service-role-key-for-handler-property-test';

function makeRequest(body: unknown, opts?: { authHeader?: string | null }): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.authHeader !== null) {
    headers.Authorization = opts?.authHeader ?? `Bearer ${SERVICE_ROLE_KEY}`;
  }
  return new Request('https://localhost/send-task-reminder', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as unknown as Request;
}

function makeDeps(
  supabase: SupabaseClientLike,
  reportDiagnostic: HandlerDeps['reportDiagnostic'],
): HandlerDeps {
  return {
    getServiceRoleKey: () => SERVICE_ROLE_KEY,
    getSupabaseUrl: () => 'https://test.supabase.co',
    createSupabaseClient: () => supabase,
    reportDiagnostic,
  };
}

// ─── Path drivers ────────────────────────────────────────────────────────────

type Scenario =
  | 'success'
  | 'no-token'
  | 'transport-failure'
  | 'child-not-found'
  | 'no-pending';

/**
 * Configures the module-level mocks and the mock Supabase client to drive
 * the handler down a specific path, then runs the handler. Returns the
 * captured diagnostics plus the response payload (parsed as text — never
 * inspected for routing in the property, only for PII).
 */
async function runScenario(
  scenario: Scenario,
  pii: PiiFixture,
  ids: { familiaId: string; filhoId: string; usuarioId: string },
  pendingCount: number,
): Promise<{ diagnostics: CapturedDiagnostic[]; responseText: string; status: number }> {
  resolveTokensMock.mockReset();
  sendToExpoPushApiMock.mockReset();
  processTicketResultsMock.mockReset();

  switch (scenario) {
    case 'success':
      resolveTokensMock.mockResolvedValueOnce([pii.pushToken]);
      sendToExpoPushApiMock.mockResolvedValueOnce([{ status: 'ok', id: 'ticket-1' }]);
      processTicketResultsMock.mockResolvedValueOnce({ sent: 1, failed: 0, cleaned: 0 });
      break;
    case 'no-token':
      resolveTokensMock.mockResolvedValueOnce([]);
      break;
    case 'transport-failure':
      resolveTokensMock.mockResolvedValueOnce([pii.pushToken]);
      // Simulate a transport-level error (e.g. Expo Push API HTTP 5xx).
      // The handler must catch it and emit a redacted diagnostic.
      sendToExpoPushApiMock.mockRejectedValueOnce(new Error('Expo Push API returned HTTP 503'));
      break;
    case 'child-not-found':
      // No resolveTokens stub needed — handler returns 404 before calling.
      break;
    case 'no-pending':
      // Body validation rejects pendingCount < 1; this is the handler-side
      // expression of the orchestrator's "no pending at composition time"
      // guard (req 8.4).
      break;
  }

  const supabase = createMockSupabase({
    pii,
    filhoId: ids.filhoId,
    familiaId: ids.familiaId,
    usuarioId: ids.usuarioId,
    filhoNotFound: scenario === 'child-not-found',
  });

  const collector = makeDiagnosticCollector();
  const body =
    scenario === 'no-pending'
      ? { familiaId: ids.familiaId, filhoId: ids.filhoId, pendingCount: 0 }
      : { familiaId: ids.familiaId, filhoId: ids.filhoId, pendingCount };

  const res = await handleRequest(makeRequest(body), makeDeps(supabase, collector.reportDiagnostic));
  const responseText = await res.text();

  return { diagnostics: collector.captured, responseText, status: res.status };
}

// ─── Property Tests ──────────────────────────────────────────────────────────

const SCENARIOS: readonly Scenario[] = [
  'success',
  'no-token',
  'transport-failure',
  'child-not-found',
  'no-pending',
] as const;

const TOKEN_PREFIX_LENGTH = 12;

/**
 * Feature: child-task-reminder, Property 6: PII redaction across observability surfaces
 * Validates: Requirements 6.2, 6.3
 *
 * For any random PII set (childName, taskTitle, pushToken, email) attached
 * to entities returned by the mock Supabase client, after running every
 * reachable code path of the send-task-reminder edge function (success,
 * no-token, transport-failure, child-not-found, no-pending) with that PII
 * set:
 *   (a) no captured diagnostic message, context value, or tag value
 *       contains any of the four PII substrings, and
 *   (b) any `tokenPrefix` field present in a diagnostic context has length
 *       exactly 12 and is a prefix of some pushToken registered for the
 *       targeted child.
 *
 * The handler emits diagnostics through the injected `reportDiagnostic`
 * dependency rather than calling Sentry directly; the Deno `index.ts`
 * entry point maps each diagnostic to a Sentry breadcrumb / capture call.
 * Asserting on the diagnostic surface is therefore equivalent to asserting
 * on the Sentry surface — the upstream code path adds no fields, only
 * forwards them. The "no PII" guarantee is preserved iff every diagnostic
 * emitted by the handler is itself PII-free.
 */
describe('Property 6: PII redaction across observability surfaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('no captured diagnostic exposes any PII substring across every reachable handler path', async () => {
    await fc.assert(
      fc.asyncProperty(
        piiFixtureArb,
        familiaIdArb,
        filhoIdArb,
        usuarioIdArb,
        pendingCountArb,
        async (pii, familiaId, filhoId, usuarioId, pendingCount) => {
          const piiSubstrings = [pii.childName, pii.taskTitle, pii.pushToken, pii.email];

          for (const scenario of SCENARIOS) {
            const { diagnostics } = await runScenario(scenario, pii, { familiaId, filhoId, usuarioId }, pendingCount);

            for (const diagnostic of diagnostics) {
              const surface = flattenDiagnosticSurface(diagnostic);
              for (const piiValue of piiSubstrings) {
                if (surface.includes(piiValue)) {
                  throw new Error(
                    `PII leak: scenario=${scenario} diagnostic.event=${diagnostic.event} contained ${JSON.stringify(piiValue)}`,
                  );
                }
              }
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('any tokenPrefix in diagnostic context is exactly 12 chars and a prefix of a registered token', async () => {
    await fc.assert(
      fc.asyncProperty(
        piiFixtureArb,
        familiaIdArb,
        filhoIdArb,
        usuarioIdArb,
        pendingCountArb,
        async (pii, familiaId, filhoId, usuarioId, pendingCount) => {
          for (const scenario of SCENARIOS) {
            const { diagnostics } = await runScenario(
              scenario,
              pii,
              { familiaId, filhoId, usuarioId },
              pendingCount,
            );

            for (const diagnostic of diagnostics) {
              const tokenPrefix = diagnostic.context?.tokenPrefix;
              if (tokenPrefix === undefined) continue;
              if (typeof tokenPrefix !== 'string') {
                throw new Error(
                  `tokenPrefix must be a string, got ${typeof tokenPrefix} in scenario ${scenario}`,
                );
              }
              if (tokenPrefix.length !== TOKEN_PREFIX_LENGTH) {
                throw new Error(
                  `tokenPrefix length must be ${TOKEN_PREFIX_LENGTH}, got ${tokenPrefix.length} in scenario ${scenario}`,
                );
              }
              if (!pii.pushToken.startsWith(tokenPrefix)) {
                throw new Error(
                  `tokenPrefix ${JSON.stringify(tokenPrefix)} is not a prefix of registered pushToken in scenario ${scenario}`,
                );
              }
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('handler response body never contains any PII substring across every reachable path', async () => {
    // Defensive: the response body is a separate observability surface
    // (orchestrator log of the http_post return) and must also be PII-free.
    await fc.assert(
      fc.asyncProperty(
        piiFixtureArb,
        familiaIdArb,
        filhoIdArb,
        usuarioIdArb,
        pendingCountArb,
        async (pii, familiaId, filhoId, usuarioId, pendingCount) => {
          const piiSubstrings = [pii.childName, pii.taskTitle, pii.pushToken, pii.email];

          for (const scenario of SCENARIOS) {
            const { responseText } = await runScenario(
              scenario,
              pii,
              { familiaId, filhoId, usuarioId },
              pendingCount,
            );
            for (const piiValue of piiSubstrings) {
              if (responseText.includes(piiValue)) {
                throw new Error(
                  `Response body leak: scenario=${scenario} body=${responseText} contained ${JSON.stringify(piiValue)}`,
                );
              }
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.5: Example tests for auth, validation, IDOR, and success path.
// Validates: Requirements 5.1, 5.2, 5.5
// ─────────────────────────────────────────────────────────────────────────────
//
// These tests reuse the property-test scaffolding above (createMockSupabase,
// makeRequest, makeDeps, SERVICE_ROLE_KEY, the module-level resolveTokensMock
// / sendToExpoPushApiMock / processTicketResultsMock). They pin the contract
// the property tests cannot pin — specific status codes, specific error
// branches, and the exact event identifier passed to the inner push helpers
// — by exercising one well-known input per branch.

import {
  REMINDER_TITLE,
  REMINDER_BODY_PLURAL,
  REMINDER_BODY_SINGULAR,
  buildReminderBody,
} from './copy-bank';

const FAMILIA_ID = '11111111-1111-4111-8111-111111111111';
const FILHO_ID = '22222222-2222-4222-8222-222222222222';
const USUARIO_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_FAMILIA_ID = '44444444-4444-4444-8444-444444444444';

function makeRawRequest(init: {
  method?: string;
  body?: string | null;
  headers?: Record<string, string>;
}): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...init.headers,
  };
  // Cast required: lib.dom Request and undici-types Request differ on
  // signal.onabort. The existing makeRequest above uses the same cast.
  return new Request('https://localhost/send-task-reminder', {
    method: init.method ?? 'POST',
    headers,
    body: init.body ?? undefined,
  }) as unknown as Request;
}

function defaultDeps(supabase: SupabaseClientLike): HandlerDeps {
  return makeDeps(supabase, () => {
    /* discard */
  });
}

/**
 * Builds a SupabaseClientLike that returns the supplied rows for the
 * `filhos` and `usuarios` lookups in `resolveChildUserId`. Lets each test
 * independently model a different IDOR scenario.
 */
function createIdorMockSupabase(opts: {
  filhosRows: Array<{ usuario_id: string }>;
  usuariosRows: Array<{ id: string }>;
}): SupabaseClientLike {
  return {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockImplementation((table: string) => {
      const rows = table === 'filhos' ? opts.filhosRows : opts.usuariosRows;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      };
    }),
  } as SupabaseClientLike;
}

function defaultSupabase(): SupabaseClientLike {
  return createMockSupabase({
    pii: {
      childName: 'Carlos Silva',
      taskTitle: 'Lavar a louça',
      pushToken: 'ExponentPushToken[abcdef0123456789]',
      email: 'carlos@example.com',
    },
    filhoId: FILHO_ID,
    familiaId: FAMILIA_ID,
    usuarioId: USUARIO_ID,
  });
}

describe('send-task-reminder handler — auth', () => {
  beforeEach(() => {
    resolveTokensMock.mockReset();
    sendToExpoPushApiMock.mockReset();
    processTicketResultsMock.mockReset();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest(
      { familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 1 },
      { authHeader: null },
    );
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(401);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization is not the service role key', async () => {
    const req = makeRequest(
      { familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 1 },
      { authHeader: 'Bearer wrong-key-totally-different-from-the-real-one' },
    );
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(401);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization is just "Bearer " with no token', async () => {
    const req = makeRequest(
      { familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 1 },
      { authHeader: 'Bearer ' },
    );
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(401);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  it('returns 405 on non-POST methods', async () => {
    const req = makeRawRequest({ method: 'GET' });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(405);
  });

  it('returns 500 when the service role key env var is missing', async () => {
    const supabase = defaultSupabase();
    const deps: HandlerDeps = {
      getServiceRoleKey: () => undefined,
      getSupabaseUrl: () => 'https://test.supabase.co',
      createSupabaseClient: () => supabase,
      reportDiagnostic: () => {
        /* discard */
      },
    };
    const req = makeRequest({ familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 1 });
    const res = await handleRequest(req, deps);
    expect(res.status).toBe(500);
  });

  it('returns 413 when content-length exceeds the body cap', async () => {
    const oversized = JSON.stringify({
      familiaId: FAMILIA_ID,
      filhoId: FILHO_ID,
      pendingCount: 1,
      junk: 'x'.repeat(5000),
    });
    const req = makeRawRequest({
      body: oversized,
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': String(oversized.length),
      },
    });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(413);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });
});

describe('send-task-reminder handler — body validation', () => {
  beforeEach(() => {
    resolveTokensMock.mockReset();
    sendToExpoPushApiMock.mockReset();
    processTicketResultsMock.mockReset();
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = makeRawRequest({
      body: '{invalid json',
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(400);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  it('returns 400 when familiaId is not a UUID', async () => {
    const req = makeRequest({
      familiaId: 'not-a-uuid',
      filhoId: FILHO_ID,
      pendingCount: 1,
    });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(400);
  });

  it('returns 400 when filhoId is not a UUID', async () => {
    const req = makeRequest({
      familiaId: FAMILIA_ID,
      filhoId: 'still-not-a-uuid',
      pendingCount: 1,
    });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(400);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['string', '1' as unknown as number],
  ])('returns 400 when pendingCount is %s', async (_label, pendingCount) => {
    const req = makeRequest({
      familiaId: FAMILIA_ID,
      filhoId: FILHO_ID,
      pendingCount,
    });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(400);
  });

  it.each([
    ['null', null],
    ['array', [1, 2, 3]],
    ['number', 42],
    ['string', 'hello'],
  ])('returns 400 when body is %s (not a JSON object)', async (_label, body) => {
    const req = makeRequest(body);
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));
    expect(res.status).toBe(400);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });
});

describe('send-task-reminder handler — IDOR (server-side guard)', () => {
  beforeEach(() => {
    resolveTokensMock.mockReset();
    sendToExpoPushApiMock.mockReset();
    processTicketResultsMock.mockReset();
  });

  it('returns 404 when filho lookup returns empty', async () => {
    const supabase = createMockSupabase({
      pii: {
        childName: 'A',
        taskTitle: 'B',
        pushToken: 'ExponentPushToken[xxxx]',
        email: 'x@example.com',
      },
      filhoId: FILHO_ID,
      familiaId: FAMILIA_ID,
      usuarioId: USUARIO_ID,
      filhoNotFound: true,
    });
    const req = makeRequest({ familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 1 });
    const res = await handleRequest(req, defaultDeps(supabase));
    expect(res.status).toBe(404);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  it("returns 404 when filho's usuario_id resolves but the usuarios row is in a different familia_id", async () => {
    // filhos lookup succeeds (constrained to FAMILIA_ID), but the
    // joined usuarios row is in OTHER_FAMILIA_ID — `.eq('familia_id', FAMILIA_ID)`
    // returns empty, so `resolveChildUserId` correctly returns null.
    const supabase = createIdorMockSupabase({
      filhosRows: [{ usuario_id: USUARIO_ID }],
      usuariosRows: [],
    });
    const req = makeRequest({ familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 1 });
    const res = await handleRequest(req, defaultDeps(supabase));
    expect(res.status).toBe(404);
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  it('queries filhos with the request familiaId+filhoId (does not trust attacker-supplied userId)', async () => {
    // The handler's filhos lookup is `.from('filhos').select(...).eq('id', filhoId).eq('familia_id', familiaId)`
    // — 2 chained eq calls. Capture both so we can assert the args at each step.
    const filhosFamiliaEq = vi
      .fn()
      .mockResolvedValue({ data: [{ usuario_id: USUARIO_ID }], error: null });
    const filhosIdEq = vi.fn().mockReturnValue({ eq: filhosFamiliaEq });

    const usuariosFamiliaEq = vi
      .fn()
      .mockResolvedValue({ data: [{ id: USUARIO_ID }], error: null });
    const usuariosIdEq = vi.fn().mockReturnValue({ eq: usuariosFamiliaEq });

    const supabase = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: table === 'filhos' ? filhosIdEq : usuariosIdEq,
        }),
      })),
    } as SupabaseClientLike;

    // Force resolveTokens to short-circuit so we only assert the join inputs.
    resolveTokensMock.mockResolvedValueOnce([]);

    // Attacker supplies a body that matches the schema but tries to
    // smuggle a userId. The handler MUST resolve userId server-side from
    // (familiaId, filhoId) and ignore any extra fields. validateRequest
    // accepts the extra property silently.
    const req = makeRequest({
      familiaId: FAMILIA_ID,
      filhoId: FILHO_ID,
      pendingCount: 1,
      userId: OTHER_FAMILIA_ID, // attacker-supplied; must be ignored
    });
    await handleRequest(req, defaultDeps(supabase));

    expect(filhosIdEq).toHaveBeenCalledWith('id', FILHO_ID);
    expect(filhosFamiliaEq).toHaveBeenCalledWith('familia_id', FAMILIA_ID);
    expect(usuariosIdEq).toHaveBeenCalledWith('id', USUARIO_ID);
    expect(usuariosFamiliaEq).toHaveBeenCalledWith('familia_id', FAMILIA_ID);

    // resolveTokens should be called with the server-resolved userId, not
    // any attacker-supplied value.
    expect(resolveTokensMock).toHaveBeenCalledTimes(1);
    const payload = resolveTokensMock.mock.calls[0][3] as { userId: string };
    expect(payload.userId).toBe(USUARIO_ID);
    expect(payload.userId).not.toBe(OTHER_FAMILIA_ID);
  });
});

describe('send-task-reminder handler — success path', () => {
  beforeEach(() => {
    resolveTokensMock.mockReset();
    sendToExpoPushApiMock.mockReset();
    processTicketResultsMock.mockReset();
  });

  it('returns 200 with { sent, failed, cleaned } and dispatches with event=tarefa_lembrete and server-resolved userId (singular)', async () => {
    const PUSH_TOKEN = 'ExponentPushToken[singular0123456789]';
    resolveTokensMock.mockResolvedValueOnce([PUSH_TOKEN]);
    sendToExpoPushApiMock.mockResolvedValueOnce([{ status: 'ok', id: 'ticket-1' }]);
    processTicketResultsMock.mockResolvedValueOnce({ sent: 1, failed: 0, cleaned: 0 });

    const req = makeRequest({ familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 1 });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 0, cleaned: 0 });

    // resolveTokens invoked exactly once with the canonical event identifier
    // and the server-resolved userId (req 5.1, 5.2, 5.5).
    expect(resolveTokensMock).toHaveBeenCalledTimes(1);
    const [, eventArg, familiaArg, payloadArg] = resolveTokensMock.mock.calls[0];
    expect(eventArg).toBe('tarefa_lembrete');
    expect(familiaArg).toBe(FAMILIA_ID);
    expect(payloadArg).toMatchObject({
      userId: USUARIO_ID,
      taskTitle: '',
      pendingCount: 1,
    });

    // The Expo message uses REMINDER_TITLE and the singular body.
    expect(sendToExpoPushApiMock).toHaveBeenCalledTimes(1);
    const messages = sendToExpoPushApiMock.mock.calls[0][0] as Array<{
      to: string;
      title: string;
      body: string;
    }>;
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe(PUSH_TOKEN);
    expect(messages[0].title).toBe(REMINDER_TITLE);
    expect(messages[0].body).toBe(REMINDER_BODY_SINGULAR);
    expect(messages[0].body).toBe(buildReminderBody(1));
  });

  it('uses the plural body when pendingCount > 1 with the count interpolated', async () => {
    const PUSH_TOKEN = 'ExponentPushToken[plural9876543210]';
    resolveTokensMock.mockResolvedValueOnce([PUSH_TOKEN]);
    sendToExpoPushApiMock.mockResolvedValueOnce([{ status: 'ok', id: 'ticket-2' }]);
    processTicketResultsMock.mockResolvedValueOnce({ sent: 1, failed: 0, cleaned: 0 });

    const req = makeRequest({ familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 5 });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));

    expect(res.status).toBe(200);

    expect(sendToExpoPushApiMock).toHaveBeenCalledTimes(1);
    const messages = sendToExpoPushApiMock.mock.calls[0][0] as Array<{
      title: string;
      body: string;
    }>;
    expect(messages[0].title).toBe(REMINDER_TITLE);
    expect(messages[0].body).toBe(REMINDER_BODY_PLURAL.replace('{n}', '5'));
    expect(messages[0].body).toBe(buildReminderBody(5));
    expect(messages[0].body).toContain('5');
  });

  it('returns 200 with zero counts when resolveTokens returns no eligible tokens', async () => {
    resolveTokensMock.mockResolvedValueOnce([]);

    const req = makeRequest({ familiaId: FAMILIA_ID, filhoId: FILHO_ID, pendingCount: 2 });
    const res = await handleRequest(req, defaultDeps(defaultSupabase()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, cleaned: 0 });
    // No transport call when there are no tokens.
    expect(sendToExpoPushApiMock).not.toHaveBeenCalled();
    expect(processTicketResultsMock).not.toHaveBeenCalled();
  });
});

// ─── Example tests (task 3.5) ────────────────────────────────────────────────
//
// Auth, validation, IDOR (server-side `(familiaId, filhoId)` mismatch), and
// the success path. These cover Requirements 5.1, 5.2, 5.5 with concrete
// inputs and outputs — they complement the property test above by pinning
// the contract at well-known boundaries.
//
// The success-path test asserts the inner call (the reused
// `send-push-notification` transport helpers) is driven with
// `event: 'tarefa_lembrete'` and a server-resolved `payload.userId`,
// because the orchestrator never sends `userId` in the request body — it
// is derived inside the handler from `(familiaId, filhoId)`. This is the
// IDOR guard's positive-side proof.

const SR_KEY = SERVICE_ROLE_KEY;

function makeAuthedRequest(
  body: unknown,
  opts?: { authHeader?: string | null; contentLengthOverride?: string },
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.authHeader !== null) {
    headers.Authorization = opts?.authHeader ?? `Bearer ${SR_KEY}`;
  }
  if (opts?.contentLengthOverride !== undefined) {
    headers['content-length'] = opts.contentLengthOverride;
  }
  return new Request('https://localhost/send-task-reminder', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as unknown as Request;
}

function makeDepsForExamples(supabase: SupabaseClientLike): HandlerDeps {
  return {
    getServiceRoleKey: () => SR_KEY,
    getSupabaseUrl: () => 'https://test.supabase.co',
    createSupabaseClient: () => supabase,
  };
}

// Stable UUIDs for the example tests — we want the body validator to
// accept them, so they must match the UUID v1-v5 shape the handler uses.
const FAM_UUID = '11111111-1111-4111-8111-111111111111';
const FILHO_UUID = '22222222-2222-4222-8222-222222222222';
const USER_UUID = '33333333-3333-4333-8333-333333333333';
const STATIC_PII: PiiFixture = {
  childName: 'Aurelia Marcondes',
  taskTitle: 'Lavar a louca de hoje',
  pushToken: 'ExponentPushToken[ABCDEFGHIJKLMNOP1234]',
  email: 'aurelia@example.com',
};

describe('handleRequest — auth, validation, IDOR, and success (example tests)', () => {
  beforeEach(() => {
    resolveTokensMock.mockReset();
    sendToExpoPushApiMock.mockReset();
    processTicketResultsMock.mockReset();
    vi.restoreAllMocks();
  });

  // ── 5.1 Auth ──────────────────────────────────────────────────────────────

  /**
   * Validates: Requirements 5.1
   *
   * Authorization must be the service role key. Anything else (including
   * a well-formed Bearer with a different secret) is rejected at the
   * authentication boundary, before any DB query runs.
   */
  it('returns 401 when Authorization is not the service role key', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest(
      { familiaId: FAM_UUID, filhoId: FILHO_UUID, pendingCount: 1 },
      { authHeader: 'Bearer not-the-service-role-key' },
    );

    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
    // No Supabase query should have been issued for an unauthenticated call.
    expect(supabase.from).not.toHaveBeenCalled();
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.1
   *
   * A missing Authorization header is treated identically to a wrong one.
   */
  it('returns 401 when Authorization header is missing', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest(
      { familiaId: FAM_UUID, filhoId: FILHO_UUID, pendingCount: 1 },
      { authHeader: null },
    );

    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.1
   *
   * Sanity check: `constantTimeEquals` accepts the matching key. We exercise
   * the helper directly so the `Authorization` parsing and the comparison
   * are jointly anchored — a future regression that swaps the comparator
   * for `===` would still pass the constant-time-specific check below but
   * is caught indirectly by the prefix-match test that follows.
   */
  it('constantTimeEquals returns true for identical strings and false for prefix matches', () => {
    expect(constantTimeEquals(SR_KEY, SR_KEY)).toBe(true);
    expect(constantTimeEquals(SR_KEY, SR_KEY.slice(0, -1))).toBe(false);
    expect(constantTimeEquals(`${SR_KEY}-extra`, SR_KEY)).toBe(false);
    expect(constantTimeEquals('', '')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
  });

  // ── 5.2 Body validation ───────────────────────────────────────────────────

  /**
   * Validates: Requirements 5.2
   *
   * `familiaId` is required as a UUID. A missing field fails validation.
   */
  it('returns 400 when familiaId is missing', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest({ filhoId: FILHO_UUID, pendingCount: 1 });
    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid request body' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.2
   *
   * `familiaId` must be a UUID, not an arbitrary string — the orchestrator
   * always sends UUIDs from `familias.id`, and a non-UUID would only occur
   * under a forged caller.
   */
  it('returns 400 when familiaId is not a UUID', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest({
      familiaId: 'not-a-uuid',
      filhoId: FILHO_UUID,
      pendingCount: 1,
    });
    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid request body' });
  });

  /**
   * Validates: Requirements 5.2
   *
   * `filhoId` must be a UUID for the same reason as `familiaId`.
   */
  it('returns 400 when filhoId is not a UUID', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: '',
      pendingCount: 1,
    });
    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid request body' });
  });

  /**
   * Validates: Requirements 5.2
   *
   * `pendingCount` must be a positive integer (>= 1). Zero is the
   * orchestrator-side "no pending at composition time" signal (req 8.4)
   * and the handler should refuse to dispatch it.
   */
  it('returns 400 when pendingCount is below 1', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      pendingCount: 0,
    });
    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid request body' });
  });

  /**
   * Validates: Requirements 5.2
   *
   * `pendingCount` must be an integer; floats are rejected.
   */
  it('returns 400 when pendingCount is not an integer', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      pendingCount: 1.5,
    });
    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid request body' });
  });

  /**
   * Validates: Requirements 5.2
   *
   * Non-object bodies (arrays, primitives) are rejected before any
   * field-level inspection.
   */
  it('returns 400 when body is an array', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    const req = makeAuthedRequest([FAM_UUID, FILHO_UUID, 1]);
    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid request body' });
  });

  // ── 5.5 IDOR — server-side `(familiaId, filhoId)` mismatch ────────────────

  /**
   * Validates: Requirements 5.5
   *
   * If the `(familiaId, filhoId)` pair does not resolve to a child
   * belonging to that family, the handler returns 404 — never trusting
   * the caller's claimed family. The mock returns an empty `filhos`
   * lookup to simulate the cross-family case.
   */
  it('returns 404 when (familiaId, filhoId) does not match an existing child in that family', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
      filhoNotFound: true,
    });

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      pendingCount: 1,
    });
    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(404);
    expect(json).toEqual({ error: 'Not found' });
    // The IDOR guard fails closed: no token resolution, no Expo dispatch.
    expect(resolveTokensMock).not.toHaveBeenCalled();
    expect(sendToExpoPushApiMock).not.toHaveBeenCalled();
    expect(processTicketResultsMock).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.5
   *
   * Defense in depth — if the `filhos` row is found but the joined
   * `usuarios` row is no longer in the same family (e.g. usuario_id was
   * re-pointed to a different family's user), the handler also returns
   * 404. We force this by overriding the second `from('usuarios')` lookup
   * to return an empty result.
   */
  it('returns 404 when the joined usuarios row is no longer in the family', async () => {
    const baseSupabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    // Replace the usuarios lookup so the cross-family check fails.
    const originalFrom = baseSupabase.from;
    const fromOverride = vi.fn().mockImplementation((table: string) => {
      if (table === 'usuarios') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return originalFrom(table);
    });
    (baseSupabase as unknown as { from: typeof fromOverride }).from = fromOverride;

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      pendingCount: 1,
    });
    const res = await handleRequest(req, makeDepsForExamples(baseSupabase));
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(404);
    expect(json).toEqual({ error: 'Not found' });
    expect(resolveTokensMock).not.toHaveBeenCalled();
  });

  // ── 200 success path with inner-call assertions ────────────────────────────

  /**
   * Validates: Requirements 5.1, 5.2, 5.5
   *
   * On the happy path the handler:
   *   (a) accepts the service role key,
   *   (b) resolves `usuarios.id` server-side from `(familiaId, filhoId)`,
   *   (c) forwards to the reused transport (`resolveTokens`,
   *       `sendToExpoPushApi`, `processTicketResults`) with
   *       `event: 'tarefa_lembrete'` and the server-resolved `payload.userId`,
   *   (d) returns `{ sent, failed, cleaned }` from the transport.
   *
   * The IDOR-positive proof here is `payload.userId === USER_UUID` — the
   * user id was never sent in the request body, only `(familiaId, filhoId)`.
   */
  it('returns 200 and forwards to the transport with tarefa_lembrete and a server-resolved userId', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    resolveTokensMock.mockResolvedValueOnce([STATIC_PII.pushToken]);
    sendToExpoPushApiMock.mockResolvedValueOnce([{ status: 'ok', id: 'ticket-1' }]);
    const expectedSummary: SendTaskReminderResponse = { sent: 1, failed: 0, cleaned: 0 };
    processTicketResultsMock.mockResolvedValueOnce(expectedSummary);

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      pendingCount: 3,
    });

    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as SendTaskReminderResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual(expectedSummary);

    // (c.1) resolveTokens was called once, with the new event identifier and
    // a payload whose `userId` was resolved server-side from the
    // `(familiaId, filhoId)` pair — never trusting any client-supplied id.
    expect(resolveTokensMock).toHaveBeenCalledTimes(1);
    const [, eventArg, familiaArg, payloadArg] = resolveTokensMock.mock.calls[0] as [
      unknown,
      string,
      string,
      { userId: string; pendingCount: number; taskTitle: string },
    ];
    expect(eventArg).toBe('tarefa_lembrete');
    expect(familiaArg).toBe(FAM_UUID);
    expect(payloadArg.userId).toBe(USER_UUID);
    expect(payloadArg.pendingCount).toBe(3);

    // (c.2) The composed Expo message uses the title from the COPY_BANK and
    // a body interpolated from `pendingCount`. We verify the structural
    // properties — the exact string is the COPY_BANK property test's job.
    expect(sendToExpoPushApiMock).toHaveBeenCalledTimes(1);
    const messages = sendToExpoPushApiMock.mock.calls[0][0] as ExpoPushMessage[];
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe(STATIC_PII.pushToken);
    expect(messages[0].title).toBe('Bora fechar o dia 🌙');
    expect(messages[0].body).toContain('3');
    expect(messages[0].data.familiaId).toBe(FAM_UUID);
    expect(messages[0].data.route).toBe('/(child)/tasks');

    // (c.3) processTicketResults receives the tickets and the original tokens.
    expect(processTicketResultsMock).toHaveBeenCalledTimes(1);
  });

  /**
   * Validates: Requirements 5.1, 5.2, 5.5
   *
   * `pendingCount === 1` exercises the singular-body branch. The reused
   * transport is still called with the `tarefa_lembrete` event and the
   * server-resolved `userId`.
   */
  it('returns 200 and uses the singular body for pendingCount === 1', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    resolveTokensMock.mockResolvedValueOnce([STATIC_PII.pushToken]);
    sendToExpoPushApiMock.mockResolvedValueOnce([{ status: 'ok', id: 'ticket-1' }]);
    processTicketResultsMock.mockResolvedValueOnce({ sent: 1, failed: 0, cleaned: 0 });

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      pendingCount: 1,
    });

    const res = await handleRequest(req, makeDepsForExamples(supabase));
    expect(res.status).toBe(200);

    const messages = sendToExpoPushApiMock.mock.calls[0][0] as ExpoPushMessage[];
    expect(messages[0].body).toBe('Você ainda tem 1 tarefa pra hoje. Bora?');

    const [, eventArg, , payloadArg] = resolveTokensMock.mock.calls[0] as [
      unknown,
      string,
      string,
      { userId: string },
    ];
    expect(eventArg).toBe('tarefa_lembrete');
    expect(payloadArg.userId).toBe(USER_UUID);
  });

  /**
   * Validates: Requirements 5.1
   *
   * When the eligible-child has zero tokens at dispatch time
   * (req 2.5 — child cleaned tokens between selection and composition),
   * the handler still returns 200 with `{ sent: 0, failed: 0, cleaned: 0 }`
   * and never calls the Expo Push API.
   */
  it('returns 200 with a zeroed summary when the resolved child has no tokens', async () => {
    const supabase = createMockSupabase({
      pii: STATIC_PII,
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      usuarioId: USER_UUID,
    });

    resolveTokensMock.mockResolvedValueOnce([]);

    const req = makeAuthedRequest({
      familiaId: FAM_UUID,
      filhoId: FILHO_UUID,
      pendingCount: 2,
    });

    const res = await handleRequest(req, makeDepsForExamples(supabase));
    const json = (await res.json()) as SendTaskReminderResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual({ sent: 0, failed: 0, cleaned: 0 });
    expect(sendToExpoPushApiMock).not.toHaveBeenCalled();
    expect(processTicketResultsMock).not.toHaveBeenCalled();
  });
});
