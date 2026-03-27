import AsyncStorage from '@react-native-async-storage/async-storage';
import { OSU_DORMS } from '@/constants/onboarding-osu';

export const OSU_DORM_FLOOR_KEY = 'osu_onboarding_dorm_floor';

export type OsuDormFloorPayload = {
  dormId: string;
  floor: number;
};

export async function saveOsuDormFloor(payload: OsuDormFloorPayload | null): Promise<void> {
  if (!payload) {
    await AsyncStorage.removeItem(OSU_DORM_FLOOR_KEY);
    return;
  }
  await AsyncStorage.setItem(OSU_DORM_FLOOR_KEY, JSON.stringify(payload));
}

export async function loadOsuDormFloor(): Promise<OsuDormFloorPayload | null> {
  const raw = await AsyncStorage.getItem(OSU_DORM_FLOOR_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'dormId' in parsed &&
      'floor' in parsed &&
      typeof (parsed as { dormId: unknown }).dormId === 'string' &&
      typeof (parsed as { floor: unknown }).floor === 'number'
    ) {
      return { dormId: (parsed as OsuDormFloorPayload).dormId, floor: (parsed as OsuDormFloorPayload).floor };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getOsuDormDisplayName(dormId: string): string | null {
  return OSU_DORMS.find((d) => d.id === dormId)?.name ?? null;
}

export function formatFloorDisplay(floor: number): string {
  return `Floor ${floor}`;
}
