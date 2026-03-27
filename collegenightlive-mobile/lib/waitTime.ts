/**
 * Shared wait-time algorithm and helpers for bars.
 * Used by Wait Times tab and Map (bar Nyters).
 */

import type { AdminBarOverride } from '@/lib/admin-bar-override';

export interface BarDocLike {
  id?: string;
  name?: string;
  historical_baselines?: Record<string, number>;
  recent_reports?: Array<{ value: number; timestamp: unknown; user: string }>;
  admin_bar_override?: AdminBarOverride;
}

function getReportTimeMs(timestamp: unknown): number {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    try {
      return (timestamp as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return typeof timestamp === 'number' ? timestamp : 0;
}

export function formatWait(value: number): string {
  const f = Math.floor(value / 5) * 5;
  return f >= 60 ? '60+' : `${f}-${f + 5}`;
}

export function getFreshReports(
  docData: BarDocLike,
  nowMs = Date.now(),
  windowMinutes = 15,
): Array<{ value: number; timestamp: unknown; user: string }> {
  const reports = docData.recent_reports ?? [];
  const cutoffMs = nowMs - windowMinutes * 60 * 1000;
  return reports.filter((r) => {
    const rTime = getReportTimeMs(r.timestamp);
    return rTime > cutoffMs;
  });
}

export function getFreshReportCount(docData: BarDocLike, nowMs = Date.now(), windowMinutes = 15): number {
  return getFreshReports(docData, nowMs, windowMinutes).length;
}

export function calculateDynamicWait(docData: BarDocLike): string {
  const override = docData.admin_bar_override;
  if (override && typeof override.waitMinutes === 'number') {
    const exp = override.expiresAt;
    const expMs =
      exp && typeof (exp as { toMillis?: () => number }).toMillis === 'function'
        ? (exp as { toMillis: () => number }).toMillis()
        : 0;
    if (expMs > Date.now()) {
      return formatWait(override.waitMinutes);
    }
  }

  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = dayNames[now.getDay()];
  const currentHour = now.getHours();
  const hoursStr = currentHour.toString().padStart(2, '0');
  const minutesStr = now.getMinutes() < 30 ? '00' : '30';
  const baselineKey = `${currentDay}_${hoursStr}${minutesStr}`;
  const baselines = docData.historical_baselines ?? {};
  const anchor = baselines[baselineKey] ?? 0;
  const isPeakDay =
    ['Fri', 'Sat'].includes(currentDay) ||
    (currentDay === 'Sun' && currentHour < 2);
  const isPeakHour = currentHour >= 22 || currentHour < 1;
  const isPeakWindow = isPeakDay && isPeakHour;
  const freshReports = getFreshReports(docData, now.getTime());
  if (freshReports.length === 0) return formatWait(anchor);
  const values = freshReports.map((r) => r.value).sort((a, b) => a - b);
  const medianReport = values[Math.floor(values.length / 2)];
  let userConsensus = anchor;
  if (isPeakWindow) {
    const reportCount = freshReports.length;
    let userWeight = 0;
    if (reportCount >= 5) {
      userWeight = 0.95;
    } else if (reportCount >= 3) {
      userWeight = 0.6;
    } else {
      userWeight = 0.3;
    }
    userConsensus = medianReport * userWeight + anchor * (1 - userWeight);
  } else {
    const superFresh = freshReports.filter((r) => {
      const rTime = getReportTimeMs(r.timestamp);
      return rTime > now.getTime() - 300000;
    });
    const isConsistent =
      superFresh.length >= 3 &&
      Math.max(...superFresh.map((r) => r.value)) -
        Math.min(...superFresh.map((r) => r.value)) <=
        10;
    if (isConsistent) userConsensus = medianReport;
  }
  const latestTS = Math.max(...freshReports.map((r) => getReportTimeMs(r.timestamp)));
  const minsOld = (now.getTime() - latestTS) / 60000;
  const trustWeight = Math.max(0, (20 - minsOld) / 20);
  const finalValue = userConsensus * trustWeight + anchor * (1 - trustWeight);
  return formatWait(finalValue);
}

/**
 * Map wait string (e.g. "0-5", "25-30", "60+") to Nyter count 1-5:
 * 1 = 0-5 min, 2 = 5-15, 3 = 15-30, 4 = 30-45, 5 = 45-60+
 */
export function getWaitBucket(waitStr: string): number {
  if (waitStr === '60+') return 5;
  const match = waitStr.match(/^(\d+)-/);
  if (!match) return 1;
  const low = parseInt(match[1], 10);
  if (low < 5) return 1;
  if (low < 15) return 2;
  if (low < 30) return 3;
  if (low < 45) return 4;
  return 5;
}
