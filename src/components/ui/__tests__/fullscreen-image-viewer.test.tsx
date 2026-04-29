import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { describe, expect, it, vi } from 'vitest';

import { FullscreenImageViewer } from '../fullscreen-image-viewer';

function render(props: React.ComponentProps<typeof FullscreenImageViewer>) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(<FullscreenImageViewer {...props} />);
    });
    return renderer;
}

describe('FullscreenImageViewer', () => {
    const defaultProps = {
        visible: true,
        imageUrl: 'https://example.com/image.jpg',
        onClose: vi.fn(),
    };

    it('does not render Modal content when visible=false', () => {
        const renderer = render({ ...defaultProps, visible: false });
        const modals = renderer.root.findAll((node) => node.type === 'Modal');

        expect(modals.length).toBe(1);
        expect(modals[0].props.visible).toBe(false);
    });

    it('renders image when visible=true', () => {
        const renderer = render({ ...defaultProps, visible: true });
        const images = renderer.root.findAll((node) => node.type === 'Image');

        expect(images.length).toBeGreaterThanOrEqual(1);
        expect(images[0].props.source).toBe('https://example.com/image.jpg');
    });

    it('calls onClose when close button is pressed', () => {
        const onClose = vi.fn();
        const renderer = render({ ...defaultProps, onClose });
        const closeBtn = renderer.root.findAll(
            (node) =>
                node.type === 'Pressable' && node.props.accessibilityLabel === 'Fechar imagem',
        );

        expect(closeBtn.length).toBe(1);
        closeBtn[0].props.onPress();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('close button has accessibilityLabel "Fechar imagem"', () => {
        const renderer = render(defaultProps);
        const closeBtn = renderer.root.findAll(
            (node) =>
                node.type === 'Pressable' && node.props.accessibilityRole === 'button',
        );

        const labels = closeBtn.map((node) => node.props.accessibilityLabel);
        expect(labels).toContain('Fechar imagem');
    });
});
