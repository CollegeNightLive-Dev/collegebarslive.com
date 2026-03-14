/**
 * Shared wait-time algorithm and helpers for bars.
 * Used by Wait Times tab and Map (bar Nyters).
 */

export interface BarDocLike {
  id?: string;
  name?: string;
  historical_baselines?: Record<string, number>;
  recent_reports?: Array<{ value: number; timestamp: unknown; user: string }>;
}

export function formatWait(value: number): string {
  const f = Math.floor(value / 5) * 5;
  return f >= 60 ? '60+' : `${f}-${f + 5}`;
}

export function calculateDynamicWait(docData: BarDocLike): string {
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
  const reports = docData.recent_reports ?? [];
  const fifteenMinsAgo = now.getTime() - 15 * 60 * 1000;
  const freshReports = reports.filter((r) => {
    const rTime = r.timestamp?.toDate
      ? r.timestamp.toDate().getTime()
      : r.timestamp;
    return rTime > fifteenMinsAgo;
  });
  if (freshReports.length === 0) return formatWait(anchor);
  const values = freshReports.map((r) => r.value).sort((a, b) => a - b);
  const medianReport = values[Math.floor(values.length / 2)];
  let userConsensus = anchor;
  if (isPeakWindow) {
    userConsensus = medianReport;
  } else {
    const superFresh = freshReports.filter((r) => {
      const rTime = r.timestamp?.toDate
        ? r.timestamp.toDate().getTime()
        : r.timestamp;
      return rTime > now.getTime() - 300000;
    });
    const isConsistent =
      superFresh.length >= 3 &&
      Math.max(...superFresh.map((r) => r.value)) -
        Math.min(...superFresh.map((r) => r.value)) <=
        10;
    if (isConsistent) userConsensus = medianReport;
  }
  const latestTS = Math.max(
    ...freshReports.map((r) =>
      r.timestamp?.toDate ? r.timestamp.toDate().getTime() : r.timestamp,
    ),
  );
  const minsOld = (now.getTime() - latestTS) / 60000;
  const trustWeight = Math.max(0, (60 - minsOld) / 60);
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
