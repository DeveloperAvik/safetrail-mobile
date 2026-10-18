import '../global.css';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { MonitoringProvider } from '@/features/safety/monitoring-provider';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const { colorScheme } = useColorScheme();

  React.useEffect(() => {
    void useAuthStore.getState().restore().finally(() => void SplashScreen.hideAsync());
  }, []);

  React.useEffect(() => {
    if (status === 'signedOut') queryClient.clear();
  }, [status]);

  if (status === 'restoring') return null; // splash screen stays visible while the session is restored

  const signedIn = status === 'signedIn';
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <MaybeMonitoring enabled={signedIn}>
          <Stack screenOptions={{ headerBackTitle: 'Back' }}>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="trips/new" options={{ title: 'New trip', presentation: 'modal' }} />
              <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
              <Stack.Screen name="safety/index" options={{ title: 'Monitoring' }} />
              <Stack.Screen name="safety/prompt" options={{ title: 'Safety check', presentation: 'fullScreenModal', gestureEnabled: false }} />
              <Stack.Screen name="emergency/sos" options={{ title: 'SOS', presentation: 'fullScreenModal' }} />
              <Stack.Screen name="emergency/index" options={{ title: 'Incidents' }} />
              <Stack.Screen name="emergency/[id]" options={{ title: 'Incident' }} />
              <Stack.Screen name="contacts/new" options={{ title: 'Add trusted contact', presentation: 'modal' }} />
              <Stack.Screen name="settings/consent" options={{ title: 'Consent & permissions' }} />
              <Stack.Screen name="settings/profile" options={{ title: 'Profile & emergency info' }} />
              <Stack.Screen name="settings/privacy" options={{ title: 'Privacy' }} />
              <Stack.Screen name="settings/connectivity" options={{ title: 'Connectivity' }} />
              <Stack.Screen name="settings/simulation" options={{ title: 'Demo scenarios' }} />
            </Stack.Protected>
          </Stack>
        </MaybeMonitoring>
        <PortalHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function MaybeMonitoring({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return enabled ? <MonitoringProvider>{children}</MonitoringProvider> : <>{children}</>;
}
