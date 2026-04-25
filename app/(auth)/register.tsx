import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { ArrowRight, Lock, Mail, User } from 'lucide-react-native';
import { signUp } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField, DarkPasswordToggle } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { StepIndicator } from '@/components/auth/step-indicator';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';

type RegisterField = 'name' | 'email' | 'password';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterScreen() {
  const router = useRouter();
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<RegisterField | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const shouldShowError = Boolean(error);

  const validate = (): string | null => {
    const emailValue = email.trim();
    if (!name.trim()) return 'Informe seu nome.';
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!password) return 'Crie uma senha.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    return null;
  };

  const handleSignUp = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    const { error: signUpError } = await signUp(email.trim(), password);

    if (signUpError) {
      setLoading(false);
      setError(signUpError);
      return;
    }

    // Pass the name to onboarding for pre-filling. The auth state handler
    // would also redirect to onboarding, but without the name param, so we
    // navigate explicitly here. Keep loading state until the redirect lands.
    router.replace({ pathname: '/(auth)/onboarding', params: { name: name.trim(), email: email.trim() } });
  };

  return (
    <AuthHeroScreen
      topBarCenter={<BrandLogo size="sm" withText />}
    >
      <StepIndicator currentStep={1} labels={['Conta', 'Família']} />

      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling={false}>
          Crie sua conta
        </Text>
        <Text style={styles.subtitle}>Em menos de um minuto, sem complicação.</Text>
      </View>

      <View style={styles.form}>
        <AuthDarkField
          label="Nome"
          focused={focusedField === 'name'}
          placeholder="Seu nome"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError('');
          }}
          onFocus={() => setFocusedField('name')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={60}
          editable={!loading}
          accessibilityLabel="Campo de nome"
          leftIcon={User}
        />

        <AuthDarkField
          label="E-mail"
          focused={focusedField === 'email'}
          placeholder="seu@email.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError('');
          }}
          onFocus={() => setFocusedField('email')}
          onBlur={() => setFocusedField(null)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={MAX_EMAIL_LENGTH}
          editable={!loading}
          accessibilityLabel="Campo de e-mail"
          leftIcon={Mail}
        />

        <AuthDarkField
          label="Senha"
          focused={focusedField === 'password'}
          placeholder="Crie uma senha"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError('');
          }}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField(null)}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={128}
          editable={!loading}
          accessibilityLabel="Campo de senha"
          leftIcon={Lock}
          rightAction={
            <DarkPasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
            />
          }
        />

        {password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
          <Text style={styles.passwordHint}>
            Mínimo {MIN_PASSWORD_LENGTH} caracteres
          </Text>
        ) : null}

        <View style={styles.formActions}>
          <FormFooter message={shouldShowError ? error : null} includeSafeBottom={false}>
            <Button
              label="Continuar"
              loadingLabel="Criando conta…"
              loading={loading}
              onPress={handleSignUp}
              size="lg"
              trailingIcon={ArrowRight}
              accessibilityLabel={loading ? 'Criando conta' : 'Continuar'}
              accessibilityState={{ busy: loading }}
            />

            <Text style={styles.terms}>
              Ao continuar, você concorda com os <Text style={styles.termsAccent}>Termos</Text> e a{' '}
              <Text style={styles.termsAccent}>Política de Privacidade</Text>.
            </Text>
          </FormFooter>
        </View>

        <View style={styles.footerPush}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
            onPress={() => router.back()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
          >
            <Text style={styles.secondaryButtonText}>
              Já tem conta? <Text style={styles.secondaryButtonAccent}>Entrar</Text>
            </Text>
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
    title: {
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
    formActions: {
      marginTop: spacing['4'],
    },
    passwordHint: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xs,
      color: palette.textOnNavySubtle,
      marginTop: spacing['2'],
    },
    terms: {
      marginTop: spacing['1'],
      fontFamily: typography.family.medium,
      fontSize: typography.size.xxs,
      lineHeight: typography.lineHeight.xs,
      textAlign: 'center',
      color: palette.textOnNavySubtle,
      paddingHorizontal: spacing['2'],
    },
    termsAccent: {
      fontFamily: typography.family.semibold,
      color: palette.textOnNavyMuted,
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
    secondaryButtonAccent: {
      fontFamily: typography.family.bold,
      color: palette.borderFocus,
    },
  });
}
