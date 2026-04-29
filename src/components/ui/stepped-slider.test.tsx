import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-community/slider', () => {
    const { forwardRef, createElement } = require('react');
    const Slider = forwardRef(function Slider(
        props: Record<string, unknown>,
        ref: React.ForwardedRef<unknown>,
    ) {
        return createElement('Slider', { ...props, ref });
    });
    Slider.displayName = 'Slider';
    return { __esModule: true, default: Slider };
});

import { SteppedSlider } from './stepped-slider';

function render(element: React.ReactElement) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

describe('SteppedSlider', () => {
    const onValueChange = vi.fn();
    const onSlidingComplete = vi.fn();

    it('renders the formatted value', () => {
        const renderer = render(
            <SteppedSlider
                value={25}
                onValueChange={onValueChange}
                onSlidingComplete={onSlidingComplete}
                accessibilityLabel="Porcentagem do cofrinho"
            />,
        );
        const texts = renderer.root.findAllByType(Text);
        const labels = texts.map((t) => t.props.children).flat();
        expect(labels).toContain('25%');
    });

    it('renders custom formatted value', () => {
        const renderer = render(
            <SteppedSlider
                value={10}
                onValueChange={onValueChange}
                onSlidingComplete={onSlidingComplete}
                formatValue={(v) => `R$ ${v}`}
                accessibilityLabel="Valor"
            />,
        );
        const texts = renderer.root.findAllByType(Text);
        const labels = texts.map((t) => t.props.children).flat();
        expect(labels).toContain('R$ 10');
    });

    it('renders min and max range labels', () => {
        const renderer = render(
            <SteppedSlider
                value={0}
                min={0}
                max={100}
                onValueChange={onValueChange}
                onSlidingComplete={onSlidingComplete}
                accessibilityLabel="Slider"
            />,
        );
        const texts = renderer.root.findAllByType(Text);
        const labels = texts.map((t) => t.props.children).flat();
        expect(labels).toContain('0%');
        expect(labels).toContain('100%');
    });

    it('renders without crashing with default props', () => {
        const renderer = render(
            <SteppedSlider
                value={15}
                onValueChange={onValueChange}
                onSlidingComplete={onSlidingComplete}
                accessibilityLabel="Test slider"
            />,
        );
        expect(renderer.toJSON()).not.toBeNull();
    });
});
