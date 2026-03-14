import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, useMemo } from 'react';
import { signUp } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mascotImage = require('../../assets/trofinho-mascot.png') as number;

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const shouldShowError = Boolean(erro);

  // ─── Entrance animations ──────────────────────────────────
  const mascotScale    = useRef(new Animated.Value(0.4)).current;
  const mascotRotate   = useRef(new Animated.Value(-12)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY       = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(mascotScale, {
        toValue: 1,
        delay: 100,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.spring(mascotRotate, {
        toValue: 0,
        delay: 100,
        friction: 6,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 500,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.spring(contentY, {
        toValue: 0,
        delay: 250,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mascotRotateDeg = mascotRotate.interpolate({
    inputRange: [-12, 0],
    outputRange: ['-12deg', '0deg'],
  });

  // ─── Form logic ───────────────────────────────────────────
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
    if (erroValidacao) { setErro(erroValidacao); return; }

    setErro('');
    setCarregando(true);
    const { error } = await signUp(email.trim(), senha);
    setCarregando(false);

    if (error) { setErro(error.message); return; }
    router.replace({ pathname: '/(auth)/onboarding', params: { nome: nome.trim() } });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
      behavior="padding"
    >
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style={colors.statusBar} />

        {/* Mascot */}
        <Animated.View
          style={{
            transform: [{ scale: mascotScale }, { rotate: mascotRotateDeg }],
            marginBottom: spacing['4'],
          }}
        >
          <Image
            source={mascotImage}
            style={styles.mascot}
            accessibilityLabel="Mascote do Trofinho"
            accessibilityRole="image"
          />
        </Animated.View>

        {/* Headline */}
        <Animated.View
          style={[styles.headline, { opacity: contentOpacity, transform: [{ translateY: contentY }] }]}
        >
          <Text style={[styles.titulo, { color: colors.text.primary }]}>Criar conta</Text>
          <Text style={[styles.subtitulo, { color: colors.text.secondary }]}>
            Junte-se ao Trofinho e comece a conquistar!
          </Text>
        </Animated.View>

        {/* Form card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.bg.surface,
              borderColor: colors.border.subtle,
              opacity: contentOpacity,
              transform: [{ translateY: contentY }],
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.text.secondary }]}>Nome</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            }]}
            placeholder="Seu nome"
            placeholderTextColor={colors.text.muted}
            value={nome}
            onChangeText={(t) => { setNome(t); setErro(''); }}
            autoCapitalize="words"
            editable={!carregando}
            accessibilityLabel="Campo de nome"
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>E-mail</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            }]}
            placeholder="seu@email.com"
            placeholderTextColor={colors.text.muted}
            value={email}
            onChangeText={(t) => { setEmail(t); setErro(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_EMAIL_LENGTH}
            editable={!carregando}
            accessibilityLabel="Campo de e-mail"
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Senha</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            }]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.text.muted}
            value={senha}
            onChangeText={(t) => { setSenha(t); setErro(''); }}
            secureTextEntry
            maxLength={128}
            editable={!carregando}
            accessibilityLabel="Campo de senha"
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Confirmar senha</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            }]}
            placeholder="Repita a senha"
            placeholderTextColor={colors.text.muted}
            value={confirmaSenha}
            onChangeText={(t) => { setConfirmaSenha(t); setErro(''); }}
            secureTextEntry
            maxLength={128}
            editable={!carregando}
            accessibilityLabel="Campo de confirmar senha"
          />

          {shouldShowError ? (
            <Text style={[styles.erro, { color: colors.semantic.error }]} accessibilityRole="alert">
              {erro}
            </Text>
          ) : null}

          {/* Primary CTA — gold gradient */}
          <Pressable
            onPress={handleCriarConta}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel={carregando ? 'Criando conta' : 'Criar conta'}
            accessibilityState={{ disabled: carregando, busy: carregando }}
            style={({ pressed }) => [
              styles.primaryBtn,
              shadows.goldButton,
              { opacity: carregando ? 0.55 : 1, transform: pressed ? [{ translateY: 2 }] : [] },
            ]}
          >
            <LinearGradient
              colors={gradients.gold.colors}
              start={gradients.gold.start}
              end={gradients.gold.end}
              style={styles.primaryBtnGradient}
            >
              <Text style={[styles.primaryBtnText, { color: colors.text.onBrand }]}>
                {carregando ? 'Criando conta…' : 'Criar conta'}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Back link */}
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.65 : 1 }]}
            onPress={() => router.back()}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao login"
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text.secondary }]}>
              Já tem conta?{' '}
              <Text style={{ color: colors.brand.vivid, fontFamily: typography.family.bold }}>
                Entrar
              </Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex:      { flex: 1 },
    container: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.screen,
      paddingVertical: spacing['10'],
    },
    mascot: {
      width: 100,
      height: 100,
      resizeMode: 'contain',
    },
    headline: {
      alignItems: 'center',
      marginBottom: spacing['6'],
    },
    titulo: {
      fontFamily: typography.family.black,
      fontSize: typography.size['3xl'],
      lineHeight: typography.size['3xl'] * 1.15,
      textAlign: 'center',
    },
    subtitulo: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      textAlign: 'center',
      marginTop: spacing['1'],
      lineHeight: typography.size.sm * 1.5,
    },
    card: {
      width: '100%',
      borderRadius: radii.outer,
      borderWidth: 1,
      padding: spacing.card,
    },
    label: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
      marginBottom: spacing['1'],
      marginTop: spacing['4'],
    },
    input: {
      borderWidth: 1,
      borderRadius: radii.inner,
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      fontFamily: typography.family.medium,
    },
    erro: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      marginTop: spacing['3'],
      textAlign: 'center',
    },
    primaryBtn: {
      borderRadius: radii.inner,
      overflow: 'hidden',
      marginTop: spacing['6'],
    },
    primaryBtnGradient: {
      paddingVertical: spacing['4'],
      alignItems: 'center',
      borderRadius: radii.inner,
    },
    primaryBtnText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.md,
    },
    secondaryBtn: {
      paddingVertical: spacing['4'],
      alignItems: 'center',
      marginTop: spacing['1'],
    },
    secondaryBtnText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
    },
  });
}
