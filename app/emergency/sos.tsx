import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { CheckCircle2, Clock, Siren } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { describeDelivery, triggerSos, type SosOutcome } from '@/features/sos/sos';
import { useCurrentTrip } from '@/hooks/queries';
import { useMonitoringStore } from '@/store/monitoring-store';
import { showError } from '@/utils/feedback';

const ARM_SECONDS = 3;

/**
 * SOS: a 3-second, cancellable countdown prevents pocket presses; "Send now" skips it.
 * The result shown is what actually happened (sent to server / queued on device).
 */
export default function SosScreen() {
  const qc = useQueryClient();
  const trip = useCurrentTrip();
  const mon = useMonitoringStore();
  const [left, setLeft] = React.useState(ARM_SECONDS);
  const [phase, setPhase] = React.useState<'arming' | 'sending' | 'done'>('arming');
  const [outcome, setOutcome] = React.useState<SosOutcome | null>(null);
  const sentRef = React.useRef(false);

  const send = React.useCallback(async () => {
    if (sentRef.current) return;
    sentRef.current = true;
    setPhase('sending');
    let location = mon.lastSample ? { lat: mon.lastSample.lat, lng: mon.lastSample.lng, accuracyM: mon.lastSample.accuracyM } : null;
    if (!location) {
      // Best effort, bounded: an SOS is never delayed more than ~4 s waiting for GPS.
      try {
        const last = await Promise.race([Location.getLastKnownPositionAsync(), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
        if (last) location = { lat: last.coords.latitude, lng: last.coords.longitude, accuracyM: last.coords.accuracy ?? null };
      } catch {
        /* permission denied — send without location */
      }
    }
    try {
      const result = await triggerSos({
        tripId: trip.data?.id,
        location,
        network: mon.network,
        simulated: mon.source === 'simulated',
      });
      setOutcome(result);
      setPhase('done');
      void qc.invalidateQueries();
    } catch (err) {
      sentRef.current = false;
      setPhase('arming');
      setLeft(ARM_SECONDS);
      showError(err, 'SOS could not be recorded');
    }
  }, [mon.lastSample, mon.network, mon.source, qc, trip.data?.id]);

  React.useEffect(() => {
    if (phase !== 'arming') return;
    if (left <= 0) {
      void send();
      return;
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left, phase, send]);

  if (phase === 'done' && outcome) {
    const sent = outcome.kind === 'sent';
    return (
      <Screen>
        <View className="items-center gap-4 py-8">
          <Icon as={sent ? CheckCircle2 : Clock} size={64} className={sent ? 'text-state-normal' : 'text-state-suspicious'} />
          <Text variant="h3" className="text-center">{sent ? 'Emergency received by SafeTrail' : 'SOS saved on this phone'}</Text>
          <Text className="text-center text-muted-foreground">
            {sent
              ? describeDelivery(outcome.response)
              : `${outcome.reason}. It has NOT reached SafeTrail or your contacts yet. It will be sent automatically when a connection is available — keep the app open if you can.`}
          </Text>
          <Text className="text-center text-sm font-semibold">If you are in immediate danger, call your local emergency number (112 in India).</Text>
        </View>
        {sent ? (
          <Button size="lg" onPress={() => router.replace(`/emergency/${outcome.response.incident.id}`)}>
            <Text>View incident status</Text>
          </Button>
        ) : (
          <Button size="lg" variant="outline" onPress={() => router.replace('/settings/connectivity')}>
            <Text>View queued events</Text>
          </Button>
        )}
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Close</Text>
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="items-center gap-4 py-6">
        <Icon as={Siren} size={64} className="text-sos" />
        <Text variant="h2" className="text-center">{phase === 'sending' ? 'Sending SOS…' : `Sending SOS in ${left}`}</Text>
        <Text className="text-center text-muted-foreground">Your trusted contacts will be alerted with your last known location (if you allowed sharing).</Text>
      </View>
      <Pressable
        onPress={() => void send()}
        disabled={phase === 'sending'}
        accessibilityRole="button"
        accessibilityLabel="Send SOS now"
        className="h-24 items-center justify-center rounded-2xl bg-sos active:opacity-80">
        <Text className="text-2xl font-extrabold text-sos-foreground">Send now</Text>
      </Pressable>
      <Button size="lg" variant="outline" className="h-16" disabled={phase === 'sending'} onPress={() => router.back()}>
        <Text className="text-lg">Cancel</Text>
      </Button>
      {mon.network === 'offline' ? <Text className="text-center text-sm text-state-suspicious">You are offline: the SOS will be queued on this phone.</Text> : null}
    </Screen>
  );
}
