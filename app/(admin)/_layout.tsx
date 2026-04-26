import { Stack } from 'expo-router';
import { useTheme } from '@/context/theme-context';
import { useTasksLiveSync, useRedemptionsLiveSync, useProfile } from '@/hooks/queries';

export { ErrorBoundary } from '@/components/ui/route-error-fallback';

export default function AdminLayout() {
  const { colors } = useTheme();
  const { data: profile } = useProfile();
  useTasksLiveSync(profile?.familia_id);
  useRedemptionsLiveSync(profile?.familia_id);
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.canvas } }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="tasks/index" options={{ animation: 'none' }} />
      <Stack.Screen name="tasks/[id]" />
      <Stack.Screen name="children/index" options={{ animation: 'none' }} />
      <Stack.Screen name="balances/index" />
      <Stack.Screen name="balances/[filho_id]/index" />
      <Stack.Screen name="balances/[filho_id]/historico" />
      <Stack.Screen name="prizes/index" options={{ animation: 'none' }} />
      <Stack.Screen name="redemptions/index" options={{ animation: 'none' }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="perfil" options={{ animation: 'none' }} />
    </Stack>
  );
}
