import React from 'react';
import { Text, View } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';

const insetsMock = vi.hoisted(() => ({ value: { top: 47, right: 0, bottom: 34, left: 0 } }));

vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => insetsMock.value,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/context/theme-context', () => ({
    useTheme: () => ({ colors: { bg: { canvas: '#fafafa' } } }),
}));

// eslint-disable-next-line import/first
import { SafeScreenFrame } from './safe-screen-frame';

function render(element: React.ReactElement) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

function getRootStyle(renderer: ReactTestRenderer): Record<string, unknown> {
    const root = renderer.root.findAllByType(View)[0];
    const style = root.props.style as unknown;
    if (Array.isArray(style)) {
        return Object.assign({}, ...(style.filter(Boolean) as Record<string, unknown>[]));
    }
    return (style as Record<string, unknown>) ?? {};
}

describe('SafeScreenFrame', () => {
    it('renders children', () => {
        const renderer = render(
            <SafeScreenFrame>
                <Text>oi</Text>
            </SafeScreenFrame>,
        );
        const labels = renderer.root.findAllByType(Text).map((t) => t.props.children);
        expect(labels).toContain('oi');
    });

    it('applies bottom inset by default and skips top inset', () => {
        const renderer = render(
            <SafeScreenFrame>
                <Text>x</Text>
            </SafeScreenFrame>,
        );
        const style = getRootStyle(renderer);
        expect(style.paddingTop).toBe(0);
        expect(style.paddingBottom).toBe(34);
        expect(style.backgroundColor).toBe('#fafafa');
    });

    it('applies top inset when topInset is true', () => {
        const renderer = render(
            <SafeScreenFrame topInset>
                <Text>x</Text>
            </SafeScreenFrame>,
        );
        const style = getRootStyle(renderer);
        expect(style.paddingTop).toBe(47);
        expect(style.paddingBottom).toBe(34);
    });

    it('skips bottom inset when bottomInset is false', () => {
        const renderer = render(
            <SafeScreenFrame bottomInset={false}>
                <Text>x</Text>
            </SafeScreenFrame>,
        );
        const style = getRootStyle(renderer);
        expect(style.paddingBottom).toBe(0);
    });

    it('merges custom style with safe-area styles', () => {
        const renderer = render(
            <SafeScreenFrame topInset style={{ padding: 12 }}>
                <Text>x</Text>
            </SafeScreenFrame>,
        );
        const style = getRootStyle(renderer);
        expect(style.padding).toBe(12);
        expect(style.paddingTop).toBe(47);
        expect(style.flex).toBe(1);
    });
});
