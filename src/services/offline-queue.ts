import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncBatchResponse, SyncEvent } from '@safetrail/contracts';
import { KEYS, secureStorage } from './secure-storage';

/**
 * Persistent queue for events recorded while the server is unreachable.
 *
 * - SOS events are stored individually in encrypted SecureStore (minimal payload: time,
 *   coordinates, accuracy) and are never evicted.
 * - Location batches, check-ins and prompt answers go to AsyncStorage (app sandbox), bounded.
 * - Every item keeps its idempotency key, so re-sending after a crash or a lost response cannot
 *   create duplicates: the server returns `duplicate` for keys it already applied.
 * - Delivery is NOT guaranteed while the OS keeps the app suspended or killed; items are sent the
 *   next time the app runs with connectivity. The UI must say "queued", never "sent".
 */
export type QueueStatus = 'pending' | 'synced' | 'failed';

export interface QueueItem {
  event: SyncEvent;
  status: QueueStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  syncedAt: number | null;
  resourceId: string | null;
  message: string | null;
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const asyncStore: KeyValueStore = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};

const GENERAL_KEY = 'safetrail.queue.v1';
const MAX_GENERAL_ITEMS = 200;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 5 * 60_000;

/** Exponential backoff with full jitter. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const cap = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1));
  return Math.max(500, Math.floor(random() * cap));
}

export type Sender = (events: SyncEvent[]) => Promise<SyncBatchResponse>;

export interface FlushResult {
  sent: number;
  synced: number;
  failed: number;
  retrying: number;
  networkError: boolean;
}

export class OfflineQueue {
  private flushing: Promise<FlushResult> | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private readonly general: KeyValueStore = asyncStore,
    private readonly secure: KeyValueStore = secureStorage,
    private readonly now: () => number = Date.now,
  ) {}

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private async readGeneral(): Promise<QueueItem[]> {
    try {
      const raw = await this.general.get(GENERAL_KEY);
      const parsed = raw ? (JSON.parse(raw) as QueueItem[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return []; // corrupted storage is discarded rather than crashing the app
    }
  }

  private async writeGeneral(items: QueueItem[]) {
    // Bound storage: drop synced items first, then the oldest non-SOS failures/batches.
    let kept = items;
    if (kept.length > MAX_GENERAL_ITEMS) kept = kept.filter((i) => i.status !== 'synced');
    if (kept.length > MAX_GENERAL_ITEMS) kept = kept.slice(kept.length - MAX_GENERAL_ITEMS);
    await this.general.set(GENERAL_KEY, JSON.stringify(kept));
  }

  private async sosIndex(): Promise<string[]> {
    try {
      const raw = await this.secure.get(KEYS.sosIndex);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private async readSos(): Promise<QueueItem[]> {
    const ids = await this.sosIndex();
    const items: QueueItem[] = [];
    for (const id of ids) {
      const raw = await this.secure.get(KEYS.sosItem(id));
      if (!raw) continue;
      try {
        items.push(JSON.parse(raw) as QueueItem);
      } catch {
        /* skip unreadable entry */
      }
    }
    return items;
  }

  private async writeSos(item: QueueItem) {
    const id = item.event.idempotencyKey;
    const ids = await this.sosIndex();
    if (!ids.includes(id)) await this.secure.set(KEYS.sosIndex, JSON.stringify([...ids, id]));
    await this.secure.set(KEYS.sosItem(id), JSON.stringify(item));
  }

  async list(): Promise<QueueItem[]> {
    const [sos, general] = await Promise.all([this.readSos(), this.readGeneral()]);
    return [...sos, ...general].sort((a, b) => Date.parse(a.event.clientCreatedAt) - Date.parse(b.event.clientCreatedAt));
  }

  async counts() {
    const items = await this.list();
    return {
      pending: items.filter((i) => i.status === 'pending').length,
      failed: items.filter((i) => i.status === 'failed').length,
      pendingSos: items.filter((i) => i.status === 'pending' && i.event.type === 'sos').length,
    };
  }

  /** Enqueue an event. Re-enqueueing the same idempotency key is a no-op. */
  async enqueue(event: SyncEvent): Promise<void> {
    const item: QueueItem = { event, status: 'pending', attempts: 0, nextAttemptAt: this.now(), lastError: null, syncedAt: null, resourceId: null, message: null };
    if (event.type === 'sos') {
      const existing = await this.secure.get(KEYS.sosItem(event.idempotencyKey));
      if (!existing) await this.writeSos(item);
    } else {
      const items = await this.readGeneral();
      if (!items.some((i) => i.event.idempotencyKey === event.idempotencyKey)) await this.writeGeneral([...items, item]);
    }
    this.emit();
  }

  /** Send due items in one batch (SOS first). Concurrent calls share the same flush. */
  flush(send: Sender): Promise<FlushResult> {
    if (!this.flushing) {
      this.flushing = this.doFlush(send).finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async doFlush(send: Sender): Promise<FlushResult> {
    const now = this.now();
    const all = await this.list();
    const due = all
      .filter((i) => i.status === 'pending' && i.nextAttemptAt <= now)
      .sort((a, b) => Number(b.event.type === 'sos') - Number(a.event.type === 'sos'))
      .slice(0, 50);
    const result: FlushResult = { sent: due.length, synced: 0, failed: 0, retrying: 0, networkError: false };
    if (!due.length) return result;

    let response: SyncBatchResponse | null = null;
    try {
      response = await send(due.map((i) => i.event));
    } catch (err) {
      result.networkError = true;
      for (const item of due) {
        item.attempts += 1;
        item.nextAttemptAt = now + backoffMs(item.attempts);
        item.lastError = (err as Error).message?.slice(0, 120) ?? 'Network error';
        result.retrying += 1;
      }
    }
    if (response) {
      const byKey = new Map(response.results.map((r) => [r.idempotencyKey, r]));
      for (const item of due) {
        const r = byKey.get(item.event.idempotencyKey);
        item.attempts += 1;
        if (r && (r.status === 'processed' || r.status === 'duplicate')) {
          item.status = 'synced';
          item.syncedAt = now;
          item.resourceId = r.resourceId;
          item.message = r.message;
          item.lastError = null;
          result.synced += 1;
        } else if (r && r.status === 'rejected') {
          item.status = 'failed';
          item.lastError = r.message ?? 'Rejected by server';
          result.failed += 1;
        } else {
          item.nextAttemptAt = now + backoffMs(item.attempts);
          item.lastError = r?.message ?? 'No result returned';
          result.retrying += 1;
        }
      }
    }
    await this.persist(due);
    this.emit();
    return result;
  }

  private async persist(updated: QueueItem[]) {
    const general = await this.readGeneral();
    const byKey = new Map(updated.map((i) => [i.event.idempotencyKey, i]));
    for (const item of updated) if (item.event.type === 'sos') await this.writeSos(item);
    await this.writeGeneral(general.map((i) => byKey.get(i.event.idempotencyKey) ?? i));
  }

  /** Remove synced items older than `maxAgeMs` (keeps local data minimal). */
  async prune(maxAgeMs = 24 * 3_600_000) {
    const cutoff = this.now() - maxAgeMs;
    const general = await this.readGeneral();
    await this.writeGeneral(general.filter((i) => !(i.status === 'synced' && (i.syncedAt ?? 0) < cutoff)));
    const ids = await this.sosIndex();
    const keep: string[] = [];
    for (const id of ids) {
      const raw = await this.secure.get(KEYS.sosItem(id));
      const item = raw ? (JSON.parse(raw) as QueueItem) : null;
      if (item && !(item.status === 'synced' && (item.syncedAt ?? 0) < cutoff)) keep.push(id);
      else await this.secure.remove(KEYS.sosItem(id));
    }
    await this.secure.set(KEYS.sosIndex, JSON.stringify(keep));
    this.emit();
  }

  /** Wipe everything (logout / account deletion). */
  async clear() {
    for (const id of await this.sosIndex()) await this.secure.remove(KEYS.sosItem(id));
    await this.secure.remove(KEYS.sosIndex);
    await this.general.remove(GENERAL_KEY);
    this.emit();
  }
}

export const offlineQueue = new OfflineQueue();
