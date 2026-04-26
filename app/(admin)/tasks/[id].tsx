import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Star,
  Calendar,
  PauseCircle,
  PlayCircle,
  Archive,
  Trash2,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Camera,
  Pencil,
} from 'lucide-react-native';
import {
  formatWeekdays,
  deriveTaskState,
  buildTaskDeactivateMessage,
  buildTaskArchiveMessage,
  buildTaskDeleteMessage,
  type AssignmentWithChild,
  type TaskState,
  type AssignmentStatus,
} from '@lib/tasks';
import { getAssignmentStatusLabel, getAssignmentStatusTone } from '@lib/status';
import { localizeRpcError } from '@lib/api-error';
import { consumeNavigationFeedback } from '@lib/navigation-feedback';
import { formatDate } from '@lib/utils';
import { useTaskAssignments, useTaskDetail } from '@/hooks/queries';
import {
  useDeactivateTask,
  useReactivateTask,
  useArchiveTask,
  useUnarchiveTask,
  useDeleteTask,
  useApproveAssignment,
  useRejectAssignment,
} from '@/hooks/queries/use-tasks';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader, HeaderIconButton } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { FullscreenImageViewer } from '@/components/ui/fullscreen-image-viewer';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';
import { TaskFormSheet } from '@/components/tasks/task-form-sheet';

/* ─── Task state helpers ─── */

function getTaskStatusTone(state: TaskState): AssignmentStatus {
  if (state === 'pausada') return 'pendente';
  if (state === 'arquivada') return 'cancelada';
  return 'aprovada';
}

function getTaskStateLabel(state: TaskState): string {
  const labels: Record<TaskState, string> = {
    ativa: 'Ativa',
    pausada: 'Pausada',
    arquivada: 'Arquivada',
    excluida: 'Excluída',
  };
  return labels[state];
}

/* ─── History row status mapping ─── */

const HISTORY_ICON = {
  aprovada: CheckCircle2,
  rejeitada: XCircle,
  aguardando_validacao: Eye,
  pendente: Clock,
  cancelada: Clock,
} as const;

/* ─── History row ─── */

type HistoryRowProps = Readonly<{
  assignment: AssignmentWithChild;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  isLast: boolean;
  onImagePress?: (url: string) => void;
}>;

const getHistoryDate = (a: AssignmentWithChild): string | null => {
  const raw = a.validada_em ?? a.concluida_em ?? a.created_at;
  return raw ? formatDate(raw) : null;
};

function HistoryRow({ assignment, colors, styles, isLast, onImagePress }: HistoryRowProps) {
  const tone = getAssignmentStatusTone(assignment.status, colors);
  const Icon = HISTORY_ICON[assignment.status];
  const date = getHistoryDate(assignment);
  const hasPhoto = !!assignment.evidencia_url;

  return (
    <View
      style={[
        styles.historyRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
      ]}
    >
      {hasPhoto ? (
        <Pressable
          onPress={() => onImagePress?.(assignment.evidencia_url!)}
          style={styles.historyThumbWrap}
          accessibilityRole="button"
          accessibilityLabel="Ver foto"
        >
          <Image source={assignment.evidencia_url!} style={styles.historyThumb} contentFit="cover" />
          <View style={[styles.historyThumbBadge, { backgroundColor: tone.background }]}>
            <Icon size={10} color={tone.foreground} strokeWidth={2.5} />
          </View>
        </Pressable>
      ) : (
        <View style={[styles.historyIcon, { backgroundColor: tone.background }]}>
          <Icon size={14} color={tone.foreground} strokeWidth={2} />
        </View>
      )}
      <View style={styles.historyInfo}>
        <Text style={[styles.historyName, { color: colors.text.primary }]}>
          {assignment.filhos.nome}
        </Text>
        {date ? (
          <Text style={[styles.historyDate, { color: colors.text.muted }]}>{date}</Text>
        ) : null}
      </View>
      <Text style={[styles.historyStatus, { color: tone.foreground }]}>
        {getAssignmentStatusLabel(assignment.status)}
      </Text>
    </View>
  );
}

