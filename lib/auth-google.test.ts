import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react-native';

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getGoogleIdToken } from './google-auth';
import { supabase } from './supabase';
import {
  signInWithGoogle,
  updateDateOfBirth,
} from './auth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./google-auth', () => ({
  getGoogleIdToken: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

vi.mock('./storage', () => ({
  resolveStorageUrl: vi.fn(
    (_bucket: string, value: string | null | undefined) =>
      Promise.resolve(value ? `https://cdn.example.com/${value}` : null),
  ),
  uploadImageToBucket: vi.fn(),
}));

vi.mock('./api-error', () => ({
  extractErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  localizeSupabaseError: vi.fn((msg: string) => `localized: ${msg}`),
  localizeRpcError: vi.fn((msg: string) => `rpc-localized: ${msg}`),
}));

vi.mock('./device-storage', () => ({
  deviceStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetGoogleIdToken = vi.mocked(getGoogleIdToken);
const mockSignInWithIdToken = vi.mocked(supabase.auth.signInWithIdToken);
const mockUpdateUser = vi.mocked(supabase.auth.updateUser);
const mockRpc = vi.mocked(supabase.rpc);

beforeEach(() => {
  mockGetGoogleIdToken.mockReset();
  mockSignInWithIdToken.mockReset();
  mockUpdateUser.mockReset();
  mockRpc.mockReset();
  vi.mocked(Sentry.addBreadcrumb).mockClear();
  vi.mocked(Sentry.captureException).mockClear();
});

// ===========================================================================
// signInWithGoogle
// ===========================================================================

describe('signInWithGoogle', () => {
  it('returns no error and isNewUser false when Google sign-in is cancelled', async () => {
    mockGetGoogleIdToken.mockResolvedValue({ type: 'cancelled' });

    const result = await signInWithGoogle();

    expect(result).toEqual({
      profile: null,
      isNewUser: false,
      googleName: null,
      error: null,
    });
  });

  it('returns localized error when Google SDK returns an error', async () => {
    mockGetGoogleIdToken.mockResolvedValue({
      type: 'error',
      message: 'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
    });

    const result = await signInWithGoogle();

    expect(result.error).toBe(
      'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
    );
    expect(result.profile).toBeNull();
    expect(result.isNewUser).toBe(false);
  });

  it('returns isNewUser true and googleName when user has no profile', async () => {
    mockGetGoogleIdToken.mockResolvedValue({
      type: 'success',
      idToken: 'google-id-token',
      user: { name: 'Maria Silva', email: 'maria@gmail.com' },
    });

    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: {} },
      error: null,
    } as never);

    // No profile found → new user
    mockRpc.mockResolvedValue({ data: null, error: null } as never);

    const result = await signInWithGoogle();

    expect(result).toEqual({
      profile: null,
      isNewUser: true,
      googleName: 'Maria Silva',
      error: null,
    });

    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
  });

  it('returns existing profile and isNewUser false for existing user', async () => {
    mockGetGoogleIdToken.mockResolvedValue({
      type: 'success',
      idToken: 'google-id-token',
      user: { name: 'João', email: 'joao@gmail.com' },
    });

    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: {} },
      error: null,
    } as never);

    // Existing profile found
    mockRpc.mockResolvedValue({
      data: {
        id: 'user-1',
        familia_id: 'fam-1',
        papel: 'admin',
        nome: 'João',
        avatarUrl: null,
      },
      error: null,
    } as never);

    const result = await signInWithGoogle();

    expect(result.isNewUser).toBe(false);
    expect(result.profile).toEqual({
      id: 'user-1',
      familia_id: 'fam-1',
      papel: 'admin',
      nome: 'João',
      avatarUrl: null,
    });
    expect(result.googleName).toBe('João');
    expect(result.error).toBeNull();
  });

  it('returns localized error when Supabase signInWithIdToken fails', async () => {
    mockGetGoogleIdToken.mockResolvedValue({
      type: 'success',
      idToken: 'google-id-token',
      user: { name: 'Ana', email: 'ana@gmail.com' },
    });

    mockSignInWithIdToken.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Token expired', status: 401 },
    } as never);

    const result = await signInWithGoogle();

    expect(result.error).toBe('Erro na autenticação. Tente novamente.');
    expect(result.profile).toBeNull();
    expect(result.isNewUser).toBe(false);
    expect(result.googleName).toBe('Ana');
  });

  it('returns a localized error when Supabase signInWithIdToken throws', async () => {
    const error = new Error('Network request failed');
    mockGetGoogleIdToken.mockResolvedValue({
      type: 'success',
      idToken: 'google-id-token',
      user: { name: 'Ana', email: 'ana@gmail.com' },
    });
    mockSignInWithIdToken.mockRejectedValueOnce(error);

    const result = await signInWithGoogle();

    expect(result).toEqual({
      profile: null,
      isNewUser: false,
      googleName: 'Ana',
      error: 'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { area: 'auth', step: 'sign-in-with-id-token' },
    });
  });

  it('does not treat profile RPC failures as a new user', async () => {
    mockGetGoogleIdToken.mockResolvedValue({
      type: 'success',
      idToken: 'google-id-token',
      user: { name: 'Ana', email: 'ana@gmail.com' },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: {} },
      error: null,
    } as never);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'profile rpc unavailable' },
    } as never);

    const result = await signInWithGoogle();

    expect(result).toEqual({
      profile: null,
      isNewUser: false,
      googleName: 'Ana',
      error: 'rpc-localized: profile rpc unavailable',
    });
  });

  it('adds Sentry breadcrumbs throughout the flow', async () => {
    mockGetGoogleIdToken.mockResolvedValue({
      type: 'success',
      idToken: 'token',
      user: { name: 'Test', email: 'test@gmail.com' },
    });

    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'u1' }, session: {} },
      error: null,
    } as never);

    mockRpc.mockResolvedValue({ data: null, error: null } as never);

    await signInWithGoogle();

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'auth',
        message: 'google_sign_in_started',
      }),
    );

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'auth',
        message: 'google_sign_in_new_user',
      }),
    );
  });
});

