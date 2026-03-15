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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, useMemo } from 'react';
import { createFamily, signOut } from '@lib/auth';
import { localizeSupabaseError } from '@lib/api-error';
import { useTheme } from '@/context/theme-context';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mascotImage = require('../../assets/trofinho-mascot.png') as number;

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ nome?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.nome ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const shouldShowError = Boolean(error);
  const isBusy = loading || loggingOut;
  const submitLabel = loading ? 'Criando família…' : 'Criar família';
  const backLabel = loggingOut ? 'Saindo…' : 'Voltar para o login';

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
    if (!familyName.trim()) return 'Informe o nome da família.';
    if (!adminName.trim()) return 'Informe seu nome.';
    return null;
  }

  async function handleCreateFamily() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    const { error: createError } = await createFamily(familyName.trim(), adminName.trim());
    setLoading(false);

    if (createError) { setError(localizeSupabaseError(createError.message)); return; }
    router.replace('/(admin)/');
  }

  async function handleBack() {
    setLoggingOut(true);
    await signOut();
    router.replace('/(auth)/login');
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

        <Animated.View
          style={[styles.headline, { opacity: contentOpacity, transform: [{ translateY: contentY }] }]}
        >
          <Text style={[styles.titulo, { color: colors.text.primary }]}>Criar sua família</Text>
          <Text style={[styles.subtitulo, { color: colors.text.secondary }]}>
            Você será o administrador e poderá convidar os filhos depois.
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
          <Text style={[styles.label, { color: colors.text.secondary }]}>Nome da família</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.bg.elevated,
              borderColor: focusedField === 'familyName' ? colors.border.focus : colors.border.default,
              color: colors.text.primary,
            }]}
            placeholder="Ex: Família Silva"
            placeholderTextColor={colors.text.muted}
            value={familyName}
            onChangeText={(t) => { setFamilyName(t); setError(''); }}
            onFocus={() => setFocusedField('familyName')}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="words"
            editable={!isBusy}
            accessibilityLabel="Campo de nome da família"
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Seu nome</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.bg.elevated,
              borderColor: focusedField === 'adminName' ? colors.border.focus : colors.border.default,
              color: colors.text.primary,
            }]}
            placeholder="Como quer ser chamado"
            placeholderTextColor={colors.text.muted}
            value={adminName}
            onChangeText={(t) => { setAdminName(t); setError(''); }}
            onFocus={() => setFocusedField('adminName')}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="words"
            editable={!isBusy}
            accessibilityLabel="Campo de nome do administrador"
          />

          {shouldShowError ? (
            <Text style={[styles.erro, { color: colors.semantic.error }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleCreateFamily}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: isBusy, busy: loading }}
            style={({ pressed }) => [
              styles.primaryBtn,
              shadows.goldButton,
              { opacity: isBusy ? 0.55 : 1, transform: pressed ? [{ translateY: 2 }] : [] },
            ]}
          >
            <LinearGradient
              colors={gradients.gold.colors}
              start={gradients.gold.start}
              end={gradients.gold.end}
              style={styles.primaryBtnGradient}
            >
              <Text style={[styles.primaryBtnText, { color: colors.text.onBrand }]}>
                {submitLabel}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { opacity: isBusy ? 0.55 : pressed ? 0.65 : 1 }]}
            onPress={handleBack}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao login"
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text.secondary }]}>
              {backLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles() {
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
      lineHeight: typography.lineHeight['3xl'],
      textAlign: 'center',
    },
    subtitulo: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      textAlign: 'center',
      marginTop: spacing['1'],
      lineHeight: typography.lineHeight.sm,
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
