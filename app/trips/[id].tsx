import { TRIP_TRANSITIONS, type TripAction } from '@safetrail/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, Loading } from '@/components/query-state';
import { RouteMap } from '@/components/route-map';
import { Screen } from '@/components/screen';
import { SosButton } from '@/components/sos-button';
import { StateBadge } from '@/components/state-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { qk } from '@/hooks/queries';
import { api } from '@/services/api';
import { formatDateTime, timeAgo } from '@/utils/format';
import { showError } from '@/utils/feedback';

const ACTIONS: Array<{ action: TripAction; label: string; to: 'active' | 'paused' | 'completed' | 'cancelled' }> = [
  { action: 'start', label: 'Start', to: 'active' },
  { action: 'pause', label: 'Pause', to: 'paused' },
  { action: 'resume', label: 'Resume', to: 'active' },
  { action: 'complete', label: 'Complete', to: 'completed' },
  { action: 'cancel', label: 'Cancel trip', to: 'cancelled' },
];

export default function TripDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const trip = useQuery({ queryKey: qk.trip(id), queryFn: () => api.trips.get(id), refetchInterval: 15_000 });
  const route = useQuery({ queryKey: qk.route(id), queryFn: () => api.trips.route(id), refetchInterval: 15_000 });
  const transitions = useQuery({ queryKey: qk.transitions(id), queryFn: () => api.trips.transitions(id) });

  if (trip.isLoading) return <Loading />;
  if (trip.error || !trip.data) return <Screen><ErrorState error={trip.error} onRetry={() => void trip.refetch()} /></Screen>;
  const t = trip.data;
  const allowed = TRIP_TRANSITIONS[t.status];
  const valid = ACTIONS.filter((a) => allowed.includes(a.to) && !(a.action === 'resume' && t.status !== 'paused') && !(a.action === 'start' && t.status !== 'planned'));

  const run = async (action: TripAction) => {
    try {
      await api.trips.transition(t.id, action);
      await qc.invalidateQueries();
    } catch (err) {
      showError(err, 'Could not update trip');
    }
  };

  return (
    <Screen onRefresh={() => void qc.invalidateQueries({ queryKey: ['trips', id] })}>
      <View className="flex-row items-center justify-between">
        <Text variant="h4" className="flex-1">{t.title}</Text>
        <Badge variant="secondary"><Text>{t.status}</Text></Badge>
      </View>
      <RouteMap trip={t} route={route.data?.items ?? []} />
      <Card>
        <CardContent className="gap-1">
          <Text>To <Text className="font-semibold">{t.destination.name}</Text></Text>
          <Text className="text-sm text-muted-foreground">Planned {formatDateTime(t.plannedDepartureAt)} → {formatDateTime(t.plannedArrivalAt)}</Text>
          <Text className="text-sm text-muted-foreground">
            {t.sampleCount} samples · last update {timeAgo(t.lastKnownLocation?.recordedAt)} · corridor {t.corridorWidthM} m
            {t.checkInIntervalMin ? ` · check-in every ${t.checkInIntervalMin} min` : ''}
          </Text>
          {t.status === 'active' && t.checkInIntervalMin ? (
            <Button variant="outline" className="mt-2" onPress={async () => { try { await api.trips.checkIn(t.id); await qc.invalidateQueries(); } catch (err) { showError(err); } }}>
              <Text>Check in now — I'm OK</Text>
            </Button>
          ) : null}
        </CardContent>
      </Card>
      {valid.length ? (
        <View className="flex-row flex-wrap gap-2">
          {valid.map((a) => (
            <Button key={a.action} variant={a.action === 'cancel' ? 'outline' : 'secondary'} onPress={() => void run(a.action)}>
              <Text>{a.label}</Text>
            </Button>
          ))}
        </View>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Safety-state history</CardTitle></CardHeader>
        <CardContent className="gap-3">
          {transitions.data?.items.length ? (
            transitions.data.items.map((tr) => (
              <View key={tr.id} className="gap-1">
                <View className="flex-row items-center gap-2">
                  <StateBadge state={tr.to} />
                  <Text className="text-xs text-muted-foreground">{formatDateTime(tr.createdAt)} · {tr.trigger.replace(/_/g, ' ')}</Text>
                </View>
                <Text className="text-sm text-muted-foreground">{tr.reason}</Text>
              </View>
            ))
          ) : (
            <Text className="text-sm text-muted-foreground">No state changes recorded.</Text>
          )}
        </CardContent>
      </Card>
      {t.status === 'active' ? <SosButton compact /> : null}
    </Screen>
  );
}
