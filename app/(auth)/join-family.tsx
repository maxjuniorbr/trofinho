import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { ArrowRight, Hash, User, Users } from 'lucide-react-native';
import { refreshAuthSession } from '@lib/auth';
import { withAlpha } from '@/constants/colors';
import { radii, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import {
    useValidateInvite,
    useAcceptInvite,
} from '@/hooks/queries/use-admin-invite';

const CODE_LENGTH = 6;

type JoinField = 'code' | 'name';

export default function JoinFamilyScreen() {
    const router = useRouter();
    const { palette } = useHeroPalette();
    const styles = useMemo(() => makeStyles(palette), [palette]);

    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState<JoinField | null>(null);

    const isCodeComplete = code.length === CODE_LENGTH;

    // Real-time validation — enabled when code has 6 chars
    const {
        data: preview,
        isLoading: isValidating,
        error: validateError,
    } = useValidateInvite(code);

    const acceptInvite = useAcceptInvite();

    const isAccepting = acceptInvite.isPending;
    const hasPreview = Boolean(preview) && !validateError;

    const handleCodeChange = (value: string) => {
        // Auto-uppercase and limit to CODE_LENGTH alphanumeric chars
        const formatted = value.toUpperCase().replaceAll(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
        setCode(formatted);
        setError('');
        acceptInvite.reset();
    };

    const handleAccept = async () => {
        if (!isCodeComplete || !hasPreview) return;

        if (!name.trim()) {
            setError('Informe seu nome.');
            return;
        }

        setError('');

        try {
            await acceptInvite.mutateAsync({ code, name: name.trim() });

            // Refresh auth session so the root layout detects the new familia_id
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
    };

    // Derive the displayed error: prioritize local error, then validation error
    const validationMessage =
        validateError instanceof Error
            ? validateError.message
            : 'Código inválido ou expirado.';

    const displayError =
        error || (validateError && isCodeComplete ? validationMessage : null);

    return (
        <AuthHeroScreen
            topBarCenter={<BrandLogo size="sm" withText />}
            onBack={() => router.back()}
            backAccessibilityLabel="Voltar para onboarding"
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
                <AuthDarkField
                    label="Código do convite"
                    focused={focusedField === 'code'}
                    placeholder="Ex: ABC123"
                    value={code}
                    onChangeText={handleCodeChange}
                    onFocus={() => setFocusedField('code')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={CODE_LENGTH}
                    editable={!isAccepting}
                    accessibilityLabel="Campo de código do convite"
                    leftIcon={Hash}
                />

                {isValidating && isCodeComplete ? (
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

                <View style={styles.formActions}>
                    <FormFooter message={displayError} includeSafeBottom={false}>
                        {hasPreview ? (
                            <Button
                                label="Ingressar na família"
                                loadingLabel="Ingressando…"
                                loading={isAccepting}
                                onPress={handleAccept}
                                size="lg"
                                trailingIcon={ArrowRight}
                                disabled={!name.trim() || isAccepting}
                                accessibilityLabel={isAccepting ? 'Ingressando na família' : 'Ingressar na família'}
                                accessibilityState={{ busy: isAccepting }}
                            />
                        ) : null}
                    </FormFooter>
                </View>

                <View style={styles.footerPush}>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
                        onPress={() => router.back()}
                        disabled={isAccepting}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar para criação de família"
                    >
                        <Text style={styles.secondaryButtonText}>Criar família em vez disso</Text>
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
        kicker: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.xxs,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: palette.borderFocus,
        },
        title: {
            marginTop: spacing['2'],
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
            marginTop: 2,
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs,
            color: palette.textOnNavy,
        },
        formActions: {
            marginTop: spacing['4'],
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
    });
}
