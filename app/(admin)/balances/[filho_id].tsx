import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  Wallet,
  TrendingUp,
} from 'lucide-react-native';
import {
  getBalance,
  listTransactions,
  syncAutomaticAppreciation,
  applyPenalty,
  configureAppreciation,
  getTransactionTypeLabel,
  getAppreciationPeriodLabel,
  isCredit,
  type Balance,
  type Transaction,
} from '@lib/balances';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { PenaltyModal, PenaltyButton } from '@/components/balance/penalty-modal';
import { AppreciationModal } from '@/components/balance/appreciation-modal';
import { TransactionIcon } from '@/components/balance/transaction-icon';

type ModalType = 'penalizar' | 'valorizacao_config' | null;

export default function ChildBalanceAdminScreen() {
  const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<ModalType>(null);

  const loadData = useCallback(async () => {
    if (!filho_id) return;
    setLoading(true);
    try {
      await syncAutomaticAppreciation(filho_id);
      const [{ data: s }, { data: m }] = await Promise.all([
        getBalance(filho_id),
        listTransactions(filho_id),
      ]);
      setBalance(s);
      setTransactions(m);
    } finally {
      setLoading(false);
    }
  }, [filho_id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handlePenalty(amount: number, description: string) {
    if (!filho_id) return { error: 'ID do filho não encontrado' };
    const { error } = await applyPenalty(filho_id, amount, description);
    if (!error) await loadData();
    return { error };
  }

  async function handleConfigure(rate: number, period: Parameters<typeof configureAppreciation>[2]) {
    if (!filho_id) return { error: 'ID do filho não encontrado' };
    const { error } = await configureAppreciation(filho_id, rate, period);
    if (!error) await loadData();
    return { error };
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  const saldoLivre = balance?.saldo_livre ?? 0;
  const cofrinho = balance?.cofrinho ?? 0;
  const periodoAtual = balance ? getAppreciationPeriodLabel(balance.periodo_valorizacao) : null;
  const hasAppreciationConfigured = (balance?.indice_valorizacao ?? 0) > 0;
  const ultimaValorizacaoTexto = balance?.data_ultima_valorizacao
    ? ` · última em ${new Date(balance.data_ultima_valorizacao).toLocaleDateString('pt-BR')}`
    : '';
  const proximaValorizacaoTexto = balance?.proxima_valorizacao_em
    ? ` · próxima em ${new Date(balance.proxima_valorizacao_em).toLocaleDateString('pt-BR')}`
    : '';

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title={nome ?? 'Filho'}
        onBack={() => router.back()}
      />

      <FlatList
        data={transactions}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
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
                  {balance!.indice_valorizacao}% ao {periodoAtual}{ultimaValorizacaoTexto}{proximaValorizacaoTexto}
                </Text>
              ) : (
                <Text style={styles.boxConfigTexto}>Não configurada</Text>
              )}
              <View style={styles.acoesBtns}>
                <Pressable style={styles.btnAcao} onPress={() => setModalType('valorizacao_config')} accessibilityRole="button" accessibilityLabel="Configurar valorização">
                  <Text style={styles.btnAcaoTexto}>Configurar</Text>
                </Pressable>
              </View>
              <Text style={styles.boxConfigAjuda}>
                A valorização é lançada automaticamente no cofrinho quando o período vence.
              </Text>
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
              <Text style={styles.movDesc} numberOfLines={1}>{item.descricao}</Text>
              <Text style={styles.movData}>
                {new Date(item.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
            <Text style={[styles.movValor, isCredit(item.tipo) ? styles.creditoTxt : styles.debitoTxt]}>
              {isCredit(item.tipo) ? '+' : '-'}{item.valor}
            </Text>
          </View>
        )}
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
      flex: 1, borderRadius: radii.xl, padding: spacing['4'], alignItems: 'center',
      ...shadows.card,
    },
    saldoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['1'] },
    saldoLabel: { color: colors.text.inverseMuted, fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    saldoValor: { color: colors.text.inverse, fontSize: typography.size['4xl'], fontFamily: typography.family.extrabold },
    saldoPts: { color: colors.text.inverseSubtle, fontSize: typography.size.xs, marginTop: spacing['1'] },
    boxConfig: {
      backgroundColor: colors.bg.surface, borderRadius: radii.xl,
      padding: spacing['4'], marginBottom: spacing['3'], ...shadows.card,
    },
    boxConfigTituloRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1.5'], marginBottom: spacing['1'] },
    boxConfigTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold, color: colors.text.primary },
    boxConfigTexto: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing['3'] },
    acoesBtns: { flexDirection: 'row', gap: spacing['2'] },
    btnAcao: {
      backgroundColor: colors.accent.adminBg, borderRadius: radii.md,
      paddingVertical: spacing['2'], paddingHorizontal: spacing['3'], minHeight: 44, justifyContent: 'center',
    },
    btnAcaoTexto: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, color: colors.accent.admin },
    boxConfigAjuda: { color: colors.text.muted, fontSize: typography.size.xs, marginTop: spacing['2'] },
    secaoTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold, color: colors.text.primary, marginBottom: spacing['3'] },
    vazio: { color: colors.text.muted, fontSize: typography.size.sm, textAlign: 'center', marginTop: spacing['2'] },
    movItem: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.surface,
      borderRadius: radii.lg, padding: spacing['3'], marginBottom: spacing['2'],
    },
    movIconBox: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
    movInfo: { flex: 1 },
    movLabel: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, color: colors.text.primary },
    movDesc: { fontSize: typography.size.xs, color: colors.text.secondary, marginTop: spacing['1'] },
    movData: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: spacing['1'] },
    movValor: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    creditoTxt: { color: colors.semantic.success },
    debitoTxt: { color: colors.semantic.error },
  });
}
