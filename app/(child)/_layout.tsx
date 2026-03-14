import { Stack } from 'expo-router';

export default function ChildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tasks/index" />
      <Stack.Screen name="tasks/[id]" />
      <Stack.Screen name="balance" />
      <Stack.Screen name="prizes/index" />
      <Stack.Screen name="redemptions/index" />
    </Stack>
  );
}
