import React from 'react';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, create } from '../../../test/helpers/test-renderer-compat';
import {
    ImpersonationProvider,
    useImpersonation,
} from '../impersonation-context';

/**
 * Feature: view-app-as-child
 * Property 1: Round-trip de impersonação
 *
 * Para qualquer childId (string não-vazia) e childName (string não-vazia),
 * chamar startImpersonation({ childId, childName }) deve resultar em
 * impersonating sendo { childId, childName }, e em seguida chamar
 * stopImpersonation() deve resultar em impersonating sendo null.
 *
 * **Validates: Requirements 1.2, 1.3**
 */

// Helper component that captures the hook value for assertions
function HookCapture({ onValue }: { onValue: (v: ReturnType<typeof useImpersonation>) => void }) {
    const value = useImpersonation();
    onValue(value);
    return null;
}

describe('Feature: view-app-as-child — Property 1: Round-trip de impersonação', () => {
    it('start → impersonating correct state → stop → null for any childId/childName', () => {
        const nonEmptyString = fc.string({ minLength: 1, maxLength: 100 });

        fc.assert(
            fc.property(nonEmptyString, nonEmptyString, (childId, childName) => {
                let captured: ReturnType<typeof useImpersonation> | null = null;

                const capture = (v: ReturnType<typeof useImpersonation>) => {
                    captured = v;
                };

                let renderer: ReturnType<typeof create>;

                // Mount the provider
                act(() => {
                    renderer = create(
                        <ImpersonationProvider>
                            <HookCapture onValue={capture} />
                        </ImpersonationProvider>,
                    );
                });

                // Initial state should be null
                expect(captured!.impersonating).toBeNull();

                // Start impersonation
                act(() => {
                    captured!.startImpersonation({ childId, childName });
                });

                // After start, impersonating should match the input
                expect(captured!.impersonating).toEqual({ childId, childName });

                // Stop impersonation
                act(() => {
                    captured!.stopImpersonation();
                });

                // After stop, impersonating should be null
                expect(captured!.impersonating).toBeNull();

                // Cleanup
                act(() => {
                    renderer!.unmount();
                });
            }),
            { numRuns: 100 },
        );
    });
});
