import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { ImpersonationBar } from '../impersonation-bar';

/**
 * Unit tests for ImpersonationBar component.
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5
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

describe('ImpersonationBar', () => {
    it('renders the Eye icon', () => {
        let renderer: ReactTestRenderer;

        act(() => {
            renderer = create(<ImpersonationBar childName="Maria" onExit={vi.fn()} />);
        });

        const json = renderer!.toJSON();
        const hasEyeIcon = JSON.stringify(json).includes('"type":"Eye"');
        expect(hasEyeIcon).toBe(true);
    });

    it('renders "Vendo como {childName}" text', () => {
        let renderer: ReactTestRenderer;

        act(() => {
            renderer = create(<ImpersonationBar childName="João" onExit={vi.fn()} />);
        });

        const allText = collectText(renderer!.toJSON());
        expect(allText).toContain('Vendo como João');
    });

    it('renders "Sair" button with X icon', () => {
        let renderer: ReactTestRenderer;

        act(() => {
            renderer = create(<ImpersonationBar childName="Maria" onExit={vi.fn()} />);
        });

        const json = renderer!.toJSON();
        const serialized = JSON.stringify(json);

        // Check "Sair" text is present
        const allText = collectText(json);
        expect(allText).toContain('Sair');

        // Check X icon is present
        const hasXIcon = serialized.includes('"type":"X"');
        expect(hasXIcon).toBe(true);
    });

    it('calls onExit when "Sair" button is pressed', () => {
        const onExit = vi.fn();
        let renderer: ReactTestRenderer;

        act(() => {
            renderer = create(<ImpersonationBar childName="Maria" onExit={onExit} />);
        });

        // Find the Pressable (exit button) and invoke its onPress
        const pressables = renderer!.root.findAllByType('Pressable');
        expect(pressables.length).toBeGreaterThan(0);

        // The Pressable with accessibilityLabel "Sair do modo de visualização" is the exit button
        const exitButton = pressables.find(
            (p) => p.props.accessibilityLabel === 'Sair do modo de visualização',
        );
        expect(exitButton).toBeDefined();

        act(() => {
            exitButton!.props.onPress();
        });

        expect(onExit).toHaveBeenCalledTimes(1);
    });
});
