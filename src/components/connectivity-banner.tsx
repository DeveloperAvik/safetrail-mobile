import { router } from 'expo-router';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useMonitoringStore } from '@/store/monitoring-store';

/** Shown whenever the device is offline or events are waiting to be synchronised. */
export function ConnectivityBanner() {
  const network = useMonitoringStore((s) => s.network);
  const queue = useMonitoringStore((s) => s.queue);
  if (network !== 'offline' && queue.pending === 0 && queue.failed === 0) return null;
  const offline = network === 'offline';
  return (
    <Pressable onPress={() => router.push('/settings/connectivity')} accessibilityRole="button">
      <View className="flex-row items-center gap-3 rounded-xl border border-state-suspicious bg-state-suspicious/10 p-3">
        <Icon as={offline ? CloudOff : RefreshCw} size={18} className="text-state-suspicious" />
        <Text className="flex-1 text-sm">
          {offline ? 'Offline. ' : ''}
          {queue.pendingSos ? `${queue.pendingSos} SOS waiting to be sent — not yet delivered. ` : ''}
          {queue.pending ? `${queue.pending} item(s) queued on this device.` : offline ? 'New data will be queued.' : ''}
          {queue.failed ? ` ${queue.failed} failed.` : ''}
        </Text>
      </View>
    </Pressable>
  );
}
