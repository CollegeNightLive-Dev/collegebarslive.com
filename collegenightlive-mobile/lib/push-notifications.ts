import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const OSU_DORM_PROMPTED_KEY = 'notif_prompted_osu_dorm_floor';
const OSU_DORM_PROMPT_PENDING_KEY = 'notif_prompt_pending_osu_dorm_floor';

function getExpoProjectId(): string | undefined {
  const projectIdFromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (projectIdFromExpoConfig) return projectIdFromExpoConfig;
  return Constants.easConfig?.projectId;
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn('[push] Missing EAS projectId; skipping token registration.');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

async function persistExpoPushToken(uid: string, token: string): Promise<void> {
  // Use a deterministic doc id so repeated syncs update one token record.
  const tokenDocId = encodeURIComponent(token);
  await setDoc(
    doc(db, 'users', uid, 'pushTokens', tokenDocId),
    {
      token,
      platform: 'ios',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function syncExpoPushTokenForUser(uid: string): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    await persistExpoPushToken(uid, token);
  } catch (error) {
    console.warn('[push] Failed to sync Expo push token:', error);
  }
}

export async function syncExpoPushTokenIfPermitted(uid: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return;
    const projectId = getExpoProjectId();
    if (!projectId) return;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token.data) return;
    await persistExpoPushToken(uid, token.data);
  } catch (error) {
    console.warn('[push] Failed to sync permitted Expo push token:', error);
  }
}

export async function promptAndSyncPushAfterOsuDormFloor(uid: string): Promise<void> {
  try {
    const alreadyPrompted = await AsyncStorage.getItem(OSU_DORM_PROMPTED_KEY);
    if (alreadyPrompted === 'true') return;
    await syncExpoPushTokenForUser(uid);
    await AsyncStorage.setItem(OSU_DORM_PROMPTED_KEY, 'true');
  } catch (error) {
    console.warn('[push] Failed OSU dorm-floor push prompt flow:', error);
  }
}

export async function markOsuDormFloorPushPromptPending(): Promise<void> {
  await AsyncStorage.setItem(OSU_DORM_PROMPT_PENDING_KEY, 'true');
}

export async function consumePendingOsuDormFloorPushPrompt(uid: string): Promise<void> {
  try {
    const pending = await AsyncStorage.getItem(OSU_DORM_PROMPT_PENDING_KEY);
    if (pending !== 'true') return;
    await AsyncStorage.removeItem(OSU_DORM_PROMPT_PENDING_KEY);
    await promptAndSyncPushAfterOsuDormFloor(uid);
  } catch (error) {
    console.warn('[push] Failed pending OSU push prompt flow:', error);
  }
}
