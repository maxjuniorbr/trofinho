import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Archive,
  ArchiveRestore,
  Camera,
  CheckCircle2,
  Clock,
  MoreVertical,
  Pencil,
  RefreshCw,
  XCircle,
} from 'lucide-react-native';
import {
  buildTaskArchiveMessage,
  formatWeekdays,
  isRecurring,
  type AssignmentWithChild,
} from '@lib/tasks';
import { getAssignmentStatusColor, getAssignmentStatusLabel } from '@lib/status';
import { localizeRpcError } from '@lib/api-error';
import { consumeNavigationFeedback } from '@lib/navigation-feedback';
import { formatDate, toDateString } from '@lib/utils';
import {
  useArchiveTask,
  useTaskAssignments,
  useTaskDetail,
  useUnarchiveTask,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { TaskActionSheet, type TaskActionState } from '@/components/tasks/task-action-sheet';
import { TaskFormSheet } from '@/components/tasks/task-form-sheet';

type DateLine = { label: string; date: string };

const formatValidatedDateLine = (
  label: string,
  assignment: AssignmentWithChild,
): DateLine | null => {
  const date = assignment.validada_em ?? assignment.concluida_em;
  if (!date) return null;
  let formatted = formatDate(date);
  if (assignment.competencia && toDateString(new Date(date)) !== assignment.competencia) {
    formatted += ' · Tarefa de ' + formatDate(assignment.competencia + 'T12:00:00');
  }
  return { label, date: formatted };
};

const getAssignmentDateLine = (assignment: AssignmentWithChild): DateLine | null => {
  switch (assignment.status) {
    case 'pendente': {
      if (!assignment.competencia) {
        return { label: 'Atribuída em ', date: formatDate(assignment.created_at) };
      }
      const today = toDateString(new Date());
      if (assignment.competencia === today) {
        return { label: 'Para ', date: 'hoje' };
      }
      return { label: 'Não realizada em ', date: formatDate(assignment.competencia + 'T12:00:00') };
    }
    case 'aguardando_validacao':
      return assignment.concluida_em
        ? { label: 'Enviada em ', date: formatDate(assignment.concluida_em) }
        : null;
    case 'aprovada':
      return formatValidatedDateLine('Aprovada em ', assignment);
    case 'rejeitada':
      return formatValidatedDateLine('Rejeitada em ', assignment);
  }
};

const getRowStatusLabel = (assignment: AssignmentWithChild): string => {
  if (
    assignment.status === 'pendente' &&
    assignment.competencia !== null &&
    assignment.competencia < toDateString(new Date())
  ) {
    return 'Não executada';
  }
  return getAssignmentStatusLabel(assignment.status);
};

const getRowStatusIcon = (status: AssignmentWithChild['status']) => {
  const map = {
    aprovada: CheckCircle2,
    rejeitada: XCircle,
    pendente: Clock,
    aguardando_validacao: Clock,
  } as const;
  return map[status];
};

type AssignmentRowProps = Readonly<{
  assignment: AssignmentWithChild;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  isLast: boolean;
}>;

const AssignmentRow = ({ assignment, colors, styles, isLast }: AssignmentRowProps) => {
  const dateLine = getAssignmentDateLine(assignment);
  const statusColor = getAssignmentStatusColor(assignment.status, colors);
  const StatusIcon = getRowStatusIcon(assignment.status);

  return (
    <View
      style={[
        styles.atribRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border.subtle,
        },
      ]}
    >
      <View style={[styles.atribRowIcon, { backgroundColor: statusColor + '20' }]}>
        <StatusIcon size={14} color={statusColor} strokeWidth={2} />
      </View>
      <View style={styles.atribRowInfo}>
        <Text style={[styles.atribRowNome, { color: colors.text.primary }]}>
          {assignment.filhos.nome}
        </Text>
        {assignment.nota_rejeicao ? (
          <Text style={[styles.atribRowNota, { color: colors.text.muted }]} numberOfLines={2}>
            {assignment.nota_rejeicao}
          </Text>
        ) : null}
      </View>
      <View style={styles.atribRowRight}>
        <Text style={[styles.atribRowStatus, { color: statusColor }]}>
          {getRowStatusLabel(assignment)}
        </Text>
        {dateLine ? (
          <Text style={[styles.atribRowData, { color: colors.text.muted }]}>{dateLine.date}</Text>
        ) : null}
      </View>
    </View>
  );
};

