import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import { createAuthStateHandler } from './auth-state';

/**
 * Feature: forgot-password, Property 5: PASSWORD_RECOVERY event suppresses profile loading
 *
 * For any Supabase session object, when the auth state handler receives a
 * PASSWORD_RECOVERY event, it SHALL NOT invoke `onProfileChange` or
 * `onReadyChange` callbacks — the event is silently suppressed with only a
 * Sentry breadcrumb.
 *
 * **Validates: Requirements 5.1, 5.3**
 */

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('Feature: forgot-password, Property 5: PASSWORD_RECOVERY event suppresses profile loading', () => {
  const getProfile = vi.fn();
  const onProfileChange = vi.fn();
  const onReadyChange = vi.fn();
  const onSignOut = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    getProfile.mockReset();
    onProfileChange.mockReset();
    onReadyChange.mockReset();
    onSignOut.mockReset();
  });

  it('for any session object, PASSWORD_RECOVERY event never calls onProfileChange or onReadyChange', async () => {
    const sessionArb = fc.record({
      access_token: fc.string({ minLength: 1 }),
      refresh_token: fc.string({ minLength: 1 }),
      expires_in: fc.nat(),
      token_type: fc.constant('bearer'),
      user: fc.record({
        id: fc.uuid(),
        email: fc.emailAddress(),
        aud: fc.string(),
        role: fc.string(),
        created_at: fc.string(),
      }),
    });

    await fc.assert(
      fc.asyncProperty(sessionArb, async (session) => {
        onProfileChange.mockReset();
        onReadyChange.mockReset();
        getProfile.mockReset();

        const handler = createAuthStateHandler({
          getProfile,
          validateSession: vi.fn().mockResolvedValue(true),
          onProfileChange,
          onReadyChange,
          onSignOut,
        });

        handler.handleAuthStateChange('PASSWORD_RECOVERY', session as never);

        // Flush any pending timers to ensure deferred calls would have fired
        await vi.runAllTimersAsync();

        expect(onProfileChange).not.toHaveBeenCalled();
        expect(onReadyChange).not.toHaveBeenCalled();
        expect(getProfile).not.toHaveBeenCalled();

        handler.dispose();
      }),
      { numRuns: 100 },
    );
  });
});
