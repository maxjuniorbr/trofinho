import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, LogOut, Users } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import { BrandLogo } from '@/components/auth/brand-logo';
import { signInWithGoogle, signOut, refreshAuthSession } from '@lib/auth';
import {
    CHILD_INVITE_CODE_LENGTH,
    type ChildInvitePreview,
    formatChildInviteCode,
    resolveInitialChildInvite,
} from '@lib/child-invite';
import { formatLocalIsoDate } from '@lib/google-auth-utils';
import { supabase } from '@lib/supabase';
import { radii, spacing, typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { DateOfBirthField } from '@/components/auth/date-of-birth-field';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';

type Step = 'google' | 'dob';

type JoinChildParams = {
    code?: string | string[];
};

function firstParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
}

export default function JoinChildScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const params = useLocalSearchParams<JoinChildParams>();
    const { code: codeParam } = params;
    const codeParamValue = firstParam(codeParam);
    const initialCode = useMemo(() => formatChildInviteCode(codeParamValue), [codeParamValue]);

    const [step, setStep] = useState<Step>('google');
    const [code, setCode] = useState(initialCode);
    const [preview, setPreview] = useState<ChildInvitePreview | null>(null);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');

    // Google sign-in step
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState('');

    // DOB step
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [dobError, setDobError] = useState<string | null>(null);
    const [dobLoading, setDobLoading] = useState(false);
    const [showLeaveSheet, setShowLeaveSheet] = useState(false);

    useEffect(() => {
        let mounted = true;

        const resolveInvite = async () => {
            try {
                setInviteLoading(true);
                setInviteError('');
                setCode(initialCode);
                setPreview(null);

                const resolved = await resolveInitialChildInvite(initialCode);
                if (!mounted) return;

                setCode(resolved.code);
                setPreview(resolved.preview);
                setInviteError(resolved.error ?? '');
                setInviteLoading(false);

                if (resolved.autoAdvance) {
                    setStep('dob');
                }
            } catch (error) {
                Sentry.captureException(error, {
                    tags: { area: 'join-child', step: 'resolve-invite' },
                });
                if (!mounted) return;
                setPreview(null);
                setInviteError('Erro ao verificar código. Tente novamente.');
                setInviteLoading(false);
            }
        };

        void resolveInvite();

        return () => {
            mounted = false;
        };
    }, [initialCode]);

    const handleGoogleStepBack = useCallback(() => {
        if (googleLoading) return;
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(auth)/login');
        }
    }, [googleLoading, router]);

    const handleCancelAndSignOut = useCallback(async () => {
        // Clear pending invite marker so the nav guard doesn't redirect
        // back here on the user's next sign-in with this Google account.
        try {
            await supabase.auth.updateUser({ data: { pending_child_invite: null } });
        } catch {
            // best-effort cleanup; sign-out is still the important outcome
        }
        await signOut();
        router.replace('/(auth)/login');
    }, [router]);

    const handleCancelAndSignOutConfirm = useCallback(async () => {
        setShowLeaveSheet(false);
        if (step === 'dob') {
            setStep('google');
        } else {
            await handleCancelAndSignOut();
        }
    }, [step, handleCancelAndSignOut]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'dob') {
                if (!dobLoading) setShowLeaveSheet(true);
            } else {
                handleGoogleStepBack();
            }
            return true;
        });
        return () => sub.remove();
    }, [dobLoading, handleGoogleStepBack, step]);

    const handleGoogleSignIn = async () => {
        if (!preview || code.length !== CHILD_INVITE_CODE_LENGTH) {
            setGoogleError(inviteError || 'Código de convite ausente. Volte e informe o código novamente.');
            return;
        }

        setGoogleError('');
        setGoogleLoading(true);

        const {
            profile,
            isNewUser,
            error: signInError,
        } = await signInWithGoogle();

        if (signInError) {
            setGoogleLoading(false);
            setGoogleError(signInError);
            return;
        }

        if (!profile && !isNewUser) {
            setGoogleLoading(false);
            return;
        }

        if (profile?.familia_id) {
            await signOut();
            setGoogleLoading(false);
            const msg =
                profile.papel === 'admin'
                    ? 'Esta conta é de um responsável. Use outra conta Google.'
                    : 'Esta conta já pertence a uma família. Use outra conta Google.';
            setGoogleError(msg);
            return;
        }

        // Save invite code marker so the nav guard can redirect orphan users
        // back to join-child instead of admin onboarding if the app is closed.
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: { pending_child_invite: code },
            });
            if (updateError) {
                setGoogleLoading(false);
                setGoogleError('Erro ao preparar convite. Tente novamente.');
                return;
            }
        } catch (error) {
            Sentry.captureException(error, {
                tags: { area: 'join-child', step: 'persist-pending-invite' },
            });
            setGoogleLoading(false);
            setGoogleError('Erro ao preparar convite. Tente novamente.');
            return;
        }

        setGoogleLoading(false);
        setStep('dob');
    };

    const handleDobSubmit = async () => {
        if (!dateOfBirth) {
            setDobError('Informe sua data de nascimento.');
            return;
        }

        if (code.length !== CHILD_INVITE_CODE_LENGTH) {
            setDobError('Código de convite ausente. Volte e informe o código novamente.');
            return;
        }

        setDobError(null);
        setDobLoading(true);

        const isoDate = formatLocalIsoDate(dateOfBirth);

        try {
            const { data, error } = await supabase.functions.invoke('vincular-filho', {
                body: { invite_code: code, date_of_birth: isoDate },
            });

            if (error) {
                setDobLoading(false);
                setDobError('Erro ao vincular conta. Tente novamente.');
                return;
            }

            const response = data as { success?: boolean; error?: string } | null;
            if (response?.success !== true) {
                setDobLoading(false);
                const edgeError = response?.error;
                if (edgeError === 'ALREADY_LINKED') {
                    setDobError('Este convite já foi utilizado.');
                } else if (edgeError === 'INVALID_CODE' || edgeError === 'EXPIRED_CODE') {
                    setDobError('Código inválido ou expirado. Peça um novo ao responsável.');
                } else if (edgeError === 'FAMILY_FULL') {
                    setDobError('Esta família atingiu o limite de filhos. Fale com o responsável.');
                } else {
                    Sentry.captureMessage('vincular-filho returned malformed failure response', {
                        level: 'warning',
                        tags: { area: 'join-child', step: 'link-child' },
                        extra: { hasData: Boolean(data), edgeError: edgeError ?? null },
                    });
                    setDobError('Erro ao vincular conta. Tente novamente.');
                }
                return;
            }

            const { error: refreshError } = await refreshAuthSession();
            if (refreshError) {
                setDobLoading(false);
                setDobError(refreshError);
                return;
            }
        } catch (error) {
            Sentry.captureException(error, {
                tags: { area: 'join-child', step: 'link-child' },
            });
            setDobLoading(false);
            setDobError('Erro ao vincular conta. Tente novamente.');
        }
    };

    const stepIndex = step === 'google' ? 0 : 1;
    const googleDisabled = googleLoading || inviteLoading || !preview || code.length !== CHILD_INVITE_CODE_LENGTH;

    const previewHero = useMemo<React.ReactNode>(() => {
        if (!preview) return null;
        return (
            <View style={styles.previewHero}>
                <View style={[styles.previewHeroIconBox, { backgroundColor: colors.semantic.successBg }]}>
                    <Users size={32} color={colors.semantic.success} strokeWidth={2} />
                </View>
                <Text style={[styles.previewHeroName, { color: colors.text.primary }]}>
                    {preview.familyName}
                </Text>
                <Text style={[styles.previewHeroRole, { color: colors.text.secondary }]} numberOfLines={1}>
                    Você será:{' '}
                    <Text style={{ fontFamily: typography.family.bold, color: colors.text.primary }}>
                        {preview.nome_filho}
                    </Text>
                </Text>
            </View>
        );
    }, [preview, colors]);

    return (
        <SafeScreenFrame topInset bottomInset>
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: colors.bg.surface,
                        borderBottomColor: colors.border.subtle,
                    },
                ]}
            >
                <HeaderIconButton
                    icon={ChevronLeft}
                    onPress={step === 'google' ? handleGoogleStepBack : () => { if (!dobLoading) setShowLeaveSheet(true); }}
                    accessibilityLabel="Voltar"
                />
                <View style={styles.headerCenter}>
                    <BrandLogo size="sm" withText />
                </View>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView
                style={{ flex: 1, backgroundColor: colors.bg.canvas }}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Step dots */}
                <View style={styles.dotsRow}>
                    {[0, 1].map((i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor:
                                        i <= stepIndex
                                            ? colors.brand.vivid
                                            : colors.bg.muted,
                                    width: i === stepIndex ? 20 : 8,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Step 1: Google */}
                {step === 'google' ? (
                    <>
                        <Text style={[styles.eyebrow, { color: colors.brand.vivid }]}>Entrar na família</Text>
                        <Text style={[styles.stepTitle, { color: colors.text.primary }]}>
                            Conecte sua conta Google
                        </Text>

                        {previewHero}

                        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                            Use sua conta Google para criar seu acesso a esta família.
                        </Text>

                        <View style={styles.googleWrapper}>
                            <GoogleSignInButton
                                onPress={handleGoogleSignIn}
                                loading={googleLoading}
                                disabled={googleDisabled}
                                variant="hero"
                                subtitle={preview ? `Vinculado à ${preview.familyName}` : undefined}
                            />
                        </View>

                        {inviteLoading ? (
                            <Text style={[styles.loadingText, { color: colors.text.muted }]}>
                                Verificando convite…
                            </Text>
                        ) : null}

                        {inviteError ? (
                            <View style={styles.errorWrapper}>
                                <InlineMessage message={inviteError} variant="error" />
                            </View>
                        ) : null}

                        {googleError ? (
                            <View style={styles.errorWrapper}>
                                <InlineMessage message={googleError} variant="error" />
                            </View>
                        ) : null}
                    </>
                ) : null}

                {/* Step 2: DOB */}
                {step === 'dob' ? (
                    <>
                        <Text style={[styles.eyebrow, { color: colors.brand.vivid }]}>Finalizar cadastro</Text>
                        <Text style={[styles.stepTitle, { color: colors.text.primary }]}>
                            Qual é sua data de nascimento?
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                            Seus dados são protegidos pela LGPD. Usamos sua data apenas para verificar sua idade e personalizar sua experiência.
                        </Text>

                        <DateOfBirthField
                            value={dateOfBirth}
                            onChange={(date) => {
                                setDateOfBirth(date);
                                setDobError(null);
                            }}
                            hint="Mínimo 8 anos de idade."
                            error={dobError}
                            disabled={dobLoading}
                        />

                        <View style={styles.dobActions}>
                            <Button
                                label="Entrar na família"
                                loadingLabel="Vinculando…"
                                loading={dobLoading}
                                disabled={!dateOfBirth}
                                onPress={handleDobSubmit}
                                size="lg"
                                accessibilityLabel={dobLoading ? 'Vinculando…' : 'Entrar na família'}
                                accessibilityState={{ busy: dobLoading }}
                            />
                        </View>
                    </>
                ) : null}
            </ScrollView>

            <ConfirmSheet
                visible={showLeaveSheet}
                onClose={() => setShowLeaveSheet(false)}
                icon={LogOut}
                iconVariant="warning"
                title="Sair desta etapa?"
                description="Sua conta Google será desconectada. Você pode entrar novamente quando quiser."
                confirmLabel="Sair e desconectar"
                confirmVariant="danger"
                cancelLabel="Continuar"
                onConfirm={handleCancelAndSignOutConfirm}
            />
        </SafeScreenFrame>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing['4'],
        paddingVertical: spacing['3'],
        borderBottomWidth: 1,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerPlaceholder: {
        width: 40,
        height: 40,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing['4'],
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['1.5'],
        marginBottom: spacing['8'],
    },
    dot: {
        height: 8,
        borderRadius: radii.full,
    },
    eyebrow: {
        fontFamily: typography.family.extrabold,
        fontSize: typography.size.xxs,
        lineHeight: typography.lineHeight.xxs,
        textTransform: 'uppercase',
        letterSpacing: 0,
        marginBottom: spacing['2'],
    },
    stepTitle: {
        fontFamily: typography.family.black,
        fontSize: typography.size.xl,
        lineHeight: typography.lineHeight.xl,
        marginBottom: spacing['2'],
    },
    subtitle: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.sm,
        lineHeight: typography.lineHeight.sm,
        marginBottom: spacing['6'],
    },
    dobActions: {
        gap: spacing['3'],
    },
    previewHero: {
        alignItems: 'center',
        marginBottom: spacing['6'],
        gap: spacing['2'],
    },
    previewHeroIconBox: {
        width: 72,
        height: 72,
        borderRadius: radii.xl,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing['2'],
    },
    previewHeroName: {
        fontFamily: typography.family.black,
        fontSize: typography.size.xl,
        lineHeight: typography.lineHeight.xl,
        textAlign: 'center',
    },
    previewHeroRole: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.sm,
        lineHeight: typography.lineHeight.sm,
        textAlign: 'center',
    },
    googleWrapper: {
        marginBottom: spacing['4'],
    },
    loadingText: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.xs,
        lineHeight: typography.lineHeight.xs,
        marginBottom: spacing['2'],
    },
    errorWrapper: {
        marginTop: spacing['3'],
    },
});
