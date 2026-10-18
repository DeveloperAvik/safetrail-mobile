import { OPEN_INCIDENT_STATUSES } from '@safetrail/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { qk } from '@/hooks/queries';
import { api } from '@/services/api';
import { confirm, showError } from '@/utils/feedback';
import { formatCoord, formatDateTime } from '@/utils/format';

export default function IncidentDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.incident(id), queryFn: () => api.incidents.get(id), refetchInterval: 5_000 });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  const i = q.data;
  const open = OPEN_INCIDENT_STATUSES.includes(i.status);

  const close = async (outcome: 'resolved' | 'cancelled' | 'false_alarm') => {
    const labels = { resolved: 'I am safe now', cancelled: 'Cancel this alert', false_alarm: 'Mark as false alarm' } as const;
    if (!(await confirm(labels[outcome], 'Your trusted contacts will be told the alert is over.', 'Yes'))) return;
    try {
      await api.incidents.resolve(i.id, { outcome });
      await qc.invalidateQueries();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <Screen onRefresh={() => void q.refetch()}>
      <View className="flex-row items-center justify-between">
        <Text variant="h4">{i.type === 'manual_sos' ? 'Manual SOS' : 'Automated incident'}</Text>
        <Badge variant={open ? 'destructive' : 'secondary'}><Text>{i.status.replace('_', ' ')}</Text></Badge>
      </View>
      {i.simulated ? <Text className="text-sm text-state-suspicious">Simulated — demo data, not a real emergency.</Text> : null}
      <Card>
        <CardHeader><CardTitle>Alert delivery</CardTitle></CardHeader>
        <CardContent className="gap-1">
          {i.delivery.total === 0 ? (
            <Text className="text-sm">No trusted contacts were notified (none verified, or not required yet).</Text>
          ) : (
            <>
              <Text className="text-sm">Delivered (provider confirmed): {i.delivery.delivered}</Text>
              <Text className="text-sm">Accepted, not yet confirmed: {i.delivery.sent}</Text>
              <Text className="text-sm">Queued / retrying: {i.delivery.queued}</Text>
              <Text className={i.delivery.failed ? 'text-sm text-destructive' : 'text-sm'}>Failed: {i.delivery.failed}</Text>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-1">
          <Text className="text-sm">Created {formatDateTime(i.createdAt)}{i.origin === 'offline_sync' ? ` (pressed offline at ${formatDateTime(i.clientCreatedAt)})` : ''}</Text>
          <Text className="text-sm">Reason: {i.triggerReason}</Text>
          {i.location ? <Text className="text-sm">Location: {formatCoord(i.location.lat, i.location.lng)}{i.location.accuracyM ? ` ±${Math.round(i.location.accuracyM)} m` : ''}</Text> : <Text className="text-sm">No location attached.</Text>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent className="gap-2">
          {[...i.events].reverse().map((e, idx) => (
            <View key={`${e.at}-${idx}`}>
              <Text className="text-xs text-muted-foreground">{formatDateTime(e.at)} · {e.actor}</Text>
              <Text className="text-sm">{e.message}</Text>
            </View>
          ))}
        </CardContent>
      </Card>
      {open ? (
        <View className="gap-2">
          <Button size="lg" onPress={() => void close('resolved')}><Text>I am safe — resolve</Text></Button>
          <Button variant="outline" onPress={() => void close('cancelled')}><Text>Cancel alert</Text></Button>
          <Button variant="ghost" onPress={() => void close('false_alarm')}><Text>It was a false alarm</Text></Button>
        </View>
      ) : null}
    </Screen>
  );
}
