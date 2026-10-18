import { Redirect, Stack, useSegments } from 'expo-router';
import { useSettingsStore } from '@/store/settings-store';

export default function AuthLayout() {
  const seen = useSettingsStore((s) => s.onboardingSeen);
  const segments = useSegments();
  if (!seen && segments.at(-1) !== 'onboarding') return <Redirect href="/onboarding" />;
  return (
    <Stack>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Sign in', headerBackVisible: false }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
    </Stack>
  );
}