/* ─── Lifecycle action button ─── */

type ActionButtonProps = Readonly<{
  icon: typeof PauseCircle;
  title: string;
  description: string;
  iconColor: string;
  borderColor?: string;
  bgColor?: string;
  titleColor?: string;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}>;

function ActionButton({
  icon: Icon,
  title,
  description,
  iconColor,
  borderColor,
  bgColor,
  titleColor,
  colors,
  styles,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: bgColor ?? colors.bg.surface,
          borderColor: borderColor ?? colors.border.subtle,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Icon size={20} color={iconColor} strokeWidth={2} />
      <View style={styles.actionBtnText}>
        <Text style={[styles.actionBtnTitle, { color: titleColor ?? colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[styles.actionBtnDesc, { color: colors.text.muted }]}>{description}</Text>
      </View>
    </Pressable>
  );
}

/* ─── Task content (extracted to reduce cognitive complexity) ─── */

type TaskContentProps = Readonly<{
  task: NonNullable<ReturnType<typeof useTaskDetail>['data']>;
  paginated: AssignmentWithChild[];
  assignmentsQuery: ReturnType<typeof useTaskAssignments>;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  visibleUpdated: string | null;
  onImagePress: (url: string) => void;
  onPause: () => void;
  onReactivate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onApprove: (assignmentId: string) => void;
  onReject: (assignmentId: string) => void;
  readonly?: boolean;
}>;

function TaskContent({
  task,
  paginated,
  assignmentsQuery,
  colors,
  styles,
  visibleUpdated,
  onImagePress,
  onPause,
  onReactivate,
  onArchive,
  onDelete,
  onApprove,
  onReject,
  readonly: isReadonly = false,
}: TaskContentProps) {
  const taskState = deriveTaskState(task);
  const isActive = taskState === 'ativa';
  const isPaused = taskState === 'pausada';
  const isArchived = taskState === 'arquivada';

  const pendingValidation = task.atribuicoes.filter((a) => a.status === 'aguardando_validacao');

  const approvedAssignments = paginated.filter((a) => a.status === 'aprovada');
  const approvedCount = approvedAssignments.length;
  const totalPointsEarned = approvedAssignments.reduce((sum, a) => sum + a.pontos_snapshot, 0);
  const hasApproved = approvedCount > 0;

  const proofAssignment = task.atribuicoes.find(
    (a) => a.status === 'aguardando_validacao' && a.evidencia_url,
  );

  return (
    <>
      {/* Feedback banners */}
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

      {!isArchived && isPaused ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage message="Esta tarefa está pausada." variant="warning" />
        </View>
      ) : null}

      {/* ─── Approve/Reject buttons (top priority) ─── */}
      {!isReadonly && pendingValidation.length > 0 ? (
        <View style={styles.reviewSection}>
          {pendingValidation.map((a) => (
            <View key={a.id} style={[styles.reviewActionCard, { borderColor: colors.border.subtle, backgroundColor: colors.bg.surface }]}>
              <Text style={[styles.reviewChildName, { color: colors.text.primary }]} numberOfLines={1}>
                {a.filhos.nome} — aguardando aprovação
              </Text>
              <View style={styles.reviewBtnRow}>
                <Pressable
                  onPress={() => onReject(a.id)}
                  style={({ pressed }) => [styles.reviewBtn, styles.reviewBtnReject, { borderColor: colors.semantic.error }, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Rejeitar entrega de ${a.filhos.nome}`}
                >
                  <X size={16} color={colors.semantic.error} strokeWidth={2.5} />
                  <Text style={[styles.reviewBtnText, { color: colors.semantic.error }]}>Rejeitar</Text>
                </Pressable>
                <Pressable
                  onPress={() => onApprove(a.id)}
                  style={({ pressed }) => [styles.reviewBtn, styles.reviewBtnApprove, { backgroundColor: colors.semantic.success }, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Aprovar entrega de ${a.filhos.nome}`}
                >
                  <Check size={16} color={colors.text.inverse} strokeWidth={2.5} />
                  <Text style={[styles.reviewBtnText, { color: colors.text.inverse }]}>Aprovar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* ─── Main card ─── */}
      <TaskMainCard
        task={task}
        taskState={taskState}
        proofAssignment={proofAssignment}
        colors={colors}
        styles={styles}
        onImagePress={onImagePress}
      />

      {/* ─── Quick stats ─── */}
      {hasApproved ? (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>Aprovações</Text>
            <Text style={[styles.statValue, { color: colors.semantic.success }]}>
              {approvedCount}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>Pontos ganhos</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {totalPointsEarned}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ─── History ─── */}
      {paginated.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={[styles.historyHeading, { color: colors.text.primary }]}>Histórico</Text>
          <View style={[styles.historyCard, { backgroundColor: colors.bg.surface }, shadows.card]}>
            {paginated.map((a, i) => (
              <HistoryRow
                key={a.id}
                assignment={a}
                colors={colors}
                styles={styles}
                isLast={i === paginated.length - 1}
                onImagePress={onImagePress}
              />
            ))}
          </View>
        </View>
      ) : null}

      {paginated.length === 0 && !assignmentsQuery.isLoading ? (
        <Text style={[styles.noHistory, { color: colors.text.muted }]}>
          Nenhum registro no histórico.
        </Text>
      ) : null}

      {assignmentsQuery.error ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage
            message={localizeRpcError(assignmentsQuery.error.message)}
            variant="error"
          />
        </View>
      ) : null}

      <ListFooter loading={assignmentsQuery.isFetchingNextPage} />

      {/* ─── Lifecycle actions ─── */}
      {!isReadonly ? (
        <LifecycleActions
          isActive={isActive}
          isPaused={isPaused}
          isArchived={isArchived}
          colors={colors}
          styles={styles}
          onPause={onPause}
          onReactivate={onReactivate}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ) : null}
    </>
  );
}

/* ─── Main card component ─── */

type TaskMainCardProps = Readonly<{
  task: NonNullable<ReturnType<typeof useTaskDetail>['data']>;
  taskState: TaskState;
  proofAssignment: AssignmentWithChild | undefined;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onImagePress: (url: string) => void;
}>;

function TaskMainCard({ task, taskState, proofAssignment, colors, styles, onImagePress }: TaskMainCardProps) {
  const statusForTone = getTaskStatusTone(taskState);
  const tone = getAssignmentStatusTone(statusForTone, colors);
  const label = getTaskStateLabel(taskState);

  return (
    <View style={[styles.card, { backgroundColor: colors.bg.surface }, shadows.card]}>
      {/* Title + points */}
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{task.titulo}</Text>
        <View style={[styles.pointsBadge, { backgroundColor: colors.accent.adminBg }]}>
          <Star size={14} color={colors.accent.admin} strokeWidth={2} />
          <TaskPointsPill points={task.pontos} size="md" />
        </View>
      </View>

      {/* Status badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: tone.background }]}>
          <Text style={[styles.badgeText, { color: tone.foreground }]}>{label}</Text>
        </View>
        {task.exige_evidencia ? (
          <View style={[styles.badge, { backgroundColor: colors.bg.muted }]}>
            <Camera size={10} color={colors.text.muted} strokeWidth={2.5} />
            <Text style={[styles.badgeText, { color: colors.text.muted }]}>Exige foto</Text>
          </View>
        ) : null}
      </View>

      {/* Recurrence */}
      <View style={styles.recurrenceRow}>
        <Calendar size={14} color={colors.text.muted} strokeWidth={2} />
        <Text style={[styles.recurrenceText, { color: colors.text.muted }]}>
          {formatWeekdays(task.dias_semana)}
        </Text>
      </View>

      {/* Photo proof */}
      {proofAssignment ? (
        <View style={[styles.proofSection, { borderTopColor: colors.border.subtle }]}>
          <View style={styles.proofLabel}>
            <Camera size={12} color={colors.text.muted} strokeWidth={2.5} />
            <Text style={[styles.proofLabelText, { color: colors.text.muted }]}>
              Comprovação enviada
            </Text>
          </View>
          <Pressable
            onPress={() => onImagePress(proofAssignment.evidencia_url!)}
            accessibilityRole="button"
            accessibilityLabel="Ver comprovação em tela cheia"
          >
            <Image
              source={proofAssignment.evidencia_url!}
              style={styles.proofImage}
              contentFit="cover"
            />
          </Pressable>
          {proofAssignment.concluida_em ? (
            <Text style={[styles.proofCaption, { color: colors.text.muted }]}>
              Enviada em {formatDate(proofAssignment.concluida_em)} por{' '}
              {proofAssignment.filhos.nome}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Description */}
      <View style={[styles.descSection, { borderTopColor: colors.border.subtle }]}>
        <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>Descrição</Text>
        {task.descricao ? (
          <Text style={[styles.descText, { color: colors.text.primary }]}>
            {task.descricao}
          </Text>
        ) : (
          <Text style={[styles.descEmpty, { color: colors.text.muted }]}>Sem descrição</Text>
        )}
      </View>
    </View>
  );
}

/* ─── Lifecycle actions component ─── */

type LifecycleActionsProps = Readonly<{
  isActive: boolean;
  isPaused: boolean;
  isArchived: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPause: () => void;
  onReactivate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}>;

function LifecycleActions({
  isActive,
  isPaused,
  isArchived,
  colors,
  styles,
  onPause,
  onReactivate,
  onArchive,
  onDelete,
}: LifecycleActionsProps) {
  return (
    <View style={styles.actionsSection}>
      {isActive ? (
        <ActionButton
          icon={PauseCircle}
          title="Pausar tarefa"
          description="Para de cobrar. Histórico preservado."
          iconColor={colors.semantic.warning}
          colors={colors}
          styles={styles}
          onPress={onPause}
        />
      ) : null}

      {isPaused || isArchived ? (
        <ActionButton
          icon={PlayCircle}
          title="Reativar tarefa"
          description={isArchived ? 'Volta para a lista ativa.' : 'Volta a cobrar normalmente.'}
          iconColor={colors.semantic.success}
          borderColor={colors.semantic.success + '66'}
          bgColor={colors.semantic.successBg}
          colors={colors}
          styles={styles}
          onPress={onReactivate}
        />
      ) : null}

      {(isActive || isPaused) && !isArchived ? (
        <ActionButton
          icon={Archive}
          title="Arquivar"
          description="Remove da lista. Histórico continua."
          iconColor={colors.text.muted}
          colors={colors}
          styles={styles}
          onPress={onArchive}
        />
      ) : null}

      <ActionButton
        icon={Trash2}
        title="Excluir definitivamente"
        description="Não pode ser desfeito."
        iconColor={colors.semantic.error}
        borderColor={colors.semantic.error + '66'}
        bgColor={colors.semantic.errorBg}
        titleColor={colors.semantic.error}
        colors={colors}
        styles={styles}
        onPress={onDelete}
      />
    </View>
  );
}

/* ─── Main screen ─── */

export default function TaskDetailAdminScreen() {
  const { id, readonly: readonlyParam } = useLocalSearchParams<{ id: string; readonly?: string }>();
  const isReadonly = readonlyParam === '1';
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: task, isLoading, error, refetch, isFetching } = useTaskDetail(id);
  const assignmentsQuery = useTaskAssignments(id);

  const deactivateMutation = useDeactivateTask();
  const reactivateMutation = useReactivateTask();
  const archiveMutation = useArchiveTask();
  const unarchiveMutation = useUnarchiveTask();
  const deleteMutation = useDeleteTask();
  const approveMutation = useApproveAssignment();
  const rejectMutation = useRejectAssignment();

  const [editing, setEditing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const navFeedback = consumeNavigationFeedback('admin-task-detail');
  const visibleUpdated = useTransientMessage(navFeedback?.message ?? null);

  const paginated = useMemo(
    () => assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assignmentsQuery.data],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), assignmentsQuery.refetch()]);
  }, [refetch, assignmentsQuery]);

  /* ─── Lifecycle handlers ─── */

  const confirmPause = () => {
    if (!task) return;
    Alert.alert(
      'Pausar tarefa?',
      buildTaskDeactivateMessage(task.atribuicoes),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pausar',
          onPress: () => deactivateMutation.mutate(task.id, { onSuccess: () => refetch() }),
        },
      ],
    );
  };

  const confirmReactivate = () => {
    if (!task) return;
    const state = deriveTaskState(task);
    const isArchived = state === 'arquivada';
    const mutation = isArchived ? unarchiveMutation : reactivateMutation;
    Alert.alert(
      'Reativar tarefa?',
      isArchived ? 'A tarefa volta para a lista ativa.' : 'A tarefa volta a gerar atribuições normalmente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reativar',
          onPress: () => mutation.mutate(task.id, { onSuccess: () => refetch() }),
        },
      ],
    );
  };

  const confirmArchive = () => {
    if (!task) return;
    Alert.alert(
      'Arquivar tarefa?',
      buildTaskArchiveMessage(task.atribuicoes),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          onPress: () => archiveMutation.mutate(task.id, { onSuccess: () => refetch() }),
        },
      ],
    );
  };

  const confirmDelete = () => {
    if (!task) return;
    Alert.alert(
      'Excluir tarefa?',
      buildTaskDeleteMessage(task.atribuicoes),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(task.id, { onSuccess: () => router.back() }),
        },
      ],
    );
  };

  const handleApprove = (assignmentId: string) => {
    if (!task) return;
    const assignment = task.atribuicoes.find((a) => a.id === assignmentId);
    approveMutation.mutate(
      {
        assignmentId,
        opts: {
          familiaId: task.familia_id,
          userId: assignment?.filhos.usuario_id,
          taskTitle: task.titulo,
        },
      },
      { onSuccess: () => refetch() },
    );
  };

  const handleReject = (assignmentId: string) => {
    if (!task) return;
    const assignment = task.atribuicoes.find((a) => a.id === assignmentId);
    Alert.alert('Rejeitar entrega?', 'O filho poderá refazer a tarefa.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rejeitar',
        style: 'destructive',
        onPress: () =>
          rejectMutation.mutate(
            {
              assignmentId,
              note: 'Rejeitada pelo responsável',
              opts: {
                familiaId: task.familia_id,
                userId: assignment?.filhos.usuario_id,
                taskTitle: task.titulo,
              },
            },
            { onSuccess: () => refetch() },
          ),
      },
    ]);
  };

  /* ─── Loading state ─── */

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  /* ─── Error state ─── */

  if (error || !task) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Detalhes da tarefa" onBack={() => router.back()} />
        <View style={styles.center}>
          <EmptyState
            error={error?.message ?? 'Tarefa não encontrada.'}
            onRetry={() => refetch()}
          />
        </View>
      </View>
    );
  }

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Detalhes da tarefa"
        onBack={() => router.back()}
        backLabel="Tarefas"
        rightAction={
          isReadonly ? undefined : (
            <HeaderIconButton
              icon={Pencil}
              onPress={() => setEditing(true)}
              accessibilityLabel="Editar tarefa"
            />
          )
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={(isFetching || assignmentsQuery.isFetching) && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.accent.admin}
          />
        }
      >
        <TaskContent
          task={task}
          paginated={paginated}
          assignmentsQuery={assignmentsQuery}
          colors={colors}
          styles={styles}
          visibleUpdated={visibleUpdated}
          onImagePress={setFullscreenImage}
          onPause={confirmPause}
          onReactivate={confirmReactivate}
          onArchive={confirmArchive}
          onDelete={confirmDelete}
          onApprove={handleApprove}
          onReject={handleReject}
          readonly={isReadonly}
        />
      </ScrollView>

      {/* Edit bottom sheet — hidden in readonly mode */}
      {!isReadonly ? (
        <TaskFormSheet
          visible={editing}
          mode="edit"
          task={task}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            refetch();
          }}
        />
      ) : null}

      {/* Fullscreen image viewer */}
      {fullscreenImage ? (
        <FullscreenImageViewer
          visible
          imageUrl={fullscreenImage}
          onClose={() => setFullscreenImage(null)}
        />
      ) : null}
    </SafeScreenFrame>
  );
}

