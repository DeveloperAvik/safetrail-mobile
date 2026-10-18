import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { api } from '@/services/api';
import { config } from '@/services/config';
import { errorMessage } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { AlertTriangle } from 'lucide-react-native';

const schema = z.object({ email: z.email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type Form = z.infer<typeof schema>;

export default function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const [error, setError] = React.useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(await api.auth.login(values));
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <Screen>
      <Text variant="h3">Welcome back</Text>
      {error ? (
        <Alert icon={AlertTriangle} variant="destructive">
          <AlertTitle>Could not sign in</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FormField control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <FormField control={control} name="password" label="Password" secureTextEntry autoComplete="password" textContentType="password" />
      <Button size="lg" onPress={() => void onSubmit()} disabled={formState.isSubmitting}>
        <Text>{formState.isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
      </Button>
      <Link href="/register" asChild>
        <Button variant="link">
          <Text>Create an account</Text>
        </Button>
      </Link>
      <Text variant="muted" className="text-center text-xs">Server: {config.apiUrl}</Text>
    </Screen>
  );
}
