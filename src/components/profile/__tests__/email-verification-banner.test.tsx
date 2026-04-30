import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { __TEST_THEME_OVERRIDE__ } from '../../../../test/setup';
import { lightColors, darkColors } from '@/constants/colors';
import { EmailVerificationBanner } from '../email-verification-banner';
import { resetAllCooldowns } from '@lib/resend-cooldown';

/**
 * Component tests for EmailVerificationBanner.
 *
 * Validates: Requirements 3.1, 3.5, 3.7, 8.1, 8.2
 */

// Mock resendConfirmationEmail so the component can import it without errors
vi.mock('@lib/auth', () => ({
    resendConfirmationEmail: vi.fn().mockResolvedValue({ error: null }),
}));

// Add RotateCw to the lucide mock (not in global setup)
vi.mock('lucide-react-native', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('lucide-react-native');
    return {
        ...actual,
        RotateCw: React.forwardRef(function RotateCw(
            props: Record<string, unknown>,
            ref: React.ForwardedRef<unknown>,
        ) {
            return React.createElement('RotateCw', { ...props, ref });
        }),
    };
});

const BANNER_MESSAGE = 'Confirme seu email para garantir acesso à recuperação de senha';

function render(element: React.ReactElement): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

describe('EmailVerificationBanner', () => {
    beforeEach(() => {
        resetAllCooldowns();
        __TEST_THEME_OVERRIDE__.colors = lightColors;
        __TEST_THEME_OVERRIDE__.isDark = false;
        __TEST_THEME_OVERRIDE__.scheme = 'light';
    });

    describe('Requirement 3.1 — Banner renders with correct message when unverified', () => {
        it('renders the verification message when emailConfirmedAt is null', () => {
            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            const json = renderer.toJSON();
            const jsonStr = JSON.stringify(json);

            expect(jsonStr).toContain(BANNER_MESSAGE);

            act(() => {
                renderer.unmount();
            });
        });

        it('renders the "Reenviar e-mail" action text', () => {
            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            const jsonStr = JSON.stringify(renderer.toJSON());
            expect(jsonStr).toContain('Reenviar e-mail');

            act(() => {
                renderer.unmount();
            });
        });

        it('renders an info icon element', () => {
            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            // The Info icon is rendered via lucide-react-native; the global
            // setup creates it with createIcon('Info') which sets
            // displayName to 'Icon(Info)'. The JSON tree contains the icon
            // element with its color prop matching the theme's infoText.
            const jsonStr = JSON.stringify(renderer.toJSON());
            expect(jsonStr).toContain(lightColors.semantic.infoText);

            act(() => {
                renderer.unmount();
            });
        });
    });

    describe('Requirement 3.5 — Banner does not render when verified', () => {
        it('returns null when emailConfirmedAt is a valid ISO timestamp', () => {
            const renderer = render(
                <EmailVerificationBanner
                    email="admin@example.com"
                    emailConfirmedAt="2024-01-15T10:30:00.000Z"
                />,
            );

            const json = renderer.toJSON();
            expect(json).toBeNull();

            act(() => {
                renderer.unmount();
            });
        });

        it('returns null for any non-null emailConfirmedAt string', () => {
            const renderer = render(
                <EmailVerificationBanner
                    email="admin@example.com"
                    emailConfirmedAt="some-timestamp"
                />,
            );

            const json = renderer.toJSON();
            expect(json).toBeNull();

            act(() => {
                renderer.unmount();
            });
        });
    });

    describe('Requirement 3.7 — Banner renders correctly in both themes', () => {
        it('renders with light theme info colors', () => {
            __TEST_THEME_OVERRIDE__.colors = lightColors;
            __TEST_THEME_OVERRIDE__.isDark = false;

            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            const json = renderer.toJSON();
            const jsonStr = JSON.stringify(json);

            // Banner should render with light theme info background
            expect(jsonStr).toContain(lightColors.semantic.infoBg);
            // Banner message should be present
            expect(jsonStr).toContain(BANNER_MESSAGE);

            act(() => {
                renderer.unmount();
            });
        });

        it('renders with dark theme info colors', () => {
            __TEST_THEME_OVERRIDE__.colors = darkColors;
            __TEST_THEME_OVERRIDE__.isDark = true;
            __TEST_THEME_OVERRIDE__.scheme = 'dark';

            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            const json = renderer.toJSON();
            const jsonStr = JSON.stringify(json);

            // Banner should render with dark theme info background
            expect(jsonStr).toContain(darkColors.semantic.infoBg);
            // Banner message should be present
            expect(jsonStr).toContain(BANNER_MESSAGE);

            act(() => {
                renderer.unmount();
            });
        });

        it('uses different info text colors for light and dark themes', () => {
            // Light theme
            __TEST_THEME_OVERRIDE__.colors = lightColors;
            const lightRenderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );
            const lightJson = JSON.stringify(lightRenderer.toJSON());

            act(() => {
                lightRenderer.unmount();
            });

            // Dark theme
            __TEST_THEME_OVERRIDE__.colors = darkColors;
            __TEST_THEME_OVERRIDE__.isDark = true;
            __TEST_THEME_OVERRIDE__.scheme = 'dark';

            const darkRenderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );
            const darkJson = JSON.stringify(darkRenderer.toJSON());

            act(() => {
                darkRenderer.unmount();
            });

            // Light and dark themes should use different infoText colors
            expect(lightJson).toContain(lightColors.semantic.infoText);
            expect(darkJson).toContain(darkColors.semantic.infoText);
            // Confirm they are actually different
            expect(lightColors.semantic.infoText).not.toBe(darkColors.semantic.infoText);
        });
    });

    describe('Requirements 8.1, 8.2 — Accessibility attributes', () => {
        it('container has accessibilityLiveRegion="polite"', () => {
            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            // The outermost View should have accessibilityLiveRegion
            const views = renderer.root.findAll(
                (node) =>
                    node.type === 'View' &&
                    node.props.accessibilityLiveRegion === 'polite',
            );
            expect(views.length).toBeGreaterThan(0);

            act(() => {
                renderer.unmount();
            });
        });

        it('resend action has accessibilityRole="button"', () => {
            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            const pressables = renderer.root.findAll(
                (node) =>
                    node.type === 'Pressable' &&
                    node.props.accessibilityRole === 'button',
            );
            expect(pressables.length).toBeGreaterThan(0);

            act(() => {
                renderer.unmount();
            });
        });

        it('resend action has descriptive accessibilityLabel', () => {
            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            const resendPressable = renderer.root.findAll(
                (node) =>
                    node.type === 'Pressable' &&
                    typeof node.props.accessibilityLabel === 'string' &&
                    node.props.accessibilityLabel.includes('Reenviar'),
            );
            expect(resendPressable.length).toBe(1);
            expect(resendPressable[0].props.accessibilityLabel).toBe(
                'Reenviar e-mail de confirmação',
            );

            act(() => {
                renderer.unmount();
            });
        });

        it('resend action has accessibilityState with disabled: false when ready', () => {
            const renderer = render(
                <EmailVerificationBanner email="admin@example.com" emailConfirmedAt={null} />,
            );

            const resendPressable = renderer.root.findAll(
                (node) =>
                    node.type === 'Pressable' &&
                    typeof node.props.accessibilityLabel === 'string' &&
                    node.props.accessibilityLabel.includes('Reenviar'),
            )[0];

            expect(resendPressable.props.accessibilityState).toEqual(
                expect.objectContaining({ disabled: false }),
            );

            act(() => {
                renderer.unmount();
            });
        });
    });
});
