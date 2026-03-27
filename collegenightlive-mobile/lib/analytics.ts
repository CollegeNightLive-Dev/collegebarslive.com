import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from '@react-native-firebase/analytics';

const DEAL_OPEN_COUNT_KEY = 'analytics_deal_open_count';

type Primitive = string | number | boolean | null | undefined;
type EventParams = Record<string, Primitive>;

function cleanParams(params?: EventParams): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === 'boolean') {
      out[key] = value ? 1 : 0;
      return;
    }
    out[key] = value;
  });
  return out;
}

export async function logAnalyticsEvent(name: string, params?: EventParams): Promise<void> {
  try {
    const cleaned = cleanParams(params);
    await analytics().logEvent(name as never, cleaned as never);
  } catch (err) {
    console.warn(`Analytics log failed for ${name}:`, err);
  }
}

export async function logAnalyticsScreenView(screenName: string): Promise<void> {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: 'ExpoRouterScreen',
    });
  } catch (err) {
    console.warn('Analytics screen_view failed:', err);
  }
}

export async function logAnalyticsAppOpen(): Promise<void> {
  try {
    await analytics().logAppOpen();
  } catch (err) {
    console.warn('Analytics app_open failed:', err);
  }
}

export async function setAnalyticsUserProperty(
  name: string,
  value: string | number | null | undefined,
): Promise<void> {
  try {
    if (value == null || value === '') return;
    await analytics().setUserProperty(name, String(value));
  } catch (err) {
    console.warn(`Analytics setUserProperty failed for ${name}:`, err);
  }
}

export async function trackOnboardingStepViewed(stepName: string, stepIndex: number): Promise<void> {
  await logAnalyticsEvent('onboarding_step_viewed', {
    step_name: stepName,
    step_index: stepIndex,
  });
}

export async function trackOnboardingStepCompleted(stepName: string, stepIndex: number): Promise<void> {
  await logAnalyticsEvent('onboarding_step_completed', {
    step_name: stepName,
    step_index: stepIndex,
  });
}

export async function trackOnboardingCompleted(params: {
  schoolId: string;
  dormId?: string | null;
  floor?: number | null;
}): Promise<void> {
  await logAnalyticsEvent('onboarding_completed', {
    school_id: params.schoolId,
    dorm: params.dormId ?? null,
    floor: params.floor ?? null,
  });
}

export async function trackDormFloorSelected(params: {
  schoolId: string;
  dormId: string;
  floor: number;
}): Promise<void> {
  await logAnalyticsEvent('dorm_floor_selected', {
    school_id: params.schoolId,
    dorm: params.dormId,
    floor: params.floor,
  });
}

export async function trackDealOpened(params: {
  barId: string;
  barName: string;
  sourceScreen: string;
  localHour: number;
  dayOfWeek: string;
}): Promise<void> {
  await logAnalyticsEvent('deal_opened', {
    bar_id: params.barId,
    bar_name: params.barName,
    source_screen: params.sourceScreen,
    local_hour: params.localHour,
    day_of_week: params.dayOfWeek,
  });

  const rawCount = await AsyncStorage.getItem(DEAL_OPEN_COUNT_KEY);
  const count = Number(rawCount ?? '0');
  const nextCount = Number.isFinite(count) && count > 0 ? count + 1 : 1;
  await AsyncStorage.setItem(DEAL_OPEN_COUNT_KEY, String(nextCount));

  if (nextCount === 1) {
    await logAnalyticsEvent('first_deal_opened', {
      bar_id: params.barId,
      bar_name: params.barName,
    });
  } else {
    await logAnalyticsEvent('repeat_deal_opened', {
      bar_id: params.barId,
      bar_name: params.barName,
      open_count: nextCount,
    });
  }
}
