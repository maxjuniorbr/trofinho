import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, Switch, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { criarTarefa, listarFilhosDaFamilia, type Filho } from '@lib/tarefas';
import { formatarData, toDateString } from '@lib/utils';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export default function NovaTarefaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontos, setPontos] = useState('');
  const [inicio, setInicio] = useState(new Date());
  const [fim, setFim] = useState(new Date());
  const [showPickerInicio, setShowPickerInicio] = useState(false);
  const [showPickerFim, setShowPickerFim] = useState(false);
  const [exigeEvidencia, setExigeEvidencia] = useState(false);
  const [filhos, setFilhos] = useState<Filho[]>([]);
  const [filhosSelecionados, setFilhosSelecionados] = useState<Set<string>>(new Set());
  const [carregandoFilhos, setCarregandoFilhos] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const shouldShowError = Boolean(erro);

  useEffect(() => {
    listarFilhosDaFamilia().then(({ data }) => { setFilhos(data); setCarregandoFilhos(false); });
  }, []);

  function toggleFilho(id: string) {
    setFilhosSelecionados((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function abrirPickerInicio() {
    if (process.env.EXPO_OS === 'android') {
      DateTimePickerAndroid.open({ value: inicio, mode: 'date', onChange: (_, date) => { if (date) setInicio(date); } });
    } else { setShowPickerInicio(true); }
  }

  function abrirPickerFim() {
    if (process.env.EXPO_OS === 'android') {
      DateTimePickerAndroid.open({ value: fim, mode: 'date', minimumDate: inicio, onChange: (_, date) => { if (date) setFim(date); } });
    } else { setShowPickerFim(true); }
  }

  async function handleCriar() {
    setErro(null);
    if (!titulo.trim()) return setErro('Informe o título da tarefa.');
    const pontosNum = Number.parseInt(pontos, 10);
    if (Number.isNaN(pontosNum) || pontosNum <= 0) return setErro('Pontos deve ser um número maior que zero.');
    if (fim < inicio) return setErro('Data fim deve ser igual ou posterior ao início.');
    if (filhosSelecionados.size === 0) return setErro('Selecione ao menos um filho para atribuir a tarefa.');
    setEnviando(true);
    const { error } = await criarTarefa({
      titulo: titulo.trim(), descricao: descricao.trim() || null, pontos: pontosNum,
      timebox_inicio: toDateString(inicio), timebox_fim: toDateString(fim),
      exige_evidencia: exigeEvidencia, filhoIds: Array.from(filhosSelecionados),
    });
    setEnviando(false);
    if (error) return setErro(error);
    router.back();
  }

  function renderListaFilhos() {
    if (carregandoFilhos) return <ActivityIndicator color={colors.accent.admin} style={{ marginVertical: 12 }} />;
    if (filhos.length === 0) return <Text style={[styles.semFilhos, { color: colors.text.muted }]}>Nenhum filho cadastrado.</Text>;
    return filhos.map((f) => {
      const sel = filhosSelecionados.has(f.id);
      return (
        <Pressable
          key={f.id}
          style={[styles.filhoItem, { borderColor: sel ? colors.accent.admin : colors.border.default, backgroundColor: sel ? colors.accent.adminBg : colors.bg.surface }]}
          onPress={() => toggleFilho(f.id)}
        >
          <Text style={[styles.filhoNome, { color: sel ? colors.accent.admin : colors.text.primary }]}>{f.nome}</Text>
          <Text style={[styles.filhoCheck, { color: sel ? colors.accent.admin : colors.text.muted }]}>{sel ? '✓' : '○'}</Text>
        </Pressable>
      );
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Nova Tarefa" onBack={() => router.back()} />

      <ScrollView style={{ backgroundColor: colors.bg.canvas }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.text.secondary }]}>Título *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]} value={titulo} onChangeText={setTitulo} placeholder="Ex: Lavar a louça" placeholderTextColor={colors.text.muted} maxLength={100} />

        <Text style={[styles.label, { color: colors.text.secondary }]}>Descrição (opcional)</Text>
        <TextInput style={[styles.input, styles.inputMultiline, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]} value={descricao} onChangeText={setDescricao} placeholder="Detalhes da tarefa..." placeholderTextColor={colors.text.muted} multiline numberOfLines={3} maxLength={500} />

        <Text style={[styles.label, { color: colors.text.secondary }]}>Pontos *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.bg.surface, borderColor: colors.border.default, color: colors.text.primary }]} value={pontos} onChangeText={setPontos} placeholder="Ex: 10" placeholderTextColor={colors.text.muted} keyboardType="numeric" maxLength={4} />

        <View style={styles.linha}>
          <View style={styles.linhaItem}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Data início *</Text>
            <Pressable style={[styles.dateBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]} onPress={abrirPickerInicio}>
              <Text style={[styles.dateBtnTexto, { color: colors.text.primary }]}>📅 {formatarData(inicio)}</Text>
            </Pressable>
            {showPickerInicio && process.env.EXPO_OS !== 'android' && (
              <DateTimePicker value={inicio} mode="date" display="spinner" onChange={(_, date) => { setShowPickerInicio(false); if (date) setInicio(date); }} />
            )}
          </View>
          <View style={styles.linhaItem}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Data fim *</Text>
            <Pressable style={[styles.dateBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]} onPress={abrirPickerFim}>
              <Text style={[styles.dateBtnTexto, { color: colors.text.primary }]}>📅 {formatarData(fim)}</Text>
            </Pressable>
            {showPickerFim && process.env.EXPO_OS !== 'android' && (
              <DateTimePicker value={fim} mode="date" minimumDate={inicio} display="spinner" onChange={(_, date) => { setShowPickerFim(false); if (date) setFim(date); }} />
            )}
          </View>
        </View>

        <View style={[styles.switchRow, { borderTopColor: colors.border.subtle }]}>
          <Text style={[styles.label, { color: colors.text.secondary, marginTop: 0 }]}>Exige foto como evidência</Text>
          <Switch value={exigeEvidencia} onValueChange={setExigeEvidencia} trackColor={{ false: colors.border.default, true: colors.accent.admin }} thumbColor={colors.text.inverse} />
        </View>

        <Text style={[styles.secaoTitulo, { color: colors.text.primary }]}>Atribuir para *</Text>
        <View style={styles.filhosList}>{renderListaFilhos()}</View>

        {shouldShowError ? (
          <Text style={[styles.erroTexto, { color: colors.semantic.error }]}>{erro}</Text>
        ) : null}

        <Pressable
          style={[styles.botaoCriar, { backgroundColor: colors.accent.admin, opacity: enviando ? 0.55 : 1 }]}
          onPress={handleCriar}
          disabled={enviando}
        >
          {enviando ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={[styles.botaoCriarTexto, { color: colors.text.inverse }]}>Criar tarefa</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrollContent: { padding: spacing['5'], paddingBottom: spacing['10'] },
    label: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginBottom: spacing['1'], marginTop: spacing['4'] },
    input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], fontSize: typography.size.md },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    linha: { flexDirection: 'row', gap: 8, marginTop: spacing['2'] },
    linhaItem: { flex: 1 },
    dateBtn: { borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing['3'], paddingHorizontal: spacing['4'] },
    dateBtnTexto: { fontSize: typography.size.md },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing['4'], marginTop: spacing['4'], borderTopWidth: 1 },
    secaoTitulo: { fontSize: typography.size.md, fontWeight: typography.weight.bold, marginTop: spacing['5'], marginBottom: spacing['3'] },
    filhosList: { gap: 8 },
    filhoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: radii.md, padding: spacing['3'] },
    filhoNome: { fontSize: typography.size.md, fontWeight: typography.weight.medium },
    filhoCheck: { fontSize: typography.size.lg },
    semFilhos: { fontSize: typography.size.sm, textAlign: 'center', marginVertical: spacing['4'] },
    erroTexto: { fontSize: typography.size.sm, marginTop: spacing['4'], textAlign: 'center' },
    botaoCriar: { borderRadius: radii.md, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['6'], minHeight: 52 },
    botaoCriarTexto: { fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  });
}
