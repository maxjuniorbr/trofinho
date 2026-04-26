import * as Sentry from '@sentry/react-native';
import { Alert, StyleSheet, Text, View, Animated, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { hapticSuccess } from '@lib/haptics';
import { localizeRpcError } from '@lib/api-error';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Star } from 'lucide-react-native';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useChildFooterItems } from '@/hooks/use-footer-items';
import type { Prize } from '@lib/prizes';
import {
  useActivePrizes,
  useBalance,
  useRequestRedemption,
  useProfile,
  combineQueryStates,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { useImpersonation } from '@/context/impersonation-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';

export default function ChildPrizesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { impersonating } = useImpersonation();
  const isReadOnly = impersonating !== null;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const footerItems = useChildFooterItems();

  const prizesQuery = useActivePrizes();
  const prizes = useMemo(
    () => prizesQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [prizesQuery.data],
  );

  const balanceQuery = useBalance(impersonating?.childId);
  const freeBalance = balanceQuery.data?.saldo_livre ?? 0;

  const { isLoading, error, refetchAll } = combineQueryStates(prizesQuery, balanceQuery);

  const { data: profile } = useProfile();
  const redeemMutation = useRequestRedemption();

  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hasError = Boolean(error);
  const shouldShowEmptyState = hasError || prizes.length === 0;
  const emptyStateMessage = 'Nenhum prêmio disponível no momento.';

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(child)/prizes') return;
      if (rota === 'index') router.dismissTo('/(child)');
      else router.replace(rota as never);
    },
    [router],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } catch (e) {
      Sentry.captureException(e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRedeem = (prize: Prize) => {
    Alert.alert('Confirmar resgate', `Trocar ${prize.custo_pontos} pontos por "${prize.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resgatar',
        onPress: () => executeRedeem(prize),
      },
    ]);
  };

  const executeRedeem = async (prize: Prize) => {
    setRedemptionError(null);
    setSuccess(null);
    setRedeeming(prize.id);
    try {
      await redeemMutation.mutateAsync({
        prizeId: prize.id,
        opts: profile?.familia_id
          ? {
            familiaId: profile.familia_id,
            childName: profile.nome ?? '',
            prizeName: prize.nome,
            childUserId: profile.id,
          }
          : undefined,
      });
      hapticSuccess();
      setSuccess(`Resgate de "${prize.nome}" solicitado! Aguarde a confirmação.`);
    } catch (e) {
      setRedemptionError(e instanceof Error ? localizeRpcError(e.message) : 'Não foi possível solicitar o resgate.');
    } finally {
      setRedeeming(null);
    }
  };

  const renderContent = () => {
    if (isLoading) return <ListScreenSkeleton />;
    if (shouldShowEmptyState) {
      return (
        <EmptyState
          error={error?.message ?? null}
          empty={!error}
          emptyMessage={emptyStateMessage}
          onRetry={handleRefresh}
        />
      );
    }
    return (
      <FlashList
        data={prizes}
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
        numColumns={2}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={gradients.goldHorizontal.colors}
              start={gradients.goldHorizontal.start}
              end={gradients.goldHorizontal.end}
              style={styles.balanceBanner}
            >
              <Text style={styles.balanceLabel}>Saldo disponível</Text>
              <Text style={styles.balanceValue}>{freeBalance}</Text>
              <Text style={styles.balancePts}>pontos</Text>
            </LinearGradient>
            {redemptionError ? <InlineMessage message={redemptionError} variant="error" /> : null}
            {success ? <InlineMessage message={success} variant="success" /> : null}
          </>
        }
        renderItem={({ item }) => (
          <PrizeCard
            item={item}
            freeBalance={freeBalance}
            redeeming={redeeming}
            onRedeem={handleRedeem}
            isReadOnly={isReadOnly}
          />
        )}
        onEndReached={() => {
          if (prizesQuery.hasNextPage) prizesQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={prizesQuery.isFetchingNextPage} />}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Prêmios" role="filho" />

      {renderContent()}
      <HomeFooterBar
        items={footerItems}
        activeRoute="/(child)/prizes"
        onNavigate={handleFooterNavigate}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      paddingHorizontal: spacing['3'],
      paddingTop: spacing['4'],
      paddingBottom: spacing['12'],
    },
    balanceBanner: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['5'],
      alignItems: 'center',
      marginBottom: spacing['1'],
      gap: spacing['1'],
    },
    balanceLabel: {
      fontSize: typography.size.xs,
      color: colors.text.onBrandMuted,
      fontFamily: typography.family.semibold,
    },
    balanceValue: {
      fontSize: typography.size['3xl'],
      fontFamily: typography.family.black,
      color: colors.text.onBrand,
    },
    balancePts: {
      fontSize: typography.size.xs,
      color: colors.text.onBrandMuted,
      fontFamily: typography.family.medium,
    },
  });
}

type PrizeCardProps = Readonly<{
  item: Prize;
  freeBalance: number;
  redeeming: string | null;
  onRedeem: (item: Prize) => void;
  isReadOnly: boolean;
}>;

function PrizeCard({ item, freeBalance, redeeming, onRedeem, isReadOnly }: PrizeCardProps) {
  const { colors } = useTheme();
  const outOfStock = item.estoque === 0;
  const hasBalance = !outOfStock && freeBalance >= item.custo_pontos;
  const canRedeem = hasBalance && !outOfStock;
  const progress = item.custo_pontos > 0 ? Math.min(freeBalance / item.custo_pontos, 1) : 1;
  const isRedeeming = redeeming === item.id;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progressAnim, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, progressAnim]);

  return (
    <View
      style={[
        cardStyles.card,
        shadows.card,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      {/* Top section — grows to fill space */}
      <View style={cardStyles.cardContent}>
        <View style={[cardStyles.prizePlaceholder, { backgroundColor: colors.accent.filhoBg }]}>
          <Text style={cardStyles.prizeEmoji}>{item.emoji || '🎁'}</Text>
        </View>
        <Text style={[cardStyles.name, { color: colors.text.primary }]} numberOfLines={2}>
          {item.nome}
        </Text>
        {item.descricao ? (
          <Text style={[cardStyles.desc, { color: colors.text.secondary }]} numberOfLines={2}>
            {item.descricao}
          </Text>
        ) : null}
      </View>

      {/* Bottom section — always aligned across cards */}
      <View style={[cardStyles.costBadge, { backgroundColor: colors.accent.filhoBg }]}>
        <Star size={12} color={colors.accent.filho} strokeWidth={2} />
        <Text style={[cardStyles.costText, { color: colors.accent.filho }]}>
          {item.custo_pontos}
        </Text>
      </View>

      <View style={[cardStyles.progressBg, { backgroundColor: colors.bg.muted }]}>
        <Animated.View
          style={[
            cardStyles.progressFill,
            {
              backgroundColor: hasBalance ? colors.semantic.success : colors.accent.filho,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>

      <View
        style={[
          cardStyles.statusRow,
          { backgroundColor: outOfStock ? colors.bg.muted : hasBalance ? colors.semantic.successBg : colors.bg.muted },
        ]}
      >
        {outOfStock ? (
          <Text style={[cardStyles.statusText, { color: colors.text.muted }]}>Esgotado</Text>
        ) : hasBalance ? (
          <View style={cardStyles.statusInner}>
            <CheckCircle2 size={12} color={colors.semantic.success} strokeWidth={2} />
            <Text style={[cardStyles.statusText, { color: colors.semantic.success }]}>
              Disponível!
            </Text>
          </View>
        ) : (
          <Text style={[cardStyles.statusText, { color: colors.text.muted }]}>
            Faltam {item.custo_pontos - freeBalance} pts
          </Text>
        )}
      </View>

      <Button
        variant="primary"
        size="sm"
        label={outOfStock ? 'Indisponível' : canRedeem ? 'Resgatar' : `Faltam ${item.custo_pontos - freeBalance} pts`}
        disabled={!canRedeem || redeeming !== null || isReadOnly}
        loading={isRedeeming}
        loadingLabel="Resgatando…"
        onPress={() => onRedeem(item)}
        accessibilityLabel={
          outOfStock ? `${item.nome} esgotado` : canRedeem ? `Resgatar ${item.nome}` : `Saldo insuficiente para ${item.nome}`
        }
        accessibilityState={{ disabled: !canRedeem || redeeming !== null || isReadOnly }}
      />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: spacing['3'],
    gap: spacing['2'],
    marginHorizontal: spacing['1'],
    marginBottom: spacing['3'],
  },
  cardContent: {
    flex: 1,
    gap: spacing['2'],
  },
  prizePlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeEmoji: {
    fontSize: 36,
  },
  name: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.bold,
  },
  desc: {
    fontSize: typography.size.xs,
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
  progressBg: {
    height: spacing['1'],
    borderRadius: radii.full,
    overflow: 'hidden',
    marginTop: spacing['1'],
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  statusRow: {
    borderRadius: radii.sm,
    paddingVertical: spacing['1'],
    paddingHorizontal: spacing['2'],
    alignSelf: 'flex-start',
  },
  statusInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['0.75'],
  },
  statusText: {
    fontSize: typography.size.xs,
    fontFamily: typography.family.semibold,
  },
});
