import * as Sentry from '@sentry/react-native';
import { StyleSheet, Text, View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useChildFooterItems } from '@/hooks/use-footer-items';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@lib/status';
import { useChildRedemptions } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ListFooter } from '@/components/ui/list-footer';
import { formatDate } from '@lib/utils';



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
  const pendingRedemptions = useMemo(
    () => redemptions.filter((r) => r.status === 'pendente'),
    [redemptions],
  );
  const historicalRedemptions = useMemo(
    () => redemptions.filter((r) => r.status !== 'pendente'),
    [redemptions],
  );

  const errorMessage = error?.message ?? null;
  const hasError = Boolean(errorMessage);
  const shouldShowEmptyState = hasError || redemptions.length === 0;
  const emptyStateMessage = 'Nenhum resgate realizado ainda.\nVá ao catálogo e troque seus pontos! 🎁';

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(child)/redemptions') return;
      if (rota === 'index') router.back();
      else router.replace(rota as never);
    },
    [router],
  );

  const handleRefresh = async () => {
    try {
      await refetch();
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'confirmado') return CheckCircle2;
    if (status === 'cancelado') return XCircle;
    return Clock;
  };

  const renderContent = () => {
    if (isLoading) return <ListScreenSkeleton />;
    if (shouldShowEmptyState) {
      return (
        <View style={styles.emptyContainer}>
          <EmptyState
            error={errorMessage}
            empty={!errorMessage}
            emptyMessage={emptyStateMessage}
            onRetry={handleRefresh}
          />
        </View>
      );
    }
    return (
      <FlashList
        data={historicalRedemptions}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={
          <>
            <View style={{ height: spacing['4'] }} />
            {pendingRedemptions.length > 0 ? (
              <>
                <View style={[styles.sectionHeader, { borderBottomColor: colors.border.subtle }]}>
                  <View style={styles.sectionTitleRow}>
                    <Clock size={14} color={colors.text.primary} strokeWidth={2} />
                    <Text style={styles.sectionTitle}>
                      Pendentes ({pendingRedemptions.length})
                    </Text>
                  </View>
                </View>
                {pendingRedemptions.map((item, index) => {
                  const statusColor = getRedemptionStatusColor(item.status, colors);
                  const isLast = index === pendingRedemptions.length - 1;
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.row,
                        !isLast && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border.subtle,
                        },
                      ]}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: statusColor + '20' }]}>
                        <Clock size={14} color={statusColor} strokeWidth={2} />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowNome}>{item.premios?.nome ?? 'Prêmio removido'}</Text>
                        <Text style={styles.rowHint}>Aguardando confirmação</Text>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={[styles.rowStatus, { color: statusColor }]}>
                          {getRedemptionStatusLabel(item.status)}
                        </Text>
                        <Text style={styles.rowData}>{formatDate(new Date(item.created_at))}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
            {historicalRedemptions.length > 0 ? (
              <View style={[styles.sectionHeader, { borderBottomColor: colors.border.subtle }]}>
                <Text style={styles.sectionTitle}>Histórico</Text>
              </View>
            ) : null}
            {redemptions.length > 0 && historicalRedemptions.length === 0 && !isFetching ? (
              <Text style={styles.noHistory}>Nenhum histórico de resgates.</Text>
            ) : null}
          </>
        }
        renderItem={({ item, index }) => {
          const statusColor = getRedemptionStatusColor(item.status, colors);
          const StatusIcon = getStatusIcon(item.status);
          const isLast = index === historicalRedemptions.length - 1;
          return (
            <View
              style={[
                styles.row,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border.subtle,
                },
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: statusColor + '20' }]}>
                <StatusIcon size={14} color={statusColor} strokeWidth={2} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowNome}>{item.premios?.nome ?? 'Prêmio removido'}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowStatus, { color: statusColor }]}>
                  {getRedemptionStatusLabel(item.status)}
                </Text>
                <Text style={styles.rowData}>{formatDate(new Date(item.created_at))}</Text>
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
      <ScreenHeader
        title="Meus Resgates"
        role="filho"
      />

      {renderContent()}
      <HomeFooterBar items={footerItems} activeRoute="/(child)/redemptions" onNavigate={handleFooterNavigate} />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { flex: 1, alignItems: 'center' },
    list: { paddingHorizontal: spacing['4'] },
    sectionHeader: {
      borderBottomWidth: 1,
      paddingBottom: spacing['2'],
      marginBottom: spacing['2'],
      marginTop: spacing['3'],
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
    },
    sectionTitle: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.md,
      color: colors.text.primary,
    },
    noHistory: {
      fontSize: typography.size.sm,
      color: colors.text.muted,
      textAlign: 'center',
      paddingVertical: spacing['4'],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['3'],
      gap: spacing['2'],
    },
    rowIcon: {
      width: 30,
      height: 30,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowInfo: { flex: 1 },
    rowNome: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
    },
    rowHint: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      fontStyle: 'italic',
      marginTop: spacing['0.5'],
    },
    rowRight: { alignItems: 'flex-end' },
    rowStatus: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    rowData: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      marginTop: spacing['0.5'],
    },
  });
}
