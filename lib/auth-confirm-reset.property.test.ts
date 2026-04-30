import { describe, expect, it, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

import { confirmPasswordReset } from './auth';

/**
 * Feature: forgot-password, Property 3: confirmPasswordReset executes setSession then updateUser then signOut
 *
 * For any valid access token, refresh token, and password (≥8 characters),
 * calling `confirmPasswordReset` SHALL first call `supabase.auth.setSession`,
 * then call `supabase.auth.updateUser` with the new password, then call
 * `supabase.auth.signOut` with `{ scope: 'local' }`, in that exact order.
 *
 * **Validates: Requirements 4.2**
 */

const callOrder: string[] = [];

const setSessionMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      setSession: setSessionMock,
      updateUser: updateUserMock,
      signOut: signOutMock,
    },
  },
}));

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('Feature: forgot-password, Property 3: confirmPasswordReset executes setSession then updateUser then signOut', () => {
  beforeEach(() => {
    callOrder.length = 0;

    setSessionMock.mockImplementation(async () => {
      callOrder.push('setSession');
      return { data: { user: {}, session: {} }, error: null };
    });

    updateUserMock.mockImplementation(async () => {
      callOrder.push('updateUser');
      return { data: { user: {} }, error: null };
    });

    signOutMock.mockImplementation(async () => {
      callOrder.push('signOut');
      return { error: null };
    });
  });

  it('for any valid tokens and password (≥8 chars), the three Supabase calls happen in exact order: setSession → updateUser → signOut', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 8 }),
        async (accessToken, refreshToken, password) => {
          callOrder.length = 0;

          const result = await confirmPasswordReset(accessToken, refreshToken, password);

          expect(result).toEqual({ error: null });
          expect(callOrder).toEqual(['setSession', 'updateUser', 'signOut']);
        },
      ),
      { numRuns: 100 },
    );
  });
});
