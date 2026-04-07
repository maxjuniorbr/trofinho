import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wallet, TrendingUp } from 'lucide-react-native';
import { hapticSuccess } from '@lib/haptics';
import { getAppreciationPeriodLabel, getTransactionTypeLabel, isCredit } from '@lib/balances';
import { getMyChildId } from '@lib/children';
import {
  useBalance,
  useTransactions,
  useTransferToPiggyBank,
  combineQueryStates,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { PointsDisplay } from '@/components/ui/points-display';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { getSafeBottomPadding } from '@lib/safe-area';
import { useTransientMessage } from '@/hooks/use-transient-message';

export default function ChildBalanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    getMyChildId()
      .then(setChildId)
      .catch(() => setChildId(null));
  }, []);

  const balanceQuery = useBalance(childId ?? undefined);
  const balance = balanceQuery.data ?? null;

  const transactionsQuery = useTransactions(childId ?? '');
  const transactions = useMemo(
    () => transactionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [transactionsQuery.data],
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = transactionsQuery;

  const { isLoading, error, refetchAll } = combineQueryStates(balanceQuery, transactionsQuery);

  const transferMutation = useTransferToPiggyBank();

  const [modalVisible, setModalVisible] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const visibleTransferSuccess = useTransientMessage(transferSuccess);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTransfer = async () => {
    setModalError(null);
    const v = Number.parseInt(amountStr, 10);
    if (!amountStr || Number.isNaN(v) || v <= 0) {
      setModalError('Informe um valor válido.');
      return;
    }
    if (!balance || v > balance.saldo_livre) {
      setModalError('Saldo disponível insuficiente.');
      return;
    }
    if (!childId) return;
    try {
      await transferMutation.mutateAsync({ childId, amount: v });
      hapticSuccess();
      setModalVisible(false);
      setAmountStr('');
      setTransferSuccess(
        `${v} ponto${v === 1 ? '' : 's'} guardado${v === 1 ? '' : 's'} no cofrinho! 🐷`,
      );
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível transferir.');
    }
  };

  if (isLoading || childId === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.filho} />
      </View>
    );
  }

  if (error) {
    console.error(error);
  }

  const freeBalance = balance?.saldo_livre ?? 0;
  const piggyBank = balance?.cofrinho ?? 0;
  const appreciationPeriod = balance
    ? getAppreciationPeriodLabel(balance.periodo_valorizacao)
    : null;
  const hasTransactions = transactions.length > 0;
  const nextAppreciationText = balance?.proxima_valorizacao_em
    ? ` em ${new Date(balance.proxima_valorizacao_em).toLocaleDateString('pt-BR')}`
    : '';

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
            {visibleTransferSuccess ? (
              <View style={{ marginBottom: spacing['3'] }}>
                <InlineMessage message={visibleTransferSuccess} variant="success" />
              </View>
            ) : null}
            <View style={styles.cardsRow}>
              <View
                style={[
                  styles.balanceCard,
                  { backgroundColor: colors.bg.elevated },
                  shadows.goldGlow,
                ]}
              >
                <View style={styles.balanceLabelRow}>
                  <Wallet size={14} color={colors.text.secondary} strokeWidth={2} />
                  <Text style={styles.balanceLabel}>Disponível</Text>
                </View>
                <PointsDisplay value={freeBalance} label="pontos" variant="gold" size="lg" />
              </View>
              <View
                style={[styles.balanceCard, { backgroundColor: colors.bg.elevated }, shadows.card]}
              >
                <View style={styles.balanceLabelRow}>
                  <Wallet size={14} color={colors.text.secondary} strokeWidth={2} />
                  <Text style={styles.balanceLabel}>Cofrinho</Text>
                </View>
                <PointsDisplay value={piggyBank} label="pontos" variant="amber" size="lg" />
              </View>
            </View>

            {(balance?.indice_valorizacao ?? 0) > 0 && (
              <View style={styles.appreciationBox}>
                <View style={styles.appreciationRow}>
                  <TrendingUp size={14} color={colors.semantic.success} strokeWidth={2} />
                  <Text style={styles.appreciationText}>
                    Seu cofrinho cresce {balance!.indice_valorizacao}% a cada {appreciationPeriod}! 🌱
                  </Text>
                </View>
                <Text style={styles.appreciationHint}>
                  Os pontos guardados rendem sozinhos com o tempo.
                  {nextAppreciationText ? `\nPróximo rendimento${nextAppreciationText}.` : ''}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: spacing['6'] }}>
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

            <Text style={styles.sectionTitle}>Histórico</Text>
            {hasTransactions ? null : (
              <Text style={styles.emptyText}>
                Nenhuma movimentação ainda.{'\n'}Complete tarefas para ganhar pontos! 🏆
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.txnItem}>
            <TransactionIcon type={item.tipo} style={styles.txnIconBox} />
            <View style={styles.txnInfo}>
              <Text style={styles.txnLabel}>{getTransactionTypeLabel(item.tipo)}</Text>
              <Text style={styles.txnDesc} numberOfLines={1}>
                {item.descricao}
              </Text>
              <Text style={styles.txnDate}>
                {new Date(item.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <Text style={[styles.txnAmount, isCredit(item.tipo) ? styles.credit : styles.debit]}>
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
              Pontos guardados no cofrinho não podem ser retirados 🔒
            </Text>
            <View style={styles.quickAmountRow}>
              {[10, 50, freeBalance].map((v, i) => {
                const label = i === 2 ? 'Tudo' : `${v}`;
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
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { paddingHorizontal: spacing['5'] },
    cardsRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['3'] },
    balanceCard: {
      flex: 1,
      borderRadius: radii.xl,
      padding: spacing['4'],
      alignItems: 'center',
      gap: spacing['1'],
    },
    balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    balanceLabel: {
      color: colors.text.secondary,
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    appreciationBox: {
      backgroundColor: colors.semantic.successBg,
      borderRadius: radii.lg,
      padding: spacing['2'],
      marginBottom: spacing['3'],
    },
    appreciationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    appreciationText: { color: colors.semantic.success, fontSize: typography.size.xs, flex: 1 },
    appreciationHint: {
      color: colors.text.secondary,
      fontSize: typography.size.xs,
      marginTop: spacing['1.5'],
    },
    sectionTitle: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
      marginBottom: spacing['3'],
    },
    emptyText: {
      color: colors.text.muted,
      fontSize: typography.size.sm,
      textAlign: 'center',
      marginTop: spacing['2'],
    },
    txnItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      padding: spacing['3'],
      marginBottom: spacing['2'],
      ...shadows.card,
    },
    txnIconBox: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing['3'],
    },
    txnInfo: { flex: 1 },
    txnLabel: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
    },
    txnDesc: {
      fontSize: typography.size.xs,
      color: colors.text.secondary,
      marginTop: spacing['1'],
    },
    txnDate: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: spacing['1'] },
    txnAmount: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    credit: { color: colors.semantic.success },
    debit: { color: colors.semantic.error },
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
