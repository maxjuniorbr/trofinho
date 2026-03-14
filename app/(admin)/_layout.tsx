import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tarefas/index" />
      <Stack.Screen name="tarefas/nova" />
      <Stack.Screen name="tarefas/[id]" />
      <Stack.Screen name="filhos/index" />
      <Stack.Screen name="filhos/novo" />
      <Stack.Screen name="saldos/index" />
      <Stack.Screen name="saldos/[filho_id]" />
      <Stack.Screen name="premios/index" />
      <Stack.Screen name="premios/novo" />
      <Stack.Screen name="premios/[id]" />
      <Stack.Screen name="resgates/index" />
    </Stack>
  );
}
