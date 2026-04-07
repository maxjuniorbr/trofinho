import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { signUp } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';

type RegisterField = 'name' | 'email' | 'password' | 'confirmPassword';

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<RegisterField | null>(null);
  const shouldShowError = Boolean(error);

  const validate = (): string | null => {
    const emailValue = email.trim();
    if (!name.trim()) return 'Informe seu nome.';
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!password) return 'Crie uma senha.';
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
    if (password !== confirmPassword) return 'As senhas não coincidem.';
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
    router.replace({ pathname: '/(auth)/onboarding', params: { name: name.trim() } });
  };

  return (
    <AuthShell
      headerTitle="Criar Conta"
      onBack={() => router.back()}
      backLabel="Login"
      title="Criar conta"
      subtitle="Junte-se ao Trofinho e comece a conquistar!"
    >
      <AuthTextField
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
        maxLength={60}
        editable={!loading}
        accessibilityLabel="Campo de nome"
      />

      <AuthTextField
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
        maxLength={MAX_EMAIL_LENGTH}
        editable={!loading}
        accessibilityLabel="Campo de e-mail"
      />

      <AuthTextField
        label="Senha"
        focused={focusedField === 'password'}
        placeholder="Mínimo 6 caracteres"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError('');
        }}
        onFocus={() => setFocusedField('password')}
        onBlur={() => setFocusedField(null)}
        secureTextEntry
        maxLength={128}
        editable={!loading}
        accessibilityLabel="Campo de senha"
      />

      <AuthTextField
        label="Confirmar senha"
        focused={focusedField === 'confirmPassword'}
        placeholder="Repita a senha"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          setError('');
        }}
        onFocus={() => setFocusedField('confirmPassword')}
        onBlur={() => setFocusedField(null)}
        secureTextEntry
        maxLength={128}
        editable={!loading}
        accessibilityLabel="Campo de confirmar senha"
      />
      <FormFooter message={shouldShowError ? error : null}>
        <Button
          label="Criar conta"
          loadingLabel="Criando conta…"
          loading={loading}
          onPress={handleSignUp}
          size="lg"
          accessibilityLabel={loading ? 'Criando conta' : 'Criar conta'}
          accessibilityState={{ busy: loading }}
        />

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
          onPress={() => router.back()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Voltar ao login"
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text.secondary }]}>
            Já tem conta?{' '}
            <Text style={{ color: colors.brand.vivid, fontFamily: typography.family.bold }}>
              Entrar
            </Text>
          </Text>
        </Pressable>
      </FormFooter>
    </AuthShell>
  );
}

function makeStyles() {
  return StyleSheet.create({
    secondaryButton: {
      paddingVertical: spacing['3'],
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
    },
  });
}
