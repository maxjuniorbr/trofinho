import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { signUp } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function validar(): string | null {
    const emailValue = email.trim();

    if (!nome.trim()) return 'Informe seu nome.';
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!senha) return 'Crie uma senha.';
    if (senha.length < 6) return 'A senha deve ter ao menos 6 caracteres.';
    if (senha !== confirmaSenha) return 'As senhas não coincidem.';
    return null;
  }

  async function handleCriarConta() {
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    setCarregando(true);

    const { error } = await signUp(email.trim(), senha);
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    router.replace({
      pathname: '/(auth)/onboarding',
      params: { nome: nome.trim() },
    });
  }

  function limparErro() {
    setErro('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StatusBar style="auto" />

        <View style={styles.header}>
          <Text style={styles.titulo}>Criar conta</Text>
          <Text style={styles.subtitulo}>Junte-se ao Trofinho 🏆</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Seu nome"
            placeholderTextColor="#9CA3AF"
            value={nome}
            onChangeText={(t) => { setNome(t); limparErro(); }}
            autoCapitalize="words"
            editable={!carregando}
            accessibilityLabel="Campo de nome"
          />

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={(t) => { setEmail(t); limparErro(); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_EMAIL_LENGTH}
            editable={!carregando}
            accessibilityLabel="Campo de e-mail"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#9CA3AF"
            value={senha}
            onChangeText={(t) => { setSenha(t); limparErro(); }}
            secureTextEntry
            maxLength={128}
            editable={!carregando}
            accessibilityLabel="Campo de senha"
          />

          <Text style={styles.label}>Confirmar senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Repita a senha"
            placeholderTextColor="#9CA3AF"
            value={confirmaSenha}
            onChangeText={(t) => { setConfirmaSenha(t); limparErro(); }}
            secureTextEntry
            maxLength={128}
            editable={!carregando}
            accessibilityLabel="Campo de confirmar senha"
          />

          {erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.botao,
              carregando && styles.botaoDesabilitado,
              pressed && !carregando && { opacity: 0.85 },
            ]}
            onPress={handleCriarConta}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel={carregando ? 'Criando conta' : 'Criar conta'}
            accessibilityState={{ disabled: carregando, busy: carregando }}
          >
            <Text style={styles.botaoTexto}>
              {carregando ? 'Criando conta…' : 'Criar conta'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.botaoSecundario,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.back()}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao login"
            accessibilityState={{ disabled: carregando }}
          >
            <Text style={styles.botaoSecundarioTexto}>← Voltar ao login</Text>
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
    marginBottom: 32,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  subtitulo: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
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
  botaoSecundario: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  botaoSecundarioTexto: {
    color: '#6B7280',
    fontSize: 15,
  },
});
