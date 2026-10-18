import type { LocationSample, Trip } from '@safetrail/contracts';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { formatCoord } from '@/utils/format';

/** react-native-maps has no web implementation; show a textual summary instead. */
export function RouteMap({ trip, route }: { trip: Trip; route: LocationSample[] }) {
  const last = route.at(-1);
  return (
    <View className="gap-1 rounded-xl border border-border bg-muted p-4">
      <Text className="font-medium">Map is available on iOS/Android</Text>
      <Text className="text-sm text-muted-foreground">Destination: {formatCoord(trip.destination.lat, trip.destination.lng)}</Text>
      <Text className="text-sm text-muted-foreground">{route.length} recorded points{last ? `, last at ${formatCoord(last.lat, last.lng)}` : ''}</Text>
    </View>
  );
}
