import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { View } from 'react-native';
import { Empty, ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { qk, useContacts } from '@/hooks/queries';
import { api } from '@/services/api';
import { confirm, showError } from '@/utils/feedback';

export default function Contacts() {
  const qc = useQueryClient();
  const q = useContacts();
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.contacts });
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      refresh();
    } catch (err) {
      showError(err);
    }
  };
  return (
    <Screen onRefresh={refresh} refreshing={q.isRefetching}>
      <Text variant="muted">
        Trusted contacts are alerted only during an incident, with the minimum information needed. They never get access to your account.
      </Text>
      <Button onPress={() => router.push('/contacts/new')} disabled={(q.data?.items.length ?? 0) >= 5}>
        <Icon as={UserPlus} size={18} className="text-primary-foreground" />
        <Text>Add trusted contact</Text>
      </Button>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={refresh} /> : null}
      {q.data?.items.length === 0 ? <Empty title="No trusted contacts" body="Without a verified contact, SOS alerts cannot reach anyone." /> : null}
      {q.data?.items.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <CardTitle>{c.name}</CardTitle>
              <Badge variant={c.verificationStatus === 'verified' ? 'default' : c.verificationStatus === 'revoked' ? 'destructive' : 'secondary'}>
                <Text>{c.verificationStatus}</Text>
              </Badge>
            </View>
            <CardDescription>{[c.relationship, c.phoneMasked, c.emailMasked].filter(Boolean).join(' · ')} · via {c.preferredChannel}</CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm">Also notify for possible incidents (before confirmation)</Text>
              <Switch checked={c.notifyOnPotentialIncident} onCheckedChange={(v) => void act(() => api.contacts.update(c.id, { notifyOnPotentialIncident: v }))} disabled={c.verificationStatus === 'revoked'} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm">{c.liveShareUntil ? `Sharing live trip location until ${new Date(c.liveShareUntil).toLocaleString()}` : 'Live location sharing off'}</Text>
              <Switch
                checked={Boolean(c.liveShareUntil)}
                disabled={c.verificationStatus !== 'verified'}
                onCheckedChange={(v) => void act(() => api.contacts.update(c.id, { liveShareUntil: v ? new Date(Date.now() + 4 * 3_600_000).toISOString() : null, shareScope: v ? 'active_trip' : 'incident_only' }))}
              />
            </View>
            <View className="flex-row flex-wrap gap-2">
              {c.verificationStatus !== 'verified' ? (
                <Button size="sm" variant="outline" onPress={() => void act(() => api.contacts.invite(c.id))}><Text>Resend invitation</Text></Button>
              ) : null}
              {c.verificationStatus !== 'revoked' ? (
                <Button size="sm" variant="outline" onPress={async () => (await confirm('Revoke access', `${c.name} will stop receiving alerts and any shared links stop working.`, 'Revoke', true)) && act(() => api.contacts.revoke(c.id))}>
                  <Text>Revoke</Text>
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onPress={async () => (await confirm('Remove contact', `Remove ${c.name}?`, 'Remove', true)) && act(() => api.contacts.remove(c.id))}>
                <Text>Remove</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      ))}
    </Screen>
  );
}
