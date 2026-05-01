import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { ArrowRight, Check, Home, ShieldCheck, User } from 'lucide-react-native';
import {
  createFamily,
  getCurrentAuthUser,
  refreshAuthSession,
  signOut,
  updateDateOfBirth,
} from '@lib/auth';
import { supabase } from '@lib/supabase';
import { withAlpha } from '@/constants/colors';
import { radii, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { DateOfBirthStep } from '@/components/auth/date-of-birth-step';
import { StepIndicator } from '@/components/auth/step-indicator';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { validateFamilyCreation } from '@lib/onboarding-validation';

type OnboardingField = 'familyName' | 'adminName';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ googleName?: string }>();
  const router = useRouter();
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // All users arrive from Google sign-in and must complete the date-of-birth
  // step first (step 1), then proceed to family creation (step 2).
  const [step, setStep] = useState<1 | 2>(1);
  const [initialLoading, setInitialLoading] = useState(true);

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.googleName ?? '');
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<OnboardingField | null>(null);

  // Date of birth state for the DOB step.
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [dobLoading, setDobLoading] = useState(false);

  const shouldShowError = Boolean(error);
  const submitLabel = loading ? 'Criando família…' : 'Criar família';

  // Fetch email from auth for the account reassurance banner.
  // Also check if the user already completed step 1 (date of birth) in a
  // previous session — if so, skip directly to step 2 (family creation).
  useEffect(() => {
    let mounted = true;
    getCurrentAuthUser().then((user) => {
      if (mounted) {
        if (user?.email) setUserEmail(user.email);
        if (user?.dateOfBirth) setStep(2);
        setInitialLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Handles the "Continuar" press on the DateOfBirthStep.
   * Saves the date of birth and LGPD consent, then advances to the family step.
   */
  const handleDateOfBirthContinue = async () => {
    if (!dateOfBirth) {
      setDobError('Informe sua data de nascimento para continuar.');
      return;
    }

    setDobError(null);
    setDobLoading(true);

    // Save date of birth in user_metadata.
    const isoDate = dateOfBirth.toISOString().split('T')[0]; // YYYY-MM-DD
    const { error: dobSaveError } = await updateDateOfBirth(isoDate);

    if (dobSaveError) {
      setDobLoading(false);
      setDobError(dobSaveError);
      return;
    }

    // Store LGPD consent with timestamp in user_metadata.
    const { error: lgpdError } = await supabase.auth.updateUser({
      data: {
        lgpd_consent_at: new Date().toISOString(),
        lgpd_consent_version: '1.0',
      },
    });

    if (lgpdError) {
      setDobLoading(false);
      setDobError('Erro ao salvar consentimento. Tente novamente.');
      return;
    }

    setDobLoading(false);
    setStep(2);
  };

  const handleCreateFamily = async () => {
    const validationError = validateFamilyCreation({ familyName, adminName });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    const { error: createError } = await createFamily(familyName.trim(), adminName.trim());

    if (createError) {
      setLoading(false);
      setError(createError);
      return;
    }

    // createFamily only writes to DB tables — it does not emit an auth event,
    // so onAuthStateChange will not fire automatically. Force a session refresh
    // so the root layout auth state handler re-fetches the profile (with the
    // new familia_id) and navigates to the admin home.
    const { error: refreshError } = await refreshAuthSession();
    if (refreshError) {
      setLoading(false);
      setError(refreshError);
    }
  };

  const confirmAndLeave = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleLeave = () => {
    Alert.alert(
      'Sair da criação da família?',
      'Você pode entrar novamente e criar a família quando quiser.',
      [
        { text: 'Continuar criando', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: confirmAndLeave },
      ],
    );
  };

  const stepLabels: readonly string[] = ['Nascimento', 'Família'];

  const currentIndicatorStep: 1 | 2 = step;

  return (
    <AuthHeroScreen topBarCenter={<BrandLogo size="sm" withText />}>
      <StepIndicator currentStep={currentIndicatorStep} labels={stepLabels} />

      {initialLoading ? (
        <View style={styles.header}>
          <ActivityIndicator size="large" color={palette.borderFocus} />
        </View>
      ) : null}

      {/* Step 1: Date of birth collection */}
      {!initialLoading && step === 1 ? (
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

          <Pressable
            style={({ pressed }) => [styles.childLink, { opacity: pressed ? 0.65 : 1 }]}
            onPress={handleLeave}
            disabled={dobLoading}
            accessibilityRole="button"
            accessibilityLabel="Sair"
          >
            <Text style={styles.childLinkText}>Sair</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Step 2: Family creation */}
      {!initialLoading && step === 2 ? (
        <>
          <View style={styles.header}>
            <View style={styles.kickerChip} accessibilityRole="text">
              <Check size={12} color={palette.checkOnText} strokeWidth={3} />
              <Text style={styles.kickerChipText} allowFontScaling={false}>
                Dados salvos
              </Text>
            </View>

            <Text style={styles.title} allowFontScaling={false}>
              Agora, sua família
            </Text>
            <Text style={styles.subtitle}>
              Você será o administrador. Vamos configurar a base — você poderá convidar os filhos depois.
            </Text>
          </View>

          {userEmail ? (
            <View
              style={styles.banner}
              accessibilityRole="text"
              accessibilityLabel="Conta vinculada"
            >
              <View style={styles.bannerIconBox}>
                <ShieldCheck size={20} color={palette.checkOnText} strokeWidth={2.5} />
              </View>
              <View style={styles.bannerContent}>
                <Text style={styles.bannerLabel} allowFontScaling={false}>
                  Conta vinculada
                </Text>
                <Text style={styles.bannerEmail} numberOfLines={1}>
                  {userEmail}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.form}>
            <AuthDarkField
              label="Nome da família"
              focused={focusedField === 'familyName'}
              placeholder="Ex: Família Silva"
              value={familyName}
              onChangeText={(value) => {
                setFamilyName(value);
                setError('');
              }}
              onFocus={() => setFocusedField('familyName')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
              maxLength={60}
              editable={!loading}
              accessibilityLabel="Campo de nome da família"
              leftIcon={Home}
            />

            <AuthDarkField
              label="Seu nome"
              focused={focusedField === 'adminName'}
              placeholder="Como quer ser chamado"
              value={adminName}
              onChangeText={(value) => {
                setAdminName(value);
                setError('');
              }}
              onFocus={() => setFocusedField('adminName')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
              maxLength={60}
              editable={!loading}
              accessibilityLabel="Campo de nome do administrador"
              leftIcon={User}
            />

            <View style={styles.formActions}>
              <FormFooter message={shouldShowError ? error : null} includeSafeBottom={false}>
                <Button
                  label="Criar família"
                  loadingLabel="Criando família…"
                  loading={loading}
                  onPress={handleCreateFamily}
                  size="lg"
                  trailingIcon={ArrowRight}
                  accessibilityLabel={submitLabel}
                  accessibilityState={{ busy: loading }}
                />
              </FormFooter>
            </View>

            <Pressable
              style={({ pressed }) => [styles.inviteLink, { opacity: pressed ? 0.65 : 1 }]}
              onPress={() => router.push('/(auth)/join-family')}
              disabled={loading}
              accessibilityRole="link"
              accessibilityLabel="Tenho um convite"
            >
              <Text style={styles.inviteLinkText}>Tenho um convite</Text>
            </Pressable>

            <View style={styles.footerPush}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                onPress={handleLeave}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Criar família depois"
              >
                <Text style={styles.secondaryButtonText}>Criar família depois</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </AuthHeroScreen>
  );
}

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
  return StyleSheet.create({
    header: {
      marginTop: spacing['6'],
    },
    kickerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing['1.5'],
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['1'],
      borderRadius: radii.full,
      backgroundColor: withAlpha(palette.checkOn, 0.15),
      borderWidth: 1,
      borderColor: withAlpha(palette.checkOn, 0.3),
    },
    kickerChipText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: palette.checkOnText,
    },
    kickerPlain: {
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
    banner: {
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
    bannerIconBox: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: withAlpha(palette.checkOn, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerContent: {
      flex: 1,
    },
    bannerLabel: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
      color: palette.checkOnText,
    },
    bannerEmail: {
      marginTop: spacing['0.5'],
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      color: palette.textOnNavy,
    },
    form: {
      marginTop: spacing['6'],
      flex: 1,
    },
    formActions: {
      marginTop: spacing['4'],
    },
    inviteLink: {
      marginTop: spacing['4'],
      paddingVertical: spacing['2'],
      alignItems: 'center',
    },
    inviteLinkText: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
      color: palette.borderFocus,
      textDecorationLine: 'underline',
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
    childLink: {
      marginTop: spacing['5'],
      paddingVertical: spacing['3'],
      alignItems: 'center',
    },
    childLinkText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      color: palette.textOnNavyMuted,
    },
  });
}
