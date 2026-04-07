import { Alert, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TrendingUp, PiggyBank } from 'lucide-react-native';
import { hapticSuccess } from '@lib/haptics';
import { formatDate } from '@lib/utils';
import {
  getTransactionTypeLabel,
  isCredit,
  calculateProjection,
} from '@lib/balances';
import {
  useBalance,
  useTransactions,
  useApplyPenalty,
  useConfigureAppreciation,
  combineQueryStates,
  usePendingPiggyBankWithdrawals,
  useConfirmPiggyBankWithdrawal,
  useCancelPiggyBankWithdrawal,
  useConfigureWithdrawalRate,
  useProfile,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { darkColors, radii, spacing, typography, withAlpha } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { PenaltyModal, PenaltyButton } from '@/components/balance/penalty-modal';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { Button } from '@/components/ui/button';
import { SteppedSlider } from '@/components/ui/stepped-slider';
import { calculateNetAmount } from '@lib/piggy-bank-withdrawal';

type ModalType = 'penalizar' | null;

function getBalanceHeaderColors(colors: ThemeColors) {
  const isLight = colors.statusBar === 'dark';
  return {
    bg: isLight ? darkColors.bg.surface : colors.bg.elevated,
    boxBg: isLight ? darkColors.bg.elevated : colors.bg.muted,
    border: isLight ? withAlpha('#FFFFFF', 0.08) : colors.border.subtle,
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.7)',
  };
}

