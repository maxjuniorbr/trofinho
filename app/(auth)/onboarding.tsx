import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import {
  createFamily,
  getCurrentAuthUser,
  refreshAuthSession,
  signOut,
  updateDateOfBirth,
} from '@lib/auth';
import { supabase } from '@lib/supabase';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { DateOfBirthField } from '@/components/auth/date-of-birth-field';
import { validateFamilyCreation } from '@lib/onboarding-validation';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ googleName?: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.googleName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [dobError, setDobError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shouldShowError = Boolean(error);
  const submitLabel = loading ? 'Criando família…' : 'Criar família';

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

  const handleSubmit = async () => {
    // Validate date of birth
    if (!dateOfBirth) {
      setDobError('Informe sua data de nascimento.');
      return;
    }
    setDobError(null);

    // Validate family fields
    const validationError = validateFamilyCreation({ familyName, adminName });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    // 1. Save date of birth
    const isoDate = dateOfBirth.toISOString().split('T')[0];
    const { error: dobSaveError } = await updateDateOfBirth(isoDate);
    if (dobSaveError) {
      setLoading(false);
      setDobError(dobSaveError);
      return;
    }

    // 2. Save LGPD consent
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

  const confirmAndLeave = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleBack = () => {
    Alert.alert(
      'Voltar para o início?',
      'Sua conta será desconectada. Você pode entrar novamente quando quiser.',
      [
        { text: 'Ficar', style: 'cancel' },
        { text: 'Voltar', style: 'destructive', onPress: confirmAndLeave },
      ],
    );
  };

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
          onPress={handleBack}
          accessibilityLabel="Voltar para login"
        />
        <Text style={[styles.headerTitle, { color: colors.text.primary }]} numberOfLines={1}>
          Criar conta
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg.canvas }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Preencha os dados abaixo para criar sua família no Trofinho.
        </Text>

        <DateOfBirthField
          value={dateOfBirth}
          onChange={(date) => {
            setDateOfBirth(date);
            setDobError(null);
          }}
          error={dobError}
          disabled={loading}
        />

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
            onPress={handleSubmit}
            size="lg"
            trailingIcon={ArrowRight}
            accessibilityLabel={submitLabel}
            accessibilityState={{ busy: loading }}
          />
        </FormFooter>
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
});
