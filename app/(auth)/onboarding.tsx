import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Home, LogOut, User, Users } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import {
  createFamily,
  getCurrentAuthUser,
  refreshAuthSession,
  signOut,
  updateDateOfBirth,
} from '@lib/auth';
import { formatLocalIsoDate } from '@lib/google-auth-utils';
import { validateFamilyCreation } from '@lib/onboarding-validation';
import { supabase } from '@lib/supabase';
import { radii, spacing, typography } from '@/constants/theme';
import { AuthSeparator } from '@/components/auth/auth-separator';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { BrandLogo } from '@/components/auth/brand-logo';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { DateOfBirthField } from '@/components/auth/date-of-birth-field';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';

type Step = 'dob' | 'family';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ googleName?: string }>();
  const router = useRouter();

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.googleName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [step, setStep] = useState<Step>('dob');
  const [error, setError] = useState('');
  const [dobError, setDobError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLeaveSheet, setShowLeaveSheet] = useState(false);

  type OnboardingField = 'familyName' | 'adminName';
  const [focusedField, setFocusedField] = useState<OnboardingField | null>(null);
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // When googleName param is missing (e.g. orphan user resuming session),
  // fetch the name from user_metadata so the field is pre-filled.
  useEffect(() => {
    if (adminName) return;
    let mounted = true;
    getCurrentAuthUser().then((user) => {
      if (mounted && user?.fullName) {
        setAdminName(user.fullName);
      }
    });
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  const confirmAndLeave = useCallback(async () => {
    setShowLeaveSheet(false);
    await signOut();
    router.replace('/(auth)/login');
  }, [router]);

  const handleBack = useCallback(() => {
    if (step === 'family') {
      setStep('dob');
      return;
    }
    setShowLeaveSheet(true);
  }, [step]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const handleDobContinue = () => {
    if (!dateOfBirth) {
      setDobError('Informe sua data de nascimento.');
      return;
    }
    setDobError(null);
    setStep('family');
  };

  const handleSubmit = async () => {
    // dateOfBirth is guaranteed non-null after step 1 validated it
    if (!dateOfBirth) return;

    const validationError = validateFamilyCreation({ familyName, adminName });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    // 1. Save date of birth
    const isoDate = formatLocalIsoDate(dateOfBirth);
    const { error: dobSaveError } = await updateDateOfBirth(isoDate, 18);
    if (dobSaveError) {
      setLoading(false);
      setDobError(dobSaveError);
      setStep('dob');
      return;
    }

    // 2. Save LGPD consent
    try {
      const { error: lgpdError } = await supabase.auth.updateUser({
        data: {
          lgpd_consent_at: new Date().toISOString(),
          lgpd_consent_version: '1.0',
        },
      });
      if (lgpdError) {
        setLoading(false);
        setError('Erro ao salvar consentimento. Tente novamente.');
        return;
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { area: 'onboarding', step: 'lgpd-consent' },
      });
      setLoading(false);
      setError('Erro ao salvar consentimento. Tente novamente.');
      return;
    }

    // 3. Create family
    const { error: createError } = await createFamily(familyName.trim(), adminName.trim());
    if (createError) {
      setLoading(false);
      setError(createError);
      return;
    }

    // 4. Refresh session so nav guard redirects to admin home
    const { error: refreshError } = await refreshAuthSession();
    if (refreshError) {
      setLoading(false);
      setError(refreshError);
    }
  };

  const stepIndex = step === 'dob' ? 0 : 1;

  return (
    <>
      <AuthHeroScreen
        topBarCenter={<BrandLogo size="sm" withText />}
        onBack={handleBack}
        backAccessibilityLabel="Voltar"
      >
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= stepIndex ? palette.borderFocus : palette.textOnNavyFaint,
                  width: i === stepIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Step 1: DOB */}
        {step === 'dob' ? (
          <>
            <Text style={[styles.eyebrow, { color: palette.labelGold }]}>Criar conta</Text>
            <Text style={[styles.stepTitle, { color: palette.textOnNavy }]}>
              Qual é sua data de nascimento?
            </Text>
            <Text style={[styles.stepSubtitle, { color: palette.textOnNavySubtle }]}>
              Usamos essa informação para personalizar sua experiência e garantir sua segurança, conforme a LGPD.
            </Text>

            <DateOfBirthField
              value={dateOfBirth}
              onChange={(date) => {
                setDateOfBirth(date);
                setDobError(null);
              }}
              minAge={18}
              hint="Mínimo 18 anos de idade."
              error={dobError}
              disabled={loading}
              variant="hero"
            />

            <View style={styles.actions}>
              <Button
                label="Continuar"
                onPress={handleDobContinue}
                disabled={!dateOfBirth}
                size="lg"
                accessibilityLabel="Continuar"
                accessibilityState={{ disabled: !dateOfBirth }}
              />
              <AuthSeparator />
              <Pressable
                onPress={() => {
                  setDateOfBirth(null);
                  router.push('/(auth)/join-family');
                }}
                style={({ pressed }) => [
                  styles.inviteCard,
                  {
                    backgroundColor: palette.surfaceField,
                    borderColor: palette.borderSoft,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Já tenho um convite"
              >
                <View style={[styles.inviteIconBox, { backgroundColor: palette.glowGold }]}>
                  <Users size={18} color={palette.borderFocus} strokeWidth={2} />
                </View>
                <View style={styles.inviteTextBlock}>
                  <Text style={[styles.inviteTitle, { color: palette.textOnNavy }]}>
                    Já tenho um convite
                  </Text>
                  <Text style={[styles.inviteSubtitle, { color: palette.textOnNavyFaint }]}>
                    Ingressar em uma família existente
                  </Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Step 2: Family setup */}
        {step === 'family' ? (
          <>
            <Text style={[styles.eyebrow, { color: palette.labelGold }]}>Criar conta</Text>
            <Text style={[styles.stepTitle, { color: palette.textOnNavy }]}>
              Crie sua família
            </Text>
            <Text style={[styles.stepSubtitle, { color: palette.textOnNavySubtle }]}>
              Escolha um nome para sua família e como você quer ser chamado.
            </Text>

            <View style={styles.fields}>
              <AuthDarkField
                label="Nome da família"
                focused={focusedField === 'familyName'}
                leftIcon={Home}
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
              />
              <AuthDarkField
                label="Seu nome"
                focused={focusedField === 'adminName'}
                leftIcon={User}
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
              />
            </View>

            {error ? <InlineMessage message={error} variant="error" /> : null}

            <View style={styles.actions}>
              <Button
                label="Criar família"
                loadingLabel="Criando família…"
                loading={loading}
                onPress={handleSubmit}
                disabled={loading}
                size="lg"
                accessibilityLabel={loading ? 'Criando família…' : 'Criar família'}
                accessibilityState={{ busy: loading }}
              />
            </View>
          </>
        ) : null}
      </AuthHeroScreen>
      <ConfirmSheet
        visible={showLeaveSheet}
        onClose={() => setShowLeaveSheet(false)}
        icon={LogOut}
        iconVariant="warning"
        title="Cancelar criação?"
        description="Sua conta será desconectada. Você pode entrar novamente quando quiser."
        confirmLabel="Cancelar e sair"
        confirmVariant="danger"
        cancelLabel="Continuar"
        onConfirm={confirmAndLeave}
      />
    </>
  );
}

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
  return StyleSheet.create({
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['1.5'],
      marginBottom: spacing['5'],
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
      fontSize: typography.size.displaySm,
      lineHeight: typography.lineHeight.displaySm,
      marginBottom: spacing['2'],
    },
    stepSubtitle: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
      marginBottom: spacing['4'],
    },
    fields: {
      gap: spacing['4'],
    },
    actions: {
      marginTop: spacing['4'],
      gap: spacing['4'],
    },
    inviteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      borderRadius: radii.outer,
      borderWidth: 1,
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['4'],
    },
    inviteIconBox: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteTextBlock: {
      flex: 1,
      gap: 2,
    },
    inviteTitle: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    inviteSubtitle: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.xs,
    },
  });
}
