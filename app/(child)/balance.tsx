import * as Sentry from '@sentry/react-native';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingUp, PiggyBank } from 'lucide-react-native';
import { hapticSuccess } from '@lib/haptics';
import { formatDate } from '@lib/utils';
import { getTransactionTypeLabel, isCredit } from '@lib/balances';
import {
  useBalance,
  useTransactions,
  useTransferToPiggyBank,
  useProfile,
  useMyChildId,
  combineQueryStates,
  useChildPendingWithdrawal,
  useRequestPiggyBankWithdrawal,
  useCancelPiggyBankWithdrawal,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { getSafeBottomPadding } from '@lib/safe-area';
import { calculateNetAmount, getMinimumWithdrawalAmount } from '@lib/piggy-bank-withdrawal';
import { useTransientMessage } from '@/hooks/use-transient-message';

function getBalanceHeaderColors(colors: ThemeColors) {
  const isLight = colors.statusBar === 'dark';
  return {
    ...(isLight
      ? {
          bg: colors.bg.surface,
          boxBg: colors.bg.muted,
          border: colors.border.subtle,
          text: colors.text.primary,
          textMuted: colors.text.secondary,
        }
      : {
          bg: colors.bg.elevated,
          boxBg: colors.bg.muted,
          border: colors.border.subtle,
          text: '#FFFFFF',
          textMuted: 'rgba(255, 255, 255, 0.7)',
        }),
  };
}

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
  e instanceof Error ? e.message : fallback;

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

const buildWithdrawalOpts = (profile: { id: string; familia_id: string | null; nome: string | null } | null | undefined) =>
  profile?.familia_id
    ? { familiaId: profile.familia_id, childName: profile.nome ?? '', childUserId: profile.id }
    : undefined;

const formatAppreciationHint = (nextDate: string | null | undefined) => {
  const suffix = nextDate
    ? '\nPróximo rendimento em ' + formatDate(nextDate) + '.'
    : '';
  return 'Os pontos guardados rendem sozinhos com o tempo.' + suffix;
};

export default function ChildBalanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: profile } = useProfile();
  const childIdQuery = useMyChildId(profile?.id);
  const childId = childIdQuery.data ?? null;

  const balanceQuery = useBalance();
  const balance = balanceQuery.data ?? null;

  const transactionsQuery = useTransactions(childId ?? '');
  const transactions = useMemo(
    () => transactionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [transactionsQuery.data],
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = transactionsQuery;

  const { isLoading, refetchAll } = combineQueryStates(
    balanceQuery,
    transactionsQuery,
  );

  const transferMutation = useTransferToPiggyBank();
  const withdrawalMutation = useRequestPiggyBankWithdrawal();
  const cancelWithdrawalMutation = useCancelPiggyBankWithdrawal();
  const pendingWithdrawalQuery = useChildPendingWithdrawal();
  const pendingWithdrawal = pendingWithdrawalQuery.data ?? null;

  const [modalVisible, setModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const visibleTransferSuccess = useTransientMessage(transferSuccess);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const visibleWithdrawSuccess = useTransientMessage(withdrawSuccess);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchAll().catch((e) => {
      Sentry.captureException(e);
      console.error(e);
    });
    setRefreshing(false);
  };

  const handleTransfer = async () => {
    setModalError(null);
    const v = resolveAmount(amountStr, balance?.saldo_livre ?? 0, balance?.saldo_livre ?? 0, 1, setModalError);
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
    const v = resolveAmount(amountStr, balance?.cofrinho ?? 0, balance?.saldo_livre ?? 0, minimumWithdrawal, setModalError);
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

  if (childIdQuery.isError) {
    return (
      <SafeScreenFrame>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Meu saldo" />
        <EmptyState
          error="Não foi possível carregar seu saldo. Tente novamente mais tarde."
        />
      </SafeScreenFrame>
    );
  }

  if (isLoading) {
    return (
      <SafeScreenFrame topInset bottomInset>
        <StatusBar style={colors.statusBar} />
        <ListScreenSkeleton />
      </SafeScreenFrame>
    );
  }

  const freeBalance = balance?.saldo_livre ?? 0;
  const piggyBank = balance?.cofrinho ?? 0;
  const totalPts = freeBalance + piggyBank;
  const cofrinhoPercent = totalPts > 0 ? Math.round((piggyBank / totalPts) * 100) : 0;
  const withdrawalRate = balance?.taxa_resgate_cofrinho ?? 0;
  const hasTransactions = transactions.length > 0;
  const appreciationHint = formatAppreciationHint(balance?.proxima_valorizacao_em);

  const parsedWithdrawAmount = Number.parseInt(amountStr, 10) || 0;
  const minimumWithdrawal = getMinimumWithdrawalAmount(withdrawalRate);
  const { net: previewNet } = calculateNetAmount(parsedWithdrawAmount, withdrawalRate);
  const withdrawFeeText =
    withdrawalRate > 0 && parsedWithdrawAmount >= minimumWithdrawal
      ? ` — receberá ~${previewNet} pts`
      : '';

  const showAppreciation = (balance?.indice_valorizacao ?? 0) > 0;
  const successFeedback = visibleTransferSuccess ?? visibleWithdrawSuccess ?? null;
  const showPendingWithdrawal = pendingWithdrawal !== null;
  const canWithdraw = piggyBank >= minimumWithdrawal;
  const showWithdrawButton = !showPendingWithdrawal && piggyBank > 0;
  const showWithdrawInsufficientHint = showWithdrawButton && !canWithdraw;
  const header = getBalanceHeaderColors(colors);

  const progressBar = totalPts > 0 ? (
    <View style={styles.balanceHeaderProgress}>
      <View style={[styles.progressTrack, { backgroundColor: header.boxBg }]}>
        <View
          style={[
            styles.progressFillLeft,
            { flex: 100 - cofrinhoPercent, backgroundColor: colors.accent.filho },
          ]}
        />
        <View
          style={[
            styles.progressFillRight,
            { flex: cofrinhoPercent, backgroundColor: colors.semantic.warning },
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
  ) : null;

  const appreciationBox = showAppreciation ? (
    <View
      style={[
        styles.boxConfig,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      <View style={styles.boxConfigTituloRow}>
        <TrendingUp size={16} color={colors.semantic.success} strokeWidth={2} />
        <Text style={styles.boxConfigTitulo}>
          Cofrinho rendendo {balance!.indice_valorizacao}% ao mês 🌱
        </Text>
      </View>
      <Text style={styles.boxConfigSub}>{appreciationHint}</Text>
    </View>
  ) : null;

  const pendingWithdrawalBox = showPendingWithdrawal ? (
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
          accessibilityLabel="Cancelar solicitação de resgate do cofrinho"
        />
      </View>
    </View>
  ) : null;

  const withdrawInsufficientHint = showWithdrawInsufficientHint ? (
    <View style={{ marginBottom: spacing['3'] }}>
      <InlineMessage
        message={`Saldo mínimo para resgate: ${minimumWithdrawal} pts (taxa de ${withdrawalRate}%).`}
        variant="info"
      />
    </View>
  ) : null;

  const withdrawButton = showWithdrawButton && canWithdraw ? (
    <View style={{ marginBottom: spacing['3'] }}>
      <Button
        variant="secondary"
        label="Retirar do cofrinho"
        onPress={() => {
          setWithdrawModalVisible(true);
          setAmountStr('');
          setModalError(null);
        }}
        accessibilityLabel="Solicitar resgate de pontos do cofrinho"
      />
    </View>
  ) : null;

  const renderTransferModal = () => (
    <Modal visible={modalVisible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <View
          style={[
            styles.modalBox,
            { paddingBottom: getSafeBottomPadding(insets, spacing['12']) },
          ]}
        >
          <Text style={styles.modalTitle}>Guardar no cofrinho</Text>
          <Text style={styles.modalSub}>
            Saldo disponível:{' '}
            <Text style={{ fontFamily: typography.family.bold }}>{freeBalance}</Text> pts
          </Text>
          <Text style={styles.modalHint}>
            Pontos guardados no cofrinho ficam seguros e rendem valorização.
          </Text>
          <View style={styles.quickAmountRow}>
            {[Math.floor(freeBalance / 2), freeBalance].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map((v) => {
              const label = v === freeBalance ? 'Tudo' : `${v}`;
              const isSelected = amountStr === String(v);
              return (
                <Pressable
                  key={label}
                  style={[
                    styles.quickAmountPill,
                    {
                      backgroundColor: isSelected ? colors.accent.filho : colors.bg.muted,
                    },
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderWithdrawModal = () => (
    <Modal visible={withdrawModalVisible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <View
          style={[
            styles.modalBox,
            { paddingBottom: getSafeBottomPadding(insets, spacing['12']) },
          ]}
        >
          <Text style={styles.modalTitle}>Retirar do cofrinho</Text>
          <Text style={styles.modalSub}>
            Cofrinho:{' '}
            <Text style={{ fontFamily: typography.family.bold }}>{piggyBank}</Text> pts
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
          <View style={styles.quickAmountRow}>
            {[minimumWithdrawal, Math.floor(piggyBank / 2), piggyBank].filter((v, i, arr) => v >= minimumWithdrawal && v <= piggyBank && arr.indexOf(v) === i).map((v) => {
              const label = v === piggyBank ? 'Tudo' : `${v}`;
              const isSelected = amountStr === String(v);
              return (
                <Pressable
                  key={label}
                  style={[
                    styles.quickAmountPill,
                    {
                      backgroundColor: isSelected ? colors.accent.filho : colors.bg.muted,
                    },
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Meu Saldo"
        onBack={() => router.back()}
        backLabel="Início"
        role="filho"
      />

      <FlashList
        data={transactions}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={
          <>
            <View style={{ height: spacing['5'] }} />
            {successFeedback ? (
              <View style={{ marginBottom: spacing['3'] }}>
                <InlineMessage message={successFeedback} variant="success" />
              </View>
            ) : null}

            {/* Dark header card — same pattern as admin balance */}
            <View
              style={[
                styles.balanceHeader,
                { backgroundColor: header.bg, borderColor: header.border },
              ]}
            >
              <View style={styles.balanceHeaderTop}>
                <PiggyBank size={16} color={header.textMuted} strokeWidth={2} />
                <Text style={[styles.balanceHeaderLabel, { color: header.textMuted }]}>
                  MEU SALDO
                </Text>
              </View>
              <Text style={[styles.balanceHeaderTotal, { color: header.text }]}>
                {totalPts.toLocaleString('pt-BR')}
              </Text>
              <Text style={[styles.balanceHeaderSubtitle, { color: header.textMuted }]}>
                pontos disponíveis
              </Text>
              <View style={styles.balanceHeaderBoxes}>
                <View
                  style={[
                    styles.balanceHeaderBox,
                    { backgroundColor: header.boxBg, borderColor: header.border },
                  ]}
                >
                  <Text style={[styles.balanceHeaderBoxLabel, { color: header.textMuted }]}>
                    LIVRE
                  </Text>
                  <Text style={[styles.balanceHeaderBoxValue, { color: header.text }]}>
                    {freeBalance.toLocaleString('pt-BR')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.balanceHeaderBox,
                    { backgroundColor: header.boxBg, borderColor: header.border },
                  ]}
                >
                  <Text style={[styles.balanceHeaderBoxLabel, { color: header.textMuted }]}>
                    COFRINHO
                  </Text>
                  <Text style={[styles.balanceHeaderBoxValue, { color: header.text }]}>
                    {piggyBank.toLocaleString('pt-BR')}
                  </Text>
                </View>
              </View>
              {progressBar}
            </View>

            {appreciationBox}

            <View style={{ marginBottom: spacing['3'] }}>
              <Button
                variant="primary"
                label="Guardar no cofrinho"
                disabled={freeBalance === 0}
                onPress={() => {
                  setModalVisible(true);
                  setAmountStr('');
                  setModalError(null);
                }}
                accessibilityLabel="Guardar pontos no cofrinho"
              />
            </View>

            {pendingWithdrawalBox}
            {withdrawInsufficientHint}
            {withdrawButton}

            <View
              style={[styles.historicoHeader, { borderBottomColor: colors.border.subtle }]}
            >
              <Text style={styles.secaoTitulo}>Histórico</Text>
            </View>
            {hasTransactions ? null : (
              <Text style={styles.vazio}>
                Nenhuma movimentação ainda.{'\n'}Complete tarefas para ganhar pontos! 🏆
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.movItem,
              { borderBottomColor: colors.border.subtle },
            ]}
          >
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
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
      />

      {renderTransferModal()}
      {renderWithdrawModal()}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { paddingHorizontal: spacing['5'], paddingBottom: spacing['12'] },

    balanceHeader: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['5'],
      marginBottom: spacing['3'],
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
      borderWidth: 1,
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
    balanceHeaderProgress: {
      marginTop: spacing['3'],
      gap: spacing['1'],
    },
    progressTrack: {
      flexDirection: 'row',
      height: 8,
      borderRadius: radii.full,
      overflow: 'hidden',
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

    boxConfig: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
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
      flex: 1,
    },
    boxConfigSub: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
      color: colors.text.muted,
    },

    historicoHeader: {
      borderBottomWidth: 1,
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

    pendingWithdrawalBox: { marginBottom: spacing['3'] },

    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay.scrimSoft,
    },
    modalBox: {
      backgroundColor: colors.bg.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
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
