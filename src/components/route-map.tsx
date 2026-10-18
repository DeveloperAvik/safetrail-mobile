import type { LocationSample, Trip } from '@safetrail/contracts';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from '@/theme/tokens';

/** Native map: planned corridor (grey dashed), recorded route (blue), last position. */
export function RouteMap({ trip, route }: { trip: Trip; route: LocationSample[] }) {
  const planned = [...(trip.origin ? [trip.origin] : []), ...trip.waypoints, trip.destination].map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const recorded = route.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const focus = recorded.at(-1) ?? planned[0]!;
  return (
    <MapView
      style={{ height: 320, borderRadius: 16 }}
      initialRegion={{ ...focus, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
      accessibilityLabel="Map of planned and recorded route">
      {planned.length > 1 ? <Polyline coordinates={planned} strokeColor={colors.planned} strokeWidth={4} lineDashPattern={[8, 6]} /> : null}
      {recorded.length > 1 ? <Polyline coordinates={recorded} strokeColor={colors.route} strokeWidth={4} /> : null}
      <Marker coordinate={{ latitude: trip.destination.lat, longitude: trip.destination.lng }} title={trip.destination.name} pinColor={colors.primary} />
      {recorded.length ? <Marker coordinate={recorded.at(-1)!} title="Last known position" pinColor={colors.sos} /> : null}
    </MapView>
  );
}
