import { describe, expect, it, vi } from 'vitest';
import {
  handleRequest,
  validateRequest,
  type HandlerDeps,
  type SupabaseClientLike,
} from './handler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_INVITE = {
  id: 'invite-1',
  familia_id: 'familia-1',
  nome_filho: 'Lia',
  aceito_por: null,
  expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
};

const EXPIRED_INVITE = {
  ...VALID_INVITE,
  expira_em: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
};

const USED_INVITE = {
  ...VALID_INVITE,
  aceito_por: 'other-user-id',
};

/**
 * Creates a mock Supabase client with chainable query builder methods.
 *
 * The `fromBehavior` map lets each test define per-table responses.
 * Each entry maps a table name to a function that receives the chain
 * context and returns `{ data, error }`.
 */
function createMockSupabase(overrides?: {
  authGetUserResult?: { data: { user: { id: string } | null }; error: unknown };
  updateUserByIdResult?: {
    data: { user: unknown } | null;
    error: { message: string } | null;
  };
  fromBehavior?: Record<
    string,
    (ctx: { method: string; args: unknown[] }) => { data: unknown; error: unknown }
  >;
}): SupabaseClientLike {
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue(
          overrides?.authGetUserResult ?? { data: { user: { id: 'child-user-1' } }, error: null },
        ),
      admin: {
        updateUserById: vi
          .fn()
          .mockResolvedValue(
            overrides?.updateUserByIdResult ?? { data: { user: {} }, error: null },
          ),
      },
    },
    from: vi.fn().mockImplementation((table: string) => {
      // Build a chainable query builder that records calls and resolves
      // using the per-table behavior when a terminal method is called.
      const chain: Record<string, unknown> = {};
      let terminalMethod = '';
      const terminalArgs: unknown[] = [];

      const resolve = () => {
        const behavior = overrides?.fromBehavior?.[table];
        if (behavior) {
          return Promise.resolve(behavior({ method: terminalMethod, args: terminalArgs }));
        }
        // Default: return success with empty data
        return Promise.resolve({ data: null, error: null });
      };

      // Terminal methods
      const terminals = ['single', 'maybeSingle'];
      // Chainable methods
      const chainable = ['select', 'eq', 'insert', 'update', 'delete'];

      // .eq() called as a terminal (e.g. rollback paths) must also resolve.
      // We override 'eq' below to behave as both chainable and terminal.

      for (const m of terminals) {
        chain[m] = vi.fn().mockImplementation((...args: unknown[]) => {
          terminalMethod = m;
          terminalArgs.push(...args);
          return resolve();
        });
      }

      for (const m of chainable) {
        chain[m] = vi.fn().mockReturnValue(chain);
      }

      // Make the chain awaitable so that calls without an explicit terminal
      // (e.g. `await client.from('x').update(...).eq('id', ...)`) resolve via
      // the per-table behavior. Without this, those awaits would yield the
      // chain object itself and destructuring `error` would silently undefined.
      chain.then = (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => resolve().then(onFulfilled, onRejected);

      return chain;
    }),
  };
}

function defaultFromBehavior(): Record<
  string,
  (ctx: { method: string; args: unknown[] }) => { data: unknown; error: unknown }
> {
  return {
    convites_filho: () => ({ data: VALID_INVITE, error: null }),
    filhos: () => ({ data: { id: 'filho-1', usuario_id: null }, error: null }),
    usuarios: () => ({ data: null, error: null }),
    familias: () => ({ data: { nome: 'Família Silva' }, error: null }),
  };
}

function createDeps(supabase?: SupabaseClientLike): HandlerDeps {
  const mock = supabase ?? createMockSupabase({ fromBehavior: defaultFromBehavior() });
  return {
    getServiceRoleKey: () => 'service-role-key',
    getSupabaseUrl: () => 'https://test.supabase.co',
    createSupabaseClient: vi.fn().mockReturnValue(mock),
  };
}

