import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Voltar',
        headerTintColor: '#4F46E5',
        headerTitleStyle: { color: '#1E1B4B' },
        headerStyle: { backgroundColor: '#F5F7FF' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Criar Conta' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Configurar Família' }} />
    </Stack>
  );
}
