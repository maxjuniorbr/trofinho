import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { act, create } from '../../../../test/helpers/test-renderer-compat';
import { EmailVerificationBanner } from '../email-verification-banner';
import type { ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';

/**
 * Feature: email-verification-nonblocking
 * Property 1: Banner visibility is a pure function of emailConfirmedAt
 *
 * For any auth user state, the email verification banner SHALL be visible
 * if and only if `emailConfirmedAt` is `null` or `undefined`. For any
 * non-null `emailConfirmedAt` value (any valid ISO 8601 timestamp string),
 * the banner SHALL not render.
 *
 * **Validates: Requirements 2.2, 2.3, 3.1, 3.5, 5.1**
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

// Reset persisted cooldowns between tests so each run starts fresh
import { resetAllCooldowns } from '@lib/resend-cooldown';
beforeEach(() => {
    resetAllCooldowns();
});

const BANNER_MESSAGE = 'Confirme seu email para garantir acesso à recuperação de senha';

/**
 * Helper: renders the banner and returns whether the message text is present.
 */
function rendersBanner(emailConfirmedAt: string | null | undefined): boolean {
    let found = false;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
        renderer = create(
            <EmailVerificationBanner
                email="test@example.com"
                emailConfirmedAt={emailConfirmedAt as string | null}
            />,
        );
    });

    if (!renderer) return false;

    try {
        const json = renderer.toJSON();
        if (json === null) {
            // Component returned null — banner not rendered
            found = false;
        } else {
            // Walk the JSON tree looking for the banner message text
            found = JSON.stringify(json).includes(BANNER_MESSAGE);
        }
    } finally {
        act(() => {
            renderer!.unmount();
        });
    }

    return found;
}

