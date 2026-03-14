import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { listarSaldosAdmin, type SaldoComFilho } from '@lib/saldos';

export default function SaldosAdminScreen() {
  const router = useRouter();
  const [itens, setItens] = useState<SaldoComFilho[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);

    try {
      const { data } = await listarSaldosAdmin();
      setItens(data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.voltar}>← Voltar</Text>
        </Pressable>
        <Text style={styles.titulo}>Saldos dos Filhos</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <FlatList
        data={itens}
        keyExtractor={(s) => s.filho_id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vazio}>
            Nenhum saldo ainda.{'\n'}Aprove tarefas para creditar pontos.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: '/(admin)/saldos/[filho_id]', params: { filho_id: item.filho_id, nome: item.filhos.nome } })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarLetra}>
                {item.filhos.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.nome}>{item.filhos.nome}</Text>
              <Text style={styles.detalhe}>
                💰 {item.saldo_livre} livre · 🐷 {item.cofrinho} cofrinho
              </Text>
              {item.indice_valorizacao > 0 && (
                <Text style={styles.detalhe}>
                  📈 {item.indice_valorizacao}%/{item.periodo_valorizacao}
                </Text>
              )}
            </View>
            <Text style={styles.seta}>›</Text>
          </Pressable>
        )}
      />
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
  vazio: {
    color: '#9CA3AF', fontSize: 14,
    textAlign: 'center', marginTop: 60, lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarLetra: { fontSize: 20, fontWeight: '700', color: '#4F46E5' },
  info: { flex: 1 },
  nome: { fontSize: 16, fontWeight: '700', color: '#111827' },
  detalhe: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  seta: { color: '#9CA3AF', fontSize: 22 },
});
