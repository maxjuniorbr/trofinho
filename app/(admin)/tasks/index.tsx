import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Archive,
  CheckCircle2,
  Eye,
  MoreVertical,
  PauseCircle,
  Plus,
  RefreshCw,
} from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
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
  usePendingValidations,
  useReactivateTask,
  useTaskDetail,
  useUnarchiveTask,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import {
  buildTaskArchiveMessage,
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
import { radii, shadows, spacing, typography } from '@/constants/theme';

type TabKey = 'ativas' | 'feitas' | 'arquivo';

type AdminTaskCardProps = Readonly<{
  item: TaskListItem;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
  onMenuPress: () => void;
  variant: 'active' | 'archived';
}>;

const AdminTaskCard = ({
  item,
  colors,
  styles,
  onPress,
  onMenuPress,
  variant,
}: AdminTaskCardProps) => {
  const aguardando = item.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length;
  const isInactive = item.ativo === false;
  const isArchived = variant === 'archived';

  const resolveOpacity = (pressed: boolean): number => {
    if (pressed) return 0.92;
    if (isInactive || isArchived) return 0.6;
    return 1;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.bg.surface,
          borderColor: aguardando > 0 ? colors.accent.adminDim : colors.border.subtle,
          opacity: resolveOpacity(pressed),
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalhes da tarefa ${item.titulo}`}
    >
      <View style={styles.cardTopo}>
        <View style={styles.cardTituloRow}>
          <Text style={[styles.cardTitulo, { color: colors.text.primary }]} numberOfLines={2}>
            {item.titulo}
          </Text>
          {isInactive && !isArchived ? (
            <View style={[styles.statusPill, { backgroundColor: colors.semantic.warningBg }]}>
              <PauseCircle size={11} color={colors.semantic.warningText} strokeWidth={2} />
              <Text style={[styles.statusPillText, { color: colors.semantic.warningText }]}>
                Pausada
              </Text>
            </View>
          ) : null}
          {isArchived ? (
            <View style={[styles.statusPill, { backgroundColor: colors.bg.muted }]}>
              <Archive size={11} color={colors.text.muted} strokeWidth={2} />
              <Text style={[styles.statusPillText, { color: colors.text.muted }]}>Arquivada</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.pontosTag, { backgroundColor: colors.brand.subtle }]}>
          <Text style={[styles.pontosTexto, { color: colors.brand.dim }]}>{item.pontos} pts</Text>
        </View>
      </View>
      <View style={styles.freqRow}>
        <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
        <Text style={[styles.cardPrazo, { color: colors.text.muted }]}>
          {formatWeekdays(item.dias_semana)}
          {' · '}
          {formatDate(item.created_at)}
        </Text>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.cardStats}>
          {aguardando > 0 ? <Badge label={`${aguardando} validar`} variant="info" /> : null}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onMenuPress();
          }}
          style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Abrir menu da tarefa ${item.titulo}`}
          hitSlop={8}
        >
          <MoreVertical size={18} color={colors.text.muted} strokeWidth={2} />
        </Pressable>
      </View>
    </Pressable>
  );
};

