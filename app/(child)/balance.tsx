import * as Sentry from '@sentry/react-native';
import { StyleSheet, Text, View, Pressable, TextInput, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingUp, PiggyBank, Wallet, AlertTriangle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticSuccess } from '@lib/haptics';
import { localizeRpcError } from '@lib/api-error';
import {
  getTransactionTypeLabel,
  getTransactionCategory,
  isCredit,
  calculateProjection,
} from '@lib/balances';
import {
  useBalance,
  useTransactionsByPeriod,
  useTransferToPiggyBank,
  useProfile,
  useMyChildId,
  combineQueryStates,
  useChildPendingWithdrawal,
  useRequestPiggyBankWithdrawal,
  useCancelPiggyBankWithdrawal,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { useImpersonation } from '@/context/impersonation-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, staticTextColors, typography, gradients } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { InlineMessage } from '@/components/ui/inline-message';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { getSafeBottomPadding } from '@lib/safe-area';
import { calculateNetAmount, getMinimumWithdrawalAmount } from '@lib/piggy-bank-withdrawal';
import { useTransientMessage } from '@/hooks/use-transient-message';

const todayRange = () => {
  // data_referencia in the DB is stored as UTC date (created_at::date).
  // Send UTC date boundaries so the filter matches correctly.
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10); // e.g. '2026-04-26'
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const utcTomorrow = tomorrow.toISOString().slice(0, 10);
  return { from: utcDate, to: utcTomorrow };
};

function parseAmountValue(
  amountStr: string,
  max: number,
  freeBalance: number,
  min = 1,
): number | string {
  const v = Number.parseInt(amountStr, 10);
  if (!amountStr || Number.isNaN(v) || v <= 0) return 'Informe um valor válido.';
  if (v < min) return `Valor mínimo: ${min} pts.`;
  if (v > max) {
    return max === freeBalance
      ? 'Saldo disponível insuficiente.'
      : 'Saldo do cofrinho insuficiente.';
  }
  return v;
}

const extractErrorMessage = (e: unknown, fallback: string) =>
  e instanceof Error ? localizeRpcError(e.message) : fallback;

const pluralS = (n: number) => (n === 1 ? '' : 's');

const resolveAmount = (
  amountStr: string,
  max: number,
  freeBalance: number,
  min: number,
  setError: (msg: string | null) => void,
): number | null => {
  const result = parseAmountValue(amountStr, max, freeBalance, min);
  if (typeof result === 'string') {
    setError(result);
    return null;
  }
  return result;
};

const buildWithdrawalOpts = (
  profile: { id: string; familia_id: string | null; nome: string | null } | null | undefined,
) =>
  profile?.familia_id
    ? { familiaId: profile.familia_id, childName: profile.nome ?? '', childUserId: profile.id }
    : undefined;

