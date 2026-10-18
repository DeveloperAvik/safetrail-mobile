import type { SafetyState } from '@safetrail/contracts';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { STATE_META } from '@/theme/tokens';

export function StateBadge({ state, size = 'sm' }: { state: SafetyState; size?: 'sm' | 'lg' }) {
  const meta = STATE_META[state];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Safety state: ${meta.label}`}
      className={cn('flex-row items-center gap-2 self-start rounded-full', meta.className, size === 'lg' ? 'px-4 py-2' : 'px-3 py-1')}>
      <View className={cn('h-2 w-2 rounded-full', state === 'SUSPICIOUS' ? 'bg-neutral-950' : 'bg-white')} />
      {/* Amber needs dark text for WCAG contrast; the other states use white. */}
      <Text className={cn('font-semibold', state === 'SUSPICIOUS' ? 'text-neutral-950' : 'text-white', size === 'lg' ? 'text-base' : 'text-xs')}>{meta.label}</Text>
    </View>
  );
}
