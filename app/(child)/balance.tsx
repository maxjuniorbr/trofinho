import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Wallet,
  TrendingUp,
} from 'lucide-react-native';
import {
  getBalance,
  listTransactions,
  transferToPiggyBank,
  getAppreciationPeriodLabel,
  getTransactionTypeLabel,
  isCredit,
  type Balance,
  type Transaction,
} from '@lib/balances';
import { getMyChildId } from '@lib/children';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { PointsDisplay } from '@/components/ui/points-display';

export default function ChildBalanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [childId, setChildId] = useState<string | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const id = await getMyChildId();
      setChildId(id);
      if (!id) { setBalance(null); setTransactions([]); return; }
      const [{ data: s }, { data: m }] = await Promise.all([
        getBalance(id),
        listTransactions(id),
      ]);
      setBalance(s);
      setTransactions(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleTransfer() {
    setModalError(null);
    const v = Number.parseInt(amountStr, 10);
    if (!amountStr || Number.isNaN(v) || v <= 0) return setModalError('Informe um valor válido.');
    if (!balance || v > balance.saldo_livre) return setModalError('Saldo livre insuficiente.');
    if (!childId) return;
    setTransferring(true);
    const { error } = await transferToPiggyBank(childId, v);
    setTransferring(false);
    if (error) { setModalError(error); return; }
    setModalVisible(false);
    setAmountStr('');
    await loadData();
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.filho} />
      </View>
    );
  }

  const freeBalance = balance?.saldo_livre ?? 0;
  const piggyBank = balance?.cofrinho ?? 0;
  const appreciationPeriod = balance ? getAppreciationPeriodLabel(balance.periodo_valorizacao) : null;
  const hasTransactions = transactions.length > 0;
  const hasModalError = Boolean(modalError);
  const lastAppreciationText = balance?.data_ultima_valorizacao
    ? ` · última em ${new Date(balance.data_ultima_valorizacao).toLocaleDateString('pt-BR')}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Meu Saldo" onBack={() => router.back()} backLabel="Início" role="filho" />

      <FlatList
        data={transactions}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
        ListHeaderComponent={
          <>
            <View style={styles.cardsRow}>
              <View style={[styles.balanceCard, { backgroundColor: colors.bg.elevated }, shadows.goldGlow]}>
                <View style={styles.balanceLabelRow}>
                  <Wallet size={14} color={colors.text.secondary} strokeWidth={2} />
                  <Text style={styles.balanceLabel}>Saldo livre</Text>
                </View>
                <PointsDisplay value={freeBalance} label="pontos" variant="gold" size="lg" />
              </View>
              <View style={[styles.balanceCard, { backgroundColor: colors.bg.elevated }, shadows.card]}>
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
                    Seu cofrinho rende {balance!.indice_valorizacao}% ao {appreciationPeriod}
                    {lastAppreciationText}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={[styles.transferBtn, freeBalance === 0 && styles.disabledBtn]}
              onPress={() => { setModalVisible(true); setAmountStr(''); setModalError(null); }}
              disabled={freeBalance === 0}
            >
              <Text style={styles.transferBtnText}>Guardar no cofrinho</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Histórico</Text>
            {hasTransactions ? null : <Text style={styles.emptyText}>Nenhuma movimentação ainda.</Text>}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.txnItem}>
            <TransactionIcon type={item.tipo} style={styles.txnIconBox} />
            <View style={styles.txnInfo}>
              <Text style={styles.txnLabel}>{getTransactionTypeLabel(item.tipo)}</Text>
              <Text style={styles.txnDesc} numberOfLines={1}>{item.descricao}</Text>
              <Text style={styles.txnDate}>
                {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Text style={[styles.txnAmount, isCredit(item.tipo) ? styles.credit : styles.debit]}>
              {isCredit(item.tipo) ? '+' : '-'}{item.valor}
            </Text>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Guardar no cofrinho</Text>
            <Text style={styles.modalSub}>
              Saldo livre disponível: <Text style={{ fontFamily: typography.family.bold }}>{freeBalance}</Text> pts
            </Text>
            <TextInput
              style={styles.modalInput}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="Quantos pontos?"
              placeholderTextColor={colors.text.muted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {hasModalError ? <Text style={styles.modalErrorText}>{modalError}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, transferring && { opacity: 0.6 }]}
                onPress={handleTransfer}
                disabled={transferring}
              >
                {transferring
                  ? <ActivityIndicator color={colors.text.inverse} />
                  : <Text style={styles.confirmBtnText}>Guardar</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { flex: 1 },
    list: { padding: spacing['5'], paddingBottom: spacing['12'] },
    cardsRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['3'] },
    balanceCard: {
      flex: 1,
      borderRadius: radii.xl,
      padding: spacing['4'],
      alignItems: 'center',
      gap: spacing['1'],
    },
    balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    balanceLabel: { color: colors.text.secondary, fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    appreciationBox: { backgroundColor: colors.semantic.successBg, borderRadius: radii.lg, padding: spacing['2'], marginBottom: spacing['3'] },
    appreciationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    appreciationText: { color: colors.semantic.success, fontSize: typography.size.xs, flex: 1 },
    transferBtn: {
      backgroundColor: colors.accent.filho,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      marginBottom: spacing['6'],
      minHeight: 48,
    },
    disabledBtn: { opacity: 0.4 },
    transferBtnText: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.md },
    sectionTitle: { fontSize: typography.size.md, fontFamily: typography.family.bold, color: colors.text.primary, marginBottom: spacing['3'] },
    emptyText: { color: colors.text.muted, fontSize: typography.size.sm, textAlign: 'center', marginTop: spacing['2'] },
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
    txnIconBox: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
    txnInfo: { flex: 1 },
    txnLabel: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, color: colors.text.primary },
    txnDesc: { fontSize: typography.size.xs, color: colors.text.secondary, marginTop: spacing['1'] },
    txnDate: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: spacing['1'] },
    txnAmount: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    credit: { color: colors.semantic.success },
    debit: { color: colors.semantic.error },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay.scrimSoft },
    modalBox: {
      backgroundColor: colors.bg.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing['6'],
      paddingBottom: spacing['12'],
      gap: spacing['4'],
    },
    modalTitle: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: colors.text.primary },
    modalSub: { fontSize: typography.size.sm, color: colors.text.secondary },
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
    modalErrorText: { color: colors.semantic.error, fontSize: typography.size.xs, textAlign: 'center' },
    modalBtns: { flexDirection: 'row', gap: spacing['3'] },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      minHeight: 48,
    },
    cancelBtnText: { color: colors.text.secondary, fontFamily: typography.family.semibold },
    confirmBtn: {
      flex: 1,
      backgroundColor: colors.accent.filho,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      minHeight: 48,
    },
    confirmBtnText: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.md },
  });
}