describe('Feature: email-verification-nonblocking, Property 1: Banner visibility is a pure function of emailConfirmedAt', () => {
    it('banner renders when emailConfirmedAt is null', () => {
        fc.assert(
            fc.property(fc.constant(null), (emailConfirmedAt) => {
                const visible = rendersBanner(emailConfirmedAt);
                expect(visible).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('banner renders when emailConfirmedAt is undefined', () => {
        fc.assert(
            fc.property(fc.constant(undefined), (emailConfirmedAt) => {
                const visible = rendersBanner(emailConfirmedAt);
                expect(visible).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('banner does NOT render for any non-null string emailConfirmedAt', () => {
        fc.assert(
            fc.property(fc.string({ minLength: 1 }), (emailConfirmedAt) => {
                const visible = rendersBanner(emailConfirmedAt);
                expect(visible).toBe(false);
            }),
            { numRuns: 100 },
        );
    });

    it('banner visibility is purely determined by emailConfirmedAt across random values', () => {
        // fc.option(fc.string()) generates null or random strings
        fc.assert(
            fc.property(fc.option(fc.string()), (emailConfirmedAt) => {
                const visible = rendersBanner(emailConfirmedAt);

                if (emailConfirmedAt == null) {
                    // null or undefined → banner should be visible
                    expect(visible).toBe(true);
                } else {
                    // any non-null string → banner should NOT be visible
                    expect(visible).toBe(false);
                }
            }),
            { numRuns: 100 },
        );
    });
});


/**
 * Feature: email-verification-nonblocking
 * Property 3: Cooldown timer prevents resend during active period
 *
 * For any cooldown value `n` where `0 < n ≤ 60`, the resend action SHALL be
 * disabled, the displayed text SHALL contain the remaining seconds value, and
 * the `accessibilityState` SHALL indicate `disabled: true`. For `n = 0`, the
 * resend action SHALL be enabled.
 *
 * **Validates: Requirements 4.5, 4.6, 8.3, 8.4**
 */
describe('Feature: email-verification-nonblocking, Property 3: Cooldown timer prevents resend during active period', () => {
    beforeEach(() => {
        resetAllCooldowns();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * Helper: renders the banner, presses resend to start the 60s cooldown,
     * then advances timers so the remaining cooldown equals `n`.
     * Returns the JSON tree and the renderer for cleanup.
     *
     * Must be called inside an async context because handleResend is async.
     */
    async function renderAtCooldown(n: number): Promise<{
        json: ReturnType<ReactTestRenderer['toJSON']>;
        renderer: ReactTestRenderer;
    }> {
        // Reset persisted cooldowns so each property run starts clean
        resetAllCooldowns();

        let renderer!: ReactTestRenderer;

        act(() => {
            renderer = create(
                <EmailVerificationBanner
                    email="test@example.com"
                    emailConfirmedAt={null}
                />,
            );
        });

        // Find the Pressable resend action and press it to start the cooldown.
        const resendPressable = renderer.root.findAll(
            (node) =>
                (node.type as string) === 'Pressable' &&
                typeof node.props.accessibilityLabel === 'string' &&
                node.props.accessibilityLabel.includes('Reenviar'),
        )[0];

        // Press the resend button — handleResend is async, so we need
        // await act(async ...) to let the mocked resendConfirmationEmail resolve.
        // After resolution, startCooldown() sets resendIn to 60.
        await act(async () => {
            await resendPressable.props.onPress();
        });

        // Advance timers so the remaining cooldown equals `n`.
        // After pressing, cooldown starts at 60. To reach `n`, advance by (60 - n) seconds.
        const advanceMs = (60 - n) * 1000;
        if (advanceMs > 0) {
            act(() => {
                vi.advanceTimersByTime(advanceMs);
            });
        }

        const json = renderer.toJSON();
        return { json, renderer };
    }

    it('for any cooldown n > 0, resend action is disabled and text shows remaining seconds', async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 60 }), async (n) => {
                const { json, renderer } = await renderAtCooldown(n);

                try {
                    const jsonStr = JSON.stringify(json);

                    // The text should contain "Reenviar em {n}s"
                    expect(jsonStr).toContain(`Reenviar em ${n}s`);

                    // Find the Pressable with the resend accessibility label
                    const resendPressable = renderer.root.findAll(
                        (node) =>
                            (node.type as string) === 'Pressable' &&
                            typeof node.props.accessibilityLabel === 'string' &&
                            node.props.accessibilityLabel.includes('Reenviar'),
                    )[0];

                    // accessibilityState should indicate disabled
                    expect(resendPressable.props.accessibilityState).toEqual(
                        expect.objectContaining({ disabled: true }),
                    );
                } finally {
                    act(() => {
                        renderer.unmount();
                    });
                }
            }),
            { numRuns: 100 },
        );
    });

    it('for cooldown n === 0, resend action is enabled and text shows "Reenviar e-mail"', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(0), async (n) => {
                const { json, renderer } = await renderAtCooldown(n);

                try {
                    const jsonStr = JSON.stringify(json);

                    // The text should show "Reenviar e-mail" (not a countdown)
                    expect(jsonStr).toContain('Reenviar e-mail');
                    // Should NOT contain "Reenviar em" countdown text
                    expect(jsonStr).not.toMatch(/Reenviar em \d+s/);

                    // Find the Pressable with the resend accessibility label
                    const resendPressable = renderer.root.findAll(
                        (node) =>
                            (node.type as string) === 'Pressable' &&
                            typeof node.props.accessibilityLabel === 'string' &&
                            node.props.accessibilityLabel.includes('Reenviar'),
                    )[0];

                    // accessibilityState should indicate enabled (disabled: false)
                    expect(resendPressable.props.accessibilityState).toEqual(
                        expect.objectContaining({ disabled: false }),
                    );
                } finally {
                    act(() => {
                        renderer.unmount();
                    });
                }
            }),
            { numRuns: 100 },
        );
    });

    it('cooldown state is correctly determined by remaining time for any value 0–60', async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 0, max: 60 }), async (n) => {
                const { json, renderer } = await renderAtCooldown(n);

                try {
                    const jsonStr = JSON.stringify(json);

                    const resendPressable = renderer.root.findAll(
                        (node) =>
                            (node.type as string) === 'Pressable' &&
                            typeof node.props.accessibilityLabel === 'string' &&
                            node.props.accessibilityLabel.includes('Reenviar'),
                    )[0];

                    if (n > 0) {
                        // During active cooldown: disabled + countdown text
                        expect(jsonStr).toContain(`Reenviar em ${n}s`);
                        expect(resendPressable.props.accessibilityState).toEqual(
                            expect.objectContaining({ disabled: true }),
                        );
                    } else {
                        // Cooldown expired: enabled + ready text
                        expect(jsonStr).toContain('Reenviar e-mail');
                        expect(jsonStr).not.toMatch(/Reenviar em \d+s/);
                        expect(resendPressable.props.accessibilityState).toEqual(
                            expect.objectContaining({ disabled: false }),
                        );
                    }
                } finally {
                    act(() => {
                        renderer.unmount();
                    });
                }
            }),
            { numRuns: 100 },
        );
    });
});
