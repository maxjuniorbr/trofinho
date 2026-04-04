import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sendToExpoPushApi,
  processTicketResults,
  handleRequest,
  isPreferenceEnabled,
  getPreferenceKey,
  resolveRecipientUserIds,
  validateRequest,
  buildMessage,
  type SupabaseClientLike,
  type ExpoTicketResult,
  type ExpoPushMessage,
  type HandlerDeps,
  type PushNotificationResponse,
  type NotificationPrefs,
  type PushEvent,
  type EventPayload,
} from './handler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMessage(token: string): ExpoPushMessage {
  return {
    to: token,
    title: 'Test',
    body: 'Test body',
    sound: 'default',
    priority: 'high',
    channelId: 'trofinho-default',
    data: { route: '/(child)/tasks' },
  };
}

function okTicket(id = 'ticket-1'): ExpoTicketResult {
  return { status: 'ok', id };
}

function errorTicket(errorType: string, message = 'error'): ExpoTicketResult {
  return { status: 'error', message, details: { error: errorType } };
}

function createMockSupabase(overrides?: {
  deleteResult?: { error: unknown };
  selectUsuariosResult?: { data: Record<string, unknown>[] | null; error: unknown };
  selectTokensResult?: { data: Record<string, unknown>[] | null; error: unknown };
  callerFamiliaId?: string;
  authGetUserResult?: { data: { user: { id: string } | null }; error: unknown };
}) {
  const deleteMock = vi.fn().mockReturnValue({
    in: vi.fn().mockResolvedValue({ error: overrides?.deleteResult?.error ?? null }),
  });

  const callerFamiliaId = overrides?.callerFamiliaId ?? 'fam-1';

  const authMock = {
    getUser: vi.fn().mockResolvedValue(
      overrides?.authGetUserResult ?? { data: { user: { id: 'user-1' } }, error: null },
    ),
  };

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'push_tokens') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue(
            overrides?.selectTokensResult ?? { data: [{ token: 'ExponentPushToken[abc]' }], error: null },
          ),
        }),
        delete: deleteMock,
      };
    }
    // usuarios table — first .eq() is both thenable (for family validation)
    // and chainable (for resolveRecipientUserIds double .eq())
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          const secondEqResult = overrides?.selectUsuariosResult ?? { data: [{ id: 'user-1' }], error: null };
          const firstEqResult = { data: [{ familia_id: callerFamiliaId }], error: null };
          // Wrap in a real Promise so the object is a proper thenable
          // (avoids S7739: "Do not add then to an object").
          const promise = Promise.resolve(firstEqResult);
          return Object.assign(promise, {
            eq: vi.fn().mockResolvedValue(secondEqResult),
          });
        }),
        in: vi.fn().mockResolvedValue(
          overrides?.selectUsuariosResult ?? {
            data: [{ id: 'user-1', notif_prefs: { tarefaConcluida: true, resgatesSolicitado: true } }],
            error: null,
          },
        ),
      }),
    };
  });

  return { auth: authMock, from: fromMock, _deleteMock: deleteMock } as unknown as SupabaseClientLike & { _deleteMock: ReturnType<typeof vi.fn> };
}

// ─── sendToExpoPushApi ───────────────────────────────────────────────────────

describe('sendToExpoPushApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs messages to the Expo Push API and returns ticket data', async () => {
    const messages = [makeMessage('ExponentPushToken[abc]')];
    const ticketData: ExpoTicketResult[] = [okTicket()];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: ticketData }), { status: 200 }),
    );

    const result = await sendToExpoPushApi(messages);

    expect(fetch).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    expect(result).toEqual(ticketData);
  });

  it('throws when the Expo Push API returns a non-OK status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    await expect(sendToExpoPushApi([makeMessage('token')])).rejects.toThrow(
      'Expo Push API returned HTTP 500',
    );
  });
});

// ─── processTicketResults ────────────────────────────────────────────────────

