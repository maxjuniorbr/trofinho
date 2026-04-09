import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as fc from 'fast-check';
import {
  buildChildDeactivateMessage,
  deactivateChild,
  getChild,
  getMyChildId,
  listChildren,
  reactivateChild,
  registerChild,
} from './children';

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('./storage', () => ({
  resolveStorageUrl: vi.fn(async (_b: string, v: string | null) => v),
  resolveStorageUrls: vi.fn(async (_b: string, vs: (string | null | undefined)[]) => vs),
}));

function createOrderQuery(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    order: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),
    overrideTypes: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  };
}

function createMaybeSingleQuery(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  };
}

describe('children', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.getSession.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.functions.invoke.mockReset();

    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'admin-jwt' } },
    });
  });

  it('registers a child successfully via edge function', async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { childId: 'child-id-1' },
      error: null,
    });

    const result = await registerChild('Lia', 'lia@example.com', 'secret-123');

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('register-child', {
      body: { name: 'Lia', email: 'lia@example.com', tempPassword: 'secret-123' },
      headers: { Authorization: 'Bearer admin-jwt' },
    });
    expect(result).toEqual({ error: null });
  });

  it('returns session expired error when no session exists', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: null },
    });

    const result = await registerChild('Lia', 'lia@example.com', 'secret-123');

    expect(result).toEqual({ error: 'Sua sessão expirou. Faça login novamente.' });
    expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ['User already registered', 'Este e-mail já possui uma conta.'],
    ['Password should be at least 6 characters', 'A senha deve ter ao menos 6 caracteres.'],
    ['Unable to validate email address', 'E-mail inválido.'],
    ['email rate limit exceeded', 'Limite de e-mails atingido. Aguarde alguns minutos.'],
    ['Usuário já pertence a uma família', 'Esta conta já está vinculada a uma família.'],
    ['Usuário já está vinculado a um filho', 'Esta conta já está vinculada a um perfil de filho.'],
    ['Apenas admins podem cadastrar filhos', 'Somente administradores podem cadastrar filhos.'],
    ['unexpected error', 'Não foi possível cadastrar o filho. Tente novamente.'],
  ])('translates edge function error "%s"', async (message, expected) => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { error: message },
      error: { message },
    });

    await expect(registerChild('Lia', 'lia@example.com', 'secret-123')).resolves.toEqual({
      error: expected,
    });
  });

  it('lists children and surfaces database errors', async () => {
    supabaseMock.from
      .mockReturnValueOnce(
        createOrderQuery({ data: [{ id: 'child-1', nome: 'Lia' }], error: null }),
      )
      .mockReturnValueOnce(createOrderQuery({ data: null, error: { message: 'broken query' } }));

    await expect(listChildren()).resolves.toEqual({
      data: [{ id: 'child-1', nome: 'Lia' }],
      error: null,
    });

    await expect(listChildren()).resolves.toEqual({
      data: [],
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('fetches a child profile for admin view', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'child-1',
          nome: 'Lia',
          usuario_id: 'user-1',
          avatar_url: null,
          email: 'lia@example.com',
        },
      ],
      error: null,
    });

    await expect(getChild('child-1')).resolves.toEqual({
      data: {
        id: 'child-1',
        nome: 'Lia',
        usuario_id: 'user-1',
        avatar_url: null,
        email: 'lia@example.com',
      },
      error: null,
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('obter_filho_admin', {
      p_filho_id: 'child-1',
    });
  });

  it('returns rpc errors when loading a child fails', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ error: { message: 'rpc failed' } });

    await expect(getChild('child-2')).resolves.toEqual({
      data: null,
      error: 'Algo deu errado. Tente novamente.',
    });
  });

  it('gets the current child id when a child row exists', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    supabaseMock.from.mockReturnValue(
      createMaybeSingleQuery({
        data: { id: 'child-1' },
        error: null,
      }),
    );

    await expect(getMyChildId()).resolves.toBe('child-1');
  });

  it('returns null when there is no logged in user or no child row', async () => {
    supabaseMock.auth.getUser
      .mockResolvedValueOnce({ data: { user: null } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    supabaseMock.from.mockReturnValueOnce(
      createMaybeSingleQuery({
        data: null,
        error: null,
      }),
    );

    await expect(getMyChildId()).resolves.toBeNull();
    await expect(getMyChildId()).resolves.toBeNull();
  });

  describe('deactivateChild', () => {
    it('returns data on success', async () => {
      supabaseMock.rpc.mockResolvedValue({
        data: { pendingValidationCount: 2, totalBalance: 150 },
        error: null,
      });

      const result = await deactivateChild('child-1');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('desativar_filho', {
        p_filho_id: 'child-1',
      });
      expect(result).toEqual({
        data: { pendingValidationCount: 2, totalBalance: 150 },
        error: null,
      });
    });

    it('returns localized error when child not found', async () => {
      supabaseMock.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Filho não encontrado' },
      });

      const result = await deactivateChild('child-missing');

      expect(result).toEqual({
        data: null,
        error: 'Registro não encontrado.',
      });
    });

    it('returns localized error when pending redemptions block deactivation', async () => {
      supabaseMock.rpc.mockResolvedValue({
        data: null,
        error: {
          message:
            'Não é possível desativar um filho com resgates pendentes. Confirme ou cancele os resgates antes de desativar.',
        },
      });

      const result = await deactivateChild('child-with-redemptions');

      expect(result).toEqual({
        data: null,
        error:
          'Não é possível desativar com resgates pendentes. Confirme ou cancele os resgates primeiro.',
      });
    });
  });

  describe('reactivateChild', () => {
    it('returns no error on success', async () => {
      supabaseMock.rpc.mockResolvedValue({ error: null });

      const result = await reactivateChild('child-1');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('reativar_filho', {
        p_filho_id: 'child-1',
      });
      expect(result).toEqual({ error: null });
    });

    it('returns localized error on failure', async () => {
      supabaseMock.rpc.mockResolvedValue({
        error: { message: 'some error' },
      });

      const result = await reactivateChild('child-1');

      expect(result).toEqual({
        error: 'Algo deu errado. Tente novamente.',
      });
    });
  });

  describe('Property tests — soft delete', () => {
    // Feature: soft-delete, Property 13: deactivateChild with pending redemptions returns error containing 'resgates pendentes'
    // **Validates: Requirements 7.4, 13.7**
    it('deactivateChild with pending redemptions returns error containing resgates pendentes', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (childId) => {
          supabaseMock.rpc.mockResolvedValue({
            data: null,
            error: {
              message:
                'Não é possível desativar um filho com resgates pendentes. Confirme ou cancele os resgates antes de desativar.',
            },
          });
          const result = await deactivateChild(childId);
          expect(result.data).toBeNull();
          expect(result.error).toBeTruthy();
          expect(result.error).toContain('resgates pendentes');
        }),
        { numRuns: 100 },
      );
    });

    // Feature: soft-delete, Property 15: Confirmation dialog message includes correct counts and balance
    // **Validates: Requirements 13.3, 13.4, 13.5**
    it('buildChildDeactivateMessage includes correct counts and balance for arbitrary data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.record({
            pendingCount: fc.nat({ max: 100 }),
            awaitingCount: fc.nat({ max: 100 }),
            totalBalance: fc.nat({ max: 10000 }),
          }),
          (childName, data) => {
            const message = buildChildDeactivateMessage(childName, data);

            // Always includes the child name and login block info
            expect(message).toContain(childName);
            expect(message).toContain('login');

            if (data.pendingCount > 0) {
              expect(message).toContain(String(data.pendingCount));
              expect(message).toContain('cancelada');
            }

            if (data.awaitingCount > 0) {
              expect(message).toContain(String(data.awaitingCount));
              expect(message).toContain('mantida');
            }

            if (data.totalBalance > 0) {
              expect(message).toContain(String(data.totalBalance));
              expect(message).toContain('pts');
            }

            // Message is never empty
            expect(message.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
