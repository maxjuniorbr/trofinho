import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { supabase } from '@lib/supabase';
import { getProfile, type UserProfile } from '@lib/auth';
import { createAuthStateHandler } from '@lib/auth-state';
import {
  registerForPushNotifications,
  savePushToken,
  subscribeToNotificationNavigation,
} from '@lib/notifications';
import { ThemeProvider, useTheme } from '@/context/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  const [fontsLoaded] = useFonts({
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    const authStateHandler = createAuthStateHandler({
      getProfile,
      onProfileChange: setProfile,
      onReadyChange: setReady,
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      authStateHandler.handleAuthStateChange,
    );

    return () => {
      authStateHandler.dispose();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready || !fontsLoaded) return;
    SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  return (
    <ThemeProvider>
      <RootNavigator ready={ready} fontsLoaded={fontsLoaded} profile={profile} />
    </ThemeProvider>
  );
}

function RootNavigator({
  ready,
  fontsLoaded,
  profile,
}: Readonly<{
  ready: boolean;
  fontsLoaded: boolean;
  profile: UserProfile | null | undefined;
}>) {
  const router = useRouter();
  const segments = useSegments();
  const { colors } = useTheme();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const lastSavedPushTokenKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function registerPush() {
      try {
        const token = await registerForPushNotifications();
        if (mounted) {
          setPushToken(token);
        }
      } catch {
        if (mounted) {
          setPushToken(null);
        }
      }
    }

    registerPush();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile?.id || !pushToken) return;

    const currentPushToken = pushToken;
    const saveKey = `${profile.id}:${currentPushToken}`;
    if (lastSavedPushTokenKeyRef.current === saveKey) return;

    let mounted = true;

    async function persistPushToken() {
      try {
        await savePushToken(currentPushToken);
        if (mounted) {
          lastSavedPushTokenKeyRef.current = saveKey;
        }
      } catch {
        if (mounted) {
          lastSavedPushTokenKeyRef.current = null;
        }
      }
    }

    persistPushToken();

    return () => {
      mounted = false;
    };
  }, [profile?.id, pushToken]);

  useEffect(() => {
    if (!ready) return;

    const inAuth = segments[0] === '(auth)';
    const seg1 = segments[1 as keyof typeof segments] as string | undefined;

    if (profile === null) {
      if (inAuth) return;
      router.replace('/(auth)/login');
      return;
    }

    if (profile === undefined) return;

    const hasFamily = Boolean(profile.familia_id);

    if (!hasFamily) {
      if (seg1 !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      }
      return;
    }

    if (inAuth) {
      router.replace(profile.papel === 'admin' ? '/(admin)/' : '/(child)/');
    }
  }, [ready, profile, router, segments]);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    async function setupNotificationNavigation() {
      const cleanup = await subscribeToNotificationNavigation((route) => {
        router.push(route);
      });

      if (active) {
        unsubscribe = cleanup;
      } else {
        cleanup();
      }
    }

    setupNotificationNavigation();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.canvas }}>
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(child)" />
    </Stack>
  );
}
