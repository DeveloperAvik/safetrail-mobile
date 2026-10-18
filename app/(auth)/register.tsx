import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@safetrail/contracts';
import { AlertTriangle } from 'lucide-react-native';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { api } from '@/services/api';
import { errorMessage } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Enter your name').max(80),
    email: z.email('Enter a valid email'),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type Form = z.infer<typeof schema>;

export default function Register() {
  const signIn = useAuthStore((s) => s.signIn);
  const [error, setError] = React.useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', confirm: '' },
  });
  const onSubmit = handleSubmit(async ({ displayName, email, password }) => {
    setError(null);
    try {
      await signIn(await api.auth.register({ displayName, email, password }));
    } catch (err) {
      setError(errorMessage(err));
    }
  });
  return (
    <Screen>
      <Text variant="h3">Create your account</Text>
      {error ? (
        <Alert icon={AlertTriangle} variant="destructive">
          <AlertTitle>Registration failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FormField control={control} name="displayName" label="Your name" autoComplete="name" />
      <FormField control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <FormField control={control} name="password" label="Password" secureTextEntry hint="At least 10 characters, with a letter and a digit." autoComplete="new-password" />
      <FormField control={control} name="confirm" label="Confirm password" secureTextEntry autoComplete="new-password" />
      <Button size="lg" onPress={() => void onSubmit()} disabled={formState.isSubmitting}>
        <Text>{formState.isSubmitting ? 'Creating…' : 'Create account'}</Text>
      </Button>
      <Text variant="muted" className="text-xs">
        Next you will choose what SafeTrail may monitor. Nothing is tracked until you give consent and start a trip.
      </Text>
    </Screen>
  );
}
