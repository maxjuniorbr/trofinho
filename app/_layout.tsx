import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { supabase } from '@lib/supabase';
import { buscarPerfil, type UserProfile } from '@lib/auth';
import { ThemeProvider } from '@/context/theme-context';

// Mantém a splash screen visível até resolvermos a sessão
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [pronto, setPronto] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  const [fontsLoaded] = useFonts({
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // Carrega sessão inicial e escuta mudanças de auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const hasActiveSession = event !== 'SIGNED_OUT' && Boolean(session);

        if (!hasActiveSession) {
          setProfile(null);
          setPronto(true);
          return;
        }

        const p = await buscarPerfil();
        setProfile(p);
        setPronto(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Redireciona conforme estado de autenticação
  useEffect(() => {
    if (!pronto) return;

    const inAuth = segments[0] === '(auth)';
    const seg1 = segments[1 as keyof typeof segments] as string | undefined;

    if (profile === null) {
      if (inAuth) return;

      router.replace('/(auth)/login');
      return;
    }

    if (profile === undefined) return;

    const hasFamilia = Boolean(profile.familia_id);

    if (!hasFamilia) {
      if (seg1 !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      }
      return;
    }

    if (inAuth) {
      router.replace(profile.papel === 'admin' ? '/(admin)/' : '/(filho)/');
    }
  }, [pronto, profile, router, segments]);

  // Esconde splash screen quando pronto E fonts carregadas
  useEffect(() => {
    if (!pronto || !fontsLoaded) return;

    void SplashScreen.hideAsync();
  }, [pronto, fontsLoaded]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(filho)" />
      </Stack>
    </ThemeProvider>
  );
}
