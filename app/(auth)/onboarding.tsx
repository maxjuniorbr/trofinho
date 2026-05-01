import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react-native';
import {
  createFamily,
  getCurrentAuthUser,
  refreshAuthSession,
  signOut,
  updateDateOfBirth,
} from '@lib/auth';
import { supabase } from '@lib/supabase';
import { radii, spacing, typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { DateOfBirthStep } from '@/components/auth/date-of-birth-step';
import { validateFamilyCreation } from '@lib/onboarding-validation';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ googleName?: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [step, setStep] = useState<1 | 2>(1);
  const [initialLoading, setInitialLoading] = useState(true);

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.googleName ?? '');
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [dobLoading, setDobLoading] = useState(false);

  const shouldShowError = Boolean(error);
  const submitLabel = loading ? 'Criando família…' : 'Criar família';

  useEffect(() => {
    let mounted = true;
    getCurrentAuthUser().then((user) => {
      if (mounted) {
        if (user?.email) setUserEmail(user.email);
        if (user?.dateOfBirth) {
          setDateOfBirth(new Date(user.dateOfBirth));
          setStep(2);
        }
        setInitialLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleDateOfBirthContinue = async () => {
    if (!dateOfBirth) {
      setDobError('Informe sua data de nascimento para continuar.');
      return;
    }

    setDobError(null);
    setDobLoading(true);

    const isoDate = dateOfBirth.toISOString().split('T')[0];
    const { error: dobSaveError } = await updateDateOfBirth(isoDate);

    if (dobSaveError) {
      setDobLoading(false);
      setDobError(dobSaveError);
      return;
    }

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
      'Voltar para o início?',
      'Sua conta será desconectada. Você pode entrar novamente quando quiser.',
      [
        { text: 'Ficar', style: 'cancel' },
        { text: 'Voltar', style: 'destructive', onPress: confirmAndLeave },
      ],
    );
  };

  const headerTitle = step === 1 ? 'Data de nascimento' : 'Criar família';
  const handleBack = step === 1 ? handleLeave : () => setStep(1);

  return (
    <SafeScreenFrame bottomInset>
      {initialLoading ? null : (
        <ScreenHeader
          title={headerTitle}
          onBack={handleBack}
          backLabel={step === 1 ? 'Login' : 'Nascimento'}
          showBorder
        />
      )}

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg.canvas }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {initialLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand.vivid} />
          </View>
        ) : null}

        {/* Step 1: Date of birth */}
        {!initialLoading && step === 1 ? (
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
        ) : null}

        {/* Step 2: Family creation */}
        {!initialLoading && step === 2 ? (
          <View style={styles.formContainer}>
            {userEmail ? (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: colors.semantic.successBg,
                    borderColor: colors.border.subtle,
                  },
                ]}
              >
                <View style={[styles.bannerIconBox, { backgroundColor: colors.bg.muted }]}>
                  <ShieldCheck size={20} color={colors.semantic.success} strokeWidth={2.5} />
                </View>
                <View style={styles.bannerContent}>
                  <Text style={[styles.bannerLabel, { color: colors.text.primary }]} allowFontScaling={false}>
                    Conta vinculada
                  </Text>
                  <Text style={[styles.bannerEmail, { color: colors.text.secondary }]} numberOfLines={1}>
                    {userEmail}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
              Você será o administrador. Vamos configurar a base — você poderá convidar os filhos depois.
            </Text>

            <Input
              label="Nome da família"
              placeholder="Ex: Família Silva"
              value={familyName}
              onChangeText={(value) => {
                setFamilyName(value);
                setError('');
              }}
              autoCapitalize="words"
              maxLength={60}
              editable={!loading}
              accessibilityLabel="Campo de nome da família"
            />

            <Input
              label="Seu nome"
              placeholder="Como quer ser chamado"
              value={adminName}
              onChangeText={(value) => {
                setAdminName(value);
                setError('');
              }}
              autoCapitalize="words"
              maxLength={60}
              editable={!loading}
              accessibilityLabel="Campo de nome do administrador"
            />

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
        ) : null}
      </ScrollView>
    </SafeScreenFrame>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: spacing['4'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
  },
  subtitle: {
    fontFamily: typography.family.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginBottom: spacing['6'],
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    marginBottom: spacing['5'],
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerContent: {
    flex: 1,
  },
  bannerLabel: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.sm,
  },
  bannerEmail: {
    marginTop: spacing['0.5'],
    fontFamily: typography.family.medium,
    fontSize: typography.size.xs,
  },
});
