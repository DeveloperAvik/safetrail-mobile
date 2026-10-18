import { router } from 'expo-router';
import { Siren } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Always-visible SOS entry point: large (≥72 pt), high-contrast, one tap away. */
export function SosButton({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Emergency SOS"
      accessibilityHint="Opens the SOS screen to alert your trusted contacts"
      onPress={() => router.push('/emergency/sos')}
      className={cn('flex-row items-center justify-center gap-3 rounded-2xl bg-sos active:opacity-80', compact ? 'h-14 px-5' : 'h-20 px-6')}>
      <Icon as={Siren} size={compact ? 22 : 30} className="text-sos-foreground" />
      <View>
        <Text className={cn('font-extrabold tracking-wide text-sos-foreground', compact ? 'text-lg' : 'text-2xl')}>SOS</Text>
        {!compact && <Text className="text-xs text-sos-foreground/90">Works without AI and while offline</Text>}
      </View>
    </Pressable>
  );
}
