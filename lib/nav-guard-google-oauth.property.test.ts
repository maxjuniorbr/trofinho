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
  'join-family',
  'join-child',
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

/**
 * Feature: admin-onboarding-journey, Property 1: Tabela de decisão do Guarda de Navegação
 *
 * Para qualquer combinação de `(ready, profile, segments, isImpersonating)`,
 * `resolveNavDecision()` SHALL retornar o `NavTarget` correto de acordo com a
 * tabela de decisão completa:
 *
 * - Se `ready` é `false` → `null`
 * - Se `profile` é `null` e está em rota auth → `null`
 * - Se `profile` é `null` e NÃO está em rota auth → `'/(auth)/login'`
 * - Se `profile` é `undefined` → `null`
 * - Se `profile.familia_id` é vazio e segmento é passthrough → `null`
 * - Se `profile.familia_id` é vazio e segmento não é passthrough → `'/(auth)/onboarding'`
 * - Se `profile.familia_id` é preenchido e está em rota auth → role home
 * - Se `profile.familia_id` é preenchido e está no grupo correto → `null`
 * - Se `profile.familia_id` é preenchido e está no grupo errado → role home
 *
 * **Validates: Requirements 1.1, 8.5, 12.1, 12.2, 13.2, 13.3, 14.1, 14.2, 15.1, 16.2, 17.2, 19.1, 19.2, 22.1, 22.2, 22.3**
 */

// ---------------------------------------------------------------------------
// Arbitraries for the complete decision table
// ---------------------------------------------------------------------------

/** Non-empty familia_id (UUID-like). */
const filledFamiliaId = fc.uuid();

/** Admin profile with a family. */
const adminWithFamilyArb: fc.Arbitrary<UserProfile> = fc.record({
  id: fc.uuid(),
  familia_id: filledFamiliaId,
  papel: fc.constant('admin' as const),
  nome: fc.string({ minLength: 1, maxLength: 50 }),
  avatarUrl: fc.option(fc.webUrl(), { nil: null }),
});

/** Child profile with a family. */
const childWithFamilyArb: fc.Arbitrary<UserProfile> = fc.record({
  id: fc.uuid(),
  familia_id: filledFamiliaId,
  papel: fc.constant('filho' as const),
  nome: fc.string({ minLength: 1, maxLength: 50 }),
  avatarUrl: fc.option(fc.webUrl(), { nil: null }),
});

/** Orphan profile (no family). */
const orphanArb: fc.Arbitrary<UserProfile> = fc.record({
  id: fc.uuid(),
  familia_id: fc.constant(''),
  papel: fc.constantFrom('admin' as const, 'filho' as const),
  nome: fc.string({ minLength: 1, maxLength: 50 }),
  avatarUrl: fc.option(fc.webUrl(), { nil: null }),
});

/** Any profile state: null, undefined, admin w/ family, child w/ family, orphan. */
const profileStateArb: fc.Arbitrary<UserProfile | null | undefined> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  adminWithFamilyArb,
  childWithFamilyArb,
  orphanArb,
);

/** Auth sub-route segments (second element when group is (auth)). */
const authSubRouteArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('login', 'onboarding', 'join-family', 'join-child'),
  fc.string({ minLength: 1, maxLength: 20 }),
);

/** Non-auth sub-route segments. */
const appSubRouteArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('index', 'tasks', 'balance', 'children', 'prizes', 'notifications', 'historico', 'redemptions'),
  fc.string({ minLength: 1, maxLength: 20 }),
);

/** Segments arbitrary covering all route group patterns and empty segments. */
const segmentsArb: fc.Arbitrary<string[]> = fc.oneof(
  // Empty segments
  fc.constant([] as string[]),
  // Root-level segment (e.g. ['index'])
  fc.constant(['index'] as string[]),
  // Auth group with sub-route
  authSubRouteArb.map((sub) => ['(auth)', sub]),
  // Auth group alone
  fc.constant(['(auth)'] as string[]),
  // Admin group with optional sub-route
  fc.oneof(
    fc.constant(['(admin)'] as string[]),
    appSubRouteArb.map((sub) => ['(admin)', sub]),
  ),
  // Child group with optional sub-route
  fc.oneof(
    fc.constant(['(child)'] as string[]),
    appSubRouteArb.map((sub) => ['(child)', sub]),
  ),
);

const passthroughSet = new Set<string>(AUTH_PASSTHROUGH_ROUTES);

/**
 * Reference implementation of the decision table.
 * This mirrors the logic documented in the design document.
 */
function expectedDecision(
  ready: boolean,
  profile: UserProfile | null | undefined,
  segments: string[],
  isImpersonating: boolean,
): string | null {
  // Row 1: not ready → null
  if (!ready) return null;

  const inAuth = segments[0] === '(auth)';
  const seg1 = segments[1] as string | undefined;

  // Row 2-3: profile is null
  if (profile === null) {
    return inAuth ? null : '/(auth)/login';
  }

  // Row 4: profile is undefined (loading)
  if (profile === undefined) return null;

  const roleHome = profile.papel === 'admin' ? '/(admin)/' : '/(child)/';

  // Row 5-6: orphan (no familia_id)
  if (!profile.familia_id) {
    return passthroughSet.has(seg1 ?? '') ? null : '/(auth)/onboarding';
  }

  // Row 7: in auth with family → role home
  if (inAuth) return roleHome;

  // Row 8: in correct route group → null
  const group = segments[0];
  if (group === '(admin)' && profile.papel === 'admin') return null;
  if (group === '(child)' && (profile.papel === 'filho' || isImpersonating)) return null;

  // Row 9: wrong group → role home
  return roleHome;
}

