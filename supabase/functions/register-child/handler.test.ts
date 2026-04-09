import { describe, expect, it, vi } from 'vitest';
import {
  handleRequest,
  validateRequest,
  type HandlerDeps,
  type SupabaseClientLike,
} from './handler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockSupabase(overrides?: {
  authGetUserResult?: { data: { user: { id: string } | null }; error: unknown };
  createUserResult?: {
    data: { user: { id: string } | null };
    error: { message: string } | null;
  };
  deleteUserResult?: { error: { message: string } | null };
  rpcResult?: { data: unknown; error: { message: string } | null };
}): SupabaseClientLike {
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue(
          overrides?.authGetUserResult ?? { data: { user: { id: 'admin-1' } }, error: null },
        ),
      admin: {
        createUser: vi.fn().mockResolvedValue(
          overrides?.createUserResult ?? {
            data: { user: { id: 'child-user-1' } },
            error: null,
          },
        ),
        deleteUser: vi.fn().mockResolvedValue(overrides?.deleteUserResult ?? { error: null }),
      },
    },
    rpc: vi.fn().mockResolvedValue(overrides?.rpcResult ?? { data: 'child-id-1', error: null }),
  };
}

function createDeps(supabase?: SupabaseClientLike): HandlerDeps {
  const mock = supabase ?? createMockSupabase();
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
  return new Request('https://test.supabase.co/functions/v1/register-child', {
    ...requestInit,
  }) as unknown as Request;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('register-child handler', () => {
  describe('validateRequest', () => {
    it('accepts a valid request body', () => {
      const result = validateRequest({
        name: 'Lia',
        email: 'lia@example.com',
        tempPassword: 'secret-123',
      });
      expect(result).toEqual({
        valid: true,
        data: { name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' },
      });
    });

    it('trims name and email', () => {
      const result = validateRequest({
        name: '  Lia  ',
        email: '  lia@example.com  ',
        tempPassword: 'secret-123',
      });
      expect(result).toEqual({
        valid: true,
        data: { name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' },
      });
    });

    it.each([
      [null, 'Request body must be a JSON object'],
      [{ email: 'a@b.c', tempPassword: '123456' }, 'name must be a non-empty string'],
      [{ name: '', email: 'a@b.c', tempPassword: '123456' }, 'name must be a non-empty string'],
      [{ name: 'Lia', tempPassword: '123456' }, 'email must be a non-empty string'],
      [
        { name: 'Lia', email: 'a@b.c', tempPassword: '12345' },
        'tempPassword must be at least 6 characters',
      ],
    ])('rejects invalid body %j with "%s"', (body, expectedError) => {
      const result = validateRequest(body);
      expect(result).toEqual({ valid: false, error: expectedError });
    });
  });

  describe('handleRequest', () => {
    it('rejects non-POST methods', async () => {
      const req = new Request('https://test.supabase.co/functions/v1/register-child', {
        method: 'GET',
      }) as unknown as Request;
      const res = await handleRequest(req, createDeps());
      expect(res.status).toBe(405);
    });

    it('rejects missing authorization header', async () => {
      const req = new Request('https://test.supabase.co/functions/v1/register-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lia', email: 'lia@example.com', tempPassword: 'secret' }),
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
        makeRequest({ name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' }),
        deps,
      );
      expect(res.status).toBe(500);
    });

    it('rejects oversized payloads', async () => {
      const res = await handleRequest(
        makeRequest(
          { name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' },
          {
            contentLength: 5000,
          },
        ),
        createDeps(),
      );
      expect(res.status).toBe(413);
    });

    it('rejects malformed JSON', async () => {
      const req = new Request('https://test.supabase.co/functions/v1/register-child', {
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

    it('rejects invalid body fields', async () => {
      const res = await handleRequest(
        makeRequest({ name: '', email: 'lia@example.com', tempPassword: 'secret-123' }),
        createDeps(),
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('name');
    });

    it('rejects invalid JWT (auth.getUser fails)', async () => {
      const mock = createMockSupabase({
        authGetUserResult: { data: { user: null }, error: { message: 'invalid token' } },
      });
      const res = await handleRequest(
        makeRequest({ name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' }),
        createDeps(mock),
      );
      expect(res.status).toBe(401);
    });

    it('returns 422 when createUser fails', async () => {
      const mock = createMockSupabase({
        createUserResult: {
          data: { user: null },
          error: { message: 'User already registered' },
        },
      });
      const res = await handleRequest(
        makeRequest({ name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' }),
        createDeps(mock),
      );
      expect(res.status).toBe(422);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('User already registered');
      expect(mock.rpc).not.toHaveBeenCalled();
    });

    it('creates child successfully (201 + childId)', async () => {
      const mock = createMockSupabase();
      const res = await handleRequest(
        makeRequest({ name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' }),
        createDeps(mock),
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as { childId: string };
      expect(json.childId).toBe('child-id-1');

      expect(mock.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'lia@example.com',
        password: 'secret-123',
        email_confirm: true,
      });
      expect(mock.rpc).toHaveBeenCalledWith('criar_filho_na_familia', {
        filho_user_id: 'child-user-1',
        filho_nome: 'Lia',
      });
      expect(mock.auth.admin.deleteUser).not.toHaveBeenCalled();
    });

    it('rolls back auth user when RPC fails', async () => {
      const mock = createMockSupabase({
        rpcResult: { data: null, error: { message: 'Usuário já pertence a uma família' } },
      });
      const res = await handleRequest(
        makeRequest({ name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' }),
        createDeps(mock),
      );
      expect(res.status).toBe(422);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Usuário já pertence a uma família');
      expect(mock.auth.admin.deleteUser).toHaveBeenCalledWith('child-user-1');
    });
  });
});
