import type { LocationSampleInput, NetworkQuality, SensorEvent } from '@safetrail/contracts';

export interface RawFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
}

/**
 * Converts raw platform fixes into validated API samples and drops fixes that add no
 * information: exact repeats, fixes closer in time than `minIntervalMs`, and fixes with
 * impossible values. Pure function — no device APIs — so it is unit-testable.
 */
export class Sampler {
  private lastAccepted: RawFix | null = null;

  constructor(
    private readonly opts: { minIntervalMs: number; source: 'device' | 'simulated'; idFactory: () => string },
  ) {}

  accept(fix: RawFix, ctx: { network: NetworkQuality; batteryLevel: number | null; sensorEvent?: SensorEvent }): LocationSampleInput | null {
    if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) return null;
    if (Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180) return null;
    const last = this.lastAccepted;
    const urgent = ctx.sensorEvent && ctx.sensorEvent !== 'none';
    if (last && !urgent) {
      if (fix.timestamp <= last.timestamp) return null; // duplicate or out of order
      if (fix.timestamp - last.timestamp < this.opts.minIntervalMs) return null;
      if (fix.latitude === last.latitude && fix.longitude === last.longitude && fix.timestamp - last.timestamp < 5 * this.opts.minIntervalMs) {
        return null; // identical position, nothing new to report yet
      }
    }
    this.lastAccepted = fix;
    // Platforms report -1 for unknown speed/heading.
    const speed = fix.speed !== null && fix.speed >= 0 ? Math.min(fix.speed, 150) : null;
    return {
      clientSampleId: this.opts.idFactory(),
      lat: Number(fix.latitude.toFixed(6)),
      lng: Number(fix.longitude.toFixed(6)),
      accuracyM: fix.accuracy !== null && fix.accuracy >= 0 ? Math.min(Math.round(fix.accuracy), 100_000) : null,
      speedMps: speed,
      headingDeg: fix.heading !== null && fix.heading >= 0 && fix.heading <= 360 ? fix.heading : null,
      altitudeM: fix.altitude !== null && fix.altitude > -500 && fix.altitude < 9000 ? fix.altitude : null,
      recordedAt: new Date(fix.timestamp).toISOString(),
      network: ctx.network,
      batteryLevel: ctx.batteryLevel,
      sensorEvent: ctx.sensorEvent ?? 'none',
      source: this.opts.source,
    };
  }

  reset() {
    this.lastAccepted = null;
  }
}

/** Split samples into API-sized batches. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
