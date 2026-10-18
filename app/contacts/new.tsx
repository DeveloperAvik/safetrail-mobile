import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema, phoneSchema } from '@safetrail/contracts';
import { useQueryClient } from '@tanstack/react-query';
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
import { qk } from '@/hooks/queries';
import { api } from '@/services/api';
import { showError } from '@/utils/feedback';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(80),
    relationship: z.string().trim().max(40),
    phone: z.union([z.literal(''), phoneSchema]),
    email: z.union([z.literal(''), emailSchema]),
  })
  .refine((v) => v.phone || v.email, { message: 'Phone or email is required', path: ['phone'] });
type Form = z.infer<typeof schema>;

export default function NewContact() {
  const qc = useQueryClient();
  const [dev, setDev] = React.useState<{ token: string; code: string } | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: '', relationship: '', phone: '', email: '' } });
  const submit = handleSubmit(async (v) => {
    try {
      const res = await api.contacts.create({
        name: v.name,
        relationship: v.relationship || undefined,
        phone: v.phone || undefined,
        email: v.email || undefined,
        preferredChannel: v.phone ? 'sms' : 'email',
      });
      await qc.invalidateQueries({ queryKey: qk.contacts });
      if (res.devVerification) setDev(res.devVerification);
      else router.back();
    } catch (err) {
      showError(err, 'Could not add contact');
    }
  });

  if (dev) {
    return (
      <Screen>
        <Card>
          <CardHeader>
            <CardTitle>Invitation sent (development mode)</CardTitle>
            <CardDescription>With the mock provider no real message is sent. In production the contact accepts from their own phone.</CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            <Text className="text-sm">Verification code: <Text className="font-mono font-bold">{dev.code}</Text></Text>
            <Button
              onPress={async () => {
                try {
                  await api.contacts.verify(dev.token, dev.code);
                  await qc.invalidateQueries({ queryKey: qk.contacts });
                  router.back();
                } catch (err) {
                  showError(err);
                }
              }}>
              <Text>Simulate the contact accepting</Text>
            </Button>
            <Button variant="outline" onPress={() => router.back()}><Text>Leave pending</Text></Button>
          </CardContent>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="muted">They will receive an invitation and must accept before they can be alerted. Max 5 contacts.</Text>
      <FormField control={control} name="name" label="Name" />
      <FormField control={control} name="relationship" label="Relationship (optional)" />
      <FormField control={control} name="phone" label="Mobile number" keyboardType="phone-pad" hint="International format, e.g. +919876543210" />
      <FormField control={control} name="email" label="Email (optional)" keyboardType="email-address" autoCapitalize="none" />
      <View className="h-2" />
      <Button size="lg" onPress={() => void submit()} disabled={formState.isSubmitting}><Text>Send invitation</Text></Button>
    </Screen>
  );
}
