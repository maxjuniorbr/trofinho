import { Stack } from 'expo-router';
import { useTheme } from '@/context/theme-context';
import { useTasksLiveSync } from '@/hooks/queries';

export { ErrorBoundary } from '@/components/ui/route-error-fallback';

export default function ChildLayout() {
  const { colors } = useTheme();
  useTasksLiveSync();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tasks/index" />
      <Stack.Screen name="tasks/[id]" />
      <Stack.Screen name="balance" />
      <Stack.Screen name="prizes/index" />
      <Stack.Screen name="redemptions/index" />
    </Stack>
  );
}
