import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  buscarAtribuicaoFilho,
  concluirAtribuicao,
  labelStatus,
  corStatus,
  type AtribuicaoFilho,
} from '@lib/tarefas';

export default function FilhoTarefaDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [atribuicao, setAtribuicao] = useState<AtribuicaoFilho | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [erroConclusao, setErroConclusao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    const { data, error } = await buscarAtribuicaoFilho(id);
    if (error) setErro(error);
    else setAtribuicao(data);
    setCarregando(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function handleConcluir() {
    if (!atribuicao) return;
    setErroConclusao(null);

    if (atribuicao.tarefas.exige_evidencia) {
      // Solicita permissão da câmera
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setErroConclusao(
          'Permissão da câmera negada. Habilite nas configurações do dispositivo.'
        );
        return;
      }

      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (resultado.canceled || resultado.assets.length === 0) return;

      const imagemUri = resultado.assets[0].uri;
      setConcluindo(true);
      const { error } = await concluirAtribuicao(atribuicao.id, imagemUri);
      setConcluindo(false);

      if (error) {
        setErroConclusao(error);
      } else {
        await carregar();
      }
    } else {
      setConcluindo(true);
      const { error } = await concluirAtribuicao(atribuicao.id, null);
      setConcluindo(false);

      if (error) {
        setErroConclusao(error);
      } else {
        await carregar();
      }
    }
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (erro || !atribuicao) {
    return (
      <View style={styles.loading}>
        <Text style={styles.erroTexto}>{erro ?? 'Tarefa não encontrada.'}</Text>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}>
          <Text style={styles.botaoVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tarefa = atribuicao.tarefas;
  const podeConcluir = atribuicao.status === 'pendente';

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltarTexto}>← Tarefas</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Detalhe</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: corStatus(atribuicao.status) },
          ]}
        >
          <Text style={styles.statusBadgeTexto}>
            {labelStatus(atribuicao.status)}
          </Text>
        </View>

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
              <Text style={styles.tagEvidenciaTexto}>📷 Enviar foto como prova</Text>
            </View>
          )}
        </View>

        {/* Evidência enviada */}
        {atribuicao.evidencia_url ? (
          <View style={styles.evidenciaBox}>
            <Text style={styles.evidenciaLabel}>Foto enviada:</Text>
            <Image
              source={{ uri: atribuicao.evidencia_url }}
              style={styles.evidenciaImg}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Nota de rejeição */}
        {atribuicao.nota_rejeicao ? (
          <View style={styles.notaRejeicaoBox}>
            <Text style={styles.notaRejeicaoLabel}>Motivo da rejeição:</Text>
            <Text style={styles.notaRejeicaoTexto}>
              {atribuicao.nota_rejeicao}
            </Text>
            <Text style={styles.notaRejeicaoHint}>
              Converse com o responsável para alinhar os próximos passos.
            </Text>
          </View>
        ) : null}

        {/* Ação de conclusão */}
        {podeConcluir && (
          <>
            {erroConclusao ? (
              <Text style={styles.erroTexto}>{erroConclusao}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.botaoConcluir, concluindo && styles.botaoDesabilitado]}
              onPress={handleConcluir}
              disabled={concluindo}
            >
              {concluindo ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botaoConcluirTexto}>
                  {tarefa.exige_evidencia
                    ? '📷 Tirar foto e concluir'
                    : '✓ Concluir tarefa'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {atribuicao.status === 'aguardando_validacao' && (
          <View style={styles.aguardandoBox}>
            <Text style={styles.aguardandoTexto}>
              ⏳ Aguardando validação do responsável
            </Text>
          </View>
        )}

        {atribuicao.status === 'aprovada' && (
          <View style={styles.aprovadoBox}>
            <Text style={styles.aprovadoTexto}>
              🏆 Parabéns! {tarefa.pontos} pontos creditados no seu saldo.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const BLUE = '#0EA5E9';

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    padding: 24,
  },
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
  voltarTexto: { color: BLUE, fontSize: 15, fontWeight: '500' },
  headerTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  erroTexto: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  botaoVoltar: {
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  botaoVoltarTexto: { color: BLUE, fontWeight: '500' },
  scrollContent: { padding: 16, paddingBottom: 48 },
  statusBadge: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginBottom: 16,
  },
  statusBadgeTexto: { color: '#fff', fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pontosTexto: { fontSize: 14, fontWeight: '700', color: BLUE },
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
  evidenciaBox: { marginBottom: 16 },
  evidenciaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  evidenciaImg: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  notaRejeicaoBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  notaRejeicaoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 4,
  },
  notaRejeicaoTexto: { fontSize: 14, color: '#7F1D1D', marginBottom: 8 },
  notaRejeicaoHint: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  botaoConcluir: {
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoConcluirTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  aguardandoBox: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  aguardandoTexto: { fontSize: 14, color: '#1E40AF', fontWeight: '600' },
  aprovadoBox: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  aprovadoTexto: { fontSize: 14, color: '#065F46', fontWeight: '600', textAlign: 'center' },
});
