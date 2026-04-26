import * as Sentry from '@sentry/react-native';
import { Alert, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Clock, Eye, CheckCircle2, XCircle, Camera, Star, PauseCircle } from 'lucide-react-native';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useChildFooterItems } from '@/hooks/use-footer-items';
import {
  getAssignmentPoints,
  getAssignmentRetryState,
  formatWeekdays,
  type ChildAssignment,
} from '@lib/tasks';
import { formatDate, toDateString } from '@lib/utils';
import { getAssignmentStatusLabel, getAssignmentStatusTone } from '@lib/status';
import { withAlpha } from '@/constants/colors';
import { useChildAssignments, useDiscardRejection } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { useImpersonation } from '@/context/impersonation-context';
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

function belongsToFilter(assignment: ChildAssignment, filter: Filter): boolean {
  const { status } = assignment;
  if (filter === 'historico') {
    if (status === 'rejeitada') return !getAssignmentRetryState(assignment).canRetry;
    return status === 'aprovada';
  }
  if (filter === 'pendente') {
    return status === 'pendente' || (status === 'rejeitada' && getAssignmentRetryState(assignment).canRetry);
  }
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

function getDateLine(item: ChildAssignment, filter: Filter): string | null {
  if (filter === 'pendente') return null;
  if (filter === 'aguardando_validacao') {
    return item.concluida_em ? `Enviada em ${formatDate(item.concluida_em)}` : null;
  }
  const date = item.validada_em ?? item.concluida_em;
  if (!date) return null;
  let text = `${item.validada_em ? 'Validada' : 'Concluída'} em ${formatDate(date)}`;
  if (item.competencia && toDateString(new Date(date)) !== item.competencia) {
    text += ` · Tarefa de ${formatDate(item.competencia + 'T12:00:00')}`;
  }
  return text;
}

function getStatusIcon(item: ChildAssignment, colors: ThemeColors) {
  const isInactive = item.tarefas.ativo === false;
  if (item.status === 'aguardando_validacao')
    return { Icon: Eye, color: colors.semantic.info, bg: colors.semantic.infoBg };
  if (item.status === 'aprovada')
    return { Icon: CheckCircle2, color: colors.semantic.success, bg: colors.semantic.successBg };
  if (item.status === 'rejeitada')
    return { Icon: XCircle, color: colors.semantic.error, bg: colors.semantic.errorBg };
  if (isInactive)
    return { Icon: PauseCircle, color: colors.text.muted, bg: colors.bg.muted };
  return { Icon: Clock, color: colors.semantic.warning, bg: colors.semantic.warningBg };
}

function getStatusBadge(item: ChildAssignment, filter: Filter, colors: ThemeColors) {
  if (filter === 'pendente') {
    if (item.status === 'rejeitada') {
      const tone = getAssignmentStatusTone('rejeitada', colors);
      return { label: 'Rejeitada — refazer', color: tone.text, bg: tone.background };
    }
    if (item.tarefas.ativo === false) {
      return { label: 'Desativada', color: colors.text.muted, bg: colors.bg.muted };
    }
    const tone = getAssignmentStatusTone('pendente', colors);
    return { label: 'Pendente', color: tone.text, bg: tone.background };
  }
  if (filter === 'aguardando_validacao') {
    const tone = getAssignmentStatusTone('aguardando_validacao', colors);
    return { label: 'Aguardando validação', color: tone.text, bg: tone.background };
  }
  const tone = getAssignmentStatusTone(item.status, colors);
  return { label: getAssignmentStatusLabel(item.status), color: tone.text, bg: tone.background };
}

type TaskCardProps = Readonly<{
  item: ChildAssignment;
  filter: Filter;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  router: ReturnType<typeof useRouter>;
  isReadOnly: boolean;
}>;

function TaskCard({ item, filter, colors, styles, router, isReadOnly }: TaskCardProps) {
  const isInactive = item.tarefas.ativo === false;
  const isUnavailable = isInactive && item.status === 'pendente';
  const icon = getStatusIcon(item, colors);
  const badge = getStatusBadge(item, filter, colors);
  const dateLine = getDateLine(item, filter);
  const hasPhoto = item.exige_evidencia_snapshot;
  const isRejected = item.status === 'rejeitada';
  const isAwaiting = item.status === 'aguardando_validacao';
  const opacity = isInactive ? 0.6 : 1;

  const handlePress = () => {
    if (isUnavailable) {
      Alert.alert('Tarefa desativada', 'Esta tarefa foi desativada pelo responsável e não pode mais ser concluída.');
      return;
    }
    router.push(`/(child)/tasks/${item.id}` as never);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.bg.surface,
          borderColor: isAwaiting ? withAlpha(colors.semantic.info, 0.4)
            : isRejected ? withAlpha(colors.semantic.error, 0.4)
              : colors.border.subtle,
          opacity: pressed ? 0.92 : opacity,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalhes da tarefa ${item.titulo_snapshot}`}
    >
      <View style={styles.cardTopRow}>
        <View style={[styles.cardIcon, { backgroundColor: icon.bg }]}>
          <icon.Icon size={16} color={icon.color} strokeWidth={2} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]} numberOfLines={2}>
            {item.titulo_snapshot}
          </Text>
        </View>
        <View style={[styles.cardPointsBadge, { backgroundColor: colors.accent.filhoBg }]}>
          <Star size={12} color={colors.accent.filho} strokeWidth={2} />
          <Text style={[styles.cardPointsText, { color: colors.accent.filho }]}>
            {getAssignmentPoints(item)}
          </Text>
        </View>
      </View>
      <View style={styles.cardBottomRow}>
        <View style={styles.cardBadges}>
          <View style={[styles.cardBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.cardBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
          {hasPhoto ? (
            <View style={[styles.cardBadge, { backgroundColor: colors.bg.muted }]}>
              <Camera size={10} color={colors.text.muted} strokeWidth={2} />
              <Text style={[styles.cardBadgeText, { color: colors.text.muted }]}>Foto</Text>
            </View>
          ) : null}
          <Text style={[styles.cardTrailing, { color: colors.text.muted }]}>
            {formatWeekdays(item.tarefas.dias_semana)}
          </Text>
        </View>
      </View>
      {dateLine ? (
        <Text style={[styles.cardDateLine, { color: colors.text.muted }]}>{dateLine}</Text>
      ) : null}
      {isRejected ? (
        <RejectedActions item={item} styles={styles} colors={colors} disabled={isReadOnly} />
      ) : null}
    </Pressable>
  );
}

function RejectedActions({
  item,
  styles,
  colors,
  disabled,
}: Readonly<{ item: ChildAssignment; styles: ReturnType<typeof makeStyles>; colors: ThemeColors; disabled?: boolean }>) {
  const discardMutation = useDiscardRejection();
  const retryState = getAssignmentRetryState(item);
  const plural = retryState.attemptsLeft === 1 ? '' : 's';
  const hint = retryState.canRetry
    ? `${retryState.attemptsLeft} tentativa${plural} restante${plural}`
    : 'Sem tentativas restantes';

  const handleDiscard = () => {
    Alert.alert('Descartar feedback?', 'A tarefa volta para "Para fazer".', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => discardMutation.mutate(item.id) },
    ]);
  };

  return (
    <View style={[styles.rejectedActions, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.rejectedHint, { color: colors.semantic.warningText }]}>{hint}</Text>
      <Pressable
        onPress={handleDiscard}
        disabled={discardMutation.isPending || disabled}
        accessibilityRole="button"
        accessibilityLabel="Descartar feedback de rejeição"
        hitSlop={8}
      >
        <Text style={[styles.rejectedDiscardLink, { color: colors.accent.filho }]}>
          {discardMutation.isPending ? 'Descartando…' : 'Descartar feedback'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function ChildTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { impersonating } = useImpersonation();
  const isReadOnly = impersonating !== null;
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
    try { await refetch(); }
    catch (e) { Sentry.captureException(e); }
    finally { setRefreshing(false); }
  };

  const countByFilter = useMemo(() => {
    const counts = { pendente: 0, aguardando_validacao: 0, historico: 0 };
    for (const a of assignments) {
      if (belongsToFilter(a, 'pendente')) counts.pendente++;
      else if (belongsToFilter(a, 'aguardando_validacao')) counts.aguardando_validacao++;
      else counts.historico++;
    }
    return counts;
  }, [assignments]);

  const filtersWithCount = useMemo(
    () => FILTERS.map((f) => ({ ...f, badge: countByFilter[f.key] })),
    [countByFilter],
  );

  const filtered = useMemo(
    () => sortChildAssignments(assignments.filter((a) => belongsToFilter(a, filter)), filter),
    [assignments, filter],
  );

  let emptyMessage = 'Nenhuma tarefa finalizada ainda.';
  if (filter === 'pendente') emptyMessage = 'Nenhuma tarefa pendente.';
  else if (filter === 'aguardando_validacao') emptyMessage = 'Nenhuma tarefa aguardando validação.';

  const loading = isLoading;
  const errorMessage = error?.message ?? null;
  const shouldShowEmptyState = loading || Boolean(errorMessage) || filtered.length === 0;

  const renderContent = () => {
    if (loading) return <ListScreenSkeleton />;
    if (shouldShowEmptyState)
      return <EmptyState error={errorMessage} empty={!errorMessage} emptyMessage={emptyMessage} onRetry={handleRefresh} />;
    return (
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.vivid} />}
        ListHeaderComponent={<View style={{ height: spacing['4'] }} />}
        renderItem={({ item }) => (
          <TaskCard item={item} filter={filter} colors={colors} styles={styles} router={router} isReadOnly={isReadOnly} />
        )}
        onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Tarefas" role="filho" />
      <SegmentedBar options={filtersWithCount} value={filter} onChange={setFilter} role="filho" />
      {renderContent()}
      <HomeFooterBar items={footerItems} activeRoute="/(child)/tasks" onNavigate={handleFooterNavigate} />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { paddingHorizontal: spacing['4'] },
    // ── Card (same structure as admin) ──
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
    cardDateLine: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
      marginTop: -spacing['1'],
    },
    // ── Rejected actions ──
    rejectedActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: -spacing['1'],
    },
    rejectedHint: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    rejectedDiscardLink: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      textDecorationLine: 'underline',
    },
  });
}
