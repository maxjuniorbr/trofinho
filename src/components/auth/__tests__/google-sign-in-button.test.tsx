import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';

import { GoogleSignInButton } from '../google-sign-in-button';

/**
 * Unit tests for GoogleSignInButton component.
 *
 * Validates: Requirements 1.1, 8.1
 */

function render(element: React.ReactElement): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

describe('GoogleSignInButton', () => {
    it('renders with default label "Entrar com Google"', () => {
        const renderer = render(
            <GoogleSignInButton onPress={() => undefined} loading={false} />,
        );

        const texts = renderer.root
            .findAllByType(Text)
            .map((n) => n.props.children)
            .filter((c): c is string => typeof c === 'string');

        expect(texts).toContain('Entrar com Google');

        act(() => {
            renderer.unmount();
        });
    });

    it('renders with a custom label', () => {
        const renderer = render(
            <GoogleSignInButton
                onPress={() => undefined}
                loading={false}
                label="Vincular com Google"
            />,
        );

        const texts = renderer.root
            .findAllByType(Text)
            .map((n) => n.props.children)
            .filter((c): c is string => typeof c === 'string');

        expect(texts).toContain('Vincular com Google');

        act(() => {
            renderer.unmount();
        });
    });

    it('shows ActivityIndicator when loading is true', () => {
        const renderer = render(
            <GoogleSignInButton onPress={() => undefined} loading={true} />,
        );

        const indicators = renderer.root.findAllByType(ActivityIndicator);
        expect(indicators.length).toBe(1);

        act(() => {
            renderer.unmount();
        });
    });

    it('does not show ActivityIndicator when loading is false', () => {
        const renderer = render(
            <GoogleSignInButton onPress={() => undefined} loading={false} />,
        );

        const indicators = renderer.root.findAllByType(ActivityIndicator);
        expect(indicators.length).toBe(0);

        act(() => {
            renderer.unmount();
        });
    });

    it('calls onPress when pressed and not disabled', () => {
        const onPress = vi.fn();
        const renderer = render(
            <GoogleSignInButton onPress={onPress} loading={false} />,
        );

        const pressable = renderer.root.findByType(Pressable);

        act(() => {
            pressable.props.onPress();
        });

        expect(onPress).toHaveBeenCalledTimes(1);

        act(() => {
            renderer.unmount();
        });
    });

    it('does not call onPress when disabled', () => {
        const onPress = vi.fn();
        const renderer = render(
            <GoogleSignInButton onPress={onPress} loading={false} disabled={true} />,
        );

        const pressable = renderer.root.findByType(Pressable);

        act(() => {
            pressable.props.onPress();
        });

        expect(onPress).not.toHaveBeenCalled();

        act(() => {
            renderer.unmount();
        });
    });

    it('does not call onPress when loading', () => {
        const onPress = vi.fn();
        const renderer = render(
            <GoogleSignInButton onPress={onPress} loading={true} />,
        );

        const pressable = renderer.root.findByType(Pressable);

        act(() => {
            pressable.props.onPress();
        });

        expect(onPress).not.toHaveBeenCalled();

        act(() => {
            renderer.unmount();
        });
    });

    it('sets accessibilityState disabled and busy when loading', () => {
        const renderer = render(
            <GoogleSignInButton onPress={() => undefined} loading={true} />,
        );

        const pressable = renderer.root.findByType(Pressable);
        expect(pressable.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true, busy: true }),
        );

        act(() => {
            renderer.unmount();
        });
    });
});
