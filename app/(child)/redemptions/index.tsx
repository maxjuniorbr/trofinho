import * as Sentry from '@sentry/react-native';
import { StyleSheet, Text, View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@lib/status';
import { useChildRedemptions } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
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
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.premios.nome}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getRedemptionStatusColor(item.status, colors) + '22' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getRedemptionStatusColor(item.status, colors) },
                    ]}
                  >
                    {getRedemptionStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
              {item.status === 'pendente' ? (
                <Text style={styles.pendingHint}>Aguardando confirmação do responsável ⏳</Text>
              ) : null}
              <View style={styles.cardFooter}>
                <View style={styles.cardPointsRow}>
                  <Trophy size={12} color={colors.accent.filho} strokeWidth={2} />
                  <Text style={styles.cardPoints}>{item.pontos_debitados} pts</Text>
                </View>
                <Text style={styles.cardDate}>{formatDate(new Date(item.created_at))}</Text>
              </View>
            </View>
          )}
          onEndReached={() => {
            if (hasNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
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
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
      marginBottom: spacing['2'],
      ...shadows.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    cardName: {
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
      flex: 1,
    },
    statusBadge: {
      borderRadius: radii.md,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    statusText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    pendingHint: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      fontStyle: 'italic',
    },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardPointsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    cardPoints: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
      color: colors.accent.filho,
    },
    cardDate: { fontSize: typography.size.xs, color: colors.text.muted },
  });
}
