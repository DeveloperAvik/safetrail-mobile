import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Backend base URL. Set EXPO_PUBLIC_API_URL for physical devices (e.g. http://192.168.1.20:4000),
 * because "localhost" on a phone is the phone itself. Android emulators reach the host at 10.0.2.2.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:4000';
  if (Platform.OS === 'android' && fromConfig.includes('localhost')) return fromConfig.replace('localhost', '10.0.2.2');
  return fromConfig.replace(/\/$/, '');
}

export const config = {
  apiUrl: resolveApiUrl(),
  requestTimeoutMs: 10_000,
  /** SOS gets a shorter timeout so we fall back to the offline queue quickly. */
  sosTimeoutMs: 6_000,
};
