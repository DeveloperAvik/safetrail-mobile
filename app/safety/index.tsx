import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SosButton } from '@/components/sos-button';
import { StateBadge } from '@/components/state-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { monitoring } from '@/features/tracking/monitoring-controller';
import { useSafetyStatus } from '@/hooks/queries';
import { useMonitoringStore } from '@/store/monitoring-store';
import { SIGNAL_LABEL, STATE_META } from '@/theme/tokens';
import { formatCoord, timeAgo } from '@/utils/format';

/** Active monitoring + safety-state details: what the system sees and why. */
export default function MonitoringDetails() {
  const qc = useQueryClient();
  const status = useSafetyStatus();
  const mon = useMonitoringStore();
  if (status.isLoading || !status.data) return <Loading />;
  const s = status.data;
  const a = s.lastAssessment;
  return (
    <Screen onRefresh={() => void qc.invalidateQueries()}>
      <ConnectivityBanner />
      <Card>
        <CardHeader>
          <StateBadge state={s.state} size="lg" />
          <CardDescription className="mt-2">{STATE_META[s.state].summary}</CardDescription>
          {s.reason ? <Text className="text-sm text-muted-foreground">{s.reason}</Text> : null}
          {s.since ? <Text className="text-xs text-muted-foreground">Since {timeAgo(s.since)}</Text> : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest assessment</CardTitle>
          <CardDescription>A heuristic score from 0 to 100 — not a probability that something is wrong.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {a ? (
            <>
              <View className="gap-1">
                <Text className="text-sm">Risk score {Math.round(a.policyScore)}/100</Text>
                <Progress value={a.policyScore} className="h-2" />
              </View>
              <View className="gap-1">
                <Text className="text-sm">Confidence {Math.round(a.confidence * 100)}%</Text>
                <Progress value={a.confidence * 100} className="h-2" />
              </View>
              <Text className="text-xs text-muted-foreground">Model {a.modelVersion} ({a.source === 'fallback' ? 'deterministic fallback — AI unavailable' : 'AI service'}) · {timeAgo(a.assessedAt)}</Text>
              {a.signals.length ? (
                a.signals.map((sig) => (
                  <View key={sig.code} className="flex-row items-start gap-2">
                    <Badge variant={sig.strength === 'strong' ? 'destructive' : 'secondary'}><Text>{sig.strength}</Text></Badge>
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{SIGNAL_LABEL[sig.code] ?? sig.code} (+{Math.round(sig.points)})</Text>
                      <Text className="text-xs text-muted-foreground">{sig.description}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-sm text-muted-foreground">No risk signals.</Text>
              )}
              {a.warnings.length ? <Text className="text-xs text-muted-foreground">Data quality: {a.warnings.join(', ').toLowerCase().replace(/_/g, ' ')}</Text> : null}
            </>
          ) : (
            <Text className="text-sm text-muted-foreground">No assessment yet. Start a trip with monitoring enabled.</Text>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Device</CardTitle></CardHeader>
        <CardContent className="gap-1">
          <Text className="text-sm">Collection: {mon.active ? `active (${mon.source})` : 'stopped'}</Text>
          <Text className="text-sm">Background: {mon.backgroundActive ? 'enabled' : 'foreground only'}</Text>
          <Text className="text-sm">Permission: {mon.permission}</Text>
          <Text className="text-sm">Last sample: {mon.lastSample ? `${formatCoord(mon.lastSample.lat, mon.lastSample.lng)} · ±${mon.lastSample.accuracyM ?? '?'} m · ${timeAgo(mon.lastSample.recordedAt)}` : '—'}</Text>
          <Text className="text-sm">Last upload: {timeAgo(mon.lastUploadAt)}</Text>
          {mon.lastError ? <Text className="text-sm text-destructive">{mon.lastError}</Text> : null}
          <Button variant="outline" className="mt-2" onPress={() => void monitoring.syncNow()}>
            <Text>Sync now</Text>
          </Button>
        </CardContent>
      </Card>
      <Button variant="ghost" onPress={() => router.push('/settings/consent')}>
        <Text>Stop or change monitoring</Text>
      </Button>
      <SosButton compact />
    </Screen>
  );
}
