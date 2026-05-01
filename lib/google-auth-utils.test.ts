import { describe, expect, it } from 'vitest';

import {
  isValidDateOfBirth,
  localizeOAuthError,
  shouldShowChangePassword,
  shouldShowGoogleMigrationBanner,
  validateChildInviteCode,
} from './google-auth-utils';

import type {
  Identity,
  InviteRecord,
  SupabaseAuthError,
} from './google-auth-utils';

import type { GoogleAuthResult } from './google-auth';

// ---------------------------------------------------------------------------
// isValidDateOfBirth
// ---------------------------------------------------------------------------

describe('isValidDateOfBirth', () => {
  it('accepts a date well within the valid range', () => {
    const date = new Date(Date.UTC(1990, 5, 15));
    expect(isValidDateOfBirth(date)).toBe(true);
  });

  it('accepts the lower bound — 1 Jan 1900', () => {
    const date = new Date(Date.UTC(1900, 0, 1));
    expect(isValidDateOfBirth(date)).toBe(true);
  });

  it('rejects a date before 1900', () => {
    const date = new Date(Date.UTC(1899, 11, 31));
    expect(isValidDateOfBirth(date)).toBe(false);
  });

  it('rejects a date less than 13 years ago', () => {
    const now = new Date();
    const tooYoung = new Date(
      Date.UTC(now.getUTCFullYear() - 12, now.getUTCMonth(), now.getUTCDate()),
    );
    expect(isValidDateOfBirth(tooYoung)).toBe(false);
  });

  it('accepts exactly 13 years ago today', () => {
    const now = new Date();
    const exactly13 = new Date(
      Date.UTC(now.getUTCFullYear() - 13, now.getUTCMonth(), now.getUTCDate()),
    );
    expect(isValidDateOfBirth(exactly13)).toBe(true);
  });

  it('rejects an invalid Date object', () => {
    expect(isValidDateOfBirth(new Date('invalid'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// localizeOAuthError
// ---------------------------------------------------------------------------

describe('localizeOAuthError', () => {
  it('returns null for a cancelled GoogleAuthResult', () => {
    const result: GoogleAuthResult = { type: 'cancelled' };
    expect(localizeOAuthError(result)).toBeNull();
  });

  it('returns null for a success GoogleAuthResult', () => {
    const result: GoogleAuthResult = {
      type: 'success',
      idToken: 'tok',
      user: { name: 'A', email: 'a@b.com' },
    };
    expect(localizeOAuthError(result)).toBeNull();
  });

  it('returns the message for an error GoogleAuthResult', () => {
    const result: GoogleAuthResult = {
      type: 'error',
      message: 'Erro na autenticação. Tente novamente.',
    };
    expect(localizeOAuthError(result)).toBe(
      'Erro na autenticação. Tente novamente.',
    );
  });

  it('maps email_verified Supabase error', () => {
    const err: SupabaseAuthError = { message: 'email_verified is false' };
    expect(localizeOAuthError(err)).toBe(
      'Não foi possível verificar seu e-mail. Use outra conta Google.',
    );
  });

  it('maps provider conflict Supabase error', () => {
    const err: SupabaseAuthError = {
      message: 'Identity provider already linked',
    };
    expect(localizeOAuthError(err)).toBe(
      'Esta conta já está vinculada a outro método de login. Faça login com e-mail/senha e vincule sua conta Google nas configurações.',
    );
  });

  it('maps rate limit by status 429', () => {
    const err: SupabaseAuthError = { message: 'error', status: 429 };
    expect(localizeOAuthError(err)).toBe(
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    );
  });

  it('maps rate limit by message', () => {
    const err: SupabaseAuthError = { message: 'Rate limit exceeded' };
    expect(localizeOAuthError(err)).toBe(
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    );
  });

  it('maps network error', () => {
    const err: SupabaseAuthError = { message: 'Network request failed' };
    expect(localizeOAuthError(err)).toBe(
      'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
    );
  });

  it('maps server error', () => {
    const err: SupabaseAuthError = { message: 'Internal server error 500' };
    expect(localizeOAuthError(err)).toBe(
      'O serviço do Google está temporariamente indisponível. Tente novamente em alguns minutos.',
    );
  });

  it('falls back to generic message for unknown Supabase errors', () => {
    const err: SupabaseAuthError = { message: 'something unexpected' };
    expect(localizeOAuthError(err)).toBe(
      'Erro na autenticação. Tente novamente.',
    );
  });
});

// ---------------------------------------------------------------------------
// shouldShowGoogleMigrationBanner
// ---------------------------------------------------------------------------

describe('shouldShowGoogleMigrationBanner', () => {
  it('returns true when no identities exist', () => {
    expect(shouldShowGoogleMigrationBanner([])).toBe(true);
  });

  it('returns true when only email identity exists', () => {
    const ids: Identity[] = [{ provider: 'email' }];
    expect(shouldShowGoogleMigrationBanner(ids)).toBe(true);
  });

  it('returns false when google identity exists', () => {
    const ids: Identity[] = [{ provider: 'google' }];
    expect(shouldShowGoogleMigrationBanner(ids)).toBe(false);
  });

  it('returns false when both email and google identities exist', () => {
    const ids: Identity[] = [{ provider: 'email' }, { provider: 'google' }];
    expect(shouldShowGoogleMigrationBanner(ids)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldShowChangePassword
// ---------------------------------------------------------------------------

describe('shouldShowChangePassword', () => {
  it('returns false when no identities exist', () => {
    expect(shouldShowChangePassword([])).toBe(false);
  });

  it('returns true when email identity exists', () => {
    const ids: Identity[] = [{ provider: 'email' }];
    expect(shouldShowChangePassword(ids)).toBe(true);
  });

  it('returns false when only google identity exists', () => {
    const ids: Identity[] = [{ provider: 'google' }];
    expect(shouldShowChangePassword(ids)).toBe(false);
  });

  it('returns true when both email and google identities exist', () => {
    const ids: Identity[] = [{ provider: 'email' }, { provider: 'google' }];
    expect(shouldShowChangePassword(ids)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateChildInviteCode
// ---------------------------------------------------------------------------

describe('validateChildInviteCode', () => {
  const NOW = new Date('2025-06-01T12:00:00Z');

  it('returns INVALID_CODE when invite is null', () => {
    expect(validateChildInviteCode('ABC123', null, NOW)).toEqual({
      valid: false,
      error: 'INVALID_CODE',
    });
  });

  it('returns ALREADY_LINKED when aceito_por is set', () => {
    const invite: InviteRecord = {
      aceito_por: 'some-user-id',
      expira_em: '2025-06-08T12:00:00Z',
    };
    expect(validateChildInviteCode('ABC123', invite, NOW)).toEqual({
      valid: false,
      error: 'ALREADY_LINKED',
    });
  });

  it('returns EXPIRED_CODE when expira_em is in the past', () => {
    const invite: InviteRecord = {
      aceito_por: null,
      expira_em: '2025-05-31T12:00:00Z',
    };
    expect(validateChildInviteCode('ABC123', invite, NOW)).toEqual({
      valid: false,
      error: 'EXPIRED_CODE',
    });
  });

  it('returns EXPIRED_CODE when expira_em equals now exactly', () => {
    const invite: InviteRecord = {
      aceito_por: null,
      expira_em: '2025-06-01T12:00:00Z',
    };
    expect(validateChildInviteCode('ABC123', invite, NOW)).toEqual({
      valid: false,
      error: 'EXPIRED_CODE',
    });
  });

  it('returns valid when invite is not expired and not accepted', () => {
    const invite: InviteRecord = {
      aceito_por: null,
      expira_em: '2025-06-08T12:00:00Z',
    };
    expect(validateChildInviteCode('ABC123', invite, NOW)).toEqual({
      valid: true,
    });
  });
});
