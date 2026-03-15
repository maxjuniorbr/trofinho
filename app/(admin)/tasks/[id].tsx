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
import { RefreshCw, Camera } from 'lucide-react-native';
import {
  getTaskWithAssignments,
  type TaskDetail,
  type AssignmentWithChild,
} from '@lib/tasks';
import { getAssignmentStatusColor, getAssignmentStatusLabel } from '@/constants/status';
import { useAssignmentActions } from '@/hooks/use-assignment-actions';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

type AssignmentCardProps = Readonly<{
  assignment: AssignmentWithChild;
  action: 'rejecting' | 'processing' | null;
  note: string;
  assignmentError: string;
  imageState?: 'loading' | 'loaded' | 'error';
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onApprove: () => void;
  onReject: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onNoteChange: (value: string) => void;
  onImageStateChange: (state: 'loading' | 'loaded' | 'error') => void;
}>;

function AssignmentCard({
  assignment,
  action,
  note,
  assignmentError,
  imageState,
  colors,
  styles,
  onApprove,
  onReject,
  onStartReject,
  onCancelReject,
  onNoteChange,
  onImageStateChange,
}: AssignmentCardProps) {
  const processing = action === 'processing';
  const statusColor = getAssignmentStatusColor(assignment.status, colors);
  const isRejecting = action === 'rejecting';
  const evidenceUrl = assignment.evidencia_url ?? undefined;

  return (
    <View style={styles.atribCard}>
      <View style={styles.atribTopo}>
        <Text style={styles.filhoNome}>{assignment.filhos.nome}</Text>
        <View style={[styles.statusTag, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusTexto, { color: statusColor }]}>
            {getAssignmentStatusLabel(assignment.status)}
          </Text>
        </View>
      </View>

      {evidenceUrl && (
        imageState === 'error' ? (
          <View style={[styles.evidenciaImgWrapper, styles.evidenciaFallback, { backgroundColor: colors.bg.muted }]}>
            <Text style={[styles.evidenciaFallbackText, { color: colors.text.muted }]}>Não foi possível carregar a imagem</Text>
          </View>
        ) : (
          <View style={styles.evidenciaImgWrapper}>
            <Image
              source={{ uri: evidenceUrl }}
              style={styles.evidenciaImg}
              resizeMode="cover"
              onLoadStart={() => onImageStateChange('loading')}
              onLoadEnd={() => onImageStateChange('loaded')}
              onError={() => onImageStateChange('error')}
            />
            {imageState !== 'loaded' && (
              <View style={styles.evidenciaLoading}>
                <ActivityIndicator size="small" color={colors.accent.admin} />
              </View>
            )}
          </View>
        )
      )}

      {assignment.nota_rejeicao ? (
        <View style={styles.notaRejeicaoBox}>
          <Text style={styles.notaRejeicaoLabel}>Motivo da rejeição:</Text>
          <Text style={styles.notaRejeicaoTexto}>{assignment.nota_rejeicao}</Text>
        </View>
      ) : null}

      {assignment.status === 'aguardando_validacao' && (
        <View style={styles.acoesBox}>
          {isRejecting ? (
            <>
              <TextInput
                style={styles.inputNota}
                value={note}
                onChangeText={onNoteChange}
                placeholder="Motivo da rejeição (obrigatório)"
                placeholderTextColor={colors.text.muted}
                multiline
              />
              <View style={styles.botoesRejeitar}>
                <Pressable
                  style={[styles.botaoAcao, styles.botaoCancelar]}
                  onPress={onCancelReject}
                  disabled={processing}
                >
                  <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.botaoAcao, styles.botaoRejeitar, processing && styles.botaoDesabilitado]}
                  onPress={onReject}
                  disabled={processing}
                >
                  {processing
                    ? <ActivityIndicator color={colors.text.inverse} size="small" />
                    : <Text style={styles.botaoRejeitarTexto}>Confirmar rejeição</Text>}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.botoesValidar}>
              <Pressable
                style={[styles.botaoAcao, styles.botaoRejeitar, processing && styles.botaoDesabilitado]}
                onPress={onStartReject}
                disabled={processing}
              >
                <Text style={styles.botaoRejeitarTexto}>Rejeitar</Text>
              </Pressable>
              <Pressable
                style={[styles.botaoAcao, styles.botaoAprovar, processing && styles.botaoDesabilitado]}
                onPress={onApprove}
                disabled={processing}
              >
                {processing
                    ? <ActivityIndicator color={colors.text.inverse} size="small" />
                  : <Text style={styles.botaoAprovarTexto}>Aprovar ✓</Text>}
              </Pressable>
            </View>
          )}
          {assignmentError ? <Text style={styles.erroAtrib}>{assignmentError}</Text> : null}
        </View>
      )}
    </View>
  );
}

export default function TaskDetailAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const assignmentActions = useAssignmentActions(loadData);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Detalhes" onBack={() => router.back()} />
        <View style={styles.center}>
          <EmptyState error={error ?? 'Tarefa não encontrada.'} onRetry={loadData} />
        </View>
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
          <View style={styles.metaRow}>
            {task.frequencia === 'diaria' ? (
              <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
            ) : null}
            <Text style={styles.meta}>
              {task.frequencia === 'diaria' ? 'Diária' : 'Única'}
            </Text>
          </View>
          {task.exige_evidencia && (
            <View style={styles.tagEvidencia}>
              <View style={styles.tagEvidenciaRow}>
                <Camera size={12} color={colors.semantic.warningText} strokeWidth={2} />
                <Text style={styles.tagEvidenciaTexto}>Exige foto</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.secaoTitulo}>Atribuições ({task.atribuicoes.length})</Text>

        {task.atribuicoes.length === 0 ? (
          <Text style={styles.semAtrib}>Nenhum filho atribuído.</Text>
        ) : (
          task.atribuicoes.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              action={assignmentActions.getAction(assignment.id)}
              note={assignmentActions.getNote(assignment.id)}
              assignmentError={assignmentActions.getError(assignment.id)}
              imageState={assignmentActions.getImgState(assignment.id)}
              colors={colors}
              styles={styles}
              onApprove={() => assignmentActions.approve(assignment)}
              onReject={() => assignmentActions.reject(assignment)}
              onStartReject={() => assignmentActions.startReject(assignment.id)}
              onCancelReject={() => assignmentActions.cancelReject(assignment.id)}
              onNoteChange={(value) => assignmentActions.changeNote(assignment.id, value)}
              onImageStateChange={(state) => assignmentActions.changeImgState(assignment.id, state)}
            />
          ))
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
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    tagEvidencia: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    tagEvidenciaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    tagEvidenciaTexto: { fontSize: typography.size.xs, color: colors.semantic.warningText, fontFamily: typography.family.semibold },
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
    evidenciaImgWrapper: { width: '100%', height: 200, borderRadius: radii.lg, overflow: 'hidden', marginBottom: spacing['2'] },
    evidenciaImg: { width: '100%', height: 200 },
    evidenciaLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.muted },
    evidenciaFallback: { alignItems: 'center', justifyContent: 'center' },
    evidenciaFallbackText: { fontSize: typography.size.sm, fontFamily: typography.family.medium, textAlign: 'center' },
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
    botaoRejeitarTexto: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoAprovar: { backgroundColor: colors.semantic.success },
    botaoAprovarTexto: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoDesabilitado: { opacity: 0.5 },
    erroAtrib: { color: colors.semantic.error, fontSize: typography.size.xs, marginTop: spacing['2'] },
  });
}
