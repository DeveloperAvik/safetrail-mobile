import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Encrypted key-value storage (iOS Keychain / Android Keystore). Values are limited to ~2 KB,
 * so only small secrets and minimal emergency payloads are stored here.
 * On web (development only) it falls back to sessionStorage, which is NOT secure.
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key, OPTIONS);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return void globalThis.sessionStorage?.setItem(key, value);
    await SecureStore.setItemAsync(key, value, OPTIONS);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') return void globalThis.sessionStorage?.removeItem(key);
    await SecureStore.deleteItemAsync(key, OPTIONS);
  },
};

export const KEYS = {
  refreshToken: 'safetrail.refreshToken',
  sosIndex: 'safetrail.sosQueue.index',
  sosItem: (id: string) => `safetrail.sosQueue.${id}`,
} as const;
