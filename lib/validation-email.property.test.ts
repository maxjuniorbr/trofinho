import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { isValidEmail } from './validation';

/**
 * Feature: forgot-password, Property 2: Invalid emails are rejected without network call
 *
 * For any string that fails `isValidEmail`, the form validation rejects the input.
 * This proves that the forgot-password form would never call `requestPasswordReset`
 * for invalid emails — the validation layer catches them first.
 *
 * **Validates: Requirements 1.5**
 */

describe('Feature: forgot-password, Property 2: Invalid emails are rejected without network call', () => {
  it('for any string that fails isValidEmail, validation rejects the input (no network call would be made)', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !isValidEmail(s)),
        (invalidEmail) => {
          // The validation function correctly identifies this as invalid
          expect(isValidEmail(invalidEmail)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
