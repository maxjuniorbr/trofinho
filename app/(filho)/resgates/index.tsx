import {
  StyleSheet,
  Text,
  View,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncListState from '@/components/AsyncListState';
import {
  listarResgatesFilho,
  labelStatusResgate,
  emojiStatusResgate,
  corStatusResgate,
  type ResgateComPremio,
} from '@lib/premios';

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function FilhoResgatesScreen() {
  const [resgates, setResgates] = useState<ResgateComPremio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await listarResgatesFilho();
      if (error) setErro(error);
      else setResgates(data);
    } catch {
      setErro('Não foi possível carregar o histórico agora.');
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

  function renderConteudo() {
    if (carregando || erro || resgates.length === 0) {
      return (
        <AsyncListState
          loading={carregando}
          error={erro}
          empty={resgates.length === 0}
          emptyMessage={'Nenhum resgate realizado ainda.\nVá ao catálogo e troque seus pontos!'}
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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopo}>
              <Text style={styles.cardNome}>{item.premios.nome}</Text>
              <View style={[styles.statusBadge, { backgroundColor: corStatusResgate(item.status) + '22' }]}>
                <Text style={[styles.statusTexto, { color: corStatusResgate(item.status) }]}>
                  {emojiStatusResgate(item.status)} {labelStatusResgate(item.status)}
                </Text>
              </View>
            </View>
            <View style={styles.cardRodape}>
              <Text style={styles.cardPontos}>🏆 {item.pontos_debitados} pts</Text>
              <Text style={styles.cardData}>{formatarData(item.created_at)}</Text>
            </View>
          </View>
        )}
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
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  lista: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 16,
    gap: 10,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusTexto: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardPontos: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  cardData: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
