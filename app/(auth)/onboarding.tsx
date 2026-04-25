import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { ArrowRight, Check, Home, ShieldCheck, User } from 'lucide-react-native';
import { createFamily, getCurrentAuthUser, refreshAuthSession, signOut } from '@lib/auth';
import { withAlpha } from '@/constants/colors';
import { radii, spacing, typography } from '@/constants/theme';
import { AuthHeroScreen } from '@/components/auth/auth-hero-screen';
import { AuthDarkField } from '@/components/auth/auth-dark-field';
import { BrandLogo } from '@/components/auth/brand-logo';
import { StepIndicator } from '@/components/auth/step-indicator';
import { useHeroPalette } from '@/components/auth/use-hero-palette';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';

type OnboardingField = 'familyName' | 'adminName';

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ name?: string; email?: string }>();
  const router = useRouter();
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState(params.name ?? '');
  const [userEmail, setUserEmail] = useState(params.email ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<OnboardingField | null>(null);
  const shouldShowError = Boolean(error);
  const submitLabel = loading ? 'Criando família…' : 'Criar família';

  // When arriving from register, params.name is always set (required field).
  // Absence means the nav guard redirected an orphan user after login.
  const isFromRegister = Boolean(params.name);

  // Orphan user arriving via login: fetch email from auth so the banner still
  // shows the saved-account reassurance even without register params.
  useEffect(() => {
    if (params.email) return; // already have it from register
    let mounted = true;
    getCurrentAuthUser().then((user) => {
      if (mounted && user?.email) setUserEmail(user.email);
    });
    return () => {
      mounted = false;
    };
  }, [params.email]);

  const validate = (): string | null => {
    if (!familyName.trim()) return 'Informe o nome da família.';
    if (!adminName.trim()) return 'Informe seu nome.';
    return null;
  };

  const handleCreateFamily = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    const { error: createError } = await createFamily(familyName.trim(), adminName.trim());

    if (createError) {
      setLoading(false);
      setError(createError);
      return;
    }

    // createFamily only writes to DB tables — it does not emit an auth event,
    // so onAuthStateChange will not fire automatically. Force a session refresh
    // so the root layout auth state handler re-fetches the profile (with the
    // new familia_id) and navigates to the admin home.
    const { error: refreshError } = await refreshAuthSession();
    if (refreshError) {
      setLoading(false);
      setError(refreshError);
    }
  };

  const confirmAndLeave = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleLeave = () => {
    const message = isFromRegister
      ? `Sua conta já foi criada e está salva. Você pode entrar a qualquer momento com ${userEmail || 'seu e-mail'} e criar a família depois.`
      : 'Você pode entrar novamente e criar a família quando quiser.';

    Alert.alert('Sair da criação da família?', message, [
      { text: 'Continuar criando', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: confirmAndLeave },
    ]);
  };

  return (
    <AuthHeroScreen topBarCenter={<BrandLogo size="sm" withText />}>
      {isFromRegister ? <StepIndicator currentStep={2} labels={['Conta', 'Família']} /> : null}

      <View style={styles.header}>
        {isFromRegister ? (
          <View style={styles.kickerChip} accessibilityRole="text">
            <Check size={12} color={palette.checkOnText} strokeWidth={3} />
            <Text style={styles.kickerChipText} allowFontScaling={false}>
              Conta criada
            </Text>
          </View>
        ) : (
          <Text style={styles.kickerPlain} allowFontScaling={false}>
            Configurar família
          </Text>
        )}

        <Text style={styles.title} allowFontScaling={false}>
          {isFromRegister ? 'Agora, sua família' : 'Criar sua família'}
        </Text>
        <Text style={styles.subtitle}>
          {isFromRegister
            ? 'Você será o administrador. Vamos configurar a base — você poderá convidar os filhos depois.'
            : 'Você será o administrador e poderá convidar os filhos depois.'}
        </Text>
      </View>

      {isFromRegister && params.email ? (
        <View
          style={styles.banner}
          accessibilityRole="text"
          accessibilityLabel="Sua conta está salva"
        >
          <View style={styles.bannerIconBox}>
            <ShieldCheck size={20} color={palette.checkOnText} strokeWidth={2.5} />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerLabel} allowFontScaling={false}>
              Sua conta está salva
            </Text>
            <Text style={styles.bannerEmail} numberOfLines={1}>
              {params.email}
            </Text>
          </View>
        </View>
      ) : null}

      {!isFromRegister && userEmail ? (
        <View style={styles.banner} accessibilityRole="text" accessibilityLabel="Conta vinculada">
          <View style={styles.bannerIconBox}>
            <ShieldCheck size={20} color={palette.checkOnText} strokeWidth={2.5} />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerLabel} allowFontScaling={false}>
              Conta vinculada
            </Text>
            <Text style={styles.bannerEmail} numberOfLines={1}>
              {userEmail}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.form}>
        <AuthDarkField
          label="Nome da família"
          focused={focusedField === 'familyName'}
          placeholder="Ex: Família Silva"
          value={familyName}
          onChangeText={(value) => {
            setFamilyName(value);
            setError('');
          }}
          onFocus={() => setFocusedField('familyName')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="words"
          maxLength={60}
          editable={!loading}
          accessibilityLabel="Campo de nome da família"
          leftIcon={Home}
        />

        <AuthDarkField
          label="Seu nome"
          focused={focusedField === 'adminName'}
          placeholder="Como quer ser chamado"
          value={adminName}
          onChangeText={(value) => {
            setAdminName(value);
            setError('');
          }}
          onFocus={() => setFocusedField('adminName')}
          onBlur={() => setFocusedField(null)}
          autoCapitalize="words"
          maxLength={60}
          editable={!loading}
          accessibilityLabel="Campo de nome do administrador"
          leftIcon={User}
        />

        <View style={styles.formActions}>
          <FormFooter message={shouldShowError ? error : null} includeSafeBottom={false}>
            <Button
              label="Criar família"
              loadingLabel="Criando família…"
              loading={loading}
              onPress={handleCreateFamily}
              size="lg"
              trailingIcon={ArrowRight}
              accessibilityLabel={submitLabel}
              accessibilityState={{ busy: loading }}
            />
          </FormFooter>
        </View>

        <View style={styles.footerPush}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.65 : 1 }]}
            onPress={handleLeave}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Criar família depois"
          >
            <Text style={styles.secondaryButtonText}>Criar família depois</Text>
          </Pressable>
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
    kickerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing['1.5'],
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['1'],
      borderRadius: radii.full,
      backgroundColor: withAlpha(palette.checkOn, 0.15),
      borderWidth: 1,
      borderColor: withAlpha(palette.checkOn, 0.3),
    },
    kickerChipText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: palette.checkOnText,
    },
    kickerPlain: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: palette.borderFocus,
    },
    title: {
      marginTop: spacing['2'],
      fontFamily: typography.family.black,
      fontSize: typography.size['3xl'],
      lineHeight: typography.lineHeight['3xl'],
      color: palette.textOnNavy,
      letterSpacing: -0.4,
    },
    subtitle: {
      marginTop: spacing['2'],
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
      color: palette.textOnNavyMuted,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      marginTop: spacing['5'],
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['3'],
      borderRadius: radii.lg,
      backgroundColor: withAlpha(palette.checkOn, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(palette.checkOn, 0.25),
    },
    bannerIconBox: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: withAlpha(palette.checkOn, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerContent: {
      flex: 1,
    },
    bannerLabel: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
      color: palette.checkOnText,
    },
    bannerEmail: {
      marginTop: 2,
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      color: palette.textOnNavy,
    },
    form: {
      marginTop: spacing['6'],
      flex: 1,
    },
    formActions: {
      marginTop: spacing['4'],
    },
    footerPush: {
      marginTop: 'auto',
    },
    secondaryButton: {
      paddingVertical: spacing['3'],
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      color: palette.textOnNavyMuted,
    },
  });
}
