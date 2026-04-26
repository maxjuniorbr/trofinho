import * as Sentry from '@sentry/react-native';
import { StyleSheet, Text, View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useChildFooterItems } from '@/hooks/use-footer-items';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@lib/status';
import { useChildRedemptions } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ListFooter } from '@/components/ui/list-footer';
import { SegmentedBar, type SegmentOption } from '@/components/ui/segmented-bar';
import { formatDate } from '@lib/utils';

type TabKey = 'pendentes' | 'concluidos' | 'todos';

export default function ChildRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const footerItems = useChildFooterItems();

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChildRedemptions();
  const redemptions = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const [tab, setTab] = useState<TabKey>('pendentes');

  const pendingCount = useMemo(
    () => redemptions.filter((r) => r.status === 'pendente').length,
    [redemptions],
  );

  const filtered = useMemo(() => {
    if (tab === 'pendentes') return redemptions.filter((r) => r.status === 'pendente');
    if (tab === 'concluidos') return redemptions.filter((r) => r.status !== 'pendente');
    return redemptions;
  }, [redemptions, tab]);

  const hasError = Boolean(error);
  const shouldShowEmptyState = hasError || filtered.length === 0;

  const emptyMessages: Record<TabKey, string> = {
    pendentes: 'Nenhum resgate pendente.',
    concluidos: 'Nenhum resgate concluído.',
    todos: 'Nenhum resgate realizado ainda.',
  };

  const concludedCount = useMemo(
    () => redemptions.filter((r) => r.status !== 'pendente').length,
    [redemptions],
  );

  const tabs: SegmentOption<TabKey>[] = useMemo(
    () => [
      { key: 'pendentes', label: 'Pendentes', badge: pendingCount },
      { key: 'concluidos', label: 'Concluídos', badge: concludedCount },
      { key: 'todos', label: 'Todos', badge: redemptions.length },
    ],
    [pendingCount, concludedCount, redemptions.length],
  );

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(child)/redemptions') return;
      if (rota === 'index') router.dismissTo('/(child)');
      else router.replace(rota as never);
    },
    [router],
  );

  const handleRefresh = async () => {
    try {
      await refetch();
    } catch (e) {
      Sentry.captureException(e);
    }
  };

  const renderContent = () => {
    if (isLoading) return <ListScreenSkeleton />;
    if (shouldShowEmptyState) {
      return (
        <EmptyState
          error={error?.message ?? null}
          empty={!error}
          emptyMessage={emptyMessages[tab]}
          onRetry={handleRefresh}
        />
      );
    }
    return (
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={<View style={{ height: spacing['3'] }} />}
        renderItem={({ item }) => {
          const statusColor = getRedemptionStatusColor(item.status, colors);
          const prizeEmoji = (item.premios as { emoji?: string } | null)?.emoji ?? '🎁';
          const prizeName = item.premios?.nome ?? 'Prêmio removido';

          return (
            <View style={styles.card}>
              <View style={styles.topRow}>
                <View style={styles.emojiCircle}>
                  <Text style={styles.emojiText}>{prizeEmoji}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.prizeName} numberOfLines={1}>{prizeName}</Text>
                  <Text style={styles.dateText}>{formatDate(new Date(item.created_at))}</Text>
                </View>
                <View style={[styles.costBadge, { backgroundColor: colors.accent.filhoBg }]}>
                  <Star size={12} color={colors.accent.filho} strokeWidth={2} />
                  <Text style={[styles.costText, { color: colors.accent.filho }]}>
                    {item.pontos_debitados}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getRedemptionStatusLabel(item.status)}
                </Text>
              </View>
            </View>
          );
        }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Resgates" role="filho" />
      <SegmentedBar options={tabs} value={tab} onChange={setTab} role="filho" />
      {renderContent()}
      <HomeFooterBar
        items={footerItems}
        activeRoute="/(child)/redemptions"
        onNavigate={handleFooterNavigate}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    lista: { paddingHorizontal: spacing['4'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: spacing['4'],
      gap: spacing['3'],
      marginBottom: spacing['3'],
      ...shadows.card,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
    },
    emojiCircle: {
      width: 44,
      height: 44,
      borderRadius: radii.full,
      backgroundColor: colors.bg.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiText: { fontSize: 22 },
    infoCol: { flex: 1, gap: spacing['0.5'] },
    prizeName: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    dateText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
      color: colors.text.muted,
    },
    costBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    costText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.black,
    },
    statusBadge: {
      borderRadius: radii.md,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
      alignSelf: 'flex-start',
    },
    statusText: {
      fontSize: 10,
      fontFamily: typography.family.bold,
    },
  });
}
