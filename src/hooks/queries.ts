import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/auth-store';

export const qk = {
  status: ['safety', 'status'] as const,
  profile: ['profile'] as const,
  currentTrip: ['trips', 'current'] as const,
  trips: ['trips', 'list'] as const,
  trip: (id: string) => ['trips', id] as const,
  route: (id: string) => ['trips', id, 'route'] as const,
  transitions: (id: string) => ['trips', id, 'transitions'] as const,
  contacts: ['contacts'] as const,
  incidents: ['incidents'] as const,
  incident: (id: string) => ['incidents', id] as const,
  notifications: ['notifications'] as const,
  baseline: ['baseline'] as const,
};

const enabled = () => useAuthStore.getState().status === 'signedIn';

/** Safety status is polled so prompts and state changes appear without push notifications. */
export const useSafetyStatus = () => useQuery({ queryKey: qk.status, queryFn: api.safety.status, refetchInterval: 10_000, enabled: enabled() });
export const useProfile = () => useQuery({ queryKey: qk.profile, queryFn: api.profile.get, enabled: enabled() });
export const useCurrentTrip = () => useQuery({ queryKey: qk.currentTrip, queryFn: async () => (await api.trips.current()).trip, enabled: enabled() });
export const useContacts = () => useQuery({ queryKey: qk.contacts, queryFn: api.contacts.list, enabled: enabled() });
export const useBaseline = () => useQuery({ queryKey: qk.baseline, queryFn: api.baseline.get, enabled: enabled() });
