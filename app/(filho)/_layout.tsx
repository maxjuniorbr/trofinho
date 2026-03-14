import { Stack } from 'expo-router';

export default function FilhoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Voltar',
        headerTintColor: '#0EA5E9',
        headerTitleStyle: { color: '#1E1B4B', fontWeight: '600' },
        headerStyle: { backgroundColor: '#F0F9FF' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Meu Painel', headerShown: false }} />
      <Stack.Screen name="tarefas/index" options={{ title: 'Minhas Tarefas' }} />
      <Stack.Screen name="tarefas/[id]" options={{ title: 'Detalhes da Tarefa' }} />
      <Stack.Screen name="saldo" options={{ title: 'Meu Saldo' }} />
    </Stack>
  );
}
