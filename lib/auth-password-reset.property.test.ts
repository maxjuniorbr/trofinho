import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import { requestPasswordReset } from './auth';

/**
 * Feature: forgot-password, Property 1: Password reset request never leaks email existence
 *
 * For any email string (valid or invalid format, registered or unregistered),
 * calling `requestPasswordReset` SHALL always return `{ error: null }` when the
 * Supabase API call succeeds — the caller cannot distinguish between an existing
 * and non-existing email.
 *
 * **Validates: Requirements 1.3, 1.4**
 */

const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  },
}));

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('Feature: forgot-password, Property 1: Password reset request never leaks email existence', () => {
  it('for any email string, when Supabase API succeeds, requestPasswordReset returns { error: null }', () => {
    // Mock supabase.auth.resetPasswordForEmail to always return success
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    fc.assert(
      fc.asyncProperty(fc.string(), async (email) => {
        const result = await requestPasswordReset(email);
        expect(result).toEqual({ error: null });
      }),
      { numRuns: 100 },
    );
  });
});
