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
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { cadastrarFilho } from '@lib/filhos';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';

export default function NovoFilhoScreen() {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleCadastrar() {
    setErro(null);
    const emailValue = email.trim().toLowerCase();

    if (!nome.trim()) return setErro('Informe o nome do filho.');
    if (!isValidEmail(emailValue)) return setErro('E-mail inválido.');
    if (senha.length < 6) return setErro('A senha temporária deve ter ao menos 6 caracteres.');
    if (senha !== confirmarSenha) return setErro('As senhas não coincidem.');

    setEnviando(true);
    const { error } = await cadastrarFilho(nome.trim(), emailValue, senha);
    setEnviando(false);

    if (error) {
      setErro(error);
      return;
    }

    setSucesso(true);
  }

  if (sucesso) {
    return (
      <View style={styles.sucessoContainer}>
        <StatusBar style="auto" />
        <Text style={styles.sucessoEmoji}>🎉</Text>
        <Text style={styles.sucessoTitulo}>Filho cadastrado!</Text>
        <Text style={styles.sucessoTexto}>
          Compartilhe as credenciais com {nome}:{'\n\n'}
          <Text style={styles.credencial}>E-mail: {email}</Text>
          {'\n'}
          <Text style={styles.credencial}>Senha: {senha}</Text>
        </Text>
        <Pressable
          style={styles.botaoConcluir}
          onPress={() => router.back()}
        >
          <Text style={styles.botaoConcluirTexto}>Concluir</Text>
        </Pressable>
      </View>
    );
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
        <Text style={styles.titulo}>Novo Filho</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoTexto}>
            O sistema criará uma conta para o filho com as credenciais informadas.
            Compartilhe o e-mail e a senha temporária para que ele possa entrar no app.
          </Text>
        </View>

        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          value={nome}
          onChangeText={setNome}
          placeholder="Nome do filho"
          maxLength={60}
          autoCapitalize="words"
        />

        <Text style={styles.label}>E-mail *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={MAX_EMAIL_LENGTH}
        />

        <Text style={styles.label}>Senha temporária *</Text>
        <TextInput
          style={styles.input}
          value={senha}
          onChangeText={setSenha}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          maxLength={40}
        />

        <Text style={styles.label}>Confirmar senha *</Text>
        <TextInput
          style={styles.input}
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
          placeholder="Repita a senha"
          secureTextEntry
          maxLength={40}
        />

        {erro && <Text style={styles.erroTexto}>{erro}</Text>}

        <Pressable
          style={[styles.botaoCadastrar, enviando && styles.botaoDesabilitado]}
          onPress={handleCadastrar}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoCadastrarTexto}>Cadastrar filho</Text>
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
  infoBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  infoTexto: { fontSize: 13, color: '#4338CA', lineHeight: 19 },
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
  erroTexto: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  botaoCadastrar: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoCadastrarTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Tela de sucesso
  sucessoContainer: {
    flex: 1,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sucessoEmoji: { fontSize: 64, marginBottom: 16 },
  sucessoTitulo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  sucessoTexto: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  credencial: { fontWeight: '700', color: '#4F46E5' },
  botaoConcluir: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  botaoConcluirTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
