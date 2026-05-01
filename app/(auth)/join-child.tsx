import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { ArrowRight, Hash, Users } from 'lucide-react-native';
import { signInWithGoogle, refreshAuthSession } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { validateChildInviteCode } from '@lib/google-auth-utils';
import { withAlpha, staticTextColors } from '@/constants/colors';
import { radii, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { DateOfBirthStep } from '@/components/auth/date-of-birth-step';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { FormFooter } from '@/components/ui/form-footer';
import { InlineMessage } from '@/components/ui/inline-message';

const CODE_LENGTH = 6;

type Step = 'code' | 'google' | 'dob';

type InvitePreview = {
    id: string;
    familia_id: string;
    nome_filho: string;
    familyName: string;
    adminName: string;
};

/** Shape returned by the Supabase query for `convites_filho` with joins. */
type ConviteFilhoRow = {
    id: string;
    familia_id: string;
    nome_filho: string;
    aceito_por: string | null;
    expira_em: string;
    familias: { nome: string } | null;
    usuarios: { nome: string } | null;
};

export default function JoinChildScreen() {
    const router = useRouter();
    const { palette } = useHeroPalette();
    const styles = useMemo(() => makeStyles(palette), [palette]);

    // --- Step state ---
    const [step, setStep] = useState<Step>('code');

    // --- Code step state ---
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [preview, setPreview] = useState<InvitePreview | null>(null);

    // --- Google step state ---
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState('');

    // --- DOB step state ---
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [dobError, setDobError] = useState<string | null>(null);
    const [dobLoading, setDobLoading] = useState(false);

    const isCodeComplete = code.length === CODE_LENGTH;

    const handleCodeChange = (value: string) => {
        const formatted = value
            .toUpperCase()
            .replaceAll(/[^A-Z0-9]/g, '')
            .slice(0, CODE_LENGTH);
        setCode(formatted);
        setCodeError('');
        setPreview(null);
    };

    const handleValidateCode = useCallback(async () => {
        if (!isCodeComplete) return;

        setCodeError('');
        setIsValidating(true);

        try {
            // The `convites_filho` table may not be in the generated DB types yet,
            // so we cast through `any` to query it via the Supabase client.

            const { data: invite } = (await (supabase as any)
                .from('convites_filho')
                .select(
                    'id, familia_id, nome_filho, aceito_por, expira_em, familias(nome), usuarios!criado_por(nome)',
                )
                .eq('codigo', code.toUpperCase())
                .maybeSingle()) as { data: ConviteFilhoRow | null };

            // Build the InviteRecord shape for the pure validation function.
            const inviteRecord = invite
                ? { aceito_por: invite.aceito_por, expira_em: invite.expira_em }
                : null;

            const result = validateChildInviteCode(code, inviteRecord, new Date());

            if (!result.valid) {
                setCodeError(
                    result.error === 'ALREADY_LINKED'
                        ? 'Este convite já foi utilizado.'
                        : 'Código inválido ou expirado. Peça um novo código ao administrador.',
                );
                setIsValidating(false);
                return;
            }

            setPreview({
                id: invite!.id,
                familia_id: invite!.familia_id,
                nome_filho: invite!.nome_filho,
                familyName: invite!.familias?.nome ?? 'Família',
                adminName: invite!.usuarios?.nome ?? 'Administrador',
            });
        } catch {
            setCodeError('Erro ao verificar código. Tente novamente.');
        } finally {
            setIsValidating(false);
        }
    }, [code, isCodeComplete]);

    const handleConfirmCode = () => {
        if (!preview) return;
        setStep('google');
    };

    const handleGoogleSignIn = async () => {
        setGoogleError('');
        setGoogleLoading(true);

        const { error: signInError } = await signInWithGoogle();

        if (signInError) {
            setGoogleLoading(false);
            setGoogleError(signInError);
            return;
        }

        // signInWithGoogle returned no error — advance to DOB step.
        setGoogleLoading(false);
        setStep('dob');
    };

    const handleDateOfBirthContinue = async () => {
        if (!dateOfBirth) {
            setDobError('Informe sua data de nascimento para continuar.');
            return;
        }

        setDobError(null);
        setDobLoading(true);

        const isoDate = dateOfBirth.toISOString().split('T')[0]; // YYYY-MM-DD

        try {
            const { data, error } = await supabase.functions.invoke('vincular-filho', {
                body: { invite_code: code, date_of_birth: isoDate },
            });

            if (error) {
                setDobLoading(false);
                setDobError('Erro ao vincular conta. Tente novamente.');
                return;
            }

            // Handle edge function error responses (success: false).
            if (data && !data.success) {
                setDobLoading(false);
                const edgeError = data.error as string | undefined;
                if (edgeError === 'ALREADY_LINKED') {
                    setDobError('Este convite já foi utilizado.');
                } else if (edgeError === 'INVALID_CODE' || edgeError === 'EXPIRED_CODE') {
                    setDobError(
                        'Código inválido ou expirado. Peça um novo código ao administrador.',
                    );
                } else {
                    setDobError('Erro ao vincular conta. Tente novamente.');
                }
                return;
            }

            // Store LGPD consent with timestamp in user_metadata.
            await supabase.auth.updateUser({
                data: {
                    lgpd_consent_at: new Date().toISOString(),
                    lgpd_consent_version: '1.0',
                },
            });

            // Refresh session so the root layout detects the new familia_id.
            const { error: refreshError } = await refreshAuthSession();
            if (refreshError) {
                setDobLoading(false);
                setDobError(refreshError);
                return;
            }

            // Navigation is handled by the root layout auth state handler after
            // session refresh detects the new familia_id → redirects to (child)/.
        } catch {
            setDobLoading(false);
            setDobError('Erro ao vincular conta. Tente novamente.');
        }
    };

    // --- Step indicator ---
    const stepLabels: readonly string[] = ['Código', 'Google', 'Nascimento'];
    const stepIndex = step === 'code' ? 0 : step === 'google' ? 1 : 2;

    const handleBack = () => {
        if (step === 'google') {
            setStep('code');
            setGoogleError('');
        } else if (step !== 'dob') {
            // Don't allow going back from DOB — the user is already authenticated.
            router.back();
        }
    };

    return (
        <AuthHeroScreen
            topBarCenter={<BrandLogo size="sm" withText />}
            onBack={handleBack}
            backAccessibilityLabel="Voltar"
        >
            {/* Step indicator bars */}
            <StepBars
                labels={stepLabels}
                activeIndex={stepIndex}
                palette={palette}
            />

            {/* Step 1: Enter invite code */}
            {step === 'code' ? (
                <CodeStep
                    code={code}
                    onCodeChange={handleCodeChange}
                    isValidating={isValidating}
                    codeError={codeError}
                    isCodeComplete={isCodeComplete}
                    preview={preview}
                    onValidate={handleValidateCode}
                    onConfirm={handleConfirmCode}
                    onBack={() => router.back()}
                    palette={palette}
                    styles={styles}
                />
            ) : null}

            {/* Step 2: Google Sign-In */}
            {step === 'google' ? (
                <GoogleStep
                    preview={preview}
                    googleLoading={googleLoading}
                    googleError={googleError}
                    onGoogleSignIn={handleGoogleSignIn}
                    onBack={() => {
                        setStep('code');
                        setGoogleError('');
                    }}
                    palette={palette}
                    styles={styles}
                />
            ) : null}

            {/* Step 3: Date of birth */}
            {step === 'dob' ? (
                <View style={styles.header}>
                    <DateOfBirthStep
                        value={dateOfBirth}
                        onChange={(date) => {
                            setDateOfBirth(date);
                            setDobError(null);
                        }}
                        onContinue={handleDateOfBirthContinue}
                        error={dobError}
                        loading={dobLoading}
                    />
                </View>
            ) : null}
        </AuthHeroScreen>
    );
}

// ---------------------------------------------------------------------------
// Sub-components (extracted to reduce cognitive complexity)
// ---------------------------------------------------------------------------

type StepBarsProps = Readonly<{
    labels: readonly string[];
    activeIndex: number;
    palette: ReturnType<typeof useHeroPalette>['palette'];
}>;

function StepBars({ labels, activeIndex, palette }: StepBarsProps) {
    return (
        <View style={stepBarStyles.container}>
            <View style={stepBarStyles.bars}>
                {labels.map((label, i) => {
                    let bg: string;
                    if (i < activeIndex) bg = withAlpha(palette.borderFocus, 0.4);
                    else if (i === activeIndex) bg = palette.borderFocus;
                    else bg = withAlpha(palette.textOnNavy, 0.15);

                    return (
                        <View key={label} style={[stepBarStyles.bar, { backgroundColor: bg }]} />
                    );
                })}
            </View>
            <View style={stepBarStyles.labelsRow}>
                {labels.map((label, i) => {
                    let color: string;
                    if (i < activeIndex) color = withAlpha(palette.borderFocus, 0.55);
                    else if (i === activeIndex) color = palette.borderFocus;
                    else color = withAlpha(palette.textOnNavy, 0.35);

                    return (
                        <Text
                            key={label}
                            style={[stepBarStyles.label, { color }]}
                            allowFontScaling={false}
                        >
                            {label}
                        </Text>
                    );
                })}
            </View>
        </View>
    );
}

const stepBarStyles = StyleSheet.create({
    container: {
        marginTop: spacing['6'],
    },
    bars: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['2'],
    },
    bar: {
        flex: 1,
        height: 4,
        borderRadius: radii.full,
    },
    labelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing['1.5'],
    },
    label: {
        fontFamily: typography.family.bold,
        fontSize: typography.size.xxs,
        letterSpacing: 1.2,
    },
});

