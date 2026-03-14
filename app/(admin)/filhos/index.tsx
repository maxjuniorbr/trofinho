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
import { listarFilhos } from '@lib/filhos';
import type { Filho } from '@lib/tarefas';

export default function AdminFilhosScreen() {
  const router = useRouter();
  const [filhos, setFilhos] = useState<Filho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const { data, error } = await listarFilhos();

      if (error) setErro(error);
      else setFilhos(data);
    } catch {
      setErro('Não foi possível carregar os filhos agora.');
      setFilhos([]);
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
    if (carregando || erro || filhos.length === 0) {
      return (
        <AsyncListState
          loading={carregando}
          error={erro}
          empty={filhos.length === 0}
          emptyMessage={'Nenhum filho cadastrado.\nToque em "+ Novo" para cadastrar o primeiro filho.'}
          onRetry={carregar}
        />
      );
    }

    return (
      <FlatList
        data={filhos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetra}>
                {item.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardNome}>{item.nome}</Text>
              <Text style={styles.cardStatus}>
                {item.usuario_id ? '✓ Conta vinculada' : '⚠ Sem conta'}
              </Text>
            </View>
          </View>
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTexto}>← Início</Text>
        </Pressable>
        <Text style={styles.titulo}>Filhos</Text>
        <Pressable
          style={styles.botaoNovo}
          onPress={() => router.push('/(admin)/filhos/novo')}
        >
          <Text style={styles.botaoNovoTexto}>+ Novo</Text>
        </Pressable>
      </View>

      {renderConteudo()}
    </View>
  );
}

const styles = StyleSheet.create({
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
  voltarBtn: { minWidth: 60 },
  voltarTexto: { color: '#4F46E5', fontSize: 15, fontWeight: '500' },
  titulo: { fontSize: 18, fontWeight: '700', color: '#111827' },
  botaoNovo: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  botaoNovoTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
  lista: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLetra: { fontSize: 20, fontWeight: '700', color: '#4F46E5' },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardStatus: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
