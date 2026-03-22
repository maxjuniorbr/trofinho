import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, CheckCircle2 } from 'lucide-react-native';
import {
  listActivePrizes,
  requestRedemption,
  type Prize,
} from '@lib/prizes';
import { getBalance } from '@lib/balances';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';

export default function ChildPrizesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [freeBalance, setFreeBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasError = Boolean(error);
  const shouldShowEmptyState = loading || hasError || prizes.length === 0;
  const emptyStateMessage = 'Nenhum prêmio disponível no momento.\nPergunte ao responsável!';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRedemptionError(null);
    setSuccess(null);
    try {
      const [{ data: prizeList, error: prizesError }, { data: balanceData, error: balanceError }] =
        await Promise.all([listActivePrizes(), getBalance()]);
      if (prizesError) { setError(prizesError); } else { setPrizes(prizeList); }
      setFreeBalance(balanceData?.saldo_livre ?? 0);
      if (balanceError && !prizesError) setError(balanceError);
    } catch {
      setError('Não foi possível carregar os prêmios agora.');
      setPrizes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleRedeem(prize: Prize) {
    setRedemptionError(null);
    setSuccess(null);
    setRedeeming(prize.id);
    const { error } = await requestRedemption(prize.id);
    setRedeeming(null);
    if (error) {
      setRedemptionError(error);
    } else {
      setSuccess(`Resgate de "${prize.nome}" solicitado! Aguarde a confirmação.`);
      setFreeBalance((prev) => prev - prize.custo_pontos);
    }
  }

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Meus Prêmios" onBack={() => router.back()} backLabel="Início" role="filho" />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={loading}
          error={error}
          empty={!loading && !error}
          emptyMessage={emptyStateMessage}
          onRetry={loadData}
        />
      ) : (
        <FlatList
          data={prizes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing['3'] }}
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
    list: { padding: spacing['4'], gap: spacing['3'], paddingBottom: spacing['12'] },
    balanceBanner: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['5'],
      alignItems: 'center',
      marginBottom: spacing['1'],
      gap: spacing['1'],
    },
    balanceLabel: { fontSize: typography.size.xs, color: colors.text.onBrandMuted, fontFamily: typography.family.semibold },
    balanceValue: { fontSize: typography.size['3xl'], fontFamily: typography.family.black, color: colors.text.onBrand },
    balancePts: { fontSize: typography.size.xs, color: colors.text.onBrandMuted, fontFamily: typography.family.medium },
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
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={[cardStyles.card, shadows.card, { backgroundColor: colors.bg.surface }]}>
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

      <View style={[cardStyles.statusRow, { backgroundColor: hasBalance ? colors.semantic.successBg : colors.bg.muted }]}>
        {hasBalance ? (
          <View style={cardStyles.statusInner}>
            <CheckCircle2 size={12} color={colors.semantic.success} strokeWidth={2} />
            <Text style={[cardStyles.statusText, { color: colors.semantic.success }]}>Disponível!</Text>
          </View>
        ) : (
          <Text style={[cardStyles.statusText, { color: colors.text.muted }]}>
            Faltam {item.custo_pontos - freeBalance} pts
          </Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          cardStyles.button,
          { backgroundColor: hasBalance ? colors.accent.filho : colors.accent.filhoBg },
          (!hasBalance || redeeming !== null) && cardStyles.disabledButton,
          pressed && hasBalance && !redeeming && { opacity: 0.85 },
        ]}
        onPress={() => onRedeem(item)}
        disabled={!hasBalance || redeeming !== null}
        accessibilityRole="button"
        accessibilityLabel={hasBalance ? `Resgatar ${item.nome}` : `Saldo insuficiente para ${item.nome}`}
        accessibilityState={{ disabled: !hasBalance || redeeming !== null }}
      >
        {isRedeeming ? (
          <ActivityIndicator size="small" color={colors.text.inverse} />
        ) : (
          <Text style={[cardStyles.buttonText, { color: colors.text.inverse }]}>
            {hasBalance ? 'Resgatar' : 'Sem saldo'}
          </Text>
        )}
      </Pressable>
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
  button: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    paddingVertical: spacing['2'],
    alignItems: 'center',
    marginTop: spacing['1'],
    minHeight: 44,
    justifyContent: 'center',
  },
  disabledButton: { opacity: 0.5 },
  buttonText: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.xs,
  },
});
