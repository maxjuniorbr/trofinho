import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { createFamily, signOut } from '@lib/auth';
import { localizeSupabaseError } from '@lib/api-error';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';

type OnboardingField = 'familyName' | 'adminName';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.name ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [focusedField, setFocusedField] = useState<OnboardingField | null>(null);
  const shouldShowError = Boolean(error);
  const isBusy = loading || loggingOut;
  const submitLabel = loading ? 'Criando família…' : 'Criar família';
  const backLabel = loggingOut ? 'Saindo…' : 'Voltar para o login';

  const validate = (): string | null => {
    if (!familyName.trim()) return 'Informe o nome da família.';
    if (!adminName.trim()) return 'Informe seu nome.';
    return null;
  };

  const handleCreateFamily = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    const { error: createError } = await createFamily(familyName.trim(), adminName.trim());

    if (createError) { setLoading(false); setError(localizeSupabaseError(createError.message)); }

    // Navigation is handled by the root layout auth state handler.
    // Keep the button in loading state until the redirect happens.
  };

  const handleBack = async () => {
    setLoggingOut(true);
    await signOut();
    // Navigation is handled by the root layout auth state handler.
  };

  return (
    <AuthShell
      headerTitle="Configurar Família"
      onBack={handleBack}
      backLabel="Login"
      title="Criar sua família"
      subtitle="Você será o administrador e poderá convidar os filhos depois."
    >
      <AuthTextField
        label="Nome da família"
        focused={focusedField === 'familyName'}
        placeholder="Ex: Família Silva"
        value={familyName}
        onChangeText={(value) => { setFamilyName(value); setError(''); }}
        onFocus={() => setFocusedField('familyName')}
        onBlur={() => setFocusedField(null)}
        autoCapitalize="words"
        editable={!isBusy}
        accessibilityLabel="Campo de nome da família"
      />

      <AuthTextField
        label="Seu nome"
        focused={focusedField === 'adminName'}
        placeholder="Como quer ser chamado"
        value={adminName}
        onChangeText={(value) => { setAdminName(value); setError(''); }}
        onFocus={() => setFocusedField('adminName')}
        onBlur={() => setFocusedField(null)}
        autoCapitalize="words"
        editable={!isBusy}
        accessibilityLabel="Campo de nome do administrador"
      />
      <FormFooter message={shouldShowError ? error : null}>
        <Button
          label="Criar família"
          loadingLabel="Criando família…"
          loading={loading}
          onPress={handleCreateFamily}
          size="lg"
          accessibilityLabel={submitLabel}
          accessibilityState={{ busy: loading }}
        />

        <Pressable
          style={({ pressed }) => {
            const opacity = isBusy ? 0.55 : 1;

            return [
              styles.secondaryButton,
              { opacity: !isBusy && pressed ? 0.65 : opacity },
            ];
          }}
          onPress={handleBack}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Voltar ao login"
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text.secondary }]}>
            {backLabel}
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
