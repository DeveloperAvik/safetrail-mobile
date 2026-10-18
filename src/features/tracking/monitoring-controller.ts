import type { LocationSampleInput, NetworkQuality, Trip } from '@safetrail/contracts';
import * as Location from 'expo-location';
import { api } from '@/services/api';
import { ApiError } from '@/services/api-client';
import { startBackgroundUpdates, stopBackgroundUpdates } from '@/services/background-location';
import { currentQuality, onNetworkChange } from '@/services/network';
import { offlineQueue } from '@/services/offline-queue';
import { useMonitoringStore, type LocationSource } from '@/store/monitoring-store';
import { newId } from '@/utils/ids';
import { chunk, Sampler, type RawFix } from './sampler';
import { SimulatedLocationSource } from './simulated-source';

export interface MonitoringOptions {
  samplingIntervalSec: number;
  backgroundLocation: boolean;
  source: LocationSource;
}

const UPLOAD_EVERY_MS = 30_000;
const MAX_BUFFER = 20;

/** Ask for foreground location; background is requested separately and only if the user opted in. */
export async function requestLocationPermission(background: boolean) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied' as const;
  if (!background) return 'granted' as const;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted' ? ('background_granted' as const) : ('granted' as const);
  } catch {
    return 'granted' as const; // e.g. Expo Go, where background location is unavailable
  }
}

/**
 * Collects location for the active trip, batches samples, uploads them and falls back to the
 * offline queue. Also flushes the queue whenever connectivity returns.
 */
class MonitoringController {
  private buffer: LocationSampleInput[] = [];
  private watch: Location.LocationSubscription | null = null;
  private simulated: SimulatedLocationSource | null = null;
  private uploadTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeNetwork: (() => void) | null = null;
  private sampler: Sampler | null = null;
  private network: NetworkQuality = 'unknown';
  private onEvaluated: (() => void) | null = null;

  setEvaluationListener(fn: () => void) {
    this.onEvaluated = fn;
  }

  async start(trip: Trip, opts: MonitoringOptions) {
    await this.stop();
    const store = useMonitoringStore.getState();
    this.network = await currentQuality();
    this.sampler = new Sampler({ minIntervalMs: Math.max(5, opts.samplingIntervalSec - 2) * 1000, source: opts.source, idFactory: newId });
    store.set({ tripId: trip.id, source: opts.source, network: this.network, lastError: null });

    this.unsubscribeNetwork = onNetworkChange((q) => {
      const wasOffline = this.network === 'offline';
      this.network = q;
      useMonitoringStore.getState().set({ network: q });
      if (wasOffline && q !== 'offline') void this.syncNow();
    });

    if (opts.source === 'simulated') {
      const from = trip.lastKnownLocation ?? trip.origin ?? trip.destination;
      this.simulated = new SimulatedLocationSource(from, trip.destination, opts.samplingIntervalSec * 1000);
      this.simulated.start((fix) => this.onFix(fix));
      store.set({ active: true, permission: 'granted' });
    } else {
      const permission = await requestLocationPermission(opts.backgroundLocation);
      store.set({ permission });
      if (permission === 'denied') {
        store.set({ active: false, lastError: 'Location permission denied. Monitoring is off; manual SOS still works.' });
        return false;
      }
      this.watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: opts.samplingIntervalSec * 1000, distanceInterval: 10 },
        (loc) => this.onFix({ ...loc.coords, timestamp: loc.timestamp }),
        (reason) => store.set({ lastError: `Location error: ${reason}` }),
      );
      if (opts.backgroundLocation && permission === 'background_granted') {
        store.set({ backgroundActive: await startBackgroundUpdates(trip.id, opts.samplingIntervalSec).catch(() => false) });
      }
      store.set({ active: true });
    }
    this.uploadTimer = setInterval(() => void this.upload(), UPLOAD_EVERY_MS);
    void this.syncNow();
    return true;
  }

  async stop() {
    this.watch?.remove();
    this.watch = null;
    this.simulated?.stop();
    this.simulated = null;
    if (this.uploadTimer) clearInterval(this.uploadTimer);
    this.uploadTimer = null;
    this.unsubscribeNetwork?.();
    this.unsubscribeNetwork = null;
    await this.upload();
    await stopBackgroundUpdates();
    useMonitoringStore.getState().set({ active: false, backgroundActive: false });
  }

  private onFix(fix: RawFix) {
    const store = useMonitoringStore.getState();
    const sensorEvent = store.pendingSensorEvent;
    const sample = this.sampler?.accept(fix, { network: this.network, batteryLevel: null, sensorEvent });
    if (!sample) return;
    if (sensorEvent !== 'none') store.set({ pendingSensorEvent: 'none' });
    this.buffer.push(sample);
    store.set({ lastSample: sample });
    if (this.buffer.length >= MAX_BUFFER || sensorEvent !== 'none' || this.buffer.length === 1) void this.upload();
  }

  /** Upload buffered samples; anything that fails goes to the persistent offline queue. */
  async upload() {
    const tripId = useMonitoringStore.getState().tripId;
    if (!tripId || !this.buffer.length) return;
    const samples = this.buffer.splice(0, this.buffer.length);
    const store = useMonitoringStore.getState();
    if (this.network === 'offline') {
      await this.queueSamples(tripId, samples);
      return;
    }
    try {
      for (const batch of chunk(samples)) {
        const res = await api.trips.uploadLocations(tripId, batch);
        if (res.evaluation) this.onEvaluated?.();
      }
      store.set({ lastUploadAt: new Date().toISOString(), lastError: null });
    } catch (err) {
      if (err instanceof ApiError && !err.isNetwork && err.status < 500) {
        store.set({ lastError: err.message }); // e.g. trip ended: do not retry forever
      } else {
        await this.queueSamples(tripId, samples);
      }
    }
  }

  private async queueSamples(tripId: string, samples: LocationSampleInput[]) {
    for (const batch of chunk(samples)) {
      await offlineQueue.enqueue({ type: 'location_batch', idempotencyKey: newId(), clientCreatedAt: new Date().toISOString(), payload: { tripId, samples: batch } });
    }
    await this.refreshQueueCounts();
  }

  /** Try to deliver the offline queue now. */
  async syncNow() {
    const result = await offlineQueue.flush((events) => api.sync.batch(events));
    await this.refreshQueueCounts();
    if (result.synced) this.onEvaluated?.();
    return result;
  }

  async refreshQueueCounts() {
    useMonitoringStore.getState().set({ queue: await offlineQueue.counts() });
  }
}

export const monitoring = new MonitoringController();
