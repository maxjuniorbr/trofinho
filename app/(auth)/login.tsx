import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { Mail, Lock, ArrowRight } from 'lucide-react-native';
import { signIn } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { heroPalette, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField, DarkPasswordToggle } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';

type LoginField = 'email' | 'password';

export default function LoginScreen() {
  const router = useRouter();
  const styles = useMemo(() => makeStyles(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<LoginField | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const shouldShowError = Boolean(error);

  const validate = (): string | null => {
    const emailValue = email.trim();
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!password) return 'Informe sua senha.';
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
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
        <BrandLogo size="md" variant="onDark" />
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

        <Text style={styles.forgotText}>
          Esqueci minha senha <Text style={styles.forgotBadge}>(em breve)</Text>
        </Text>

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

function makeStyles() {
  return StyleSheet.create({
    header: {
      marginTop: spacing['3'],
    },
    title: {
      marginTop: spacing['5'],
      fontFamily: typography.family.black,
      fontSize: typography.size['4xl'],
      lineHeight: typography.lineHeight['4xl'],
      color: heroPalette.textOnNavy,
      letterSpacing: -0.6,
    },
    subtitle: {
      marginTop: spacing['3'],
      fontFamily: typography.family.medium,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
      color: heroPalette.textOnNavyMuted,
      maxWidth: 280,
    },
    form: {
      marginTop: spacing['6'],
      flex: 1,
    },
    forgotText: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xs,
      color: heroPalette.textOnNavyMuted,
      textAlign: 'center',
      marginTop: spacing['3'],
      marginBottom: spacing['2'],
    },
    forgotBadge: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xxs,
      color: heroPalette.textOnNavyMuted,
      opacity: 0.6,
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
      color: heroPalette.textOnNavyMuted,
    },
    secondaryButtonAccent: {
      fontFamily: typography.family.bold,
      color: heroPalette.borderFocus,
    },
  });
}
