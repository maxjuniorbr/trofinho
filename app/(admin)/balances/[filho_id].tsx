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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  ArrowDownCircle,
  AlertTriangle,
} from 'lucide-react-native';
import {
  getBalance,
  listTransactions,
  applyPenalty,
  configureAppreciation,
  applyAppreciation,
  getTransactionTypeLabel,
  getAppreciationPeriodLabel,
  isCredit,
  type Balance,
  type Transaction,
  type TransactionType,
  type AppreciationPeriod,
} from '@lib/balances';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';

import type { LucideIcon } from 'lucide-react-native';

const TRANSACTION_ICONS: Record<TransactionType, LucideIcon> = {
  credito:                CheckCircle2,
  debito:                 ArrowDownCircle,
  transferencia_cofrinho: Wallet,
  valorizacao:            TrendingUp,
  penalizacao:            AlertTriangle,
};

type ModalType = 'penalizar' | 'valorizacao_config' | null;

const PERIODOS: { label: string; value: AppreciationPeriod }[] = [
  { label: 'Dia', value: 'diario' },
  { label: 'Semana', value: 'semanal' },
  { label: 'Mês', value: 'mensal' },
];

export default function ChildBalanceAdminScreen() {
  const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyDescription, setPenaltyDescription] = useState('');
  const [cfgRate, setCfgRate] = useState('0');
  const [cfgPeriod, setCfgPeriod] = useState<AppreciationPeriod>('mensal');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!filho_id) return;
    setLoading(true);
    try {
      const [{ data: s }, { data: m }] = await Promise.all([
        getBalance(filho_id),
        listTransactions(filho_id),
      ]);
      setBalance(s);
      setTransactions(m);
      if (s) {
        setCfgRate(String(s.indice_valorizacao));
        setCfgPeriod(s.periodo_valorizacao);
      }
    } finally {
      setLoading(false);
    }
  }, [filho_id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  function openModal(t: ModalType) {
    setModalError(null);
    setModalSuccess(null);
    setPenaltyAmount('');
    setPenaltyDescription('');
    setModalType(t);
  }

  async function handleApplyAppreciation() {
    if (!filho_id) return;
    setSaving(true);
    setModalError(null);
    setModalSuccess(null);
    const { data: ganho, error } = await applyAppreciation(filho_id);
    setSaving(false);
    if (error) { setModalError(error); return; }
    setModalSuccess(`+${ganho} pontos creditados no cofrinho!`);
    await loadData();
  }

  async function handleApplyPenalty() {
    setModalError(null);
    const v = Number.parseInt(penaltyAmount, 10);
    if (!penaltyAmount || Number.isNaN(v) || v <= 0) return setModalError('Informe um valor válido.');
    if (!penaltyDescription.trim()) return setModalError('Informe a descrição.');
    if (!filho_id) return;
    setSaving(true);
    const { error } = await applyPenalty(filho_id, v, penaltyDescription.trim());
    setSaving(false);
    if (error) { setModalError(error); return; }
    setModalType(null);
    await loadData();
  }

  async function handleConfigure() {
    setModalError(null);
    const idx = Number.parseFloat(cfgRate.replace(',', '.'));
    if (Number.isNaN(idx) || idx < 0 || idx > 100) return setModalError('Índice deve estar entre 0 e 100.');
    if (!filho_id) return;
    setSaving(true);
    const { error } = await configureAppreciation(filho_id, idx, cfgPeriod);
    setSaving(false);
    if (error) { setModalError(error); return; }
    setModalType(null);
    await loadData();
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
  const hasConfigSuccess = Boolean(modalSuccess);
  const hasModalError = Boolean(modalError);
  const hasTransactions = transactions.length > 0;
  const hasAppreciationConfigured = (balance?.indice_valorizacao ?? 0) > 0;
  const ultimaValorizacaoTexto = balance?.data_ultima_valorizacao
    ? ` · última em ${new Date(balance.data_ultima_valorizacao).toLocaleDateString('pt-BR')}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title={nome ?? 'Filho'} onBack={() => router.back()} />

      <FlatList
        data={transactions}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
            <View style={styles.cardsRow}>
              <View style={[styles.saldoCard, { backgroundColor: colors.accent.admin }]}>
                <View style={styles.saldoLabelRow}>
                  <Wallet size={14} color="rgba(255,255,255,0.85)" strokeWidth={2} />
                  <Text style={styles.saldoLabel}>Saldo livre</Text>
                </View>
                <Text style={styles.saldoValor}>{saldoLivre}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </View>
              <View style={[styles.saldoCard, { backgroundColor: colors.semantic.warning }]}>
                <View style={styles.saldoLabelRow}>
                  <Wallet size={14} color="rgba(255,255,255,0.85)" strokeWidth={2} />
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
                  {balance!.indice_valorizacao}% ao {periodoAtual}{ultimaValorizacaoTexto}
                </Text>
              ) : (
                <Text style={styles.boxConfigTexto}>Não configurada</Text>
              )}
              <View style={styles.acoesBtns}>
                <Pressable style={styles.btnAcao} onPress={() => openModal('valorizacao_config')}>
                  <Text style={styles.btnAcaoTexto}>Configurar</Text>
                </Pressable>
                {hasAppreciationConfigured ? (
                  <Pressable
                    style={[styles.btnAcao, { backgroundColor: colors.semantic.successBg }]}
                    onPress={handleApplyAppreciation}
                    disabled={saving}
                  >
                    <Text style={[styles.btnAcaoTexto, { color: colors.semantic.success }]}>
                      {saving ? '…' : 'Aplicar agora'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {hasConfigSuccess ? <Text style={styles.sucTexto}>{modalSuccess}</Text> : null}
            </View>

            <Pressable style={styles.btnPenalizar} onPress={() => openModal('penalizar')}>
              <View style={styles.btnPenalizarInner}>
                <AlertTriangle size={14} color={colors.semantic.error} strokeWidth={2} />
                <Text style={styles.btnPenalizarTexto}>Aplicar penalização</Text>
              </View>
            </Pressable>

            <Text style={styles.secaoTitulo}>Histórico</Text>
            {hasTransactions ? null : (
              <Text style={styles.vazio}>Nenhuma movimentação ainda.</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.movItem}>
            {(() => { const Icon = TRANSACTION_ICONS[item.tipo]; return (
            <View style={[styles.movIconBox, { backgroundColor: isCredit(item.tipo) ? colors.semantic.successBg : colors.semantic.errorBg }]}>
              <Icon size={16} color={isCredit(item.tipo) ? colors.semantic.successText : colors.semantic.errorText} strokeWidth={2} />
            </View>
            ); })()}
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

      <Modal visible={modalType === 'penalizar'} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Penalização — {nome}</Text>
            <Text style={styles.label}>Valor (pontos) *</Text>
            <TextInput
              style={styles.input}
              value={penaltyAmount}
              onChangeText={setPenaltyAmount}
              placeholder="Ex: 10"
              placeholderTextColor={colors.text.muted}
              keyboardType="number-pad"
              maxLength={5}
            />
            <Text style={styles.label}>Motivo *</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={penaltyDescription}
              onChangeText={setPenaltyDescription}
              placeholder="Descreva o motivo…"
              placeholderTextColor={colors.text.muted}
              multiline
              maxLength={200}
            />
            {hasModalError ? <Text style={styles.errModal}>{modalError}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancelar} onPress={() => setModalType(null)}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnConfirmar, { backgroundColor: colors.semantic.error }, saving && styles.btnDesabilitado]}
                onPress={handleApplyPenalty}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>Penalizar</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalType === 'valorizacao_config'} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Configurar valorização</Text>
            <Text style={styles.label}>Índice (%) *</Text>
            <TextInput
              style={styles.input}
              value={cfgRate}
              onChangeText={setCfgRate}
              placeholder="Ex: 5"
              placeholderTextColor={colors.text.muted}
              keyboardType="decimal-pad"
              maxLength={6}
            />
            <Text style={styles.label}>Período</Text>
            <View style={styles.periodoRow}>
              {PERIODOS.map((p) => (
                <Pressable
                  key={p.value}
                  style={[styles.periodoBotao, cfgPeriod === p.value && styles.periodoAtivo]}
                  onPress={() => setCfgPeriod(p.value)}
                >
                  <Text style={[styles.periodoTexto, cfgPeriod === p.value && styles.periodoTextoAtivo]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {hasModalError ? <Text style={styles.errModal}>{modalError}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancelar} onPress={() => setModalType(null)}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnConfirmar, saving && styles.btnDesabilitado]}
                onPress={handleConfigure}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>Salvar</Text>}
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
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    cardsRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['4'] },
    saldoCard: {
      flex: 1,
      borderRadius: radii.xl,
      padding: spacing['4'],
      alignItems: 'center',
      ...shadows.card,
    },
    saldoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing['1'] },
    saldoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    saldoValor: { color: '#fff', fontSize: typography.size['4xl'], fontFamily: typography.family.extrabold },
    saldoPts: { color: 'rgba(255,255,255,0.8)', fontSize: typography.size.xs, marginTop: spacing['1'] },
    boxConfig: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['3'],
      ...shadows.card,
    },
    boxConfigTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing['1'] },
    boxConfigTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold, color: colors.text.primary },
    boxConfigTexto: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing['3'] },
    acoesBtns: { flexDirection: 'row', gap: spacing['2'] },
    btnAcao: {
      backgroundColor: colors.accent.adminBg,
      borderRadius: radii.md,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['3'],
      minHeight: 44,
      justifyContent: 'center',
    },
    btnAcaoTexto: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, color: colors.accent.admin },
    sucTexto: { color: colors.semantic.success, fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginTop: spacing['2'] },
    btnPenalizar: {
      backgroundColor: colors.semantic.errorBg,
      borderRadius: radii.lg,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      marginBottom: spacing['5'],
      minHeight: 44,
      justifyContent: 'center',
    },
    btnPenalizarInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    btnPenalizarTexto: { color: colors.semantic.error, fontFamily: typography.family.bold, fontSize: typography.size.sm },
    secaoTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold, color: colors.text.primary, marginBottom: spacing['3'] },
    vazio: { color: colors.text.muted, fontSize: typography.size.sm, textAlign: 'center', marginTop: spacing['2'] },
    movItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      borderRadius: radii.lg,
      padding: spacing['3'],
      marginBottom: spacing['2'],
    },
    movIconBox: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
    movInfo: { flex: 1 },
    movLabel: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, color: colors.text.primary },
    movDesc: { fontSize: typography.size.xs, color: colors.text.secondary, marginTop: spacing['1'] },
    movData: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: spacing['1'] },
    movValor: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    creditoTxt: { color: colors.semantic.success },
    debitoTxt: { color: colors.semantic.error },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalBox: {
      backgroundColor: colors.bg.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing['6'],
      paddingBottom: spacing['12'],
      gap: spacing['3'],
    },
    modalTitulo: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: colors.text.primary },
    label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, color: colors.text.secondary },
    input: {
      backgroundColor: colors.bg.canvas,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      color: colors.text.primary,
      minHeight: 48,
    },
    periodoRow: { flexDirection: 'row', gap: spacing['2'] },
    periodoBotao: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingVertical: spacing['2'],
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    periodoAtivo: { backgroundColor: colors.accent.adminBg, borderColor: colors.accent.admin },
    periodoTexto: { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: typography.family.medium },
    periodoTextoAtivo: { color: colors.accent.admin, fontFamily: typography.family.bold },
    errModal: { color: colors.semantic.error, fontSize: typography.size.xs },
    modalBtns: { flexDirection: 'row', gap: spacing['3'] },
    btnCancelar: { flex: 1, borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.lg, paddingVertical: spacing['3'], alignItems: 'center', minHeight: 48 },
    btnCancelarTexto: { color: colors.text.secondary, fontFamily: typography.family.semibold },
    btnConfirmar: { flex: 1, backgroundColor: colors.accent.admin, borderRadius: radii.lg, paddingVertical: spacing['3'], alignItems: 'center', minHeight: 48 },
    btnConfirmarTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.md },
    btnDesabilitado: { opacity: 0.5 },
  });
}
