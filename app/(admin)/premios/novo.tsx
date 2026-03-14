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
import { criarPremio } from '@lib/premios';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function NovoPremioScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [custoStr, setCustoStr] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleCriar() {
    setErro(null);
    if (!nome.trim()) return setErro('Informe o nome do prêmio.');
    const custo = Number.parseInt(custoStr, 10);
    if (Number.isNaN(custo) || custo <= 0) return setErro('Custo em pontos deve ser um número maior que zero.');
    setEnviando(true);
    const { error } = await criarPremio({ nome: nome.trim(), descricao: descricao.trim() || null, custo_pontos: custo });
    setEnviando(false);
    if (error) return setErro(error);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}>
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
            value={nome}
            onChangeText={setNome}
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
            value={descricao}
            onChangeText={setDescricao}
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
            value={custoStr}
            onChangeText={setCustoStr}
            placeholder="Ex: 50"
            placeholderTextColor={colors.text.muted}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.botao, enviando && styles.botaoDesabilitado, pressed && !enviando && { opacity: 0.85 }]}
          onPress={handleCriar}
          disabled={enviando}
        >
          <Text style={styles.botaoTexto}>{enviando ? 'Salvando…' : 'Criar prêmio'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { padding: spacing['6'], gap: spacing['5'], flexGrow: 1 },
    campo: { gap: spacing['2'] },
    label: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, color: colors.text.secondary },
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
    },
    botaoDesabilitado: { opacity: 0.55 },
    botaoTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.md },
  });
}
