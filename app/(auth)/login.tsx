import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { Mail, Lock, ArrowRight } from 'lucide-react-native';
import { signIn } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField, DarkPasswordToggle } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { InlineMessage } from '@/components/ui/inline-message';

type LoginField = 'email' | 'password';

export default function LoginScreen() {
  const router = useRouter();
  const { resetSuccess } = useLocalSearchParams<{ resetSuccess?: string }>();
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<LoginField | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const shouldShowError = Boolean(error);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setError('');
      };
    }, [])
  );

  const validate = (): string | null => {
    const emailValue = email.trim();
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!password) return 'Informe sua senha.';
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    return null;
  };

  const handleSignIn = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      setLoading(false);
      setPassword('');
      setShowPassword(false);
      setError(signInError);
    }

    // Navigation is handled by the root layout auth state handler.
    // Keep the button in loading state until the redirect happens.
  };

  return (
    <AuthHeroScreen>
      <View style={styles.header}>
        <BrandLogo size="md" />
        <Text style={styles.title} allowFontScaling={false}>
          Bem-vindo{'\n'}de volta.
        </Text>
        <Text style={styles.subtitle}>
          Entre para acompanhar suas conquistas e gerenciar tarefas.
        </Text>
      </View>

      <View style={styles.form}>
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
          placeholder="••••••••"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError('');
          }}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField(null)}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          textContentType="password"
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

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Esqueci minha senha"
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <Text style={styles.forgotText}>Esqueci minha senha</Text>
        </Pressable>

        {resetSuccess === '1' ? (
          <View style={styles.successMessage}>
            <InlineMessage
              message="Senha redefinida com sucesso. Faça login com sua nova senha."
              variant="success"
            />
          </View>
        ) : null}

        <FormFooter message={shouldShowError ? error : null} includeSafeBottom={false}>
          <Button
            label="Entrar"
            loadingLabel="Entrando…"
            loading={loading}
            onPress={handleSignIn}
            size="lg"
            trailingIcon={ArrowRight}
            accessibilityLabel={loading ? 'Entrando' : 'Entrar'}
            accessibilityState={{ busy: loading }}
          />
        </FormFooter>

        <View style={styles.footerPush}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
            onPress={() => router.push('/(auth)/register')}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Criar conta"
          >
            <Text style={styles.secondaryButtonText}>
              Novo por aqui? <Text style={styles.secondaryButtonAccent}>Criar conta</Text>
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
      marginTop: spacing['3'],
    },
    title: {
      marginTop: spacing['5'],
      fontFamily: typography.family.black,
      fontSize: typography.size['4xl'],
      lineHeight: typography.lineHeight['4xl'],
      color: palette.textOnNavy,
      letterSpacing: -0.6,
    },
    subtitle: {
      marginTop: spacing['3'],
      fontFamily: typography.family.medium,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
      color: palette.textOnNavyMuted,
      maxWidth: 280,
    },
    form: {
      marginTop: spacing['6'],
      flex: 1,
    },
    forgotText: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xs,
      color: palette.textOnNavyMuted,
      textAlign: 'center',
      marginTop: spacing['4'],
      marginBottom: spacing['3'],
    },
    successMessage: {
      marginTop: spacing['2'],
      marginBottom: spacing['2'],
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