// ---------------------------------------------------------------------------

type CodeStepProps = Readonly<{
    code: string;
    onCodeChange: (value: string) => void;
    isValidating: boolean;
    codeError: string;
    isCodeComplete: boolean;
    preview: InvitePreview | null;
    onValidate: () => void;
    onConfirm: () => void;
    onBack: () => void;
    palette: ReturnType<typeof useHeroPalette>['palette'];
    styles: ReturnType<typeof makeStyles>;
}>;

function CodeStep({
    code,
    onCodeChange,
    isValidating,
    codeError,
    isCodeComplete,
    preview,
    onValidate,
    onConfirm,
    onBack,
    palette,
    styles,
}: CodeStepProps) {
    return (
        <>
            <View style={styles.header}>
                <Text style={styles.kicker} allowFontScaling={false}>
                    Convite
                </Text>
                <Text style={styles.title} allowFontScaling={false}>
                    Entrar na família
                </Text>
                <Text style={styles.subtitle}>
                    Informe o código de 6 caracteres que você recebeu do administrador da
                    família.
                </Text>
            </View>

            <View style={styles.form}>
                <AuthDarkField
                    label="Código do convite"
                    focused={false}
                    placeholder="Ex: ABC123"
                    value={code}
                    onChangeText={onCodeChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={CODE_LENGTH}
                    editable={!isValidating}
                    accessibilityLabel="Campo de código do convite"
                    leftIcon={Hash}
                />

                {isValidating ? (
                    <Text style={styles.validatingText}>Verificando código…</Text>
                ) : null}

                {preview ? (
                    <PreviewCard preview={preview} palette={palette} styles={styles} />
                ) : null}

                <View style={styles.formActions}>
                    <FormFooter message={codeError || null} includeSafeBottom={false}>
                        {!preview && isCodeComplete && !isValidating ? (
                            <Pressable
                                onPress={onValidate}
                                accessibilityRole="button"
                                accessibilityLabel="Verificar código"
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    {
                                        backgroundColor: palette.borderFocus,
                                        opacity: pressed ? 0.8 : 1,
                                    },
                                ]}
                            >
                                <Text style={styles.actionButtonText}>Verificar código</Text>
                            </Pressable>
                        ) : null}

                        {preview ? (
                            <Pressable
                                onPress={onConfirm}
                                accessibilityRole="button"
                                accessibilityLabel="Continuar"
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    {
                                        backgroundColor: palette.borderFocus,
                                        opacity: pressed ? 0.8 : 1,
                                    },
                                ]}
                            >
                                <Text style={styles.actionButtonText}>Continuar</Text>
                                <ArrowRight size={18} color={staticTextColors.inverse} strokeWidth={2.5} />
                            </Pressable>
                        ) : null}
                    </FormFooter>
                </View>

                <View style={styles.footerPush}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            { opacity: pressed ? 0.65 : 1 },
                        ]}
                        onPress={onBack}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                    >
                        <Text style={styles.secondaryButtonText}>Voltar</Text>
                    </Pressable>
                </View>
            </View>
        </>
    );
}

