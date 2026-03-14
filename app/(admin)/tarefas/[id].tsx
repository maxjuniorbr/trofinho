import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  buscarTarefaComAtribuicoes,
  aprovarAtribuicao,
  rejeitarAtribuicao,
  labelStatus,
  corStatus,
  type TarefaDetalhe,
  type AtribuicaoComFilho,
} from '@lib/tarefas';

export default function TarefaDetalheAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [tarefa, setTarefa] = useState<TarefaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estado por atribuição: {[atribId]: 'rejeitando' | 'processando' | null}
  const [acoesAtrib, setAcoesAtrib] = useState<
    Record<string, 'rejeitando' | 'processando' | null>
  >({});
  const [notasRejeicao, setNotasRejeicao] = useState<Record<string, string>>(
    {}
  );
  const [errosAtrib, setErrosAtrib] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);

    try {
      const { data, error } = await buscarTarefaComAtribuicoes(id);
      if (error) setErro(error);
      else setTarefa(data);
    } catch {
      setErro('Não foi possível carregar a tarefa agora.');
      setTarefa(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function handleAprovar(atrib: AtribuicaoComFilho) {
    setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: 'processando' }));
    setErrosAtrib((prev) => ({ ...prev, [atrib.id]: '' }));

    const { error } = await aprovarAtribuicao(atrib.id);

    if (error) {
      setErrosAtrib((prev) => ({ ...prev, [atrib.id]: error }));
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
    } else {
      await carregar();
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
    }
  }

  async function handleRejeitar(atrib: AtribuicaoComFilho) {
    const nota = notasRejeicao[atrib.id] ?? '';
    if (!nota.trim()) {
      setErrosAtrib((prev) => ({
        ...prev,
        [atrib.id]: 'Informe o motivo da rejeição.',
      }));
      return;
    }

    setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: 'processando' }));
    setErrosAtrib((prev) => ({ ...prev, [atrib.id]: '' }));

    const { error } = await rejeitarAtribuicao(atrib.id, nota.trim());

    if (error) {
      setErrosAtrib((prev) => ({ ...prev, [atrib.id]: error }));
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
    } else {
      await carregar();
      setAcoesAtrib((prev) => ({ ...prev, [atrib.id]: null }));
      setNotasRejeicao((prev) => ({ ...prev, [atrib.id]: '' }));
    }
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (erro || !tarefa) {
    return (
      <View style={styles.loading}>
        <Text style={styles.erroTexto}>{erro ?? 'Tarefa não encontrada.'}</Text>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}>
          <Text style={styles.botaoVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltarTexto}>← Tarefas</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitulo} numberOfLines={1}>
          Detalhes
        </Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Dados da tarefa */}
        <View style={styles.card}>
          <View style={styles.cardTopo}>
            <Text style={styles.cardTitulo}>{tarefa.titulo}</Text>
            <View style={styles.pontosTag}>
              <Text style={styles.pontosTexto}>{tarefa.pontos} pts</Text>
            </View>
          </View>
          {tarefa.descricao ? (
            <Text style={styles.descricao}>{tarefa.descricao}</Text>
          ) : null}
          <Text style={styles.meta}>
            {tarefa.timebox_inicio} → {tarefa.timebox_fim}
          </Text>
          {tarefa.exige_evidencia && (
            <View style={styles.tagEvidencia}>
              <Text style={styles.tagEvidenciaTexto}>📷 Exige foto</Text>
            </View>
          )}
        </View>

        {/* Atribuições */}
        <Text style={styles.secaoTitulo}>
          Atribuições ({tarefa.atribuicoes.length})
        </Text>

        {tarefa.atribuicoes.length === 0 ? (
          <Text style={styles.semAtrib}>Nenhum filho atribuído.</Text>
        ) : (
          tarefa.atribuicoes.map((atrib) => {
            const acao = acoesAtrib[atrib.id] ?? null;
            const nota = notasRejeicao[atrib.id] ?? '';
            const erroAtrib = errosAtrib[atrib.id] ?? '';
            const processando = acao === 'processando';

            return (
              <View key={atrib.id} style={styles.atribCard}>
                <View style={styles.atribTopo}>
                  <Text style={styles.filhoNome}>{atrib.filhos.nome}</Text>
                  <View
                    style={[
                      styles.statusTag,
                      { backgroundColor: corStatus(atrib.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusTexto,
                        { color: corStatus(atrib.status) },
                      ]}
                    >
                      {labelStatus(atrib.status)}
                    </Text>
                  </View>
                </View>

                {atrib.evidencia_url ? (
                  <Image
                    source={{ uri: atrib.evidencia_url }}
                    style={styles.evidenciaImg}
                    resizeMode="cover"
                  />
                ) : null}

                {atrib.nota_rejeicao ? (
                  <View style={styles.notaRejeicaoBox}>
                    <Text style={styles.notaRejeicaoLabel}>
                      Motivo da rejeição:
                    </Text>
                    <Text style={styles.notaRejeicaoTexto}>
                      {atrib.nota_rejeicao}
                    </Text>
                  </View>
                ) : null}

                {atrib.status === 'aguardando_validacao' && (
                  <View style={styles.acoesBox}>
                    {acao === 'rejeitando' ? (
                      <>
                        <TextInput
                          style={styles.inputNota}
                          value={nota}
                          onChangeText={(t) =>
                            setNotasRejeicao((prev) => ({
                              ...prev,
                              [atrib.id]: t,
                            }))
                          }
                          placeholder="Motivo da rejeição (obrigatório)"
                          multiline
                        />
                        <View style={styles.botoesRejeitar}>
                          <TouchableOpacity
                            style={[styles.botaoAcao, styles.botaoCancelar]}
                            onPress={() =>
                              setAcoesAtrib((prev) => ({
                                ...prev,
                                [atrib.id]: null,
                              }))
                            }
                            disabled={processando}
                          >
                            <Text style={styles.botaoCancelarTexto}>
                              Cancelar
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.botaoAcao,
                              styles.botaoRejeitar,
                              processando && styles.botaoDesabilitado,
                            ]}
                            onPress={() => handleRejeitar(atrib)}
                            disabled={processando}
                          >
                            {processando ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={styles.botaoRejeitarTexto}>
                                Confirmar rejeição
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <View style={styles.botoesValidar}>
                        <TouchableOpacity
                          style={[
                            styles.botaoAcao,
                            styles.botaoRejeitar,
                            processando && styles.botaoDesabilitado,
                          ]}
                          onPress={() =>
                            setAcoesAtrib((prev) => ({
                              ...prev,
                              [atrib.id]: 'rejeitando',
                            }))
                          }
                          disabled={processando}
                        >
                          <Text style={styles.botaoRejeitarTexto}>
                            Rejeitar
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.botaoAcao,
                            styles.botaoAprovar,
                            processando && styles.botaoDesabilitado,
                          ]}
                          onPress={() => handleAprovar(atrib)}
                          disabled={processando}
                        >
                          {processando ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.botaoAprovarTexto}>
                              Aprovar ✓
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                    {erroAtrib ? (
                      <Text style={styles.erroAtrib}>{erroAtrib}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const PURPLE = '#4F46E5';
const RED = '#EF4444';
const GREEN = '#10B981';

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    padding: 24,
  },
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
  voltarTexto: { color: PURPLE, fontSize: 15, fontWeight: '500' },
  headerTitulo: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },
  erroTexto: { color: RED, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  botaoVoltar: { borderWidth: 1, borderColor: PURPLE, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  botaoVoltarTexto: { color: PURPLE, fontWeight: '500' },
  scrollContent: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitulo: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  pontosTag: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pontosTexto: { fontSize: 14, fontWeight: '700', color: PURPLE },
  descricao: { fontSize: 14, color: '#6B7280', marginBottom: 8, lineHeight: 20 },
  meta: { fontSize: 12, color: '#9CA3AF' },
  tagEvidencia: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  tagEvidenciaTexto: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  secaoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  semAtrib: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  atribCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  atribTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filhoNome: { fontSize: 15, fontWeight: '600', color: '#111827' },
  statusTag: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusTexto: { fontSize: 12, fontWeight: '700' },
  evidenciaImg: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  notaRejeicaoBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  notaRejeicaoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 2,
  },
  notaRejeicaoTexto: { fontSize: 13, color: '#7F1D1D' },
  acoesBox: { marginTop: 4 },
  inputNota: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FEF2F2',
    marginBottom: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  botoesValidar: { flexDirection: 'row', gap: 8 },
  botoesRejeitar: { flexDirection: 'row', gap: 8 },
  botaoAcao: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botaoAprovar: { backgroundColor: GREEN },
  botaoAprovarTexto: { color: '#fff', fontSize: 14, fontWeight: '700' },
  botaoRejeitar: { backgroundColor: RED },
  botaoRejeitarTexto: { color: '#fff', fontSize: 14, fontWeight: '700' },
  botaoCancelar: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  botaoCancelarTexto: { color: '#374151', fontSize: 14, fontWeight: '600' },
  botaoDesabilitado: { opacity: 0.6 },
  erroAtrib: {
    color: RED,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});