export default function ChildBalanceAdminScreen() {
  const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const balanceQuery = useBalance(filho_id);
  const transactionsQuery = useTransactions(filho_id);
  const { data: profile } = useProfile();
  const { isLoading, isFetching, refetchAll } = combineQueryStates(balanceQuery, transactionsQuery);

  const balance = balanceQuery.data ?? null;
  const transactions = useMemo(
    () => transactionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [transactionsQuery.data],
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = transactionsQuery;

  const [modalType, setModalType] = useState<ModalType>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const visibleSuccess = useTransientMessage(successMessage);

  const penaltyMutation = useApplyPenalty();
  const configureMutation = useConfigureAppreciation();
  const confirmWithdrawalMutation = useConfirmPiggyBankWithdrawal();
  const cancelWithdrawalMutation = useCancelPiggyBankWithdrawal();
  const configureRateMutation = useConfigureWithdrawalRate();

  const [appreciationSlider, setAppreciationSlider] = useState<number | null>(null);
  const [withdrawalSlider, setWithdrawalSlider] = useState<number | null>(null);

  const pendingWithdrawalsQuery = usePendingPiggyBankWithdrawals();
  const pendingWithdrawals = useMemo(
    () => (pendingWithdrawalsQuery.data ?? []).filter((w) => w.filho_id === filho_id),
    [pendingWithdrawalsQuery.data, filho_id],
  );
  const pendingWithdrawal = pendingWithdrawals[0] ?? null;

  const handleRefresh = useCallback(async () => {
    await refetchAll();
  }, [refetchAll]);

  const handlePenalty = useCallback(
    async (amount: number, description: string) => {
      if (!filho_id) return { error: 'ID do filho não encontrado' };
      try {
        const result = await penaltyMutation.mutateAsync({
          childId: filho_id,
          amount,
          description,
        });
        setModalType(null);
        if (result && result.deducted < amount) {
          return {
            error: null,
            warning: `Saldo insuficiente. Apenas ${result.deducted} pts foram debitados.`,
          };
        }
        setSuccessMessage('Penalidade aplicada com sucesso.');
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Erro ao aplicar penalidade.' };
      }
    },
    [filho_id, penaltyMutation],
  );

  const handleConfirmWithdrawal = useCallback(async () => {
    if (!pendingWithdrawal) return;
    const currentRate = balance?.taxa_resgate_cofrinho ?? 0;
    const { net } = calculateNetAmount(pendingWithdrawal.valor_solicitado, currentRate);
    try {
      await confirmWithdrawalMutation.mutateAsync({
        withdrawalId: pendingWithdrawal.id,
        opts: {
          familiaId: profile?.familia_id ?? '',
          userId: pendingWithdrawal.filhos?.usuario_id,
          amount: net,
        },
      });
      hapticSuccess();
      setSuccessMessage('Resgate do cofrinho aprovado com sucesso.');
    } catch (e) {
      setSuccessMessage(e instanceof Error ? e.message : 'Erro ao aprovar resgate.');
    }
  }, [pendingWithdrawal, confirmWithdrawalMutation, profile, balance]);

  const handleRejectWithdrawal = useCallback(() => {
    if (!pendingWithdrawal) return;
    Alert.alert(
      'Rejeitar resgate',
      `Deseja rejeitar o resgate de ${pendingWithdrawal.valor_solicitado} pts do cofrinho?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, rejeitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelWithdrawalMutation.mutateAsync({
                withdrawalId: pendingWithdrawal.id,
                opts: {
                  familiaId: profile?.familia_id ?? '',
                  userId: pendingWithdrawal.filhos?.usuario_id,
                  amount: pendingWithdrawal.valor_solicitado,
                },
              });
              hapticSuccess();
              setSuccessMessage('Resgate do cofrinho rejeitado.');
            } catch (e) {
              setSuccessMessage(e instanceof Error ? e.message : 'Erro ao rejeitar resgate.');
            }
          },
        },
      ],
    );
  }, [pendingWithdrawal, cancelWithdrawalMutation, profile]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <EmptyState loading />
      </View>
    );
  }

  const saldoLivre = balance?.saldo_livre ?? 0;
  const cofrinho = balance?.cofrinho ?? 0;
  const totalPts = saldoLivre + cofrinho;
  const cofrinhoPercent = totalPts > 0 ? Math.round((cofrinho / totalPts) * 100) : 0;
  const appreciationRate = appreciationSlider ?? (balance?.indice_valorizacao ?? 0);
  const withdrawRate = withdrawalSlider ?? (balance?.taxa_resgate_cofrinho ?? 0);
  const projection = calculateProjection(cofrinho, appreciationRate);
  const hasAppreciationConfigured = appreciationRate > 0;
  const header = getBalanceHeaderColors(colors);
  const ultimaValorizacaoTexto = balance?.data_ultima_valorizacao
    ? `Última: ${formatDate(balance.data_ultima_valorizacao)}`
    : '';
  const proximaValorizacaoTexto = balance?.proxima_valorizacao_em
    ? `Próxima: ${formatDate(balance.proxima_valorizacao_em)}`
    : '';

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title={nome ?? 'Filho'} onBack={() => router.back()} />

      <FlashList
        data={transactions}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={
          <>
            {visibleSuccess ? (
              <View style={{ marginBottom: spacing['3'] }}>
                <InlineMessage message={visibleSuccess} variant="success" />
              </View>
            ) : null}
            <View style={[styles.balanceHeader, { backgroundColor: header.bg, borderColor: header.border }]}>
              <View style={styles.balanceHeaderTop}>
                <PiggyBank size={16} color={header.textMuted} strokeWidth={2} />
                <Text style={[styles.balanceHeaderLabel, { color: header.textMuted }]}>
                  SALDO DE {(nome ?? 'FILHO').toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.balanceHeaderTotal, { color: header.text }]}>
                {totalPts.toLocaleString('pt-BR')}
              </Text>
              <Text style={[styles.balanceHeaderSubtitle, { color: header.textMuted }]}>
                pontos disponíveis
              </Text>
              <View style={styles.balanceHeaderBoxes}>
                <View style={[styles.balanceHeaderBox, { backgroundColor: header.boxBg }]}>
                  <Text style={[styles.balanceHeaderBoxLabel, { color: header.textMuted }]}>LIVRE</Text>
                  <Text style={[styles.balanceHeaderBoxValue, { color: header.text }]}>
                    {saldoLivre.toLocaleString('pt-BR')}
                  </Text>
                </View>
                <View style={[styles.balanceHeaderBox, { backgroundColor: header.boxBg }]}>
                  <Text style={[styles.balanceHeaderBoxLabel, { color: header.textMuted }]}>COFRINHO</Text>
                  <Text style={[styles.balanceHeaderBoxValue, { color: header.text }]}>
                    {cofrinho.toLocaleString('pt-BR')}
                  </Text>
                </View>
              </View>
              {totalPts > 0 ? (
                <View style={styles.balanceHeaderProgress}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFillLeft,
                        {
                          flex: 100 - cofrinhoPercent,
                          backgroundColor: colors.accent.adminDim,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.progressFillRight,
                        {
                          flex: cofrinhoPercent,
                          backgroundColor: colors.semantic.warning,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={[styles.progressLabel, { color: header.textMuted }]}>
                      {100 - cofrinhoPercent}% livre
                    </Text>
                    <Text style={[styles.progressLabel, { color: header.textMuted }]}>
                      {cofrinhoPercent}% cofrinho
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.boxConfig}>
              <View style={styles.boxConfigTituloRow}>
                <TrendingUp size={16} color={colors.text.primary} strokeWidth={2} />
                <Text style={styles.boxConfigTitulo}>Valorização do cofrinho</Text>
              </View>
              <SteppedSlider
                value={appreciationRate}
                onValueChange={setAppreciationSlider}
                onSlidingComplete={(rate) => {
                  if (!filho_id) return;
                  configureMutation.mutate(
                    { childId: filho_id, rate },
                    {
                      onSuccess: () => {
                        hapticSuccess();
                        setSuccessMessage(`Valorização configurada para ${rate}% ao mês.`);
                      },
                      onSettled: () => setAppreciationSlider(null),
                    },
                  );
                }}
                accessibilityLabel="Índice de valorização do cofrinho"
              />
              {hasAppreciationConfigured && cofrinho > 0 ? (
                <View style={styles.projectionBox}>
                  <TrendingUp size={14} color={colors.semantic.success} strokeWidth={2} />
                  <Text style={[styles.projectionText, { color: colors.semantic.success }]}>
                    Projeção: +{projection} pts no próximo mês
                  </Text>
                </View>
              ) : null}
              {hasAppreciationConfigured && cofrinho > 0 ? (
                <Text style={styles.boxConfigAjuda}>
                  Sobre {cofrinho} pts no cofrinho a {appreciationRate}%
                </Text>
              ) : null}
              {ultimaValorizacaoTexto || proximaValorizacaoTexto ? (
                <Text style={styles.boxConfigAjuda}>
                  {[ultimaValorizacaoTexto, proximaValorizacaoTexto].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              <Text style={styles.boxConfigAjuda}>
                A valorização é lançada automaticamente no cofrinho quando o período vence.
              </Text>
            </View>

            {pendingWithdrawal ? (() => {
              const currentRate = balance?.taxa_resgate_cofrinho ?? 0;
              const storedRate = pendingWithdrawal.taxa_aplicada;
              const rateChanged = storedRate !== currentRate;
              const { net: expectedNet } = calculateNetAmount(pendingWithdrawal.valor_solicitado, currentRate);
              return (
              <View style={styles.pendingBanner}>
                <View style={styles.pendingBannerHeader}>
                  <PiggyBank size={16} color={colors.semantic.warning} strokeWidth={2} />
                  <Text style={styles.pendingBannerTitle}>Resgate do cofrinho pendente</Text>
                </View>
                <Text style={styles.pendingBannerText}>
                  {nome ?? 'Filho'} quer retirar{' '}
                  <Text style={{ fontFamily: typography.family.bold }}>
                    {pendingWithdrawal.valor_solicitado}
                  </Text>{' '}
                  pts do cofrinho. Taxa atual: {currentRate}% → receberá{' '}
                  <Text style={{ fontFamily: typography.family.bold }}>
                    ~{expectedNet}
                  </Text>{' '}
                  pts.
                </Text>
                {rateChanged ? (
                  <Text style={[styles.pendingBannerText, { fontStyle: 'italic', marginTop: spacing['1'] }]}>
                    A taxa mudou de {storedRate}% para {currentRate}% desde a solicitação.
                  </Text>
                ) : null}
                <View style={styles.pendingBtns}>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="outline"
                      label="Rejeitar"
                      loading={cancelWithdrawalMutation.isPending}
                      loadingLabel="Rejeitando…"
                      onPress={handleRejectWithdrawal}
                      accessibilityLabel="Rejeitar resgate do cofrinho"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="primary"
                      label="Aprovar"
                      loading={confirmWithdrawalMutation.isPending}
                      loadingLabel="Aprovando…"
                      onPress={handleConfirmWithdrawal}
                      accessibilityLabel="Aprovar resgate do cofrinho"
                    />
                  </View>
                </View>
              </View>
              );
            })() : null}

            <View style={styles.boxConfig}>
              <View style={styles.boxConfigTituloRow}>
                <PiggyBank size={16} color={colors.text.primary} strokeWidth={2} />
                <Text style={styles.boxConfigTitulo}>Taxa de resgate do cofrinho</Text>
              </View>
              <SteppedSlider
                value={withdrawRate}
                onValueChange={setWithdrawalSlider}
                onSlidingComplete={(rate) => {
                  if (!filho_id) return;
                  configureRateMutation.mutate(
                    { childId: filho_id, rate },
                    {
                      onSuccess: () => {
                        hapticSuccess();
                        setSuccessMessage(`Taxa de resgate configurada para ${rate}%.`);
                      },
                      onSettled: () => setWithdrawalSlider(null),
                    },
                  );
                }}
                accessibilityLabel="Taxa de resgate do cofrinho"
              />
              {cofrinho > 0 ? (
                <Text style={styles.boxConfigAjuda}>
                  Ex: {cofrinho} pts → recebe{' '}
                  {Math.round(cofrinho * (1 - withdrawRate / 100))} pts
                </Text>
              ) : null}
            </View>

            <PenaltyButton onPress={() => setModalType('penalizar')} />

            <Text style={styles.secaoTitulo}>Histórico</Text>
            {transactions.length === 0 ? (
              <Text style={styles.vazio}>Nenhuma movimentação ainda.</Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.movItem}>
            <TransactionIcon type={item.tipo} style={styles.movIconBox} />
            <View style={styles.movInfo}>
              <Text style={styles.movLabel}>{getTransactionTypeLabel(item.tipo)}</Text>
              <Text style={styles.movDesc} numberOfLines={1}>
                {item.descricao}
              </Text>
              <Text style={styles.movData}>
                {formatDate(item.created_at)}
              </Text>
            </View>
            <Text
              style={[styles.movValor, isCredit(item.tipo) ? styles.creditoTxt : styles.debitoTxt]}
            >
              {isCredit(item.tipo) ? '+' : '-'}
              {item.valor}
            </Text>
          </View>
        )}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
      />

      <PenaltyModal
        visible={modalType === 'penalizar'}
        childName={nome ?? 'Filho'}
        onClose={() => setModalType(null)}
        onApply={handlePenalty}
      />

    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    balanceHeader: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['5'],
      marginBottom: spacing['4'],
      gap: spacing['1'],
    },
    balanceHeaderTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
      marginBottom: spacing['1'],
    },
    balanceHeaderLabel: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
      letterSpacing: 0.5,
    },
    balanceHeaderTotal: {
      fontFamily: typography.family.black,
      fontSize: typography.size['4xl'],
      lineHeight: typography.lineHeight['4xl'],
      fontVariant: ['tabular-nums'],
    },
    balanceHeaderSubtitle: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      marginBottom: spacing['3'],
    },
    balanceHeaderBoxes: { flexDirection: 'row', gap: spacing['3'] },
    balanceHeaderBox: {
      flex: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['4'],
      alignItems: 'center',
      gap: spacing['0.5'],
    },
    balanceHeaderBoxLabel: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xxs,
      letterSpacing: 0.5,
    },
    balanceHeaderBoxValue: {
      fontFamily: typography.family.black,
      fontSize: typography.size.xl,
      fontVariant: ['tabular-nums'],
    },
    boxConfig: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: spacing['4'],
      marginBottom: spacing['3'],
    },
    boxConfigTituloRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
      marginBottom: spacing['1'],
    },
    boxConfigTitulo: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    balanceHeaderProgress: {
      marginTop: spacing['3'],
      gap: spacing['1'],
    },
    progressTrack: {
      flexDirection: 'row',
      height: 8,
      borderRadius: radii.full,
      overflow: 'hidden',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      gap: 2,
    },
    progressFillLeft: {
      borderTopLeftRadius: radii.full,
      borderBottomLeftRadius: radii.full,
    },
    progressFillRight: {
      borderTopRightRadius: radii.full,
      borderBottomRightRadius: radii.full,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      fontVariant: ['tabular-nums'],
    },
    projectionBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
      marginTop: spacing['2'],
    },
    projectionText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
    },
    boxConfigAjuda: {
      color: colors.text.muted,
      fontSize: typography.size.xs,
      marginTop: spacing['2'],
    },
    secaoTitulo: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
      marginTop: spacing['2'],
      marginBottom: spacing['3'],
    },
    vazio: {
      color: colors.text.muted,
      fontSize: typography.size.sm,
      textAlign: 'center',
      marginTop: spacing['2'],
    },
    movItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      padding: spacing['3'],
      marginBottom: spacing['2'],
    },
    movIconBox: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing['3'],
    },
    movInfo: { flex: 1 },
    movLabel: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
    },
    movDesc: {
      fontSize: typography.size.xs,
      color: colors.text.secondary,
      marginTop: spacing['1'],
    },
    movData: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: spacing['1'] },
    movValor: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    creditoTxt: { color: colors.semantic.success },
    debitoTxt: { color: colors.semantic.error },
    pendingBanner: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      marginBottom: spacing['3'],
      gap: spacing['2'],
    },
    pendingBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
    },
    pendingBannerTitle: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    pendingBannerText: {
      fontSize: typography.size.sm,
      color: colors.text.secondary,
    },
    pendingBtns: {
      flexDirection: 'row',
      gap: spacing['3'],
      marginTop: spacing['1'],
    },
  });
}
