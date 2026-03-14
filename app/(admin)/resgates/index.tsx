import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncListState from '@/components/AsyncListState';
import {
  listarResgates,
  confirmarResgate,
  cancelarResgate,
  labelStatusResgate,
  emojiStatusResgate,
  corStatusResgate,
  type ResgateComFilhoEPremio,
} from '@lib/premios';

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function AdminResgatesScreen() {
  const [resgates, setResgates] = useState<ResgateComFilhoEPremio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setErroAcao(null);
    try {
      const { data, error } = await listarResgates();
      if (error) setErro(error);
      else setResgates(data);
    } catch {
      setErro('Não foi possível carregar os resgates agora.');
      setResgates([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function handleConfirmar(resgateId: string, nomeFilho: string, nomePremio: string) {
    setErroAcao(null);
    Alert.alert(
      'Confirmar entrega',
      `Confirmar entrega do prêmio "${nomePremio}" para ${nomeFilho}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            setProcessando(resgateId);
            const { error } = await confirmarResgate(resgateId);
            setProcessando(null);
            if (error) {
              setErroAcao(error);
            } else {
              carregar();
            }
          },
        },
      ]
    );
  }

  async function handleCancelar(resgateId: string, nomeFilho: string, nomePremio: string, pontos: number) {
    setErroAcao(null);
    Alert.alert(
      'Cancelar resgate',
      `Cancelar o resgate de "${nomePremio}" de ${nomeFilho}? Os ${pontos} pts serão estornados.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar resgate',
          style: 'destructive',
          onPress: async () => {
            setProcessando(resgateId);
            const { error } = await cancelarResgate(resgateId);
            setProcessando(null);
            if (error) {
              setErroAcao(error);
            } else {
              carregar();
            }
          },
        },
      ]
    );
  }

  const pendentes = resgates.filter((r) => r.status === 'pendente');
  const historico = resgates.filter((r) => r.status !== 'pendente');

  function renderConteudo() {
    if (carregando || erro || resgates.length === 0) {
      return (
        <AsyncListState
          loading={carregando}
          error={erro}
          empty={resgates.length === 0}
          emptyMessage={'Nenhum resgate registrado ainda.'}
          onRetry={carregar}
        />
      );
    }

    return (
      <FlatList
        data={resgates}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
            {erroAcao ? (
              <Text style={styles.erroAcao} accessibilityRole="alert">{erroAcao}</Text>
            ) : null}
            {pendentes.length > 0 && (
              <View style={styles.secaoHeader}>
                <Text style={styles.secaoTitulo}>⏳ Pendentes ({pendentes.length})</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const isPendente = item.status === 'pendente';
          const isProcessando = processando === item.id;

          // Insere separador quando começa o histórico
          const anteriorPendente = index > 0 && resgates[index - 1]?.status === 'pendente';
          const esteNaoPendente = !isPendente;
          const mostrarSeparadorHistorico = esteNaoPendente && (index === 0 || anteriorPendente);

          return (
            <>
              {mostrarSeparadorHistorico && (
                <View style={styles.secaoHeader}>
                  <Text style={styles.secaoTitulo}>Histórico</Text>
                </View>
              )}
              <View style={[styles.card, isPendente && styles.cardPendente]}>
                <View style={styles.cardTopo}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardNome}>{item.premios.nome}</Text>
                    <Text style={styles.cardFilho}>👤 {item.filhos.nome}</Text>
                  </View>
                  <View>
                    <View style={[styles.statusBadge, { backgroundColor: corStatusResgate(item.status) + '22' }]}>
                      <Text style={[styles.statusTexto, { color: corStatusResgate(item.status) }]}>
                        {emojiStatusResgate(item.status)} {labelStatusResgate(item.status)}
                      </Text>
                    </View>
                    <Text style={styles.cardData}>{formatarData(item.created_at)}</Text>
                  </View>
                </View>

                <Text style={styles.cardPontos}>🏆 {item.pontos_debitados} pts</Text>

                {isPendente && (
                  <View style={styles.acoesRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.botaoConfirmar,
                        isProcessando && styles.botaoDesabilitado,
                        pressed && !isProcessando && { opacity: 0.85 },
                      ]}
                      onPress={() => handleConfirmar(item.id, item.filhos.nome, item.premios.nome)}
                      disabled={isProcessando}
                      accessibilityRole="button"
                      accessibilityLabel="Confirmar entrega"
                    >
                      <Text style={styles.botaoConfirmarTexto}>
                        {isProcessando ? '…' : '✓ Confirmar'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.botaoCancelar,
                        isProcessando && styles.botaoDesabilitado,
                        pressed && !isProcessando && { opacity: 0.85 },
                      ]}
                      onPress={() => handleCancelar(item.id, item.filhos.nome, item.premios.nome, item.pontos_debitados)}
                      disabled={isProcessando}
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar resgate"
                    >
                      <Text style={styles.botaoCancelarTexto}>
                        {isProcessando ? '…' : '✕ Cancelar'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          );
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {renderConteudo()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  lista: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  erroAcao: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  secaoHeader: {
    paddingVertical: 8,
  },
  secaoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 16,
    gap: 8,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  },
  cardPendente: {
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  cardFilho: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-end',
  },
  statusTexto: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardData: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  cardPontos: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  acoesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  botaoConfirmar: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingVertical: 10,
    alignItems: 'center',
  },
  botaoConfirmarTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  botaoCancelar: {
    flex: 1,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 10,
    alignItems: 'center',
  },
  botaoCancelarTexto: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
});
