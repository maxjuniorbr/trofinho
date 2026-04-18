import { Alert, StyleSheet, Text, View, RefreshControl, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TrendingUp, PiggyBank, Settings, Wallet, AlertTriangle, ChevronLeft } from 'lucide-react-native';
import { hapticSuccess } from '@lib/haptics';
import { formatDate } from '@lib/utils';
import { getTransactionTypeLabel, isCredit, calculateProjection } from '@lib/balances';
import {
  useBalance,
  useTransactions,
  useApplyPenalty,
  useConfigurePiggyBank,
  combineQueryStates,
  usePendingPiggyBankWithdrawals,
  useConfirmPiggyBankWithdrawal,
  useCancelPiggyBankWithdrawal,
  useProfile,
  useChildDetail,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography, gradients } from '@/constants/theme';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { PenaltyModal, PenaltyButton } from '@/components/balance/penalty-modal';
import { PiggyConfigSheet } from '@/components/balance/piggy-config-sheet';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { InlineMessage } from '@/components/ui/inline-message';
import { Button } from '@/components/ui/button';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateNetAmount } from '@lib/piggy-bank-withdrawal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeHorizontalPadding, getSafeTopPadding } from '@lib/safe-area';

type ModalType = 'penalizar' | 'config' | null;

const RECENT_LIMIT = 10;

