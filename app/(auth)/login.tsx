import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { signIn } from '@lib/auth';
import { localizeSupabaseError } from '@lib/api-error';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthTextField } from '@/components/auth/auth-text-field';

type LoginField = 'email' | 'password';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<LoginField | null>(null);
  const shouldShowError = Boolean(error);

  function validate(): string | null {
    const emailValue = email.trim();
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!password) return 'Informe sua senha.';
    if (password.length < 6) return 'A senha deve ter ao menos 6 caracteres.';
    return null;
  }

  async function handleSignIn() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    const { profile, error: signInError } = await signIn(email.trim(), password);
    setLoading(false);

    if (signInError) { setError(localizeSupabaseError(signInError.message)); return; }
    if (!profile) { router.replace('/(auth)/onboarding'); return; }

    const destination = profile.papel === 'admin' ? '/(admin)/' : '/(child)/';
    router.replace(destination);
  }

  return (
    <AuthShell
      variant="hero"
      title="Trofinho"
      subtitle="Conquiste tarefas, acumule pontos, resgate prêmios!"
    >
      <AuthTextField
        label="E-mail"
        focused={focusedField === 'email'}
        placeholder="seu@email.com"
        value={email}
        onChangeText={(value) => { setEmail(value); setError(''); }}
        onFocus={() => setFocusedField('email')}
        onBlur={() => setFocusedField(null)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={MAX_EMAIL_LENGTH}
        editable={!loading}
        accessibilityLabel="Campo de e-mail"
      />

      <AuthTextField
        label="Senha"
        focused={focusedField === 'password'}
        placeholder="••••••"
        value={password}
        onChangeText={(value) => { setPassword(value); setError(''); }}
        onFocus={() => setFocusedField('password')}
        onBlur={() => setFocusedField(null)}
        secureTextEntry
        maxLength={128}
        editable={!loading}
        accessibilityLabel="Campo de senha"
      />

      {shouldShowError ? (
        <Text style={[styles.error, { color: colors.semantic.error }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <AuthPrimaryButton
        label="Entrar"
        loadingLabel="Entrando…"
        loading={loading}
        onPress={handleSignIn}
        accessibilityLabel={loading ? 'Entrando' : 'Entrar'}
      />

      <Pressable
        style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
        onPress={() => router.push('/(auth)/register')}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Criar conta"
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text.secondary }]}>
          Não tem conta?{' '}
          <Text style={{ color: colors.brand.vivid, fontFamily: typography.family.bold }}>
            Criar conta
          </Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}

function makeStyles() {
  return StyleSheet.create({
    error: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      marginTop: spacing['3'],
      textAlign: 'center',
    },
    secondaryButton: {
      paddingVertical: spacing['4'],
      alignItems: 'center',
      marginTop: spacing['1'],
    },
    secondaryButtonText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
    },
  });
}
