import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { Hash, ArrowRight, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sentry from '@sentry/react-native';
import { signInWithGoogle } from '@lib/auth';
import {
  CHILD_INVITE_CODE_LENGTH,
  formatChildInviteCode,
  validateChildInvite,
} from '@lib/child-invite';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthSeparator } from '@/components/auth/auth-separator';
import { BrandLogo } from '@/components/auth/brand-logo';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { useTheme } from '@/context/theme-context';
import { InlineMessage } from '@/components/ui/inline-message';

export default function LoginScreen() {
  const router = useRouter();
  const { palette } = useHeroPalette();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [familyCode, setFamilyCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFamilyCode('');
      setCodeError('');
      return () => { setError(''); };
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

  const handleFamilyCodeChange = (value: string) => {
    const formatted = formatChildInviteCode(value);
    setFamilyCode(formatted);
    if (codeError) setCodeError('');
  };

  const handleFamilyCodeSubmit = async () => {
    if (familyCode.length < CHILD_INVITE_CODE_LENGTH) {
      setCodeError('Informe um código de 6 caracteres.');
      return;
    }
    setCodeError('');
    setCodeLoading(true);

    try {
      const { preview, error } = await validateChildInvite(familyCode);
      if (error || !preview) {
        setCodeError(error ?? 'Erro ao verificar código. Tente novamente.');
        return;
      }

      router.push({
        pathname: '/(auth)/join-child',
        params: {
          code: familyCode,
        },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { area: 'login', step: 'child-invite-submit' },
      });
      setCodeError('Erro ao verificar código. Tente novamente.');
    } finally {
      setCodeLoading(false);
    }
  };

  const isCodeDisabled = loading || codeLoading;

  let codeInputBorderColor = palette.borderSoft;
  if (codeError) codeInputBorderColor = colors.semantic.error;
  else if (codeFocused) codeInputBorderColor = palette.borderFocus;

  return (
    <AuthHeroScreen>
      <View style={styles.header}>
        <BrandLogo size="md" withText />
        <Text style={styles.title} allowFontScaling={false}>
          Bem-vindo de volta.
        </Text>
      </View>

      <View style={styles.sections}>
        {error ? <InlineMessage message={error} variant="error" /> : null}

        {/* Section 1 — Responsável */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Responsável</Text>
          <GoogleSignInButton
            onPress={handleGoogleSignIn}
            loading={loading}
            variant="hero"
            subtitle="Criar ou acessar sua família"
          />
        </View>

        {/* Separator */}
        <AuthSeparator />

        {/* Section 2 — Filho ou membro */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Filho ou membro</Text>
          <Text style={[styles.sectionDesc, { color: palette.textOnNavyMuted }]}>
            Recebeu um código? Digite abaixo para entrar.
          </Text>
          <View
            style={[
              styles.codeInputRow,
              {
                backgroundColor: codeFocused ? palette.surfaceFieldFocus : palette.surfaceField,
                borderColor: codeInputBorderColor,
              },
            ]}
          >
            <Hash size={18} color={palette.textOnNavySubtle} strokeWidth={1.75} />
            <TextInput
              style={[styles.codeInput, { color: palette.textOnNavy }]}
              placeholder="ABC123"
              placeholderTextColor={palette.textOnNavyFaint}
              value={familyCode}
              onChangeText={handleFamilyCodeChange}
              onFocus={() => setCodeFocused(true)}
              onBlur={() => setCodeFocused(false)}
              onSubmitEditing={handleFamilyCodeSubmit}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              editable={!isCodeDisabled}
              selectionColor={palette.borderFocus}
              accessibilityLabel="Campo de código de família"
              returnKeyType="go"
            />
            <Pressable
              onPress={handleFamilyCodeSubmit}
              disabled={isCodeDisabled}
              style={({ pressed }) => {
                let opacity = 1;
                if (isCodeDisabled) opacity = 0.6;
                else if (pressed) opacity = 0.9;
                return [styles.codeSubmitButton, { opacity }];
              }}
              accessibilityRole="button"
              accessibilityLabel="Entrar com código"
              accessibilityState={{ busy: codeLoading }}
            >
              <LinearGradient
                colors={gradients.goldHorizontal.colors}
                start={gradients.goldHorizontal.start}
                end={gradients.goldHorizontal.end}
                style={styles.codeSubmitGradient}
              >
                <ArrowRight size={18} color="#030711" strokeWidth={2.5} />
              </LinearGradient>
            </Pressable>
          </View>
          {codeError ? (
            <View style={styles.codeErrorRow}>
              <AlertCircle size={14} color={colors.semantic.errorText} strokeWidth={2.25} />
              <Text style={[styles.codeError, { color: colors.semantic.errorText }]}>{codeError}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.termsLink}>
          <Text style={[styles.termsText, { color: palette.textOnNavySubtle }]}>
            Ao continuar, você concorda com nossos termos e política de privacidade.
          </Text>
        </View>
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
      letterSpacing: 0,
    },
    sections: {
      marginTop: spacing['8'],
      gap: spacing['5'],
    },
    section: {
      gap: spacing['3'],
    },
    eyebrow: {
      fontFamily: typography.family.extrabold,
      fontSize: typography.size.xxs,
      lineHeight: typography.lineHeight.xxs,
      color: palette.labelGold,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    sectionDesc: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    codeInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: radii.inner,
      paddingLeft: spacing['4'],
      paddingRight: spacing['2'],
      paddingVertical: spacing['2'],
      minHeight: 52,
      gap: spacing['3'],
    },
    codeInput: {
      flex: 1,
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      letterSpacing: 0,
      paddingVertical: spacing['2'],
    },
    codeSubmitButton: {
      borderRadius: radii.md,
      overflow: 'hidden',
      ...shadows.goldButtonGlow,
    },
    codeSubmitGradient: {
      height: 50,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeErrorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
    },
    codeError: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.xs,
    },
    termsLink: {
      paddingTop: spacing['2'],
      alignItems: 'center',
    },
    termsText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.xs,
      textAlign: 'center',
    },
  });
}
