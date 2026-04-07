import { Stack } from 'expo-router';
import { useTheme } from '@/context/theme-context';
import { useTasksLiveSync, useBalanceLiveSync, useMyChildId, useProfile } from '@/hooks/queries';

export { ErrorBoundary } from '@/components/ui/route-error-fallback';

export default function ChildLayout() {
  const { colors } = useTheme();
  const { data: profile } = useProfile();
  const { data: childId } = useMyChildId(profile?.id);
  useTasksLiveSync(profile?.familia_id);
  useBalanceLiveSync(childId);
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.canvas } }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="tasks/index" />
      <Stack.Screen name="tasks/[id]" />
      <Stack.Screen name="balance" />
      <Stack.Screen name="prizes/index" />
      <Stack.Screen name="redemptions/index" />
      <Stack.Screen name="perfil" />
    </Stack>
  );
}
