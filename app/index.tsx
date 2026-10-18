import { Redirect } from 'expo-router';
import { Loading } from '@/components/query-state';
import { useProfile } from '@/hooks/queries';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';

/** Entry: signed-out users see onboarding/login; new users give consent first; others land on the dashboard. */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const seen = useSettingsStore((s) => s.onboardingSeen);
  const profile = useProfile();
  if (status !== 'signedIn') return <Redirect href={seen ? '/login' : '/onboarding'} />;
  if (profile.isLoading) return <Loading label="Loading your profile…" />;
  if (profile.data && !profile.data.onboardingCompleted) return <Redirect href="/settings/consent" />;
  return <Redirect href="/(tabs)" />;
}
