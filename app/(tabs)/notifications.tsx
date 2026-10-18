import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Empty, ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { qk } from '@/hooks/queries';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/utils/format';

const STATUS_LABEL: Record<string, string> = {
  queued: 'queued',
  sent: 'accepted by provider',
  delivered: 'delivered',
  failed: 'failed',
  cancelled: 'cancelled',
};

/** Notification history: in-app messages to you and the delivery status of alerts to contacts. */
export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.notifications, queryFn: api.notifications.list, refetchInterval: 15_000 });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Button variant="outline" onPress={() => router.push('/emergency')}><Text>Incident history</Text></Button>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <Empty title="No notifications" /> : null}
      {q.data?.items.map((n) => (
        <Pressable
          key={n.id}
          onPress={async () => {
            if (n.channel === 'in_app' && !n.readAt) {
              await api.notifications.read(n.id).catch(() => undefined);
              void qc.invalidateQueries({ queryKey: qk.notifications });
            }
            if (n.incidentId) router.push(`/emergency/${n.incidentId}`);
          }}>
          <Card className={cn(n.channel === 'in_app' && !n.readAt && 'border-primary')}>
            <CardContent className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-semibold">{n.title}</Text>
                <Badge variant={n.status === 'failed' ? 'destructive' : 'secondary'}><Text>{n.channel === 'in_app' ? 'in app' : `${n.channel} · ${STATUS_LABEL[n.status]}`}</Text></Badge>
              </View>
              <Text className="text-sm text-muted-foreground" numberOfLines={3}>{n.body}</Text>
              <Text className="text-xs text-muted-foreground">
                {n.recipientLabel === 'You' ? '' : `To ${n.recipientLabel} · `}{timeAgo(n.createdAt)}{n.attempts > 1 ? ` · ${n.attempts} attempts` : ''}{n.lastError ? ` · ${n.lastError}` : ''}
              </Text>
            </CardContent>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
