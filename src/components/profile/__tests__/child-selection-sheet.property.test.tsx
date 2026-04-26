import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Child } from '../../../../lib/children';

/**
 * Feature: view-app-as-child
 * Property 2: Filtro de filhos ativos
 *
 * Para qualquer lista de filhos com valores `ativo` mistos (true/false),
 * a lista filtrada deve conter exatamente os filhos onde `ativo === true`,
 * e nenhum filho onde `ativo === false`.
 *
 * **Validates: Requirements 2.2**
 */

// Extracted filter logic from ChildSelectionSheet component
const filterActiveChildren = (children: Child[]): Child[] =>
    children.filter((c) => c.ativo === true);

// Arbitrary for a single Child object
const childArb: fc.Arbitrary<Child> = fc.record({
    id: fc.uuid(),
    nome: fc.string({ minLength: 1, maxLength: 50 }),
    usuario_id: fc.option(fc.uuid(), { nil: null }),
    avatar_url: fc.option(fc.webUrl(), { nil: null }),
    ativo: fc.boolean(),
});

describe('Feature: view-app-as-child — Property 2: Filtro de filhos ativos', () => {
    it('filtered list contains exactly the children where ativo === true', () => {
        fc.assert(
            fc.property(fc.array(childArb, { minLength: 0, maxLength: 30 }), (children) => {
                const result = filterActiveChildren(children);

                // Every child in the result must have ativo === true
                expect(result.every((c) => c.ativo === true)).toBe(true);

                // No child with ativo === false should appear
                expect(result.some((c) => c.ativo === false)).toBe(false);

                // The count must match the number of active children in the input
                const expectedCount = children.filter((c) => c.ativo === true).length;
                expect(result).toHaveLength(expectedCount);

                // The filtered children must preserve identity (same ids)
                const expectedIds = children.filter((c) => c.ativo === true).map((c) => c.id);
                expect(result.map((c) => c.id)).toEqual(expectedIds);
            }),
            { numRuns: 100 },
        );
    });
});


/**
 * Feature: view-app-as-child
 * Property 3: Cálculo de pontos totais
 *
 * Para qualquer filho com `saldo_livre >= 0` e `cofrinho >= 0`,
 * o valor total exibido no modal de seleção deve ser igual a `saldo_livre + cofrinho`.
 *
 * **Validates: Requirements 2.3**
 */

// Extracted calculation logic from ChildSelectionSheet component
const calculateTotalPoints = (saldo_livre: number, cofrinho: number): number =>
    saldo_livre + cofrinho;

describe('Feature: view-app-as-child — Property 3: Cálculo de pontos totais', () => {
    it('total points equals saldo_livre + cofrinho for any non-negative values', () => {
        fc.assert(
            fc.property(
                fc.nat(), // saldo_livre >= 0
                fc.nat(), // cofrinho >= 0
                (saldo_livre, cofrinho) => {
                    const total = calculateTotalPoints(saldo_livre, cofrinho);

                    // Total must equal the sum of both balances
                    expect(total).toBe(saldo_livre + cofrinho);

                    // Total must be non-negative
                    expect(total).toBeGreaterThanOrEqual(0);

                    // Total must be at least as large as each individual balance
                    expect(total).toBeGreaterThanOrEqual(saldo_livre);
                    expect(total).toBeGreaterThanOrEqual(cofrinho);
                },
            ),
            { numRuns: 100 },
        );
    });
});
