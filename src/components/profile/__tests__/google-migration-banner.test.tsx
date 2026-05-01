import React from 'react';
import { Pressable, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';

import { GoogleMigrationBanner } from '../google-migration-banner';

/**
 * Unit tests for GoogleMigrationBanner component.
 *
 * Validates: Requirements 4.4, 8.2
 */

function render(element: React.ReactElement): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

function getTextContents(renderer: ReactTestRenderer): string[] {
    return renderer.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .filter((c): c is string => typeof c === 'string');
}

describe('GoogleMigrationBanner', () => {
    it('renders banner title and description text', () => {
        const renderer = render(
            <GoogleMigrationBanner onLinkGoogle={() => undefined} />,
        );

        const texts = getTextContents(renderer);
        expect(texts).toContain('Vincule sua conta Google');
        expect(texts.some((t) => t.includes('mais rápida e segura'))).toBe(true);

        act(() => {
            renderer.unmount();
        });
    });

    it('renders the "Vincular Google" button', () => {
        const renderer = render(
            <GoogleMigrationBanner onLinkGoogle={() => undefined} />,
        );

        const texts = getTextContents(renderer);
        expect(texts).toContain('Vincular Google');

        act(() => {
            renderer.unmount();
        });
    });

    it('calls onLinkGoogle when the button is pressed', () => {
        const onLinkGoogle = vi.fn();
        const renderer = render(
            <GoogleMigrationBanner onLinkGoogle={onLinkGoogle} />,
        );

        // Find the Pressable with the "Vincular conta Google" accessibility label
        const pressables = renderer.root.findAllByType(Pressable);
        const linkButton = pressables.find(
            (p) =>
                p.props.accessibilityLabel === 'Vincular conta Google' ||
                p.props.accessibilityLabel === 'Vincular Google',
        );

        expect(linkButton).toBeTruthy();

        act(() => {
            linkButton!.props.onPress();
        });

        expect(onLinkGoogle).toHaveBeenCalledTimes(1);

        act(() => {
            renderer.unmount();
        });
    });

    it('has accessibilityRole="alert" on the container', () => {
        const renderer = render(
            <GoogleMigrationBanner onLinkGoogle={() => undefined} />,
        );

        const alertViews = renderer.root.findAll(
            (node) =>
                node.type === 'View' &&
                node.props.accessibilityRole === 'alert',
        );
        expect(alertViews.length).toBeGreaterThan(0);

        act(() => {
            renderer.unmount();
        });
    });
});
