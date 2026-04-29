import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { __TEST_THEME_OVERRIDE__ } from '../../../test/setup';

import { ThemeCard } from './theme-card';

function render(overrides: Partial<React.ComponentProps<typeof ThemeCard>> = {}) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(<ThemeCard {...overrides} />);
    });
    return renderer;
}

function findByA11yLabel(renderer: ReactTestRenderer, label: string) {
    const results = renderer.root.findAll((node) => node.props.accessibilityLabel === label);
    if (results.length === 0) throw new Error(`No node with accessibilityLabel "${label}"`);
    return results[0];
}

describe('ThemeCard', () => {
    it('renders 3 theme options: Claro, Escuro, Sistema', () => {
        const renderer = render();
        const texts = renderer.root
            .findAllByType(Text)
            .map((node) => node.props.children)
            .filter((c): c is string => typeof c === 'string');

        expect(texts).toContain('Claro');
        expect(texts).toContain('Escuro');
        expect(texts).toContain('Sistema');
    });

    it('each option has correct accessibility label', () => {
        const renderer = render();

        const claro = findByA11yLabel(renderer, 'Tema Claro');
        const escuro = findByA11yLabel(renderer, 'Tema Escuro');
        const sistema = findByA11yLabel(renderer, 'Tema Sistema');

        expect(claro).toBeTruthy();
        expect(escuro).toBeTruthy();
        expect(sistema).toBeTruthy();
    });

    it('active option has selected: true accessibility state', () => {
        // Default scheme from setup is 'light'
        const renderer = render();

        const claro = findByA11yLabel(renderer, 'Tema Claro');
        const escuro = findByA11yLabel(renderer, 'Tema Escuro');

        expect(claro.props.accessibilityState.selected).toBe(true);
        expect(escuro.props.accessibilityState.selected).toBe(false);
    });

    it('does not call setScheme when disabled=true', () => {
        const renderer = render({ disabled: true });

        const escuro = findByA11yLabel(renderer, 'Tema Escuro');
        act(() => {
            escuro.props.onPress();
        });

        expect(__TEST_THEME_OVERRIDE__.setScheme).not.toHaveBeenCalled();
    });
});
