import * as Sentry from '@sentry/react-native';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  Animated,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { hapticSuccess } from '@lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, CheckCircle2 } from 'lucide-react-native';
import type { Prize } from '@lib/prizes';
import {
  useActivePrizes,
  useBalance,
  useRequestRedemption,
  useProfile,
  combineQueryStates,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';

export default function ChildPrizesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const prizesQuery = useActivePrizes();
  const prizes = prizesQuery.data ?? [];

  const balanceQuery = useBalance();
  const freeBalance = balanceQuery.data?.saldo_livre ?? 0;

  const { isLoading, error, refetchAll } = combineQueryStates(prizesQuery, balanceQuery);

  const { data: profile } = useProfile();
  const redeemMutation = useRequestRedemption();

  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hasError = Boolean(error);
  const shouldShowEmptyState = isLoading || hasError || prizes.length === 0;
  const emptyStateMessage = 'Nenhum prêmio disponível no momento.\nPergunte ao responsável! 🎯';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRedeem = (prize: Prize) => {
    Alert.alert(
      'Confirmar resgate',
      `Trocar ${prize.custo_pontos} pontos por "${prize.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resgatar',
          onPress: () => executeRedeem(prize),
        },
      ],
    );
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
      setSuccess(`Resgate de "${prize.nome}" solicitado! Aguarde a confirmação 🎉`);
    } catch (e) {
      setRedemptionError(e instanceof Error ? e.message : 'Não foi possível solicitar o resgate.');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Meus Prêmios"
        onBack={() => router.back()}
        backLabel="Início"
        role="filho"
      />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={isLoading}
          error={error?.message ?? null}
          empty={!isLoading && !error}
          emptyMessage={emptyStateMessage}
          onRetry={handleRefresh}
        />
      ) : (
        <FlashList
          data={prizes}
          keyExtractor={(item) => item.id}
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
            />
          )}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { paddingHorizontal: spacing['3'], paddingTop: spacing['4'], paddingBottom: spacing['12'] },
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
}>;

function PrizeCard({ item, freeBalance, redeeming, onRedeem }: PrizeCardProps) {
  const { colors } = useTheme();
  const hasBalance = freeBalance >= item.custo_pontos;
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
    <View style={[cardStyles.card, shadows.card, { backgroundColor: colors.bg.surface }]}>
      {item.imagem_url ? (
        <Image
          source={item.imagem_url}
          style={cardStyles.prizeImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[cardStyles.prizePlaceholder, { backgroundColor: colors.accent.filhoBg }]}>
          <Trophy size={28} color={colors.accent.filho} strokeWidth={1.5} />
        </View>
      )}
      <Text style={[cardStyles.name, { color: colors.text.primary }]} numberOfLines={2}>
        {item.nome}
      </Text>
      {item.descricao ? (
        <Text style={[cardStyles.desc, { color: colors.text.secondary }]} numberOfLines={2}>
          {item.descricao}
        </Text>
      ) : null}
      <View style={cardStyles.costRow}>
        <Trophy size={12} color={colors.accent.filho} strokeWidth={2} />
        <Text style={[cardStyles.cost, { color: colors.accent.filho }]}>
          {item.custo_pontos} pts
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
          { backgroundColor: hasBalance ? colors.semantic.successBg : colors.bg.muted },
        ]}
      >
        {hasBalance ? (
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
        label={hasBalance ? 'Resgatar' : `Faltam ${item.custo_pontos - freeBalance} pts`}
        disabled={!hasBalance || redeeming !== null}
        loading={isRedeeming}
        loadingLabel="Resgatando…"
        onPress={() => onRedeem(item)}
        accessibilityLabel={
          hasBalance ? `Resgatar ${item.nome}` : `Saldo insuficiente para ${item.nome}`
        }
        accessibilityState={{ disabled: !hasBalance || redeeming !== null }}
      />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    padding: spacing['3'],
    gap: spacing['2'],
    marginHorizontal: spacing['1'],
    marginBottom: spacing['3'],
  },
  prizeImage: {
    width: '100%',
    height: 80,
    borderRadius: radii.lg,
  },
  prizePlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.bold,
  },
  desc: {
    fontSize: typography.size.xs,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
  },
  cost: {
    fontSize: typography.size.xs,
    fontFamily: typography.family.bold,
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
