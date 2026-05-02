import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import {
  formatLocalIsoDate,
  isValidDateOfBirth,
  parseIsoDate,
  validateChildInviteCode,
  type InviteRecord,
  localizeOAuthError,
  type SupabaseAuthError,
} from './google-auth-utils';

import type { GoogleAuthResult } from './google-auth';

/**
 * Feature: google-oauth-migration, Property 1: Validação de data de nascimento
 *
 * Para qualquer data gerada aleatoriamente, a função `isValidDateOfBirth(date)`
 * SHALL retornar `true` se e somente se a data estiver entre 01/01/1900 e a data
 * atual menos 8 anos (inclusive). Datas fora desse intervalo, datas nulas e datas
 * futuras devem ser rejeitadas.
 *
 * **Validates: Requirements 3.2, 3.4**
 */

/** Computes the upper bound (today - 8 years) using UTC, matching the implementation. */
function getMaxDateOfBirth(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear() - 8, now.getUTCMonth(), now.getUTCDate()),
  );
}

const MIN_DATE = new Date(Date.UTC(1900, 0, 1)); // 1 Jan 1900

describe('Feature: google-oauth-migration, Property 1: Validação de data de nascimento', () => {
  // Freeze time so `new Date()` inside isValidDateOfBirth matches the test's maxDate.
  // Without this, the suite can flake when the UTC day rolls over mid-run.
  const FROZEN_NOW = new Date('2026-04-30T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ now: FROZEN_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts any date within the valid range [1900-01-01, today - 8 years]', () => {
    const maxDate = getMaxDateOfBirth();

    fc.assert(
      fc.property(
        fc.date({ min: MIN_DATE, max: maxDate, noInvalidDate: true }),
        (date) => {
          expect(isValidDateOfBirth(date)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects any date before 1900-01-01', () => {
    const beforeMin = new Date(Date.UTC(1899, 11, 31)); // 31 Dec 1899

    fc.assert(
      fc.property(
        fc.date({ min: new Date(Date.UTC(1800, 0, 1)), max: beforeMin, noInvalidDate: true }),
        (date) => {
          expect(isValidDateOfBirth(date)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects any date after today - 8 years', () => {
    const maxDate = getMaxDateOfBirth();
    const dayAfterMax = new Date(maxDate.getTime() + 24 * 60 * 60 * 1000);
    const futureLimit = new Date(Date.UTC(2100, 0, 1));

    fc.assert(
      fc.property(
        fc.date({ min: dayAfterMax, max: futureLimit, noInvalidDate: true }),
        (date) => {
          expect(isValidDateOfBirth(date)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for ANY date, isValidDateOfBirth returns true IFF date >= 1900-01-01 AND date <= today - 8 years', () => {
    const maxDate = getMaxDateOfBirth();

    fc.assert(
      fc.property(
        fc.date({ min: new Date(Date.UTC(1800, 0, 1)), max: new Date(Date.UTC(2100, 0, 1)), noInvalidDate: true }),
        (date) => {
          const utcDate = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
          );

          const expected = utcDate >= MIN_DATE && utcDate <= maxDate;
          expect(isValidDateOfBirth(date)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: admin-onboarding-journey, Property 3: Round-trip de serialização da data de nascimento
 *
 * Para qualquer data de nascimento válida (aceita por `isValidDateOfBirth`),
 * serializar para formato ISO `YYYY-MM-DD` via `formatLocalIsoDate`
 * e deserializar com `parseIsoDate(isoString)` SHALL preservar o mesmo ano,
 * mês e dia do calendário local escolhido no date picker.
 *
 * **Validates: Requirements 21.1**
 */

describe('Feature: admin-onboarding-journey, Property 3: Round-trip de serialização da data de nascimento', () => {
  const FROZEN_NOW = new Date('2026-04-30T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ now: FROZEN_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serializing a valid date to YYYY-MM-DD and deserializing preserves local calendar year, month and day', () => {
    const maxDate = getMaxDateOfBirth();

    fc.assert(
      fc.property(
        fc.date({ min: MIN_DATE, max: maxDate, noInvalidDate: true }),
        (date) => {
          // Pre-condition: date must be accepted by isValidDateOfBirth
          fc.pre(isValidDateOfBirth(date));

          // Serialize to YYYY-MM-DD
          const isoString = formatLocalIsoDate(date);

          // Deserialize back
          const restored = parseIsoDate(isoString);

          expect(restored).not.toBeNull();
          // Verify local calendar year, month and day are preserved.
          expect(restored!.getUTCFullYear()).toBe(date.getFullYear());
          expect(restored!.getUTCMonth()).toBe(date.getMonth());
          expect(restored!.getUTCDate()).toBe(date.getDate());
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: google-oauth-migration, Property 4: Validação de código de convite de filho
 *
 * Para qualquer código de convite, a função `validateChildInviteCode(code, invite, now)`
 * SHALL retornar válido se e somente se: (a) o invite não é null, (b) `aceito_por` é null,
 * e (c) `expira_em` é posterior a `now`. Códigos inexistentes (null invite), já aceitos ou
 * expirados devem ser rejeitados com a mensagem de erro apropriada.
 *
 * **Validates: Requirements 5.5**
 */

/** Arbitrary: 6-char alphanumeric code. */
const inviteCodeArb = fc.stringMatching(/^[A-Za-z0-9]{6}$/);

/** Arbitrary: UUID-like string for `aceito_por`. */
const uuidArb = fc.uuid();

/** Arbitrary: a reference "now" date within a reasonable range. */
const nowArb = fc.integer({
  min: new Date('2020-01-01T00:00:00Z').getTime(),
  max: new Date('2030-12-31T23:59:59Z').getTime(),
}).map((ts) => new Date(ts));

describe('Feature: google-oauth-migration, Property 4: Validação de código de convite de filho', () => {
  it('returns INVALID_CODE when invite is null', () => {
    fc.assert(
      fc.property(inviteCodeArb, nowArb, (code, now) => {
        const result = validateChildInviteCode(code, null, now);
        expect(result).toEqual({ valid: false, error: 'INVALID_CODE' });
      }),
      { numRuns: 100 },
    );
  });

  it('returns ALREADY_LINKED when aceito_por is not null', () => {
    fc.assert(
      fc.property(
        inviteCodeArb,
        uuidArb,
        nowArb,
        fc.integer({
          min: new Date('2020-01-01T00:00:00Z').getTime(),
          max: new Date('2040-12-31T23:59:59Z').getTime(),
        }).map((ts) => new Date(ts)),
        (code, aceitoPor, now, expiresDate) => {
          const invite: InviteRecord = {
            aceito_por: aceitoPor,
            expira_em: expiresDate.toISOString(),
          };
          const result = validateChildInviteCode(code, invite, now);
          expect(result).toEqual({ valid: false, error: 'ALREADY_LINKED' });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns EXPIRED_CODE when expira_em <= now and aceito_por is null', () => {
    fc.assert(
      fc.property(
        inviteCodeArb,
        nowArb,
        // offset in ms: 0 to 365 days in the past
        fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }),
        (code, now, offsetMs) => {
          // expira_em is at or before now
          const expiresAt = new Date(now.getTime() - offsetMs);
          const invite: InviteRecord = {
            aceito_por: null,
            expira_em: expiresAt.toISOString(),
          };
          const result = validateChildInviteCode(code, invite, now);
          expect(result).toEqual({ valid: false, error: 'EXPIRED_CODE' });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns valid when aceito_por is null AND expira_em > now', () => {
    fc.assert(
      fc.property(
        inviteCodeArb,
        nowArb,
        // offset in ms: 1ms to 30 days in the future (strictly after now)
        fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }),
        (code, now, offsetMs) => {
          const expiresAt = new Date(now.getTime() + offsetMs);
          const invite: InviteRecord = {
            aceito_por: null,
            expira_em: expiresAt.toISOString(),
          };
          const result = validateChildInviteCode(code, invite, now);
          expect(result).toEqual({ valid: true });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for ANY invite state, validateChildInviteCode returns the correct result based on priority: null → INVALID_CODE, aceito_por → ALREADY_LINKED, expired → EXPIRED_CODE, else valid', () => {
    const inviteOrNullArb = fc.oneof(
      fc.constant(null),
      fc.record({
        aceito_por: fc.oneof(fc.constant(null), uuidArb),
        expira_em: fc
          .integer({
            min: new Date('2020-01-01T00:00:00Z').getTime(),
            max: new Date('2040-12-31T23:59:59Z').getTime(),
          })
          .map((ts) => new Date(ts).toISOString()),
      }),
    );

    fc.assert(
      fc.property(inviteCodeArb, inviteOrNullArb, nowArb, (code, invite, now) => {
        const result = validateChildInviteCode(code, invite, now);

        if (invite === null) {
          expect(result).toEqual({ valid: false, error: 'INVALID_CODE' });
        } else if (invite.aceito_por !== null) {
          expect(result).toEqual({ valid: false, error: 'ALREADY_LINKED' });
        } else if (new Date(invite.expira_em) <= now) {
          expect(result).toEqual({ valid: false, error: 'EXPIRED_CODE' });
        } else {
          expect(result).toEqual({ valid: true });
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: google-oauth-migration, Property 5: Mapeamento de erros OAuth para mensagens localizadas
 *
 * Para qualquer código de erro retornado pelo Google Sign-In SDK ou pelo Supabase Auth,
 * a função `localizeOAuthError(error)` SHALL retornar uma mensagem em português brasileiro
 * sem expor dados técnicos sensíveis. Erros de cancelamento devem retornar `null` (sem mensagem).
 * Erros de rede devem retornar a mensagem de conectividade. Erros de servidor devem retornar
 * a mensagem de indisponibilidade.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
 */

/** Known pt-BR messages that localizeOAuthError may return for SupabaseAuthError inputs. */
const KNOWN_PT_BR_MESSAGES = new Set([
  'Não foi possível verificar seu e-mail. Use outra conta Google.',
  'Esta conta já está vinculada a outro método de login. Faça login com e-mail/senha e vincule sua conta Google nas configurações.',
  'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
  'O serviço do Google está temporariamente indisponível. Tente novamente em alguns minutos.',
  'Erro na autenticação. Tente novamente.',
]);

/** Patterns that indicate leaked technical data (tokens, stack traces, raw codes). */
const TECHNICAL_DATA_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}/,       // JWT tokens
  /Bearer\s+\S+/i,                // Authorization headers
  /at\s+\S+\s+\(.+:\d+:\d+\)/,   // Stack trace lines
  /[A-Za-z0-9+/]{40,}={0,2}/,     // Base64-encoded blobs (40+ chars)
  /\b[0-9a-f]{32,}\b/,            // Hex hashes (32+ chars)
  /status(?:Code)?[:=]\s*\d{3}/i, // Raw status codes like "statusCode: 500"
];

/** Arbitrary: random GoogleAuthResult of type 'cancelled'. */
const cancelledResultArb: fc.Arbitrary<GoogleAuthResult> = fc.constant({
  type: 'cancelled' as const,
});

/** Arbitrary: random GoogleAuthResult of type 'success'. */
const successResultArb: fc.Arbitrary<GoogleAuthResult> = fc.record({
  type: fc.constant('success' as const),
  idToken: fc.string({ minLength: 10, maxLength: 100 }),
  user: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    email: fc.emailAddress(),
  }),
});

/** Arbitrary: random GoogleAuthResult of type 'error'. */
const errorResultArb: fc.Arbitrary<GoogleAuthResult> = fc.record({
  type: fc.constant('error' as const),
  message: fc.string({ minLength: 1, maxLength: 200 }),
});

/** Arbitrary: random SupabaseAuthError with varied messages and status codes. */
const supabaseAuthErrorArb: fc.Arbitrary<SupabaseAuthError> = fc.record({
  message: fc.oneof(
    // Known trigger keywords
    fc.constant('email_verified is false'),
    fc.constant('email not confirmed'),
    fc.constant('provider already linked to another user'),
    fc.constant('rate limit exceeded'),
    fc.constant('too many requests'),
    fc.constant('network error'),
    fc.constant('timeout waiting for response'),
    fc.constant('connection refused'),
    fc.constant('no internet connection'),
    fc.constant('500 internal server error'),
    fc.constant('503 service unavailable'),
    fc.constant('server error'),
    // Random messages that should fall through to the default
    fc.string({ minLength: 0, maxLength: 200 }),
  ),
  status: fc.option(
    fc.oneof(
      fc.constant(429),
      fc.constant(400),
      fc.constant(401),
      fc.constant(403),
      fc.constant(500),
      fc.constant(503),
      fc.nat({ max: 599 }),
    ),
    { nil: undefined },
  ),
});

describe('Feature: google-oauth-migration, Property 5: Mapeamento de erros OAuth para mensagens localizadas', () => {
  it('returns null for cancelled GoogleAuthResult (no error message shown)', () => {
    fc.assert(
      fc.property(cancelledResultArb, (result) => {
        expect(localizeOAuthError(result)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns null for success GoogleAuthResult (not an error)', () => {
    fc.assert(
      fc.property(successResultArb, (result) => {
        expect(localizeOAuthError(result)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns a non-null string for error GoogleAuthResult', () => {
    fc.assert(
      fc.property(errorResultArb, (result) => {
        const msg = localizeOAuthError(result);
        expect(msg).not.toBeNull();
        expect(typeof msg).toBe('string');
        expect((msg as string).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('returns a non-null pt-BR string from the known set for any SupabaseAuthError', () => {
    fc.assert(
      fc.property(supabaseAuthErrorArb, (error) => {
        const msg = localizeOAuthError(error);
        expect(msg).not.toBeNull();
        expect(typeof msg).toBe('string');
        expect(KNOWN_PT_BR_MESSAGES.has(msg as string)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('never leaks technical data (tokens, stack traces, raw codes) in SupabaseAuthError messages', () => {
    fc.assert(
      fc.property(supabaseAuthErrorArb, (error) => {
        const msg = localizeOAuthError(error);
        if (msg === null) return;

        for (const pattern of TECHNICAL_DATA_PATTERNS) {
          expect(msg).not.toMatch(pattern);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('maps network-related SupabaseAuthErrors to the connectivity message', () => {
    const networkErrorArb = fc.constantFrom(
      'network error',
      'timeout waiting for response',
      'connection refused',
      'no internet connection',
      'Network request failed',
      'TIMEOUT: connection timed out',
    ).map((message) => ({ message }));

    fc.assert(
      fc.property(networkErrorArb, (error) => {
        const msg = localizeOAuthError(error);
        expect(msg).toBe(
          'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
        );
      }),
      { numRuns: 100 },
    );
  });

  it('maps server-related SupabaseAuthErrors to the unavailability message', () => {
    const serverErrorArb = fc.constantFrom(
      '500 internal server error',
      '503 service unavailable',
      'server error occurred',
    ).map((message) => ({ message }));

    fc.assert(
      fc.property(serverErrorArb, (error) => {
        const msg = localizeOAuthError(error);
        expect(msg).toBe(
          'O serviço do Google está temporariamente indisponível. Tente novamente em alguns minutos.',
        );
      }),
      { numRuns: 100 },
    );
  });

  it('maps rate-limit SupabaseAuthErrors (status 429 or message) to the rate-limit message', () => {
    const rateLimitArb = fc.oneof(
      fc.constant({ message: 'rate limit exceeded', status: 429 }),
      fc.constant({ message: 'too many requests', status: 429 }),
      fc.constant({ message: 'some error', status: 429 }),
      fc.constant({ message: 'rate limit reached' }),
      fc.constant({ message: 'too many attempts' }),
    );

    fc.assert(
      fc.property(rateLimitArb, (error) => {
        const msg = localizeOAuthError(error);
        expect(msg).toBe(
          'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        );
      }),
      { numRuns: 100 },
    );
  });
});
