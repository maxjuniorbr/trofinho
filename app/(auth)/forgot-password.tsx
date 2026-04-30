import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Mail, MailCheck, RotateCw } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import { requestPasswordReset } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { spacing, typography, radii } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';

type Step = 'email' | 'sent';

const RESEND_COOLDOWN = 60;

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { palette } = useHeroPalette();
    const styles = useMemo(() => makeStyles(palette), [palette]);

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendIn, setResendIn] = useState(0);
    const [focused, setFocused] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => () => clearTimer(), [clearTimer]);

    const startCooldown = useCallback(() => {
        clearTimer();
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

    const validate = (): string | null => {
        const emailValue = email.trim();
        if (!emailValue) return 'Informe seu e-mail.';
        if (!isValidEmail(emailValue)) return 'E-mail inválido.';
        return null;
    };

    const sendLink = async () => {
        if (resendIn > 0) return;

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError('');
        setLoading(true);

        Sentry.addBreadcrumb({
            category: 'auth',
            message: 'password_reset_requested',
        });

        const { error: resetError } = await requestPasswordReset(email.trim());

        setLoading(false);

        if (resetError) {
            setError(resetError);
            return;
        }

        setStep('sent');
        startCooldown();
    };

    const title = step === 'email' ? 'Esqueceu\nsua senha?' : 'Confira\nseu e-mail.';
    const subtitle =
        step === 'email'
            ? 'Sem estresse. Vamos enviar um link para você criar uma nova senha.'
            : `Enviamos um link de redefinição para ${email.trim()}. Abra o e-mail no seu dispositivo para criar uma nova senha.`;

    return (
        <AuthHeroScreen
            topBarCenter={<BrandLogo size="sm" withText />}
        >
            <View style={styles.header}>
                <Text style={styles.title} allowFontScaling={false}>
                    {title}
                </Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.form}>
                {step === 'email' && (
                    <>
                        <AuthDarkField
                            label="E-mail"
                            focused={focused}
                            placeholder="seu@email.com"
                            value={email}
                            onChangeText={(value) => {
                                setEmail(value);
                                setError('');
                            }}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                            maxLength={MAX_EMAIL_LENGTH}
                            editable={!loading}
                            accessibilityLabel="Campo de e-mail"
                            leftIcon={Mail}
                        />

                        <View style={styles.formActions}>
                            <FormFooter message={error || null} includeSafeBottom={false}>
                                <Button
                                    label="Enviar link"
                                    loadingLabel="Enviando…"
                                    loading={loading}
                                    onPress={sendLink}
                                    size="lg"
                                    trailingIcon={ArrowRight}
                                    accessibilityLabel={loading ? 'Enviando' : 'Enviar link'}
                                    accessibilityState={{ busy: loading }}
                                />
                            </FormFooter>
                        </View>

                        <View style={styles.footerPush}>
                            <Pressable
                                style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
                                onPress={() => router.replace('/(auth)/login')}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityLabel="Voltar ao login"
                            >
                                <Text style={styles.secondaryButtonText}>
                                    Lembrou da senha?{' '}
                                    <Text style={styles.secondaryButtonAccent}>Voltar ao login</Text>
                                </Text>
                            </Pressable>
                        </View>
                    </>
                )}

                {step === 'sent' && (
                    <>
                        <View style={styles.sentCard}>
                            <View style={styles.sentIconContainer}>
                                <MailCheck size={20} color={palette.borderFocus} strokeWidth={2.5} />
                            </View>
                            <View style={styles.sentTextContainer}>
                                <Text style={styles.sentTitle}>Link enviado para {email.trim()}</Text>
                                <Text style={styles.sentDescription}>
                                    O link expira em 1 hora. Se não encontrar, confira a caixa de spam.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.resendArea}>
                            <Pressable
                                onPress={sendLink}
                                disabled={resendIn > 0 || loading}
                                accessibilityRole="button"
                                accessibilityLabel={resendIn > 0 ? `Reenviar link em ${resendIn} segundos` : 'Reenviar link'}
                                style={({ pressed }) => {
                                    let opacity = 1;
                                    if (resendIn > 0 || loading) {
                                        opacity = 0.35;
                                    } else if (pressed) {
                                        opacity = 0.65;
                                    }
                                    return [styles.resendButton, { opacity }];
                                }}
                            >
                                <RotateCw size={14} color={palette.borderFocus} strokeWidth={2.5} />
                                <Text style={styles.resendText}>
                                    {resendIn > 0 ? `Reenviar link em ${resendIn}s` : 'Reenviar link'}
                                </Text>
                            </Pressable>

                            {error ? (
                                <FormFooter message={error} includeSafeBottom={false}>
                                    <View />
                                </FormFooter>
                            ) : null}
                        </View>

                        <Button
                            label="Voltar ao login"
                            onPress={() => router.replace('/(auth)/login')}
                            size="lg"
                            trailingIcon={ArrowRight}
                            accessibilityLabel="Voltar ao login"
                        />
                    </>
                )}
            </View>
        </AuthHeroScreen>
    );
}

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
    return StyleSheet.create({
        header: {
            marginTop: spacing['6'],
        },
        title: {
            fontFamily: typography.family.black,
            fontSize: typography.size['3xl'],
            lineHeight: typography.lineHeight['3xl'],
            color: palette.textOnNavy,
            letterSpacing: -0.4,
        },
        subtitle: {
            marginTop: spacing['2'],
            fontFamily: typography.family.medium,
            fontSize: typography.size.sm,
            lineHeight: typography.lineHeight.sm,
            color: palette.textOnNavyMuted,
        },
        form: {
            marginTop: spacing['6'],
            flex: 1,
        },
        formActions: {
            marginTop: spacing['4'],
        },
        sentCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing['3'],
            backgroundColor: palette.surfaceChip,
            borderWidth: 1,
            borderColor: palette.borderSoft,
            borderRadius: radii.lg,
            padding: spacing['4'],
        },
        sentIconContainer: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: palette.borderFocus + '33',
            alignItems: 'center',
            justifyContent: 'center',
        },
        sentTextContainer: {
            flex: 1,
        },
        sentTitle: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.sm,
            color: palette.textOnNavy,
        },
        sentDescription: {
            marginTop: 2,
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs,
            color: palette.textOnNavyMuted,
        },
        resendArea: {
            flex: 1,
            alignItems: 'center',
        },
        resendButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 'auto',
            marginBottom: 'auto',
        },
        resendText: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.xs,
            color: palette.borderFocus,
        },
        footerPush: {
            marginTop: 'auto',
        },
        secondaryButton: {
            paddingVertical: spacing['3'],
            alignItems: 'center',
        },
        secondaryButtonText: {
            fontFamily: typography.family.medium,
            fontSize: typography.size.sm,
            color: palette.textOnNavyMuted,
        },
        secondaryButtonAccent: {
            fontFamily: typography.family.bold,
            color: palette.borderFocus,
        },
    });
}
