import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { updateUserName, type UserProfile } from '@lib/auth';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type PersonalDataCardProps = Readonly<{
  profile: UserProfile | null;
  email: string;
  onNameUpdated: (name: string) => void;
}>;

export function PersonalDataCard({ profile, email, onNameUpdated }: PersonalDataCardProps) {
  const { colors } = useTheme();
  const [name, setName] = useState(profile?.nome ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSuccess(false);
    const trimmed = name.trim();
    if (!trimmed) return setError('Informe seu nome.');
    setSaving(true);
    const { error: saveError } = await updateUserName(trimmed);
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onNameUpdated(trimmed);
    setSuccess(true);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Dados pessoais</Text>

      <Text style={[styles.label, { color: colors.text.secondary }]}>Nome completo</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default, color: colors.text.primary }]}
        value={name}
        onChangeText={(v) => { setName(v); setSuccess(false); setError(null); }}
        placeholder="Seu nome"
        placeholderTextColor={colors.text.muted}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
      />

      <Text style={[styles.label, { color: colors.text.secondary }]}>E-mail</Text>
      <View style={[styles.inputReadonly, { backgroundColor: colors.bg.muted, borderColor: colors.border.subtle }]}>
        <Text style={[styles.inputReadonlyText, { color: colors.text.muted }]}>{email}</Text>
      </View>

      {error ? <Text style={[styles.feedback, { color: colors.semantic.error }]}>{error}</Text> : null}
      {success ? <Text style={[styles.feedback, { color: colors.semantic.success }]}>Nome atualizado!</Text> : null}

      <Pressable
        style={[styles.btn, { backgroundColor: colors.accent.adminDim, opacity: saving ? 0.55 : 1 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={colors.text.inverse} />
          : <Text style={[styles.btnText, { color: colors.text.inverse }]}>Salvar alterações</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing['4'], gap: spacing['1'] },
  title: { fontFamily: typography.family.bold, fontSize: typography.size.md, marginBottom: spacing['2'] },
  label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginTop: spacing['3'], marginBottom: spacing['1'] },
  input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], fontSize: typography.size.md },
  inputReadonly: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], minHeight: 48, justifyContent: 'center' },
  inputReadonlyText: { fontSize: typography.size.md },
  feedback: { fontSize: typography.size.sm, marginTop: spacing['2'] },
  btn: { borderRadius: radii.md, paddingVertical: spacing['3'], alignItems: 'center', minHeight: 48, justifyContent: 'center', marginTop: spacing['3'] },
  btnText: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
});
