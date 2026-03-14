import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  buscarPremio,
  atualizarPremio,
  desativarPremio,
  reativarPremio,
  type Premio,
} from '@lib/premios';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminPremioDetalheScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [premio, setPremio] = useState<Premio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [custoStr, setCustoStr] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [alterandoAtivo, setAlterandoAtivo] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    const { data, error } = await buscarPremio(id);
    if (error) {
      setErro(error);
    } else if (data) {
      setPremio(data);
      setNome(data.nome);
      setDescricao(data.descricao ?? '');
      setCustoStr(String(data.custo_pontos));
    }
    setCarregando(false);
  }, [id]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleSalvar() {
    setErroForm(null);
    setSucesso(null);
    if (!nome.trim()) return setErroForm('Informe o nome do prêmio.');
    const custo = Number.parseInt(custoStr, 10);
    if (Number.isNaN(custo) || custo <= 0) return setErroForm('Custo em pontos deve ser um número maior que zero.');
    setSalvando(true);
    const { error } = await atualizarPremio(id!, { nome: nome.trim(), descricao: descricao.trim() || null, custo_pontos: custo });
    setSalvando(false);
    if (error) return setErroForm(error);
    setSucesso('Prêmio atualizado!');
    carregar();
  }

  async function handleToggleAtivo() {
    if (!premio) return;
    setAlterandoAtivo(true);
    setErroForm(null);
    setSucesso(null);
    const { error } = premio.ativo ? await desativarPremio(id!) : await reativarPremio(id!);
    setAlterandoAtivo(false);
    if (error) return setErroForm(error);
    carregar();
  }

  if (carregando) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (erro || !premio) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Prêmio" onBack={() => router.back()} />
        <EmptyState error={erro ?? 'Prêmio não encontrado.'} onRetry={carregar} />
      </View>
    );
  }

  let toggleAtivoLabel = 'Reativar prêmio';

  if (alterandoAtivo) {
    toggleAtivoLabel = 'Aguarde…';
  } else if (premio.ativo) {
    toggleAtivoLabel = 'Desativar prêmio';
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior="padding">
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Editar Prêmio" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!premio.ativo && (
          <View style={styles.avisoInativo}>
            <Text style={styles.avisoInativoTexto}>
              Este prêmio está inativo e não aparece para os filhos.
            </Text>
          </View>
        )}

        <View style={styles.campo}>
          <Text style={styles.label}>Nome *</Text>
          <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholderTextColor={colors.text.muted} returnKeyType="next" />
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
          <TextInput style={styles.input} value={custoStr} onChangeText={setCustoStr} keyboardType="numeric" returnKeyType="done" placeholderTextColor={colors.text.muted} />
        </View>

        {erroForm ? <Text style={styles.erroTexto}>{erroForm}</Text> : null}
        {sucesso ? <Text style={styles.sucessoTexto}>{sucesso}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.botao, salvando && styles.botaoDesabilitado, pressed && !salvando && { opacity: 0.85 }]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          <Text style={styles.botaoTexto}>{salvando ? 'Salvando…' : 'Salvar alterações'}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.botaoSecundario, alterandoAtivo && styles.botaoDesabilitado, pressed && !alterandoAtivo && { opacity: 0.85 }]}
          onPress={handleToggleAtivo}
          disabled={alterandoAtivo}
        >
          <Text style={[styles.botaoSecundarioTexto, !premio.ativo && { color: colors.semantic.success }]}>
            {toggleAtivoLabel}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    scroll: { padding: spacing['6'], gap: spacing['5'], flexGrow: 1 },
    avisoInativo: { backgroundColor: colors.semantic.warningBg, borderRadius: radii.lg, borderCurve: 'continuous', padding: spacing['3'] },
    avisoInativoTexto: { fontSize: typography.size.xs, color: colors.semantic.warning, textAlign: 'center' },
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
    erroTexto: { color: colors.semantic.error, fontSize: typography.size.sm, fontFamily: typography.family.medium },
    sucessoTexto: { color: colors.semantic.success, fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    botao: { backgroundColor: colors.accent.admin, borderRadius: radii.xl, borderCurve: 'continuous', paddingVertical: spacing['3'], alignItems: 'center', marginTop: spacing['1'], minHeight: 48 },
    botaoDesabilitado: { opacity: 0.55 },
    botaoTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.md },
    botaoSecundario: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1.5,
      borderColor: colors.semantic.error,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      minHeight: 48,
    },
    botaoSecundarioTexto: { color: colors.semantic.error, fontFamily: typography.family.bold, fontSize: typography.size.md },
  });
}
