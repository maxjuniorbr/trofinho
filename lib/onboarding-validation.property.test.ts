import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { validateFamilyCreation } from './onboarding-validation';

/**
 * Feature: admin-onboarding-journey, Property 6: Validação de campos whitespace-only na criação de família
 *
 * Para qualquer string composta inteiramente de caracteres de espaço em branco
 * (espaços, tabs, newlines), a validação dos campos "Nome da família" e "Seu nome"
 * SHALL rejeitar a string e retornar a mensagem de erro apropriada, bloqueando o envio.
 *
 * **Validates: Requirements 9.1, 9.2**
 */

/**
 * Whitespace characters that JavaScript's `.trim()` removes.
 * Note: \u00A0 (non-breaking space) is NOT removed by `.trim()`, so it is
 * excluded from the "reject" generator and handled separately.
 */
const TRIMMABLE_WHITESPACE = [' ', '\t', '\n', '\r'] as const;

/** Arbitrary: non-empty string composed only of whitespace chars that `.trim()` removes. */
const trimmableWhitespaceOnlyArb = fc
  .array(fc.constantFrom(...TRIMMABLE_WHITESPACE), { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

/**
 * Arbitrary: string that contains at least one non-whitespace character.
 * Built by picking a visible char from a-z/A-Z/0-9 and wrapping with optional padding.
 */
const stringWithVisibleCharArb = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 10 }),
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
    ),
    fc.string({ minLength: 0, maxLength: 10 }),
  )
  .map(([prefix, visible, suffix]) => `${prefix}${visible}${suffix}`);

describe('Feature: admin-onboarding-journey, Property 6: Validação de campos whitespace-only na criação de família', () => {
  it('rejects whitespace-only familyName with the correct error message', () => {
    fc.assert(
      fc.property(trimmableWhitespaceOnlyArb, (ws) => {
        const result = validateFamilyCreation({ familyName: ws, adminName: 'Valid Name' });
        expect(result).toBe('Informe o nome da família.');
      }),
      { numRuns: 100 },
    );
  });

  it('rejects whitespace-only adminName with the correct error message', () => {
    fc.assert(
      fc.property(trimmableWhitespaceOnlyArb, (ws) => {
        const result = validateFamilyCreation({ familyName: 'Valid Family', adminName: ws });
        expect(result).toBe('Informe seu nome.');
      }),
      { numRuns: 100 },
    );
  });

  it('rejects when both fields are whitespace-only, reporting familyName first', () => {
    fc.assert(
      fc.property(trimmableWhitespaceOnlyArb, trimmableWhitespaceOnlyArb, (wsFam, wsAdmin) => {
        const result = validateFamilyCreation({ familyName: wsFam, adminName: wsAdmin });
        expect(result).toBe('Informe o nome da família.');
      }),
      { numRuns: 100 },
    );
  });

  it('accepts strings that contain at least one non-whitespace character in both fields', () => {
    fc.assert(
      fc.property(stringWithVisibleCharArb, stringWithVisibleCharArb, (familyName, adminName) => {
        const result = validateFamilyCreation({ familyName, adminName });
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
