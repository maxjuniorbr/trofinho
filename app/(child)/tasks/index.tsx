import * as Sentry from '@sentry/react-native';
import { Alert, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { RefreshCw, Camera } from 'lucide-react-native';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';
import { useChildFooterItems } from '@/hooks/use-footer-items';
import {
  getAssignmentPoints,
  getAssignmentRetryState,
  formatWeekdays,
  type ChildAssignment,
  type AssignmentStatus,
} from '@lib/tasks';
import { formatDate, toDateString } from '@lib/utils';
import { getAssignmentStatusLabel, getAssignmentStatusTone } from '@lib/status';
import { useChildAssignments, useDiscardRejection } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ListFooter } from '@/components/ui/list-footer';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { SegmentedBar, type SegmentOption } from '@/components/ui/segmented-bar';

type Filter = 'pendente' | 'aguardando_validacao' | 'historico';

const FILTERS: SegmentOption<Filter>[] = [
  { key: 'pendente', label: 'Para fazer' },
  { key: 'aguardando_validacao', label: 'Enviadas' },
  { key: 'historico', label: 'Finalizadas' },
];

function belongsToFilter(status: AssignmentStatus, filter: Filter): boolean {
  if (filter === 'historico') return status === 'aprovada' || status === 'rejeitada';
  return status === filter;
}

function sortChildAssignments(assignments: ChildAssignment[], filter: Filter): ChildAssignment[] {
  const arr = assignments.slice();
  if (filter === 'pendente') {
    return arr.sort((a, b) => getAssignmentPoints(b) - getAssignmentPoints(a));
  }
  if (filter === 'aguardando_validacao') {
    return arr.sort((a, b) => {
      const aTime = a.concluida_em ?? a.created_at;
      const bTime = b.concluida_em ?? b.created_at;
      return bTime.localeCompare(aTime);
    });
  }
  return arr.sort((a, b) => {
    const aTime = a.validada_em ?? a.concluida_em ?? a.created_at;
    const bTime = b.validada_em ?? b.concluida_em ?? b.created_at;
    return bTime.localeCompare(aTime);
  });
}

type DateLine = { label: string; value: string };

function getAssignmentDateLine(assignment: ChildAssignment, filter: Filter): DateLine | null {
  if (filter === 'pendente') return null;
  if (filter === 'aguardando_validacao') {
    return assignment.concluida_em
      ? { label: 'Enviada em ', value: formatDate(assignment.concluida_em) }
      : null;
  }
  const date = assignment.validada_em ?? assignment.concluida_em;
  if (!date) return null;
  let value = formatDate(date);
  if (assignment.competencia && toDateString(new Date(date)) !== assignment.competencia) {
    value += ' · Tarefa de ' + formatDate(assignment.competencia + 'T12:00:00');
  }
  return {
    label: assignment.validada_em ? 'Validada em ' : 'Concluída em ',
    value,
  };
}

type TaskCardProps = {
  item: ChildAssignment;
  filter: Filter;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  router: ReturnType<typeof useRouter>;
};

function getTaskCardAction(
  item: ChildAssignment,
  isUnavailable: boolean,
  router: ReturnType<typeof useRouter>,
): { handlePress: () => void; accessibilityLabel: string } {
  if (isUnavailable) {
    return {
      handlePress: () =>
        Alert.alert(
          'Tarefa desativada',
          'Esta tarefa foi desativada pelo responsável e não pode mais ser concluída.',
        ),
      accessibilityLabel: `Tarefa ${item.tarefas.titulo} desativada`,
    };
  }
  return {
    handlePress: () => router.push(`/(child)/tasks/${item.id}` as never),
    accessibilityLabel: `Ver detalhes da tarefa ${item.tarefas.titulo}`,
  };
}

