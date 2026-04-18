import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import * as Sentry from '@sentry/react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { supabase } from '@lib/supabase';
import { getProfile, type UserProfile } from '@lib/auth';
import { resolveNavDecision } from '@lib/nav-guard';
import { createAuthStateHandler } from '@lib/auth-state';
import {
  registerForPushNotifications,
  savePushToken,
  subscribeToNotificationNavigation,
  registerNotificationCategories,
} from '@lib/notifications';
import { handleNotificationAction } from '@lib/notification-actions';
import { ThemeProvider, useTheme } from '@/context/theme-context';
import { QueryProvider, queryClient } from '@/context/query-client';
import { OfflineBanner } from '@/components/ui/offline-banner';

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 1 : 0.2,
  profilesSampleRate: __DEV__ ? 1 : 0.1,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  enableLogs: __DEV__,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: !isRunningInExpoGo(),
  environment: __DEV__ ? 'development' : 'production',
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
    const handleProfileChange = (p: UserProfile | null) => {
      setProfile(p);
      if (p) {
        Sentry.setUser({ id: p.id });
        Sentry.setTag('papel', p.papel);
        Sentry.setTag('familia_id', p.familia_id);
      } else {
        Sentry.setUser(null);
      }
    };

    const authStateHandler = createAuthStateHandler({
      getProfile,
      onProfileChange: handleProfileChange,
      onReadyChange: setReady,
      onSignOut: () => queryClient.clear(),
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(authStateHandler.handleAuthStateChange);

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

  // Register for push notifications only after the user is authenticated.
  // This avoids requesting notification permission on the login screen.
  useEffect(() => {
    if (!profile?.id) return;

    let mounted = true;

    const registerPush = async () => {
      try {
        await registerNotificationCategories();
        const token = await registerForPushNotifications();
        if (mounted) {
          setPushToken(token);
        }
        if (!token) {
          Sentry.captureMessage('push-token: registration returned null', {
            level: 'warning',
            tags: { area: 'push-token' },
          });
        }
      } catch (error) {
        Sentry.captureException(error, { tags: { area: 'push-token', step: 'register' } });
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
        Sentry.captureException(error, { tags: { area: 'push-token', step: 'persist' } });
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
    const target = resolveNavDecision(ready, profile, segments as string[]);
    if (target) {
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: 'nav_redirect',
        level: 'info',
        data: { target, from: segments[0], role: profile?.papel },
      });
      router.replace(target as never);
    }
  }, [ready, profile, router, segments]);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    const setupNotificationNavigation = async () => {
      const cleanup = await subscribeToNotificationNavigation(
        (target) => {
          if (target.entityId) {
            router.push(`${target.route}/${target.entityId}` as never);
          } else {
            router.push(target.route);
          }
        },
        (action) => {
          handleNotificationAction(action.actionId, action.data);
        },
      );

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
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg.canvas,
        }}
      >
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: colors.bg.canvas },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(child)" />
      </Stack>
      <OfflineBanner />
    </View>
  );
}
