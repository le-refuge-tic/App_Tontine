import { Stack } from "expo-router";

export default function ProjetsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="nouveau" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]-deposer" />
      <Stack.Screen name="[id]-modifier" />
    </Stack>
  );
}
