import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useTheme } from '@/context/theme-context';
import { useImpersonation } from '@/context/impersonation-context';
import { ImpersonationBar } from '@/components/ui/impersonation-bar';
import {
  useTasksLiveSync,
  useBalanceLiveSync,
  useRedemptionsLiveSync,
  useMyChildId,
  useProfile,
} from '@/hooks/queries';

export { ErrorBoundary } from '@/components/ui/route-error-fallback';

export default function ChildLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { impersonating, stopImpersonation } = useImpersonation();

  const { data: profile } = useProfile();
  const { data: ownChildId } = useMyChildId(profile?.id);

  // When impersonating, use the childId from the impersonation context;
  // otherwise fall back to the authenticated user's own child ID.
  const childId = impersonating?.childId ?? ownChildId;

  useTasksLiveSync(profile?.familia_id);
  useBalanceLiveSync(childId);
  useRedemptionsLiveSync(profile?.familia_id);

  // Auto-stop impersonation when navigating to the (admin) group
  useEffect(() => {
    if (impersonating && segments[0] === '(admin)') {
      stopImpersonation();
    }
  }, [impersonating, segments, stopImpersonation]);

  const handleExit = useCallback(() => {
    stopImpersonation();
    router.replace('/(admin)/' as never);
  }, [stopImpersonation, router]);

  return (
    <View style={{ flex: 1 }}>
      {impersonating && (
        <ImpersonationBar childName={impersonating.childName} onExit={handleExit} />
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="tasks/index" options={{ animation: 'none' }} />
        <Stack.Screen name="tasks/[id]" />
        <Stack.Screen name="balance" />
        <Stack.Screen name="historico" />
        <Stack.Screen name="prizes/index" options={{ animation: 'none' }} />
        <Stack.Screen name="redemptions/index" options={{ animation: 'none' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="perfil" options={{ animation: 'none' }} />
      </Stack>
    </View>
  );
}
