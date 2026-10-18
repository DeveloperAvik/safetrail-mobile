import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Sampler } from '@/features/tracking/sampler';
import { newId } from '@/utils/ids';
import { currentQuality } from './network';
import { offlineQueue } from './offline-queue';

/**
 * Background location (development/production builds only — not Expo Go, and subject to the OS:
 * iOS may pause updates, Android requires a visible foreground-service notification, and a
 * force-quit app receives nothing). Background fixes are written to the offline queue and
 * uploaded when the app is next active with connectivity.
 */
export const BACKGROUND_TASK = 'safetrail-background-location';
let backgroundTripId: string | null = null;
const sampler = new Sampler({ minIntervalMs: 30_000, source: 'device', idFactory: newId });

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(BACKGROUND_TASK, async ({ data, error }) => {
  if (error || !data || !backgroundTripId) return;
  const network = await currentQuality();
  const samples = data.locations
    .map((l) => sampler.accept({ ...l.coords, timestamp: l.timestamp }, { network, batteryLevel: null }))
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (!samples.length) return;
  await offlineQueue.enqueue({
    type: 'location_batch',
    idempotencyKey: newId(),
    clientCreatedAt: new Date().toISOString(),
    payload: { tripId: backgroundTripId, samples: samples.slice(0, 100) },
  });
});

export async function startBackgroundUpdates(tripId: string, intervalSec: number): Promise<boolean> {
  if (!(await TaskManager.isAvailableAsync())) return false;
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;
  backgroundTripId = tripId;
  await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: intervalSec * 1000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SafeTrail is monitoring your trip',
      notificationBody: 'Location is shared with SafeTrail only while this trip is active.',
    },
  });
  return true;
}

export async function stopBackgroundUpdates() {
  backgroundTripId = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) await Location.stopLocationUpdatesAsync(BACKGROUND_TASK);
  } catch {
    /* task not registered on this platform */
  }
}
