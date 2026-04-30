import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Info, RotateCw } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';
import { opacityDisabled } from '@/constants/interactions';
import { resendConfirmationEmail } from '@lib/auth';
import { markSent, remainingCooldown } from '@lib/resend-cooldown';

const RESEND_COOLDOWN = 60;
const COOLDOWN_KEY = 'confirmation';
const FEEDBACK_DISMISS_MS = 5_000;

type EmailVerificationBannerProps = Readonly<{
    email: string;
    emailConfirmedAt: string | null;
}>;

export function EmailVerificationBanner({
    email,
    emailConfirmedAt,
}: EmailVerificationBannerProps) {
    const { colors } = useTheme();

    const [resendIn, setResendIn] = useState(() => remainingCooldown(COOLDOWN_KEY, RESEND_COOLDOWN));
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Cooldown timer (reused pattern from forgot-password.tsx) ──

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const clearFeedbackTimer = useCallback(() => {
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        clearTimer();
        clearFeedbackTimer();
    }, [clearTimer, clearFeedbackTimer]);

    // Resume countdown if there is remaining cooldown from a previous mount
    useEffect(() => {
        if (resendIn > 0 && !timerRef.current) {
            timerRef.current = setInterval(() => {
                setResendIn((prev) => {
                    if (prev <= 1) {
                        clearTimer();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const startCooldown = useCallback(() => {
        clearTimer();
        markSent(COOLDOWN_KEY);
        setResendIn(RESEND_COOLDOWN);
        timerRef.current = setInterval(() => {
            setResendIn((prev) => {
                if (prev <= 1) {
                    clearTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearTimer]);

    const dismissFeedbackAfterDelay = useCallback(() => {
        clearFeedbackTimer();
        feedbackTimerRef.current = setTimeout(() => {
            setFeedback(null);
        }, FEEDBACK_DISMISS_MS);
    }, [clearFeedbackTimer]);

    // ── Resend handler ──

    const handleResend = async () => {
        if (resendIn > 0 || loading) return;

        setLoading(true);
        setFeedback(null);

        const { error } = await resendConfirmationEmail(email);

        setLoading(false);

        if (error) {
            setFeedback({ type: 'error', message: error });
        } else {
            setFeedback({ type: 'success', message: 'E-mail de confirmação reenviado!' });
        }

        startCooldown();
        dismissFeedbackAfterDelay();
    };

    // ── Visibility: don't render when email is confirmed ──

    if (emailConfirmedAt != null) return null;

    // ── Derived state ──

    const isDisabled = resendIn > 0 || loading;
    const resendLabel =
        resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar e-mail';
    const resendA11yLabel =
        resendIn > 0
            ? `Reenviar e-mail em ${resendIn} segundos`
            : 'Reenviar e-mail de confirmação';

    const feedbackColor =
        feedback?.type === 'success'
            ? colors.semantic.successText
            : colors.semantic.errorText;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors.semantic.infoBg,
                    borderColor: withAlpha(colors.semantic.info, 0.25),
                },
            ]}
            accessibilityLiveRegion="polite"
        >
            {/* Header row: icon + message */}
            <View style={styles.headerRow}>
                <Info
                    size={18}
                    color={colors.semantic.infoText}
                    strokeWidth={2.25}
                />
                <Text style={[styles.message, { color: colors.semantic.infoText }]}>
                    Confirme seu email para garantir acesso à recuperação de senha
                </Text>
            </View>

            {/* Resend action */}
            <Pressable
                onPress={handleResend}
                disabled={isDisabled}
                accessibilityRole="button"
                accessibilityLabel={resendA11yLabel}
                accessibilityState={{ disabled: isDisabled }}
                style={({ pressed }) => {
                    let opacity = 1;
                    if (isDisabled) {
                        opacity = opacityDisabled.heavy;
                    } else if (pressed) {
                        opacity = 0.65;
                    }
                    return [styles.resendAction, { opacity }];
                }}
            >
                <RotateCw
                    size={14}
                    color={colors.semantic.info}
                    strokeWidth={2.5}
                />
                <Text style={[styles.resendText, { color: colors.semantic.info }]}>
                    {resendLabel}
                </Text>
            </Pressable>

            {/* Feedback message */}
            {feedback ? (
                <Text style={[styles.feedbackText, { color: feedbackColor }]}>
                    {feedback.message}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: radii.xl,
        borderCurve: 'continuous',
        borderWidth: 1,
        padding: spacing['4'],
        gap: spacing['3'],
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing['2'],
    },
    message: {
        flex: 1,
        fontSize: typography.size.sm,
        fontFamily: typography.family.medium,
        lineHeight: typography.lineHeight.sm,
    },
    resendAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['1.5'],
        alignSelf: 'flex-start',
        paddingVertical: spacing['0.5'],
    },
    resendText: {
        fontFamily: typography.family.bold,
        fontSize: typography.size.xs,
    },
    feedbackText: {
        fontSize: typography.size.xs,
        fontFamily: typography.family.medium,
    },
});
