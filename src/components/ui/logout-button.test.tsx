import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogoutButton } from './logout-button';

function render(element: React.ReactElement) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

describe('LogoutButton', () => {
    const onPress = vi.fn();

    beforeEach(() => {
        onPress.mockReset();
    });

    it('renders the logout text when not loading', () => {
        const renderer = render(<LogoutButton onPress={onPress} loading={false} />);
        const texts = renderer.root.findAllByType(Text);
        const labels = texts.map((t) => t.props.children).flat();
        expect(labels).toContain('Sair');
    });

    it('renders an ActivityIndicator when loading', () => {
        const renderer = render(<LogoutButton onPress={onPress} loading={true} />);
        const indicators = renderer.root.findAllByType(ActivityIndicator);
        expect(indicators.length).toBe(1);
    });

    it('disables the button when loading', () => {
        const renderer = render(<LogoutButton onPress={onPress} loading={true} />);
        const button = renderer.root.findAllByType(Pressable)[0];
        expect(button.props.disabled).toBe(true);
    });

    it('disables the button when disabled prop is true', () => {
        const renderer = render(<LogoutButton onPress={onPress} loading={false} disabled={true} />);
        const button = renderer.root.findAllByType(Pressable)[0];
        expect(button.props.disabled).toBe(true);
    });

    it('calls onPress when pressed', async () => {
        const renderer = render(<LogoutButton onPress={onPress} loading={false} />);
        const button = renderer.root.findAllByType(Pressable)[0];
        await act(async () => {
            button.props.onPress();
        });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('has correct accessibility label', () => {
        const renderer = render(<LogoutButton onPress={onPress} loading={false} />);
        const button = renderer.root.findAllByType(Pressable)[0];
        expect(button.props.accessibilityLabel).toBe('Sair da conta');
    });
});
