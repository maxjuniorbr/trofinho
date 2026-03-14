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
  buscarSaldo,
  listarMovimentacoes,
  aplicarPenalizacao,
  configurarValorizacao,
  aplicarValorizacao,
  emojiTipo,
  labelTipo,
  labelPeriodoValorizacao,
  isCredito,
  type Saldo,
  type Movimentacao,
  type PeriodoValorizacao,
} from '@lib/saldos';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

type ModalTipo = 'penalizar' | 'valorizacao_config' | null;

const PERIODOS: { label: string; value: PeriodoValorizacao }[] = [
  { label: 'Dia', value: 'diario' },
  { label: 'Semana', value: 'semanal' },
  { label: 'Mês', value: 'mensal' },
];

export default function SaldoFilhoAdminScreen() {
  const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalTipo, setModalTipo] = useState<ModalTipo>(null);
  const [penValorStr, setPenValorStr] = useState('');
  const [penDesc, setPenDesc] = useState('');
  const [cfgIndice, setCfgIndice] = useState('0');
  const [cfgPeriodo, setCfgPeriodo] = useState<PeriodoValorizacao>('mensal');
  const [enviando, setEnviando] = useState(false);
  const [errModal, setErrModal] = useState<string | null>(null);
  const [sucModal, setSucModal] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!filho_id) return;
    setCarregando(true);
    try {
      const [{ data: s }, { data: m }] = await Promise.all([
        buscarSaldo(filho_id),
        listarMovimentacoes(filho_id),
      ]);
      setSaldo(s);
      setMovs(m);
      if (s) {
        setCfgIndice(String(s.indice_valorizacao));
        setCfgPeriodo(s.periodo_valorizacao);
      }
    } finally {
      setCarregando(false);
    }
  }, [filho_id]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  function abrirModal(t: ModalTipo) {
    setErrModal(null);
    setSucModal(null);
    setPenValorStr('');
    setPenDesc('');
    setModalTipo(t);
  }

  async function handleValorizacao() {
    if (!filho_id) return;
    setEnviando(true);
    setErrModal(null);
    setSucModal(null);
    const { data: ganho, error } = await aplicarValorizacao(filho_id);
    setEnviando(false);
    if (error) { setErrModal(error); return; }
    setSucModal(`+${ganho} pontos creditados no cofrinho!`);
    await carregar();
  }

  async function handlePenalizar() {
    setErrModal(null);
    const v = Number.parseInt(penValorStr, 10);
    if (!penValorStr || Number.isNaN(v) || v <= 0) return setErrModal('Informe um valor válido.');
    if (!penDesc.trim()) return setErrModal('Informe a descrição.');
    if (!filho_id) return;
    setEnviando(true);
    const { error } = await aplicarPenalizacao(filho_id, v, penDesc.trim());
    setEnviando(false);
    if (error) { setErrModal(error); return; }
    setModalTipo(null);
    await carregar();
  }

  async function handleSalvarConfig() {
    setErrModal(null);
    const idx = Number.parseFloat(cfgIndice.replace(',', '.'));
    if (Number.isNaN(idx) || idx < 0 || idx > 100) return setErrModal('Índice deve estar entre 0 e 100.');
    if (!filho_id) return;
    setEnviando(true);
    const { error } = await configurarValorizacao(filho_id, idx, cfgPeriodo);
    setEnviando(false);
    if (error) { setErrModal(error); return; }
    setModalTipo(null);
    await carregar();
  }

  if (carregando) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  const saldoLivre = saldo?.saldo_livre ?? 0;
  const cofrinho = saldo?.cofrinho ?? 0;
  const periodoAtual = saldo ? labelPeriodoValorizacao(saldo.periodo_valorizacao) : null;
  const hasConfigSuccess = Boolean(sucModal);
  const hasModalError = Boolean(errModal);
  const hasMovimentacoes = movs.length > 0;
  const hasValorizacaoConfigurada = (saldo?.indice_valorizacao ?? 0) > 0;
  const ultimaValorizacaoTexto = saldo?.data_ultima_valorizacao
    ? ` · última em ${new Date(saldo.data_ultima_valorizacao).toLocaleDateString('pt-BR')}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title={nome ?? 'Filho'} onBack={() => router.back()} />

      <FlatList
        data={movs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
            <View style={styles.cardsRow}>
              <View style={[styles.saldoCard, { backgroundColor: colors.accent.admin }]}>
                <Text style={styles.saldoLabel}>💰 Saldo livre</Text>
                <Text style={styles.saldoValor}>{saldoLivre}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </View>
              <View style={[styles.saldoCard, { backgroundColor: colors.semantic.warning }]}>
                <Text style={styles.saldoLabel}>🐷 Cofrinho</Text>
                <Text style={styles.saldoValor}>{cofrinho}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </View>
            </View>

            <View style={styles.boxConfig}>
              <Text style={styles.boxConfigTitulo}>📈 Valorização do cofrinho</Text>
              {hasValorizacaoConfigurada ? (
                <Text style={styles.boxConfigTexto}>
                  {saldo!.indice_valorizacao}% ao {periodoAtual}{ultimaValorizacaoTexto}
                </Text>
              ) : (
                <Text style={styles.boxConfigTexto}>Não configurada</Text>
              )}
              <View style={styles.acoesBtns}>
                <Pressable style={styles.btnAcao} onPress={() => abrirModal('valorizacao_config')}>
                  <Text style={styles.btnAcaoTexto}>Configurar</Text>
                </Pressable>
                {hasValorizacaoConfigurada ? (
                  <Pressable
                    style={[styles.btnAcao, { backgroundColor: colors.semantic.successBg }]}
                    onPress={handleValorizacao}
                    disabled={enviando}
                  >
                    <Text style={[styles.btnAcaoTexto, { color: colors.semantic.success }]}>
                      {enviando ? '…' : 'Aplicar agora'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {hasConfigSuccess ? <Text style={styles.sucTexto}>{sucModal}</Text> : null}
            </View>

            <Pressable style={styles.btnPenalizar} onPress={() => abrirModal('penalizar')}>
              <Text style={styles.btnPenalizarTexto}>⚠️ Aplicar penalização</Text>
            </Pressable>

            <Text style={styles.secaoTitulo}>Histórico</Text>
            {!hasMovimentacoes ? (
              <Text style={styles.vazio}>Nenhuma movimentação ainda.</Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.movItem}>
            <Text style={styles.movEmoji}>{emojiTipo(item.tipo)}</Text>
            <View style={styles.movInfo}>
              <Text style={styles.movLabel}>{labelTipo(item.tipo)}</Text>
              <Text style={styles.movDesc} numberOfLines={1}>{item.descricao}</Text>
              <Text style={styles.movData}>
                {new Date(item.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
            <Text style={[styles.movValor, isCredito(item.tipo) ? styles.creditoTxt : styles.debitoTxt]}>
              {isCredito(item.tipo) ? '+' : '-'}{item.valor}
            </Text>
          </View>
        )}
      />

      {/* Modal penalização */}
      <Modal visible={modalTipo === 'penalizar'} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>⚠️ Penalização — {nome}</Text>
            <Text style={styles.label}>Valor (pontos) *</Text>
            <TextInput
              style={styles.input}
              value={penValorStr}
              onChangeText={setPenValorStr}
              placeholder="Ex: 10"
              placeholderTextColor={colors.text.muted}
              keyboardType="number-pad"
              maxLength={5}
            />
            <Text style={styles.label}>Motivo *</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={penDesc}
              onChangeText={setPenDesc}
              placeholder="Descreva o motivo…"
              placeholderTextColor={colors.text.muted}
              multiline
              maxLength={200}
            />
            {hasModalError ? <Text style={styles.errModal}>{errModal}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancelar} onPress={() => setModalTipo(null)}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnConfirmar, { backgroundColor: colors.semantic.error }, enviando && styles.btnDesabilitado]}
                onPress={handlePenalizar}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>Penalizar</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal config valorização */}
      <Modal visible={modalTipo === 'valorizacao_config'} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>📈 Configurar valorização</Text>
            <Text style={styles.label}>Índice (%) *</Text>
            <TextInput
              style={styles.input}
              value={cfgIndice}
              onChangeText={setCfgIndice}
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
                  style={[styles.periodoBotao, cfgPeriodo === p.value && styles.periodoAtivo]}
                  onPress={() => setCfgPeriodo(p.value)}
                >
                  <Text style={[styles.periodoTexto, cfgPeriodo === p.value && styles.periodoTextoAtivo]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {hasModalError ? <Text style={styles.errModal}>{errModal}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancelar} onPress={() => setModalTipo(null)}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnConfirmar, enviando && styles.btnDesabilitado]}
                onPress={handleSalvarConfig}
                disabled={enviando}
              >
                {enviando
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
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
    },
    saldoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: typography.size.xs, fontWeight: typography.weight.semibold, marginBottom: 3 },
    saldoValor: { color: '#fff', fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold },
    saldoPts: { color: 'rgba(255,255,255,0.8)', fontSize: typography.size.xs, marginTop: 2 },
    boxConfig: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['3'],
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
    },
    boxConfigTitulo: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text.primary, marginBottom: spacing['1'] },
    boxConfigTexto: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing['3'] },
    acoesBtns: { flexDirection: 'row', gap: spacing['2'] },
    btnAcao: {
      backgroundColor: colors.accent.adminBg,
      borderRadius: radii.md,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['3'],
    },
    btnAcaoTexto: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.accent.admin },
    sucTexto: { color: colors.semantic.success, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginTop: spacing['2'] },
    btnPenalizar: {
      backgroundColor: colors.semantic.errorBg,
      borderRadius: radii.lg,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      marginBottom: spacing['5'],
    },
    btnPenalizarTexto: { color: colors.semantic.error, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
    secaoTitulo: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text.primary, marginBottom: spacing['3'] },
    vazio: { color: colors.text.muted, fontSize: typography.size.sm, textAlign: 'center', marginTop: spacing['2'] },
    movItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg.surface,
      borderRadius: radii.lg,
      padding: spacing['3'],
      marginBottom: spacing['2'],
    },
    movEmoji: { fontSize: 22, marginRight: spacing['3'] },
    movInfo: { flex: 1 },
    movLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.text.primary },
    movDesc: { fontSize: typography.size.xs, color: colors.text.secondary, marginTop: 1 },
    movData: { fontSize: typography.size.xs, color: colors.text.muted, marginTop: 2 },
    movValor: { fontSize: typography.size.md, fontWeight: typography.weight.bold },
    creditoTxt: { color: colors.semantic.success },
    debitoTxt: { color: colors.semantic.error },
    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalBox: {
      backgroundColor: colors.bg.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing['6'],
      paddingBottom: spacing['12'],
      gap: spacing['3'],
    },
    modalTitulo: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary },
    label: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.text.secondary },
    input: {
      backgroundColor: colors.bg.canvas,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      color: colors.text.primary,
    },
    periodoRow: { flexDirection: 'row', gap: spacing['2'] },
    periodoBotao: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingVertical: spacing['2'],
      alignItems: 'center',
    },
    periodoAtivo: { backgroundColor: colors.accent.adminBg, borderColor: colors.accent.admin },
    periodoTexto: { fontSize: typography.size.sm, color: colors.text.secondary, fontWeight: typography.weight.medium },
    periodoTextoAtivo: { color: colors.accent.admin, fontWeight: typography.weight.bold },
    errModal: { color: colors.semantic.error, fontSize: typography.size.xs },
    modalBtns: { flexDirection: 'row', gap: spacing['3'] },
    btnCancelar: { flex: 1, borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.lg, paddingVertical: spacing['3'], alignItems: 'center' },
    btnCancelarTexto: { color: colors.text.secondary, fontWeight: typography.weight.semibold },
    btnConfirmar: { flex: 1, backgroundColor: colors.accent.admin, borderRadius: radii.lg, paddingVertical: spacing['3'], alignItems: 'center' },
    btnConfirmarTexto: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.md },
    btnDesabilitado: { opacity: 0.5 },
  });
}
