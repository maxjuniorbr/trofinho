import { Stack } from 'expo-router';
import { useTheme } from '@/context/theme-context';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Voltar',
        headerTintColor: colors.accent.admin,
        headerTitleStyle: { color: colors.text.primary, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.bg.canvas },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Criar Conta' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Configurar Família' }} />
    </Stack>
  );
}
