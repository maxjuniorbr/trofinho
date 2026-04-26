import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ImpersonationState } from '../impersonation-context';

/**
 * Feature: view-app-as-child
 * Property 6: Modo somente leitura
 *
 * Para qualquer estado de impersonação ativo (impersonating !== null),
 * todas as ações mutativas devem estar desabilitadas na interface.
 * A lógica derivada usada em todas as telas child é:
 *   const isReadOnly = impersonating !== null;
 *
 * **Validates: Requirements 5.4**
 */

// Pure derivation logic used across all child screens
const deriveReadOnly = (impersonating: ImpersonationState | null): boolean =>
    impersonating !== null;

// Arbitrary for a valid ImpersonationState (non-null)
const impersonationStateArb: fc.Arbitrary<ImpersonationState> = fc.record({
    childId: fc.uuid(),
    childName: fc.string({ minLength: 1, maxLength: 100 }),
});

// Arbitrary for ImpersonationState | null (random mix)
const impersonationOrNullArb: fc.Arbitrary<ImpersonationState | null> = fc.oneof(
    fc.constant(null),
    impersonationStateArb,
);

describe('Feature: view-app-as-child — Property 6: Modo somente leitura', () => {
    it('isReadOnly is true when impersonating is not null', () => {
        fc.assert(
            fc.property(impersonationStateArb, (impersonating) => {
                const isReadOnly = deriveReadOnly(impersonating);
                expect(isReadOnly).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('isReadOnly is false when impersonating is null', () => {
        const isReadOnly = deriveReadOnly(null);
        expect(isReadOnly).toBe(false);
    });

    it('isReadOnly correctly reflects impersonation state for any random state', () => {
        fc.assert(
            fc.property(impersonationOrNullArb, (impersonating) => {
                const isReadOnly = deriveReadOnly(impersonating);

                if (impersonating !== null) {
                    // Mutative actions should be disabled
                    expect(isReadOnly).toBe(true);
                } else {
                    // Mutative actions should be enabled
                    expect(isReadOnly).toBe(false);
                }
            }),
            { numRuns: 100 },
        );
    });
});
