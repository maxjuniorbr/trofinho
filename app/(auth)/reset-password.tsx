import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { ArrowRight, Lock, CheckCircle2 } from 'lucide-react-native';
import { confirmPasswordReset } from '@lib/auth';
import { spacing, typography, radii } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField, DarkPasswordToggle } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { InlineMessage } from '@/components/ui/inline-message';

type Step = 'form' | 'done';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();
    const { palette } = useHeroPalette();
    const styles = useMemo(() => makeStyles(palette), [palette]);

    const hasTokens = Boolean(params.access_token && params.refresh_token);
    const accessToken = params.access_token ?? '';
    const refreshToken = params.refresh_token ?? '';

    const [step, setStep] = useState<Step>('form');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const validate = (): string | null => {
        if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
        return null;
    };

    const handleSubmit = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError('');
        setLoading(true);

        const { error: resetError } = await confirmPasswordReset(accessToken, refreshToken, password);

        if (resetError) {
            setLoading(false);
            setError(resetError);
            return;
        }

        setLoading(false);
        setStep('done');
    };

    // Missing tokens — invalid link
    if (!hasTokens) {
        return (
            <AuthHeroScreen topBarCenter={<BrandLogo size="sm" withText />}>
                <View style={styles.header}>
                    <Text style={styles.title} allowFontScaling={false}>
                        Link inválido.
                    </Text>
                    <Text style={styles.subtitle}>
                        Este link expirou ou é inválido. Solicite um novo link de redefinição.
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.errorCard}>
                        <InlineMessage
                            message="Link inválido. Solicite um novo link de redefinição."
                            variant="error"
                        />
                    </View>

                    <Button
                        label="Ir para o login"
                        onPress={() => router.replace('/(auth)/login')}
                        size="lg"
                        trailingIcon={ArrowRight}
                        accessibilityLabel="Ir para o login"
                    />
                </View>
            </AuthHeroScreen>
        );
    }

    // Success state
    if (step === 'done') {
        return (
            <AuthHeroScreen topBarCenter={<BrandLogo size="sm" withText />}>
                <View style={styles.header}>
                    <Text style={styles.title} allowFontScaling={false}>
                        Tudo certo!
                    </Text>
                    <Text style={styles.subtitle}>
                        Sua senha foi atualizada. Faça login para continuar.
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.successCard}>
                        <View style={styles.successIconContainer}>
                            <CheckCircle2 size={22} color={palette.borderFocus} strokeWidth={2.5} />
                        </View>
                        <View style={styles.successTextContainer}>
                            <Text style={styles.successTitle}>Senha atualizada</Text>
                            <Text style={styles.successDescription}>
                                Você já pode entrar usando sua nova senha.
                            </Text>
                        </View>
                    </View>

                    <Button
                        label="Ir para o login"
                        onPress={() => router.replace('/(auth)/login')}
                        size="lg"
                        trailingIcon={ArrowRight}
                        accessibilityLabel="Ir para o login"
                    />
                </View>
            </AuthHeroScreen>
        );
    }

    // Form state
    return (
        <AuthHeroScreen topBarCenter={<BrandLogo size="sm" withText />}>
            <View style={styles.header}>
                <Text style={styles.title} allowFontScaling={false}>
                    Crie uma{'\n'}nova senha.
                </Text>
                <Text style={styles.subtitle}>
                    Use pelo menos 8 caracteres. Misture letras e números.
                </Text>
            </View>

            <View style={styles.form}>
                <AuthDarkField
                    label="Nova senha"
                    focused={false}
                    placeholder="••••••••"
                    value={password}
                    onChangeText={(value) => {
                        setPassword(value);
                        setError('');
                    }}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    maxLength={128}
                    editable={!loading}
                    accessibilityLabel="Campo de nova senha"
                    leftIcon={Lock}
                    rightAction={
                        <DarkPasswordToggle
                            visible={showPassword}
                            onToggle={() => setShowPassword(!showPassword)}
                        />
                    }
                />

                {password.length > 0 && password.length < 8 ? (
                    <Text style={styles.passwordHint}>Mínimo 8 caracteres</Text>
                ) : null}

                <View style={styles.formActions}>
                    <FormFooter message={error || null} includeSafeBottom={false}>
                        <Button
                            label="Redefinir senha"
                            loadingLabel="Redefinindo…"
                            loading={loading}
                            onPress={handleSubmit}
                            size="lg"
                            trailingIcon={ArrowRight}
                            accessibilityLabel={loading ? 'Redefinindo' : 'Redefinir senha'}
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
        errorCard: {
            marginBottom: spacing['4'],
        },
        successCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing['3'],
            backgroundColor: palette.surfaceChip,
            borderWidth: 1,
            borderColor: palette.borderSoft,
            borderRadius: radii.lg,
            padding: spacing['4'],
            marginBottom: spacing['5'],
        },
        successIconContainer: {
            width: 40,
            height: 40,
            borderRadius: radii.full,
            backgroundColor: palette.borderFocus + '20',
            alignItems: 'center',
            justifyContent: 'center',
        },
        successTextContainer: {
            flex: 1,
        },
        successTitle: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.sm,
            color: palette.textOnNavy,
        },
        successDescription: {
            marginTop: spacing['0.5'],
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs,
            color: palette.textOnNavyMuted,
        },
        formActions: {
            marginTop: spacing['4'],
        },
        passwordHint: {
            fontFamily: typography.family.semibold,
            fontSize: typography.size.xs,
            color: palette.textOnNavySubtle,
            marginTop: spacing['2'],
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
