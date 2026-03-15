import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, Switch, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { createTask, listFamilyChildren, type Child, type TaskFrequencia } from '@lib/tasks';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

export default function NewTaskScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontos, setPontos] = useState('');
  const [frequencia, setFrequencia] = useState<TaskFrequencia>('unica');
  const [exigeEvidencia, setExigeEvidencia] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const shouldShowError = Boolean(error);

  useEffect(() => {
    listFamilyChildren().then(({ data }) => { setChildren(data); setLoadingChildren(false); });
  }, []);

  function toggleChild(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCreate() {
    setError(null);
    if (!titulo.trim()) return setError('Informe o título da tarefa.');
    const pontosNum = Number.parseInt(pontos, 10);
    if (Number.isNaN(pontosNum) || pontosNum <= 0) return setError('Pontos deve ser um número maior que zero.');
    if (selected.size === 0) return setError('Selecione ao menos um filho para atribuir a tarefa.');
    setSubmitting(true);
    const { error } = await createTask({
      titulo: titulo.trim(), descricao: descricao.trim() || null, pontos: pontosNum,
      frequencia, exige_evidencia: exigeEvidencia, filhoIds: Array.from(selected),
    });
    setSubmitting(false);
    if (error) return setError(error);
    setSuccess(true);
  }

  function renderChildrenList() {
    if (loadingChildren) return <ActivityIndicator color={colors.accent.admin} style={{ marginVertical: spacing['3'] }} />;
    if (children.length === 0) return <Text style={[styles.semFilhos, { color: colors.text.muted }]}>Nenhum filho cadastrado.</Text>;
    return children.map((child) => {
      const sel = selected.has(child.id);
      return (
        <Pressable
          key={child.id}
          style={[styles.filhoItem, { borderColor: sel ? colors.accent.adminDim : colors.border.default, backgroundColor: sel ? colors.accent.adminBg : colors.bg.surface }]}
          onPress={() => toggleChild(child.id)}
        >
          <Text style={[styles.filhoNome, { color: sel ? colors.accent.admin : colors.text.primary }]}>{child.nome}</Text>
          <Text style={[styles.filhoCheck, { color: sel ? colors.accent.admin : colors.text.muted }]}>{sel ? '✓' : '○'}</Text>
        </Pressable>
      );
    });
  }

  if (success) {
    return (
      <View style={[styles.sucessoContainer, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <Text style={styles.sucessoEmoji}>📋</Text>
        <Text style={[styles.sucessoTitulo, { color: colors.text.primary }]}>Tarefa criada!</Text>
        <Text style={[styles.sucessoTexto, { color: colors.text.secondary }]}>
          A tarefa foi criada e atribuída com sucesso.
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
      <ScreenHeader title="Nova Tarefa" onBack={() => router.back()} />

      <ScrollView style={{ backgroundColor: colors.bg.canvas }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.text.secondary }]}>Título *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]} value={titulo} onChangeText={setTitulo} placeholder="Ex: Lavar a louça" placeholderTextColor={colors.text.muted} maxLength={100} />

        <Text style={[styles.label, { color: colors.text.secondary }]}>Descrição (opcional)</Text>
        <TextInput style={[styles.input, styles.inputMultiline, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]} value={descricao} onChangeText={setDescricao} placeholder="Detalhes da tarefa..." placeholderTextColor={colors.text.muted} multiline numberOfLines={3} maxLength={500} />

        <Text style={[styles.label, { color: colors.text.secondary }]}>Pontos *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]} value={pontos} onChangeText={setPontos} placeholder="Ex: 10" placeholderTextColor={colors.text.muted} keyboardType="numeric" maxLength={4} />

        <Text style={[styles.label, { color: colors.text.secondary }]}>Frequência *</Text>
        <View style={styles.linha}>
          <Pressable
            style={[styles.freqBtn, { borderColor: frequencia === 'unica' ? colors.accent.adminDim : colors.border.default, backgroundColor: frequencia === 'unica' ? colors.accent.adminBg : colors.bg.surface }]}
            onPress={() => setFrequencia('unica')}
          >
            <Text style={[styles.freqBtnTexto, { color: frequencia === 'unica' ? colors.accent.admin : colors.text.secondary }]}>Única</Text>
            <Text style={[styles.freqBtnDesc, { color: frequencia === 'unica' ? colors.accent.admin : colors.text.muted }]}>Realizada uma vez</Text>
          </Pressable>
          <Pressable
            style={[styles.freqBtn, { borderColor: frequencia === 'diaria' ? colors.accent.adminDim : colors.border.default, backgroundColor: frequencia === 'diaria' ? colors.accent.adminBg : colors.bg.surface }]}
            onPress={() => setFrequencia('diaria')}
          >
            <Text style={[styles.freqBtnTexto, { color: frequencia === 'diaria' ? colors.accent.admin : colors.text.secondary }]}>Diária</Text>
            <Text style={[styles.freqBtnDesc, { color: frequencia === 'diaria' ? colors.accent.admin : colors.text.muted }]}>Repetida todo dia</Text>
          </Pressable>
        </View>

        <View style={[styles.switchRow, { borderTopColor: colors.border.subtle }]}>
          <Text style={[styles.label, { color: colors.text.secondary, marginTop: 0 }]}>Exige foto como evidência</Text>
          <Switch value={exigeEvidencia} onValueChange={setExigeEvidencia} trackColor={{ false: colors.border.default, true: colors.accent.adminDim }} thumbColor={colors.text.inverse} />
        </View>

        <Text style={[styles.secaoTitulo, { color: colors.text.primary }]}>Atribuir para *</Text>
        <View style={styles.filhosList}>{renderChildrenList()}</View>

        {shouldShowError ? (
          <Text style={[styles.erroTexto, { color: colors.semantic.error }]}>{error}</Text>
        ) : null}

        <Pressable
          style={[styles.botaoCriar, { backgroundColor: colors.accent.adminDim, opacity: submitting ? 0.55 : 1 }]}
          onPress={handleCreate}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={[styles.botaoCriarTexto, { color: colors.text.inverse }]}>Criar tarefa</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    scrollContent: { padding: spacing['5'], paddingBottom: spacing['10'] },
    label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginBottom: spacing['1'], marginTop: spacing['4'] },
    input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], fontSize: typography.size.md },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    linha: { flexDirection: 'row', gap: spacing['2'], marginTop: spacing['2'] },
    freqBtn: { flex: 1, borderWidth: 2, borderRadius: radii.md, paddingVertical: spacing['3'], paddingHorizontal: spacing['4'], alignItems: 'center', gap: spacing['1'] },
    freqBtnTexto: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    freqBtnDesc: { fontSize: typography.size.xs },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing['4'], marginTop: spacing['4'], borderTopWidth: 1 },
    secaoTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold, marginTop: spacing['5'], marginBottom: spacing['3'] },
    filhosList: { gap: spacing['2'] },
    filhoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: radii.md, padding: spacing['3'] },
    filhoNome: { fontSize: typography.size.md, fontFamily: typography.family.medium },
    filhoCheck: { fontSize: typography.size.lg },
    semFilhos: { fontSize: typography.size.sm, textAlign: 'center', marginVertical: spacing['4'] },
    erroTexto: { fontSize: typography.size.sm, marginTop: spacing['4'], textAlign: 'center' },
    botaoCriar: { borderRadius: radii.md, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['6'], minHeight: 56 },
    botaoCriarTexto: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    sucessoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['8'] },
    sucessoEmoji: { fontSize: typography.size['5xl'], marginBottom: spacing['4'] },
    sucessoTitulo: { fontSize: typography.size['2xl'], fontFamily: typography.family.bold, marginBottom: spacing['3'] },
    sucessoTexto: { fontSize: typography.size.md, textAlign: 'center', lineHeight: typography.lineHeight.md, marginBottom: spacing['8'] },
    botaoConcluir: { borderRadius: radii.md, paddingVertical: spacing['3'], paddingHorizontal: spacing['8'], minHeight: 48, justifyContent: 'center' },
    botaoConcluirTexto: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
  });
}