type ApprovedFeedRowProps = Readonly<{
  item: ApprovedAssignmentFeedItem;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

const ApprovedFeedRow = ({ item, colors, styles }: ApprovedFeedRowProps) => (
  <View
    style={[
      styles.feedRow,
      shadows.card,
      { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
    ]}
  >
    <View style={[styles.feedIcon, { backgroundColor: colors.semantic.successBg }]}>
      <CheckCircle2 size={16} color={colors.semantic.success} strokeWidth={2} />
    </View>
    <View style={styles.feedInfo}>
      <Text style={[styles.feedTitle, { color: colors.text.primary }]} numberOfLines={1}>
        {item.tarefa_titulo}
      </Text>
      <Text style={[styles.feedSub, { color: colors.text.muted }]} numberOfLines={1}>
        {item.filho_nome} · {formatDate(item.validada_em)}
      </Text>
    </View>
    <View style={[styles.feedPoints, { backgroundColor: colors.accent.adminBg }]}>
      <Text style={[styles.feedPointsText, { color: colors.accent.admin }]}>+{item.pontos}</Text>
    </View>
  </View>
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

  const activeTasks = useAdminTasks();
  const archivedTasks = useArchivedTasks();
  const approvedFeed = useApprovedAssignmentsFeed();
  const pendingValidations = usePendingValidations();
  const editTaskQuery = useTaskDetail(editTaskId ?? undefined);

  const archiveMutation = useArchiveTask();
  const unarchiveMutation = useUnarchiveTask();
  const deactivateMutation = useDeactivateTask();
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

  const tabs: SegmentOption<TabKey>[] = useMemo(
    () => [
      { key: 'ativas', label: 'Ativas' },
      { key: 'feitas', label: 'Feitas' },
      { key: 'arquivo', label: 'Arquivo' },
    ],
    [],
  );

  const renderActive = () => {
    if (activeTasks.isLoading) return <ListScreenSkeleton />;
    if (activeTasks.error || activeItems.length === 0) {
      return (
        <EmptyState
          error={activeTasks.error?.message ?? null}
          empty={activeItems.length === 0}
          emptyMessage={'Nenhuma tarefa ativa.\nToque em "+" para criar a primeira tarefa.'}
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
          emptyMessage="Nenhuma entrega aprovada ainda."
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
        ListHeaderComponent={<View style={{ height: spacing['3'] }} />}
        ListFooterComponent={<ListFooter loading={approvedFeed.isFetchingNextPage} />}
        renderItem={({ item }) => (
          <ApprovedFeedRow item={item} colors={colors} styles={styles} />
        )}
      />
    );
  };

  const renderTab = () => {
    if (tab === 'feitas') return renderApproved();
    if (tab === 'arquivo') return renderArchived();
    return renderActive();
  };

  const actionState: TaskActionState | null = actionTask
    ? {
      isArchived: actionTask.arquivada_em !== null,
      isInactive: actionTask.ativo === false,
      hasPendingReview: actionTask.atribuicoes.some(
        (a) => a.status === 'aguardando_validacao',
      ),
      canEdit: actionTask.arquivada_em === null && actionTask.ativo !== false,
    }
    : null;

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
              backgroundColor: colors.accent.adminBg,
              borderColor: colors.accent.adminDim,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={() => setShowReview(true)}
          accessibilityRole="button"
          accessibilityLabel={`Revisar ${pendingCount} entregas pendentes`}
        >
          <View style={[styles.bannerIcon, { backgroundColor: colors.accent.admin + '33' }]}>
            <Eye size={16} color={colors.accent.admin} strokeWidth={2} />
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
          <Text style={[styles.bannerCta, { color: colors.accent.admin }]}>Revisar →</Text>
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

      {actionState && actionTask ? (
        <TaskActionSheet
          visible
          taskTitle={actionTask.titulo}
          state={actionState}
          onClose={() => setActionTask(null)}
          onEdit={() => setEditTaskId(actionTask.id)}
          onReview={() => setShowReview(true)}
          onPause={() => handlePause(actionTask)}
          onResume={() => handleResume(actionTask)}
          onArchive={() => handleArchive(actionTask)}
          onUnarchive={() => handleUnarchive(actionTask)}
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
      marginBottom: spacing['3'],
    },
    cardTopo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing['2'],
    },
    cardTituloRow: { flex: 1, marginRight: spacing['2'], gap: spacing['1'] },
    cardTitulo: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.sm,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['0.5'],
      alignSelf: 'flex-start',
    },
    statusPillText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    pontosTag: {
      borderRadius: radii.full,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    pontosTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    freqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['2'],
    },
    cardPrazo: { fontSize: typography.size.xs },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['2'],
    },
    cardStats: { flexDirection: 'row', gap: spacing['2'], flexWrap: 'wrap', flex: 1 },
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
    feedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      borderRadius: radii.lg,
      borderWidth: 1,
      padding: spacing['3'],
      marginBottom: spacing['2'],
    },
    feedIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    feedInfo: { flex: 1 },
    feedTitle: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    feedSub: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    feedPoints: {
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    feedPointsText: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
  });
}
