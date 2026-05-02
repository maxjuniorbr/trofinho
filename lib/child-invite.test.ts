import * as Sentry from '@sentry/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHILD_INVITE_CODE_LENGTH,
  childInviteErrorMessage,
  formatChildInviteCode,
  validateChildInvite,
} from './child-invite';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

describe('child invite helpers', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
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
});
