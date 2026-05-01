import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, Users } from 'lucide-react-native';
import { signInWithGoogle, refreshAuthSession } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { validateChildInviteCode } from '@lib/google-auth-utils';
import { radii, spacing, typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { InlineMessage } from '@/components/ui/inline-message';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { DateOfBirthField } from '@/components/auth/date-of-birth-field';

const CODE_LENGTH = 6;

type Step = 'code' | 'google' | 'dob';

type InvitePreview = {
    id: string;
    familia_id: string;
    nome_filho: string;
    familyName: string;
    adminName: string;
};

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
    const { colors } = useTheme();

    const [step, setStep] = useState<Step>('code');

    // Code step
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [preview, setPreview] = useState<InvitePreview | null>(null);

    // Google step
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState('');

    // DOB step
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
            const { data: invite } = (await (supabase as any)
                .from('convites_filho')
                .select(
                    'id, familia_id, nome_filho, aceito_por, expira_em, familias(nome), usuarios!criado_por(nome)',
                )
                .eq('codigo', code.toUpperCase())
                .maybeSingle()) as { data: ConviteFilhoRow | null };

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

    const handleGoogleSignIn = async () => {
        setGoogleError('');
        setGoogleLoading(true);

        const { error: signInError } = await signInWithGoogle();

        if (signInError) {
            setGoogleLoading(false);
            setGoogleError(signInError);
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

        setDobError(null);
        setDobLoading(true);

        const isoDate = dateOfBirth.toISOString().split('T')[0];

        try {
            const { data, error } = await supabase.functions.invoke('vincular-filho', {
                body: { invite_code: code, date_of_birth: isoDate },
            });

            if (error) {
                setDobLoading(false);
                setDobError('Erro ao vincular conta. Tente novamente.');
                return;
            }

            if (data && !data.success) {
                setDobLoading(false);
                const edgeError = data.error as string | undefined;
                if (edgeError === 'ALREADY_LINKED') {
                    setDobError('Este convite já foi utilizado.');
                } else if (edgeError === 'INVALID_CODE' || edgeError === 'EXPIRED_CODE') {
                    setDobError('Código inválido ou expirado. Peça um novo código ao administrador.');
                } else {
                    setDobError('Erro ao vincular conta. Tente novamente.');
                }
                return;
            }

            await supabase.auth.updateUser({
                data: {
                    lgpd_consent_at: new Date().toISOString(),
                    lgpd_consent_version: '1.0',
                },
            });

            const { error: refreshError } = await refreshAuthSession();
            if (refreshError) {
                setDobLoading(false);
                setDobError(refreshError);
            }
        } catch {
            setDobLoading(false);
            setDobError('Erro ao vincular conta. Tente novamente.');
        }
    };

    const headerTitle = step === 'code' ? 'Código de família' : step === 'google' ? 'Entrar com Google' : 'Finalizar cadastro';

    const handleBack = () => {
        if (step === 'google') {
            setStep('code');
            setGoogleError('');
        } else if (step === 'code') {
            router.back();
        }
        // DOB step: no back — user is already authenticated
    };

    const previewCard = useMemo(() => {
        if (!preview) return null;
        return (
            <View style={[styles.previewCard, { backgroundColor: colors.semantic.successBg, borderColor: colors.border.subtle }]}>
                <View style={[styles.previewIconBox, { backgroundColor: colors.bg.muted }]}>
                    <Users size={20} color={colors.semantic.success} strokeWidth={2.5} />
                </View>
                <View style={styles.previewContent}>
                    <Text style={[styles.previewFamily, { color: colors.text.primary }]} numberOfLines={1}>
                        {preview.familyName}
                    </Text>
                    <Text style={[styles.previewDetail, { color: colors.text.secondary }]} numberOfLines={1}>
                        {step === 'code' ? `Administrador: ${preview.adminName}` : `Você será: ${preview.nome_filho}`}
                    </Text>
                </View>
            </View>
        );
    }, [preview, step, colors]);

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
                {step !== 'dob' ? (
                    <HeaderIconButton
                        icon={ChevronLeft}
                        onPress={handleBack}
                        accessibilityLabel="Voltar"
                    />
                ) : null}
                <Text style={[styles.headerTitle, { color: colors.text.primary }]} numberOfLines={1}>
                    {headerTitle}
                </Text>
            </View>

            <ScrollView
                style={{ flex: 1, backgroundColor: colors.bg.canvas }}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Step 1: Code */}
                {step === 'code' ? (
                    <>
                        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                            Informe o código de 6 caracteres que você recebeu do administrador da família.
                        </Text>

                        <Input
                            label="Código do convite"
                            placeholder="Ex: ABC123"
                            value={code}
                            onChangeText={handleCodeChange}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            maxLength={CODE_LENGTH}
                            editable={!isValidating}
                            accessibilityLabel="Campo de código do convite"
                        />

                        {isValidating ? (
                            <Text style={[styles.validatingText, { color: colors.text.muted }]}>
                                Verificando código…
                            </Text>
                        ) : null}

                        {previewCard}

                        <FormFooter message={codeError || null} includeSafeBottom={false}>
                            {!preview && isCodeComplete && !isValidating ? (
                                <Button
                                    label="Verificar código"
                                    onPress={handleValidateCode}
                                    size="lg"
                                    accessibilityLabel="Verificar código"
                                />
                            ) : null}

                            {preview ? (
                                <Button
                                    label="Continuar"
                                    onPress={() => setStep('google')}
                                    size="lg"
                                    accessibilityLabel="Continuar"
                                />
                            ) : null}
                        </FormFooter>
                    </>
                ) : null}

                {/* Step 2: Google */}
                {step === 'google' ? (
                    <>
                        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                            Use sua conta Google para criar seu acesso à família{' '}
                            <Text style={{ fontFamily: typography.family.bold, color: colors.text.primary }}>
                                {preview?.familyName}
                            </Text>
                            .
                        </Text>

                        {previewCard}

                        <View style={styles.googleWrapper}>
                            <GoogleSignInButton
                                onPress={handleGoogleSignIn}
                                loading={googleLoading}
                                disabled={googleLoading}
                            />
                        </View>

                        {googleError ? (
                            <View style={styles.errorWrapper}>
                                <InlineMessage message={googleError} variant="error" />
                            </View>
                        ) : null}
                    </>
                ) : null}

                {/* Step 3: DOB */}
                {step === 'dob' ? (
                    <>
                        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                            Informe sua data de nascimento para finalizar o cadastro.
                        </Text>

                        <DateOfBirthField
                            value={dateOfBirth}
                            onChange={(date) => {
                                setDateOfBirth(date);
                                setDobError(null);
                            }}
                            error={dobError}
                            disabled={dobLoading}
                        />

                        <FormFooter message={null} includeSafeBottom={false}>
                            <Button
                                label="Entrar na família"
                                loadingLabel="Vinculando…"
                                loading={dobLoading}
                                onPress={handleDobSubmit}
                                size="lg"
                                accessibilityLabel={dobLoading ? 'Vinculando…' : 'Entrar na família'}
                                accessibilityState={{ busy: dobLoading }}
                            />
                        </FormFooter>
                    </>
                ) : null}
            </ScrollView>
        </SafeScreenFrame>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['3'],
        paddingHorizontal: spacing['4'],
        paddingVertical: spacing['3'],
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: typography.size.lg,
        fontFamily: typography.family.bold,
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing['4'],
    },
    subtitle: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.sm,
        lineHeight: typography.lineHeight.sm,
        marginBottom: spacing['6'],
    },
    validatingText: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.xs,
        marginBottom: spacing['3'],
    },
    previewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['3'],
        marginBottom: spacing['5'],
        paddingHorizontal: spacing['4'],
        paddingVertical: spacing['3'],
        borderRadius: radii.lg,
        borderWidth: 1,
    },
    previewIconBox: {
        width: 40,
        height: 40,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewContent: {
        flex: 1,
    },
    previewFamily: {
        fontFamily: typography.family.bold,
        fontSize: typography.size.sm,
    },
    previewDetail: {
        marginTop: spacing['0.5'],
        fontFamily: typography.family.medium,
        fontSize: typography.size.xs,
    },
    googleWrapper: {
        marginBottom: spacing['4'],
    },
    errorWrapper: {
        marginTop: spacing['3'],
    },
});
