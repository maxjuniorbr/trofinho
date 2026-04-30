import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { resolveNavDecision } from './nav-guard';
import type { UserProfile } from './auth';

/**
 * Feature: forgot-password, Property 6: Nav guard allows reset-password route for any auth state
 *
 * For any user profile state (null, undefined, admin with familia_id, admin
 * without familia_id, filho with familia_id, filho without familia_id),
 * when the current route segments are `['(auth)', 'reset-password']`,
 * `resolveNavDecision` SHALL return `null` (no redirect).
 *
 * **Validates: Requirements 6.1, 6.2**
 */

describe('Feature: forgot-password, Property 6: Nav guard allows reset-password route for any auth state', () => {
  it('for any profile state, resolveNavDecision returns null when segments are [(auth), reset-password]', () => {
    const profileArb: fc.Arbitrary<UserProfile | null | undefined> = fc.oneof(
      // null — signed out
      fc.constant(null),
      // undefined — loading
      fc.constant(undefined),
      // admin with familia_id
      fc.record({
        id: fc.uuid(),
        familia_id: fc.string({ minLength: 1 }),
        papel: fc.constant('admin' as const),
        nome: fc.string({ minLength: 1 }),
        avatarUrl: fc.oneof(fc.constant(null), fc.string()),
      }),
      // admin without familia_id
      fc.record({
        id: fc.uuid(),
        familia_id: fc.constant(''),
        papel: fc.constant('admin' as const),
        nome: fc.string({ minLength: 1 }),
        avatarUrl: fc.oneof(fc.constant(null), fc.string()),
      }),
      // filho with familia_id
      fc.record({
        id: fc.uuid(),
        familia_id: fc.string({ minLength: 1 }),
        papel: fc.constant('filho' as const),
        nome: fc.string({ minLength: 1 }),
        avatarUrl: fc.oneof(fc.constant(null), fc.string()),
      }),
      // filho without familia_id
      fc.record({
        id: fc.uuid(),
        familia_id: fc.constant(''),
        papel: fc.constant('filho' as const),
        nome: fc.string({ minLength: 1 }),
        avatarUrl: fc.oneof(fc.constant(null), fc.string()),
      }),
    );

    fc.assert(
      fc.property(profileArb, (profile) => {
        const result = resolveNavDecision(true, profile, ['(auth)', 'reset-password']);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
