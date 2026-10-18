import type { RawFix } from './sampler';

/**
 * Synthetic movement for demos on simulators: walks from `from` to `to` at ~1.4 m/s with small
 * jitter. Samples are labelled `source: 'simulated'` by the caller and never mixed with GPS.
 */
export class SimulatedLocationSource {
  private timer: ReturnType<typeof setInterval> | null = null;
  private progress = 0;

  constructor(
    private readonly from: { lat: number; lng: number },
    private readonly to: { lat: number; lng: number },
    private readonly intervalMs: number,
  ) {}

  start(onFix: (fix: RawFix) => void) {
    const distanceM = haversine(this.from, this.to);
    const step = distanceM > 0 ? (1.4 * (this.intervalMs / 1000)) / distanceM : 1;
    const emit = () => {
      this.progress = Math.min(1, this.progress + step);
      const jitter = () => (Math.random() - 0.5) * 0.00008;
      onFix({
        latitude: this.from.lat + (this.to.lat - this.from.lat) * this.progress + jitter(),
        longitude: this.from.lng + (this.to.lng - this.from.lng) * this.progress + jitter(),
        accuracy: 8,
        speed: this.progress < 1 ? 1.4 : 0,
        heading: null,
        altitude: null,
        timestamp: Date.now(),
      });
    };
    emit();
    this.timer = setInterval(emit, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
