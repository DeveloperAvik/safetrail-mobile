import type { ScenarioRunResult } from '@safetrail/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { View } from 'react-native';
import { ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { StateBadge } from '@/components/state-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { api } from '@/services/api';
import { useMonitoringStore } from '@/store/monitoring-store';
import { useSettingsStore } from '@/store/settings-store';
import { showError } from '@/utils/feedback';

/** Demonstration console. Everything here uses synthetic data, labelled as simulated. */
export default function Simulation() {
  const qc = useQueryClient();
  const scenarios = useQuery({ queryKey: ['simulation'], queryFn: api.simulation.scenarios, retry: false });
  const simulated = useSettingsStore((s) => s.useSimulatedLocation);
  const setSettings = useSettingsStore((s) => s.set);
  const setMon = useMonitoringStore((s) => s.set);
  const [running, setRunning] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ScenarioRunResult | null>(null);

  const run = async (id: string) => {
    setRunning(id);
    setResult(null);
    try {
      setResult(await api.simulation.run(id));
      await qc.invalidateQueries();
    } catch (err) {
      showError(err, 'Scenario failed');
    } finally {
      setRunning(null);
    }
  };

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Simulated location</CardTitle>
          <CardDescription>Replace GPS with synthetic movement toward the trip destination (useful on simulators). Samples are marked “simulated”.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text>Use simulated location</Text>
            <Switch checked={simulated} onCheckedChange={(v) => setSettings({ useSimulatedLocation: v })} />
          </View>
          <Button variant="outline" disabled={!simulated} onPress={() => setMon({ pendingSensorEvent: 'possible_fall' })}>
            <Text>Simulate a possible-fall sensor event</Text>
          </Button>
          <Button variant="outline" onPress={async () => { try { await api.simulation.seedBaseline(); await qc.invalidateQueries(); } catch (err) { showError(err); } }}>
            <Text>Seed simulated baseline history</Text>
          </Button>
        </CardContent>
      </Card>
      {result ? (
        <Card>
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <CardTitle>{result.scenario.replace(/_/g, ' ')}</CardTitle>
              <Badge variant={result.passedExpectation ? 'default' : 'destructive'}><Text>{result.passedExpectation ? 'as expected' : 'unexpected'}</Text></Badge>
            </View>
            <CardDescription>Expected: {result.expectation}</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            {result.steps.map((s, i) => (
              <View key={i} className="flex-row items-center gap-2">
                <Text className="w-16 text-xs text-muted-foreground">{s.step}</Text>
                {['NORMAL', 'DEVIATION', 'SUSPICIOUS', 'POTENTIAL_INCIDENT', 'EMERGENCY'].includes(s.state) ? <StateBadge state={s.state as never} /> : <Text>{s.state}</Text>}
                <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={2}>{s.policyScore !== null ? `${Math.round(s.policyScore)} · ` : ''}{s.note}</Text>
              </View>
            ))}
            <Text className="text-xs">Incidents: {result.incidentIds.length} · alerts: {result.notificationsQueued}</Text>
          </CardContent>
        </Card>
      ) : null}
      {scenarios.isLoading ? <Loading /> : scenarios.error ? <ErrorState error={scenarios.error} /> : null}
      {scenarios.data?.items.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle>{s.title}</CardTitle>
            <CardDescription>{s.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled={running !== null} onPress={() => void run(s.id)}>
              <Text>{running === s.id ? 'Running…' : 'Run scenario'}</Text>
            </Button>
          </CardContent>
        </Card>
      ))}
    </Screen>
  );
}