// ---------------------------------------------------------------------------

type GoogleStepProps = Readonly<{
    preview: InvitePreview | null;
    googleLoading: boolean;
    googleError: string;
    onGoogleSignIn: () => void;
    onBack: () => void;
    palette: ReturnType<typeof useHeroPalette>['palette'];
    styles: ReturnType<typeof makeStyles>;
}>;

function GoogleStep({
    preview,
    googleLoading,
    googleError,
    onGoogleSignIn,
    onBack,
    palette,
    styles,
}: GoogleStepProps) {
    return (
        <>
            <View style={styles.header}>
                <Text style={styles.kicker} allowFontScaling={false}>
                    Autenticação
                </Text>
                <Text style={styles.title} allowFontScaling={false}>
                    Entrar com Google
                </Text>
                <Text style={styles.subtitle}>
                    Use sua conta Google para criar seu acesso à família{' '}
                    <Text style={styles.subtitleBold}>{preview?.familyName}</Text>.
                </Text>
            </View>

            {preview ? (
                <View style={styles.previewCard}>
                    <View style={styles.previewIconBox}>
                        <Users size={20} color={palette.checkOnText} strokeWidth={2.5} />
                    </View>
                    <View style={styles.previewContent}>
                        <Text style={styles.previewFamilyName} numberOfLines={1}>
                            {preview.familyName}
                        </Text>
                        <Text style={styles.previewAdminName} numberOfLines={1}>
                            Você será: {preview.nome_filho}
                        </Text>
                    </View>
                </View>
            ) : null}

            <View style={styles.form}>
                <GoogleSignInButton
                    onPress={onGoogleSignIn}
                    loading={googleLoading}
                    disabled={googleLoading}
                />

                {googleError ? (
                    <View style={styles.errorContainer}>
                        <InlineMessage message={googleError} variant="error" />
                    </View>
                ) : null}

                <View style={styles.footerPush}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            { opacity: pressed ? 0.65 : 1 },
                        ]}
                        onPress={onBack}
                        disabled={googleLoading}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar para código"
                    >
                        <Text style={styles.secondaryButtonText}>Voltar</Text>
                    </Pressable>
                </View>
            </View>
        </>
    );
}

