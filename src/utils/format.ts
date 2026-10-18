export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Data freshness bucket for the dashboard. */
export function freshness(iso: string | null | undefined, now = Date.now()): 'fresh' | 'stale' | 'old' | 'none' {
  if (!iso) return 'none';
  const age = now - Date.parse(iso);
  if (age < 2 * 60_000) return 'fresh';
  if (age < 15 * 60_000) return 'stale';
  return 'old';
}
