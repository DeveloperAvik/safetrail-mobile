import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Empty, ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { qk } from '@/hooks/queries';
import { api } from '@/services/api';
import { formatDateTime } from '@/utils/format';

export default function Incidents() {
  const q = useQuery({ queryKey: qk.incidents, queryFn: api.incidents.list });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <Empty title="No incidents" body="SOS alerts and confirmed incidents appear here." /> : null}
      {q.data?.items.map((i) => (
        <Pressable key={i.id} onPress={() => router.push(`/emergency/${i.id}`)} accessibilityRole="button">
          <Card>
            <CardContent className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-semibold">{i.type === 'manual_sos' ? 'Manual SOS' : 'Automated incident'}{i.simulated ? ' (simulated)' : ''}</Text>
                <Text className="text-sm text-muted-foreground">{formatDateTime(i.createdAt)} · {i.delivery.delivered}/{i.delivery.total} alerts delivered</Text>
              </View>
              <Badge variant={['active', 'pending_confirmation'].includes(i.status) ? 'destructive' : 'secondary'}><Text>{i.status.replace('_', ' ')}</Text></Badge>
            </CardContent>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
