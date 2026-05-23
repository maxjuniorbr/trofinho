import * as Sentry from '@sentry/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHILD_INVITE_CODE_LENGTH,
  childInviteErrorMessage,
  formatChildInviteCode,
  generateChildInvite,
  generateInviteCode,
  validateChildInvite,
} from './child-invite';

const getRandomBytesMock = vi.hoisted(() =>
  vi.fn(() => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])),
);

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

const localizeRpcErrorMock = vi.hoisted(() => vi.fn((msg: string) => `localized: ${msg}`));

vi.mock('expo-crypto', () => ({
  getRandomBytes: getRandomBytesMock,
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('./api-error', () => ({
  localizeRpcError: localizeRpcErrorMock,
}));

function createInviteInsertChain(result: { data: unknown; error: unknown }) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe('child invite helpers', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.from.mockReset();
    getRandomBytesMock
      .mockReset()
      .mockReturnValue(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
    localizeRpcErrorMock.mockReset().mockImplementation((msg: string) => `localized: ${msg}`);
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  it('formats invite codes as six uppercase alphanumeric characters', () => {
    expect(CHILD_INVITE_CODE_LENGTH).toBe(6);
    expect(formatChildInviteCode(' ab-c123!! ')).toBe('ABC123');
    expect(formatChildInviteCode('abc123456')).toBe('ABC123');
  });

  it('maps known invite failures to safe user messages', () => {
    expect(childInviteErrorMessage('ALREADY_LINKED')).toBe('Este convite já foi utilizado.');
    expect(childInviteErrorMessage('INVALID_CODE')).toContain('Código inválido');
    expect(childInviteErrorMessage('EXPIRED_CODE')).toContain('Código inválido');
    expect(childInviteErrorMessage('UNKNOWN')).toContain('Código inválido');
  });

  it('generates a six-character readable code', () => {
    expect(generateInviteCode()).toBe('ABCDEF');
  });

  it('validates a child invite and normalizes missing optional preview fields', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        valid: true,
        id: 'invite-1',
        familia_id: 'family-1',
        filho_id: null,
        nome_filho: 'Ana',
      },
      error: null,
    });

    await expect(validateChildInvite('abc123')).resolves.toEqual({
      preview: {
        id: 'invite-1',
        familia_id: 'family-1',
        filho_id: null,
        nome_filho: 'Ana',
        familyName: 'Família',
        adminName: 'Administrador',
      },
      error: null,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('validar_convite_filho', {
      p_codigo: 'ABC123',
    });
  });

  it('does not call the RPC when the code is incomplete', async () => {
    await expect(validateChildInvite('ABC')).resolves.toEqual({
      preview: null,
      error: 'Informe um código de 6 caracteres.',
    });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns localized invite validation errors from the RPC result', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: { valid: false, error: 'ALREADY_LINKED' },
      error: null,
    });

    await expect(validateChildInvite('ABC123')).resolves.toEqual({
      preview: null,
      error: 'Este convite já foi utilizado.',
    });
  });

  it('captures RPC transport errors and returns a retryable message', async () => {
    const rpcError = { message: 'network failed' };
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: rpcError });

    await expect(validateChildInvite('ABC123')).resolves.toEqual({
      preview: null,
      error: 'Erro ao verificar código. Tente novamente.',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(rpcError, {
      tags: { area: 'child-invite', step: 'validate' },
    });
  });

  it('captures incomplete successful previews instead of proceeding silently', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: { valid: true, familia_id: 'family-1', nome_filho: 'Ana' },
      error: null,
    });

    await expect(validateChildInvite('ABC123')).resolves.toEqual({
      preview: null,
      error: 'Erro ao verificar código. Tente novamente.',
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'validar_convite_filho returned incomplete preview',
      expect.objectContaining({ level: 'error' }),
    );
  });

  it('captures unexpected validation exceptions', async () => {
    const error = new Error('boom');
    supabaseMock.rpc.mockRejectedValueOnce(error);

    await expect(validateChildInvite('ABC123')).resolves.toEqual({
      preview: null,
      error: 'Erro ao verificar código. Tente novamente.',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { area: 'child-invite', step: 'validate_unhandled' },
    });
  });

  it('inserts a child invite and returns display data', async () => {
    const chain = createInviteInsertChain({
      data: { codigo: 'ABCDEF', expira_em: '2026-05-03T00:00:00Z' },
      error: null,
    });
    supabaseMock.from.mockReturnValue(chain);

    const result = await generateChildInvite({
      familyId: 'family-1',
      childId: 'child-1',
      childName: 'Lia',
      createdBy: 'admin-1',
    });

    expect(result).toEqual({
      data: { codigo: 'ABCDEF', nome_filho: 'Lia', expira_em: '2026-05-03T00:00:00Z' },
      error: null,
    });
    expect(supabaseMock.from).toHaveBeenCalledWith('convites_filho');
    expect(chain.insert).toHaveBeenCalledWith({
      familia_id: 'family-1',
      filho_id: 'child-1',
      codigo: 'ABCDEF',
      criado_por: 'admin-1',
      nome_filho: 'Lia',
    });
    expect(chain.select).toHaveBeenCalledWith('codigo, expira_em');
  });

  it('retries invite generation on unique code collisions', async () => {
    const collision = createInviteInsertChain({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const success = createInviteInsertChain({
      data: { codigo: 'ABCDEF', expira_em: '2026-05-03T00:00:00Z' },
      error: null,
    });
    supabaseMock.from.mockReturnValueOnce(collision).mockReturnValueOnce(success);

    const result = await generateChildInvite({
      familyId: 'family-1',
      childId: 'child-1',
      childName: 'Lia',
      createdBy: 'admin-1',
    });

    expect(result.error).toBeNull();
    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
  });

  it('returns localized errors for non-unique insert failures', async () => {
    const chain = createInviteInsertChain({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    supabaseMock.from.mockReturnValue(chain);

    const result = await generateChildInvite({
      familyId: 'family-1',
      childId: 'child-1',
      childName: 'Lia',
      createdBy: 'admin-1',
    });

    expect(result).toEqual({ data: null, error: 'localized: permission denied' });
  });
});
