import { Platform } from 'react-native';
import { Audio } from 'expo-av';

const SUCCESS_URI = 'https://assets.mixkit.co/active_storage/sfx/2869-pop-alert.mp3';
const ERROR_URI = 'https://assets.mixkit.co/active_storage/sfx/2572-error-alert.mp3';
const WARNING_URI = 'https://assets.mixkit.co/active_storage/sfx/2568-soft-notification.mp3';

async function playSound(uri: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
    setTimeout(() => sound.unloadAsync(), 600);
  } catch {
    // ignore; haptic alone is enough
  }
}

export async function playSuccess(): Promise<void> {
  await playSound(SUCCESS_URI);
}

export async function playError(): Promise<void> {
  await playSound(ERROR_URI);
}

export async function playWarning(): Promise<void> {
  await playSound(WARNING_URI);
}
