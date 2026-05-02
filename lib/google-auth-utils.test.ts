import { describe, expect, it } from 'vitest';

import {
  formatLocalIsoDate,
  isValidDateOfBirth,
  localizeOAuthError,
  parseIsoDate,
  validateChildInviteCode,
} from './google-auth-utils';

import type {
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

  it('rejects a date less than 8 years ago', () => {
    const now = new Date();
    const tooYoung = new Date(
      Date.UTC(now.getUTCFullYear() - 7, now.getUTCMonth(), now.getUTCDate()),
    );
    expect(isValidDateOfBirth(tooYoung)).toBe(false);
  });

  it('accepts exactly 8 years ago today', () => {
    const now = new Date();
    const exactly8 = new Date(
      Date.UTC(now.getUTCFullYear() - 8, now.getUTCMonth(), now.getUTCDate()),
    );
    expect(isValidDateOfBirth(exactly8)).toBe(true);
  });

  it('rejects a date exactly 1 day before turning 8 (7 years + 364 days old)', () => {
    const now = new Date();
    // Born 1 day after the 8-year cutoff → still 7 years old
    const oneDayShort = new Date(
      Date.UTC(now.getUTCFullYear() - 8, now.getUTCMonth(), now.getUTCDate() + 1),
    );
    expect(isValidDateOfBirth(oneDayShort)).toBe(false);
  });

  it('rejects an invalid Date object', () => {
    expect(isValidDateOfBirth(new Date('invalid'))).toBe(false);
  });

  it('honors a stricter minimum age when provided', () => {
    const now = new Date();
    const seventeen = new Date(
      Date.UTC(now.getUTCFullYear() - 17, now.getUTCMonth(), now.getUTCDate()),
    );

    expect(isValidDateOfBirth(seventeen)).toBe(true);
    expect(isValidDateOfBirth(seventeen, 18)).toBe(false);
  });
});

describe('parseIsoDate', () => {
  it('parses strict YYYY-MM-DD calendar dates in UTC', () => {
    const parsed = parseIsoDate('1990-05-15');

    expect(parsed?.toISOString()).toBe('1990-05-15T00:00:00.000Z');
  });

  it('rejects non-ISO and impossible calendar dates', () => {
    expect(parseIsoDate('15/05/1990')).toBeNull();
    expect(parseIsoDate('1990-02-30')).toBeNull();
    expect(parseIsoDate('1990-13-01')).toBeNull();
    expect(parseIsoDate('1990-00-10')).toBeNull();
  });
});

describe('formatLocalIsoDate', () => {
  it('formats local calendar dates without converting to UTC', () => {
    expect(formatLocalIsoDate(new Date(1990, 0, 5))).toBe('1990-01-05');
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

  it('maps timeout error to network message', () => {
    const err: SupabaseAuthError = { message: 'Request timeout' };
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
