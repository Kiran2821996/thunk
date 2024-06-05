import { Stack } from "expo-router";

export default function RootLayout() {

  return (
    <Stack initialRouteName="input">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="input" options={{ headerShown: false }} />
      <Stack.Screen name="results" options={{ headerShown: false, gestureEnabled: true  }} />
    </Stack>
  );
}
