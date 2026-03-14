import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  buscarSaldo,
  listarMovimentacoes,
  aplicarValorizacao,
  aplicarPenalizacao,
  configurarValorizacao,
  emojiTipo,
  labelTipo,
  isCredito,
  type Saldo,
  type Movimentacao,
} from '@lib/saldos';

type ModalTipo = 'penalizar' | 'valorizacao_config' | null;

const PERIODOS: Array<{ label: string; value: 'diario' | 'semanal' | 'mensal' }> = [
  { label: 'Diário', value: 'diario' },
  { label: 'Semanal', value: 'semanal' },
  { label: 'Mensal', value: 'mensal' },
];

export default function SaldoFilhoAdminScreen() {
  const router = useRouter();
  const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();

  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Modal
  const [modalTipo, setModalTipo] = useState<ModalTipo>(null);
  const [enviando, setEnviando] = useState(false);
  const [errModal, setErrModal] = useState<string | null>(null);
  const [sucModal, setSucModal] = useState<string | null>(null);

  // Penalização
  const [penValorStr, setPenValorStr] = useState('');
  const [penDesc, setPenDesc] = useState('');

  // Config valorização
  const [cfgIndice, setCfgIndice] = useState('');
  const [cfgPeriodo, setCfgPeriodo] = useState<'diario' | 'semanal' | 'mensal'>('mensal');

  const carregar = useCallback(async () => {
    if (!filho_id) return;
    setCarregando(true);
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
    setCarregando(false);
  }, [filho_id]);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

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
    void carregar();
  }

  async function handlePenalizar() {
    setErrModal(null);
    const v = parseInt(penValorStr, 10);
    if (!penValorStr || isNaN(v) || v <= 0) return setErrModal('Informe um valor válido.');
    if (!penDesc.trim()) return setErrModal('Informe a descrição.');
    if (!filho_id) return;

    setEnviando(true);
    const { error } = await aplicarPenalizacao(filho_id, v, penDesc.trim());
    setEnviando(false);
    if (error) { setErrModal(error); return; }
    setModalTipo(null);
    void carregar();
  }

  async function handleSalvarConfig() {
    setErrModal(null);
    const idx = parseFloat(cfgIndice.replace(',', '.'));
    if (isNaN(idx) || idx < 0 || idx > 100) return setErrModal('Índice deve estar entre 0 e 100.');
    if (!filho_id) return;

    setEnviando(true);
    const { error } = await configurarValorizacao(filho_id, idx, cfgPeriodo);
    setEnviando(false);
    if (error) { setErrModal(error); return; }
    setModalTipo(null);
    void carregar();
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const saldoLivre = saldo?.saldo_livre ?? 0;
  const cofrinho = saldo?.cofrinho ?? 0;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltar}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>{nome ?? 'Filho'}</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <FlatList
        data={movs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
            {/* Saldo cards */}
            <View style={styles.cardsRow}>
              <View style={[styles.saldoCard, { backgroundColor: '#4F46E5' }]}>
                <Text style={styles.saldoLabel}>💰 Saldo livre</Text>
                <Text style={styles.saldoValor}>{saldoLivre}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </View>
              <View style={[styles.saldoCard, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.saldoLabel}>🐷 Cofrinho</Text>
                <Text style={styles.saldoValor}>{cofrinho}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </View>
            </View>

            {/* Configuração de valorização atual */}
            <View style={styles.boxConfig}>
              <Text style={styles.boxConfigTitulo}>📈 Valorização do cofrinho</Text>
              {(saldo?.indice_valorizacao ?? 0) > 0 ? (
                <Text style={styles.boxConfigTexto}>
                  {saldo!.indice_valorizacao}% ao{' '}
                  {saldo!.periodo_valorizacao === 'diario'
                    ? 'dia'
                    : saldo!.periodo_valorizacao === 'semanal'
                    ? 'semana'
                    : 'mês'}
                  {saldo?.data_ultima_valorizacao
                    ? ` · última em ${new Date(saldo.data_ultima_valorizacao).toLocaleDateString('pt-BR')}`
                    : ''}
                </Text>
              ) : (
                <Text style={styles.boxConfigTexto}>Não configurada</Text>
              )}
              <View style={styles.acoesBtns}>
                <TouchableOpacity
                  style={styles.btnAcao}
                  onPress={() => abrirModal('valorizacao_config')}
                >
                  <Text style={styles.btnAcaoTexto}>Configurar</Text>
                </TouchableOpacity>
                {(saldo?.indice_valorizacao ?? 0) > 0 && (
                  <TouchableOpacity
                    style={[styles.btnAcao, { backgroundColor: '#ECFDF5' }]}
                    onPress={handleValorizacao}
                  >
                    <Text style={[styles.btnAcaoTexto, { color: '#065F46' }]}>Aplicar agora</Text>
                  </TouchableOpacity>
                )}
              </View>
              {sucModal && <Text style={styles.sucTexto}>{sucModal}</Text>}
            </View>

            {/* Botão penalizar */}
            <TouchableOpacity
              style={styles.btnPenalizar}
              onPress={() => abrirModal('penalizar')}
            >
              <Text style={styles.btnPenalizarTexto}>⚠️ Aplicar penalização</Text>
            </TouchableOpacity>

            <Text style={styles.secaoTitulo}>Histórico</Text>
            {movs.length === 0 && (
              <Text style={styles.vazio}>Nenhuma movimentação ainda.</Text>
            )}
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>⚠️ Penalização — {nome}</Text>
            <Text style={styles.label}>Valor (pontos) *</Text>
            <TextInput
              style={styles.input}
              value={penValorStr}
              onChangeText={setPenValorStr}
              placeholder="Ex: 10"
              keyboardType="number-pad"
              maxLength={5}
            />
            <Text style={styles.label}>Motivo *</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={penDesc}
              onChangeText={setPenDesc}
              placeholder="Descreva o motivo…"
              multiline
              maxLength={200}
            />
            {errModal && <Text style={styles.errModal}>{errModal}</Text>}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={() => setModalTipo(null)}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirmar, { backgroundColor: '#EF4444' }, enviando && styles.btnDesabilitado]}
                onPress={handlePenalizar}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>Penalizar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal config valorização */}
      <Modal visible={modalTipo === 'valorizacao_config'} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>📈 Configurar valorização</Text>
            <Text style={styles.label}>Índice (%) *</Text>
            <TextInput
              style={styles.input}
              value={cfgIndice}
              onChangeText={setCfgIndice}
              placeholder="Ex: 5"
              keyboardType="decimal-pad"
              maxLength={6}
            />
            <Text style={styles.label}>Período</Text>
            <View style={styles.periodoRow}>
              {PERIODOS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.periodoBotao, cfgPeriodo === p.value && styles.periodoAtivo]}
                  onPress={() => setCfgPeriodo(p.value)}
                >
                  <Text style={[styles.periodoTexto, cfgPeriodo === p.value && styles.periodoTextoAtivo]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errModal && <Text style={styles.errModal}>{errModal}</Text>}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={() => setModalTipo(null)}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirmar, enviando && styles.btnDesabilitado]}
                onPress={handleSalvarConfig}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF' },
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  voltar: { color: '#4F46E5', fontSize: 15, fontWeight: '500' },
  titulo: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  lista: { padding: 20, paddingBottom: 48 },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  saldoCard: {
    flex: 1, borderRadius: 16, padding: 18, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, elevation: 3,
  },
  saldoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  saldoValor: { color: '#fff', fontSize: 36, fontWeight: '800' },
  saldoPts: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  boxConfig: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  boxConfigTitulo: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  boxConfigTexto: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  acoesBtns: { flexDirection: 'row', gap: 8 },
  btnAcao: {
    backgroundColor: '#EEF2FF', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  btnAcaoTexto: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
  sucTexto: { color: '#10B981', fontSize: 13, marginTop: 10, fontWeight: '600' },
  btnPenalizar: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: '#FECACA',
  },
  btnPenalizarTexto: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  vazio: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 8 },
  movItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  movEmoji: { fontSize: 22, marginRight: 12 },
  movInfo: { flex: 1 },
  movLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  movDesc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  movData: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  movValor: { fontSize: 16, fontWeight: '700' },
  creditoTxt: { color: '#10B981' },
  debitoTxt: { color: '#EF4444' },
  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 48,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827',
  },
  periodoRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  periodoBotao: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  periodoAtivo: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  periodoTexto: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  periodoTextoAtivo: { color: '#fff', fontWeight: '700' },
  errModal: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancelar: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  btnCancelarTexto: { color: '#6B7280', fontWeight: '600' },
  btnConfirmar: {
    flex: 1, backgroundColor: '#4F46E5',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDesabilitado: { opacity: 0.6 },
});
