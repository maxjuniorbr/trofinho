import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { signIn } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function validar(): string | null {
    const emailValue = email.trim();
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!senha) return 'Informe sua senha.';
    if (senha.length < 6) return 'A senha deve ter ao menos 6 caracteres.';
    return null;
  }

  async function handleEntrar() {
    const erroValidacao = validar();
    if (erroValidacao) { setErro(erroValidacao); return; }

    setErro('');
    setCarregando(true);
    const { profile, error } = await signIn(email.trim(), senha);
    setCarregando(false);

    if (error) { setErro(error.message); return; }
    if (!profile) { router.replace('/(auth)/onboarding'); return; }
    router.replace(profile.papel === 'admin' ? '/(admin)/' : '/(filho)/');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar style={colors.statusBar} />

        <View style={styles.header}>
          <Text style={styles.logo}>🏆</Text>
          <Text style={[styles.titulo, { color: colors.text.primary }]}>Trofinho</Text>
          <Text style={[styles.subtitulo, { color: colors.text.secondary }]}>Aprenda, ganhe e guarde</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>E-mail</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]}
            placeholder="seu@email.com"
            placeholderTextColor={colors.text.muted}
            value={email}
            onChangeText={(t) => { setEmail(t); setErro(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_EMAIL_LENGTH}
            editable={!carregando}
            accessibilityLabel="Campo de e-mail"
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Senha</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]}
            placeholder="••••••"
            placeholderTextColor={colors.text.muted}
            value={senha}
            onChangeText={(t) => { setSenha(t); setErro(''); }}
            secureTextEntry
            maxLength={128}
            editable={!carregando}
            accessibilityLabel="Campo de senha"
          />

          {erro ? <Text style={[styles.erro, { color: colors.semantic.error }]} accessibilityRole="alert">{erro}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.botao,
              { backgroundColor: colors.accent.admin, opacity: carregando ? 0.55 : pressed ? 0.82 : 1 },
            ]}
            onPress={handleEntrar}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel={carregando ? 'Entrando' : 'Entrar'}
            accessibilityState={{ disabled: carregando, busy: carregando }}
          >
            <Text style={[styles.botaoTexto, { color: colors.text.inverse }]}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.botaoSecundario, { opacity: pressed ? 0.65 : 1 }]}
            onPress={() => router.push('/(auth)/register')}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel="Criar conta"
          >
            <Text style={[styles.botaoSecundarioTexto, { color: colors.accent.admin }]}>Criar conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    header: { alignItems: 'center', marginBottom: spacing['10'] },
    logo: { fontSize: 56 },
    titulo: { fontSize: typography.size['3xl'], fontWeight: typography.weight.bold, marginTop: spacing['2'] },
    subtitulo: { fontSize: typography.size.md, marginTop: spacing['1'] },
    form: { width: '100%' },
    label: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginBottom: spacing['1'], marginTop: spacing['4'] },
    input: {
      borderWidth: 1, borderRadius: radii.md,
      paddingHorizontal: spacing['4'], paddingVertical: spacing['3'],
      fontSize: typography.size.md,
    },
    erro: { fontSize: typography.size.sm, marginTop: spacing['3'], textAlign: 'center' },
    botao: {
      borderRadius: radii.md, paddingVertical: spacing['4'],
      alignItems: 'center', marginTop: spacing['6'], minHeight: 52,
    },
    botaoTexto: { fontSize: typography.size.md, fontWeight: typography.weight.semibold },
    botaoSecundario: { paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['2'], minHeight: 44 },
    botaoSecundarioTexto: { fontSize: typography.size.md, fontWeight: typography.weight.medium },
  });
}
