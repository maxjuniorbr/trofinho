import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncListState from '@/components/AsyncListState';
import { listarPremios, type Premio } from '@lib/premios';

export default function AdminPremiosScreen() {
  const router = useRouter();
  const [premios, setPremios] = useState<Premio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await listarPremios();
      if (error) setErro(error);
      else setPremios(data);
    } catch {
      setErro('Não foi possível carregar os prêmios agora.');
      setPremios([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const ativos = premios.filter((p) => p.ativo);
  const inativos = premios.filter((p) => !p.ativo);

  function renderConteudo() {
    if (carregando || erro || premios.length === 0) {
      return (
        <AsyncListState
          loading={carregando}
          error={erro}
          empty={premios.length === 0}
          emptyMessage={'Nenhum prêmio cadastrado.\nToque em "+ Novo" para criar o primeiro prêmio.'}
          onRetry={carregar}
        />
      );
    }

    return (
      <FlatList
        data={premios}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          premios.length > 0 ? (
            <Text style={styles.resumo}>
              {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}{inativos.length > 0 ? ` · ${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}` : ''}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              !item.ativo && styles.cardInativo,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push(`/(admin)/premios/${item.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`${item.nome}, ${item.custo_pontos} pontos${!item.ativo ? ', inativo' : ''}`}
          >
            <View style={styles.cardTopo}>
              <Text style={[styles.cardNome, !item.ativo && styles.textoInativo]}>
                {item.nome}
              </Text>
              {!item.ativo && (
                <View style={styles.badgeInativo}>
                  <Text style={styles.badgeInativoTexto}>inativo</Text>
                </View>
              )}
            </View>
            {item.descricao ? (
              <Text style={[styles.cardDescricao, !item.ativo && styles.textoInativo]} numberOfLines={2}>
                {item.descricao}
              </Text>
            ) : null}
            <Text style={[styles.cardCusto, !item.ativo && styles.textoInativo]}>
              🏆 {item.custo_pontos} pts
            </Text>
          </Pressable>
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {renderConteudo()}
      <Pressable
        style={({ pressed }) => [styles.botaoNovo, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/(admin)/premios/novo' as never)}
        accessibilityRole="button"
        accessibilityLabel="Novo prêmio"
      >
        <Text style={styles.botaoNovoTexto}>+ Novo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  lista: {
    padding: 16,
    gap: 12,
    paddingBottom: 96,
  },
  resumo: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 16,
    gap: 6,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  },
  cardInativo: {
    opacity: 0.6,
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
    flex: 1,
  },
  textoInativo: {
    color: '#9CA3AF',
  },
  cardDescricao: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardCusto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  badgeInativo: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeInativoTexto: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  botaoNovo: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 12,
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
  },
  botaoNovoTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
