import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { api } from '@/services/api';
import { showError } from '@/utils/feedback';

const num = (min: number, max: number, msg: string) =>
  z.string().trim().refine((v) => v !== '' && !Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max, msg);

const schema = z.object({
  title: z.string().trim().min(1, 'Give the trip a name').max(120),
  originName: z.string().trim().max(120),
  originLat: z.string().trim(),
  originLng: z.string().trim(),
  destinationName: z.string().trim().min(1, 'Where are you going?').max(120),
  destinationLat: num(-90, 90, 'Latitude between -90 and 90'),
  destinationLng: num(-180, 180, 'Longitude between -180 and 180'),
  durationHours: num(0.25, 72, 'Between 0.25 and 72 hours'),
  checkInIntervalMin: num(0, 1440, '0 (off) to 1440 minutes'),
  corridorWidthM: num(100, 20000, '100 to 20000 metres'),
});
type Form = z.infer<typeof schema>;

/** Example values are the simulated demo route (Jaipur). Users can type any coordinates. */
export default function NewTrip() {
  const qc = useQueryClient();
  const { control, handleSubmit, setValue, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: 'Old city walk',
      originName: 'Hawa Mahal',
      originLat: '26.9239',
      originLng: '75.8267',
      destinationName: 'Jal Mahal',
      destinationLat: '26.9535',
      destinationLng: '75.8462',
      durationHours: '3',
      checkInIntervalMin: '0',
      corridorWidthM: '1500',
    },
  });

  const useCurrentLocation = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return showError(new Error('denied'), 'Location permission is needed to use your position');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setValue('originName', 'Current location');
    setValue('originLat', pos.coords.latitude.toFixed(5));
    setValue('originLng', pos.coords.longitude.toFixed(5));
  };

  const submit = (start: boolean) =>
    handleSubmit(async (v) => {
      const now = Date.now();
      const hasOrigin = v.originLat !== '' && v.originLng !== '';
      try {
        const trip = await api.trips.create({
          title: v.title,
          origin: hasOrigin ? { name: v.originName || 'Start', lat: Number(v.originLat), lng: Number(v.originLng) } : undefined,
          destination: { name: v.destinationName, lat: Number(v.destinationLat), lng: Number(v.destinationLng) },
          waypoints: [],
          plannedDepartureAt: new Date(now).toISOString(),
          plannedArrivalAt: new Date(now + Number(v.durationHours) * 3_600_000).toISOString(),
          checkInIntervalMin: Number(v.checkInIntervalMin),
          corridorWidthM: Number(v.corridorWidthM),
          timezoneOffsetMin: -new Date().getTimezoneOffset(),
        });
        if (start) await api.trips.transition(trip.id, 'start');
        await qc.invalidateQueries();
        router.replace(start ? '/(tabs)' : `/trips/${trip.id}`);
      } catch (err) {
        showError(err, 'Could not create trip');
      }
    })();

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Trip</CardTitle>
          <CardDescription>The planned route defines a corridor; leaving it counts as a deviation, not an emergency.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <FormField control={control} name="title" label="Trip name" />
          <FormField control={control} name="durationHours" label="Expected duration (hours)" keyboardType="decimal-pad" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>From (optional)</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <FormField control={control} name="originName" label="Name" />
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField control={control} name="originLat" label="Latitude" keyboardType="numbers-and-punctuation" /></View>
            <View className="flex-1"><FormField control={control} name="originLng" label="Longitude" keyboardType="numbers-and-punctuation" /></View>
          </View>
          <Button variant="outline" onPress={useCurrentLocation}>
            <Text>Use my current location</Text>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Destination</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <FormField control={control} name="destinationName" label="Name" />
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField control={control} name="destinationLat" label="Latitude" keyboardType="numbers-and-punctuation" /></View>
            <View className="flex-1"><FormField control={control} name="destinationLng" label="Longitude" keyboardType="numbers-and-punctuation" /></View>
          </View>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Safety settings</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <FormField control={control} name="checkInIntervalMin" label="Check-in every (minutes)" keyboardType="number-pad" hint="0 turns scheduled check-ins off." />
          <FormField control={control} name="corridorWidthM" label="Route corridor width (m)" keyboardType="number-pad" />
        </CardContent>
      </Card>
      <Button size="lg" onPress={() => submit(true)} disabled={formState.isSubmitting}>
        <Text>Create and start trip</Text>
      </Button>
      <Button variant="outline" onPress={() => submit(false)} disabled={formState.isSubmitting}>
        <Text>Save for later</Text>
      </Button>
    </Screen>
  );
}
