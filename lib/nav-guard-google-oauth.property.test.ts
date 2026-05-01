import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { resolveNavDecision } from './nav-guard';
import type { UserProfile } from './auth';

/**
 * Feature: google-oauth-migration, Property 2: Nav Guard redireciona usuários órfãos para onboarding
 *
 * Para qualquer combinação de segmentos de rota e perfil com `familia_id` vazio,
 * `resolveNavDecision()` SHALL retornar `'/(auth)/onboarding'` — exceto quando o
 * segmento atual é uma rota passthrough (`onboarding`, `register`, `join-family`,
 * `join-child`, `reset-password`), caso em que deve retornar `null`.
 *
 * **Validates: Requirements 1.3**
 */

/** The passthrough routes that bypass the orphan → onboarding redirect. */
const AUTH_PASSTHROUGH_ROUTES = [
  'onboarding',
  'register',
  'join-family',
  'join-child',
  'reset-password',
] as const;

/** Non-passthrough route segments that should trigger the onboarding redirect. */
const NON_PASSTHROUGH_SEGMENTS = [
  'login',
  'forgot-password',
  'perfil',
  'index',
  'tasks',
  'balance',
  'children',
  'prizes',
  'notifications',
  'historico',
  'redemptions',
] as const;

/** Route group prefixes used in the app. */
const ROUTE_GROUPS = ['(auth)', '(admin)', '(child)'] as const;

/** Arbitrary: orphan UserProfile with familia_id = '' */
const orphanProfileArb: fc.Arbitrary<UserProfile> = fc.record({
  id: fc.uuid(),
  familia_id: fc.constant(''),
  papel: fc.constantFrom('admin' as const, 'filho' as const),
  nome: fc.string({ minLength: 1, maxLength: 50 }),
  avatarUrl: fc.option(fc.webUrl(), { nil: null }),
});

/** Arbitrary: random non-passthrough route segment. */
const nonPassthroughSegmentArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...NON_PASSTHROUGH_SEGMENTS),
  // Also generate random strings that are NOT passthrough routes
  fc.string({ minLength: 1, maxLength: 30 }).filter(
    (s) => !(AUTH_PASSTHROUGH_ROUTES as readonly string[]).includes(s) && s.length > 0,
  ),
);

/** Arbitrary: random route group. */
const routeGroupArb: fc.Arbitrary<string> = fc.constantFrom(...ROUTE_GROUPS);

describe('Feature: google-oauth-migration, Property 2: Nav Guard redireciona usuários órfãos para onboarding', () => {
  it('redirects orphan users to onboarding for any non-passthrough route segment', () => {
    fc.assert(
      fc.property(
        orphanProfileArb,
        routeGroupArb,
        nonPassthroughSegmentArb,
        (profile, group, segment) => {
          const segments = [group, segment];
          const result = resolveNavDecision(true, profile, segments);

          expect(result).toBe('/(auth)/onboarding');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null (no redirect) for orphan users on passthrough routes', () => {
    const passthroughArb = fc.constantFrom(...AUTH_PASSTHROUGH_ROUTES);

    fc.assert(
      fc.property(
        orphanProfileArb,
        routeGroupArb,
        passthroughArb,
        (profile, group, passthroughRoute) => {
          const segments = [group, passthroughRoute];
          const result = resolveNavDecision(true, profile, segments);

          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects orphan users to onboarding when segments have no second element (root route)', () => {
    fc.assert(
      fc.property(
        orphanProfileArb,
        routeGroupArb,
        (profile, group) => {
          const segments = [group];
          const result = resolveNavDecision(true, profile, segments);

          // seg1 is undefined → AUTH_PASSTHROUGH_ROUTES.has(undefined ?? '') → false
          // So it should redirect to onboarding
          expect(result).toBe('/(auth)/onboarding');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects orphan users to onboarding when segments are empty', () => {
    fc.assert(
      fc.property(
        orphanProfileArb,
        (profile) => {
          const segments: string[] = [];
          const result = resolveNavDecision(true, profile, segments);

          expect(result).toBe('/(auth)/onboarding');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for ANY orphan profile and ANY segments, resolveNavDecision returns onboarding IFF seg1 is NOT a passthrough route', () => {
    const passthroughSet = new Set<string>(AUTH_PASSTHROUGH_ROUTES);

    const anySegmentArb: fc.Arbitrary<string> = fc.oneof(
      fc.constantFrom(...AUTH_PASSTHROUGH_ROUTES),
      fc.constantFrom(...NON_PASSTHROUGH_SEGMENTS),
      fc.string({ minLength: 0, maxLength: 30 }),
    );

    const segmentsArb: fc.Arbitrary<string[]> = fc.tuple(
      routeGroupArb,
      fc.option(anySegmentArb, { nil: undefined }),
    ).map(([group, seg1]) => seg1 !== undefined ? [group, seg1] : [group]);

    fc.assert(
      fc.property(
        orphanProfileArb,
        segmentsArb,
        (profile, segments) => {
          const result = resolveNavDecision(true, profile, segments);
          const seg1 = segments[1] as string | undefined;

          if (passthroughSet.has(seg1 ?? '')) {
            expect(result).toBeNull();
          } else {
            expect(result).toBe('/(auth)/onboarding');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
