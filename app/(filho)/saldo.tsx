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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  buscarSaldo,
  listarMovimentacoes,
  transferirParaCofrinho,
  emojiTipo,
  labelTipo,
  isCredito,
  type Saldo,
  type Movimentacao,
} from '@lib/saldos';
import { buscarMeuFilhoId } from '@lib/filhos';

export default function SaldoFilhoScreen() {
  const router = useRouter();
  const [filhoId, setFilhoId] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Modal transferência
  const [modalAberto, setModalAberto] = useState(false);
  const [valorStr, setValorStr] = useState('');
  const [errModal, setErrModal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const id = await buscarMeuFilhoId();
    setFilhoId(id);
    if (!id) { setCarregando(false); return; }

    const [{ data: s }, { data: m }] = await Promise.all([
      buscarSaldo(id),
      listarMovimentacoes(id),
    ]);
    setSaldo(s);
    setMovs(m);
    setCarregando(false);
  }, []);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  async function handleTransferir() {
    setErrModal(null);
    const v = parseInt(valorStr, 10);
    if (!valorStr || isNaN(v) || v <= 0) return setErrModal('Informe um valor válido.');
    if (!saldo || v > saldo.saldo_livre) return setErrModal('Saldo livre insuficiente.');
    if (!filhoId) return;

    setEnviando(true);
    const { error } = await transferirParaCofrinho(filhoId, v);
    setEnviando(false);

    if (error) { setErrModal(error); return; }
    setModalAberto(false);
    setValorStr('');
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
        <Text style={styles.titulo}>Meu Saldo</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <FlatList
        data={movs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
            {/* Cards de saldo */}
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

            {/* Info valorização */}
            {(saldo?.indice_valorizacao ?? 0) > 0 && (
              <View style={styles.valBox}>
                <Text style={styles.valTexto}>
                  📈 Seu cofrinho rende {saldo!.indice_valorizacao}% ao{' '}
                  {saldo!.periodo_valorizacao === 'diario'
                    ? 'dia'
                    : saldo!.periodo_valorizacao === 'semanal'
                    ? 'semana'
                    : 'mês'}
                  {saldo?.data_ultima_valorizacao
                    ? ` · última em ${new Date(saldo.data_ultima_valorizacao).toLocaleDateString('pt-BR')}`
                    : ''}
                </Text>
              </View>
            )}

            {/* Botão transferir */}
            <TouchableOpacity
              style={[styles.btnTransferir, saldoLivre === 0 && styles.btnDesabilitado]}
              onPress={() => { setModalAberto(true); setValorStr(''); setErrModal(null); }}
              disabled={saldoLivre === 0}
            >
              <Text style={styles.btnTransferirTexto}>🐷 Guardar no cofrinho</Text>
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
            <Text style={[styles.movValor, isCredito(item.tipo) ? styles.credito : styles.debito]}>
              {isCredito(item.tipo) ? '+' : '-'}{item.valor}
            </Text>
          </View>
        )}
      />

      {/* Modal transferência */}
      <Modal visible={modalAberto} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>🐷 Guardar no cofrinho</Text>
            <Text style={styles.modalSub}>
              Saldo livre disponível: <Text style={{ fontWeight: '700' }}>{saldoLivre}</Text> pts
            </Text>
            <TextInput
              style={styles.modalInput}
              value={valorStr}
              onChangeText={setValorStr}
              placeholder="Quantos pontos?"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {errModal && <Text style={styles.errModal}>{errModal}</Text>}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={() => setModalAberto(false)}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirmar, enviando && styles.btnDesabilitado]}
                onPress={handleTransferir}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>Guardar</Text>
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
  titulo: { fontSize: 18, fontWeight: '700', color: '#111827' },
  lista: { padding: 20, paddingBottom: 48 },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  saldoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  saldoLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  saldoValor: { color: '#fff', fontSize: 36, fontWeight: '800' },
  saldoPts: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  valBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  valTexto: { color: '#065F46', fontSize: 13 },
  btnTransferir: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnDesabilitado: { opacity: 0.4 },
  btnTransferirTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  vazio: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 8 },
  movItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  movEmoji: { fontSize: 22, marginRight: 12 },
  movInfo: { flex: 1 },
  movLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  movDesc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  movData: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  movValor: { fontSize: 16, fontWeight: '700' },
  credito: { color: '#10B981' },
  debito: { color: '#EF4444' },
  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 48,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSub: { fontSize: 14, color: '#374151', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  errModal: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancelar: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  btnCancelarTexto: { color: '#6B7280', fontWeight: '600' },
  btnConfirmar: {
    flex: 1, backgroundColor: '#F59E0B',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
