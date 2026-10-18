import type { AuthTokensResponse, AuthUser } from '@safetrail/contracts';
import { create } from 'zustand';
import { api } from '@/services/api';
import { ApiError, setTokenProvider } from '@/services/api-client';
import { offlineQueue } from '@/services/offline-queue';
import { KEYS, secureStorage } from '@/services/secure-storage';

type Status = 'restoring' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  /** Access token lives in memory only; the refresh token lives in SecureStore. */
  accessToken: string | null;
  restore(): Promise<void>;
  signIn(tokens: AuthTokensResponse): Promise<void>;
  signOut(opts?: { wipeLocalData?: boolean }): Promise<void>;
}

let refreshing: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'restoring',
  user: null,
  accessToken: null,

  async restore() {
    // Uses the shared single-flight refresh: refresh tokens rotate on use, so two concurrent
    // restores (e.g. React StrictMode double effects) would otherwise look like token reuse
    // and make the server revoke the whole session.
    const token = await refreshAccessToken();
    if (!token && get().status === 'restoring') set({ status: 'signedOut' });
  },

  async signIn(tokens) {
    if (tokens.refreshToken) await secureStorage.set(KEYS.refreshToken, tokens.refreshToken);
    set({ status: 'signedIn', user: tokens.user, accessToken: tokens.accessToken });
  },

  async signOut(opts) {
    const refreshToken = await secureStorage.get(KEYS.refreshToken);
    try {
      await api.auth.logout(refreshToken);
    } catch {
      /* offline logout still clears local state */
    }
    await secureStorage.remove(KEYS.refreshToken);
    if (opts?.wipeLocalData) await offlineQueue.clear();
    set({ status: 'signedOut', user: null, accessToken: null });
  },
}));

/** Single-flight refresh shared by all concurrent requests (refresh tokens rotate on use). */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const token = await secureStorage.get(KEYS.refreshToken);
      if (!token) return null;
      try {
        const tokens = await api.auth.refresh(token);
        await useAuthStore.getState().signIn(tokens);
        return tokens.accessToken;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) await secureStorage.remove(KEYS.refreshToken);
        return null;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

setTokenProvider({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refresh: refreshAccessToken,
  onUnauthenticated: () => useAuthStore.setState({ status: 'signedOut', user: null, accessToken: null }),
});
