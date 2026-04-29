import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { House, Gift, User } from 'lucide-react-native';

import { HomeFooterBar } from '../home-footer-bar';

const ITEMS = [
    { icon: House, label: 'Início', rota: 'index' },
    { icon: Gift, label: 'Prêmios', rota: '/(child)/prizes', badge: 3 },
    { icon: User, label: 'Perfil', rota: '/(child)/perfil' },
] as const;

function render(props: React.ComponentProps<typeof HomeFooterBar>) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(<HomeFooterBar {...props} />);
    });
    return renderer;
}

describe('HomeFooterBar', () => {
    const defaultProps = {
        items: ITEMS,
        activeRoute: 'index',
        onNavigate: vi.fn(),
    };

    it('renders all item labels', () => {
        const renderer = render(defaultProps);
        const texts = renderer.root
            .findAllByType(Text)
            .map((node) => node.props.children)
            .filter((c): c is string => typeof c === 'string');

        expect(texts).toContain('Início');
        expect(texts).toContain('Prêmios');
        expect(texts).toContain('Perfil');
    });

    it('calls onNavigate with correct route when tab pressed', () => {
        const onNavigate = vi.fn();
        const renderer = render({ ...defaultProps, onNavigate });
        const pressables = renderer.root.findAll(
            (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'button',
        );

        // Press the second tab (Prêmios)
        pressables[1].props.onPress();
        expect(onNavigate).toHaveBeenCalledWith('/(child)/prizes');
    });

    it('active tab has accessibilityState.selected: true', () => {
        const renderer = render({ ...defaultProps, activeRoute: 'index' });
        const pressables = renderer.root.findAll(
            (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'button',
        );

        // First tab (Início) is active
        expect(pressables[0].props.accessibilityState).toEqual({ selected: true });
        // Second tab (Prêmios) is not active
        expect(pressables[1].props.accessibilityState).toEqual({ selected: false });
    });

    it('badge renders count when badge > 0', () => {
        const renderer = render(defaultProps);
        const texts = renderer.root
            .findAllByType(Text)
            .map((node) => node.props.children);

        expect(texts).toContain(3);
    });

    it('badge does not render when badge is undefined', () => {
        const renderer = render(defaultProps);
        // The "Perfil" tab has no badge — check that only one badge number exists (from Prêmios)
        const allTexts = renderer.root
            .findAllByType(Text)
            .map((node) => node.props.children)
            .filter((c): c is number => typeof c === 'number');

        expect(allTexts).toEqual([3]);
    });

    it('badge accessibility label includes count', () => {
        const renderer = render(defaultProps);
        const pressables = renderer.root.findAll(
            (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'button',
        );

        // Prêmios tab (index 1) should have badge accessibility label
        expect(pressables[1].props.accessibilityLabel).toBe('Prêmios, 3 pendentes');
    });
});