/* ─── Styles ─── */

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    feedbackWrapper: { marginBottom: spacing['4'] },
    reviewSection: { gap: spacing['2'], marginBottom: spacing['4'] },

    /* Main card */
    card: {
      borderRadius: radii.xl,
      padding: spacing['5'],
      marginBottom: spacing['4'],
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing['3'],
      marginBottom: spacing['3'],
    },
    cardTitle: {
      flex: 1,
      fontSize: typography.size.lg,
      fontFamily: typography.family.extrabold,
      lineHeight: typography.lineHeight.lg,
    },
    pointsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
      flexWrap: 'wrap',
      marginBottom: spacing['3'],
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.sm,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    badgeText: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.extrabold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    recurrenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
    },
    recurrenceText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },

    /* Photo proof */
    proofSection: {
      marginTop: spacing['3'],
      paddingTop: spacing['3'],
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    proofLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['2'],
    },
    proofLabelText: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    proofImage: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: radii.lg,
    },
    proofCaption: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.semibold,
      marginTop: spacing['1.5'],
    },

    /* Description */
    descSection: {
      marginTop: spacing['3'],
      paddingTop: spacing['3'],
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    sectionLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing['1'],
    },
    descText: {
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    descEmpty: {
      fontSize: typography.size.sm,
      fontStyle: 'italic',
    },

    /* Quick stats */
    statsGrid: {
      flexDirection: 'row',
      gap: spacing['3'],
      marginBottom: spacing['4'],
    },
    statCard: {
      flex: 1,
      borderRadius: radii.lg,
      padding: spacing['3'],
      borderWidth: StyleSheet.hairlineWidth,
    },
    statLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: typography.size.xl,
      fontFamily: typography.family.extrabold,
      marginTop: spacing['0.5'],
    },

    /* History */
    historySection: { marginBottom: spacing['4'] },
    historyHeading: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
      marginBottom: spacing['2'],
    },
    historyCard: {
      borderRadius: radii.xl,
      overflow: 'hidden',
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['3'],
    },
    historyIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyThumbWrap: {
      width: 40,
      height: 40,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    historyThumb: {
      width: 40,
      height: 40,
    },
    historyThumbBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 16,
      height: 16,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bg.surface,
    },
    historyInfo: { flex: 1, minWidth: 0 },
    historyName: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
    },
    historyDate: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.semibold,
    },
    historyStatus: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.extrabold,
    },
    noHistory: {
      fontSize: typography.size.sm,
      fontStyle: 'italic',
      marginBottom: spacing['4'],
    },

    /* Lifecycle actions */
    actionsSection: {
      gap: spacing['2'],
      marginTop: spacing['2'],
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      padding: spacing['3'],
      borderRadius: radii.lg,
      borderWidth: 1,
    },
    actionBtnText: { flex: 1 },
    actionBtnTitle: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
    },
    actionBtnDesc: {
      fontSize: typography.size.xxs,
    },
    reviewActionCard: {
      borderRadius: radii.lg,
      borderWidth: 1,
      padding: spacing['3'],
      gap: spacing['2'],
    },
    reviewChildName: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
    },
    reviewBtnRow: {
      flexDirection: 'row',
      gap: spacing['2'],
    },
    reviewBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['1'],
      paddingVertical: spacing['2'],
      borderRadius: radii.md,
    },
    reviewBtnReject: {
      borderWidth: 1,
    },
    reviewBtnApprove: {},
    reviewBtnText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
    },
  });
}