export default function ChildBalanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { impersonating } = useImpersonation();
  const isReadOnly = impersonating !== null;

  const { data: profile } = useProfile();
  const childIdQuery = useMyChildId(profile?.id);
  const ownChildId = childIdQuery.data ?? null;
  const childId = impersonating?.childId ?? ownChildId;

  const balanceQuery = useBalance(impersonating?.childId);
  const balance = balanceQuery.data ?? null;

  const { from: todayFrom, to: todayTo } = useMemo(todayRange, []);
  const transactionsQuery = useTransactionsByPeriod(childId ?? '', todayFrom, todayTo);
  const todayTransactions = transactionsQuery.data ?? [];

  const { isLoading, isFetching, refetchAll } = combineQueryStates(balanceQuery, transactionsQuery);

  const transferMutation = useTransferToPiggyBank();
  const withdrawalMutation = useRequestPiggyBankWithdrawal();
  const cancelWithdrawalMutation = useCancelPiggyBankWithdrawal();
  const pendingWithdrawalQuery = useChildPendingWithdrawal();
  const pendingWithdrawal = pendingWithdrawalQuery.data ?? null;

  const [modalVisible, setModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const visibleTransferSuccess = useTransientMessage(transferSuccess);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const visibleWithdrawSuccess = useTransientMessage(withdrawSuccess);

  const handleRefresh = async () => {
    await refetchAll().catch((e) => {
      Sentry.captureException(e);
    });
  };

  const handleTransfer = async () => {
    setModalError(null);
    const v = resolveAmount(
      amountStr,
      balance?.saldo_livre ?? 0,
      balance?.saldo_livre ?? 0,
      1,
      setModalError,
    );
    if (v === null || !childId) return;
    try {
      await transferMutation.mutateAsync({ childId, amount: v });
      hapticSuccess();
      setModalVisible(false);
      setAmountStr('');
      const s = pluralS(v);
      setTransferSuccess(`${v} ponto${s} guardado${s} no cofrinho! 🐷`);
    } catch (e) {
      setModalError(extractErrorMessage(e, 'Não foi possível transferir.'));
    }
  };

  const handleWithdrawal = async () => {
    setModalError(null);
    const v = resolveAmount(
      amountStr,
      balance?.cofrinho ?? 0,
      balance?.saldo_livre ?? 0,
      minimumWithdrawal,
      setModalError,
    );
    if (v === null) return;
    const opts = buildWithdrawalOpts(profile);
    try {
      await withdrawalMutation.mutateAsync({ amount: v, opts });
      hapticSuccess();
      setWithdrawModalVisible(false);
      setAmountStr('');
      setWithdrawSuccess('Solicitação de resgate enviada! O admin precisa aprovar.');
    } catch (e) {
      setModalError(extractErrorMessage(e, 'Não foi possível solicitar o resgate.'));
    }
  };

  const handleCancelWithdrawal = () =>
    pendingWithdrawal &&
    cancelWithdrawalMutation
      .mutateAsync({ withdrawalId: pendingWithdrawal.id })
      .then(hapticSuccess)
      .catch(Sentry.captureException);

  if (!impersonating && childIdQuery.isError) {
    return (
      <SafeScreenFrame>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Meus Pontos" />
        <EmptyState error="Não foi possível carregar seu saldo. Tente novamente mais tarde." />
      </SafeScreenFrame>
    );
  }

  if (isLoading) {
    return (
      <SafeScreenFrame topInset={!impersonating} bottomInset>
        <StatusBar style={colors.statusBar} />
        <ListScreenSkeleton />
      </SafeScreenFrame>
    );
  }

  const freeBalance = balance?.saldo_livre ?? 0;
  const piggyBank = balance?.cofrinho ?? 0;
  const totalPts = freeBalance + piggyBank;
  const cofrinhoPercent = totalPts > 0 ? Math.round((piggyBank / totalPts) * 100) : 0;
  const appreciationRate = balance?.indice_valorizacao ?? 0;
  const withdrawalRate = balance?.taxa_resgate_cofrinho ?? 0;
  const prazoBloqueio = balance?.prazo_bloqueio_dias ?? 7;
  const hasTransactions = todayTransactions.length > 0;
  const hasAppreciationConfigured = appreciationRate > 0;
  const projection = calculateProjection(piggyBank, appreciationRate);

  const minimumWithdrawal = getMinimumWithdrawalAmount(withdrawalRate);
  const parsedWithdrawAmount = Number.parseInt(amountStr, 10) || 0;
  const { net: previewNet } = calculateNetAmount(parsedWithdrawAmount, withdrawalRate);
  const withdrawFeeText =
    withdrawalRate > 0 && parsedWithdrawAmount >= minimumWithdrawal
      ? ` — receberá ~${previewNet} pts`
      : '';

  const successFeedback = visibleTransferSuccess ?? visibleWithdrawSuccess ?? null;
  const showPendingWithdrawal = pendingWithdrawal !== null;
  const canWithdraw = piggyBank >= minimumWithdrawal;
  const showWithdrawButton = !showPendingWithdrawal && piggyBank > 0;

  const renderQuickAmountPicker = (raw: number[], maxValue: number, min = 1) => (
    <View style={styles.quickAmountRow}>
      {raw
        .filter((v, i, arr) => v >= min && v <= maxValue && arr.indexOf(v) === i)
        .map((v) => {
          const label = v === maxValue ? 'Tudo' : `${v}`;
          const isSelected = amountStr === String(v);
          return (
            <Pressable
              key={v}
              style={[
                styles.quickAmountPill,
                { backgroundColor: isSelected ? colors.accent.filho : colors.bg.muted },
              ]}
              onPress={() => setAmountStr(String(v))}
              accessibilityRole="button"
              accessibilityLabel={`${label} pontos`}
            >
              <Text
                style={[
                  styles.quickAmountText,
                  { color: isSelected ? colors.text.inverse : colors.text.primary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );

  const renderTransferModal = () => (
    <BottomSheetModal
      visible={modalVisible}
      onClose={() => setModalVisible(false)}
      contentStyle={[
        styles.modalBox,
        { paddingBottom: getSafeBottomPadding(insets, spacing['12']) },
      ]}
      scrimColor={colors.overlay.scrimSoft}
      closeLabel="Fechar transferência para o cofrinho"
    >
      <Text style={styles.modalTitle}>Guardar no cofrinho</Text>
      <Text style={styles.modalSub}>
        Saldo disponível: <Text style={{ fontFamily: typography.family.bold }}>{freeBalance}</Text>{' '}
        pts
      </Text>
      <Text style={styles.modalHint}>
        Pontos guardados no cofrinho ficam seguros e rendem valorização.
      </Text>
      {renderQuickAmountPicker([Math.floor(freeBalance / 2), freeBalance], freeBalance)}
      <TextInput
        style={styles.modalInput}
        value={amountStr}
        onChangeText={setAmountStr}
        placeholder="Ou digite o valor"
        placeholderTextColor={colors.text.muted}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      {modalError ? <InlineMessage message={modalError} variant="error" /> : null}
      <View style={styles.modalBtns}>
        <View style={styles.modalBtnFlex}>
          <Button
            variant="secondary"
            label="Cancelar"
            onPress={() => setModalVisible(false)}
            accessibilityLabel="Cancelar transferência"
          />
        </View>
        <View style={styles.modalBtnFlex}>
          <Button
            variant="primary"
            label="Guardar"
            loading={transferMutation.isPending}
            loadingLabel="Guardando…"
            onPress={handleTransfer}
            accessibilityLabel="Confirmar transferência para cofrinho"
          />
        </View>
      </View>
    </BottomSheetModal>
  );

  const renderWithdrawModal = () => (
    <BottomSheetModal
      visible={withdrawModalVisible}
      onClose={() => setWithdrawModalVisible(false)}
      contentStyle={[
        styles.modalBox,
        { paddingBottom: getSafeBottomPadding(insets, spacing['12']) },
      ]}
      scrimColor={colors.overlay.scrimSoft}
      closeLabel="Fechar resgate do cofrinho"
    >
      <Text style={styles.modalTitle}>Retirar do cofrinho</Text>
      <Text style={styles.modalSub}>
        Cofrinho: <Text style={{ fontFamily: typography.family.bold }}>{piggyBank}</Text> pts
      </Text>
      {withdrawalRate > 0 ? (
        <Text style={styles.modalHint}>
          Taxa de resgate: {withdrawalRate}% · mínimo {minimumWithdrawal} pts{withdrawFeeText}
        </Text>
      ) : null}
      {withdrawFeeText ? (
        <Text style={[styles.modalHint, { fontStyle: 'italic', marginTop: -spacing['1'] }]}>
          Valor final pode variar se a taxa for alterada antes da aprovação.
        </Text>
      ) : null}
      {renderQuickAmountPicker(
        [minimumWithdrawal, Math.floor(piggyBank / 2), piggyBank],
        piggyBank,
        minimumWithdrawal,
      )}
      <TextInput
        style={styles.modalInput}
        value={amountStr}
        onChangeText={setAmountStr}
        placeholder="Ou digite o valor"
        placeholderTextColor={colors.text.muted}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      {modalError ? <InlineMessage message={modalError} variant="error" /> : null}
      <View style={styles.modalBtns}>
        <View style={styles.modalBtnFlex}>
          <Button
            variant="secondary"
            label="Cancelar"
            onPress={() => setWithdrawModalVisible(false)}
            accessibilityLabel="Cancelar resgate"
          />
        </View>
        <View style={styles.modalBtnFlex}>
          <Button
            variant="primary"
            label="Solicitar"
            loading={withdrawalMutation.isPending}
            loadingLabel="Solicitando…"
            onPress={handleWithdrawal}
            accessibilityLabel="Confirmar solicitação de resgate do cofrinho"
          />
        </View>
      </View>
    </BottomSheetModal>
  );

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Meus Pontos"
        onBack={() => router.back()}
        backLabel="Início"
        role="filho"
      />

      <FlashList
        data={todayTransactions}
        keyExtractor={(m) => m.id}
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
            {successFeedback ? (
              <View style={{ marginBottom: spacing['3'] }}>
                <InlineMessage message={successFeedback} variant="success" />
              </View>
            ) : null}

            {/* Two side-by-side balance cards — same pattern as admin */}
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
                <Text style={styles.balanceCardValue}>{freeBalance.toLocaleString('pt-BR')}</Text>
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
                  {piggyBank.toLocaleString('pt-BR')}
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

            {/* Action buttons */}
            <View style={styles.actionBtns}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="primary"
                  label="Depositar"
                  disabled={freeBalance === 0 || isReadOnly}
                  onPress={() => {
                    setModalVisible(true);
                    setAmountStr('');
                    setModalError(null);
                  }}
                  accessibilityLabel="Guardar pontos no cofrinho"
                />
              </View>
              {showWithdrawButton ? (
                <View style={{ flex: 1 }}>
                  <Button
                    variant="secondary"
                    label="Retirar"
                    disabled={!canWithdraw || isReadOnly}
                    onPress={() => {
                      setWithdrawModalVisible(true);
                      setAmountStr('');
                      setModalError(null);
                    }}
                    accessibilityLabel="Solicitar resgate de pontos do cofrinho"
                  />
                </View>
              ) : null}
            </View>

            {/* Insufficient balance hint for withdrawal */}
            {showWithdrawButton && !canWithdraw ? (
              <View style={{ marginBottom: spacing['3'] }}>
                <InlineMessage
                  message={`Saldo mínimo para resgate: ${minimumWithdrawal} pts (taxa de ${withdrawalRate}%).`}
                  variant="info"
                />
              </View>
            ) : null}

            {/* Pending withdrawal banner */}
            {showPendingWithdrawal ? (
              <View style={styles.pendingWithdrawalBox}>
                <InlineMessage
                  message={`Resgate pendente: ${pendingWithdrawal.valor_solicitado} pts (receberá ${pendingWithdrawal.valor_liquido} pts). Aguardando aprovação.`}
                  variant="warning"
                />
                <View style={{ marginTop: spacing['2'] }}>
                  <Button
                    variant="outline"
                    label="Cancelar resgate"
                    loading={cancelWithdrawalMutation.isPending}
                    loadingLabel="Cancelando…"
                    onPress={handleCancelWithdrawal}
                    disabled={isReadOnly}
                    accessibilityLabel="Cancelar solicitação de resgate do cofrinho"
                  />
                </View>
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
                    <Text style={[styles.rulesRateUnit, { color: colors.text.muted }]}>ao mês</Text>
                  </View>
                  {projection > 0 && piggyBank > 0 ? (
                    <View
                      style={[styles.projectionBox, { backgroundColor: colors.semantic.successBg }]}
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
                        Sobre {piggyBank} pts no cofrinho a {appreciationRate}%
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
                    -{withdrawalRate}%
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

            <View style={styles.historicoHeader}>
              <Text style={styles.secaoTitulo}>Atividades de hoje</Text>
            </View>
            {hasTransactions ? null : (
              <Text style={styles.vazio}>Nenhuma movimentação hoje.</Text>
            )}
          </>
        }
        renderItem={({ item }) => {
          const cat = getTransactionCategory(item.tipo);
          return (
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
                    cat === 'ganho'
                      ? styles.creditoTxt
                      : cat === 'cofrinho'
                        ? styles.cofrinhoTxt
                        : styles.debitoTxt,
                  ]}
                >
                  {isCredit(item.tipo) ? '+' : '-'}
                  {item.valor}
                </Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/(child)/historico' as never)}
            accessibilityRole="link"
            accessibilityLabel="Ver extrato completo"
            style={[styles.viewAllBtn, { borderColor: colors.border.subtle }]}
          >
            <Text style={[styles.viewAllBtnText, { color: colors.accent.filhoDim }]}>
              Ver extrato completo
            </Text>
          </Pressable>
        }
      />

      {renderTransferModal()}
      {renderWithdrawModal()}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { padding: spacing['5'], paddingBottom: spacing['12'] },

    // ── Balance cards (same as admin) ──
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
      color: staticTextColors.inverse,
    },
    balanceCardUnit: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.medium,
      color: 'rgba(255,255,255,0.6)',
      marginTop: spacing['0.5'],
    },

    // ── Progress ──
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

    // ── Action buttons ──
    actionBtns: {
      flexDirection: 'row',
      gap: spacing['3'],
      marginBottom: spacing['3'],
    },

    // ── Rules card (same as admin) ──
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

    // ── Pending withdrawal ──
    pendingWithdrawalBox: { marginBottom: spacing['3'] },

    // ── Histórico ──
    historicoHeader: {
      paddingBottom: spacing['3'],
      marginTop: spacing['2'],
      marginBottom: spacing['1'],
    },
    secaoTitulo: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    vazio: {
      color: colors.text.muted,
      fontSize: typography.size.sm,
      textAlign: 'center',
      marginTop: spacing['4'],
    },

    // ── Transaction items ──
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
    creditoTxt: { color: colors.semantic.success },
    debitoTxt: { color: colors.semantic.error },
    cofrinhoTxt: { color: colors.semantic.info },

    // ── View all button ──
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

    // ── Modals ──
    modalBox: {
      padding: spacing['6'],
      paddingBottom: spacing['12'],
      gap: spacing['4'],
    },
    modalTitle: {
      fontSize: typography.size.lg,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    modalSub: { fontSize: typography.size.sm, color: colors.text.secondary },
    modalHint: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      fontStyle: 'italic',
    },
    quickAmountRow: {
      flexDirection: 'row',
      gap: spacing['2'],
    },
    quickAmountPill: {
      flex: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingVertical: spacing['2'],
      alignItems: 'center',
      minHeight: 40,
      justifyContent: 'center',
    },
    quickAmountText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['3'],
      fontSize: typography.size['2xl'],
      fontFamily: typography.family.bold,
      color: colors.text.primary,
      textAlign: 'center',
    },
    modalBtns: { flexDirection: 'row', gap: spacing['3'] },
    modalBtnFlex: { flex: 1 },
  });
}
