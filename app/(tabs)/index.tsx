import { useQueryClient } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Activity, Brain, Cpu, MapPin, Radio, Users, Wifi, WifiOff } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SosButton } from '@/components/sos-button';
import { StateBadge } from '@/components/state-badge';
import { StatusRow, type Tone } from '@/components/status-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { qk, useContacts, useCurrentTrip, useProfile, useSafetyStatus } from '@/hooks/queries';
import { api } from '@/services/api';
import { showError } from '@/utils/feedback';
import { useMonitoringStore } from '@/store/monitoring-store';
import { SIGNAL_LABEL, STATE_META } from '@/theme/tokens';
import { formatCoord, freshness, timeAgo } from '@/utils/format';

export default function Dashboard() {
  const qc = useQueryClient();
  const status = useSafetyStatus();
  const trip = useCurrentTrip();
  const contacts = useContacts();
  const profile = useProfile();
  const mon = useMonitoringStore();
  const [busy, setBusy] = React.useState(false);

  const refresh = () => void qc.invalidateQueries();

  if (status.isLoading || trip.isLoading) return <Loading />;
  if (status.error) return <Screen><ErrorState error={status.error} onRetry={refresh} /><SosButton /></Screen>;

  const s = status.data!;
  const meta = STATE_META[s.state];
  const t = trip.data;
  const last = t?.lastKnownLocation ?? null;
  const fresh = freshness(last?.recordedAt);
  const readiness = contacts.data?.readiness;
  const monitoringAllowed = profile.data?.monitoring.monitoringEnabled && profile.data.consent.locationMonitoring;

  const endTrip = async () => {
    if (!t) return;
    setBusy(true);
    try {
      await api.trips.transition(t.id, 'complete');
      await qc.invalidateQueries();
    } catch (err) {
      showError(err, 'Could not end trip');
    } finally {
      setBusy(false);
    }
  };

  const baselineProgress = Math.min(100, Math.round((s.baseline.sampleCount / s.baseline.requirements.activeAt) * 100));
  const freshTone: Tone = fresh === 'fresh' ? 'ok' : fresh === 'stale' ? 'warn' : fresh === 'old' ? 'bad' : 'neutral';

  return (
    <Screen onRefresh={refresh} refreshing={status.isFetching}>
      <ConnectivityBanner />
      <Card className="overflow-hidden">
        <View className={`h-2 ${meta.className}`} />
        <CardHeader>
          <View className="flex-row items-center justify-between">
            <CardDescription>Current safety state</CardDescription>
            <StateBadge state={s.state} />
          </View>
          <CardTitle className={`text-3xl ${meta.textClass}`}>{meta.label}</CardTitle>
          <Text className="text-muted-foreground">{meta.summary} {meta.action}</Text>
        </CardHeader>
        <CardContent className="gap-2">
          {s.openPrompt ? (
            <Button onPress={() => router.push({ pathname: '/safety/prompt', params: { id: s.openPrompt!.id } })}>
              <Text>Respond to safety check</Text>
            </Button>
          ) : null}
          {s.activeIncidentId ? (
            <Button variant="destructive" onPress={() => router.push(`/emergency/${s.activeIncidentId}`)}>
              <Text>View active incident</Text>
            </Button>
          ) : null}
          {s.lastAssessment?.signals.length ? (
            <View className="gap-1">
              <Text className="text-sm font-medium">Why</Text>
              {s.lastAssessment.signals.slice(0, 3).map((sig) => (
                <Text key={sig.code} className="text-sm text-muted-foreground">• {SIGNAL_LABEL[sig.code] ?? sig.code} ({sig.strength})</Text>
              ))}
            </View>
          ) : null}
          <Link href="/safety" asChild>
            <Button variant="ghost" size="sm">
              <Text>Monitoring details</Text>
            </Button>
          </Link>
        </CardContent>
      </Card>

      <SosButton />

      <Card>
        <CardHeader>
          <CardTitle>{t ? t.title : 'No active trip'}</CardTitle>
          <CardDescription>{t ? `${t.status === 'paused' ? 'Paused · ' : ''}to ${t.destination.name}` : 'Start a trip to enable monitoring.'}</CardDescription>
        </CardHeader>
        <CardContent className="gap-1">
          {t ? (
            <>
              <StatusRow
                icon={Radio}
                label="Monitoring"
                value={mon.active ? `On (${mon.source === 'simulated' ? 'simulated location' : 'GPS'}${mon.backgroundActive ? ', background' : ', foreground only'})` : monitoringAllowed ? 'Starting…' : 'Off — consent or monitoring disabled'}
                tone={mon.active ? 'ok' : 'warn'}
                hint={mon.lastError ?? undefined}
              />
              <StatusRow
                icon={MapPin}
                label="Last known location"
                value={last ? formatCoord(last.lat, last.lng) : 'No location yet'}
                tone={freshTone}
                hint={last ? `${timeAgo(last.recordedAt)}${last.accuracyM ? ` · ±${Math.round(last.accuracyM)} m` : ''}${last.source === 'simulated' ? ' · simulated' : ''}` : undefined}
              />
              <View className="mt-2 flex-row gap-2">
                <Button className="flex-1" variant="outline" onPress={() => router.push(`/trips/${t.id}`)}>
                  <Text>Live map</Text>
                </Button>
                <Button className="flex-1" variant="secondary" onPress={endTrip} disabled={busy}>
                  <Text>{busy ? 'Ending…' : 'End trip'}</Text>
                </Button>
              </View>
            </>
          ) : (
            <Button onPress={() => router.push('/trips/new')}>
              <Text>Start a trip</Text>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="gap-1">
          <StatusRow icon={mon.network === 'offline' ? WifiOff : Wifi} label="Connectivity" value={mon.network} tone={mon.network === 'good' ? 'ok' : mon.network === 'offline' ? 'bad' : 'warn'} hint={mon.queue.pending ? `${mon.queue.pending} queued on device` : undefined} />
          <Separator />
          <StatusRow
            icon={Users}
            label="Trusted contacts"
            value={readiness ? `${readiness.verified} verified${readiness.pending ? `, ${readiness.pending} pending` : ''}` : '—'}
            tone={readiness?.verified ? 'ok' : 'bad'}
            hint={readiness?.verified ? undefined : 'Nobody can be alerted until a contact accepts your invitation.'}
          />
          <Separator />
          <StatusRow icon={Brain} label="Personal baseline" value={s.baseline.status.replace('_', ' ')} tone={s.baseline.status === 'active' ? 'ok' : 'neutral'} hint={s.baseline.includesSimulatedData ? 'Includes simulated history' : undefined} />
          {s.baseline.status !== 'active' && s.baseline.status !== 'disabled' ? <Progress value={baselineProgress} className="mt-1 h-2" /> : null}
          <Separator />
          <StatusRow icon={Cpu} label="AI risk service" value={s.aiServiceAvailable ? 'Available' : 'Unavailable — using rule-based fallback'} tone={s.aiServiceAvailable ? 'ok' : 'warn'} />
          {s.lastAssessment ? (
            <>
              <Separator />
              <StatusRow icon={Activity} label="Last assessment" value={`Score ${Math.round(s.lastAssessment.policyScore)}/100 · confidence ${Math.round(s.lastAssessment.confidence * 100)}%`} hint={`${timeAgo(s.lastAssessment.assessedAt)} · ${s.lastAssessment.source}${s.lastAssessment.simulated ? ' · simulated' : ''}`} />
            </>
          ) : null}
        </CardContent>
      </Card>
      <Text variant="muted" className="text-xs">
        Scores are heuristic indicators, not predictions. SafeTrail does not contact emergency services.
      </Text>
    </Screen>
  );
}
