import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { qk, useSafetyStatus } from '@/hooks/queries';
import { useCountdown } from '@/hooks/use-countdown';
import { api } from '@/services/api';
import { ApiError } from '@/services/api-client';
import { offlineQueue } from '@/services/offline-queue';
import { newId } from '@/utils/ids';
import { showError } from '@/utils/feedback';

/** Check-in / incident confirmation with a visible countdown. Works offline (answer is queued). */
export default function SafetyPrompt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const status = useSafetyStatus();
  const prompt = status.data?.openPrompt?.id === id ? status.data.openPrompt : null;
  const left = useCountdown(prompt?.respondBy);
  const [sending, setSending] = React.useState<'ok' | 'help' | null>(null);
  const [queued, setQueued] = React.useState(false);

  const answer = async (response: 'ok' | 'help') => {
    setSending(response);
    try {
      await api.safety.respond(id, response);
      await qc.invalidateQueries({ queryKey: qk.status });
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.isNetwork) {
        await offlineQueue.enqueue({ type: 'prompt_response', idempotencyKey: newId(), clientCreatedAt: new Date().toISOString(), payload: { promptId: id, response } });
        setQueued(true);
      } else {
        showError(err, 'Could not send your answer');
      }
    } finally {
      setSending(null);
    }
  };

  const confirmation = prompt?.kind === 'incident_confirmation';
  return (
    <Screen>
      <View className="items-center gap-4 py-6">
        <Icon as={confirmation ? ShieldAlert : ShieldCheck} size={56} className={confirmation ? 'text-state-potential' : 'text-state-suspicious'} />
        <Text variant="h3" className="text-center">{confirmation ? 'Are you safe?' : 'Quick check-in'}</Text>
        <Text className="text-center text-muted-foreground">{prompt?.message ?? 'This check is no longer open.'}</Text>
        {left !== null ? (
          <Text className="text-5xl font-bold" accessibilityLiveRegion="polite" accessibilityLabel={`${left} seconds left`}>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </Text>
        ) : null}
        {confirmation && left !== null ? (
          <Text className="text-center text-sm text-muted-foreground">If you do not answer, your trusted contacts will be alerted when the countdown ends.</Text>
        ) : null}
        {queued ? <Text className="text-center text-sm text-state-suspicious">You are offline. Your answer is saved on this phone and will be sent when the connection returns — it has not reached SafeTrail yet.</Text> : null}
      </View>
      <Button size="lg" className="h-16" onPress={() => void answer('ok')} disabled={!prompt || sending !== null}>
        <Text className="text-lg">{sending === 'ok' ? 'Sending…' : "I'm OK"}</Text>
      </Button>
      <Button size="lg" variant="destructive" className="h-16" onPress={() => void answer('help')} disabled={sending !== null}>
        <Text className="text-lg">I need help</Text>
      </Button>
      <Button variant="ghost" onPress={() => router.back()}>
        <Text>Decide later</Text>
      </Button>
    </Screen>
  );
}
