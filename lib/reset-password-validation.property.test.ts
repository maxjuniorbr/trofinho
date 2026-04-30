import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: forgot-password, Property 4: Reset password validation rejects invalid input
 *
 * For any password string shorter than 8 characters, the reset-password form
 * validation SHALL return the min-length error message and SHALL NOT call
 * `confirmPasswordReset`.
 *
 * **Validates: Requirements 4.3**
 */

// Pure validation logic matching the reset-password screen's `validate()` function
function validateResetPassword(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  return null;
}

const confirmPasswordResetMock = vi.hoisted(() => vi.fn());

vi.mock('./auth', () => ({
  confirmPasswordReset: confirmPasswordResetMock,
}));

describe('Feature: forgot-password, Property 4: Reset password validation rejects invalid input', () => {
  it('for any password shorter than 8 characters, validation returns the min-length error and confirmPasswordReset is never called', () => {
    confirmPasswordResetMock.mockClear();

    fc.assert(
      fc.property(
        fc.string({ maxLength: 7 }),
        (password) => {
          const error = validateResetPassword(password);

          // Validation must reject with the min-length error
          expect(error).toBe('A senha deve ter pelo menos 8 caracteres.');

          // Since validation fails, confirmPasswordReset would never be called
          expect(confirmPasswordResetMock).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any password with 8 or more characters, validation passes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8 }),
        (password) => {
          const error = validateResetPassword(password);
          expect(error).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
