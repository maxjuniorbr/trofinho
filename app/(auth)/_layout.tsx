import { Stack } from 'expo-router';
import { useTheme } from '@/context/theme-context';

export { ErrorBoundary } from '@/components/ui/route-error-fallback';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.canvas } }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="join-family" />
      <Stack.Screen name="join-child" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
