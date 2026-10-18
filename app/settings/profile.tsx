import { zodResolver } from '@hookform/resolvers/zod';
import { phoneSchema } from '@safetrail/contracts';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '@/components/form-field';
import { ErrorState, Loading } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { qk, useProfile } from '@/hooks/queries';
import { api } from '@/services/api';
import { notify, showError } from '@/utils/feedback';

const schema = z.object({
  displayName: z.string().trim().min(1).max(80),
  phone: z.union([z.literal(''), phoneSchema]),
  homeCountry: z.string().trim().max(56),
  emergencyNotes: z.string().max(500),
  primaryLanguage: z.string().max(40),
  samplingIntervalSec: z.string().refine((v) => Number(v) >= 10 && Number(v) <= 600, '10–600 seconds'),
  confirmationCountdownSec: z.string().refine((v) => Number(v) >= 30 && Number(v) <= 900, '30–900 seconds'),
});
type Form = z.infer<typeof schema>;

export default function ProfileScreen() {
  const qc = useQueryClient();
  const profile = useProfile();
  const { control, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(schema) });
  React.useEffect(() => {
    const p = profile.data;
    if (p)
      reset({
        displayName: p.displayName,
        phone: p.phone ?? '',
        homeCountry: p.homeCountry ?? '',
        emergencyNotes: p.emergency.emergencyNotes ?? '',
        primaryLanguage: p.emergency.primaryLanguage ?? '',
        samplingIntervalSec: String(p.monitoring.samplingIntervalSec),
        confirmationCountdownSec: String(p.monitoring.confirmationCountdownSec),
      });
  }, [profile.data, reset]);
  if (profile.isLoading) return <Loading />;
  if (profile.error) return <Screen><ErrorState error={profile.error} /></Screen>;

  const submit = handleSubmit(async (v) => {
    try {
      await api.profile.update({
        displayName: v.displayName,
        phone: v.phone || null,
        homeCountry: v.homeCountry || null,
        emergency: { emergencyNotes: v.emergencyNotes || null, primaryLanguage: v.primaryLanguage || null },
        monitoring: { samplingIntervalSec: Number(v.samplingIntervalSec), confirmationCountdownSec: Number(v.confirmationCountdownSec) },
      });
      await qc.invalidateQueries({ queryKey: qk.profile });
      notify('Saved');
    } catch (err) {
      showError(err, 'Could not save');
    }
  });

  return (
    <Screen>
      <FormField control={control} name="displayName" label="Name" />
      <FormField control={control} name="phone" label="Your phone" keyboardType="phone-pad" hint="International format, e.g. +919876543210" />
      <FormField control={control} name="homeCountry" label="Home country" />
      <FormField control={control} name="primaryLanguage" label="Preferred language" />
      <FormField control={control} name="emergencyNotes" label="Emergency notes (optional)" multiline hint="Allergies, medication. Shared only with responders during an incident." />
      <FormField control={control} name="samplingIntervalSec" label="Location sampling interval (seconds)" keyboardType="number-pad" hint="Longer intervals save battery but react more slowly." />
      <FormField control={control} name="confirmationCountdownSec" label="Confirmation countdown (seconds)" keyboardType="number-pad" hint="Time to answer before contacts are alerted." />
      <Button size="lg" onPress={() => void submit()} disabled={formState.isSubmitting}><Text>Save</Text></Button>
    </Screen>
  );
}
