import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { createPrize } from '@lib/prizes';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function NewPrizeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costStr, setCostStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (!name.trim()) return setError('Informe o nome do prêmio.');
    const cost = Number.parseInt(costStr, 10);
    if (Number.isNaN(cost) || cost <= 0) return setError('Custo em pontos deve ser um número maior que zero.');
    setSaving(true);
    const { error } = await createPrize({ nome: name.trim(), descricao: description.trim() || null, custo_pontos: cost });
    setSaving(false);
    if (error) return setError(error);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior="padding">
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Novo Prêmio" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.campo}>
          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Sorvete, Filme no cinema…"
            placeholderTextColor={colors.text.muted}
            autoFocus
            returnKeyType="next"
          />
        </View>

        <View style={styles.campo}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.inputMultilinha]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detalhes opcionais…"
            placeholderTextColor={colors.text.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.campo}>
          <Text style={styles.label}>Custo em pontos *</Text>
          <TextInput
            style={styles.input}
            value={costStr}
            onChangeText={setCostStr}
            placeholder="Ex: 50"
            placeholderTextColor={colors.text.muted}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>

        {error ? <Text style={styles.erro}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.botao, saving && styles.botaoDesabilitado, pressed && !saving && { opacity: 0.85 }]}
          onPress={handleCreate}
          disabled={saving}
        >
          <Text style={styles.botaoTexto}>{saving ? 'Salvando…' : 'Criar prêmio'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { padding: spacing['6'], gap: spacing['5'], flexGrow: 1 },
    campo: { gap: spacing['2'] },
    label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, color: colors.text.secondary },
    input: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      color: colors.text.primary,
      minHeight: 48,
    },
    inputMultilinha: { minHeight: 80, paddingTop: spacing['3'] },
    erro: { color: colors.semantic.error, fontSize: typography.size.sm, fontFamily: typography.family.medium },
    botao: {
      backgroundColor: colors.accent.admin,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      paddingVertical: spacing['3'],
      alignItems: 'center',
      marginTop: spacing['1'],
      minHeight: 48,
    },
    botaoDesabilitado: { opacity: 0.55 },
    botaoTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.md },
  });
}