// ===========================================================================
// updateDateOfBirth
// ===========================================================================

describe('updateDateOfBirth', () => {
  it('returns no error for a valid date of birth', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    } as never);

    const result = await updateDateOfBirth('1990-05-15');

    expect(result).toEqual({ error: null });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { date_of_birth: '1990-05-15' },
    });
  });

  it('returns validation error for a date that is too recent (under 8)', async () => {
    const now = new Date();
    const tooYoung = new Date(
      Date.UTC(now.getUTCFullYear() - 5, now.getUTCMonth(), now.getUTCDate()),
    );
    const isoDate = tooYoung.toISOString().split('T')[0];

    const result = await updateDateOfBirth(isoDate);

    expect(result).toEqual({ error: 'Data de nascimento inválida.' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns validation error for a future date', async () => {
    const future = new Date(Date.UTC(2099, 0, 1));
    const isoDate = future.toISOString().split('T')[0];

    const result = await updateDateOfBirth(isoDate);

    expect(result).toEqual({ error: 'Data de nascimento inválida.' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns validation error for an invalid date string', async () => {
    const result = await updateDateOfBirth('not-a-date');

    expect(result).toEqual({ error: 'Data de nascimento inválida.' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns validation error for impossible ISO calendar dates', async () => {
    const result = await updateDateOfBirth('1990-02-30');

    expect(result).toEqual({ error: 'Data de nascimento inválida.' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('enforces custom minimum age for admin onboarding', async () => {
    const now = new Date();
    const under18 = new Date(
      Date.UTC(now.getUTCFullYear() - 17, now.getUTCMonth(), now.getUTCDate()),
    );
    const isoDate = under18.toISOString().split('T')[0];

    const result = await updateDateOfBirth(isoDate, 18);

    expect(result).toEqual({ error: 'Data de nascimento inválida.' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns localized Supabase error when updateUser fails', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Server error' },
    } as never);

    const result = await updateDateOfBirth('1990-05-15');

    expect(result).toEqual({ error: 'localized: Server error' });
  });

  it('captures unexpected updateUser exceptions', async () => {
    const error = new Error('network failed');
    mockUpdateUser.mockRejectedValueOnce(error);

    const result = await updateDateOfBirth('1990-05-15');

    expect(result).toEqual({ error: 'Algo deu errado. Tente novamente.' });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { area: 'auth', step: 'update-date-of-birth' },
    });
  });
});
