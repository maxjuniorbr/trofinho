import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { User } from 'lucide-react-native';
import { type UserProfile } from '@lib/auth';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { InlineMessage } from '@/components/ui/inline-message';
import { Button } from '@/components/ui/button';
import { useUpdateUserName } from '@/hooks/queries/use-profile';

type PersonalDataCardProps = Readonly<{
  profile: UserProfile | null;
  email: string;
  onNameUpdated: (name: string) => void;
}>;

export const PersonalDataCard = ({ profile, email, onNameUpdated }: PersonalDataCardProps) => {
  const { colors } = useTheme();
  const [name, setName] = useState(profile?.nome ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const visibleSuccessMessage = useTransientMessage(success);
  const updateNameMutation = useUpdateUserName();

  const handleSave = () => {
    setValidationError(null);
    setSuccess(null);
    updateNameMutation.reset();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Informe seu nome.');
      return;
    }
    updateNameMutation.mutate(trimmed, {
      onSuccess: () => {
        onNameUpdated(trimmed);
        setSuccess('Nome atualizado.');
      },
    });
  };

  const errorMessage =
    validationError ?? (updateNameMutation.error ? updateNameMutation.error.message : null);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      <View style={styles.titleRow}>
        <User size={16} color={colors.text.primary} strokeWidth={2} />
        <Text style={[styles.title, { color: colors.text.primary }]}>Dados pessoais</Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text.secondary }]}>Nome completo</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            },
          ]}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setSuccess(null);
            setValidationError(null);
            updateNameMutation.reset();
          }}
          placeholder="Seu nome"
          placeholderTextColor={colors.text.muted}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={60}
          accessibilityLabel="Nome completo"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text.secondary }]}>E-mail</Text>
        <View
          style={[
            styles.inputReadonly,
            { backgroundColor: colors.bg.muted, borderColor: colors.border.subtle },
          ]}
        >
          <Text style={[styles.inputReadonlyText, { color: colors.text.muted }]}>{email}</Text>
        </View>
      </View>

      {errorMessage ? <InlineMessage message={errorMessage} variant="error" /> : null}
      {visibleSuccessMessage ? (
        <InlineMessage message={visibleSuccessMessage} variant="success" />
      ) : null}

      <Button
        label="Salvar alterações"
        variant="primary"
        loading={updateNameMutation.isPending}
        onPress={handleSave}
        disabled={updateNameMutation.isPending}
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
  inputReadonly: {
    borderWidth: 1,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    minHeight: 48,
    justifyContent: 'center',
  },
  inputReadonlyText: { fontSize: typography.size.md },
});