describe('Feature: admin-onboarding-journey, Property 1: Tabela de decisão do Guarda de Navegação', () => {
  it('matches the complete decision table for all random input combinations', () => {
    fc.assert(
      fc.property(
        fc.boolean(),          // ready
        profileStateArb,       // profile
        segmentsArb,           // segments
        fc.boolean(),          // isImpersonating
        (ready, profile, segments, isImpersonating) => {
          const actual = resolveNavDecision(ready, profile, segments, isImpersonating);
          const expected = expectedDecision(ready, profile, segments, isImpersonating);

          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('returns null when ready is false, regardless of other inputs', () => {
    fc.assert(
      fc.property(
        profileStateArb,
        segmentsArb,
        fc.boolean(),
        (profile, segments, isImpersonating) => {
          const result = resolveNavDecision(false, profile, segments, isImpersonating);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when profile is undefined (loading), regardless of other inputs', () => {
    fc.assert(
      fc.property(
        segmentsArb,
        fc.boolean(),
        (segments, isImpersonating) => {
          const result = resolveNavDecision(true, undefined, segments, isImpersonating);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects to login when profile is null and not in auth group', () => {
    const nonAuthSegmentsArb = segmentsArb.filter((s) => s[0] !== '(auth)');

    fc.assert(
      fc.property(
        nonAuthSegmentsArb,
        (segments) => {
          const result = resolveNavDecision(true, null, segments);
          expect(result).toBe('/(auth)/login');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when profile is null and already in auth group', () => {
    const authSegmentsArb = segmentsArb.filter((s) => s[0] === '(auth)');

    fc.assert(
      fc.property(
        authSegmentsArb,
        (segments) => {
          const result = resolveNavDecision(true, null, segments);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects admin with family to /(admin)/ when on auth route', () => {
    fc.assert(
      fc.property(
        adminWithFamilyArb,
        authSubRouteArb,
        fc.boolean(),
        (profile, subRoute, isImpersonating) => {
          const segments = ['(auth)', subRoute];
          const result = resolveNavDecision(true, profile, segments, isImpersonating);
          expect(result).toBe('/(admin)/');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects child with family to /(child)/ when on auth route', () => {
    fc.assert(
      fc.property(
        childWithFamilyArb,
        authSubRouteArb,
        fc.boolean(),
        (profile, subRoute, isImpersonating) => {
          const segments = ['(auth)', subRoute];
          const result = resolveNavDecision(true, profile, segments, isImpersonating);
          expect(result).toBe('/(child)/');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when admin is in the (admin) group (correct group)', () => {
    fc.assert(
      fc.property(
        adminWithFamilyArb,
        appSubRouteArb,
        fc.boolean(),
        (profile, subRoute, isImpersonating) => {
          const segments = ['(admin)', subRoute];
          const result = resolveNavDecision(true, profile, segments, isImpersonating);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when child is in the (child) group (correct group)', () => {
    fc.assert(
      fc.property(
        childWithFamilyArb,
        appSubRouteArb,
        fc.boolean(),
        (profile, subRoute, isImpersonating) => {
          const segments = ['(child)', subRoute];
          const result = resolveNavDecision(true, profile, segments, isImpersonating);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects admin to /(admin)/ when in wrong group (child) without impersonation', () => {
    fc.assert(
      fc.property(
        adminWithFamilyArb,
        appSubRouteArb,
        (profile, subRoute) => {
          const segments = ['(child)', subRoute];
          const result = resolveNavDecision(true, profile, segments, false);
          expect(result).toBe('/(admin)/');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when admin is in (child) group with impersonation enabled', () => {
    fc.assert(
      fc.property(
        adminWithFamilyArb,
        appSubRouteArb,
        (profile, subRoute) => {
          const segments = ['(child)', subRoute];
          const result = resolveNavDecision(true, profile, segments, true);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects child to /(child)/ when in wrong group (admin), even with impersonation', () => {
    fc.assert(
      fc.property(
        childWithFamilyArb,
        appSubRouteArb,
        fc.boolean(),
        (profile, subRoute, isImpersonating) => {
          const segments = ['(admin)', subRoute];
          const result = resolveNavDecision(true, profile, segments, isImpersonating);
          expect(result).toBe('/(child)/');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('redirects users with family to role home when segments are empty or unrecognized group', () => {
    const profileArb = fc.oneof(adminWithFamilyArb, childWithFamilyArb);
    const emptyOrUnknownSegments = fc.oneof(
      fc.constant([] as string[]),
      fc.constant(['index'] as string[]),
      fc.string({ minLength: 1, maxLength: 20 })
        .filter((s) => !['(auth)', '(admin)', '(child)'].includes(s))
        .map((s) => [s]),
    );

    fc.assert(
      fc.property(
        profileArb,
        emptyOrUnknownSegments,
        fc.boolean(),
        (profile, segments, isImpersonating) => {
          const result = resolveNavDecision(true, profile, segments, isImpersonating);
          const expectedHome = profile.papel === 'admin' ? '/(admin)/' : '/(child)/';
          expect(result).toBe(expectedHome);
        },
      ),
      { numRuns: 100 },
    );
  });
});
