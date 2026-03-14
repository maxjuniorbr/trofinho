import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  listarTarefasAdmin,
  type TarefaListItem,
  type StatusAtribuicao,
} from '@lib/tarefas';

function resumoAtribuicoes(atribuicoes: { status: StatusAtribuicao }[]) {
  const pendentes = atribuicoes.filter((a) => a.status === 'pendente').length;
  const aguardando = atribuicoes.filter(
    (a) => a.status === 'aguardando_validacao'
  ).length;
  const aprovadas = atribuicoes.filter((a) => a.status === 'aprovada').length;
  return { pendentes, aguardando, aprovadas, total: atribuicoes.length };
}

export default function AdminTarefasScreen() {
  const router = useRouter();
  const [tarefas, setTarefas] = useState<TarefaListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await listarTarefasAdmin();
    if (error) setErro(error);
    else setTarefas(data);
    setCarregando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Text style={styles.voltarTexto}>← Início</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Tarefas</Text>
        <TouchableOpacity
          style={styles.botaoNova}
          onPress={() => router.push('/(admin)/tarefas/nova')}
        >
          <Text style={styles.botaoNovaTexto}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : erro ? (
        <View style={styles.centro}>
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity style={styles.botaoRetentar} onPress={carregar}>
            <Text style={styles.botaoRetentarTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : tarefas.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vazio}>Nenhuma tarefa criada.</Text>
          <Text style={styles.vazioSub}>
            Toque em "+ Nova" para criar a primeira tarefa.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tarefas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => {
            const { pendentes, aguardando, aprovadas, total } =
              resumoAtribuicoes(item.atribuicoes);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  router.push(`/(admin)/tarefas/${item.id}` as never)
                }
              >
                <View style={styles.cardTopo}>
                  <Text style={styles.cardTitulo} numberOfLines={2}>
                    {item.titulo}
                  </Text>
                  <View style={styles.pontosTag}>
                    <Text style={styles.pontosTexto}>
                      {item.pontos} pts
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardPrazo}>
                  Prazo: {item.timebox_fim}
                </Text>
                <View style={styles.cardStats}>
                  {total === 0 ? (
                    <Text style={styles.statTexto}>Sem atribuições</Text>
                  ) : (
                    <>
                      {pendentes > 0 && (
                        <View style={[styles.statTag, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.statTagTexto, { color: '#92400E' }]}>
                            {pendentes} pendente{pendentes > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                      {aguardando > 0 && (
                        <View style={[styles.statTag, { backgroundColor: '#DBEAFE' }]}>
                          <Text style={[styles.statTagTexto, { color: '#1E40AF' }]}>
                            {aguardando} validar
                          </Text>
                        </View>
                      )}
                      {aprovadas > 0 && (
                        <View style={[styles.statTag, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.statTagTexto, { color: '#065F46' }]}>
                            {aprovadas} aprovada{aprovadas > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3FF',
  },
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
  voltar: { minWidth: 60 },
  voltarTexto: { color: '#4F46E5', fontSize: 15, fontWeight: '500' },
  titulo: { fontSize: 18, fontWeight: '700', color: '#111827' },
  botaoNova: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  botaoNovaTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  erroTexto: { color: '#EF4444', fontSize: 15, textAlign: 'center', marginBottom: 12 },
  botaoRetentar: {
    borderWidth: 1,
    borderColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  botaoRetentarTexto: { color: '#4F46E5', fontSize: 14, fontWeight: '500' },
  vazio: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  vazioSub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  lista: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitulo: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  pontosTag: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  pontosTexto: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  cardPrazo: { fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  cardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statTexto: { fontSize: 13, color: '#9CA3AF' },
  statTag: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  statTagTexto: { fontSize: 12, fontWeight: '600' },
});
