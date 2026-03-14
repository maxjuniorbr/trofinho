import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tasks/index" />
      <Stack.Screen name="tasks/new" />
      <Stack.Screen name="tasks/[id]" />
      <Stack.Screen name="children/index" />
      <Stack.Screen name="children/new" />
      <Stack.Screen name="balances/index" />
      <Stack.Screen name="balances/[filho_id]" />
      <Stack.Screen name="prizes/index" />
      <Stack.Screen name="prizes/new" />
      <Stack.Screen name="prizes/[id]" />
      <Stack.Screen name="redemptions/index" />
    </Stack>
  );
}
