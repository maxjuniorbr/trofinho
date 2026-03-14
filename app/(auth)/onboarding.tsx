import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { createFamily, signOut } from '@lib/auth';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ nome?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.nome ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const shouldShowError = Boolean(error);
  const isBusy = loading || loggingOut;
  const submitLabel = loading ? 'Criando família…' : 'Criar família';
  const backLabel = loggingOut ? 'Saindo…' : 'Voltar para o login';

  function validate(): string | null {
    if (!familyName.trim()) return 'Informe o nome da família.';
    if (!adminName.trim()) return 'Informe seu nome.';
    return null;
  }

  async function handleCreateFamily() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    const { error: createError } = await createFamily(familyName.trim(), adminName.trim());
    setLoading(false);

    if (createError) { setError(createError.message); return; }
    router.replace('/(admin)/');
  }

  async function handleBack() {
    setLoggingOut(true);
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StatusBar style={colors.statusBar} />

        <View style={styles.header}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={[styles.titulo, { color: colors.text.primary }]}>Criar sua família</Text>
          <Text style={[styles.subtitulo, { color: colors.text.secondary }]}>
            Você será o administrador e poderá convidar os filhos depois.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>Nome da família</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]}
            placeholder="Ex: Família Silva"
            placeholderTextColor={colors.text.muted}
            value={familyName}
            onChangeText={(t) => { setFamilyName(t); setError(''); }}
            autoCapitalize="words"
            editable={!loading}
            accessibilityLabel="Campo de nome da família"
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Seu nome</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]}
            placeholder="Como quer ser chamado"
            placeholderTextColor={colors.text.muted}
            value={adminName}
            onChangeText={(t) => { setAdminName(t); setError(''); }}
            autoCapitalize="words"
            editable={!loading}
            accessibilityLabel="Campo de nome do administrador"
          />

          {shouldShowError ? (
            <Text style={[styles.erro, { color: colors.semantic.error }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => {
              let opacity = 1;

              if (isBusy) {
                opacity = 0.55;
              } else if (pressed) {
                opacity = 0.82;
              }

              return [styles.botao, { backgroundColor: colors.accent.admin, opacity }];
            }}
            onPress={handleCreateFamily}
            disabled={isBusy}
            accessibilityRole="button"
          >
            <Text style={[styles.botaoTexto, { color: colors.text.inverse }]}>{submitLabel}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => {
              let opacity = 1;

              if (isBusy) {
                opacity = 0.55;
              } else if (pressed) {
                opacity = 0.65;
              }

              return [styles.botaoVoltar, { opacity }];
            }}
            onPress={handleBack}
            disabled={isBusy}
            accessibilityRole="button"
          >
            <Text style={[styles.botaoVoltarTexto, { color: colors.text.secondary }]}>{backLabel}</Text>
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
    emoji: { fontSize: 56 },
    titulo: { fontSize: typography.size['2xl'], fontFamily: typography.family.bold, marginTop: spacing['3'] },
    subtitulo: { fontSize: typography.size.md, marginTop: spacing['2'], textAlign: 'center', lineHeight: typography.lineHeight.md },
    form: { width: '100%' },
    label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginBottom: spacing['1'], marginTop: spacing['4'] },
    input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], fontSize: typography.size.md },
    erro: { fontSize: typography.size.sm, marginTop: spacing['3'], textAlign: 'center' },
    botao: { borderRadius: radii.md, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['6'], minHeight: 48 },
    botaoTexto: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    botaoVoltar: { paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['2'], minHeight: 44 },
    botaoVoltarTexto: { fontSize: typography.size.md },
  });
}
