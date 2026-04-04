import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import * as Sentry from '@sentry/react-native';
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
import { syncAutomaticAppreciation } from '@lib/balances';
import { createAuthStateHandler } from '@lib/auth-state';
import {
  registerForPushNotifications,
  savePushToken,
  subscribeToNotificationNavigation,
} from '@lib/notifications';
import { ThemeProvider, useTheme } from '@/context/theme-context';
import { QueryProvider, queryClient } from '@/context/query-client';

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 1 : 0.2,
  profilesSampleRate: __DEV__ ? 1 : 0.1,
  replaysOnErrorSampleRate: 1,
  replaysSessionSampleRate: __DEV__ ? 1 : 0.1,
  enableLogs: true,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: !isRunningInExpoGo(),
  environment: __DEV__ ? 'development' : 'production',
  debug: __DEV__,
});

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const ref = useNavigationContainerRef();
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
    if (ref) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

  useEffect(() => {
    const authStateHandler = createAuthStateHandler({
      getProfile,
      onProfileChange: setProfile,
      onReadyChange: setReady,
      onSignOut: () => queryClient.clear(),
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
    <QueryProvider>
      <ThemeProvider>
        <RootNavigator ready={ready} fontsLoaded={fontsLoaded} profile={profile} />
      </ThemeProvider>
    </QueryProvider>
  );
}

export { ErrorBoundary } from '@/components/ui/route-error-fallback';
export default Sentry.wrap(RootLayout);

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
  // Fire-and-forget sync of automatic appreciation on startup
  useEffect(() => {
    if (!profile?.familia_id) return;
    syncAutomaticAppreciation().catch(console.error);
  }, [profile?.familia_id]);

  // Register for push notifications only after the user is authenticated.
  // This avoids requesting notification permission on the login screen.
  useEffect(() => {
    if (!profile?.id) return;

    let mounted = true;

    const registerPush = async () => {
      try {
        const token = await registerForPushNotifications();
        if (mounted) {
          setPushToken(token);
        }
        if (!token) {
          console.warn('[push-token] registerForPushNotifications returned null — token not obtained');
        }
      } catch (error) {
        console.warn('[push-token] Exception during push registration:', error);
        if (mounted) {
          setPushToken(null);
        }
      }
    };

    registerPush();

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !pushToken) return;

    const currentPushToken = pushToken;
    const saveKey = `${profile.id}:${currentPushToken}`;
    if (lastSavedPushTokenKeyRef.current === saveKey) return;

    let mounted = true;

    const persistPushToken = async () => {
      try {
        await savePushToken(currentPushToken);
        if (mounted) {
          lastSavedPushTokenKeyRef.current = saveKey;
        }
      } catch (error) {
        console.warn('[push-token] Failed to persist token:', error);
        if (mounted) {
          lastSavedPushTokenKeyRef.current = null;
        }
      }
    };

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

    // Also redirect when still on the blank index route (initial load).
    const inApp = segments[0] === '(admin)' || segments[0] === '(child)';
    if (!inAuth && !inApp) {
      router.replace(profile.papel === 'admin' ? '/(admin)/' : '/(child)/');
    }
  }, [ready, profile, router, segments]);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    const setupNotificationNavigation = async () => {
      const cleanup = await subscribeToNotificationNavigation((route) => {
        router.push(route);
      });

      if (active) {
        unsubscribe = cleanup;
      } else {
        cleanup();
      }
    };

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
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.bg.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(child)" />
    </Stack>
  );
}
