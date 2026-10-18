import * as React from 'react';
import { View } from 'react-native';
import { Empty } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { monitoring } from '@/features/tracking/monitoring-controller';
import { offlineQueue, type QueueItem } from '@/services/offline-queue';
import { config } from '@/services/config';
import { useMonitoringStore } from '@/store/monitoring-store';
import { formatDateTime } from '@/utils/format';

const LABEL: Record<string, string> = { sos: 'SOS', location_batch: 'Location batch', prompt_response: 'Safety answer', check_in: 'Check-in' };

export default function Connectivity() {
  const network = useMonitoringStore((s) => s.network);
  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const load = React.useCallback(async () => setItems((await offlineQueue.list()).reverse()), []);
  React.useEffect(() => {
    void load();
    return offlineQueue.subscribe(() => void load());
  }, [load]);

  return (
    <Screen onRefresh={() => void load()}>
      <Card>
        <CardHeader>
          <CardTitle>Network: {network}</CardTitle>
          <CardDescription>Server {config.apiUrl}. Queued items are sent automatically when connectivity returns or the app comes back to the foreground. Delivery is not possible while the phone keeps the app closed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            disabled={syncing}
            onPress={async () => {
              setSyncing(true);
              await monitoring.syncNow().catch(() => undefined);
              setSyncing(false);
            }}>
            <Text>{syncing ? 'Syncing…' : 'Sync now'}</Text>
          </Button>
        </CardContent>
      </Card>
      {items.length === 0 ? <Empty title="Nothing queued" body="Events recorded offline appear here until the server confirms them." /> : null}
      {items.map((i) => (
        <Card key={i.event.idempotencyKey}>
          <CardContent className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold">{LABEL[i.event.type]}</Text>
              <Badge variant={i.status === 'failed' ? 'destructive' : i.status === 'synced' ? 'default' : 'secondary'}>
                <Text>{i.status === 'pending' ? 'waiting — not yet received' : i.status === 'synced' ? 'received by server' : 'rejected'}</Text>
              </Badge>
            </View>
            <Text className="text-xs text-muted-foreground">Recorded {formatDateTime(i.event.clientCreatedAt)} · {i.attempts} attempt(s)</Text>
            {i.message ? <Text className="text-xs">{i.message}</Text> : null}
            {i.lastError && i.status !== 'synced' ? <Text className="text-xs text-destructive">{i.lastError}</Text> : null}
          </CardContent>
        </Card>
      ))}
    </Screen>
  );
}
