import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { signIn } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function validar(): string | null {
    const emailValue = email.trim();

    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!senha) return 'Informe sua senha.';
    if (senha.length < 6) return 'A senha deve ter ao menos 6 caracteres.';
    return null;
  }

  async function handleEntrar() {
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    setCarregando(true);

    const { profile, error } = await signIn(email.trim(), senha);
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    if (!profile) {
      router.replace('/(auth)/onboarding');
      return;
    }

    if (profile.papel === 'admin') {
      router.replace('/(admin)/');
    } else {
      router.replace('/(filho)/');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StatusBar style="auto" />

        <View style={styles.header}>
          <Text style={styles.logo}>🏆</Text>
          <Text style={styles.titulo}>Trofinho</Text>
          <Text style={styles.subtitulo}>Aprenda, ganhe e guarde</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={(t) => { setEmail(t); setErro(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_EMAIL_LENGTH}
            editable={!carregando}
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••"
            placeholderTextColor="#9CA3AF"
            value={senha}
            onChangeText={(t) => { setSenha(t); setErro(''); }}
            secureTextEntry
            maxLength={128}
            editable={!carregando}
          />

          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <TouchableOpacity
            style={[styles.botao, carregando && styles.botaoDesabilitado]}
            onPress={handleEntrar}
            disabled={carregando}
          >
            <Text style={styles.botaoTexto}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoSecundario}
            onPress={() => router.push('/(auth)/register')}
            disabled={carregando}
          >
            <Text style={styles.botaoSecundarioTexto}>Criar conta</Text>
          </TouchableOpacity>
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
  logo: { fontSize: 56 },
  titulo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E1B4B',
    marginTop: 8,
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
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
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
  },
  botaoSecundarioTexto: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '500',
  },
});
