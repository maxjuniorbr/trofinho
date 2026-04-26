import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { act, create } from '../../../../test/helpers/test-renderer-compat';
import { ImpersonationBar } from '../impersonation-bar';

/**
 * Feature: view-app-as-child
 * Property 4: Texto da barra de impersonação
 *
 * Para qualquer childName (string não-vazia), a ImpersonationBar deve
 * renderizar um texto contendo a substring "Vendo como {childName}".
 *
 * **Validates: Requirements 3.2**
 */

/** Recursively collect all text content from a rendered JSON tree. */
function collectText(node: unknown): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (!node || typeof node !== 'object') return '';
    const obj = node as { children?: unknown[] };
    if (Array.isArray(obj.children)) {
        return obj.children.map(collectText).join('');
    }
    return '';
}

describe('Feature: view-app-as-child — Property 4: Texto da barra de impersonação', () => {
    it('renders "Vendo como {childName}" for any non-empty childName', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
                (childName) => {
                    const onExit = vi.fn();
                    let renderer: ReturnType<typeof create>;

                    act(() => {
                        renderer = create(
                            <ImpersonationBar childName={childName} onExit={onExit} />,
                        );
                    });

                    const allText = collectText(renderer!.toJSON());
                    expect(allText).toContain(`Vendo como ${childName}`);

                    act(() => {
                        renderer!.unmount();
                    });
                },
            ),
            { numRuns: 100 },
        );
    });
});
