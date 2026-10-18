import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
const TONE: Record<Tone, string> = {
  ok: 'text-state-normal',
  warn: 'text-state-suspicious',
  bad: 'text-state-emergency',
  neutral: 'text-muted-foreground',
};

export function StatusRow({ icon, label, value, tone = 'neutral', hint }: { icon: LucideIcon; label: string; value: string; tone?: Tone; hint?: string }) {
  return (
    <View className="flex-row items-center gap-3 py-2" accessible accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}>
      <Icon as={icon} size={20} className={TONE[tone]} />
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground">{label}</Text>
        <Text className="font-medium">{value}</Text>
        {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
    </View>
  );
}