describe('processTicketResults', () => {
  it('counts sent and failed tickets correctly', async () => {
    const supabase = createMockSupabase();
    const tickets: ExpoTicketResult[] = [
      okTicket('t1'),
      okTicket('t2'),
      errorTicket('MessageTooBig'),
    ];
    const tokens = ['token-a', 'token-b', 'token-c'];

    const result = await processTicketResults(supabase, tickets, tokens);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.cleaned).toBe(0);
  });

  it('deletes tokens with DeviceNotRegistered error', async () => {
    const supabase = createMockSupabase();
    const tickets: ExpoTicketResult[] = [
      okTicket(),
      errorTicket('DeviceNotRegistered'),
    ];
    const tokens = ['token-ok', 'token-dead'];

    const result = await processTicketResults(supabase, tickets, tokens);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.cleaned).toBe(1);
    expect(supabase._deleteMock).toHaveBeenCalled();
  });

  it('retains tokens with InvalidCredentials error', async () => {
    const supabase = createMockSupabase();
    const tickets: ExpoTicketResult[] = [errorTicket('InvalidCredentials')];
    const tokens = ['token-keep'];

    const result = await processTicketResults(supabase, tickets, tokens);

    expect(result.failed).toBe(1);
    expect(result.cleaned).toBe(0);
    expect(supabase._deleteMock).not.toHaveBeenCalled();
  });

  it('retains tokens with MessageTooBig error', async () => {
    const supabase = createMockSupabase();
    const tickets: ExpoTicketResult[] = [errorTicket('MessageTooBig')];
    const tokens = ['token-keep'];

    const result = await processTicketResults(supabase, tickets, tokens);

    expect(result.failed).toBe(1);
    expect(result.cleaned).toBe(0);
    expect(supabase._deleteMock).not.toHaveBeenCalled();
  });

  it('handles all-success tickets', async () => {
    const supabase = createMockSupabase();
    const tickets: ExpoTicketResult[] = [okTicket('a'), okTicket('b'), okTicket('c')];
    const tokens = ['t1', 't2', 't3'];

    const result = await processTicketResults(supabase, tickets, tokens);

    expect(result).toEqual({ sent: 3, failed: 0, cleaned: 0 });
  });

  it('handles empty ticket list', async () => {
    const supabase = createMockSupabase();

    const result = await processTicketResults(supabase, [], []);

    expect(result).toEqual({ sent: 0, failed: 0, cleaned: 0 });
  });

  it('sets cleaned to 0 when delete fails', async () => {
    const supabase = createMockSupabase({
      deleteResult: { error: { message: 'DB error' } },
    });
    const tickets: ExpoTicketResult[] = [errorTicket('DeviceNotRegistered')];
    const tokens = ['token-dead'];

    const result = await processTicketResults(supabase, tickets, tokens);

    expect(result.failed).toBe(1);
    expect(result.cleaned).toBe(0);
  });

  it('deletes multiple DeviceNotRegistered tokens in one batch', async () => {
    const supabase = createMockSupabase();
    const tickets: ExpoTicketResult[] = [
      errorTicket('DeviceNotRegistered'),
      okTicket(),
      errorTicket('DeviceNotRegistered'),
    ];
    const tokens = ['dead-1', 'alive', 'dead-2'];

    const result = await processTicketResults(supabase, tickets, tokens);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.cleaned).toBe(2);
  });
});

// ─── handleRequest (integration: Expo API call + response handling) ──────────

