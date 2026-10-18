import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { View, type TextInputProps } from 'react-native';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  ...input
}: { control: Control<T>; name: FieldPath<T>; label: string; hint?: string } & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-1.5">
          <Label nativeID={`label-${name}`}>{label}</Label>
          <Input
            aria-labelledby={`label-${name}`}
            value={field.value === undefined || field.value === null ? '' : String(field.value)}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={Boolean(fieldState.error)}
            {...input}
          />
          {fieldState.error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {fieldState.error.message}
            </Text>
          ) : hint ? (
            <Text className="text-xs text-muted-foreground">{hint}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
