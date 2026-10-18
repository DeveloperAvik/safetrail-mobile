import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Empty, ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { qk } from '@/hooks/queries';
import { api } from '@/services/api';
import { formatDateTime } from '@/utils/format';

export default function TripHistory() {
  const trips = useQuery({ queryKey: qk.trips, queryFn: () => api.trips.list() });
  return (
    <Screen onRefresh={() => void trips.refetch()} refreshing={trips.isRefetching}>
      <Button onPress={() => router.push('/trips/new')}>
        <Icon as={Plus} size={18} className="text-primary-foreground" />
        <Text>Plan a new trip</Text>
      </Button>
      {trips.isLoading ? <Loading /> : trips.error ? <ErrorState error={trips.error} onRetry={() => void trips.refetch()} /> : null}
      {trips.data && trips.data.items.length === 0 ? <Empty title="No trips yet" body="Plan a trip with a destination and optional stops. Monitoring runs only while a trip is active." /> : null}
      {trips.data?.items.map((t) => (
        <Pressable key={t.id} onPress={() => router.push(`/trips/${t.id}`)} accessibilityRole="button" accessibilityLabel={`${t.title}, ${t.status}`}>
          <Card>
            <CardContent className="flex-row items-center gap-3">
              <View className="flex-1 gap-1">
                <Text className="font-semibold">{t.title}</Text>
                <Text className="text-sm text-muted-foreground">To {t.destination.name} · {formatDateTime(t.startedAt ?? t.plannedDepartureAt)}</Text>
                <Text className="text-xs text-muted-foreground">{t.sampleCount} location samples</Text>
              </View>
              <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                <Text>{t.status}</Text>
              </Badge>
              <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
            </CardContent>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
