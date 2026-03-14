import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@lib/supabase';
import { buscarPerfil, type UserProfile } from '@lib/auth';

// Mantém a splash screen visível até resolvermos a sessão
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [pronto, setPronto] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  // Carrega sessão inicial e escuta mudanças de auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // SIGNED_OUT: limpa perfil imediatamente, sem chamar buscarPerfil
        if (event === 'SIGNED_OUT' || !session) {
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

    if (!profile.familia_id) {
      if (seg1 === 'onboarding') return;

      router.replace('/(auth)/onboarding');
      return;
    }

    if (inAuth) {
      router.replace(profile.papel === 'admin' ? '/(admin)/' : '/(filho)/');
    }
  }, [pronto, profile, segments]);

  // Esconde splash screen quando pronto
  useEffect(() => {
    if (!pronto) return;

    SplashScreen.hideAsync();
  }, [pronto]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(filho)" />
    </Stack>
  );
}