export default function ChildBalanceAdminScreen() {
  const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const balanceQuery = useBalance(filho_id);
  const transactionsQuery = useTransactions(filho_id);
  const { data: profile } = useProfile();
  const { data: childDetail } = useChildDetail(filho_id);
  const { isLoading, isFetching, refetchAll } = combineQueryStates(balanceQuery, transactionsQuery);

  const balance = balanceQuery.data ?? null;
  const transactions = useMemo(
    () => transactionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [transactionsQuery.data],
  );
  const recentTransactions = useMemo(
    () => transactions.slice(0, RECENT_LIMIT),
    [transactions],
  );


  const [modalType, setModalType] = useState<ModalType>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const visibleSuccess = useTransientMessage(successMessage);

  const penaltyMutation = useApplyPenalty();
  const configurePiggyMutation = useConfigurePiggyBank();
  const confirmWithdrawalMutation = useConfirmPiggyBankWithdrawal();
  const cancelWithdrawalMutation = useCancelPiggyBankWithdrawal();

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

  const handleSavePiggyConfig = useCallback(
    async ({
      rate,
      withdrawalRate: nextWithdrawal,
      prazo,
    }: {
      rate: number;
      withdrawalRate: number;
      prazo: number;
    }) => {
      if (!filho_id) return;
      await configurePiggyMutation.mutateAsync({
        childId: filho_id,
        rate,
        withdrawalRate: nextWithdrawal,
        prazo,
      });
      setSuccessMessage('Configuração do cofrinho atualizada.');
    },
    [filho_id, configurePiggyMutation],
  );

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
  const appreciationRate = balance?.indice_valorizacao ?? 0;
  const withdrawRate = balance?.taxa_resgate_cofrinho ?? 0;
  const prazoBloqueio = balance?.prazo_bloqueio_dias ?? 7;
  const projection = calculateProjection(cofrinho, appreciationRate);
  const hasAppreciationConfigured = appreciationRate > 0;
  const childName = nome ?? childDetail?.nome ?? 'Filho';
  const childAvatar = childDetail?.avatar_url ?? null;

  const pendingWithdrawalBanner = (() => {
    if (!pendingWithdrawal) return null;
    const currentRate = balance?.taxa_resgate_cofrinho ?? 0;
    const storedRate = pendingWithdrawal.taxa_aplicada;
    const rateChanged = storedRate !== currentRate;
    const { net: expectedNet } = calculateNetAmount(
      pendingWithdrawal.valor_solicitado,
      currentRate,
    );
    return (
      <View style={styles.pendingBanner}>
        <View style={styles.pendingBannerHeader}>
          <PiggyBank size={16} color={colors.semantic.warning} strokeWidth={2} />
          <Text style={styles.pendingBannerTitle}>Resgate do cofrinho pendente</Text>
        </View>
        <Text style={styles.pendingBannerText}>
          {childName} quer retirar{' '}
          <Text style={{ fontFamily: typography.family.bold }}>
            {pendingWithdrawal.valor_solicitado}
          </Text>{' '}
          pts do cofrinho. Taxa atual: {currentRate}% → receberá{' '}
          <Text style={{ fontFamily: typography.family.bold }}>~{expectedNet}</Text> pts.
        </Text>
        {rateChanged ? (
          <Text
            style={[styles.pendingBannerText, { fontStyle: 'italic', marginTop: spacing['1'] }]}
          >
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
  })();

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />

      {/* Custom header: back + avatar + name + gear */}
      <View
        style={[
          styles.customHeader,
          {
            paddingTop: getSafeTopPadding(insets, spacing['3']),
            ...getSafeHorizontalPadding(insets, spacing['4']),
            backgroundColor: colors.bg.surface,
            borderBottomColor: colors.border.subtle,
          },
        ]}
      >
        <HeaderIconButton
          icon={ChevronLeft}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(admin)/');
            }
          }}
          accessibilityLabel="Voltar"
        />
        <View style={styles.headerCenter}>
          <Avatar name={childName} size={32} imageUri={childAvatar} />
          <Text style={[styles.headerName, { color: colors.text.primary }]} numberOfLines={1}>
            {childName}
          </Text>
        </View>
        <HeaderIconButton
          icon={Settings}
          onPress={() => setModalType('config')}
          accessibilityLabel="Configurar cofrinho"
        />
      </View>

      <FlashList
        data={recentTransactions}
        keyExtractor={(m) => m.id}
        maintainVisibleContentPosition={{ disabled: true }}
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

            {/* Two side-by-side balance cards */}
            <View style={styles.balanceCards}>
              <LinearGradient
                colors={gradients.gold.colors}
                start={gradients.gold.start}
                end={gradients.gold.end}
                style={styles.balanceCard}
              >
                <View style={styles.balanceCardTop}>
                  <Wallet size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                  <Text style={styles.balanceCardLabel}>SALDO LIVRE</Text>
                </View>
                <Text style={styles.balanceCardValue}>
                  {saldoLivre.toLocaleString('pt-BR')}
                </Text>
                <Text style={styles.balanceCardUnit}>pontos</Text>
              </LinearGradient>

              <View
                style={[
                  styles.balanceCard,
                  styles.cofrinhoCard,
                  { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                ]}
              >
                <View style={styles.balanceCardTop}>
                  <PiggyBank size={14} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[styles.balanceCardLabel, { color: colors.text.muted }]}>
                    COFRINHO
                  </Text>
                </View>
                <Text style={[styles.balanceCardValue, { color: colors.text.primary }]}>
                  {cofrinho.toLocaleString('pt-BR')}
                </Text>
                <Text style={[styles.balanceCardUnit, { color: colors.text.muted }]}>pontos</Text>
              </View>
            </View>

            {/* Progress bar */}
            {totalPts > 0 ? (
              <View style={styles.progressSection}>
                <View style={[styles.progressTrack, { backgroundColor: colors.bg.muted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { flex: cofrinhoPercent, backgroundColor: colors.brand.vivid },
                    ]}
                  />
                  <View style={{ flex: 100 - cofrinhoPercent }} />
                </View>
                <Text style={[styles.progressLabel, { color: colors.text.muted }]}>
                  {cofrinhoPercent}% no cofrinho
                </Text>
              </View>
            ) : null}

            {/* Piggy rules summary card (read-only) */}
            <View
              style={[
                styles.rulesCard,
                { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
              ]}
            >
              <View style={styles.rulesCardHeader}>
                <View style={[styles.rulesIconBox, { backgroundColor: colors.semantic.successBg }]}>
                  <TrendingUp size={16} color={colors.semantic.success} strokeWidth={2} />
                </View>
                <Text style={[styles.rulesTitle, { color: colors.text.primary }]}>
                  Regras do cofrinho
                </Text>
              </View>

              {hasAppreciationConfigured ? (
                <>
                  <View style={styles.rulesRateRow}>
                    <Text style={[styles.rulesRateValue, { color: colors.text.primary }]}>
                      {appreciationRate}%
                    </Text>
                    <Text style={[styles.rulesRateUnit, { color: colors.text.muted }]}>
                      ao mês
                    </Text>
                  </View>
                  {projection > 0 && cofrinho > 0 ? (
                    <View
                      style={[
                        styles.projectionBox,
                        { backgroundColor: colors.semantic.successBg },
                      ]}
                    >
                      <View style={styles.projectionRow}>
                        <TrendingUp size={12} color={colors.semantic.successText} strokeWidth={2} />
                        <Text
                          style={[styles.projectionText, { color: colors.semantic.successText }]}
                        >
                          Projeção: +{projection} pts no próximo mês
                        </Text>
                      </View>
                      <Text
                        style={[styles.projectionDetail, { color: colors.semantic.successText }]}
                      >
                        Sobre {cofrinho} pts no cofrinho a {appreciationRate}%
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.noAppreciationRow}>
                  <AlertTriangle size={16} color={colors.semantic.warning} strokeWidth={2} />
                  <Text style={[styles.noAppreciationText, { color: colors.text.muted }]}>
                    Rendimento não configurado
                  </Text>
                </View>
              )}

              <View style={styles.rulesStatsRow}>
                <View style={[styles.rulesStat, { backgroundColor: colors.bg.muted }]}>
                  <Text style={[styles.rulesStatLabel, { color: colors.text.muted }]}>
                    TAXA DE SAQUE
                  </Text>
                  <Text style={[styles.rulesStatValue, { color: colors.semantic.warning }]}>
                    -{withdrawRate}%
                  </Text>
                </View>
                <View style={[styles.rulesStat, { backgroundColor: colors.bg.muted }]}>
                  <Text style={[styles.rulesStatLabel, { color: colors.text.muted }]}>
                    SEM TAXA APÓS
                  </Text>
                  <Text style={[styles.rulesStatValue, { color: colors.semantic.success }]}>
                    {prazoBloqueio} dias
                  </Text>
                </View>
              </View>
            </View>

            {/* Pending withdrawal banner */}
            {pendingWithdrawalBanner}

            {/* Penalty button */}
            <PenaltyButton onPress={() => setModalType('penalizar')} />

            <View style={styles.historicoHeader}>
              <Text style={styles.secaoTitulo}>Histórico</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/balances/[filho_id]/historico',
                    params: { filho_id, nome: childName },
                  })
                }
                accessibilityRole="link"
                accessibilityLabel="Ver histórico completo"
                hitSlop={8}
              >
                <Text style={[styles.historicoLink, { color: colors.accent.adminDim }]}>
                  Ver completo →
                </Text>
              </Pressable>
            </View>
            {recentTransactions.length === 0 ? (
              <Text style={styles.vazio}>Nenhuma movimentação ainda.</Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={[styles.movItem, { borderBottomColor: colors.border.subtle }]}>
            <TransactionIcon type={item.tipo} style={styles.movIconBox} />
            <View style={styles.movInfo}>
              <Text style={styles.movLabel}>{getTransactionTypeLabel(item.tipo)}</Text>
              <Text style={styles.movDesc} numberOfLines={1}>
                {item.descricao}
              </Text>
            </View>
            <View style={styles.movRight}>
              <Text
                style={[
                  styles.movValor,
                  isCredit(item.tipo) ? styles.creditoTxt : styles.debitoTxt,
                ]}
              >
                {isCredit(item.tipo) ? '+' : '-'}
                {item.valor}
              </Text>
              <Text style={styles.movData}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          transactions.length > RECENT_LIMIT ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(admin)/balances/[filho_id]/historico',
                  params: { filho_id, nome: childName },
                })
              }
              accessibilityRole="link"
              accessibilityLabel="Ver extrato completo"
              style={[styles.viewAllBtn, { borderColor: colors.border.subtle }]}
            >
              <Text style={[styles.viewAllBtnText, { color: colors.accent.adminDim }]}>
                Ver extrato completo
              </Text>
            </Pressable>
          ) : null
        }
      />

      <PenaltyModal
        visible={modalType === 'penalizar'}
        childName={childName}
        onClose={() => setModalType(null)}
        onApply={handlePenalty}
      />

      <PiggyConfigSheet
        visible={modalType === 'config'}
        onClose={() => setModalType(null)}
        appreciationRate={appreciationRate}
        withdrawalRate={withdrawRate}
        prazoBloqueioDias={prazoBloqueio}
        onSave={handleSavePiggyConfig}
        saving={configurePiggyMutation.isPending}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    customHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: spacing['3'],
      borderBottomWidth: 1,
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
      marginHorizontal: spacing['3'],
    },
    headerName: {
      fontSize: typography.size.md,
      fontFamily: typography.family.extrabold,
      flex: 1,
    },
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    balanceCards: {
      flexDirection: 'row',
      gap: spacing['3'],
      marginBottom: spacing['3'],
    },
    balanceCard: {
      flex: 1,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
    },
    cofrinhoCard: {
      borderWidth: 1,
    },
    balanceCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['1'],
    },
    balanceCardLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.semibold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.7)',
    },
    balanceCardValue: {
      fontSize: typography.size['3xl'],
      fontFamily: typography.family.extrabold,
      fontVariant: ['tabular-nums'],
      color: '#FFFFFF',
    },
    balanceCardUnit: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.medium,
      color: 'rgba(255,255,255,0.6)',
      marginTop: spacing['0.5'],
    },
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
      marginBottom: spacing['4'],
    },
    progressTrack: {
      flex: 1,
      flexDirection: 'row',
      height: 8,
      borderRadius: radii.full,
      overflow: 'hidden',
    },
    progressFill: {
      borderRadius: radii.full,
    },
    progressLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      fontVariant: ['tabular-nums'],
    },
    rulesCard: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['4'],
      marginBottom: spacing['3'],
    },
    rulesCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
      marginBottom: spacing['3'],
    },
    rulesIconBox: {
      width: 28,
      height: 28,
      borderRadius: radii.md,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rulesTitle: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
    },
    rulesRateRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing['1'],
      marginBottom: spacing['1'],
    },
    rulesRateValue: {
      fontSize: typography.size['2xl'],
      fontFamily: typography.family.extrabold,
    },
    rulesRateUnit: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.medium,
    },
    projectionBox: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['2'],
      marginBottom: spacing['3'],
      gap: spacing['0.5'],
    },
    projectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
    },
    projectionText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
    },
    projectionDetail: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.medium,
      opacity: 0.7,
    },
    noAppreciationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
      paddingVertical: spacing['2'],
    },
    noAppreciationText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.medium,
    },
    rulesStatsRow: {
      flexDirection: 'row',
      gap: spacing['2'],
      marginTop: spacing['3'],
    },
    rulesStat: {
      flex: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['2'],
    },
    rulesStatLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    rulesStatValue: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.extrabold,
      marginTop: spacing['0.5'],
    },
    historicoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: spacing['3'],
      marginTop: spacing['2'],
      marginBottom: spacing['1'],
    },
    secaoTitulo: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    historicoLink: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    vazio: {
      color: colors.text.muted,
      fontSize: typography.size.sm,
      textAlign: 'center',
      marginTop: spacing['4'],
    },
    movItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing['3'],
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    movIconBox: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      borderCurve: 'continuous',
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
      marginTop: spacing['0.5'],
    },
    movRight: { alignItems: 'flex-end', gap: spacing['0.5'] },
    movValor: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      fontVariant: ['tabular-nums'],
    },
    movData: { fontSize: typography.size.xxs, color: colors.text.muted },
    creditoTxt: { color: colors.semantic.success },
    debitoTxt: { color: colors.semantic.error },
    pendingBanner: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.subtle,
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
    viewAllBtn: {
      alignItems: 'center',
      paddingVertical: spacing['3'],
      marginTop: spacing['3'],
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
    },
    viewAllBtnText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
    },
  });
}