function TaskCardBadges({
  item,
  filter,
  isInactive,
  dateLine,
  showEvidenceHint,
  colors,
  styles,
}: Readonly<{
  item: ChildAssignment;
  filter: Filter;
  isInactive: boolean;
  dateLine: DateLine | null;
  showEvidenceHint: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>) {
  const statusTone = getAssignmentStatusTone(item.status, colors);

  return (
    <>
      {isInactive ? (
        <View style={[styles.inactiveTag, { backgroundColor: colors.bg.muted }]}>
          <Text style={[styles.inactiveTagText, { color: colors.text.muted }]}>Desativada</Text>
        </View>
      ) : null}
      <View style={styles.freqRow}>
        <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
        <Text style={[styles.cardDeadline, { marginBottom: 0 }]}>
          {formatWeekdays(item.tarefas.dias_semana)}
        </Text>
      </View>
      {dateLine ? (
        <Text style={styles.cardDeadline}>
          {dateLine.label}
          {dateLine.value}
        </Text>
      ) : null}
      {showEvidenceHint ? (
        <View style={styles.evidenceHint}>
          <Camera size={12} color={colors.text.muted} strokeWidth={2} />
          <Text style={styles.evidenceHintText}>Requer foto</Text>
        </View>
      ) : null}
      {filter === 'historico' ? (
        <View style={[styles.statusTag, { backgroundColor: statusTone.background }]}>
          <Text style={[styles.statusText, { color: statusTone.text }]}>
            {getAssignmentStatusLabel(item.status)}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function RejectedActions({
  item,
  styles,
}: Readonly<{ item: ChildAssignment; styles: ReturnType<typeof makeStyles> }>) {
  const discardMutation = useDiscardRejection();
  const retryState = getAssignmentRetryState(item);
  const plural = retryState.attemptsLeft === 1 ? '' : 's';
  const hint = retryState.canRetry
    ? `${retryState.attemptsLeft} tentativa${plural} restante${plural}`
    : 'Sem tentativas restantes';

  const handleDiscard = () => {
    Alert.alert('Descartar feedback?', 'A tarefa volta para "Para fazer".', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => discardMutation.mutate(item.id),
      },
    ]);
  };

  return (
    <View style={styles.rejectedActions}>
      <Text style={styles.rejectedHint}>{hint}</Text>
      <Pressable
        onPress={handleDiscard}
        disabled={discardMutation.isPending}
        accessibilityRole="button"
        accessibilityLabel="Descartar feedback de rejeição"
        hitSlop={8}
      >
        <Text style={styles.rejectedDiscardLink}>
          {discardMutation.isPending ? 'Descartando…' : 'Descartar feedback'}
        </Text>
      </Pressable>
    </View>
  );
}

function TaskCard({ item, filter, colors, styles, router }: Readonly<TaskCardProps>) {
  const dateLine = getAssignmentDateLine(item, filter);
  const isInactive = item.tarefas.ativo === false;
  const isUnavailable = isInactive && item.status === 'pendente';
  const showEvidenceHint = item.tarefas.exige_evidencia && filter === 'pendente';
  const { handlePress, accessibilityLabel } = getTaskCardAction(item, isUnavailable, router);
  const isRejected = item.status === 'rejeitada';

  return (
    <Pressable
      style={[styles.card, isInactive && styles.inactiveCard]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.tarefas.titulo}
        </Text>
        <TaskPointsPill points={getAssignmentPoints(item)} />
      </View>
      <TaskCardBadges
        item={item}
        filter={filter}
        isInactive={isInactive}
        dateLine={dateLine}
        showEvidenceHint={showEvidenceHint}
        colors={colors}
        styles={styles}
      />
      {isRejected ? <RejectedActions item={item} styles={styles} /> : null}
    </Pressable>
  );
}

export default function ChildTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const footerItems = useChildFooterItems();

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChildAssignments();
  const assignments = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const [filter, setFilter] = useState<Filter>('pendente');
  const [refreshing, setRefreshing] = useState(false);

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(child)/tasks') return;
      if (rota === 'index') router.dismissTo('/(child)');
      else router.replace(rota as never);
    },
    [router],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (e) {
      Sentry.captureException(e);
    } finally {
      setRefreshing(false);
    }
  };

  const countByFilter = useMemo(() => {
    const counts = { pendente: 0, aguardando_validacao: 0, historico: 0 };
    for (const a of assignments) {
      if (belongsToFilter(a.status, 'pendente')) counts.pendente++;
      else if (belongsToFilter(a.status, 'aguardando_validacao')) counts.aguardando_validacao++;
      else counts.historico++;
    }
    return counts;
  }, [assignments]);

  const filtersWithBadge = useMemo(
    () => FILTERS.map((f) => ({ ...f, badge: countByFilter[f.key] })),
    [countByFilter],
  );

  const filtered = useMemo(
    () =>
      sortChildAssignments(
        assignments.filter((a) => belongsToFilter(a.status, filter)),
        filter,
      ),
    [assignments, filter],
  );

  let emptyMessage = 'Nenhuma tarefa finalizada ainda. Continue assim! 💪';
  if (filter === 'pendente') emptyMessage = 'Tudo feito por aqui! Você arrasou! 🎉';
  else if (filter === 'aguardando_validacao')
    emptyMessage = 'Nada pendente, o responsável vai revisar! 👀';

  const loading = isLoading;
  const errorMessage = error?.message ?? null;
  const shouldShowEmptyState = loading || Boolean(errorMessage) || filtered.length === 0;

  const renderContent = () => {
    if (loading) return <ListScreenSkeleton />;
    if (shouldShowEmptyState)
      return (
        <EmptyState
          error={errorMessage}
          empty={!errorMessage}
          emptyMessage={emptyMessage}
          onRetry={handleRefresh}
        />
      );
    return (
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={<View style={{ height: spacing['4'] }} />}
        renderItem={({ item }) => (
          <TaskCard item={item} filter={filter} colors={colors} styles={styles} router={router} />
        )}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Minhas Tarefas" role="filho" />

      <SegmentedBar options={filtersWithBadge} value={filter} onChange={setFilter} role="filho" />

      {renderContent()}
      <HomeFooterBar
        items={footerItems}
        activeRoute="/(child)/tasks"
        onNavigate={handleFooterNavigate}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { paddingHorizontal: spacing['4'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: spacing['4'],
      marginBottom: spacing['3'],
      ...shadows.card,
    },
    inactiveCard: { opacity: 0.5 },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing['2'],
    },
    cardTitle: {
      flex: 1,
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
      marginRight: spacing['2'],
    },
    inactiveTag: {
      alignSelf: 'flex-start',
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      marginBottom: spacing['2'],
    },
    inactiveTagText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    freqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['2'],
    },
    cardDeadline: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      marginBottom: spacing['2'],
    },
    evidenceHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['2'],
    },
    evidenceHintText: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
    },
    statusTag: {
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
    },
    statusText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    rejectedActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing['2'],
    },
    rejectedHint: {
      fontSize: typography.size.xs,
      color: colors.semantic.warningText,
      fontFamily: typography.family.semibold,
    },
    rejectedDiscardLink: {
      fontSize: typography.size.xs,
      color: colors.accent.filho,
      fontFamily: typography.family.semibold,
      textDecorationLine: 'underline',
    },
  });
}
