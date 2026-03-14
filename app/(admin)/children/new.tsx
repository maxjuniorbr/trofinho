import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { registerChild } from '@lib/children';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

export default function NewChildScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const shouldShowError = Boolean(error);

  async function handleRegister() {
    setError(null);
    const emailValue = email.trim().toLowerCase();
    if (!name.trim()) return setError('Informe o nome do filho.');
    if (!isValidEmail(emailValue)) return setError('E-mail inválido.');
    if (tempPassword.length < 6) return setError('A senha temporária deve ter ao menos 6 caracteres.');
    if (tempPassword !== confirmPassword) return setError('As senhas não coincidem.');
    setSubmitting(true);
    const { error } = await registerChild(name.trim(), emailValue, tempPassword);
    setSubmitting(false);
    if (error) { setError(error); return; }
    setSuccess(true);
  }

  if (success) {
    return (
      <View style={[styles.sucessoContainer, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <Text style={styles.sucessoEmoji}>🎉</Text>
        <Text style={[styles.sucessoTitulo, { color: colors.text.primary }]}>Filho cadastrado!</Text>
        <Text style={[styles.sucessoTexto, { color: colors.text.secondary }]}>
          Compartilhe as credenciais com {name}:{'\n\n'}
          <Text style={{ color: colors.accent.admin, fontFamily: typography.family.bold }}>E-mail: {email}</Text>
          {'\n'}
          <Text style={{ color: colors.accent.admin, fontFamily: typography.family.bold }}>Senha: {tempPassword}</Text>
        </Text>
        <Pressable style={[styles.botaoConcluir, { backgroundColor: colors.accent.admin }]} onPress={() => router.back()}>
          <Text style={[styles.botaoConcluirTexto, { color: colors.text.inverse }]}>Concluir</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: colors.bg.canvas }]}
      behavior="padding"
    >
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Novo Filho" onBack={() => router.back()} />

      <ScrollView
        style={{ backgroundColor: colors.bg.canvas }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.infoBox, { backgroundColor: colors.accent.adminBg, borderColor: colors.border.subtle }]}>
          <Text style={[styles.infoTexto, { color: colors.text.secondary }]}>
            O sistema criará uma conta para o filho. Compartilhe o e-mail e senha temporária para o primeiro acesso.
          </Text>
        </View>

        {[
          { label: 'Nome *', value: name, setter: setName, placeholder: 'Nome do filho', maxLength: 60, autoCapitalize: 'words' as const, keyboardType: undefined, secure: false },
          { label: 'E-mail *', value: email, setter: setEmail, placeholder: 'email@exemplo.com', maxLength: MAX_EMAIL_LENGTH, autoCapitalize: 'none' as const, keyboardType: 'email-address' as const, secure: false },
          { label: 'Senha temporária *', value: tempPassword, setter: setTempPassword, placeholder: 'Mínimo 6 caracteres', maxLength: 40, autoCapitalize: 'none' as const, keyboardType: undefined, secure: true },
          { label: 'Confirmar senha *', value: confirmPassword, setter: setConfirmPassword, placeholder: 'Repita a senha', maxLength: 40, autoCapitalize: 'none' as const, keyboardType: undefined, secure: true },
        ].map(({ label, value, setter, placeholder, maxLength, autoCapitalize, keyboardType, secure }) => (
          <View key={label}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]}
              value={value}
              onChangeText={setter}
              placeholder={placeholder}
              placeholderTextColor={colors.text.muted}
              maxLength={maxLength}
              autoCapitalize={autoCapitalize}
              keyboardType={keyboardType}
              autoCorrect={false}
              secureTextEntry={secure}
            />
          </View>
        ))}

        {shouldShowError ? (
          <Text style={[styles.erroTexto, { color: colors.semantic.error }]}>{error}</Text>
        ) : null}

        <Pressable
          style={[styles.botaoCadastrar, { backgroundColor: colors.accent.admin, opacity: submitting ? 0.55 : 1 }]}
          onPress={handleRegister}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={[styles.botaoCadastrarTexto, { color: colors.text.inverse }]}>Cadastrar filho</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    scrollContent: { padding: spacing['5'], paddingBottom: spacing['10'] },
    infoBox: { borderRadius: radii.md, borderWidth: 1, padding: spacing['3'], marginBottom: spacing['4'] },
    infoTexto: { fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
    label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginBottom: spacing['1'], marginTop: spacing['4'] },
    input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], fontSize: typography.size.md },
    erroTexto: { fontSize: typography.size.sm, marginTop: spacing['3'], textAlign: 'center' },
    botaoCadastrar: { borderRadius: radii.md, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['6'], minHeight: 48 },
    botaoCadastrarTexto: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    sucessoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['8'] },
    sucessoEmoji: { fontSize: 56, marginBottom: spacing['4'] },
    sucessoTitulo: { fontSize: typography.size['2xl'], fontFamily: typography.family.bold, marginBottom: spacing['3'] },
    sucessoTexto: { fontSize: typography.size.md, textAlign: 'center', lineHeight: typography.lineHeight.md, marginBottom: spacing['8'] },
    botaoConcluir: { borderRadius: radii.md, paddingVertical: spacing['3'], paddingHorizontal: spacing['8'], minHeight: 48, justifyContent: 'center' },
    botaoConcluirTexto: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
  });
}
