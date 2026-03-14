import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  buscarPremio,
  atualizarPremio,
  desativarPremio,
  reativarPremio,
  type Premio,
} from '@lib/premios';

export default function AdminPremioDetalheScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [premio, setPremio] = useState<Premio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Campos de edição
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [custoStr, setCustoStr] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [alterandoAtivo, setAlterandoAtivo] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    const { data, error } = await buscarPremio(id);
    if (error) {
      setErro(error);
    } else if (data) {
      setPremio(data);
      setNome(data.nome);
      setDescricao(data.descricao ?? '');
      setCustoStr(String(data.custo_pontos));
    }
    setCarregando(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function handleSalvar() {
    setErroForm(null);
    setSucesso(null);

    if (!nome.trim()) return setErroForm('Informe o nome do prêmio.');
    const custo = Number.parseInt(custoStr, 10);
    if (Number.isNaN(custo) || custo <= 0)
      return setErroForm('Custo em pontos deve ser um número maior que zero.');

    setSalvando(true);
    const { error } = await atualizarPremio(id!, {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      custo_pontos: custo,
    });
    setSalvando(false);

    if (error) return setErroForm(error);
    setSucesso('Prêmio atualizado!');
    carregar();
  }

  async function handleToggleAtivo() {
    if (!premio) return;
    setAlterandoAtivo(true);
    setErroForm(null);
    setSucesso(null);

    const { error } = premio.ativo
      ? await desativarPremio(id!)
      : await reativarPremio(id!);

    setAlterandoAtivo(false);
    if (error) return setErroForm(error);
    carregar();
  }

  if (carregando) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (erro || !premio) {
    return (
      <View style={styles.loading}>
        <Text style={styles.erroTexto} accessibilityRole="alert">
          {erro ?? 'Prêmio não encontrado.'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.botaoSecundario, pressed && { opacity: 0.85 }]}
          onPress={carregar}
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Text style={styles.botaoSecundarioTexto}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar style="auto" />

        {!premio.ativo && (
          <View style={styles.avisoInativo}>
            <Text style={styles.avisoInativoTexto}>
              Este prêmio está inativo e não aparece para os filhos.
            </Text>
          </View>
        )}

        <View style={styles.campo}>
          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholderTextColor="#9CA3AF"
            returnKeyType="next"
            accessibilityLabel="Nome do prêmio"
          />
        </View>

        <View style={styles.campo}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.inputMultilinha]}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Detalhes opcionais…"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="Descrição do prêmio"
          />
        </View>

        <View style={styles.campo}>
          <Text style={styles.label}>Custo em pontos *</Text>
          <TextInput
            style={styles.input}
            value={custoStr}
            onChangeText={setCustoStr}
            keyboardType="numeric"
            returnKeyType="done"
            accessibilityLabel="Custo em pontos"
          />
        </View>

        {erroForm ? (
          <Text style={styles.erroTexto} accessibilityRole="alert">{erroForm}</Text>
        ) : null}

        {sucesso ? (
          <Text style={styles.sucessoTexto}>{sucesso}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.botao,
            salvando && styles.botaoDesabilitado,
            pressed && !salvando && { opacity: 0.85 },
          ]}
          onPress={handleSalvar}
          disabled={salvando}
          accessibilityRole="button"
          accessibilityLabel={salvando ? 'Salvando' : 'Salvar alterações'}
          accessibilityState={{ disabled: salvando, busy: salvando }}
        >
          <Text style={styles.botaoTexto}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.botaoSecundario,
            alterandoAtivo && styles.botaoDesabilitado,
            pressed && !alterandoAtivo && { opacity: 0.85 },
          ]}
          onPress={handleToggleAtivo}
          disabled={alterandoAtivo}
          accessibilityRole="button"
          accessibilityLabel={
            alterandoAtivo
              ? 'Aguarde'
              : premio.ativo
              ? 'Desativar prêmio'
              : 'Reativar prêmio'
          }
          accessibilityState={{ disabled: alterandoAtivo, busy: alterandoAtivo }}
        >
          <Text style={[styles.botaoSecundarioTexto, !premio.ativo && { color: '#10B981' }]}>
            {alterandoAtivo
              ? 'Aguarde…'
              : premio.ativo
              ? 'Desativar prêmio'
              : 'Reativar prêmio'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    gap: 16,
    padding: 24,
  },
  container: {
    padding: 24,
    gap: 20,
    backgroundColor: '#F5F3FF',
    flexGrow: 1,
  },
  avisoInativo: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderCurve: 'continuous',
    padding: 12,
  },
  avisoInativoTexto: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
  },
  campo: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputMultilinha: {
    minHeight: 80,
    paddingTop: 12,
  },
  erroTexto: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  sucessoTexto: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  botao: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botaoDesabilitado: {
    backgroundColor: '#A5B4FC',
  },
  botaoTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  botaoSecundario: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoSecundarioTexto: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 16,
  },
});