function makeRequest(
  body: unknown,
  options?: { method?: string; token?: string; contentLength?: number },
): Request {
  const method = options?.method ?? 'POST';
  const token = options?.token ?? 'valid-jwt-token';
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options?.contentLength !== undefined) {
    headers['content-length'] = String(options.contentLength);
  }
  const requestInit = method === 'GET' ? { method, headers } : { method, headers, body: bodyStr };
  return new Request('https://test.supabase.co/functions/v1/vincular-filho', {
    ...requestInit,
  }) as unknown as Request;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('vincular-filho handler', () => {
  describe('validateRequest', () => {
    it('accepts a valid request body', () => {
      const result = validateRequest({
        invite_code: 'ABC123',
        date_of_birth: '2010-05-15',
      });
      expect(result).toEqual({
        valid: true,
        data: { invite_code: 'ABC123', date_of_birth: '2010-05-15' },
      });
    });

    it('uppercases the invite code', () => {
      const result = validateRequest({
        invite_code: 'abc123',
        date_of_birth: '2010-05-15',
      });
      expect(result).toEqual({
        valid: true,
        data: { invite_code: 'ABC123', date_of_birth: '2010-05-15' },
      });
    });

    it.each([
      [null, 'Request body must be a JSON object'],
      [{ date_of_birth: '2010-05-15' }, 'invite_code must be a 6-character alphanumeric string'],
      [
        { invite_code: '', date_of_birth: '2010-05-15' },
        'invite_code must be a 6-character alphanumeric string',
      ],
      [
        { invite_code: 'AB', date_of_birth: '2010-05-15' },
        'invite_code must be a 6-character alphanumeric string',
      ],
      [
        { invite_code: 'ABC12!', date_of_birth: '2010-05-15' },
        'invite_code must be a 6-character alphanumeric string',
      ],
      [{ invite_code: 'ABC123' }, 'date_of_birth must be a valid ISO 8601 date (YYYY-MM-DD)'],
      [
        { invite_code: 'ABC123', date_of_birth: '' },
        'date_of_birth must be a valid ISO 8601 date (YYYY-MM-DD)',
      ],
      [
        { invite_code: 'ABC123', date_of_birth: '15/05/2010' },
        'date_of_birth must be a valid ISO 8601 date (YYYY-MM-DD)',
      ],
      [
        { invite_code: 'ABC123', date_of_birth: '2010-13-01' },
        'date_of_birth must be a valid ISO 8601 date (YYYY-MM-DD)',
      ],
    ])('rejects invalid body %j with "%s"', (body, expectedError) => {
      const result = validateRequest(body);
      expect(result).toEqual({ valid: false, error: expectedError });
    });
  });

  describe('handleRequest', () => {
    it('rejects non-POST methods', async () => {
      const req = new Request('https://test.supabase.co/functions/v1/vincular-filho', {
        method: 'GET',
      }) as unknown as Request;
      const res = await handleRequest(req, createDeps());
      expect(res.status).toBe(405);
    });

    it('rejects missing authorization header', async () => {
      const req = new Request('https://test.supabase.co/functions/v1/vincular-filho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
      }) as unknown as Request;
      const res = await handleRequest(req, createDeps());
      expect(res.status).toBe(401);
    });

    it('rejects when service role key is missing', async () => {
      const deps: HandlerDeps = {
        getServiceRoleKey: () => undefined,
        getSupabaseUrl: () => 'https://test.supabase.co',
        createSupabaseClient: vi.fn(),
      };
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        deps,
      );
      expect(res.status).toBe(500);
    });

    it('rejects oversized payloads', async () => {
      const res = await handleRequest(
        makeRequest(
          { invite_code: 'ABC123', date_of_birth: '2010-05-15' },
          { contentLength: 5000 },
        ),
        createDeps(),
      );
      expect(res.status).toBe(413);
    });

    it('rejects malformed JSON', async () => {
      const req = new Request('https://test.supabase.co/functions/v1/vincular-filho', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt',
        },
        body: 'not-json{',
      }) as unknown as Request;
      const deps: HandlerDeps = {
        getServiceRoleKey: () => 'srk',
        getSupabaseUrl: () => 'https://test.supabase.co',
        createSupabaseClient: vi.fn().mockReturnValue(createMockSupabase()),
      };
      const res = await handleRequest(req, deps);
      expect(res.status).toBe(400);
    });

    it('rejects invalid body fields (missing invite_code)', async () => {
      const mock = createMockSupabase({ fromBehavior: defaultFromBehavior() });
      const res = await handleRequest(
        makeRequest({ date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('invite_code');
    });

    it('rejects invalid body fields (missing date_of_birth)', async () => {
      const mock = createMockSupabase({ fromBehavior: defaultFromBehavior() });
      const res = await handleRequest(makeRequest({ invite_code: 'ABC123' }), createDeps(mock));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('date_of_birth');
    });

    it('rejects invalid JWT (auth.getUser fails)', async () => {
      const mock = createMockSupabase({
        authGetUserResult: { data: { user: null }, error: { message: 'invalid token' } },
        fromBehavior: defaultFromBehavior(),
      });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(401);
    });

    it('returns INVALID_CODE when invite code does not exist', async () => {
      const behavior = defaultFromBehavior();
      behavior['convites_filho'] = () => ({ data: null, error: null });

      const mock = createMockSupabase({ fromBehavior: behavior });
      const res = await handleRequest(
        makeRequest({ invite_code: 'XXXXXX', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('INVALID_CODE');
    });

    it('returns EXPIRED_CODE when invite is expired', async () => {
      const behavior = defaultFromBehavior();
      behavior['convites_filho'] = () => ({ data: EXPIRED_INVITE, error: null });

      const mock = createMockSupabase({ fromBehavior: behavior });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('EXPIRED_CODE');
    });

    it('returns ALREADY_LINKED when invite was already used', async () => {
      const behavior = defaultFromBehavior();
      behavior['convites_filho'] = () => ({ data: USED_INVITE, error: null });

      const mock = createMockSupabase({ fromBehavior: behavior });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('ALREADY_LINKED');
    });

    it('returns ALREADY_LINKED when filho already has usuario_id', async () => {
      const behavior = defaultFromBehavior();
      behavior['filhos'] = () => ({
        data: { id: 'filho-1', usuario_id: 'existing-user' },
        error: null,
      });

      const mock = createMockSupabase({ fromBehavior: behavior });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('ALREADY_LINKED');
    });

    it('returns FAMILY_FULL when family has 10 or more children', async () => {
      const behavior = defaultFromBehavior();
      // Return 10 children for the filhos select query used by countActiveChildren
      const tenChildren = Array.from({ length: 10 }, (_, i) => ({ id: `filho-${i}` }));
      const originalFilhosBehavior = behavior['filhos'];
      let filhosCallCount = 0;
      behavior['filhos'] = (ctx) => {
        filhosCallCount++;
        // First call is findUnlinkedFilho (uses .maybeSingle), second is countActiveChildren (uses .select)
        if (filhosCallCount === 1) {
          return originalFilhosBehavior!(ctx);
        }
        return { data: tenChildren, error: null };
      };

      const mock = createMockSupabase({ fromBehavior: behavior });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('FAMILY_FULL');
    });

    it('links child successfully (200 + familia_nome + papel)', async () => {
      const mock = createMockSupabase({ fromBehavior: defaultFromBehavior() });
      const deps = createDeps(mock);
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        deps,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        familia_nome: string;
        papel: string;
      };
      expect(json.success).toBe(true);
      expect(json.familia_nome).toBe('Família Silva');
      expect(json.papel).toBe('filho');

      // Verify updateUserById was called with date_of_birth + LGPD metadata
      expect(mock.auth.admin.updateUserById).toHaveBeenCalledWith('child-user-1', {
        user_metadata: {
          date_of_birth: '2010-05-15',
          lgpd_consent_at: expect.any(String),
          lgpd_consent_version: '1.0',
          pending_child_invite: null,
        },
      });

      // Admin client uses service-role key
      expect(deps.createSupabaseClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'service-role-key',
      );
    });

    it('returns 500 when convites_filho query fails', async () => {
      const behavior = defaultFromBehavior();
      behavior['convites_filho'] = () => ({
        data: null,
        error: { message: 'db error' },
      });

      const mock = createMockSupabase({ fromBehavior: behavior });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(500);
    });

    it('returns 500 when filhos query fails', async () => {
      const behavior = defaultFromBehavior();
      behavior['filhos'] = () => ({
        data: null,
        error: { message: 'db error' },
      });

      const mock = createMockSupabase({ fromBehavior: behavior });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(500);
    });

    it('returns 500 when updateUserById fails', async () => {
      const mock = createMockSupabase({
        updateUserByIdResult: {
          data: null,
          error: { message: 'metadata update failed' },
        },
        fromBehavior: defaultFromBehavior(),
      });
      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );
      expect(res.status).toBe(500);
    });

    it('rolls back filhos.usuario_id when usuarios insert fails', async () => {
      const behavior = defaultFromBehavior();
      // usuarios.insert fails → handler must revert filhos.usuario_id to null.
      behavior['usuarios'] = () => ({
        data: null,
        error: { message: 'unique violation' },
      });

      const mock = createMockSupabase({ fromBehavior: behavior });

      // Wrap .from('filhos') to record every payload passed to .update().
      const originalFrom = mock.from as (t: string) => Record<string, unknown>;
      const filhosUpdates: unknown[] = [];
      (mock as { from: unknown }).from = vi.fn().mockImplementation((table: string) => {
        const chain = originalFrom(table);
        if (table === 'filhos') {
          const originalUpdate = chain.update as (...args: unknown[]) => unknown;
          chain.update = vi.fn().mockImplementation((payload: unknown) => {
            filhosUpdates.push(payload);
            return originalUpdate(payload);
          });
        }
        return chain;
      });

      const res = await handleRequest(
        makeRequest({ invite_code: 'ABC123', date_of_birth: '2010-05-15' }),
        createDeps(mock),
      );

      expect(res.status).toBe(500);
      // Expect: claim (usuario_id: 'child-user-1') then rollback (usuario_id: null).
      expect(filhosUpdates).toEqual([{ usuario_id: 'child-user-1' }, { usuario_id: null }]);
    });
  });
});