describe('handleRequest — Expo Push API integration', () => {
  const SERVICE_KEY = 'test-service-role-key';
  const FAKE_JWT = 'valid-test-token';

  const makeDeps = (supabase: SupabaseClientLike): HandlerDeps => ({
    getServiceRoleKey: () => SERVICE_KEY,
    getSupabaseUrl: () => 'https://test.supabase.co',
    createSupabaseClient: () => supabase,
  });

  const makeReq = (body: Record<string, unknown>): Request =>
    new Request('https://localhost/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FAKE_JWT}`,
      },
      body: JSON.stringify(body),
    }) as unknown as Request;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends messages to Expo and returns { sent, failed, cleaned } summary', async () => {
    const supabase = createMockSupabase();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: [okTicket()] }),
        { status: 200 },
      ),
    );

    const req = makeReq({
      event: 'tarefa_aprovada',
      familiaId: 'fam-1',
      payload: { userId: 'user-1', taskTitle: 'Lavar louça' },
    });

    const res = await handleRequest(req, makeDeps(supabase));
    const json = await res.json() as PushNotificationResponse;

    expect(res.status).toBe(200);
    expect(json.sent).toBe(1);
    expect(json.failed).toBe(0);
    expect(json.cleaned).toBe(0);
  });

  it('cleans DeviceNotRegistered tokens and returns accurate counts', async () => {
    const supabase = createMockSupabase({
      selectTokensResult: {
        data: [{ token: 'token-ok' }, { token: 'token-dead' }],
        error: null,
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [okTicket(), errorTicket('DeviceNotRegistered')],
        }),
        { status: 200 },
      ),
    );

    const req = makeReq({
      event: 'tarefa_aprovada',
      familiaId: 'fam-1',
      payload: { userId: 'user-1', taskTitle: 'Lavar louça' },
    });

    const res = await handleRequest(req, makeDeps(supabase));
    const json = await res.json() as PushNotificationResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual({ sent: 1, failed: 1, cleaned: 1 });
  });

  it('returns { sent: 0, failed: 0, cleaned: 0 } when no tokens found', async () => {
    const supabase = createMockSupabase({
      selectTokensResult: { data: [], error: null },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const req = makeReq({
      event: 'tarefa_aprovada',
      familiaId: 'fam-1',
      payload: { userId: 'user-1', taskTitle: 'Test' },
    });

    const res = await handleRequest(req, makeDeps(supabase));
    const json = await res.json() as PushNotificationResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual({ sent: 0, failed: 0, cleaned: 0 });
    // fetch should NOT have been called since there are no tokens
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns HTTP 500 when Expo Push API is unreachable', async () => {
    const supabase = createMockSupabase();

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const req = makeReq({
      event: 'tarefa_aprovada',
      familiaId: 'fam-1',
      payload: { userId: 'user-1', taskTitle: 'Test' },
    });

    const res = await handleRequest(req, makeDeps(supabase));
    const json = await res.json() as { error: string };

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal error');
  });

  it('returns HTTP 401 when auth.getUser rejects the token (forged/expired JWT)', async () => {
    const supabase = createMockSupabase({
      authGetUserResult: { data: { user: null }, error: { message: 'invalid token' } },
    });

    const req = makeReq({
      event: 'tarefa_aprovada',
      familiaId: 'fam-1',
      payload: { userId: 'user-1', taskTitle: 'Test' },
    });

    const res = await handleRequest(req, makeDeps(supabase));
    const json = await res.json() as { error: string };

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns HTTP 403 when caller familiaId does not match request familiaId', async () => {
    const supabase = createMockSupabase({ callerFamiliaId: 'fam-other' });

    const req = makeReq({
      event: 'tarefa_aprovada',
      familiaId: 'fam-1',
      payload: { userId: 'user-1', taskTitle: 'Test' },
    });

    const res = await handleRequest(req, makeDeps(supabase));
    const json = await res.json() as { error: string };

    expect(res.status).toBe(403);
    expect(json.error).toBe('Forbidden');
  });
});

// ─── Property Tests ──────────────────────────────────────────────────────────

import fc from 'fast-check';

/**
 * Feature: push-notifications, Property 1: Preference defaults resolve to all-enabled
 * Validates: Requirements 1.2
 *
 * For any user whose notif_prefs is null, undefined, or the default JSONB value,
 * resolving each preference key SHALL return true.
 */
