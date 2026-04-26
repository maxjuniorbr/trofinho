import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, create } from '../../../test/helpers/test-renderer-compat';
import {
    ImpersonationProvider,
    useImpersonation,
    type ImpersonationState,
} from '../impersonation-context';

/**
 * Unit tests for ImpersonationProvider and useImpersonation hook.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

// Helper component that captures the hook value for assertions
function HookCapture({ onValue }: { onValue: (v: ReturnType<typeof useImpersonation>) => void }) {
    const value = useImpersonation();
    onValue(value);
    return null;
}

describe('ImpersonationProvider', () => {
    it('provides initial impersonating state as null', () => {
        let captured: ReturnType<typeof useImpersonation> | null = null;

        act(() => {
            create(
                <ImpersonationProvider>
                    <HookCapture onValue={(v) => { captured = v; }} />
                </ImpersonationProvider>,
            );
        });

        expect(captured).not.toBeNull();
        expect(captured!.impersonating).toBeNull();
        expect(typeof captured!.startImpersonation).toBe('function');
        expect(typeof captured!.stopImpersonation).toBe('function');
    });

    it('updates impersonating state when startImpersonation is called', () => {
        let captured: ReturnType<typeof useImpersonation> | null = null;

        act(() => {
            create(
                <ImpersonationProvider>
                    <HookCapture onValue={(v) => { captured = v; }} />
                </ImpersonationProvider>,
            );
        });

        const child: ImpersonationState = { childId: 'child-123', childName: 'Maria' };

        act(() => {
            captured!.startImpersonation(child);
        });

        expect(captured!.impersonating).toEqual({ childId: 'child-123', childName: 'Maria' });
    });

    it('clears impersonating state to null when stopImpersonation is called', () => {
        let captured: ReturnType<typeof useImpersonation> | null = null;

        act(() => {
            create(
                <ImpersonationProvider>
                    <HookCapture onValue={(v) => { captured = v; }} />
                </ImpersonationProvider>,
            );
        });

        // Start impersonation first
        act(() => {
            captured!.startImpersonation({ childId: 'child-456', childName: 'João' });
        });

        expect(captured!.impersonating).not.toBeNull();

        // Stop impersonation
        act(() => {
            captured!.stopImpersonation();
        });

        expect(captured!.impersonating).toBeNull();
    });
});

describe('useImpersonation', () => {
    it('throws an error when used outside ImpersonationProvider', () => {
        function Orphan() {
            useImpersonation();
            return null;
        }

        expect(() => {
            act(() => {
                create(<Orphan />);
            });
        }).toThrow('useImpersonation must be used within ImpersonationProvider');
    });
});
