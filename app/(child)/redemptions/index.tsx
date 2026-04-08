import * as Sentry from '@sentry/react-native';
import { StyleSheet, Text, View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@lib/status';
import { useChildRedemptions } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ListFooter } from '@/components/ui/list-footer';
import { formatDate } from '@lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeBottomPadding, getSafeHorizontalPadding } from '@lib/safe-area';

export default function ChildRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

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

  const errorMessage = error?.message ?? null;
  const hasError = Boolean(errorMessage);
  const shouldShowEmptyState = hasError || redemptions.length === 0;
  const emptyStateMessage = 'Nenhum resgate realizado ainda.\nVá ao catálogo e troque seus pontos! 🎁';

  const handleRefresh = async () => {
    try {
      await refetch();
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
    }
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Meus Resgates"
        onBack={() => router.back()}
        backLabel="Início"
        role="filho"
      />

      {isLoading ? (
        <ListScreenSkeleton />
      ) : shouldShowEmptyState ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            error={errorMessage}
            empty={!errorMessage}
            emptyMessage={emptyStateMessage}
            onRetry={handleRefresh}
          />
        </View>
      ) : (
        <FlashList
          data={redemptions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: getSafeBottomPadding(insets, spacing['4']) }]}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={handleRefresh}
              tintColor={colors.brand.vivid}
            />
          }
          ListHeaderComponent={<View style={{ height: spacing['4'] }} />}
          renderItem={({ item, index }) => {
            const statusColor = getRedemptionStatusColor(item.status, colors);
            const StatusIcon =
              item.status === 'confirmado'
                ? CheckCircle2
                : item.status === 'cancelado'
                  ? XCircle
                  : Clock;
            const isLast = index === redemptions.length - 1;
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
                  {item.status === 'pendente' ? (
                    <Text style={styles.rowHint}>Aguardando confirmação</Text>
                  ) : null}
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
          onEndReachedThreshold={0.1}
          ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
        />
      )}
      {!isLoading && !errorMessage && redemptions.length === 0 ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.bg.canvas,
              borderTopColor: colors.border.subtle,
              paddingBottom: getSafeBottomPadding(insets, spacing['2']),
              ...getSafeHorizontalPadding(insets, spacing['5']),
            },
          ]}
        >
          <Button
            variant="primary"
            label="Ver prêmios 🎁"
            onPress={() => router.push('/(child)/prizes')}
            accessibilityLabel="Ver prêmios disponíveis"
          />
        </View>
      ) : null}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { flex: 1, alignItems: 'center' },
    footer: {
      borderTopWidth: 1,
      paddingTop: spacing['2'],
    },
    list: { paddingHorizontal: spacing['4'] },
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
