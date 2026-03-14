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
import { useRouter, useFocusEffect } from 'expo-router';
import {
  buscarSaldo,
  listarMovimentacoes,
  transferirParaCofrinho,
  emojiTipo,
  labelPeriodoValorizacao,
  labelTipo,
  isCredito,
  type Saldo,
  type Movimentacao,
} from '@lib/saldos';
import { buscarMeuFilhoId } from '@lib/filhos';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function SaldoFilhoScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [filhoId, setFilhoId] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [valorStr, setValorStr] = useState('');
  const [errModal, setErrModal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const id = await buscarMeuFilhoId();
      setFilhoId(id);
      if (!id) { setSaldo(null); setMovs([]); return; }
      const [{ data: s }, { data: m }] = await Promise.all([
        buscarSaldo(id),
        listarMovimentacoes(id),
      ]);
      setSaldo(s);
      setMovs(m);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleTransferir() {
    setErrModal(null);
    const v = Number.parseInt(valorStr, 10);
    if (!valorStr || Number.isNaN(v) || v <= 0) return setErrModal('Informe um valor válido.');
    if (!saldo || v > saldo.saldo_livre) return setErrModal('Saldo livre insuficiente.');
    if (!filhoId) return;
    setEnviando(true);
    const { error } = await transferirParaCofrinho(filhoId, v);
    setEnviando(false);
    if (error) { setErrModal(error); return; }
    setModalAberto(false);
    setValorStr('');
    await carregar();
  }

  if (carregando) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.filho} />
      </View>
    );
  }

  const saldoLivre = saldo?.saldo_livre ?? 0;
  const cofrinho = saldo?.cofrinho ?? 0;
  const periodoValorizacao = saldo ? labelPeriodoValorizacao(saldo.periodo_valorizacao) : null;
  const hasMovimentacoes = movs.length > 0;
  const hasModalError = Boolean(errModal);
  const ultimaValorizacaoTexto = saldo?.data_ultima_valorizacao
    ? ` · última em ${new Date(saldo.data_ultima_valorizacao).toLocaleDateString('pt-BR')}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Meu Saldo" onBack={() => router.back()} />

      <FlatList
        data={movs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
            <View style={styles.cardsRow}>
              <View style={[styles.saldoCard, { backgroundColor: colors.accent.filho }]}>
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

            {(saldo?.indice_valorizacao ?? 0) > 0 && (
              <View style={styles.valBox}>
                <Text style={styles.valTexto}>
                  📈 Seu cofrinho rende {saldo!.indice_valorizacao}% ao {periodoValorizacao}
                  {ultimaValorizacaoTexto}
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.btnTransferir, saldoLivre === 0 && styles.btnDesabilitado]}
              onPress={() => { setModalAberto(true); setValorStr(''); setErrModal(null); }}
              disabled={saldoLivre === 0}
            >
              <Text style={styles.btnTransferirTexto}>🐷 Guardar no cofrinho</Text>
            </Pressable>

            <Text style={styles.secaoTitulo}>Histórico</Text>
            {!hasMovimentacoes ? <Text style={styles.vazio}>Nenhuma movimentação ainda.</Text> : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.movItem}>
            <Text style={styles.movEmoji}>{emojiTipo(item.tipo)}</Text>
            <View style={styles.movInfo}>
              <Text style={styles.movLabel}>{labelTipo(item.tipo)}</Text>
              <Text style={styles.movDesc} numberOfLines={1}>{item.descricao}</Text>
              <Text style={styles.movData}>
                {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Text style={[styles.movValor, isCredito(item.tipo) ? styles.credito : styles.debito]}>
              {isCredito(item.tipo) ? '+' : '-'}{item.valor}
            </Text>
          </View>
        )}
      />

      <Modal visible={modalAberto} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>🐷 Guardar no cofrinho</Text>
            <Text style={styles.modalSub}>
              Saldo livre disponível: <Text style={{ fontWeight: typography.weight.bold }}>{saldoLivre}</Text> pts
            </Text>
            <TextInput
              style={styles.modalInput}
              value={valorStr}
              onChangeText={setValorStr}
              placeholder="Quantos pontos?"
              placeholderTextColor={colors.text.muted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {hasModalError ? <Text style={styles.errModal}>{errModal}</Text> : null}
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancelar} onPress={() => setModalAberto(false)}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnConfirmar, enviando && { opacity: 0.6 }]}
                onPress={handleTransferir}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>Guardar</Text>}
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
    cardsRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['3'] },
    saldoCard: {
      flex: 1,
      borderRadius: radii.xl,
      padding: spacing['4'],
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    },
    saldoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: typography.size.xs, fontWeight: typography.weight.semibold, marginBottom: spacing['1'] },
    saldoValor: { color: '#fff', fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold },
    saldoPts: { color: 'rgba(255,255,255,0.8)', fontSize: typography.size.xs, marginTop: 2 },
    valBox: { backgroundColor: colors.semantic.successBg, borderRadius: radii.lg, padding: spacing['2'], marginBottom: spacing['3'] },
    valTexto: { color: colors.semantic.success, fontSize: typography.size.xs },
    btnTransferir: {
      backgroundColor: colors.semantic.warning,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      marginBottom: spacing['6'],
    },
    btnDesabilitado: { opacity: 0.4 },
    btnTransferirTexto: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.md },
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
    credito: { color: colors.semantic.success },
    debito: { color: colors.semantic.error },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalBox: {
      backgroundColor: colors.bg.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: 28,
      paddingBottom: spacing['12'],
      gap: spacing['4'],
    },
    modalTitulo: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary },
    modalSub: { fontSize: typography.size.sm, color: colors.text.secondary },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radii.lg,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['3'],
      fontSize: typography.size['2xl'],
      fontWeight: typography.weight.bold,
      color: colors.text.primary,
      textAlign: 'center',
    },
    errModal: { color: colors.semantic.error, fontSize: typography.size.xs, textAlign: 'center' },
    modalBtns: { flexDirection: 'row', gap: spacing['3'] },
    btnCancelar: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
    },
    btnCancelarTexto: { color: colors.text.secondary, fontWeight: typography.weight.semibold },
    btnConfirmar: {
      flex: 1,
      backgroundColor: colors.semantic.warning,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
    },
    btnConfirmarTexto: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.md },
  });
}
