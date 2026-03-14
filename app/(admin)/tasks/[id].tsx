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
  getTaskWithAssignments,
  approveAssignment,
  rejectAssignment,
  getStatusLabel,
  getStatusColor,
  type TaskDetail,
  type AssignmentWithChild,
} from '@lib/tasks';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function TaskDetailAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignmentActions, setAssignmentActions] = useState<
    Record<string, 'rejecting' | 'processing' | null>
  >({});
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [assignmentErrors, setAssignmentErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await getTaskWithAssignments(id);
      if (error) setError(error);
      else setTask(data);
    } catch {
      setError('Não foi possível carregar a tarefa agora.');
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleApprove(assignment: AssignmentWithChild) {
    setAssignmentActions((prev) => ({ ...prev, [assignment.id]: 'processing' }));
    setAssignmentErrors((prev) => ({ ...prev, [assignment.id]: '' }));
    const { error } = await approveAssignment(assignment.id);
    if (error) {
      setAssignmentErrors((prev) => ({ ...prev, [assignment.id]: error }));
      setAssignmentActions((prev) => ({ ...prev, [assignment.id]: null }));
    } else {
      await loadData();
      setAssignmentActions((prev) => ({ ...prev, [assignment.id]: null }));
    }
  }

  async function handleReject(assignment: AssignmentWithChild) {
    const note = rejectionNotes[assignment.id] ?? '';
    if (!note.trim()) {
      setAssignmentErrors((prev) => ({ ...prev, [assignment.id]: 'Informe o motivo da rejeição.' }));
      return;
    }
    setAssignmentActions((prev) => ({ ...prev, [assignment.id]: 'processing' }));
    setAssignmentErrors((prev) => ({ ...prev, [assignment.id]: '' }));
    const { error } = await rejectAssignment(assignment.id, note.trim());
    if (error) {
      setAssignmentErrors((prev) => ({ ...prev, [assignment.id]: error }));
      setAssignmentActions((prev) => ({ ...prev, [assignment.id]: null }));
    } else {
      await loadData();
      setAssignmentActions((prev) => ({ ...prev, [assignment.id]: null }));
      setRejectionNotes((prev) => ({ ...prev, [assignment.id]: '' }));
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Detalhes" onBack={() => router.back()} />
        <EmptyState error={error ?? 'Tarefa não encontrada.'} onRetry={loadData} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Detalhes" onBack={() => router.back()} backLabel="Tarefas" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardTopo}>
            <Text style={styles.cardTitulo}>{task.titulo}</Text>
            <View style={styles.pontosTag}>
              <Text style={styles.pontosTexto}>{task.pontos} pts</Text>
            </View>
          </View>
          {task.descricao ? (
            <Text style={styles.descricao}>{task.descricao}</Text>
          ) : null}
          <Text style={styles.meta}>
            {task.timebox_inicio}
            {' \u2192 '}
            {task.timebox_fim}
          </Text>
          {task.exige_evidencia && (
            <View style={styles.tagEvidencia}>
              <Text style={styles.tagEvidenciaTexto}>📷 Exige foto</Text>
            </View>
          )}
        </View>

        <Text style={styles.secaoTitulo}>Atribuições ({task.atribuicoes.length})</Text>

        {task.atribuicoes.length === 0 ? (
          <Text style={styles.semAtrib}>Nenhum filho atribuído.</Text>
        ) : (
          task.atribuicoes.map((assignment) => {
            const action = assignmentActions[assignment.id] ?? null;
            const note = rejectionNotes[assignment.id] ?? '';
            const assignmentError = assignmentErrors[assignment.id] ?? '';
            const processing = action === 'processing';

            return (
              <View key={assignment.id} style={styles.atribCard}>
                <View style={styles.atribTopo}>
                  <Text style={styles.filhoNome}>{assignment.filhos.nome}</Text>
                  <View style={[styles.statusTag, { backgroundColor: getStatusColor(assignment.status) + '20' }]}>
                    <Text style={[styles.statusTexto, { color: getStatusColor(assignment.status) }]}>
                      {getStatusLabel(assignment.status)}
                    </Text>
                  </View>
                </View>

                {assignment.evidencia_url ? (
                  <Image
                    source={{ uri: assignment.evidencia_url }}
                    style={styles.evidenciaImg}
                    resizeMode="cover"
                  />
                ) : null}

                {assignment.nota_rejeicao ? (
                  <View style={styles.notaRejeicaoBox}>
                    <Text style={styles.notaRejeicaoLabel}>Motivo da rejeição:</Text>
                    <Text style={styles.notaRejeicaoTexto}>{assignment.nota_rejeicao}</Text>
                  </View>
                ) : null}

                {assignment.status === 'aguardando_validacao' && (
                  <View style={styles.acoesBox}>
                    {action === 'rejecting' ? (
                      <>
                        <TextInput
                          style={styles.inputNota}
                          value={note}
                          onChangeText={(t) => setRejectionNotes((prev) => ({ ...prev, [assignment.id]: t }))}
                          placeholder="Motivo da rejeição (obrigatório)"
                          placeholderTextColor={colors.text.muted}
                          multiline
                        />
                        <View style={styles.botoesRejeitar}>
                          <Pressable
                            style={[styles.botaoAcao, styles.botaoCancelar]}
                            onPress={() => setAssignmentActions((prev) => ({ ...prev, [assignment.id]: null }))}
                            disabled={processing}
                          >
                            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.botaoAcao, styles.botaoRejeitar, processing && styles.botaoDesabilitado]}
                            onPress={() => handleReject(assignment)}
                            disabled={processing}
                          >
                            {processing
                              ? <ActivityIndicator color="#fff" size="small" />
                              : <Text style={styles.botaoRejeitarTexto}>Confirmar rejeição</Text>}
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <View style={styles.botoesValidar}>
                        <Pressable
                          style={[styles.botaoAcao, styles.botaoRejeitar, processing && styles.botaoDesabilitado]}
                          onPress={() => setAssignmentActions((prev) => ({ ...prev, [assignment.id]: 'rejecting' }))}
                          disabled={processing}
                        >
                          <Text style={styles.botaoRejeitarTexto}>Rejeitar</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.botaoAcao, styles.botaoAprovar, processing && styles.botaoDesabilitado]}
                          onPress={() => handleApprove(assignment)}
                          disabled={processing}
                        >
                          {processing
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.botaoAprovarTexto}>Aprovar ✓</Text>}
                        </Pressable>
                      </View>
                    )}
                    {assignmentError ? <Text style={styles.erroAtrib}>{assignmentError}</Text> : null}
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
      ...shadows.card,
    },
    cardTopo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing['2'],
    },
    cardTitulo: { flex: 1, fontSize: typography.size.lg, fontFamily: typography.family.bold, color: colors.text.primary, marginRight: spacing['2'] },
    pontosTag: { backgroundColor: colors.accent.adminBg, borderRadius: radii.md, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'] },
    pontosTexto: { fontSize: typography.size.sm, fontFamily: typography.family.bold, color: colors.accent.admin },
    descricao: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing['2'], lineHeight: 20 },
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    tagEvidencia: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    tagEvidenciaTexto: { fontSize: typography.size.xs, color: colors.semantic.warning, fontFamily: typography.family.semibold },
    secaoTitulo: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
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
      ...shadows.card,
    },
    atribTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] },
    filhoNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: colors.text.primary },
    statusTag: { borderRadius: radii.sm, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'] },
    statusTexto: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    evidenciaImg: { width: '100%', height: 200, borderRadius: radii.lg, marginBottom: spacing['2'] },
    notaRejeicaoBox: {
      backgroundColor: colors.semantic.errorBg,
      borderRadius: radii.md,
      padding: spacing['3'],
      marginBottom: spacing['2'],
    },
    notaRejeicaoLabel: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.semantic.error, marginBottom: spacing['1'] },
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
    botaoAcao: { flex: 1, borderRadius: radii.md, paddingVertical: spacing['2'], alignItems: 'center', minHeight: 44, justifyContent: 'center' },
    botaoCancelar: { borderWidth: 1, borderColor: colors.border.default },
    botaoCancelarTexto: { color: colors.text.secondary, fontFamily: typography.family.semibold, fontSize: typography.size.sm },
    botaoRejeitar: { backgroundColor: colors.semantic.error },
    botaoRejeitarTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoAprovar: { backgroundColor: colors.semantic.success },
    botaoAprovarTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoDesabilitado: { opacity: 0.5 },
    erroAtrib: { color: colors.semantic.error, fontSize: typography.size.xs, marginTop: spacing['2'] },
  });
}
