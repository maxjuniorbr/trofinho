import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Archive,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  MoreVertical,
  PauseCircle,
  Plus,
  Star,
} from 'lucide-react-native';
import { EmptyState } from '@/components/ui/empty-state';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ScreenHeader, HeaderIconButton } from '@/components/ui/screen-header';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { SegmentedBar, type SegmentOption } from '@/components/ui/segmented-bar';
import { ReviewStack } from '@/components/tasks/review-stack';
import { TaskActionSheet, type TaskActionState } from '@/components/tasks/task-action-sheet';
import { TaskFormSheet } from '@/components/tasks/task-form-sheet';
import { useAdminFooterItems } from '@/hooks/use-footer-items';
import {
  useAdminTasks,
  useApprovedAssignmentsFeed,
  useArchiveTask,
  useArchivedTasks,
  useDeactivateTask,
  useDeleteTask,
  usePendingValidations,
  useReactivateTask,
  useTaskDetail,
  useUnarchiveTask,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import {
  buildTaskArchiveMessage,
  buildTaskDeleteMessage,
  buildTaskPauseMessage,
  formatWeekdays,
  type ApprovedAssignmentFeedItem,
  type TaskListItem,
} from '@lib/tasks';
import { localizeRpcError } from '@lib/api-error';
import { consumeNavigationFeedback, type NavigationFeedback } from '@lib/navigation-feedback';
import { formatDate } from '@lib/utils';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography, withAlpha } from '@/constants/theme';

type TabKey = 'ativas' | 'feitas' | 'arquivo';

type TaskCardProps = Readonly<{
  icon: { Icon: typeof Clock; color: string; bg: string };
  showDot?: boolean;
  title: string;
  titleStyle?: { color: string; textDecorationLine?: 'line-through' };
  subtitle?: string | null;
  points: number;
  pointsPrefix?: string;
  badges: { label: string; color: string; bg: string }[];
  hasPhoto?: boolean;
  trailingText?: string | null;
  trailingAction?: React.ReactNode;
  opacity?: number;
  borderColor?: string;
  onPress?: () => void;
  accessibilityLabel: string;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

function TaskCard({
  icon,
  showDot,
  title,
  titleStyle,
  subtitle,
  points,
  pointsPrefix = '',
  badges,
  hasPhoto,
  trailingText,
  trailingAction,
  opacity = 1,
  borderColor,
  onPress,
  accessibilityLabel,
  colors,
  styles,
}: TaskCardProps) {
  const Wrapper = onPress ? Pressable : View;
  const wrapperProps = onPress
    ? {
      style: ({ pressed }: { pressed: boolean }) => [
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.bg.surface,
          borderColor: borderColor ?? colors.border.subtle,
          opacity: pressed ? 0.92 : opacity,
        },
      ],
      onPress,
      accessibilityRole: 'button' as const,
      accessibilityLabel,
    }
    : {
      style: [
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.bg.surface,
          borderColor: borderColor ?? colors.border.subtle,
          opacity,
        },
      ],
      accessibilityLabel,
    };

  return (
    <Wrapper {...(wrapperProps as any)}>
      <View style={styles.cardTopRow}>
        <View style={[styles.cardIcon, { backgroundColor: icon.bg }]}>
          <icon.Icon size={16} color={icon.color} strokeWidth={2} />
          {showDot ? (
            <View style={[styles.cardDot, { backgroundColor: colors.semantic.info, borderColor: colors.bg.surface }]} />
          ) : null}
        </View>
        <View style={styles.cardInfo}>
          <Text
            style={[styles.cardTitle, { color: titleStyle?.color ?? colors.text.primary }, titleStyle?.textDecorationLine ? { textDecorationLine: titleStyle.textDecorationLine } : null]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.cardSub, { color: colors.text.muted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.cardPointsBadge, { backgroundColor: colors.accent.adminBg }]}>
          <Star size={12} color={colors.accent.admin} strokeWidth={2} />
          <Text style={[styles.cardPointsText, { color: colors.accent.admin }]}>
            {pointsPrefix}{points}
          </Text>
        </View>
      </View>
      <View style={styles.cardBottomRow}>
        <View style={styles.cardBadges}>
          {badges.map((b) => (
            <View key={b.label} style={[styles.cardBadge, { backgroundColor: b.bg }]}>
              <Text style={[styles.cardBadgeText, { color: b.color }]}>{b.label}</Text>
            </View>
          ))}
          {hasPhoto ? (
            <View style={[styles.cardBadge, { backgroundColor: colors.bg.muted }]}>
              <Camera size={10} color={colors.text.muted} strokeWidth={2} />
              <Text style={[styles.cardBadgeText, { color: colors.text.muted }]}>Foto</Text>
            </View>
          ) : null}
          {trailingText ? (
            <Text style={[styles.cardTrailing, { color: colors.text.muted }]}>{trailingText}</Text>
          ) : null}
        </View>
        {trailingAction}
      </View>
    </Wrapper>
  );
}

