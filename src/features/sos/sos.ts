import type { SosResponse } from '@safetrail/contracts';
import { api } from '@/services/api';
import { ApiError } from '@/services/api-client';
import { offlineQueue } from '@/services/offline-queue';
import { newId } from '@/utils/ids';

export type SosOutcome =
  | { kind: 'sent'; response: SosResponse }
  /** Saved on the device; it has NOT reached the server or any contact yet. */
  | { kind: 'queued'; idempotencyKey: string; reason: string };

export interface SosInput {
  tripId?: string;
  location: { lat: number; lng: number; accuracyM: number | null } | null;
  message?: string;
  network: 'good' | 'weak' | 'offline' | 'unknown';
  simulated?: boolean;
}

/**
 * Manual SOS. Tries the server immediately; on any network failure the SAME idempotency key is
 * queued for offline sync, so a request that actually arrived is never duplicated.
 * It does not depend on the AI service, the baseline or weather.
 */
export async function triggerSos(input: SosInput, deps = { api, queue: offlineQueue, id: newId }): Promise<SosOutcome> {
  const idempotencyKey = deps.id();
  const clientCreatedAt = new Date().toISOString();
  const body = {
    idempotencyKey,
    clientCreatedAt,
    tripId: input.tripId,
    location: input.location,
    message: input.message,
    network: input.network,
    simulated: input.simulated ?? false,
  };
  if (input.network !== 'offline') {
    try {
      return { kind: 'sent', response: await deps.api.emergency.sos(body) };
    } catch (err) {
      // Validation errors would fail again offline; report them instead of queueing silently.
      if (err instanceof ApiError && !err.isNetwork && err.status !== 429 && err.status < 500) throw err;
    }
  }
  await deps.queue.enqueue({
    type: 'sos',
    idempotencyKey,
    clientCreatedAt,
    payload: { tripId: input.tripId, location: input.location, message: input.message, network: input.network, simulated: input.simulated ?? false },
  });
  return { kind: 'queued', idempotencyKey, reason: input.network === 'offline' ? 'No connection' : 'Server unreachable' };
}

export function describeDelivery(r: SosResponse): string {
  switch (r.notificationStatus) {
    case 'no_contacts':
      return 'Emergency recorded. You have no verified trusted contacts, so nobody was notified.';
    case 'sent':
      return r.incident.delivery.delivered === r.incident.delivery.total
        ? 'Your trusted contacts were notified (delivery confirmed by the provider).'
        : 'Alerts were accepted by the messaging provider; delivery is not yet confirmed.';
    case 'partially_sent':
      return `Some alerts were sent; ${r.incident.delivery.failed} could not be delivered.`;
    case 'failed':
      return 'Emergency recorded, but alerts to your contacts failed. Call local emergency services if you can.';
    case 'queued':
      return 'Emergency recorded. Alerts are queued and being retried.';
  }
}
