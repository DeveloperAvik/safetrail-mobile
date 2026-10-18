jest.mock('@/services/api', () => ({
  api: { auth: { refresh: jest.fn(), logout: jest.fn(async () => undefined) } },
}));

import { api } from '@/services/api';
import { KEYS, secureStorage } from '@/services/secure-storage';
import { useAuthStore } from '@/store/auth-store';

const tokens = (n: number) => ({
  user: { id: 'a'.repeat(24), email: 'x@example.com', displayName: 'X', role: 'tourist' as const, createdAt: '2026-10-18T00:00:00.000Z' },
  accessToken: `access-${n}`,
  accessTokenExpiresAt: '2026-10-18T01:00:00.000Z',
  refreshToken: `refresh-token-rotated-${n}-xxxxxxxxxxxxxxxxxxxx`,
  refreshTokenExpiresAt: '2026-11-18T00:00:00.000Z',
});

describe('auth store session restore', () => {
  it('concurrent restores rotate the refresh token only once (no false reuse detection)', async () => {
    await secureStorage.set(KEYS.refreshToken, 'refresh-token-original-xxxxxxxxxxxxxxxxxxxx');
    const refresh = api.auth.refresh as jest.Mock;
    refresh.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return tokens(refresh.mock.calls.length);
    });
    await Promise.all([useAuthStore.getState().restore(), useAuthStore.getState().restore()]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(await secureStorage.get(KEYS.refreshToken)).toBe(tokens(1).refreshToken);
  });

  it('keeps the refresh token when offline at start-up and drops it on 401', async () => {
    const { ApiError } = jest.requireActual('@/services/api-client');
    const refresh = api.auth.refresh as jest.Mock;
    useAuthStore.setState({ status: 'restoring' });
    await secureStorage.set(KEYS.refreshToken, 'refresh-token-keep-xxxxxxxxxxxxxxxxxxxxxxxx');
    refresh.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    await useAuthStore.getState().restore();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await secureStorage.get(KEYS.refreshToken)).not.toBeNull();
    useAuthStore.setState({ status: 'restoring' });
    refresh.mockRejectedValueOnce(new ApiError(401, 'UNAUTHENTICATED', 'revoked'));
    await useAuthStore.getState().restore();
    expect(await secureStorage.get(KEYS.refreshToken)).toBeNull();
  });
});
