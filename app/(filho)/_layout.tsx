import { Stack } from 'expo-router';

export default function FilhoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tarefas/index" />
      <Stack.Screen name="tarefas/[id]" />
      <Stack.Screen name="saldo" />
      <Stack.Screen name="premios/index" />
      <Stack.Screen name="resgates/index" />
    </Stack>
  );
}
