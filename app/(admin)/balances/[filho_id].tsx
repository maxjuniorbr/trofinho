import { Alert, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Wallet, TrendingUp, PiggyBank } from 'lucide-react-native';
import { hapticSuccess } from '@lib/haptics';
import { formatDate } from '@lib/utils';
import {
  getTransactionTypeLabel,
  getAppreciationPeriodLabel,
  isCredit,
  type AppreciationPeriod,
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
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { PenaltyModal, PenaltyButton } from '@/components/balance/penalty-modal';
import { AppreciationModal } from '@/components/balance/appreciation-modal';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { Button } from '@/components/ui/button';

type ModalType = 'penalizar' | 'valorizacao_config' | null;

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

  const handleConfigure = useCallback(
    async (rate: number, period: AppreciationPeriod) => {
      if (!filho_id) return { error: 'ID do filho não encontrado' };
      try {
        await configureMutation.mutateAsync({ childId: filho_id, rate, period });
        setModalType(null);
        setSuccessMessage('Valorização configurada com sucesso.');
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Erro ao configurar valorização.' };
      }
    },
    [filho_id, configureMutation],
  );

  const handleConfirmWithdrawal = useCallback(async () => {
    if (!pendingWithdrawal) return;
    try {
      await confirmWithdrawalMutation.mutateAsync({
        withdrawalId: pendingWithdrawal.id,
        opts: {
          familiaId: profile?.familia_id ?? '',
          userId: pendingWithdrawal.filhos?.usuario_id,
          amount: pendingWithdrawal.valor_liquido,
        },
      });
      hapticSuccess();
      setSuccessMessage('Resgate do cofrinho aprovado com sucesso.');
    } catch (e) {
      setSuccessMessage(e instanceof Error ? e.message : 'Erro ao aprovar resgate.');
    }
  }, [pendingWithdrawal, confirmWithdrawalMutation, profile]);

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
  const periodoAtual = balance ? getAppreciationPeriodLabel(balance.periodo_valorizacao) : null;
  const hasAppreciationConfigured = (balance?.indice_valorizacao ?? 0) > 0;
  const ultimaValorizacaoTexto = balance?.data_ultima_valorizacao
    ? ` · última em ${formatDate(balance.data_ultima_valorizacao)}`
    : '';
  const proximaValorizacaoTexto = balance?.proxima_valorizacao_em
    ? ` · próxima em ${formatDate(balance.proxima_valorizacao_em)}`
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
            <View style={styles.cardsRow}>
              <View style={[styles.saldoCard, { backgroundColor: colors.accent.adminDim }]}>
                <View style={styles.saldoLabelRow}>
                  <Wallet size={14} color={colors.text.inverseMuted} strokeWidth={2} />
                  <Text style={styles.saldoLabel}>Saldo livre</Text>
                </View>
                <Text style={styles.saldoValor}>{saldoLivre}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </View>
              <View style={[styles.saldoCard, { backgroundColor: colors.semantic.warning }]}>
                <View style={styles.saldoLabelRow}>
                  <Wallet size={14} color={colors.text.inverseMuted} strokeWidth={2} />
                  <Text style={styles.saldoLabel}>Cofrinho</Text>
                </View>
                <Text style={styles.saldoValor}>{cofrinho}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </View>
            </View>

            <View style={styles.boxConfig}>
              <View style={styles.boxConfigTituloRow}>
                <TrendingUp size={16} color={colors.text.primary} strokeWidth={2} />
                <Text style={styles.boxConfigTitulo}>Valorização do cofrinho</Text>
              </View>
              {hasAppreciationConfigured ? (
                <Text style={styles.boxConfigTexto}>
                  {balance!.indice_valorizacao}% ao {periodoAtual}
                  {ultimaValorizacaoTexto}
                  {proximaValorizacaoTexto}
                </Text>
              ) : (
                <Text style={styles.boxConfigTexto}>Não configurada</Text>
              )}
              <View style={styles.acoesBtns}>
                <Pressable
                  style={styles.btnAcao}
                  onPress={() => setModalType('valorizacao_config')}
                  accessibilityRole="button"
                  accessibilityLabel="Configurar valorização"
                >
                  <Text style={styles.btnAcaoTexto}>Configurar</Text>
                </Pressable>
              </View>
              <Text style={styles.boxConfigAjuda}>
                A valorização é lançada automaticamente no cofrinho quando o período vence.
              </Text>
            </View>

            {pendingWithdrawal ? (
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
                  pts do cofrinho. Taxa: {pendingWithdrawal.taxa_aplicada}% → receberá{' '}
                  <Text style={{ fontFamily: typography.family.bold }}>
                    {pendingWithdrawal.valor_liquido}
                  </Text>{' '}
                  pts.
                </Text>
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
            ) : null}

            <View style={styles.boxConfig}>
              <View style={styles.boxConfigTituloRow}>
                <PiggyBank size={16} color={colors.text.primary} strokeWidth={2} />
                <Text style={styles.boxConfigTitulo}>Taxa de resgate do cofrinho</Text>
              </View>
              <Text style={styles.boxConfigTexto}>
                {balance?.taxa_resgate_cofrinho ?? 10}% do valor é descontado ao aprovar um resgate
              </Text>
              <View style={styles.acoesBtns}>
                {[0, 10, 25, 50].map((rate) => {
                  const isActive = (balance?.taxa_resgate_cofrinho ?? 10) === rate;
                  return (
                    <Pressable
                      key={rate}
                      style={[
                        styles.btnAcao,
                        isActive ? { backgroundColor: colors.accent.admin } : undefined,
                      ]}
                      onPress={() => {
                        if (isActive || !filho_id) return;
                        configureRateMutation.mutate(
                          { childId: filho_id, rate },
                          {
                            onSuccess: () => {
                              hapticSuccess();
                              setSuccessMessage(`Taxa de resgate configurada para ${rate}%.`);
                            },
                          },
                        );
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Taxa de resgate ${rate}%`}
                    >
                      <Text
                        style={[
                          styles.btnAcaoTexto,
                          isActive ? { color: colors.text.inverse } : undefined,
                        ]}
                      >
                        {rate}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
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

      <AppreciationModal
        visible={modalType === 'valorizacao_config'}
        initialRate={balance?.indice_valorizacao ?? 0}
        initialPeriod={balance?.periodo_valorizacao ?? 'mensal'}
        onClose={() => setModalType(null)}
        onSave={handleConfigure}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    cardsRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['4'] },
    saldoCard: {
      flex: 1,
      borderRadius: radii.xl,
      padding: spacing['4'],
      alignItems: 'center',
      ...shadows.card,
    },
    saldoLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['1'],
    },
    saldoLabel: {
      color: colors.text.inverseMuted,
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    saldoValor: {
      color: colors.text.inverse,
      fontSize: typography.size['4xl'],
      fontFamily: typography.family.extrabold,
    },
    saldoPts: {
      color: colors.text.inverseSubtle,
      fontSize: typography.size.xs,
      marginTop: spacing['1'],
    },
    boxConfig: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['3'],
      ...shadows.card,
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
    boxConfigTexto: {
      fontSize: typography.size.sm,
      color: colors.text.secondary,
      marginBottom: spacing['3'],
    },
    acoesBtns: { flexDirection: 'row', gap: spacing['2'] },
    btnAcao: {
      backgroundColor: colors.accent.adminBg,
      borderRadius: radii.md,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['3'],
      minHeight: 44,
      justifyContent: 'center',
    },
    btnAcaoTexto: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
      color: colors.accent.admin,
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
