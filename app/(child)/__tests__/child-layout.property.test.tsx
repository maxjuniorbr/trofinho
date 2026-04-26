import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ImpersonationState } from '@/context/impersonation-context';

/**
 * Feature: view-app-as-child
 * Property 5: Roteamento de dados via childId
 *
 * Para qualquer childId definido no contexto de impersonação, os hooks de busca
 * de dados devem receber esse childId como parâmetro em vez do ID derivado do
 * usuário autenticado.
 *
 * The core routing logic in (child)/_layout.tsx is:
 *   const childId = impersonating?.childId ?? ownChildId;
 *
 * **Validates: Requirements 5.3**
 */

// Extracted pure data-routing logic from app/(child)/_layout.tsx
const resolveChildId = (
    impersonating: ImpersonationState | null,
    ownChildId: string | undefined,
): string | undefined => impersonating?.childId ?? ownChildId;

describe('Feature: view-app-as-child — Property 5: Roteamento de dados via childId', () => {
    const childIdArb = fc.uuid();
    const childNameArb = fc.string({ minLength: 1, maxLength: 50 });

    it('when impersonating, resolved childId is always the impersonation childId', () => {
        fc.assert(
            fc.property(
                childIdArb,
                childNameArb,
                fc.option(childIdArb, { nil: undefined }),
                (impersonatingChildId, childName, ownChildId) => {
                    const impersonating: ImpersonationState = {
                        childId: impersonatingChildId,
                        childName,
                    };

                    const result = resolveChildId(impersonating, ownChildId);

                    // Must always use the impersonation childId
                    expect(result).toBe(impersonatingChildId);

                    // Must never fall back to ownChildId (unless they happen to be equal)
                    if (ownChildId !== undefined && ownChildId !== impersonatingChildId) {
                        expect(result).not.toBe(ownChildId);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('when not impersonating, resolved childId is always the own childId', () => {
        fc.assert(
            fc.property(
                fc.option(childIdArb, { nil: undefined }),
                (ownChildId) => {
                    const result = resolveChildId(null, ownChildId);

                    // Must fall back to ownChildId
                    expect(result).toBe(ownChildId);
                },
            ),
            { numRuns: 100 },
        );
    });
});
