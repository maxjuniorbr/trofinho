import { Stack } from 'expo-router';
import { useTheme } from '@/context/theme-context';
import { useTasksLiveSync, useProfile } from '@/hooks/queries';

export { ErrorBoundary } from '@/components/ui/route-error-fallback';

export default function AdminLayout() {
  const { colors } = useTheme();
  const { data: profile } = useProfile();
  useTasksLiveSync(profile?.familia_id);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tasks/index" />
      <Stack.Screen name="tasks/new" />
      <Stack.Screen name="tasks/[id]" />
      <Stack.Screen name="tasks/[id]/edit" />
      <Stack.Screen name="children/index" />
      <Stack.Screen name="children/new" />
      <Stack.Screen name="children/[id]" />
      <Stack.Screen name="balances/index" />
      <Stack.Screen name="balances/[filho_id]" />
      <Stack.Screen name="prizes/index" />
      <Stack.Screen name="prizes/new" />
      <Stack.Screen name="prizes/[id]" />
      <Stack.Screen name="redemptions/index" />
      <Stack.Screen name="perfil" />
    </Stack>
  );
}
