import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  criarTarefa,
  listarFilhosDaFamilia,
  type Filho,
} from '@lib/tarefas';

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

export default function NovaTarefaScreen() {
  const router = useRouter();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontos, setPontos] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [exigeEvidencia, setExigeEvidencia] = useState(false);
  const [filhos, setFilhos] = useState<Filho[]>([]);
  const [filhosSelecionados, setFilhosSelecionados] = useState<Set<string>>(
    new Set()
  );
  const [carregandoFilhos, setCarregandoFilhos] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarFilhos() {
      const { data } = await listarFilhosDaFamilia();
      setFilhos(data);
      setCarregandoFilhos(false);
    }
    carregarFilhos();
  }, []);

  function toggleFilho(id: string) {
    setFilhosSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCriar() {
    setErro(null);

    if (!titulo.trim()) return setErro('Informe o título da tarefa.');
    const pontosNum = Number.parseInt(pontos, 10);
    if (Number.isNaN(pontosNum) || pontosNum <= 0)
      return setErro('Pontos deve ser um número maior que zero.');
    if (!REGEX_DATA.test(inicio)) return setErro('Data início inválida. Use AAAA-MM-DD.');
    if (!REGEX_DATA.test(fim)) return setErro('Data fim inválida. Use AAAA-MM-DD.');
    if (fim < inicio) return setErro('Data fim deve ser igual ou posterior ao início.');
    if (filhosSelecionados.size === 0)
      return setErro('Selecione ao menos um filho para atribuir a tarefa.');

    setEnviando(true);
    const { error } = await criarTarefa({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      pontos: pontosNum,
      timebox_inicio: inicio,
      timebox_fim: fim,
      exige_evidencia: exigeEvidencia,
      filhoIds: Array.from(filhosSelecionados),
    });
    setEnviando(false);

    if (error) return setErro(error);
    router.back();
  }

  function renderListaFilhos() {
    if (carregandoFilhos) {
      return <ActivityIndicator color="#4F46E5" style={{ marginVertical: 12 }} />;
    }

    if (filhos.length === 0) {
      return (
        <Text style={styles.semFilhos}>
          Nenhum filho cadastrado. Cadastre um filho na tela de filhos antes
          de criar tarefas.
        </Text>
      );
    }

    return filhos.map((f) => {
      const selecionado = filhosSelecionados.has(f.id);
      return (
        <Pressable
          key={f.id}
          style={[styles.filhoItem, selecionado && styles.filhoSelecionado]}
          onPress={() => toggleFilho(f.id)}
        >
          <Text
            style={[
              styles.filhoNome,
              selecionado && styles.filhoNomeSelecionado,
            ]}
          >
            {f.nome}
          </Text>
          <Text style={styles.filhoCheck}>{selecionado ? '✓' : '○'}</Text>
        </Pressable>
      );
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.voltar}>← Voltar</Text>
        </Pressable>
        <Text style={styles.titulo}>Nova Tarefa</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Título *</Text>
        <TextInput
          style={styles.input}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ex: Lavar a louça"
          maxLength={100}
        />

        <Text style={styles.label}>Descrição (opcional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Detalhes da tarefa..."
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        <Text style={styles.label}>Pontos *</Text>
        <TextInput
          style={styles.input}
          value={pontos}
          onChangeText={setPontos}
          placeholder="Ex: 10"
          keyboardType="numeric"
          maxLength={4}
        />

        <View style={styles.linha}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Data início *</Text>
            <TextInput
              style={styles.input}
              value={inicio}
              onChangeText={setInicio}
              placeholder="AAAA-MM-DD"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Data fim *</Text>
            <TextInput
              style={styles.input}
              value={fim}
              onChangeText={setFim}
              placeholder="AAAA-MM-DD"
              maxLength={10}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Exige foto como evidência</Text>
          <Switch
            value={exigeEvidencia}
            onValueChange={setExigeEvidencia}
            trackColor={{ true: '#4F46E5' }}
          />
        </View>

        <Text style={[styles.label, { marginTop: 8 }]}>
          Atribuir a *
        </Text>
        {renderListaFilhos()}

        {erro && <Text style={styles.erroTexto}>{erro}</Text>}

        <Pressable
          style={[styles.botaoCriar, enviando && styles.botaoDesabilitado]}
          onPress={handleCriar}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoCriarTexto}>Criar tarefa</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  scroll: { flex: 1, backgroundColor: '#F5F3FF' },
  scrollContent: { padding: 20, paddingBottom: 48 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  linha: { flexDirection: 'row', marginTop: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  semFilhos: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 8,
  },
  filhoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  filhoSelecionado: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  filhoNome: { fontSize: 15, color: '#374151' },
  filhoNomeSelecionado: { color: '#4F46E5', fontWeight: '600' },
  filhoCheck: { fontSize: 18, color: '#4F46E5' },
  erroTexto: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  botaoCriar: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoCriarTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
