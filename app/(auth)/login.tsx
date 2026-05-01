import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { ShieldCheck, KeyRound, ArrowRight } from 'lucide-react-native';
import { signInWithGoogle } from '@lib/auth';
import { spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { BrandLogo } from '@/components/auth/brand-logo';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { PathCard } from '@/components/auth/path-card';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { InlineMessage } from '@/components/ui/inline-message';
import { Button } from '@/components/ui/button';

export default function LoginScreen() {
  const router = useRouter();
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setError('');
      };
    }, []),
  );

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    const { profile, isNewUser, googleName, error: googleError } = await signInWithGoogle();

    if (googleError) {
      setLoading(false);
      setError(googleError);
      return;
    }

    if (!profile && !isNewUser) {
      setLoading(false);
      return;
    }

    if (isNewUser) {
      router.replace({
        pathname: '/(auth)/onboarding',
        params: googleName ? { googleName } : undefined,
      });
    }
  };

  return (
    <AuthHeroScreen>
      <View style={styles.header}>
        <BrandLogo size="md" />
        <Text style={styles.title} allowFontScaling={false}>
          Bem-vindo de volta.
        </Text>
      </View>

      <View style={styles.cards}>
        {error ? <InlineMessage message={error} variant="error" /> : null}

        {/* Path 1 — Responsável */}
        <PathCard
          icon={<ShieldCheck size={20} color={palette.borderFocus} strokeWidth={2} />}
          eyebrow="Responsável"
          title="Criar ou acessar como responsável"
          description="Use sua conta Google para criar uma nova família ou acessar a que você já administra."
          cta={
            <View style={styles.ctaWrapper}>
              <GoogleSignInButton
                onPress={handleGoogleSignIn}
                loading={loading}
                variant="hero"
              />
            </View>
          }
        />

        {/* Path 2 — Código de família */}
        <PathCard
          icon={<KeyRound size={20} color={palette.borderFocus} strokeWidth={2} />}
          eyebrow="Filho ou membro"
          title="Entrar com código de família"
          description="Recebeu um código de acesso? Use-o para entrar."
          cta={
            <View style={styles.ctaWrapper}>
              <Button
                label="Usar código de família"
                onPress={() => router.push('/(auth)/join-child')}
                disabled={loading}
                size="lg"
                trailingIcon={ArrowRight}
                accessibilityLabel="Usar código de família"
              />
            </View>
          }
        />

        <Pressable
          style={({ pressed }) => [styles.termsLink, { opacity: pressed ? 0.65 : 1 }]}
          accessibilityRole="link"
          accessibilityLabel="Termos e política de privacidade"
        >
          <Text style={styles.termsText}>
            Ao continuar, você concorda com nossos termos e política de privacidade.
          </Text>
        </Pressable>
      </View>
    </AuthHeroScreen>
  );
}

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
  return StyleSheet.create({
    header: {
      marginTop: spacing['6'],
    },
    title: {
      marginTop: spacing['5'],
      fontFamily: typography.family.black,
      fontSize: 32,
      lineHeight: 34,
      color: palette.textOnNavy,
      letterSpacing: -0.6,
    },
    cards: {
      marginTop: spacing['8'],
      gap: spacing['4'],
    },
    ctaWrapper: {
      marginTop: spacing['5'],
    },
    termsLink: {
      paddingTop: 5,
      alignItems: 'center',
    },
    termsText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.xs,
      color: palette.textOnNavySubtle,
      textAlign: 'center',
    },
  });
}
