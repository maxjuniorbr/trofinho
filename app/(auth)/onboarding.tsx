import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { Home, User } from 'lucide-react-native';
import { createFamily, signOut } from '@lib/auth';
import { heroPalette, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { StepIndicator } from '@/components/auth/step-indicator';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';

type OnboardingField = 'familyName' | 'adminName';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const styles = useMemo(() => makeStyles(), []);

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.name ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<OnboardingField | null>(null);
  const shouldShowError = Boolean(error);
  const submitLabel = loading ? 'Criando família…' : 'Criar família';

  // When arriving from register, params.name is always set (required field).
  // Absence means the nav guard redirected an orphan user after login.
  const isFromRegister = Boolean(params.name);

  const validate = (): string | null => {
    if (!familyName.trim()) return 'Informe o nome da família.';
    if (!adminName.trim()) return 'Informe seu nome.';
    return null;
  };

  const handleCreateFamily = async () => {
    const validationError = validate();
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
    }

    // Navigation is handled by the root layout auth state handler.
    // Keep the button in loading state until the redirect happens.
  };

  const confirmAndLeave = async () => {
    await signOut();
    // Navigation is handled by the root layout auth state handler.
  };

  const handleBack = () => {
    const title = isFromRegister
      ? 'Sair do cadastro?'
      : 'Sair da criação da família?';
    const message = isFromRegister
      ? 'Sua conta já foi criada. Você poderá fazer login e criar a família depois.'
      : 'Você pode criar sua família na próxima vez que entrar.';

    Alert.alert(title, message, [
      { text: 'Continuar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: confirmAndLeave },
    ]);
  };

  return (
    <AuthHeroScreen
      topBarCenter={<BrandLogo size="sm" variant="onDark" withText />}
      onBack={handleBack}
      backAccessibilityLabel="Voltar"
    >
      {isFromRegister ? <StepIndicator currentStep={2} labels={['Conta', 'Família']} /> : null}

      <View style={styles.header}>
        <Text style={styles.kicker} allowFontScaling={false}>
          {isFromRegister ? 'Conta criada ✓' : 'Configurar família'}
        </Text>
        <Text style={styles.title} allowFontScaling={false}>
          Criar sua família
        </Text>
        <Text style={styles.subtitle}>
          {isFromRegister
            ? 'Agora configure sua família para começar a usar o app.'
            : 'Você será o administrador e poderá convidar os filhos depois.'}
        </Text>
      </View>

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
              accessibilityLabel={submitLabel}
              accessibilityState={{ busy: loading }}
            />
          </FormFooter>
        </View>
      </View>
    </AuthHeroScreen>
  );
}

function makeStyles() {
  return StyleSheet.create({
    header: {
      marginTop: spacing['6'],
    },
    kicker: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: 'rgba(250, 193, 20, 0.90)',
    },
    title: {
      marginTop: spacing['2'],
      fontFamily: typography.family.black,
      fontSize: typography.size['3xl'],
      lineHeight: typography.lineHeight['3xl'],
      color: heroPalette.textOnNavy,
      letterSpacing: -0.4,
    },
    subtitle: {
      marginTop: spacing['2'],
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
      color: heroPalette.textOnNavyMuted,
    },
    form: {
      marginTop: spacing['6'],
      flex: 1,
    },
    formActions: {
      marginTop: spacing['4'],
    },
  });
}
