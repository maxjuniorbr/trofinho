import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';

import { InlineMessage } from '../inline-message';

function render(props: React.ComponentProps<typeof InlineMessage>) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(<InlineMessage {...props} />);
    });
    return renderer;
}

describe('InlineMessage', () => {
    it('renders the message text', () => {
        const renderer = render({ message: 'Algo deu errado' });
        const texts = renderer.root
            .findAllByType(Text)
            .map((node) => node.props.children)
            .filter((c): c is string => typeof c === 'string');

        expect(texts).toContain('Algo deu errado');
    });

    it('renders with variant="error" — contains AlertCircle icon', () => {
        const renderer = render({ message: 'Erro', variant: 'error' });
        const icons = renderer.root.findAll((node) => node.type === 'AlertCircle');

        expect(icons.length).toBe(1);
    });

    it('renders with variant="warning" — contains TriangleAlert icon', () => {
        const renderer = render({ message: 'Aviso', variant: 'warning' });
        const icons = renderer.root.findAll((node) => node.type === 'TriangleAlert');

        expect(icons.length).toBe(1);
    });

    it('renders with variant="success" — contains CheckCircle2 icon', () => {
        const renderer = render({ message: 'Sucesso', variant: 'success' });
        const icons = renderer.root.findAll((node) => node.type === 'CheckCircle2');

        expect(icons.length).toBe(1);
    });

    it('renders with variant="info" (default) — contains Info icon', () => {
        const renderer = render({ message: 'Informação' });
        const icons = renderer.root.findAll((node) => node.type === 'Info');

        expect(icons.length).toBe(1);
    });

    it('has accessibilityLiveRegion="polite" on the container', () => {
        const renderer = render({ message: 'Teste' });
        const container = renderer.root.findAll(
            (node) => node.props.accessibilityLiveRegion === 'polite',
        );

        expect(container.length).toBeGreaterThanOrEqual(1);
    });
});
