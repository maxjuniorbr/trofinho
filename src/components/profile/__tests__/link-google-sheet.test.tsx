import React from 'react';
import { Pressable, Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';

import { LinkGoogleSheet } from '../link-google-sheet';

/**
 * Unit tests for LinkGoogleSheet component.
 *
 * Validates: Requirements 8.3
 */

const linkGoogleIdentityMock = vi.hoisted(() => vi.fn());

vi.mock('@lib/auth', () => ({
    linkGoogleIdentity: linkGoogleIdentityMock,
}));

// Add Link2 icon not in global setup
vi.mock('lucide-react-native', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('lucide-react-native');
    return {
        ...actual,
        Link2: React.forwardRef(function Link2(
            props: Record<string, unknown>,
            ref: React.ForwardedRef<unknown>,
        ) {
            return React.createElement('Link2', { ...props, ref });
        }),
    };
});

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

describe('LinkGoogleSheet', () => {
    beforeEach(() => {
        linkGoogleIdentityMock.mockReset();
    });

    it('renders header and Google button when visible', () => {
        const renderer = render(
            <LinkGoogleSheet
                visible={true}
                onClose={() => undefined}
                onLinked={() => undefined}
            />,
        );

        const texts = getTextContents(renderer);
        expect(texts).toContain('Vincular conta Google');
        expect(texts).toContain('Vincular com Google');

        act(() => {
            renderer.unmount();
        });
    });

    it('calls linkGoogleIdentity when Google button is pressed', async () => {
        linkGoogleIdentityMock.mockResolvedValue({ error: null });

        const renderer = render(
            <LinkGoogleSheet
                visible={true}
                onClose={() => undefined}
                onLinked={() => undefined}
            />,
        );

        // Find the GoogleSignInButton's Pressable (label "Vincular com Google")
        const pressables = renderer.root.findAllByType(Pressable);
        const googleButton = pressables.find(
            (p) => p.props.accessibilityLabel === 'Vincular com Google',
        );

        expect(googleButton).toBeTruthy();

        await act(async () => {
            await googleButton!.props.onPress();
        });

        expect(linkGoogleIdentityMock).toHaveBeenCalledTimes(1);

        act(() => {
            renderer.unmount();
        });
    });

    it('shows error message on linkGoogleIdentity failure', async () => {
        linkGoogleIdentityMock.mockResolvedValue({
            error: 'Erro na autenticação. Tente novamente.',
        });

        const renderer = render(
            <LinkGoogleSheet
                visible={true}
                onClose={() => undefined}
                onLinked={() => undefined}
            />,
        );

        const pressables = renderer.root.findAllByType(Pressable);
        const googleButton = pressables.find(
            (p) => p.props.accessibilityLabel === 'Vincular com Google',
        );

        await act(async () => {
            await googleButton!.props.onPress();
        });

        const texts = getTextContents(renderer);
        expect(texts).toContain('Erro na autenticação. Tente novamente.');

        act(() => {
            renderer.unmount();
        });
    });

    it('shows success state on successful link', async () => {
        linkGoogleIdentityMock.mockResolvedValue({ error: null });

        const renderer = render(
            <LinkGoogleSheet
                visible={true}
                onClose={() => undefined}
                onLinked={() => undefined}
            />,
        );

        const pressables = renderer.root.findAllByType(Pressable);
        const googleButton = pressables.find(
            (p) => p.props.accessibilityLabel === 'Vincular com Google',
        );

        await act(async () => {
            await googleButton!.props.onPress();
        });

        const texts = getTextContents(renderer);
        expect(texts).toContain('Conta vinculada!');
        expect(texts.some((t) => t.includes('conta Google'))).toBe(true);

        act(() => {
            renderer.unmount();
        });
    });
});