export default function TaskDetailAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: task, isLoading, error, refetch, isFetching } = useTaskDetail(id);
  const assignmentsQuery = useTaskAssignments(id);
  const archiveMutation = useArchiveTask();
  const unarchiveMutation = useUnarchiveTask();

  const navFeedback = consumeNavigationFeedback('admin-task-detail');
  const visibleUpdated = useTransientMessage(navFeedback?.message ?? null);

  const [feedback, setFeedback] = useState<{ message: string; variant: 'success' | 'warning' | 'error' } | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const visibleFeedback = useTransientMessage(feedback?.message ?? null, { resetKey: feedbackKey });
  const [showAction, setShowAction] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const showFeedback = useCallback(
    (message: string, variant: 'success' | 'warning' | 'error' = 'success') => {
      setFeedback({ message, variant });
      setFeedbackKey((k) => k + 1);
    },
    [],
  );

  const paginated = useMemo(
    () => assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assignmentsQuery.data],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), assignmentsQuery.refetch()]);
  }, [refetch, assignmentsQuery]);

  const handleArchive = useCallback(() => {
    if (!task) return;
    Alert.alert('Arquivar tarefa?', buildTaskArchiveMessage(task.atribuicoes), [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Arquivar',
        style: 'destructive',
        onPress: () =>
          archiveMutation.mutate(task.id, {
            onSuccess: () => {
              showFeedback('Tarefa arquivada.');
              router.back();
            },
            onError: (err) => showFeedback(localizeRpcError(err.message), 'error'),
          }),
      },
    ]);
  }, [task, archiveMutation, showFeedback, router]);

  const handleUnarchive = useCallback(() => {
    if (!task) return;
    unarchiveMutation.mutate(task.id, {
      onSuccess: () => showFeedback('Tarefa desarquivada.'),
      onError: (err) => showFeedback(localizeRpcError(err.message), 'error'),
    });
  }, [task, unarchiveMutation, showFeedback]);

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

  const isArchived = task.arquivada_em !== null;
  const isInactive = task.ativo === false;
  const actionState: TaskActionState = {
    isArchived,
    isInactive,
    hasPendingReview: task.atribuicoes.some((a) => a.status === 'aguardando_validacao'),
    canEdit: !isArchived && !isInactive,
  };

  const renderHistoricoFeedback = () => {
    if (assignmentsQuery.error) {
      return (
        <View style={styles.feedbackWrapper}>
          <InlineMessage
            message={localizeRpcError(assignmentsQuery.error.message)}
            variant="error"
          />
        </View>
      );
    }
    if (paginated.length === 0 && !assignmentsQuery.isLoading) {
      return (
        <Text style={[styles.semHistorico, { color: colors.text.muted }]}>
          Nenhum registro no histórico.
        </Text>
      );
    }
    return null;
  };

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Detalhes"
        onBack={() => router.back()}
        backLabel="Tarefas"
        rightAction={
          <HeaderIconButton
            icon={MoreVertical}
            onPress={() => setShowAction(true)}
            accessibilityLabel="Abrir menu da tarefa"
          />
        }
      />

      <FlashList
        data={paginated}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={(isFetching || assignmentsQuery.isFetching) && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.accent.admin}
          />
        }
        ListHeaderComponent={
          <>
            {visibleFeedback && feedback ? (
              <View style={styles.feedbackWrapper}>
                <InlineMessage message={visibleFeedback} variant={feedback.variant} />
              </View>
            ) : null}

            {visibleUpdated ? (
              <View style={styles.feedbackWrapper}>
                <InlineMessage message={visibleUpdated} variant="success" />
              </View>
            ) : null}

            {isArchived ? (
              <View style={styles.feedbackWrapper}>
                <InlineMessage message="Esta tarefa está arquivada." variant="warning" />
              </View>
            ) : null}

            {!isArchived && isInactive ? (
              <View style={styles.feedbackWrapper}>
                <InlineMessage message="Esta tarefa está pausada." variant="warning" />
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.bg.surface }, shadows.card]}>
              <View style={styles.cardTopo}>
                <Text style={[styles.cardTitulo, { color: colors.text.primary }]}>
                  {task.titulo}
                </Text>
                <View style={[styles.pontosTag, { backgroundColor: colors.accent.adminBg }]}>
                  <Text style={[styles.pontosTexto, { color: colors.accent.admin }]}>
                    {task.pontos} pts
                  </Text>
                </View>
              </View>
              {task.descricao ? (
                <Text style={[styles.descricao, { color: colors.text.secondary }]}>
                  {task.descricao}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                {isRecurring(task.dias_semana) ? (
                  <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
                ) : null}
                <Text style={[styles.meta, { color: colors.text.muted }]}>
                  {formatWeekdays(task.dias_semana)}
                </Text>
              </View>
              {task.exige_evidencia ? (
                <View
                  style={[styles.tagEvidencia, { backgroundColor: colors.semantic.warningBg }]}
                >
                  <Camera size={12} color={colors.semantic.warningText} strokeWidth={2} />
                  <Text
                    style={[styles.tagEvidenciaTexto, { color: colors.semantic.warningText }]}
                  >
                    Exige foto
                  </Text>
                </View>
              ) : null}

              <View style={styles.lifecycleRow}>
                {actionState.canEdit ? (
                  <Pressable
                    style={[styles.lifecycleBtn, { borderColor: colors.border.default }]}
                    onPress={() => setShowEdit(true)}
                  >
                    <Pencil size={14} color={colors.text.primary} strokeWidth={2} />
                    <Text style={[styles.lifecycleBtnText, { color: colors.text.primary }]}>
                      Editar
                    </Text>
                  </Pressable>
                ) : null}
                {isArchived ? (
                  <Pressable
                    style={[styles.lifecycleBtn, { borderColor: colors.border.default }]}
                    onPress={handleUnarchive}
                  >
                    <ArchiveRestore size={14} color={colors.text.primary} strokeWidth={2} />
                    <Text style={[styles.lifecycleBtnText, { color: colors.text.primary }]}>
                      Desarquivar
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.lifecycleBtn, { borderColor: colors.semantic.error }]}
                    onPress={handleArchive}
                  >
                    <Archive size={14} color={colors.semantic.error} strokeWidth={2} />
                    <Text style={[styles.lifecycleBtnText, { color: colors.semantic.error }]}>
                      Arquivar
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={[styles.historicoHeader, { borderBottomColor: colors.border.subtle }]}>
              <Text style={[styles.secaoTitulo, { color: colors.text.primary }]}>Histórico</Text>
            </View>

            {renderHistoricoFeedback()}
          </>
        }
        renderItem={({ item, index }) => (
          <AssignmentRow
            assignment={item}
            colors={colors}
            styles={styles}
            isLast={index === paginated.length - 1}
          />
        )}
        onEndReached={() => {
          if (assignmentsQuery.hasNextPage && !assignmentsQuery.isFetchingNextPage) {
            assignmentsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={assignmentsQuery.isFetchingNextPage} />}
      />

      <TaskFormSheet
        visible={showEdit}
        mode="edit"
        task={task}
        onClose={() => setShowEdit(false)}
        onSuccess={(message) => showFeedback(message)}
      />

      <TaskActionSheet
        visible={showAction}
        taskTitle={task.titulo}
        state={actionState}
        onClose={() => setShowAction(false)}
        onEdit={() => setShowEdit(true)}
        onPause={undefined}
        onResume={undefined}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    feedbackWrapper: { marginBottom: spacing['4'] },
    atribRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['3'],
      gap: spacing['2'],
      backgroundColor: colors.bg.surface,
    },
    atribRowIcon: {
      width: 30,
      height: 30,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    atribRowInfo: { flex: 1 },
    atribRowNome: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    atribRowNota: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    atribRowRight: { alignItems: 'flex-end' },
    atribRowStatus: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    atribRowData: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    card: {
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['5'],
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
      marginRight: spacing['2'],
    },
    pontosTag: {
      borderRadius: radii.md,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
    },
    pontosTexto: { fontSize: typography.size.sm, fontFamily: typography.family.bold },
    descricao: { fontSize: typography.size.sm, marginBottom: spacing['2'], lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    meta: { fontSize: typography.size.xs },
    tagEvidencia: {
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
    },
    tagEvidenciaTexto: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    lifecycleRow: { flexDirection: 'row', gap: spacing['2'], marginTop: spacing['3'] },
    lifecycleBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['1'],
      borderWidth: 1,
      borderRadius: radii.md,
      paddingVertical: spacing['2'],
      minHeight: 40,
    },
    lifecycleBtnText: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    secaoTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    historicoHeader: {
      borderBottomWidth: 1,
      paddingBottom: spacing['3'],
      marginTop: spacing['2'],
      marginBottom: spacing['1'],
    },
    semHistorico: { fontSize: typography.size.sm, fontStyle: 'italic' },
  });
}
