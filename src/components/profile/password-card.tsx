import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Lock } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { InlineMessage } from '@/components/ui/inline-message';
import { Button } from '@/components/ui/button';
import { useUpdateUserPassword } from '@/hooks/queries/use-profile';
import { localizeSupabaseError } from '@lib/api-error';

export const PasswordCard = () => {
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const visibleSuccessMessage = useTransientMessage(success);
  const updatePasswordMutation = useUpdateUserPassword();

  const handleSave = () => {
    setValidationError(null);
    setSuccess(null);
    updatePasswordMutation.reset();
    if (newPassword.length < 8) {
      setValidationError('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError('As senhas não coincidem.');
      return;
    }
    updatePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setSuccess('Senha alterada com sucesso.');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
      },
    );
  };

  const errorMessage =
    validationError ?? (updatePasswordMutation.error ? localizeSupabaseError(updatePasswordMutation.error.message) : null);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      <View style={styles.titleRow}>
        <Lock size={16} color={colors.text.primary} strokeWidth={2} />
        <Text style={[styles.title, { color: colors.text.primary }]}>Segurança</Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text.secondary }]}>Senha atual</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            },
          ]}
          value={currentPassword}
          onChangeText={(v) => {
            setCurrentPassword(v);
            setSuccess(null);
            setValidationError(null);
            updatePasswordMutation.reset();
          }}
          placeholder="Digite sua senha atual"
          placeholderTextColor={colors.text.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={72}
          accessibilityLabel="Senha atual"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text.secondary }]}>Nova senha</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            },
          ]}
          value={newPassword}
          onChangeText={(v) => {
            setNewPassword(v);
            setSuccess(null);
            setValidationError(null);
            updatePasswordMutation.reset();
          }}
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor={colors.text.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={72}
          accessibilityLabel="Nova senha"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text.secondary }]}>Confirmar nova senha</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            },
          ]}
          value={confirmPassword}
          onChangeText={(v) => {
            setConfirmPassword(v);
            setSuccess(null);
            setValidationError(null);
            updatePasswordMutation.reset();
          }}
          placeholder="Repita a nova senha"
          placeholderTextColor={colors.text.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={72}
          accessibilityLabel="Confirmar nova senha"
        />
      </View>

      {errorMessage ? <InlineMessage message={errorMessage} variant="error" /> : null}
      {visibleSuccessMessage ? (
        <InlineMessage message={visibleSuccessMessage} variant="success" />
      ) : null}

      <Button
        label="Confirmar nova senha"
        variant="primary"
        loading={updatePasswordMutation.isPending}
        loadingLabel="Salvando…"
        onPress={handleSave}
        disabled={updatePasswordMutation.isPending}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: spacing['4'],
    gap: spacing['4'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
  },
  title: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.md,
  },
  field: { gap: spacing['1'] },
  label: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.semibold,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    fontSize: typography.size.md,
    minHeight: 48,
  },
});