type AdminTaskCardProps = Readonly<{
  item: TaskListItem;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
  onMenuPress: () => void;
  variant: 'active' | 'archived';
}>;

const AdminTaskCard = ({ item, colors, styles, onPress, onMenuPress, variant }: AdminTaskCardProps) => {
  const aguardando = item.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length;
  const isInactive = item.ativo === false;
  const isArchived = variant === 'archived';
  const isPaused = isInactive && !isArchived;

  const statusIcon = aguardando > 0
    ? { Icon: Eye, color: colors.semantic.info, bg: colors.semantic.infoBg, label: 'Aguardando você' }
    : isPaused
      ? { Icon: PauseCircle, color: colors.text.muted, bg: colors.bg.muted, label: 'Pausada' }
      : isArchived
        ? { Icon: Archive, color: colors.text.muted, bg: colors.bg.muted, label: 'Arquivada' }
        : { Icon: Clock, color: colors.semantic.warning, bg: colors.semantic.warningBg, label: 'Ativa' };

  const opacity = isInactive || isArchived ? 0.6 : 1;

  return (
    <TaskCard
      icon={statusIcon}
      showDot={aguardando > 0}
      title={item.titulo}
      subtitle={item.descricao}
      points={item.pontos}
      badges={[{ label: statusIcon.label, color: statusIcon.color, bg: statusIcon.bg }]}
      hasPhoto={item.exige_evidencia}
      trailingText={formatWeekdays(item.dias_semana)}
      trailingAction={
        <Pressable
          onPress={(e) => { e.stopPropagation(); onMenuPress(); }}
          style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Abrir menu da tarefa ${item.titulo}`}
          hitSlop={8}
        >
          <MoreVertical size={18} color={colors.text.muted} strokeWidth={2} />
        </Pressable>
      }
      opacity={opacity}
      borderColor={aguardando > 0 ? withAlpha(colors.semantic.info, 0.4) : undefined}
      onPress={onPress}
      accessibilityLabel={`Ver detalhes da tarefa ${item.titulo}`}
      colors={colors}
      styles={styles}
    />
  );
};

type ApprovedFeedRowProps = Readonly<{
  item: ApprovedAssignmentFeedItem;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
  showDate?: boolean;
}>;

const ApprovedFeedRow = ({ item, colors, styles, onPress, showDate }: ApprovedFeedRowProps) => (
  <TaskCard
    icon={{ Icon: CheckCircle2, color: colors.semantic.success, bg: colors.semantic.successBg }}
    title={item.tarefa_titulo}
    titleStyle={{ color: colors.text.muted, textDecorationLine: 'line-through' }}
    subtitle={item.filho_nome}
    points={item.pontos}
    pointsPrefix="+"
    badges={[{ label: 'Aprovada', color: colors.semantic.success, bg: colors.semantic.successBg }]}
    hasPhoto={!!item.evidencia_url}
    trailingText={showDate ? formatDate(item.validada_em) : undefined}
    onPress={onPress}
    accessibilityLabel={`Tarefa aprovada: ${item.tarefa_titulo}`}
    colors={colors}
    styles={styles}
  />
);

export default function AdminTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const footerItems = useAdminFooterItems();

  const [tab, setTab] = useState<TabKey>('ativas');
  const [showReview, setShowReview] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [actionTask, setActionTask] = useState<TaskListItem | null>(null);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<NavigationFeedback | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    variant: 'success' | 'warning' | 'error';
  } | null>(null);
  const [actionFeedbackKey, setActionFeedbackKey] = useState(0);

  const visibleSuccess = useTransientMessage(feedback?.message ?? null, {
    resetKey: feedback?.id,
  });
  const visibleAction = useTransientMessage(actionFeedback?.message ?? null, {
    resetKey: actionFeedbackKey,
  });

  const [showOlderApproved, setShowOlderApproved] = useState(false);
  // Default: today only. Expanded: last 7 days (RPC default).
  const approvedSince = showOlderApproved
    ? undefined // RPC default = 7 days
    : new Date().toISOString().slice(0, 10) + 'T00:00:00Z'; // today midnight

  const activeTasks = useAdminTasks();
  const archivedTasks = useArchivedTasks();
  const approvedFeed = useApprovedAssignmentsFeed(approvedSince);
  const pendingValidations = usePendingValidations();
  const editTaskQuery = useTaskDetail(editTaskId ?? undefined);
  const menuTaskQuery = useTaskDetail(menuTaskId ?? undefined);

  const archiveMutation = useArchiveTask();
  const unarchiveMutation = useUnarchiveTask();
  const deactivateMutation = useDeactivateTask();
  const deleteMutation = useDeleteTask();
  const reactivateMutation = useReactivateTask();

  const activeItems = useMemo(
    () => activeTasks.data?.pages.flatMap((p) => p.data) ?? [],
    [activeTasks.data],
  );
  const archivedItems = useMemo(
    () => archivedTasks.data?.pages.flatMap((p) => p.data) ?? [],
    [archivedTasks.data],
  );
  const approvedItems = useMemo(
    () => approvedFeed.data?.pages.flatMap((p) => p.data) ?? [],
    [approvedFeed.data],
  );

  const pendingCount = pendingValidations.data?.length ?? 0;

  useFocusEffect(
    useCallback(() => {
      const fb = consumeNavigationFeedback('admin-task-list');
      if (fb) setFeedback(fb);
    }, []),
  );

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(admin)/tasks') return;
      if (rota === 'index') router.dismissTo('/(admin)');
      else router.replace(rota as never);
    },
    [router],
  );

  const showActionFeedback = useCallback(
    (message: string, variant: 'success' | 'warning' | 'error' = 'success') => {
      setActionFeedback({ message, variant });
      setActionFeedbackKey((k) => k + 1);
    },
    [],
  );

  const handleArchive = useCallback(
    (item: TaskListItem) => {
      const message = buildTaskArchiveMessage(item.atribuicoes);
      Alert.alert('Arquivar tarefa?', message, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: () =>
            archiveMutation.mutate(item.id, {
              onSuccess: () => showActionFeedback('Tarefa arquivada.'),
              onError: (err) => showActionFeedback(localizeRpcError(err.message), 'error'),
            }),
        },
      ]);
    },
    [archiveMutation, showActionFeedback],
  );

  const handleUnarchive = useCallback(
    (item: TaskListItem) => {
      Alert.alert(
        'Desarquivar tarefa?',
        'A tarefa volta para a lista ativa e poderá receber novas atribuições.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desarquivar',
            onPress: () =>
              unarchiveMutation.mutate(item.id, {
                onSuccess: () => showActionFeedback('Tarefa desarquivada.'),
                onError: (err) => showActionFeedback(localizeRpcError(err.message), 'error'),
              }),
          },
        ],
      );
    },
    [unarchiveMutation, showActionFeedback],
  );

  const handlePause = useCallback(
    (item: TaskListItem) => {
      const message = buildTaskPauseMessage(item, item.atribuicoes);
      Alert.alert('Pausar tarefa?', message, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pausar',
          style: 'destructive',
          onPress: () =>
            deactivateMutation.mutate(item.id, {
              onSuccess: (data) => {
                const count = data?.pendingValidationCount ?? 0;
                if (count > 0) {
                  showActionFeedback(
                    `Tarefa pausada. ${count} atribuições aguardam validação.`,
                    'warning',
                  );
                } else {
                  showActionFeedback('Tarefa pausada.');
                }
              },
              onError: (err) => showActionFeedback(localizeRpcError(err.message), 'error'),
            }),
        },
      ]);
    },
    [deactivateMutation, showActionFeedback],
  );

  const handleResume = useCallback(
    (item: TaskListItem) => {
      reactivateMutation.mutate(item.id, {
        onSuccess: () => showActionFeedback('Tarefa retomada.'),
        onError: (err) => showActionFeedback(localizeRpcError(err.message), 'error'),
      });
    },
    [reactivateMutation, showActionFeedback],
  );

  const handleDelete = useCallback(
    (item: TaskListItem) => {
      const message = buildTaskDeleteMessage(item.atribuicoes);
      Alert.alert('Excluir tarefa?', message, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(item.id, {
              onSuccess: (data) => {
                const count = data?.pendingValidationCount ?? 0;
                if (count > 0) {
                  showActionFeedback(
                    `Tarefa excluída. ${count} atribuições aguardam validação.`,
                    'warning',
                  );
                } else {
                  showActionFeedback('Tarefa excluída.');
                }
              },
              onError: (err) => showActionFeedback(localizeRpcError(err.message), 'error'),
            }),
        },
      ]);
    },
    [deleteMutation, showActionFeedback],
  );

  const tabs: SegmentOption<TabKey>[] = useMemo(
    () => [
      { key: 'ativas', label: 'Ativas', badge: activeItems.length },
      { key: 'feitas', label: 'Feitas', badge: approvedItems.length },
      { key: 'arquivo', label: 'Arquivo', badge: archivedItems.length },
    ],
    [activeItems.length, approvedItems.length, archivedItems.length],
  );

  const renderActive = () => {
    if (activeTasks.isLoading) return <ListScreenSkeleton />;
    if (activeTasks.error || activeItems.length === 0) {
      return (
        <EmptyState
          error={activeTasks.error?.message ?? null}
          empty={activeItems.length === 0}
          emptyMessage={'Nenhuma tarefa ativa.\nToque em "+" para criar.'}
          onRetry={() => activeTasks.refetch()}
        />
      );
    }
    return (
      <FlashList<TaskListItem>
        data={activeItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={activeTasks.isFetching && !activeTasks.isLoading}
            onRefresh={() => activeTasks.refetch()}
            tintColor={colors.accent.admin}
          />
        }
        onEndReached={() => {
          if (activeTasks.hasNextPage) activeTasks.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={<View style={{ height: spacing['3'] }} />}
        ListFooterComponent={<ListFooter loading={activeTasks.isFetchingNextPage} />}
        renderItem={({ item }) => (
          <AdminTaskCard
            item={item}
            colors={colors}
            styles={styles}
            variant="active"
            onPress={() => router.push(`/(admin)/tasks/${item.id}` as never)}
            onMenuPress={() => setActionTask(item)}
          />
        )}
      />
    );
  };

  const renderArchived = () => {
    if (archivedTasks.isLoading) return <ListScreenSkeleton />;
    if (archivedTasks.error || archivedItems.length === 0) {
      return (
        <EmptyState
          error={archivedTasks.error?.message ?? null}
          empty={archivedItems.length === 0}
          emptyMessage="Nenhuma tarefa arquivada."
          onRetry={() => archivedTasks.refetch()}
        />
      );
    }
    return (
      <FlashList<TaskListItem>
        data={archivedItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={archivedTasks.isFetching && !archivedTasks.isLoading}
            onRefresh={() => archivedTasks.refetch()}
            tintColor={colors.accent.admin}
          />
        }
        onEndReached={() => {
          if (archivedTasks.hasNextPage) archivedTasks.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={<View style={{ height: spacing['3'] }} />}
        ListFooterComponent={<ListFooter loading={archivedTasks.isFetchingNextPage} />}
        renderItem={({ item }) => (
          <AdminTaskCard
            item={item}
            colors={colors}
            styles={styles}
            variant="archived"
            onPress={() => router.push(`/(admin)/tasks/${item.id}` as never)}
            onMenuPress={() => setActionTask(item)}
          />
        )}
      />
    );
  };

  const renderApproved = () => {
    if (approvedFeed.isLoading) return <ListScreenSkeleton />;
    if (approvedFeed.error || approvedItems.length === 0) {
      return (
        <EmptyState
          error={approvedFeed.error?.message ?? null}
          empty={approvedItems.length === 0}
          emptyMessage="Nenhuma tarefa feita hoje."
          onRetry={() => approvedFeed.refetch()}
        />
      );
    }
    return (
      <FlashList<ApprovedAssignmentFeedItem>
        data={approvedItems}
        keyExtractor={(item) => item.atribuicao_id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={approvedFeed.isFetching && !approvedFeed.isLoading}
            onRefresh={() => approvedFeed.refetch()}
            tintColor={colors.accent.admin}
          />
        }
        onEndReached={() => {
          if (approvedFeed.hasNextPage) approvedFeed.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing['3'] }}>
            {!showOlderApproved ? (
              <Text style={styles.feedPeriodHint}>Feitas hoje</Text>
            ) : (
              <Text style={styles.feedPeriodHint}>Últimos 7 dias</Text>
            )}
          </View>
        }
        ListFooterComponent={
          <>
            <ListFooter loading={approvedFeed.isFetchingNextPage} />
            {!showOlderApproved && !approvedFeed.hasNextPage && approvedItems.length >= 1 ? (
              <Pressable
                style={({ pressed }) => [
                  styles.loadOlderBtn,
                  { borderColor: colors.border.default },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setShowOlderApproved(true)}
                accessibilityRole="button"
                accessibilityLabel="Ver últimos 7 dias"
              >
                <Text style={[styles.loadOlderText, { color: colors.text.secondary }]}>
                  Ver últimos 7 dias
                </Text>
              </Pressable>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <ApprovedFeedRow
            item={item}
            colors={colors}
            styles={styles}
            onPress={() => router.push(`/(admin)/tasks/${item.tarefa_id}?readonly=1` as never)}
            showDate={showOlderApproved}
          />
        )}
      />
    );
  };

  const renderTab = () => {
    if (tab === 'feitas') return renderApproved();
    if (tab === 'arquivo') return renderArchived();
    return renderActive();
  };

  // Derive action state from either a TaskListItem (ativas/arquivo) or a TaskDetail (feitas menu)
  const menuTaskDetail = menuTaskQuery.data ?? null;
  const actionSource = actionTask ?? (menuTaskDetail ? {
    id: menuTaskDetail.id,
    titulo: menuTaskDetail.titulo,
    descricao: menuTaskDetail.descricao,
    pontos: menuTaskDetail.pontos,
    dias_semana: menuTaskDetail.dias_semana,
    exige_evidencia: menuTaskDetail.exige_evidencia,
    created_at: menuTaskDetail.created_at,
    ativo: menuTaskDetail.ativo,
    arquivada_em: menuTaskDetail.arquivada_em,
    excluida_em: menuTaskDetail.excluida_em,
    atribuicoes: menuTaskDetail.atribuicoes.map((a) => ({ status: a.status })),
  } satisfies TaskListItem : null);

  const actionState: TaskActionState | null = actionSource
    ? {
      isArchived: actionSource.arquivada_em !== null,
      isInactive: actionSource.ativo === false,
      canEdit: actionSource.arquivada_em === null && actionSource.ativo !== false,
      isDeleted: false,
    }
    : null;

  const actionTitle = actionSource?.titulo ?? '';

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Tarefas"
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => setShowCreate(true)}
            accessibilityLabel="Criar tarefa"
            tone="accent"
          />
        }
      />

      <SegmentedBar options={tabs} value={tab} onChange={setTab} role="admin" />

      {pendingCount > 0 ? (
        <Pressable
          style={({ pressed }) => [
            styles.banner,
            {
              backgroundColor: colors.semantic.infoBg,
              borderColor: withAlpha(colors.semantic.info, 0.3),
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={() => setShowReview(true)}
          accessibilityRole="button"
          accessibilityLabel={`Revisar ${pendingCount} entregas pendentes`}
        >
          <View style={[styles.bannerIcon, { backgroundColor: colors.bg.surface }]}>
            <Eye size={16} color={colors.semantic.info} strokeWidth={2} />
          </View>
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: colors.text.primary }]}>
              {pendingCount === 1
                ? '1 entrega aguardando você'
                : `${pendingCount} entregas aguardando você`}
            </Text>
            <Text style={[styles.bannerSub, { color: colors.text.muted }]}>
              Toque para revisar uma a uma
            </Text>
          </View>
          <Text style={[styles.bannerCta, { color: colors.semantic.info }]}>Revisar →</Text>
        </Pressable>
      ) : null}

      {visibleSuccess ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage message={visibleSuccess} variant="success" />
        </View>
      ) : null}

      {visibleAction && actionFeedback ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage message={visibleAction} variant={actionFeedback.variant} />
        </View>
      ) : null}

      {renderTab()}

      <HomeFooterBar
        items={footerItems}
        activeRoute="/(admin)/tasks"
        onNavigate={handleFooterNavigate}
      />

      <ReviewStack visible={showReview} onClose={() => setShowReview(false)} />

      <TaskFormSheet
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSuccess={(message) => showActionFeedback(message)}
      />

      <TaskFormSheet
        visible={editTaskId !== null && !!editTaskQuery.data}
        mode="edit"
        task={editTaskQuery.data ?? null}
        onClose={() => setEditTaskId(null)}
        onSuccess={(message) => showActionFeedback(message)}
      />

      {actionState && actionSource ? (
        <TaskActionSheet
          visible
          taskTitle={actionTitle}
          state={actionState}
          onClose={() => { setActionTask(null); setMenuTaskId(null); }}
          onEdit={() => setEditTaskId(actionSource.id)}
          onPause={() => handlePause(actionSource)}
          onResume={() => handleResume(actionSource)}
          onArchive={() => handleArchive(actionSource)}
          onUnarchive={() => handleUnarchive(actionSource)}
          onDelete={() => handleDelete(actionSource)}
        />
      ) : null}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    feedbackWrapper: { paddingHorizontal: spacing['4'], paddingTop: spacing['3'] },
    lista: { paddingHorizontal: spacing['4'] },
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['4'],
      gap: spacing['3'],
      marginBottom: spacing['3'],
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
    },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardDot: {
      position: 'absolute',
      top: -1,
      right: -1,
      width: 10,
      height: 10,
      borderRadius: radii.full,
      borderWidth: 2,
    },
    cardInfo: { flex: 1, gap: spacing['0.5'] },
    cardTitle: { fontSize: typography.size.sm, fontFamily: typography.family.bold },
    cardPointsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    cardPointsText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.black,
    },
    cardSub: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
    },
    cardBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['2'],
    },
    cardBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
      flexWrap: 'wrap',
      flex: 1,
    },
    cardBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['0.5'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    cardBadgeText: {
      fontSize: 10,
      fontFamily: typography.family.bold,
    },
    cardTrailing: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    menuButton: {
      width: 32,
      height: 32,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    banner: {
      marginHorizontal: spacing['4'],
      marginTop: spacing['3'],
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing['3'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
    },
    bannerIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerText: { flex: 1 },
    bannerTitle: { fontSize: typography.size.sm, fontFamily: typography.family.bold },
    bannerSub: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    bannerCta: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    feedPeriodHint: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
      color: colors.text.muted,
      textAlign: 'center',
      marginBottom: spacing['2'],
    },
    loadOlderBtn: {
      alignItems: 'center',
      paddingVertical: spacing['3'],
      marginTop: spacing['1'],
      marginBottom: spacing['4'],
      borderRadius: radii.md,
      borderWidth: 1,
    },
    loadOlderText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
    },
  });
}
