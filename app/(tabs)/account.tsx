import { router, type Href } from 'expo-router';
import { ChevronRight, FlaskConical, Lock, LogOut, ShieldCheck, User, Wifi } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/auth-store';
import { confirm, notify, showError } from '@/utils/feedback';

const LINKS: Array<{ href: Href; icon: typeof User; label: string; hint: string }> = [
  { href: '/settings/profile', icon: User, label: 'Profile & emergency info', hint: 'Name, phone, notes for responders' },
  { href: '/settings/consent', icon: ShieldCheck, label: 'Consent & monitoring', hint: 'What SafeTrail may collect and when' },
  { href: '/settings/privacy', icon: Lock, label: 'Privacy & baseline', hint: 'Retention, baseline reset' },
  { href: '/settings/connectivity', icon: Wifi, label: 'Connectivity & offline queue', hint: 'Queued events and sync status' },
  { href: '/settings/simulation', icon: FlaskConical, label: 'Demo scenarios', hint: 'Synthetic data only' },
];

export default function Account() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [deletePw, setDeletePw] = React.useState('');

  return (
    <Screen>
      <View>
        <Text variant="h4">{user?.displayName}</Text>
        <Text className="text-muted-foreground">{user?.email}</Text>
      </View>
      <Card>
        <CardContent>
          {LINKS.map((l, i) => (
            <View key={l.label}>
              {i > 0 ? <Separator /> : null}
              <Pressable onPress={() => router.push(l.href)} className="flex-row items-center gap-3 py-3" accessibilityRole="button">
                <Icon as={l.icon} size={20} className="text-primary" />
                <View className="flex-1">
                  <Text className="font-medium">{l.label}</Text>
                  <Text className="text-xs text-muted-foreground">{l.hint}</Text>
                </View>
                <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
              </Pressable>
            </View>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-2">
          <Text className="font-semibold">Change password</Text>
          <Input placeholder="Current password" secureTextEntry value={current} onChangeText={setCurrent} />
          <Input placeholder="New password (10+ chars, letter and digit)" secureTextEntry value={next} onChangeText={setNext} />
          <Button
            variant="outline"
            onPress={async () => {
              try {
                await api.auth.changePassword(current, next);
                setCurrent('');
                setNext('');
                notify('Password changed', 'Other devices were signed out.');
              } catch (err) {
                showError(err, 'Password not changed');
              }
            }}>
            <Text>Update password</Text>
          </Button>
        </CardContent>
      </Card>
      <Button variant="secondary" onPress={() => void signOut()}>
        <Icon as={LogOut} size={18} />
        <Text>Sign out</Text>
      </Button>
      <Card className="border-destructive">
        <CardContent className="gap-2">
          <Text className="font-semibold text-destructive">Delete account</Text>
          <Text className="text-sm text-muted-foreground">Permanently deletes your trips, locations, baseline, contacts and incidents. Resolve any open emergency first.</Text>
          <Input placeholder="Password" secureTextEntry value={deletePw} onChangeText={setDeletePw} />
          <Button
            variant="destructive"
            onPress={async () => {
              if (!(await confirm('Delete account?', 'This cannot be undone.', 'Delete', true))) return;
              try {
                await api.users.deleteMe(deletePw);
                await signOut({ wipeLocalData: true });
              } catch (err) {
                showError(err, 'Account not deleted');
              }
            }}>
            <Text>Delete my account</Text>
          </Button>
        </CardContent>
      </Card>
    </Screen>
  );
}
