import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Voltar',
        headerTintColor: '#4F46E5',
        headerTitleStyle: { color: '#1E1B4B', fontWeight: '600' },
        headerStyle: { backgroundColor: '#F5F3FF' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Painel Admin', headerShown: false }} />
      <Stack.Screen name="tarefas/index" options={{ title: 'Tarefas' }} />
      <Stack.Screen name="tarefas/nova" options={{ title: 'Nova Tarefa' }} />
      <Stack.Screen name="tarefas/[id]" options={{ title: 'Detalhes da Tarefa' }} />
      <Stack.Screen name="filhos/index" options={{ title: 'Filhos' }} />
      <Stack.Screen name="filhos/novo" options={{ title: 'Cadastrar Filho' }} />
      <Stack.Screen name="saldos/index" options={{ title: 'Saldos' }} />
      <Stack.Screen name="saldos/[filho_id]" options={{ title: 'Saldo do Filho' }} />
    </Stack>
  );
}
