import { Stack } from 'expo-router';
import { useTheme } from '@/context/theme-context';
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
  const { data: profile } = useProfile();
  const { data: childId } = useMyChildId(profile?.id);
  useTasksLiveSync(profile?.familia_id);
  useBalanceLiveSync(childId);
  useRedemptionsLiveSync(profile?.familia_id);
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.canvas } }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="tasks/index" options={{ animation: 'none' }} />
      <Stack.Screen name="tasks/[id]" />
      <Stack.Screen name="balance" />
      <Stack.Screen name="prizes/index" options={{ animation: 'none' }} />
      <Stack.Screen name="redemptions/index" options={{ animation: 'none' }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="perfil" options={{ animation: 'none' }} />
    </Stack>
  );
}
