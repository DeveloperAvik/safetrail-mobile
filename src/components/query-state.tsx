import { AlertTriangle, Inbox } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/services/api-client';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="items-center gap-3 py-10" accessibilityLiveRegion="polite">
      <ActivityIndicator />
      <Text className="text-muted-foreground">{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View className="items-center gap-3 rounded-xl border border-border bg-card p-6" accessibilityRole="alert">
      <Icon as={AlertTriangle} size={28} className="text-destructive" />
      <Text className="text-center">{errorMessage(error)}</Text>
      {onRetry ? (
        <Button variant="outline" onPress={onRetry}>
          <Text>Try again</Text>
        </Button>
      ) : null}
    </View>
  );
}

export function Empty({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <View className="items-center gap-2 rounded-xl border border-dashed border-border p-8">
      <Icon as={Inbox} size={28} className="text-muted-foreground" />
      <Text className="font-semibold">{title}</Text>
      {body ? <Text className="text-center text-sm text-muted-foreground">{body}</Text> : null}
      {children}
    </View>
  );
}
