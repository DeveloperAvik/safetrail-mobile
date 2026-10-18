import { router } from 'expo-router';
import { BellRing, CloudOff, Gauge, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSettingsStore } from '@/store/settings-store';

const POINTS = [
  { icon: Gauge, title: 'Learns your normal', body: 'SafeTrail builds a personal baseline from your trips, so unusual moments stand out without treating every detour as an emergency.' },
  { icon: BellRing, title: 'Graduated response', body: 'A reminder first, then a check-in, then a countdown. Contacts are alerted only if you do not respond or you press SOS.' },
  { icon: CloudOff, title: 'Works with weak signal', body: 'If you are offline, your SOS is stored securely on the phone and sent as soon as a connection returns.' },
  { icon: ShieldCheck, title: 'You stay in control', body: 'Location is collected only during trips you start, only with your consent, and you can stop or delete it at any time.' },
];

export default function Onboarding() {
  const set = useSettingsStore((s) => s.set);
  const finish = (to: '/login' | '/register') => {
    set({ onboardingSeen: true });
    router.replace(to);
  };
  return (
    <Screen className="pt-16">
      <View className="gap-2">
        <Text variant="h1" className="text-left text-primary">SafeTrail</Text>
        <Text variant="lead">Personal, connectivity-aware safety for travellers.</Text>
      </View>
      {POINTS.map((p) => (
        <Card key={p.title}>
          <CardContent className="flex-row gap-4">
            <Icon as={p.icon} size={26} className="text-primary" />
            <View className="flex-1 gap-1">
              <Text className="font-semibold">{p.title}</Text>
              <Text className="text-sm text-muted-foreground">{p.body}</Text>
            </View>
          </CardContent>
        </Card>
      ))}
      <Text variant="muted">
        Academic prototype. SafeTrail does not contact police, ambulance or government emergency services. In an emergency, call your local emergency number.
      </Text>
      <Button size="lg" onPress={() => finish('/register')}>
        <Text>Create an account</Text>
      </Button>
      <Button size="lg" variant="outline" onPress={() => finish('/login')}>
        <Text>I already have an account</Text>
      </Button>
    </Screen>
  );
}
