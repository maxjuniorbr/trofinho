import {
  Alert,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, Camera, Pencil } from 'lucide-react-native';
import { getTaskEditState, buildTaskDeactivateMessage, type AssignmentWithChild } from '@lib/tasks';
import { getAssignmentStatusColor, getAssignmentStatusLabel } from '@lib/status';
import { consumeNavigationFeedback } from '@lib/navigation-feedback';
import { formatDate, toDateString } from '@lib/utils';
import {
  useTaskDetail,
  useApproveAssignment,
  useRejectAssignment,
  useDeactivateTask,
  useReactivateTask,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { FullscreenImageViewer } from '@/components/ui/fullscreen-image-viewer';
import { getSafeBottomPadding } from '@lib/safe-area';

type DateLine = { label: string; date: string };

function getAssignmentDateLine(assignment: AssignmentWithChild): DateLine | null {
  switch (assignment.status) {
    case 'pendente': {
      if (!assignment.competencia) {
        return { label: 'Atribuída em ', date: formatDate(assignment.created_at) };
      }
      const today = toDateString(new Date());
      if (assignment.competencia === today) {
        return { label: 'Para ', date: 'hoje' };
      }
      // Append T12:00:00 so the date-only string parses as local noon, not UTC midnight
      return { label: 'Não realizada em ', date: formatDate(assignment.competencia + 'T12:00:00') };
    }
    case 'aguardando_validacao':
      return assignment.concluida_em
        ? { label: 'Enviada em ', date: formatDate(assignment.concluida_em) }
        : null;
    case 'aprovada': {
      const date = assignment.validada_em ?? assignment.concluida_em;
      return date ? { label: 'Aprovada em ', date: formatDate(date) } : null;
    }
    case 'rejeitada': {
      const date = assignment.validada_em ?? assignment.concluida_em;
      return date ? { label: 'Rejeitada em ', date: formatDate(date) } : null;
    }
  }
}

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
  onImagePress: (url: string) => void;
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
  onImagePress,
}: AssignmentCardProps) {
  const processing = action === 'processing';
  const statusColor = getAssignmentStatusColor(assignment.status, colors);
  const isRejecting = action === 'rejecting';
  const evidenceUrl = assignment.evidencia_url ?? undefined;
  const dateLine = getAssignmentDateLine(assignment);

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
      {dateLine ? (
        <Text style={styles.dataLinha}>
          {dateLine.label}
          {dateLine.date}
        </Text>
      ) : null}

      {evidenceUrl &&
        (imageState === 'error' ? (
          <View
            style={[
              styles.evidenciaImgWrapper,
              styles.evidenciaFallback,
              { backgroundColor: colors.bg.muted },
            ]}
          >
            <Text style={[styles.evidenciaFallbackText, { color: colors.text.muted }]}>
              Não foi possível carregar a imagem
            </Text>
          </View>
        ) : (
          <Pressable
            style={styles.evidenciaImgWrapper}
            onPress={() => onImagePress(evidenceUrl)}
            accessibilityRole="button"
            accessibilityLabel="Ver foto em tela cheia"
          >
            <Image
              source={evidenceUrl}
              style={styles.evidenciaImg}
              contentFit="cover"
              transition={200}
              onLoadStart={() => onImageStateChange('loading')}
              onLoad={() => onImageStateChange('loaded')}
              onError={() => onImageStateChange('error')}
            />
            {imageState !== 'loaded' && (
              <View style={styles.evidenciaLoading}>
                <ActivityIndicator size="small" color={colors.accent.admin} />
              </View>
            )}
          </Pressable>
        ))}

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
                maxLength={500}
                accessibilityLabel="Motivo da rejeição"
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
                  style={[
                    styles.botaoAcao,
                    styles.botaoRejeitar,
                    processing && styles.botaoDesabilitado,
                  ]}
                  onPress={() => {
                    Alert.alert(
                      'Rejeitar tarefa?',
                      'A tarefa será rejeitada e o filho será notificado.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Rejeitar', style: 'destructive', onPress: onReject },
                      ],
                    );
                  }}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color={colors.text.inverse} size="small" />
                  ) : (
                    <Text style={styles.botaoRejeitarTexto}>Confirmar rejeição</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.botoesValidar}>
              <Pressable
                style={[
                  styles.botaoAcao,
                  styles.botaoRejeitar,
                  processing && styles.botaoDesabilitado,
                ]}
                onPress={onStartReject}
                disabled={processing}
              >
                <Text style={styles.botaoRejeitarTexto}>Rejeitar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.botaoAcao,
                  styles.botaoAprovar,
                  processing && styles.botaoDesabilitado,
                ]}
                onPress={onApprove}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color={colors.text.inverse} size="small" />
                ) : (
                  <Text style={styles.botaoAprovarTexto}>Aprovar ✓</Text>
                )}
              </Pressable>
            </View>
          )}
          {assignmentError ? (
            <View style={styles.erroAtribWrapper}>
              <InlineMessage message={assignmentError} variant="error" />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function TaskDetailAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: task, isLoading, error, refetch } = useTaskDetail(id);
  const approveMutation = useApproveAssignment();
  const rejectMutation = useRejectAssignment();
  const deactivateMutation = useDeactivateTask();
  const reactivateMutation = useReactivateTask();

  const navFeedback = consumeNavigationFeedback('admin-task-detail');
  const visibleUpdatedMessage = useTransientMessage(navFeedback?.message ?? null);
  const [actions, setActions] = useState<Record<string, 'rejecting' | 'processing' | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imgStates, setImgStates] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackVariant, setFeedbackVariant] = useState<'success' | 'warning'>('success');
  const [feedbackKey, setFeedbackKey] = useState(0);
  const visibleFeedback = useTransientMessage(feedbackMessage, { resetKey: feedbackKey });
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);

  const getAction = useCallback((assignmentId: string) => actions[assignmentId] ?? null, [actions]);
  const getNote = useCallback((assignmentId: string) => notes[assignmentId] ?? '', [notes]);
  const getError = useCallback((assignmentId: string) => errors[assignmentId] ?? '', [errors]);
  const getImgState = useCallback((assignmentId: string) => imgStates[assignmentId], [imgStates]);

  const handleApprove = useCallback(
    (assignment: AssignmentWithChild) => {
      setActions((prev) => ({ ...prev, [assignment.id]: 'processing' }));
      setErrors((prev) => ({ ...prev, [assignment.id]: '' }));

      approveMutation.mutate(
        {
          assignmentId: assignment.id,
          opts: {
            familiaId: task!.familia_id,
            userId: assignment.filhos.usuario_id,
            taskTitle: task!.titulo,
          },
        },
        {
          onSuccess: () => {
            setActions((prev) => ({ ...prev, [assignment.id]: null }));
          },
          onError: (err) => {
            setErrors((prev) => ({ ...prev, [assignment.id]: err.message }));
            setActions((prev) => ({ ...prev, [assignment.id]: null }));
          },
        },
      );
    },
    [approveMutation, task],
  );

  const handleReject = useCallback(
    (assignment: AssignmentWithChild) => {
      const note = notes[assignment.id] ?? '';
      if (!note.trim()) {
        setErrors((prev) => ({ ...prev, [assignment.id]: 'Informe o motivo da rejeição.' }));
        return;
      }

      setActions((prev) => ({ ...prev, [assignment.id]: 'processing' }));
      setErrors((prev) => ({ ...prev, [assignment.id]: '' }));

      rejectMutation.mutate(
        {
          assignmentId: assignment.id,
          note: note.trim(),
          opts: {
            familiaId: task!.familia_id,
            userId: assignment.filhos.usuario_id,
            taskTitle: task!.titulo,
          },
        },
        {
          onSuccess: () => {
            setActions((prev) => ({ ...prev, [assignment.id]: null }));
            setNotes((prev) => ({ ...prev, [assignment.id]: '' }));
          },
          onError: (err) => {
            setErrors((prev) => ({ ...prev, [assignment.id]: err.message }));
            setActions((prev) => ({ ...prev, [assignment.id]: null }));
          },
        },
      );
    },
    [notes, rejectMutation, task],
  );

  const executeDeactivate = useCallback(() => {
    if (!task) return;
    deactivateMutation.mutate(task.id, {
      onSuccess: (data) => {
        const count = data?.pendingValidationCount ?? 0;
        if (count > 0) {
          setFeedbackMessage(`Tarefa desativada. ${count} atribuições ainda aguardam validação.`);
          setFeedbackVariant('warning');
        } else {
          setFeedbackMessage('Tarefa desativada com sucesso.');
          setFeedbackVariant('success');
        }
        setFeedbackKey((k) => k + 1);
      },
      onError: (err) => {
        setFeedbackMessage(err.message);
        setFeedbackVariant('warning');
        setFeedbackKey((k) => k + 1);
      },
    });
  }, [task, deactivateMutation]);

  const handleDeactivate = useCallback(() => {
    if (!task) return;
    const message = buildTaskDeactivateMessage(task, task.atribuicoes);
    Alert.alert('Desativar tarefa?', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: executeDeactivate },
    ]);
  }, [task, executeDeactivate]);

  const executeReactivate = useCallback(() => {
    if (!task) return;
    reactivateMutation.mutate(task.id, {
      onSuccess: () => {
        setFeedbackMessage('Tarefa reativada com sucesso.');
        setFeedbackVariant('success');
        setFeedbackKey((k) => k + 1);
      },
      onError: (err) => {
        setFeedbackMessage(err.message);
        setFeedbackVariant('warning');
        setFeedbackKey((k) => k + 1);
      },
    });
  }, [task, reactivateMutation]);

  const handleReactivate = useCallback(() => {
    if (!task) return;
    Alert.alert(
      'Reativar tarefa?',
      'A tarefa voltará a aparecer para os filhos e gerar atribuições diárias (se aplicável).',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reativar', onPress: executeReactivate },
      ],
    );
  }, [task, executeReactivate]);

  if (isLoading) {
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
          <EmptyState
            error={error?.message ?? 'Tarefa não encontrada.'}
            onRetry={() => refetch()}
          />
        </View>
      </View>
    );
  }

  const editState = getTaskEditState(task);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Detalhes"
        onBack={() => router.back()}
        backLabel="Tarefas"
        rightAction={
          editState.canEdit ? (
            <HeaderIconButton
              icon={Pencil}
              onPress={() => router.push(`/(admin)/tasks/${task.id}/edit` as never)}
              accessibilityLabel="Editar tarefa"
            />
          ) : undefined
        }
      />

      <ScrollView
        overScrollMode="never"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: getSafeBottomPadding(insets, spacing['12']) },
        ]}
      >
        {visibleFeedback ? (
          <View style={styles.feedbackWrapper}>
            <InlineMessage message={visibleFeedback} variant={feedbackVariant} />
          </View>
        ) : null}

        {visibleUpdatedMessage ? (
          <View style={styles.feedbackWrapper}>
            <InlineMessage message={visibleUpdatedMessage} variant="success" />
          </View>
        ) : null}

        {!task.ativo && (
          <View style={styles.deactivatedSection}>
            <InlineMessage message="Esta tarefa está desativada." variant="warning" />
            <Button
              variant="outline"
              label="Reativar tarefa"
              onPress={handleReactivate}
              loading={reactivateMutation.isPending}
              loadingLabel="Reativando…"
              accessibilityLabel="Reativar tarefa"
            />
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardTopo}>
            <Text style={styles.cardTitulo}>{task.titulo}</Text>
            <View style={styles.pontosTag}>
              <Text style={styles.pontosTexto}>{task.pontos} pts</Text>
            </View>
          </View>
          {task.descricao ? <Text style={styles.descricao}>{task.descricao}</Text> : null}
          <View style={styles.metaRow}>
            {task.frequencia === 'diaria' ? (
              <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
            ) : null}
            <Text style={styles.meta}>{task.frequencia === 'diaria' ? 'Diária' : 'Única'}</Text>
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
              action={getAction(assignment.id)}
              note={getNote(assignment.id)}
              assignmentError={getError(assignment.id)}
              imageState={getImgState(assignment.id)}
              colors={colors}
              styles={styles}
              onApprove={() => handleApprove(assignment)}
              onReject={() => handleReject(assignment)}
              onStartReject={() =>
                setActions((prev) => ({ ...prev, [assignment.id]: 'rejecting' }))
              }
              onCancelReject={() => setActions((prev) => ({ ...prev, [assignment.id]: null }))}
              onNoteChange={(value) => setNotes((prev) => ({ ...prev, [assignment.id]: value }))}
              onImageStateChange={(state) =>
                setImgStates((prev) => ({ ...prev, [assignment.id]: state }))
              }
              onImagePress={(url) => setFullscreenImageUrl(url)}
            />
          ))
        )}

        {task.ativo && (
          <View style={styles.deactivateSection}>
            <Button
              variant="danger"
              label="Desativar tarefa"
              onPress={handleDeactivate}
              loading={deactivateMutation.isPending}
              loadingLabel="Desativando…"
              accessibilityLabel="Desativar tarefa"
            />
          </View>
        )}
      </ScrollView>

      {fullscreenImageUrl ? (
        <FullscreenImageViewer
          visible
          imageUrl={fullscreenImageUrl}
          onClose={() => setFullscreenImageUrl(null)}
        />
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    feedbackWrapper: {
      marginBottom: spacing['4'],
    },
    deactivatedSection: {
      gap: spacing['3'],
      marginBottom: spacing['4'],
    },
    deactivateSection: {
      marginTop: spacing['2'],
    },
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
    cardTitulo: {
      flex: 1,
      fontSize: typography.size.lg,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
      marginRight: spacing['2'],
    },
    pontosTag: {
      backgroundColor: colors.accent.adminBg,
      borderRadius: radii.md,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
    },
    pontosTexto: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
      color: colors.accent.admin,
    },
    descricao: {
      fontSize: typography.size.sm,
      color: colors.text.secondary,
      marginBottom: spacing['2'],
      lineHeight: 20,
    },
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
    tagEvidenciaTexto: {
      fontSize: typography.size.xs,
      color: colors.semantic.warningText,
      fontFamily: typography.family.semibold,
    },
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
    atribTopo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['2'],
    },
    filhoNome: {
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
    },
    statusTag: {
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
    },
    statusTexto: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    dataLinha: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      marginBottom: spacing['2'],
    },
    evidenciaImgWrapper: {
      width: '100%',
      height: 200,
      borderRadius: radii.lg,
      overflow: 'hidden',
      marginBottom: spacing['2'],
    },
    evidenciaImg: { width: '100%', height: 200 },
    evidenciaLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg.muted,
    },
    evidenciaFallback: { alignItems: 'center', justifyContent: 'center' },
    evidenciaFallbackText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.medium,
      textAlign: 'center',
    },
    notaRejeicaoBox: {
      backgroundColor: colors.semantic.errorBg,
      borderRadius: radii.md,
      padding: spacing['3'],
      marginBottom: spacing['2'],
    },
    notaRejeicaoLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
      color: colors.semantic.error,
      marginBottom: spacing['1'],
    },
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
    botaoAcao: {
      flex: 1,
      borderRadius: radii.md,
      paddingVertical: spacing['2'],
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    botaoCancelar: { borderWidth: 1, borderColor: colors.border.default },
    botaoCancelarTexto: {
      color: colors.text.secondary,
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
    },
    botaoRejeitar: { backgroundColor: colors.semantic.error },
    botaoRejeitarTexto: {
      color: colors.text.inverse,
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
    },
    botaoAprovar: { backgroundColor: colors.semantic.success },
    botaoAprovarTexto: {
      color: colors.text.inverse,
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
    },
    botaoDesabilitado: { opacity: 0.5 },
    erroAtribWrapper: { marginTop: spacing['2'] },
  });
}
