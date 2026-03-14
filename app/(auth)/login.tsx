import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, useMemo } from 'react';
import { signIn } from '@lib/auth';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mascotImage = require('../../assets/trofinho-mascot.png') as number;

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const shouldShowError = Boolean(error);

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

  function validate(): string | null {
    const emailValue = email.trim();
    if (!emailValue) return 'Informe seu e-mail.';
    if (!isValidEmail(emailValue)) return 'E-mail inválido.';
    if (!password) return 'Informe sua senha.';
    if (password.length < 6) return 'A senha deve ter ao menos 6 caracteres.';
    return null;
  }

  async function handleSignIn() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    const { profile, error: signInError } = await signIn(email.trim(), password);
    setLoading(false);

    if (signInError) { setError(signInError.message); return; }
    if (!profile) { router.replace('/(auth)/onboarding'); return; }

    const destination = profile.papel === 'admin' ? '/(admin)/' : '/(child)/';
    router.replace(destination);
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

        <Animated.View
          style={{
            transform: [{ scale: mascotScale }, { rotate: mascotRotateDeg }],
            marginBottom: spacing['6'],
          }}
        >
          <Image
            source={mascotImage}
            style={styles.mascot}
            accessibilityLabel="Mascote do Trofinho"
            accessibilityRole="image"
          />
        </Animated.View>

        <Animated.View
          style={[styles.headline, { opacity: contentOpacity, transform: [{ translateY: contentY }] }]}
        >
          <Text style={[styles.titulo, { color: colors.text.primary }]}>Trofinho</Text>
          <Text style={[styles.subtitulo, { color: colors.text.secondary }]}>
            Conquiste tarefas, acumule pontos, resgate prêmios!
          </Text>
        </Animated.View>

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
            onChangeText={(t) => { setEmail(t); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_EMAIL_LENGTH}
            editable={!loading}
            accessibilityLabel="Campo de e-mail"
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Senha</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            }]}
            placeholder="••••••"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            secureTextEntry
            maxLength={128}
            editable={!loading}
            accessibilityLabel="Campo de senha"
          />

          {shouldShowError ? (
            <Text style={[styles.erro, { color: colors.semantic.error }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Entrando' : 'Entrar'}
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => [
              styles.primaryBtn,
              shadows.goldButton,
              { opacity: loading ? 0.55 : 1, transform: pressed ? [{ translateY: 2 }] : [] },
            ]}
          >
            <LinearGradient
              colors={gradients.gold.colors}
              start={gradients.gold.start}
              end={gradients.gold.end}
              style={styles.primaryBtnGradient}
            >
              <Text style={[styles.primaryBtnText, { color: colors.text.onBrand }]}>
                {loading ? 'Entrando…' : 'Entrar'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.65 : 1 }]}
            onPress={() => router.push('/(auth)/register')}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Criar conta"
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text.secondary }]}>
              Não tem conta?{' '}
              <Text style={{ color: colors.brand.vivid, fontFamily: typography.family.bold }}>
                Criar conta
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
      width: 140,
      height: 140,
      resizeMode: 'contain',
    },
    headline: {
      alignItems: 'center',
      marginBottom: spacing['8'],
    },
    titulo: {
      fontFamily: typography.family.black,
      fontSize: typography.size['4xl'],
      lineHeight: typography.lineHeight['4xl'],
      textAlign: 'center',
    },
    subtitulo: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.md,
      textAlign: 'center',
      marginTop: spacing['2'],
      lineHeight: typography.lineHeight.md,
    },
    card: {
      width: '100%',
      borderRadius: radii.outer,
      borderWidth: 1,
      padding: spacing['6'],
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
      minHeight: 48,
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
      minHeight: 56,
    },
    primaryBtnGradient: {
      paddingVertical: spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.inner,
      flex: 1,
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