describe('Property 1: Preference defaults resolve to all-enabled', () => {
  const PREF_KEYS: (keyof NotificationPrefs)[] = [
    'tarefasPendentes',
    'tarefaAprovada',
    'tarefaRejeitada',
    'tarefaConcluida',
    'resgatesSolicitado',
    'resgateConfirmado',
  ];

  const prefKeyArb = fc.constantFrom<keyof NotificationPrefs>(...PREF_KEYS);

  it('returns true for null notif_prefs and any preference key', () => {
    fc.assert(
      fc.property(prefKeyArb, (key) => {
        expect(isPreferenceEnabled(null, key)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('returns true for undefined notif_prefs and any preference key', () => {
    fc.assert(
      fc.property(prefKeyArb, (key) => {
        expect(isPreferenceEnabled(undefined, key)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('returns true for the default prefs object and any preference key', () => {
    const defaultPrefs: NotificationPrefs = {
      tarefasPendentes: true,
      tarefaAprovada: true,
      tarefaRejeitada: true,
      tarefaConcluida: true,
      resgatesSolicitado: true,
      resgateConfirmado: true,
    };

    fc.assert(
      fc.property(prefKeyArb, (key) => {
        expect(isPreferenceEnabled(defaultPrefs, key)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('returns true for prefs with undefined values for specific keys', () => {
    const partialPrefsArb = fc.record(
      {
        tarefasPendentes: fc.constant(undefined),
        tarefaAprovada: fc.constant(undefined),
        tarefaRejeitada: fc.constant(undefined),
        tarefaConcluida: fc.constant(undefined),
        resgatesSolicitado: fc.constant(undefined),
        resgateConfirmado: fc.constant(undefined),
      },
      { requiredKeys: [] },
    ) as fc.Arbitrary<NotificationPrefs>;

    fc.assert(
      fc.property(partialPrefsArb, prefKeyArb, (prefs, key) => {
        expect(isPreferenceEnabled(prefs, key)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: push-notifications, Property 2: Disabled preference prevents ticket generation
 * Validates: Requirements 1.3, 3.2, 4.2, 5.2, 6.2, 7.2
 *
 * For any event type and for any user whose corresponding preference key is
 * set to false, the system SHALL NOT produce a push ticket for that user.
 * Conversely, if the preference key is true, a ticket SHALL be produced
 * (assuming valid tokens exist).
 */
describe('Property 2: Disabled preference prevents ticket generation', () => {
  const PREF_KEYS: (keyof NotificationPrefs)[] = [
    'tarefasPendentes',
    'tarefaAprovada',
    'tarefaRejeitada',
    'tarefaConcluida',
    'resgatesSolicitado',
    'resgateConfirmado',
  ];

  const prefKeyArb = fc.constantFrom<keyof NotificationPrefs>(...PREF_KEYS);

  it('returns false when the preference key is explicitly set to false', () => {
    fc.assert(
      fc.property(prefKeyArb, (key) => {
        const prefs: NotificationPrefs = {
          tarefasPendentes: true,
          tarefaAprovada: true,
          tarefaRejeitada: true,
          tarefaConcluida: true,
          resgatesSolicitado: true,
          resgateConfirmado: true,
          [key]: false,
        };
        expect(isPreferenceEnabled(prefs, key)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('returns true when the preference key is explicitly set to true', () => {
    fc.assert(
      fc.property(prefKeyArb, (key) => {
        const prefs: NotificationPrefs = {
          tarefasPendentes: false,
          tarefaAprovada: false,
          tarefaRejeitada: false,
          tarefaConcluida: false,
          resgatesSolicitado: false,
          resgateConfirmado: false,
          [key]: true,
        };
        expect(isPreferenceEnabled(prefs, key)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('getPreferenceKey maps each event to the correct preference key', () => {
    const EVENT_TO_PREF: Record<PushEvent, keyof NotificationPrefs> = {
      tarefa_aprovada: 'tarefaAprovada',
      tarefa_rejeitada: 'tarefaRejeitada',
      tarefa_criada: 'tarefasPendentes',
      tarefa_concluida: 'tarefaConcluida',
      resgate_solicitado: 'resgatesSolicitado',
      resgate_confirmado: 'resgateConfirmado',
      resgate_cancelado: 'resgateCancelado',
    };

    const eventArb = fc.constantFrom<PushEvent>(
      'tarefa_aprovada',
      'tarefa_rejeitada',
      'tarefa_criada',
      'tarefa_concluida',
      'resgate_solicitado',
      'resgate_confirmado',
      'resgate_cancelado',
    );

    fc.assert(
      fc.property(eventArb, (event) => {
        expect(getPreferenceKey(event)).toBe(EVENT_TO_PREF[event]);
      }),
      { numRuns: 100 },
    );
  });

  it('disabled preference for a given event blocks notification', () => {
    const eventArb = fc.constantFrom<PushEvent>(
      'tarefa_aprovada',
      'tarefa_rejeitada',
      'tarefa_concluida',
      'resgate_solicitado',
      'resgate_confirmado',
    );

    fc.assert(
      fc.property(eventArb, (event) => {
        const prefKey = getPreferenceKey(event);
        const prefs: NotificationPrefs = {
          tarefasPendentes: true,
          tarefaAprovada: true,
          tarefaRejeitada: true,
          tarefaConcluida: true,
          resgatesSolicitado: true,
          resgateConfirmado: true,
          [prefKey]: false,
        };
        expect(isPreferenceEnabled(prefs, prefKey)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('enabled preference for a given event allows notification', () => {
    const eventArb = fc.constantFrom<PushEvent>(
      'tarefa_aprovada',
      'tarefa_rejeitada',
      'tarefa_concluida',
      'resgate_solicitado',
      'resgate_confirmado',
    );

    fc.assert(
      fc.property(eventArb, (event) => {
        const prefKey = getPreferenceKey(event);
        const prefs: NotificationPrefs = {
          tarefasPendentes: false,
          tarefaAprovada: false,
          tarefaRejeitada: false,
          tarefaConcluida: false,
          resgatesSolicitado: false,
          resgateConfirmado: false,
          [prefKey]: true,
        };
        expect(isPreferenceEnabled(prefs, prefKey)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: push-notifications, Property 4: Request body validation
 * Validates: Requirements 2.1
 *
 * For any JSON body, the Edge Function request validator SHALL accept it if and
 * only if it contains a valid `event` string (one of the five known events), a
 * valid `familiaId` (non-empty string), and a `payload` object. All other
 * bodies SHALL be rejected.
 */
describe('Property 4: Request body validation', () => {
  const VALID_EVENTS = [
    'tarefa_aprovada',
    'tarefa_rejeitada',
    'tarefa_criada',
    'resgate_confirmado',
    'resgate_solicitado',
    'resgate_cancelado',
    'tarefa_concluida',
  ] as const;

  const validEventArb = fc.constantFrom(...VALID_EVENTS);
  const nonEmptyStringArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);
  const payloadObjectArb = fc.dictionary(fc.string(), fc.string());

  // 1. Valid bodies should always be accepted
  it('accepts any body with a valid event, non-empty familiaId, and payload object', () => {
    fc.assert(
      fc.property(validEventArb, nonEmptyStringArb, payloadObjectArb, (event, familiaId, payload) => {
        const result = validateRequest({ event, familiaId, payload });
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.event).toBe(event);
          expect(result.data.familiaId).toBe(familiaId);
        }
      }),
      { numRuns: 100 },
    );
  });

  // 2. Invalid event strings should always be rejected
  it('rejects any body with an invalid event string', () => {
    const invalidEventArb = fc.string().filter((s) => !(VALID_EVENTS as readonly string[]).includes(s));

    fc.assert(
      fc.property(invalidEventArb, nonEmptyStringArb, payloadObjectArb, (event, familiaId, payload) => {
        const result = validateRequest({ event, familiaId, payload });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // 3. Missing/empty/non-string familiaId should always be rejected
  it('rejects any body with missing, empty, or non-string familiaId', () => {
    const badFamiliaIdArb = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.constant(''),
      fc.constant('   '),
      fc.integer(),
      fc.boolean(),
      fc.constant([]),
    );

    fc.assert(
      fc.property(validEventArb, badFamiliaIdArb, payloadObjectArb, (event, familiaId, payload) => {
        const result = validateRequest({ event, familiaId, payload });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // 4. Non-object payload (null, array, string, number) should always be rejected
  it('rejects any body with a non-object payload', () => {
    const badPayloadArb = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.array(fc.anything()),
    );

    fc.assert(
      fc.property(validEventArb, nonEmptyStringArb, badPayloadArb, (event, familiaId, payload) => {
        const result = validateRequest({ event, familiaId, payload });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // 5. Non-object body (null, string, number, array) should always be rejected
  it('rejects any non-object body', () => {
    const nonObjectBodyArb = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.array(fc.anything()),
    );

    fc.assert(
      fc.property(nonObjectBodyArb, (body) => {
        const result = validateRequest(body);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: push-notifications, Property 5: Recipient resolution by event type
 * Validates: Requirements 2.3, 6.2, 7.2
 *
 * For any event type and family configuration, child-targeted events
 * (tarefa_aprovada, tarefa_rejeitada, resgate_confirmado) SHALL resolve to
 * exactly the single userId from the payload, and admin-targeted events
 * (resgate_solicitado, tarefa_concluida) SHALL resolve to all users with
 * papel = 'admin' in the given family.
 */
describe('Property 5: Recipient resolution by event type', () => {
  const childEventArb = fc.constantFrom<PushEvent>(
    'tarefa_aprovada',
    'tarefa_rejeitada',
    'resgate_confirmado',
  );

  const adminEventArb = fc.constantFrom<PushEvent>(
    'resgate_solicitado',
    'tarefa_concluida',
  );

  const uuidArb = fc.uuid();
  const familiaIdArb = fc.uuid();

  it('child-targeted events resolve to exactly the userId from payload', async () => {
    await fc.assert(
      fc.asyncProperty(childEventArb, uuidArb, familiaIdArb, async (event, userId, familiaId) => {
        const supabase = createMockSupabase();
        const payload = { userId, taskTitle: 'any-task', prizeName: 'any-prize', childName: 'any-child' };

        const result = await resolveRecipientUserIds(supabase, event, familiaId, payload);

        expect(result).toEqual([userId]);
      }),
      { numRuns: 100 },
    );
  });

  it('admin-targeted events query the DB and return all admin user IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminEventArb,
        familiaIdArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        async (event, familiaId, adminIds) => {
          const adminRows = adminIds.map((id) => ({ id }));
          const supabase = createMockSupabase({
            selectUsuariosResult: { data: adminRows, error: null },
          });
          const payload = { childName: 'any-child', taskTitle: 'any-task', prizeName: 'any-prize' };

          const result = await resolveRecipientUserIds(supabase, event, familiaId, payload);

          expect(result).toEqual(adminIds);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: push-notifications, Property 6: Message template correctness
 * Validates: Requirements 2.4, 3.3, 3.4, 4.3, 4.4, 5.3, 5.4, 6.3, 6.4, 7.3, 7.4
 *
 * For any event type and for any valid payload, the constructed Expo push
 * message SHALL contain: (a) a title matching the event's template, (b) a body
 * that includes all interpolated values from the payload, (c) sound: 'default',
 * and (d) a data.route matching the event's target route.
 */
describe('Property 6: Message template correctness', () => {
  const EXPECTED_TEMPLATES: Record<PushEvent, { title: string; route: string }> = {
    tarefa_aprovada: { title: 'Tarefa aprovada ✅', route: '/(child)/tasks' },
    tarefa_rejeitada: { title: 'Tarefa rejeitada', route: '/(child)/tasks' },
    tarefa_criada: { title: 'Nova tarefa 📝', route: '/(child)/tasks' },
    resgate_confirmado: { title: 'Resgate confirmado 🎉', route: '/(child)/redemptions' },
    resgate_cancelado: { title: 'Resgate cancelado', route: '/(child)/redemptions' },
    resgate_solicitado: { title: 'Resgate solicitado', route: '/(admin)/redemptions' },
    tarefa_concluida: { title: 'Tarefa concluída', route: '/(admin)/tasks' },
  };

  // Non-empty string generator for interpolated values
  const nonEmptyStrArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

  // Generator that produces a valid (event, payload) pair with the right shape
  const eventPayloadArb: fc.Arbitrary<{ event: PushEvent; payload: EventPayload; interpolatedValues: string[] }> =
    fc.oneof(
      // tarefa_aprovada: { userId, taskTitle }
      fc.record({ userId: fc.uuid(), taskTitle: nonEmptyStrArb }).map((p) => ({
        event: 'tarefa_aprovada' as PushEvent,
        payload: p as EventPayload,
        interpolatedValues: [p.taskTitle],
      })),
      // tarefa_rejeitada: { userId, taskTitle }
      fc.record({ userId: fc.uuid(), taskTitle: nonEmptyStrArb }).map((p) => ({
        event: 'tarefa_rejeitada' as PushEvent,
        payload: p as EventPayload,
        interpolatedValues: [p.taskTitle],
      })),
      // resgate_confirmado: { userId, prizeName }
      fc.record({ userId: fc.uuid(), prizeName: nonEmptyStrArb }).map((p) => ({
        event: 'resgate_confirmado' as PushEvent,
        payload: p as EventPayload,
        interpolatedValues: [p.prizeName],
      })),
      // resgate_cancelado: { userId, prizeName }
      fc.record({ userId: fc.uuid(), prizeName: nonEmptyStrArb }).map((p) => ({
        event: 'resgate_cancelado' as PushEvent,
        payload: p as EventPayload,
        interpolatedValues: [p.prizeName],
      })),
      // resgate_solicitado: { childName, prizeName }
      fc.record({ childName: nonEmptyStrArb, prizeName: nonEmptyStrArb }).map((p) => ({
        event: 'resgate_solicitado' as PushEvent,
        payload: p as EventPayload,
        interpolatedValues: [p.childName, p.prizeName],
      })),
      // tarefa_criada: { filhoIds, taskTitle }
      fc.record({ filhoIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), taskTitle: nonEmptyStrArb }).map((p) => ({
        event: 'tarefa_criada' as PushEvent,
        payload: p as EventPayload,
        interpolatedValues: [p.taskTitle],
      })),
      // tarefa_concluida: { childName, taskTitle }
      fc.record({ childName: nonEmptyStrArb, taskTitle: nonEmptyStrArb }).map((p) => ({
        event: 'tarefa_concluida' as PushEvent,
        payload: p as EventPayload,
        interpolatedValues: [p.childName, p.taskTitle],
      })),
    );

  it('sound is always "default" for any event and valid payload', () => {
    fc.assert(
      fc.property(eventPayloadArb, ({ event, payload }) => {
        const msg = buildMessage(event, payload);
        expect(msg.sound).toBe('default');
      }),
      { numRuns: 100 },
    );
  });

  it('title matches the expected template title for any event', () => {
    fc.assert(
      fc.property(eventPayloadArb, ({ event, payload }) => {
        const msg = buildMessage(event, payload);
        expect(msg.title).toBe(EXPECTED_TEMPLATES[event].title);
      }),
      { numRuns: 100 },
    );
  });

  it('body contains all interpolated values from the payload', () => {
    fc.assert(
      fc.property(eventPayloadArb, ({ event, payload, interpolatedValues }) => {
        const msg = buildMessage(event, payload);
        for (const value of interpolatedValues) {
          expect(msg.body).toContain(value);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('data.route matches the expected route for any event', () => {
    fc.assert(
      fc.property(eventPayloadArb, ({ event, payload }) => {
        const msg = buildMessage(event, payload);
        expect(msg.data.route).toBe(EXPECTED_TEMPLATES[event].route);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: push-notifications, Property 7: Response summary accuracy
 * Validates: Requirements 2.6, 2.7
 *
 * For any list of Expo Push API ticket results (mix of successes and errors),
 * the Edge Function response SHALL report `sent` equal to the count of
 * successful tickets and `failed` equal to the count of error tickets,
 * and `sent + failed` SHALL equal the total number of tickets submitted.
 */
describe('Property 7: Response summary accuracy', () => {
  // Arbitrary for a successful ticket
  const okTicketArb: fc.Arbitrary<ExpoTicketResult> = fc.uuid().map((id) => ({
    status: 'ok' as const,
    id,
  }));

  // Arbitrary for an error ticket (non-DeviceNotRegistered to avoid cleanup side effects)
  const errorTicketArb: fc.Arbitrary<ExpoTicketResult> = fc
    .record({
      message: fc.string({ minLength: 1 }),
      errorType: fc.constantFrom('InvalidCredentials', 'MessageTooBig', 'MessageRateExceeded'),
    })
    .map(({ message, errorType }) => ({
      status: 'error' as const,
      message,
      details: { error: errorType },
    }));

  // Arbitrary for a mixed array of tickets
  const ticketArb: fc.Arbitrary<ExpoTicketResult> = fc.oneof(okTicketArb, errorTicketArb);
  const ticketsArb = fc.array(ticketArb, { minLength: 0, maxLength: 30 });

  // Generate matching token arrays (same length as tickets)
  const ticketsWithTokensArb = ticketsArb.chain((tickets) => {
    const tokensArb = fc.array(fc.uuid(), {
      minLength: tickets.length,
      maxLength: tickets.length,
    });
    return tokensArb.map((tokens) => ({ tickets, tokens }));
  });

  it('sent equals the count of ok tickets', async () => {
    await fc.assert(
      fc.asyncProperty(ticketsWithTokensArb, async ({ tickets, tokens }) => {
        const supabase = createMockSupabase();
        const result = await processTicketResults(supabase, tickets, tokens);
        const expectedSent = tickets.filter((t) => t.status === 'ok').length;
        expect(result.sent).toBe(expectedSent);
      }),
      { numRuns: 100 },
    );
  });

  it('failed equals the count of error tickets', async () => {
    await fc.assert(
      fc.asyncProperty(ticketsWithTokensArb, async ({ tickets, tokens }) => {
        const supabase = createMockSupabase();
        const result = await processTicketResults(supabase, tickets, tokens);
        const expectedFailed = tickets.filter((t) => t.status === 'error').length;
        expect(result.failed).toBe(expectedFailed);
      }),
      { numRuns: 100 },
    );
  });

  it('sent + failed equals the total number of tickets', async () => {
    await fc.assert(
      fc.asyncProperty(ticketsWithTokensArb, async ({ tickets, tokens }) => {
        const supabase = createMockSupabase();
        const result = await processTicketResults(supabase, tickets, tokens);
        expect(result.sent + result.failed).toBe(tickets.length);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: push-notifications, Property 9: Token cleanup on DeviceNotRegistered only
 * Validates: Requirements 9.1, 9.2
 *
 * For any set of Expo Push API ticket results, a token SHALL be deleted from
 * `push_tokens` if and only if its ticket error detail is `DeviceNotRegistered`.
 * Tokens with other error types (`InvalidCredentials`, `MessageTooBig`, etc.)
 * SHALL be retained.
 */
describe('Property 9: Token cleanup on DeviceNotRegistered only', () => {
  // Arbitrary for a successful ticket
  const okTicketArb: fc.Arbitrary<ExpoTicketResult> = fc.uuid().map((id) => ({
    status: 'ok' as const,
    id,
  }));

  // Arbitrary for a DeviceNotRegistered error ticket
  const dnrTicketArb: fc.Arbitrary<ExpoTicketResult> = fc.string({ minLength: 1 }).map((msg) => ({
    status: 'error' as const,
    message: msg,
    details: { error: 'DeviceNotRegistered' },
  }));

  // Arbitrary for a non-DeviceNotRegistered error ticket
  const otherErrorTicketArb: fc.Arbitrary<ExpoTicketResult> = fc
    .record({
      message: fc.string({ minLength: 1 }),
      errorType: fc.constantFrom('InvalidCredentials', 'MessageTooBig', 'MessageRateExceeded'),
    })
    .map(({ message, errorType }) => ({
      status: 'error' as const,
      message,
      details: { error: errorType },
    }));

  // Helper: generate tickets + matching tokens of the same length
  const withMatchingTokens = (ticketsArb: fc.Arbitrary<ExpoTicketResult[]>) =>
    ticketsArb.chain((tickets) =>
      fc.array(fc.uuid(), { minLength: tickets.length, maxLength: tickets.length })
        .map((tokens) => ({ tickets, tokens })),
    );

  it('all DeviceNotRegistered errors → cleaned equals the count of DNR errors', async () => {
    const allDnrArb = withMatchingTokens(
      fc.array(fc.oneof(okTicketArb, dnrTicketArb), { minLength: 1, maxLength: 20 }),
    );

    await fc.assert(
      fc.asyncProperty(allDnrArb, async ({ tickets, tokens }) => {
        const supabase = createMockSupabase();
        const result = await processTicketResults(supabase, tickets, tokens);

        const dnrCount = tickets.filter(
          (t) => t.status === 'error' && t.details?.error === 'DeviceNotRegistered',
        ).length;

        expect(result.cleaned).toBe(dnrCount);
      }),
      { numRuns: 100 },
    );
  });

  it('no DeviceNotRegistered errors → cleaned is 0 and delete is never called', async () => {
    const noDnrArb = withMatchingTokens(
      fc.array(fc.oneof(okTicketArb, otherErrorTicketArb), { minLength: 1, maxLength: 20 }),
    );

    await fc.assert(
      fc.asyncProperty(noDnrArb, async ({ tickets, tokens }) => {
        const supabase = createMockSupabase();
        const result = await processTicketResults(supabase, tickets, tokens);

        expect(result.cleaned).toBe(0);
        expect(supabase._deleteMock).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  it('mixed tickets → cleaned equals exactly the count of DeviceNotRegistered errors', async () => {
    const mixedArb = withMatchingTokens(
      fc.array(fc.oneof(okTicketArb, dnrTicketArb, otherErrorTicketArb), { minLength: 1, maxLength: 20 }),
    );

    await fc.assert(
      fc.asyncProperty(mixedArb, async ({ tickets, tokens }) => {
        const supabase = createMockSupabase();
        const result = await processTicketResults(supabase, tickets, tokens);

        const dnrCount = tickets.filter(
          (t) => t.status === 'error' && t.details?.error === 'DeviceNotRegistered',
        ).length;

        expect(result.cleaned).toBe(dnrCount);
      }),
      { numRuns: 100 },
    );
  });

  it('only DeviceNotRegistered tokens are passed to the delete call', async () => {
    const mixedArb = withMatchingTokens(
      fc.array(fc.oneof(okTicketArb, dnrTicketArb, otherErrorTicketArb), { minLength: 1, maxLength: 20 }),
    );

    await fc.assert(
      fc.asyncProperty(mixedArb, async ({ tickets, tokens }) => {
        const supabase = createMockSupabase();
        await processTicketResults(supabase, tickets, tokens);

        const expectedDeletedTokens = tickets
          .map((t, i) => ({ ticket: t, token: tokens[i] }))
          .filter((x) => x.ticket.status === 'error' && x.ticket.details?.error === 'DeviceNotRegistered')
          .map((x) => x.token);

        if (expectedDeletedTokens.length === 0) {
          expect(supabase._deleteMock).not.toHaveBeenCalled();
        } else {
          const inMock = supabase._deleteMock.mock.results[0]?.value?.in;
          expect(inMock).toHaveBeenCalledWith('token', expectedDeletedTokens);
        }
      }),
      { numRuns: 100 },
    );
  });
});
