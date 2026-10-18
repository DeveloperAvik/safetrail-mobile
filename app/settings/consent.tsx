import { CURRENT_CONSENT_POLICY_VERSION } from '@safetrail/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { requestLocationPermission } from '@/features/tracking/monitoring-controller';
import { qk, useProfile } from '@/hooks/queries';
import { api } from '@/services/api';
import { ensureNotificationPermission } from '@/services/local-notifications';
import { useMonitoringStore } from '@/store/monitoring-store';
import { showError } from '@/utils/feedback';

function Row({ title, body, value, onChange, disabled }: { title: string; body: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View className="flex-row items-start gap-3 py-3">
      <View className="flex-1 gap-1">
        <Text className="font-medium">{title}</Text>
        <Text className="text-sm text-muted-foreground">{body}</Text>
      </View>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} accessibilityLabel={title} />
    </View>
  );
}

/** Consent & permissions: explains each purpose; monitoring can be stopped at any time. */
export default function Consent() {
  const qc = useQueryClient();
  const profile = useProfile();
  const permission = useMonitoringStore((s) => s.permission);
  const [saving, setSaving] = React.useState(false);
  if (profile.isLoading) return <Loading />;
  if (profile.error || !profile.data) return <Screen><ErrorState error={profile.error} onRetry={() => void profile.refetch()} /></Screen>;
  const p = profile.data;

  const save = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: qk.profile });
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const setConsent = (key: 'locationMonitoring' | 'shareLocationWithContactsDuringIncident' | 'aggregateAnalytics') => (v: boolean) =>
    save(() => api.profile.consent({ [key]: v, policyVersion: CURRENT_CONSENT_POLICY_VERSION }));

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>What SafeTrail collects</CardTitle>
          <CardDescription>Only during trips you start. Never used for advertising or sold. You can stop at any time.</CardDescription>
        </CardHeader>
        <CardContent>
          <Row
            title="Location monitoring during trips"
            body="Needed to notice route deviation, long inactivity or lost signal. Without it, only manual SOS works."
            value={p.consent.locationMonitoring}
            onChange={setConsent('locationMonitoring')}
            disabled={saving}
          />
          <Separator />
          <Row
            title="Share my location with contacts during an incident"
            body="Contacts see your last known location only while an incident is open, through an expiring link."
            value={p.consent.shareLocationWithContactsDuringIncident}
            onChange={setConsent('shareLocationWithContactsDuringIncident')}
            disabled={saving}
          />
          <Separator />
          <Row
            title="Anonymous aggregate statistics"
            body="Counts (e.g. number of incidents) on the operator dashboard. No individual locations."
            value={p.consent.aggregateAnalytics}
            onChange={setConsent('aggregateAnalytics')}
            disabled={saving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monitoring</CardTitle>
          <CardDescription>Turning this off stops automated detection. Manual SOS keeps working.</CardDescription>
        </CardHeader>
        <CardContent>
          <Row
            title="Monitoring enabled"
            body={p.consent.locationMonitoring ? 'Collect location while a trip is active.' : 'Give location consent first.'}
            value={p.monitoring.monitoringEnabled}
            onChange={(v) => save(() => api.profile.update({ monitoring: { monitoringEnabled: v } }))}
            disabled={saving || !p.consent.locationMonitoring}
          />
          <Separator />
          <Row
            title="Background location (optional)"
            body="Keeps monitoring while the app is closed. Needs a development/production build (not Expo Go); the OS may still pause it."
            value={p.monitoring.backgroundLocation}
            onChange={(v) => save(() => api.profile.update({ monitoring: { backgroundLocation: v } }))}
            disabled={saving}
          />
          <Separator />
          <Row
            title="Learn my normal pattern"
            body="Builds a personal baseline from summary statistics (no raw history is kept for it)."
            value={p.monitoring.baselineLearningEnabled}
            onChange={(v) => save(() => api.profile.update({ monitoring: { baselineLearningEnabled: v } }))}
            disabled={saving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device permissions</CardTitle>
          <CardDescription>Location permission: {permission}</CardDescription>
        </CardHeader>
        <CardContent className="gap-2">
          <Button variant="outline" onPress={async () => useMonitoringStore.getState().set({ permission: await requestLocationPermission(p.monitoring.backgroundLocation) })}>
            <Text>Grant location permission</Text>
          </Button>
          <Button variant="outline" onPress={() => void ensureNotificationPermission()}>
            <Text>Allow notifications for safety checks</Text>
          </Button>
        </CardContent>
      </Card>

      {!p.onboardingCompleted ? (
        <Button
          size="lg"
          onPress={() =>
            save(async () => {
              await api.profile.update({ onboardingCompleted: true });
              router.replace('/(tabs)');
            })
          }>
          <Text>Continue</Text>
        </Button>
      ) : null}
    </Screen>
  );
}
