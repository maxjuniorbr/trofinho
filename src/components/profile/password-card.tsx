import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { updateUserPassword } from '@lib/auth';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { useTransientMessage } from '@/hooks/use-transient-message';

export function PasswordCard() {
  const { colors } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visibleSuccessMessage = useTransientMessage(success);

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (newPassword.length < 6) return setError('A nova senha deve ter ao menos 6 caracteres.');
    if (newPassword !== confirmPassword) return setError('As senhas não coincidem.');
    setSaving(true);
    const { error: saveError } = await updateUserPassword(newPassword);
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setSuccess('Senha alterada com sucesso!');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Segurança</Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>Alterar senha</Text>

      <Text style={[styles.label, { color: colors.text.secondary }]}>Nova senha</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default, color: colors.text.primary }]}
        value={newPassword}
        onChangeText={(v) => { setNewPassword(v); setSuccess(null); setError(null); }}
        placeholder="Mínimo 6 caracteres"
        placeholderTextColor={colors.text.muted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={72}
      />

      <Text style={[styles.label, { color: colors.text.secondary }]}>Confirmar nova senha</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default, color: colors.text.primary }]}
        value={confirmPassword}
        onChangeText={(v) => { setConfirmPassword(v); setSuccess(null); setError(null); }}
        placeholder="Repita a nova senha"
        placeholderTextColor={colors.text.muted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={72}
      />

      {error ? <Text style={[styles.feedback, { color: colors.semantic.error }]}>{error}</Text> : null}
      {visibleSuccessMessage ? <Text style={[styles.feedback, { color: colors.semantic.success }]}>{visibleSuccessMessage}</Text> : null}

      <Pressable
        style={[styles.btn, { backgroundColor: colors.accent.adminDim, opacity: saving ? 0.55 : 1 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={colors.text.inverse} />
          : <Text style={[styles.btnText, { color: colors.text.inverse }]}>Confirmar nova senha</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing['4'], gap: spacing['1'] },
  title: { fontFamily: typography.family.bold, fontSize: typography.size.md, marginBottom: spacing['2'] },
  subtitle: { fontFamily: typography.family.semibold, fontSize: typography.size.sm, marginBottom: spacing['2'] },
  label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginTop: spacing['3'], marginBottom: spacing['1'] },
  input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], fontSize: typography.size.md },
  feedback: { fontSize: typography.size.sm, marginTop: spacing['2'] },
  btn: { borderRadius: radii.md, paddingVertical: spacing['3'], alignItems: 'center', minHeight: 48, justifyContent: 'center', marginTop: spacing['3'] },
  btnText: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
});
