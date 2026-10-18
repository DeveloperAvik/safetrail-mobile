import { z } from 'zod';
import { ApiError, request, setTokenProvider } from '@/services/api-client';

const json = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) });

describe('api client', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as never;
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    let token = 'old';
    const refresh = jest.fn(async () => (token = 'new'));
    const onUnauthenticated = jest.fn();
    setTokenProvider({ getAccessToken: () => token, refresh, onUnauthenticated });
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } })).mockResolvedValueOnce(json(200, { ok: true }));
    await expect(request('/x', { schema: z.object({ ok: z.boolean() }) })).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new');
  });

  it('ends the session when refresh fails', async () => {
    const onUnauthenticated = jest.fn();
    setTokenProvider({ getAccessToken: () => 't', refresh: async () => null, onUnauthenticated });
    fetchMock.mockResolvedValue(json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } }));
    await expect(request('/x')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthenticated).toHaveBeenCalled();
  });

  it('maps server error bodies and rejects responses that break the contract', async () => {
    setTokenProvider({ getAccessToken: () => 't', refresh: async () => 't', onUnauthenticated: () => undefined });
    fetchMock.mockResolvedValueOnce(json(409, { error: { code: 'CONFLICT', message: 'Trip already active' } }));
    await expect(request('/x')).rejects.toMatchObject({ code: 'CONFLICT', message: 'Trip already active' });
    fetchMock.mockResolvedValueOnce(json(200, { unexpected: 1 }));
    await expect(request('/x', { schema: z.object({ id: z.string() }) })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('classifies network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const err = (await request('/x').catch((e) => e)) as ApiError;
    expect(err.isNetwork).toBe(true);
  });
});