// ---------------------------------------------------------------------------

type PreviewCardProps = Readonly<{
    preview: InvitePreview;
    palette: ReturnType<typeof useHeroPalette>['palette'];
    styles: ReturnType<typeof makeStyles>;
}>;

function PreviewCard({ preview, palette, styles }: PreviewCardProps) {
    return (
        <View style={styles.previewCard}>
            <View style={styles.previewIconBox}>
                <Users size={20} color={palette.checkOnText} strokeWidth={2.5} />
            </View>
            <View style={styles.previewContent}>
                <Text style={styles.previewFamilyName} numberOfLines={1}>
                    {preview.familyName}
                </Text>
                <Text style={styles.previewAdminName} numberOfLines={1}>
                    Administrador: {preview.adminName}
                </Text>
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
        subtitleBold: {
            fontFamily: typography.family.bold,
            color: palette.textOnNavy,
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
        formActions: {
            marginTop: spacing['4'],
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            borderRadius: radii.inner,
            borderCurve: 'continuous',
            minHeight: 48,
            paddingHorizontal: spacing['6'],
            paddingVertical: spacing['3'],
        },
        actionButtonText: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.md,
            lineHeight: typography.lineHeight.md,
            color: staticTextColors.inverse,
        },
        errorContainer: {
            marginTop: spacing['3'],
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
