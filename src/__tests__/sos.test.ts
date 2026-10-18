import { describeDelivery, triggerSos } from '@/features/sos/sos';
import { ApiError } from '@/services/api-client';

const response = (status: 'sent' | 'no_contacts' | 'failed') => ({
  duplicate: false,
  notificationStatus: status,
  incident: { id: 'i1', delivery: { total: 1, queued: 0, sent: 0, delivered: status === 'sent' ? 1 : 0, failed: status === 'failed' ? 1 : 0 } },
});

function deps(sosImpl: () => Promise<unknown>) {
  const enqueue = jest.fn(async () => undefined);
  return { enqueue, deps: { api: { emergency: { sos: jest.fn(sosImpl) } } as never, queue: { enqueue } as never, id: () => 'fixed-idempotency-key-1' } };
}

describe('triggerSos', () => {
  it('sends online and reports the server result', async () => {
    const d = deps(async () => response('sent'));
    const r = await triggerSos({ location: null, network: 'good' }, d.deps);
    expect(r.kind).toBe('sent');
    expect(d.enqueue).not.toHaveBeenCalled();
  });

  it('queues with the SAME idempotency key when the network fails', async () => {
    const d = deps(async () => {
      throw new ApiError(0, 'TIMEOUT', 'timeout');
    });
    const r = await triggerSos({ location: { lat: 1, lng: 2, accuracyM: 5 }, network: 'weak' }, d.deps);
    expect(r).toEqual({ kind: 'queued', idempotencyKey: 'fixed-idempotency-key-1', reason: 'Server unreachable' });
    expect(d.enqueue).toHaveBeenCalledWith(expect.objectContaining({ type: 'sos', idempotencyKey: 'fixed-idempotency-key-1' }));
  });

  it('queues directly when offline without trying the network', async () => {
    const d = deps(async () => response('sent'));
    const r = await triggerSos({ location: null, network: 'offline' }, d.deps);
    expect(r.kind).toBe('queued');
    expect((d.deps.api as unknown as { emergency: { sos: jest.Mock } }).emergency.sos).not.toHaveBeenCalled();
  });

  it('queues on server errors but surfaces validation errors', async () => {
    const server = deps(async () => {
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'down');
    });
    expect((await triggerSos({ location: null, network: 'good' }, server.deps)).kind).toBe('queued');
    const invalid = deps(async () => {
      throw new ApiError(400, 'VALIDATION_ERROR', 'bad');
    });
    await expect(triggerSos({ location: null, network: 'good' }, invalid.deps)).rejects.toBeInstanceOf(ApiError);
  });

  it('describes delivery honestly', () => {
    expect(describeDelivery(response('no_contacts') as never)).toMatch(/nobody was notified/);
    expect(describeDelivery(response('failed') as never)).toMatch(/failed/);
    expect(describeDelivery(response('sent') as never)).toMatch(/delivery confirmed/);
  });
});
