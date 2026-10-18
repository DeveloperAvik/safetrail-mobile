import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { qk, useBaseline, useProfile } from '@/hooks/queries';
import { api } from '@/services/api';
import { confirm, showError } from '@/utils/feedback';

const RETENTION = [7, 30, 90];

export default function Privacy() {
  const qc = useQueryClient();
  const profile = useProfile();
  const baseline = useBaseline();
  if (profile.isLoading || baseline.isLoading) return <Loading />;
  const p = profile.data!;
  const b = baseline.data!;
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: qk.profile });
      await qc.invalidateQueries({ queryKey: qk.baseline });
    } catch (err) {
      showError(err);
    }
  };
  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Location history retention</CardTitle>
          <CardDescription>Raw location samples are deleted automatically after this period.</CardDescription>
        </CardHeader>
        <CardContent className="flex-row gap-2">
          {RETENTION.map((d) => (
            <Button key={d} variant={p.privacy.locationRetentionDays === d ? 'default' : 'outline'} onPress={() => void run(() => api.profile.update({ privacy: { locationRetentionDays: d } }))}>
              <Text>{d} days</Text>
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Personal baseline: {b.status.replace('_', ' ')}</CardTitle>
          <CardDescription>
            Built from {b.sampleCount} samples{b.includesSimulatedData ? ' (includes simulated demo history)' : ''}. A small number of samples is not a reliable profile, so it is used cautiously until “active”.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-2">
          {b.status !== 'active' ? <Progress value={Math.min(100, (b.sampleCount / b.requirements.activeAt) * 100)} className="h-2" /> : null}
          <View className="gap-1">
            <Text className="text-sm">Typical walking speed: {b.typicalSpeedMps ? `${b.typicalSpeedMps} m/s` : '—'}</Text>
            <Text className="text-sm">Typical stop: {b.typicalStationaryMin ? `${b.typicalStationaryMin} min` : '—'}</Text>
            <Text className="text-sm">Familiar areas: {b.familiarCellCount} (≈1 km grid cells, no exact addresses)</Text>
          </View>
          <Button variant="outline" onPress={() => void run(() => api.baseline.setEnabled(b.status === 'disabled'))}>
            <Text>{b.status === 'disabled' ? 'Enable baseline learning' : 'Disable baseline'}</Text>
          </Button>
          <Button variant="ghost" onPress={async () => (await confirm('Reset baseline?', 'All learned statistics will be deleted.', 'Reset', true)) && run(api.baseline.reset)}>
            <Text>Reset baseline</Text>
          </Button>
        </CardContent>
      </Card>
    </Screen>
  );
}
