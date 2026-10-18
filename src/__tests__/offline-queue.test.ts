import type { SyncEvent } from '@safetrail/contracts';
import { backoffMs, OfflineQueue, type KeyValueStore } from '@/services/offline-queue';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v), remove: async (k) => void data.delete(k) };
}

const sos = (key: string): SyncEvent => ({ type: 'sos', idempotencyKey: key, clientCreatedAt: new Date().toISOString(), payload: { location: { lat: 1, lng: 2, accuracyM: 10 }, network: 'offline' } });
const batch = (key: string): SyncEvent => ({ type: 'location_batch', idempotencyKey: key, clientCreatedAt: new Date().toISOString(), payload: { tripId: 'a'.repeat(24), samples: [] as never } });

describe('OfflineQueue', () => {
  let general: ReturnType<typeof memoryStore>;
  let secure: ReturnType<typeof memoryStore>;
  let now = 1_000_000;
  let queue: OfflineQueue;
  beforeEach(() => {
    general = memoryStore();
    secure = memoryStore();
    now = 1_000_000;
    queue = new OfflineQueue(general, secure, () => now);
  });

  it('stores SOS in secure storage and other events in general storage', async () => {
    await queue.enqueue(sos('sos-key-0000000001'));
    await queue.enqueue(batch('batch-key-00000001'));
    expect([...secure.data.keys()].some((k) => k.includes('sos-key-0000000001'))).toBe(true);
    expect(general.data.get('safetrail.queue.v1')).toContain('batch-key-00000001');
    expect(general.data.get('safetrail.queue.v1')).not.toContain('sos-key');
    expect(await queue.counts()).toEqual({ pending: 2, failed: 0, pendingSos: 1 });
  });

  it('ignores duplicate enqueue of the same idempotency key', async () => {
    await queue.enqueue(sos('sos-key-0000000001'));
    await queue.enqueue(sos('sos-key-0000000001'));
    await queue.enqueue(batch('batch-key-00000001'));
    await queue.enqueue(batch('batch-key-00000001'));
    expect((await queue.list()).length).toBe(2);
  });

  it('sends SOS first and marks processed/duplicate as synced, rejected as failed', async () => {
    await queue.enqueue(batch('batch-key-00000001'));
    await queue.enqueue(sos('sos-key-0000000001'));
    await queue.enqueue(batch('batch-key-00000002'));
    const send = jest.fn(async (events: SyncEvent[]) => ({
      results: events.map((e, i) => ({ idempotencyKey: e.idempotencyKey, status: (['processed', 'duplicate', 'rejected'] as const)[i]!, retryable: false, message: null, resourceId: null })),
    }));
    const r = await queue.flush(send);
    expect(send.mock.calls[0]![0][0]!.type).toBe('sos');
    expect(r).toMatchObject({ sent: 3, synced: 2, failed: 1 });
    expect(await queue.counts()).toEqual({ pending: 0, failed: 1, pendingSos: 0 });
  });

  it('keeps items pending with backoff after a network error, then retries when due', async () => {
    await queue.enqueue(sos('sos-key-0000000001'));
    const failing = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    const r1 = await queue.flush(failing);
    expect(r1).toMatchObject({ networkError: true, retrying: 1 });
    // Not due yet → nothing sent.
    const ok = jest.fn(async (events: SyncEvent[]) => ({ results: events.map((e) => ({ idempotencyKey: e.idempotencyKey, status: 'processed' as const, retryable: false, message: null, resourceId: 'x' })) }));
    expect((await queue.flush(ok)).sent).toBe(0);
    now += 10 * 60_000;
    expect((await queue.flush(ok)).synced).toBe(1);
    const [item] = await queue.list();
    expect(item!.attempts).toBe(2);
    expect(item!.status).toBe('synced');
  });

  it('shares one flush between concurrent callers (no double send)', async () => {
    await queue.enqueue(batch('batch-key-00000001'));
    let calls = 0;
    const send = async (events: SyncEvent[]) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return { results: events.map((e) => ({ idempotencyKey: e.idempotencyKey, status: 'processed' as const, retryable: false, message: null, resourceId: null })) };
    };
    await Promise.all([queue.flush(send), queue.flush(send), queue.flush(send)]);
    expect(calls).toBe(1);
  });

  it('survives corrupted storage and can be cleared', async () => {
    general.data.set('safetrail.queue.v1', '{not json');
    expect(await queue.list()).toEqual([]);
    await queue.enqueue(sos('sos-key-0000000001'));
    await queue.clear();
    expect(await queue.list()).toEqual([]);
    expect(secure.data.size).toBe(0);
  });

  it('prunes old synced items', async () => {
    await queue.enqueue(batch('batch-key-00000001'));
    await queue.flush(async (events) => ({ results: events.map((e) => ({ idempotencyKey: e.idempotencyKey, status: 'processed' as const, retryable: false, message: null, resourceId: null })) }));
    now += 2 * 86_400_000;
    await queue.prune();
    expect(await queue.list()).toEqual([]);
  });

  it('uses bounded exponential backoff with jitter', () => {
    expect(backoffMs(1, () => 0.999)).toBeLessThan(2000);
    expect(backoffMs(3, () => 0.999)).toBeLessThan(8000);
    expect(backoffMs(30, () => 0.999)).toBeLessThanOrEqual(5 * 60_000);
    expect(backoffMs(1, () => 0)).toBe(500);
  });
});
