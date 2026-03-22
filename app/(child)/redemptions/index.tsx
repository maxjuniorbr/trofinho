import {
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import {
  listChildRedemptions,
  type RedemptionWithPrize,
} from '@lib/prizes';
import { captureException } from '@lib/sentry';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@/constants/status';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { formatDate } from '@lib/utils';

export default function ChildRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [redemptions, setRedemptions] = useState<RedemptionWithPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasError = Boolean(error);
  const shouldShowEmptyState = loading || hasError || redemptions.length === 0;
  const emptyStateMessage = 'Nenhum resgate realizado ainda.\nVá ao catálogo e troque seus pontos!';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await listChildRedemptions();
      if (error) setError(error);
      else setRedemptions(data);
    } catch (e) {
      captureException(e);
      setError('Não foi possível carregar o histórico agora.');
      setRedemptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Meus Resgates" onBack={() => router.back()} backLabel="Início" role="filho" />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={loading}
          error={error}
          empty={!loading && !error}
          emptyMessage={emptyStateMessage}
          onRetry={loadData}
        />
      ) : (
        <FlashList
          data={redemptions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.premios.nome}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getRedemptionStatusColor(item.status, colors) + '22' }]}>
                  <Text style={[styles.statusText, { color: getRedemptionStatusColor(item.status, colors) }]}>
                    {getRedemptionStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.cardPointsRow}>
                  <Trophy size={12} color={colors.accent.filho} strokeWidth={2} />
                  <Text style={styles.cardPoints}>{item.pontos_debitados} pts</Text>
                </View>
                <Text style={styles.cardDate}>{formatDate(new Date(item.created_at))}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeScreenFrame>
  );
}


function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    list: { padding: spacing['4'], paddingBottom: spacing['12'] },
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
    cardName: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: colors.text.primary, flex: 1 },
    statusBadge: { borderRadius: radii.md, borderCurve: 'continuous', paddingHorizontal: spacing['2'], paddingVertical: spacing['1'] },
    statusText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardPointsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    cardPoints: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.filho },
    cardDate: { fontSize: typography.size.xs, color: colors.text.muted },
  });
}
