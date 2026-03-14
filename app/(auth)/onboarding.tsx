import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { criarFamilia, signOut } from '@lib/auth';

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ nome?: string }>();

  const [nomeFamilia, setNomeFamilia] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState(params.nome ?? '');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [voltando, setVoltando] = useState(false);

  function validar(): string | null {
    if (!nomeFamilia.trim()) return 'Informe o nome da família.';
    if (!nomeAdmin.trim()) return 'Informe seu nome.';
    return null;
  }

  async function handleCriarFamilia() {
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    setCarregando(true);

    const { error } = await criarFamilia(nomeFamilia.trim(), nomeAdmin.trim());
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    router.replace('/(admin)/');
  }

  async function handleVoltar() {
    setVoltando(true);
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StatusBar style="auto" />

        <View style={styles.header}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.titulo}>Criar sua família</Text>
          <Text style={styles.subtitulo}>
            Você será o administrador e poderá convidar os filhos depois.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nome da família</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Família Silva"
            placeholderTextColor="#9CA3AF"
            value={nomeFamilia}
            onChangeText={(t) => { setNomeFamilia(t); setErro(''); }}
            autoCapitalize="words"
            editable={!carregando}
            accessibilityLabel="Campo de nome da família"
          />

          <Text style={styles.label}>Seu nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Como quer ser chamado"
            placeholderTextColor="#9CA3AF"
            value={nomeAdmin}
            onChangeText={(t) => { setNomeAdmin(t); setErro(''); }}
            autoCapitalize="words"
            editable={!carregando}
            accessibilityLabel="Campo de nome do administrador"
          />

          {erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.botao,
              carregando && styles.botaoDesabilitado,
              pressed && !carregando && { opacity: 0.85 },
            ]}
            onPress={handleCriarFamilia}
            disabled={carregando || voltando}
            accessibilityRole="button"
            accessibilityLabel={carregando ? 'Criando família' : 'Criar família'}
            accessibilityState={{ disabled: carregando || voltando, busy: carregando }}
          >
            <Text style={styles.botaoTexto}>
              {carregando ? 'Criando família…' : 'Criar família'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.botaoVoltar,
              voltando && styles.botaoDesabilitado,
              pressed && !voltando && { opacity: 0.7 },
            ]}
            onPress={handleVoltar}
            disabled={carregando || voltando}
            accessibilityRole="button"
            accessibilityLabel={voltando ? 'Saindo' : 'Voltar para o login'}
            accessibilityState={{ disabled: carregando || voltando, busy: voltando }}
          >
            <Text style={styles.botaoVoltarTexto}>
              {voltando ? 'Saindo…' : 'Voltar para o login'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F7FF' },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: { fontSize: 56 },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 12,
  },
  subtitulo: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: { width: '100%' },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  erro: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  botao: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    minHeight: 44,
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  botaoVoltar: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  botaoVoltarTexto: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});
