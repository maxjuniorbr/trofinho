import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  buscarTarefaComAtribuicoes,
  aprovarAtribuicao,
  rejeitarAtribuicao,
  labelStatus,
  corStatus,
  type TarefaDetalhe,
  type AtribuicaoComFilho,
} from '@lib/tarefas';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function TarefaDetalheAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tarefa, setTarefa] = useState<TarefaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [acoesAtrib, setAcoesAtrib] = useState<
    Record<string, 'rejeitando' | 'processando' | null>
  >({});
  const [notasRejeicao, setNotasRejeicao] = useState<Record<string, string>>({});
  const [errosAtrib, setErrosAtrib] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await buscarTarefaComAtribuicoes(id);
      if (error) setErro(error);
      else setTarefa(data);
    } catch {
      setErro('Não foi possível carregar a tarefa agora.');
      setTarefa(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleAprovar(atrib: AtribuicaoComFilho) {
    setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: 'processando' }));
    setErrosAtrib((prev) => ({ ...prev, [atrib.id]: '' }));
    const { error } = await aprovarAtribuicao(atrib.id);
    if (error) {
      setErrosAtrib((prev) => ({ ...prev, [atrib.id]: error }));
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
    } else {
      await carregar();
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
    }
  }

  async function handleRejeitar(atrib: AtribuicaoComFilho) {
    const nota = notasRejeicao[atrib.id] ?? '';
    if (!nota.trim()) {
      setErrosAtrib((prev) => ({ ...prev, [atrib.id]: 'Informe o motivo da rejeição.' }));
      return;
    }
    setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: 'processando' }));
    setErrosAtrib((prev) => ({ ...prev, [atrib.id]: '' }));
    const { error } = await rejeitarAtribuicao(atrib.id, nota.trim());
    if (error) {
      setErrosAtrib((prev) => ({ ...prev, [atrib.id]: error }));
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
    } else {
      await carregar();
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
      setNotasRejeicao((prev) => ({ ...prev, [atrib.id]: '' }));
    }
  }

  if (carregando) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (erro || !tarefa) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Detalhes" onBack={() => router.back()} />
        <EmptyState error={erro ?? 'Tarefa não encontrada.'} onRetry={carregar} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Detalhes" onBack={() => router.back()} backLabel="← Tarefas" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Dados da tarefa */}
        <View style={styles.card}>
          <View style={styles.cardTopo}>
            <Text style={styles.cardTitulo}>{tarefa.titulo}</Text>
            <View style={styles.pontosTag}>
              <Text style={styles.pontosTexto}>{tarefa.pontos} pts</Text>
            </View>
          </View>
          {tarefa.descricao ? (
            <Text style={styles.descricao}>{tarefa.descricao}</Text>
          ) : null}
          <Text style={styles.meta}>
            {tarefa.timebox_inicio}
            {' \u2192 '}
            {tarefa.timebox_fim}
          </Text>
          {tarefa.exige_evidencia && (
            <View style={styles.tagEvidencia}>
              <Text style={styles.tagEvidenciaTexto}>📷 Exige foto</Text>
            </View>
          )}
        </View>

        <Text style={styles.secaoTitulo}>Atribuições ({tarefa.atribuicoes.length})</Text>

        {tarefa.atribuicoes.length === 0 ? (
          <Text style={styles.semAtrib}>Nenhum filho atribuído.</Text>
        ) : (
          tarefa.atribuicoes.map((atrib) => {
            const acao = acoesAtrib[atrib.id] ?? null;
            const nota = notasRejeicao[atrib.id] ?? '';
            const erroAtrib = errosAtrib[atrib.id] ?? '';
            const processando = acao === 'processando';

            return (
              <View key={atrib.id} style={styles.atribCard}>
                <View style={styles.atribTopo}>
                  <Text style={styles.filhoNome}>{atrib.filhos.nome}</Text>
                  <View style={[styles.statusTag, { backgroundColor: corStatus(atrib.status) + '20' }]}>
                    <Text style={[styles.statusTexto, { color: corStatus(atrib.status) }]}>
                      {labelStatus(atrib.status)}
                    </Text>
                  </View>
                </View>

                {atrib.evidencia_url ? (
                  <Image
                    source={{ uri: atrib.evidencia_url }}
                    style={styles.evidenciaImg}
                    resizeMode="cover"
                  />
                ) : null}

                {atrib.nota_rejeicao ? (
                  <View style={styles.notaRejeicaoBox}>
                    <Text style={styles.notaRejeicaoLabel}>Motivo da rejeição:</Text>
                    <Text style={styles.notaRejeicaoTexto}>{atrib.nota_rejeicao}</Text>
                  </View>
                ) : null}

                {atrib.status === 'aguardando_validacao' && (
                  <View style={styles.acoesBox}>
                    {acao === 'rejeitando' ? (
                      <>
                        <TextInput
                          style={styles.inputNota}
                          value={nota}
                          onChangeText={(t) => setNotasRejeicao((prev) => ({ ...prev, [atrib.id]: t }))}
                          placeholder="Motivo da rejeição (obrigatório)"
                          placeholderTextColor={colors.text.muted}
                          multiline
                        />
                        <View style={styles.botoesRejeitar}>
                          <Pressable
                            style={[styles.botaoAcao, styles.botaoCancelar]}
                            onPress={() => setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }))}
                            disabled={processando}
                          >
                            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.botaoAcao, styles.botaoRejeitar, processando && styles.botaoDesabilitado]}
                            onPress={() => handleRejeitar(atrib)}
                            disabled={processando}
                          >
                            {processando
                              ? <ActivityIndicator color="#fff" size="small" />
                              : <Text style={styles.botaoRejeitarTexto}>Confirmar rejeição</Text>}
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <View style={styles.botoesValidar}>
                        <Pressable
                          style={[styles.botaoAcao, styles.botaoRejeitar, processando && styles.botaoDesabilitado]}
                          onPress={() => setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: 'rejeitando' }))}
                          disabled={processando}
                        >
                          <Text style={styles.botaoRejeitarTexto}>Rejeitar</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.botaoAcao, styles.botaoAprovar, processando && styles.botaoDesabilitado]}
                          onPress={() => handleAprovar(atrib)}
                          disabled={processando}
                        >
                          {processando
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.botaoAprovarTexto}>Aprovar ✓</Text>}
                        </Pressable>
                      </View>
                    )}
                    {erroAtrib ? <Text style={styles.erroAtrib}>{erroAtrib}</Text> : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['5'],
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
    },
    cardTopo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing['2'],
    },
    cardTitulo: { flex: 1, fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary, marginRight: spacing['2'] },
    pontosTag: { backgroundColor: colors.accent.adminBg, borderRadius: radii.md, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'] },
    pontosTexto: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.accent.admin },
    descricao: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing['2'], lineHeight: 20 },
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    tagEvidencia: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.sm,
      paddingVertical: 3,
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    tagEvidenciaTexto: { fontSize: typography.size.xs, color: colors.semantic.warning, fontWeight: typography.weight.semibold },
    secaoTitulo: {
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing['3'],
    },
    semAtrib: { fontSize: typography.size.sm, color: colors.text.muted, fontStyle: 'italic' },
    atribCard: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.lg,
      padding: spacing['3'],
      marginBottom: spacing['3'],
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    },
    atribTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] },
    filhoNome: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text.primary },
    statusTag: { borderRadius: radii.sm, paddingVertical: 3, paddingHorizontal: spacing['2'] },
    statusTexto: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
    evidenciaImg: { width: '100%', height: 200, borderRadius: radii.lg, marginBottom: spacing['2'] },
    notaRejeicaoBox: {
      backgroundColor: colors.semantic.errorBg,
      borderRadius: radii.md,
      padding: spacing['3'],
      marginBottom: spacing['2'],
    },
    notaRejeicaoLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.semantic.error, marginBottom: 3 },
    notaRejeicaoTexto: { fontSize: typography.size.sm, color: colors.text.primary },
    acoesBox: { marginTop: spacing['2'] },
    inputNota: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radii.md,
      padding: spacing['3'],
      fontSize: typography.size.sm,
      color: colors.text.primary,
      backgroundColor: colors.bg.surface,
      minHeight: 72,
      textAlignVertical: 'top',
      marginBottom: spacing['2'],
    },
    botoesRejeitar: { flexDirection: 'row', gap: spacing['2'] },
    botoesValidar: { flexDirection: 'row', gap: spacing['2'] },
    botaoAcao: { flex: 1, borderRadius: radii.md, paddingVertical: spacing['2'], alignItems: 'center' },
    botaoCancelar: { borderWidth: 1, borderColor: colors.border.default },
    botaoCancelarTexto: { color: colors.text.secondary, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
    botaoRejeitar: { backgroundColor: colors.semantic.error },
    botaoRejeitarTexto: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.sm },
    botaoAprovar: { backgroundColor: colors.semantic.success },
    botaoAprovarTexto: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.sm },
    botaoDesabilitado: { opacity: 0.5 },
    erroAtrib: { color: colors.semantic.error, fontSize: typography.size.xs, marginTop: spacing['2'] },
  });
}
