import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { AlertCircle, ArrowRight, Hash, User, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { refreshAuthSession } from '@lib/auth';
import { withAlpha } from '@/constants/colors';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { useTheme } from '@/context/theme-context';
import {
    useValidateInvite,
    useAcceptInvite,
} from '@/hooks/queries/use-admin-invite';

const CODE_LENGTH = 6;

type JoinField = 'name';

export default function JoinFamilyScreen() {
    const router = useRouter();
    const { palette } = useHeroPalette();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(palette), [palette]);

    const [code, setCode] = useState('');
    const [submittedCode, setSubmittedCode] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState<JoinField | null>(null);
    const [codeFocused, setCodeFocused] = useState(false);

    const handleBack = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(auth)/login');
        }
    }, [router]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBack();
            return true;
        });
        return () => sub.remove();
    }, [handleBack]);

    const isCodeComplete = code.length === CODE_LENGTH;

    // Validation fires only after the user presses the submit button.
    const {
        data: preview,
        isLoading: isValidating,
        error: validateError,
        refetch: refetchInvite,
    } = useValidateInvite(submittedCode);

    const acceptInvite = useAcceptInvite();

    const isAccepting = acceptInvite.isPending;
    const hasPreview = Boolean(preview) && !validateError;

    const handleCodeChange = (value: string) => {
        // Auto-uppercase and limit to CODE_LENGTH alphanumeric chars
        const formatted = value.toUpperCase().replaceAll(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
        setCode(formatted);
        setError('');
        // Reset validation state so a new button press re-validates the new code.
        if (submittedCode) setSubmittedCode('');
        acceptInvite.reset();
    };

    const handleSubmit = async () => {
        if (!isCodeComplete) {
            setError('Informe um código de 6 caracteres.');
            return;
        }

        // Step 1: code not yet validated — trigger validation.
        if (!hasPreview && !isValidating) {
            setError('');
            if (submittedCode === code) {
                await refetchInvite();
            } else {
                setSubmittedCode(code);
            }
            return;
        }

        // Step 2: code validated, accept invite.
        if (hasPreview) {
            if (!name.trim()) {
                setError('Informe seu nome.');
                return;
            }
            setError('');
            try {
                await acceptInvite.mutateAsync({ code, name: name.trim() });
                const { error: refreshError } = await refreshAuthSession();
                if (refreshError) {
                    setError(refreshError);
                    return;
                }
                // Navigation is handled by the root layout auth state handler after
                // session refresh detects the new familia_id.
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Erro ao ingressar na família.';
                setError(message);
            }
        }
    };

    const validationErrorMessage = validateError instanceof Error
        ? validateError.message
        : 'Código inválido ou expirado. Peça um novo ao administrador.';
    const validationMessage = submittedCode && validateError ? validationErrorMessage : null;
    const displayError = error || validationMessage;

    let codeInputBorderColor = palette.borderSoft;
    if (displayError) codeInputBorderColor = colors.semantic.error;
    else if (codeFocused) codeInputBorderColor = palette.borderFocus;

    const isSubmitBusy = isValidating || isAccepting;

    return (
        <AuthHeroScreen
            topBarCenter={<BrandLogo size="sm" withText />}
            onBack={handleBack}
            backAccessibilityLabel="Voltar"
        >
            <View style={styles.header}>
                <Text style={styles.kicker} allowFontScaling={false}>
                    Convite
                </Text>
                <Text style={styles.title} allowFontScaling={false}>
                    Ingressar na família
                </Text>
                <Text style={styles.subtitle}>
                    Informe o código de 6 caracteres que você recebeu do administrador da família.
                </Text>
            </View>

            <View style={styles.form}>
                <View
                    style={[
                        styles.codeInputRow,
                        {
                            backgroundColor: codeFocused ? palette.surfaceFieldFocus : palette.surfaceField,
                            borderColor: codeInputBorderColor,
                        },
                    ]}
                >
                    <Hash size={18} color={palette.textOnNavySubtle} strokeWidth={1.75} />
                    <TextInput
                        style={[styles.codeInput, { color: palette.textOnNavy }]}
                        placeholder="ABC123"
                        placeholderTextColor={palette.textOnNavyFaint}
                        value={code}
                        onChangeText={handleCodeChange}
                        onFocus={() => setCodeFocused(true)}
                        onBlur={() => setCodeFocused(false)}
                        onSubmitEditing={handleSubmit}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={CODE_LENGTH}
                        editable={!isSubmitBusy}
                        selectionColor={palette.borderFocus}
                        accessibilityLabel="Campo de código do convite"
                        returnKeyType="go"
                    />
                    <Pressable
                        onPress={handleSubmit}
                        disabled={isSubmitBusy}
                        style={({ pressed }) => {
                            let opacity = 1;
                            if (isSubmitBusy) opacity = 0.6;
                            else if (pressed) opacity = 0.9;
                            return [styles.codeSubmitButton, { opacity }];
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Ingressar na família"
                        accessibilityState={{ busy: isSubmitBusy }}
                    >
                        <LinearGradient
                            colors={gradients.goldHorizontal.colors}
                            start={gradients.goldHorizontal.start}
                            end={gradients.goldHorizontal.end}
                            style={styles.codeSubmitGradient}
                        >
                            <ArrowRight size={18} color="#030711" strokeWidth={2.5} />
                        </LinearGradient>
                    </Pressable>
                </View>
                {displayError ? (
                    <View style={styles.codeErrorRow}>
                        <AlertCircle size={14} color={colors.semantic.errorText} strokeWidth={2.25} />
                        <Text style={[styles.codeError, { color: colors.semantic.errorText }]}>{displayError}</Text>
                    </View>
                ) : null}

                {isValidating ? (
                    <Text style={styles.validatingText}>Verificando código…</Text>
                ) : null}

                {hasPreview && preview ? (
                    <View style={styles.previewCard}>
                        <View style={styles.previewIconBox}>
                            <Users size={20} color={palette.checkOnText} strokeWidth={2.5} />
                        </View>
                        <View style={styles.previewContent}>
                            <Text style={styles.previewFamilyName} numberOfLines={1}>
                                {preview.familia_nome}
                            </Text>
                            <Text style={styles.previewAdminName} numberOfLines={1}>
                                Administrador: {preview.admin_nome}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {hasPreview ? (
                    <AuthDarkField
                        label="Seu nome"
                        focused={focusedField === 'name'}
                        placeholder="Como quer ser chamado"
                        value={name}
                        onChangeText={(value) => {
                            setName(value);
                            setError('');
                        }}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                        maxLength={60}
                        editable={!isAccepting}
                        accessibilityLabel="Campo de nome"
                        leftIcon={User}
                    />
                ) : null}

            </View>
        </AuthHeroScreen>
    );
}

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
    return StyleSheet.create({
        header: {
            marginTop: spacing['6'],
        },
        kicker: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.xxs,
            letterSpacing: 0,
            textTransform: 'uppercase',
            color: palette.borderFocus,
        },
        title: {
            marginTop: spacing['2'],
            fontFamily: typography.family.black,
            fontSize: typography.size['3xl'],
            lineHeight: typography.lineHeight['3xl'],
            color: palette.textOnNavy,
            letterSpacing: 0,
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
        validatingText: {
            marginTop: spacing['2'],
            fontFamily: typography.family.semibold,
            fontSize: typography.size.xs,
            color: palette.textOnNavySubtle,
        },
        previewCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['3'],
            marginTop: spacing['5'],
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
            borderRadius: radii.lg,
            backgroundColor: withAlpha(palette.checkOn, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(palette.checkOn, 0.25),
        },
        previewIconBox: {
            width: 40,
            height: 40,
            borderRadius: radii.md,
            backgroundColor: withAlpha(palette.checkOn, 0.2),
            alignItems: 'center',
            justifyContent: 'center',
        },
        previewContent: {
            flex: 1,
        },
        previewFamilyName: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.sm,
            color: palette.checkOnText,
        },
        previewAdminName: {
            marginTop: spacing['0.5'],
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs,
            color: palette.textOnNavy,
        },
        codeInputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderRadius: radii.inner,
            paddingLeft: spacing['4'],
            paddingRight: spacing['2'],
            paddingVertical: spacing['2'],
            minHeight: 52,
            gap: spacing['3'],
        },
        codeInput: {
            flex: 1,
            fontSize: typography.size.md,
            fontFamily: typography.family.bold,
            letterSpacing: 0,
            paddingVertical: spacing['2'],
        },
        codeSubmitButton: {
            borderRadius: radii.md,
            overflow: 'hidden',
            ...shadows.goldButtonGlow,
        },
        codeSubmitGradient: {
            height: 50,
            paddingHorizontal: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        codeErrorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['1.5'],
        },
        codeError: {
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs,
            lineHeight: typography.lineHeight.xs,
        },
    });
}
