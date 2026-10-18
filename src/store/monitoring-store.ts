import type { LocationSampleInput, NetworkQuality, SensorEvent } from '@safetrail/contracts';
import { create } from 'zustand';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'background_granted';
export type LocationSource = 'device' | 'simulated';

interface MonitoringState {
  active: boolean;
  tripId: string | null;
  source: LocationSource;
  permission: PermissionState;
  backgroundActive: boolean;
  network: NetworkQuality;
  lastSample: LocationSampleInput | null;
  lastUploadAt: string | null;
  lastError: string | null;
  queue: { pending: number; failed: number; pendingSos: number };
  /** Demo only: the next simulated sample carries this sensor event. */
  pendingSensorEvent: SensorEvent;
  set(patch: Partial<Omit<MonitoringState, 'set'>>): void;
}

export const useMonitoringStore = create<MonitoringState>((set) => ({
  active: false,
  tripId: null,
  source: 'device',
  permission: 'unknown',
  backgroundActive: false,
  network: 'unknown',
  lastSample: null,
  lastUploadAt: null,
  lastError: null,
  queue: { pending: 0, failed: 0, pendingSos: 0 },
  pendingSensorEvent: 'none',
  set: (patch) => set(patch),
}));
