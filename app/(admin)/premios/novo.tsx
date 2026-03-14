import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { criarPremio } from '@lib/premios';

export default function NovoPremioScreen() {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [custoStr, setCustoStr] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleCriar() {
    setErro(null);

    if (!nome.trim()) return setErro('Informe o nome do prêmio.');

    const custo = Number.parseInt(custoStr, 10);
    if (Number.isNaN(custo) || custo <= 0)
      return setErro('Custo em pontos deve ser um número maior que zero.');

    setEnviando(true);
    const { error } = await criarPremio({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      custo_pontos: custo,
    });
    setEnviando(false);

    if (error) return setErro(error);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar style="auto" />

        <View style={styles.campo}>
          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Sorvete, Filme no cinema…"
            placeholderTextColor="#9CA3AF"
            autoFocus
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
            placeholder="Ex: 50"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            returnKeyType="done"
            accessibilityLabel="Custo em pontos"
          />
        </View>

        {erro ? (
          <Text style={styles.erro} accessibilityRole="alert">{erro}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.botao,
            enviando && styles.botaoDesabilitado,
            pressed && !enviando && { opacity: 0.85 },
          ]}
          onPress={handleCriar}
          disabled={enviando}
          accessibilityRole="button"
          accessibilityLabel={enviando ? 'Salvando' : 'Criar prêmio'}
          accessibilityState={{ disabled: enviando, busy: enviando }}
        >
          <Text style={styles.botaoTexto}>
            {enviando ? 'Salvando…' : 'Criar prêmio'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 20,
    backgroundColor: '#F5F3FF',
    flexGrow: 1,
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
  erro: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
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
});
