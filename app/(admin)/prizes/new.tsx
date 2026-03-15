import {
  StyleSheet,
  Text,
  View,
  Pressable,
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
import { PrizeFormFields } from '@/components/prizes/prize-form-fields';

export default function NewPrizeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costStr, setCostStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCreate() {
    setError(null);
    if (!name.trim()) return setError('Informe o nome do prêmio.');
    const cost = Number.parseInt(costStr, 10);
    if (Number.isNaN(cost) || cost <= 0) return setError('Custo em pontos deve ser um número maior que zero.');
    setSaving(true);
    const { error } = await createPrize({ nome: name.trim(), descricao: description.trim() || null, custo_pontos: cost });
    setSaving(false);
    if (error) return setError(error);
    setSuccess(true);
  }

  if (success) {
    return (
      <View style={[styles.sucessoContainer, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <Text style={styles.sucessoEmoji}>🎁</Text>
        <Text style={[styles.sucessoTitulo, { color: colors.text.primary }]}>Prêmio criado!</Text>
        <Text style={[styles.sucessoTexto, { color: colors.text.secondary }]}>
          O prêmio já está disponível no catálogo.
        </Text>
        <Pressable style={[styles.botaoConcluir, { backgroundColor: colors.accent.adminDim }]} onPress={() => router.back()}>
          <Text style={[styles.botaoConcluirTexto, { color: colors.text.inverse }]}>Concluir</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior="padding">
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Novo Prêmio" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <PrizeFormFields
          name={name}
          description={description}
          cost={costStr}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onCostChange={setCostStr}
          autoFocusName
        />

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
    erro: { color: colors.semantic.error, fontSize: typography.size.sm, fontFamily: typography.family.medium },
    botao: {
      backgroundColor: colors.accent.adminDim,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      paddingVertical: spacing['3'],
      alignItems: 'center',
      marginTop: spacing['1'],
      minHeight: 48,
    },
    botaoDesabilitado: { opacity: 0.55 },
    botaoTexto: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.md },
    sucessoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['8'] },
    sucessoEmoji: { fontSize: typography.size['5xl'], marginBottom: spacing['4'] },
    sucessoTitulo: { fontSize: typography.size['2xl'], fontFamily: typography.family.bold, marginBottom: spacing['3'] },
    sucessoTexto: { fontSize: typography.size.md, textAlign: 'center', lineHeight: typography.lineHeight.md, marginBottom: spacing['8'] },
    botaoConcluir: { borderRadius: radii.md, paddingVertical: spacing['3'], paddingHorizontal: spacing['8'], minHeight: 48, justifyContent: 'center' },
    botaoConcluirTexto: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
  });
}
