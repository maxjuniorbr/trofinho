import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Wallet,
  TrendingUp,
} from 'lucide-react-native';
import {
  syncAutomaticAppreciation,
  getTransactionTypeLabel,
  getAppreciationPeriodLabel,
  isCredit,
  type AppreciationPeriod,
} from '@lib/balances';
import { useBalance, useTransactions, useApplyPenalty, useConfigureAppreciation, combineQueryStates } from '@/hooks/queries';
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

type ModalType = 'penalizar' | 'valorizacao_config' | null;

export default function ChildBalanceAdminScreen() {
  const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const balanceQuery = useBalance(filho_id);
  const transactionsQuery = useTransactions(filho_id);
  const { isLoading, isFetching, refetchAll } = combineQueryStates(balanceQuery, transactionsQuery);

  const balance = balanceQuery.data ?? null;
  const transactions = useMemo(() => transactionsQuery.data?.pages.flatMap((p) => p.data) ?? [], [transactionsQuery.data]);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = transactionsQuery;

  const [modalType, setModalType] = useState<ModalType>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const visibleSuccess = useTransientMessage(successMessage);

  const penaltyMutation = useApplyPenalty();
  const configureMutation = useConfigureAppreciation();

  const handleRefresh = useCallback(async () => {
    try {
      await syncAutomaticAppreciation(filho_id);
    } catch (e) {
      console.error(e);
    }
    await refetchAll();
  }, [filho_id, refetchAll]);

  const handlePenalty = useCallback(async (amount: number, description: string) => {
    if (!filho_id) return { error: 'ID do filho não encontrado' };
    try {
      const result = await penaltyMutation.mutateAsync({ childId: filho_id, amount, description });
      setModalType(null);
      if (result && result.deducted < amount) {
        return { error: null, warning: `Saldo insuficiente. Apenas ${result.deducted} pts foram debitados.` };
      }
      setSuccessMessage('Penalidade aplicada com sucesso.');
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao aplicar penalidade.' };
    }
  }, [filho_id, penaltyMutation]);

  const handleConfigure = useCallback(async (rate: number, period: AppreciationPeriod) => {
    if (!filho_id) return { error: 'ID do filho não encontrado' };
    try {
      await configureMutation.mutateAsync({ childId: filho_id, rate, period });
      setModalType(null);
      setSuccessMessage('Valorização configurada com sucesso.');
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao configurar valorização.' };
    }
  }, [filho_id, configureMutation]);

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
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} tintColor={colors.brand.vivid} />}
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
        onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
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
