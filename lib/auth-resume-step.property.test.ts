import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import { getCurrentAuthUser } from './auth';
import { resolveStorageUrl } from './storage';

/**
 * Feature: onboarding-resume-step
 * Property 1: Bug Condition — Retomada no passo correto quando date_of_birth existe
 *
 * Para qualquer entrada onde o usuário autenticado possui `date_of_birth`
 * não-nulo e não-vazio no `user_metadata` (isBugCondition retorna true),
 * `getCurrentAuthUser()` SHALL retornar o campo `dateOfBirth` com o valor
 * correto extraído de `user_metadata.date_of_birth`.
 *
 * **Validates: Requirements 1.3, 2.1, 2.3**
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const storageBucketMock = vi.hoisted(() => ({
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed-url' },
    error: null,
  }),
}));

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
  storage: {
    from: vi.fn(),
  },
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('./storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('./storage')>();
  return {
    ...original,
    resolveStorageUrl: vi.fn().mockResolvedValue(null),
  };
});

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates valid date strings in YYYY-MM-DD format using fc.date()
 * constrained to reasonable birth dates.
 */
const dateOfBirthArb = fc
  .date({
    min: new Date('1920-01-01'),
    max: new Date('2020-12-31'),
  })
  .map((d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Feature: onboarding-resume-step, Property 1: Bug Condition — getCurrentAuthUser expõe dateOfBirth', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.storage.from.mockReset();
    supabaseMock.storage.from.mockReturnValue(storageBucketMock);
  });

  it('returns dateOfBirth when user_metadata.date_of_birth exists (YYYY-MM-DD strings)', async () => {
    await fc.assert(
      fc.asyncProperty(dateOfBirthArb, async (dateOfBirth) => {
        supabaseMock.auth.getUser.mockResolvedValue({
          data: {
            user: {
              id: 'u1',
              email: 'test@example.com',
              email_confirmed_at: '2024-01-01T00:00:00Z',
              user_metadata: {
                date_of_birth: dateOfBirth,
              },
            },
          },
          error: null,
        });

        const result = await getCurrentAuthUser();

        expect(result).not.toBeNull();
        expect(result).toHaveProperty('dateOfBirth');
        expect(result!.dateOfBirth).toBe(dateOfBirth);
      }),
      { numRuns: 100 },
    );
  });
});


// ── Arbitraries (Preservation) ───────────────────────────────────────────────

/** Arbitrary: random email address. */
const emailArb = fc.emailAddress();

/** Arbitrary: optional avatar_url (web URL or absent). */
const avatarUrlArb = fc.option(fc.webUrl(), { nil: undefined });

/** Arbitrary: optional email_confirmed_at (ISO date string or absent). */
const emailConfirmedAtArb = fc.option(
  fc
    .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
    .map((ts) => new Date(ts).toISOString()),
  { nil: undefined },
);

// ── Tests (Preservation) ─────────────────────────────────────────────────────

/**
 * Feature: onboarding-resume-step
 * Property 2: Preservation — Campos existentes preservados sem date_of_birth
 *
 * Para qualquer `user_metadata` SEM `date_of_birth` (isBugCondition retorna false),
 * os campos `email`, `avatarUrl` e `emailConfirmedAt` devem ser retornados com os
 * mesmos valores que no código original.
 *
 * **Validates: Requirements 3.1, 3.2, 3.5**
 */

describe('Feature: onboarding-resume-step, Property 2: Preservation — Campos existentes preservados sem date_of_birth', () => {
  const resolveStorageUrlMock = vi.mocked(resolveStorageUrl);

  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    resolveStorageUrlMock.mockReset();
  });

  it('preserves email, avatarUrl and emailConfirmedAt for user_metadata without date_of_birth', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        avatarUrlArb,
        emailConfirmedAtArb,
        async (email, avatarUrl, emailConfirmedAt) => {
          const userMetadata: Record<string, unknown> = {};
          if (avatarUrl !== undefined) {
            userMetadata.avatar_url = avatarUrl;
          }

          // When avatar_url is provided, resolveStorageUrl returns a signed URL;
          // otherwise it returns null (no avatar to resolve).
          const expectedResolvedAvatar = avatarUrl ? `https://signed/${avatarUrl}` : null;
          resolveStorageUrlMock.mockResolvedValue(expectedResolvedAvatar);

          supabaseMock.auth.getUser.mockResolvedValue({
            data: {
              user: {
                id: 'u1',
                email,
                email_confirmed_at: emailConfirmedAt,
                user_metadata: userMetadata,
              },
            },
            error: null,
          });

          const result = await getCurrentAuthUser();

          expect(result).not.toBeNull();
          expect(result!.email).toBe(email);
          expect(result!.avatarUrl).toBe(expectedResolvedAvatar);
          expect(result!.emailConfirmedAt).toBe(emailConfirmedAt ?? null);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when auth returns an error', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (errorMessage) => {
        supabaseMock.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: errorMessage },
        });

        const result = await getCurrentAuthUser();

        expect(result).toBeNull();
      }),
      { numRuns: 50 },
    );
  });
});
