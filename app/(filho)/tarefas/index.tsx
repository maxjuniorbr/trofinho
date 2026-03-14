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
import {
  listarAtribuicoesFilho,
  labelStatus,
  corStatus,
  type AtribuicaoFilho,
  type StatusAtribuicao,
} from '@lib/tarefas';

type Filtro = 'pendente' | 'aguardando_validacao' | 'historico';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aguardando_validacao', label: 'Em validação' },
  { key: 'historico', label: 'Histórico' },
];

function pertenceFiltro(status: StatusAtribuicao, filtro: Filtro): boolean {
  if (filtro === 'historico') return status === 'aprovada' || status === 'rejeitada';
  return status === filtro;
}

export default function FilhoTarefasScreen() {
  const router = useRouter();
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoFilho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('pendente');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const { data, error } = await listarAtribuicoesFilho();
      if (error) setErro(error);
      else setAtribuicoes(data);
    } catch {
      setErro('Não foi possível carregar suas tarefas agora.');
      setAtribuicoes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const filtradas = atribuicoes.filter((a) =>
    pertenceFiltro(a.status, filtro)
  );

  const mensagemVazio = (() => {
    if (filtro === 'pendente') {
      return 'Nenhuma tarefa pendente.';
    }

    if (filtro === 'aguardando_validacao') {
      return 'Nada aguardando validação.';
    }

    return 'Nenhuma tarefa concluída ainda.';
  })();

  function renderConteudo() {
    if (carregando) {
      return (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      );
    }

    if (erro) {
      return (
        <View style={styles.centro}>
          <Text style={styles.erroTexto}>{erro}</Text>
          <Pressable style={styles.botaoRetentar} onPress={carregar}>
            <Text style={styles.botaoRetentarTexto}>Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }

    if (filtradas.length === 0) {
      return (
        <View style={styles.centro}>
          <Text style={styles.vazio}>{mensagemVazio}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filtradas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push(`/(filho)/tarefas/${item.id}` as never)
            }
          >
            <View style={styles.cardTopo}>
              <Text style={styles.cardTitulo} numberOfLines={2}>
                {item.tarefas.titulo}
              </Text>
              <View style={styles.pontosTag}>
                <Text style={styles.pontosTexto}>{item.tarefas.pontos} pts</Text>
              </View>
            </View>
            <Text style={styles.cardPrazo}>
              Prazo: {item.tarefas.timebox_fim}
            </Text>
            <View
              style={[
                styles.statusTag,
                { backgroundColor: corStatus(item.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusTexto,
                  { color: corStatus(item.status) },
                ]}
              >
                {labelStatus(item.status)}
              </Text>
            </View>
          </Pressable>
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
        <Text style={styles.titulo}>Minhas Tarefas</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      {/* Filtros */}
      <View style={styles.filtrosRow}>
        {FILTROS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filtroBtn, filtro === f.key && styles.filtroBtnAtivo]}
            onPress={() => setFiltro(f.key)}
          >
            <Text
              style={[
                styles.filtroTexto,
                filtro === f.key && styles.filtroTextoAtivo,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {renderConteudo()}
    </View>
  );
}

const BLUE = '#0EA5E9';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
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
  voltarTexto: { color: BLUE, fontSize: 15, fontWeight: '500' },
  titulo: { fontSize: 18, fontWeight: '700', color: '#111827' },
  filtrosRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtroBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
  },
  filtroBtnAtivo: { backgroundColor: BLUE },
  filtroTexto: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filtroTextoAtivo: { color: '#fff' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  erroTexto: { color: '#EF4444', fontSize: 15, textAlign: 'center', marginBottom: 12 },
  botaoRetentar: {
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  botaoRetentarTexto: { color: BLUE, fontSize: 14, fontWeight: '500' },
  vazio: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  lista: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
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
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  pontosTexto: { fontSize: 13, fontWeight: '700', color: BLUE },
  cardPrazo: { fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  statusTag: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' },
  statusTexto: { fontSize: 12, fontWeight: '700' },
});
