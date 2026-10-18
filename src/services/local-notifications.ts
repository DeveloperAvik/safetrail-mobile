import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications for safety prompts. Remote push is not configured in this prototype
 * (it needs an Expo project id and credentials); the app polls the backend while open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const shown = new Set<string>();
export async function notifyPrompt(id: string, title: string, body: string) {
  if (Platform.OS === 'web' || shown.has(id)) return;
  shown.add(id);
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: { promptId: id } }, trigger: null });
  } catch {
    /* permission denied: the in-app banner still shows */
  }
}
