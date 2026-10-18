import { chunk, Sampler, type RawFix } from '@/features/tracking/sampler';

let n = 0;
const sampler = () => new Sampler({ minIntervalMs: 10_000, source: 'device', idFactory: () => `sample-id-${++n}` });
const fix = (t: number, extra: Partial<RawFix> = {}): RawFix => ({ latitude: 26.9, longitude: 75.8, accuracy: 8.4, speed: 1.2, heading: 90, altitude: 400, timestamp: t, ...extra });
const ctx = { network: 'good' as const, batteryLevel: 0.5 };

describe('Sampler', () => {
  it('converts fixes into contract-valid samples', () => {
    const s = sampler().accept(fix(1_000), ctx)!;
    expect(s).toMatchObject({ lat: 26.9, lng: 75.8, accuracyM: 8, speedMps: 1.2, source: 'device', network: 'good', sensorEvent: 'none' });
    expect(s.recordedAt).toBe(new Date(1_000).toISOString());
  });

  it('throttles, drops duplicates and out-of-order fixes', () => {
    const s = sampler();
    expect(s.accept(fix(0), ctx)).not.toBeNull();
    expect(s.accept(fix(5_000, { latitude: 26.91 }), ctx)).toBeNull(); // too soon
    expect(s.accept(fix(0), ctx)).toBeNull(); // duplicate timestamp
    expect(s.accept(fix(20_000), ctx)).toBeNull(); // same position, nothing new
    expect(s.accept(fix(20_000, { latitude: 26.91 }), ctx)).not.toBeNull();
  });

  it('lets urgent sensor events through immediately', () => {
    const s = sampler();
    s.accept(fix(0), ctx);
    expect(s.accept(fix(1_000), { ...ctx, sensorEvent: 'possible_fall' })?.sensorEvent).toBe('possible_fall');
  });

  it('rejects impossible coordinates and normalises unknown speed/heading', () => {
    const s = sampler();
    expect(s.accept(fix(0, { latitude: 120 }), ctx)).toBeNull();
    expect(s.accept(fix(0, { longitude: Number.NaN }), ctx)).toBeNull();
    const ok = s.accept(fix(0, { speed: -1, heading: -1, accuracy: null }), ctx)!;
    expect(ok.speedMps).toBeNull();
    expect(ok.headingDeg).toBeNull();
    expect(ok.accuracyM).toBeNull();
  });

  it('chunks batches to the API limit', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length)).toEqual([100, 100, 50]);
  });
});
