import { Alert } from 'react-native';
import { errorMessage } from '@/services/api-client';

export function showError(err: unknown, title = 'Something went wrong') {
  Alert.alert(title, errorMessage(err));
}

export function confirm(title: string, message: string, confirmLabel = 'Confirm', destructive = false): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message?: string) {
  Alert.alert(title, message);
}
