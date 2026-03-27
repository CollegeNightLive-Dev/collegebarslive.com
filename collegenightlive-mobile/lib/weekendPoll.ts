import type { WeekendDayId } from '@/constants/this-week-content';

const EASTERN_TZ = 'America/New_York';

type EasternParts = {
  year: number;
  month: number;
  day: number;
  weekDayName: string;
  hour: number;
  minute: number;
};

const easternDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const easternOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TZ,
  timeZoneName: 'shortOffset',
});

function getEasternParts(date: Date): EasternParts {
  const parts = easternDateTimeFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekDayName: get('weekday'),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

function getEasternOffsetMinutes(at: Date): number {
  const tzPart = easternOffsetFormatter
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;

  const m = tzPart?.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return -300;

  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2] ?? '0');
  const minutes = Number(m[3] ?? '0');
  return sign * (hours * 60 + minutes);
}

function easternWallClockToDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const roughUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMinutes = getEasternOffsetMinutes(new Date(roughUtcMs));
  const utcMs = roughUtcMs - offsetMinutes * 60 * 1000;
  return new Date(utcMs);
}

function addEtDays(
  base: { year: number; month: number; day: number },
  daysToAdd: number,
): { year: number; month: number; day: number } {
  const utcNoon = Date.UTC(base.year, base.month - 1, base.day + daysToAdd, 12, 0, 0, 0);
  const p = getEasternParts(new Date(utcNoon));
  return { year: p.year, month: p.month, day: p.day };
}

function weekDayNameToIndex(name: string): number {
  switch (name) {
    case 'Sun':
      return 0;
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    default:
      return 0;
  }
}

function formatWeekKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseWeekKey(weekKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = weekKey.split('-').map(Number);
  return { year, month, day };
}

function getSundayDatePartsFor(date: Date): { year: number; month: number; day: number } {
  const p = getEasternParts(date);
  const dayIdx = weekDayNameToIndex(p.weekDayName);
  return addEtDays({ year: p.year, month: p.month, day: p.day }, -dayIdx);
}

export function getCurrentWeekKey(now: Date = new Date()): string {
  const thisSunday = getSundayDatePartsFor(now);
  const thisSundayUnlockAt = easternWallClockToDate(
    thisSunday.year,
    thisSunday.month,
    thisSunday.day,
    10,
    0,
  );

  if (now >= thisSundayUnlockAt) {
    return formatWeekKey(thisSunday.year, thisSunday.month, thisSunday.day);
  }

  const prevSunday = addEtDays(thisSunday, -7);
  return formatWeekKey(prevSunday.year, prevSunday.month, prevSunday.day);
}

export function getPollWindowForWeekKey(weekKey: string): {
  unlockAt: Date;
  lockByDay: Record<WeekendDayId, Date>;
} {
  const sun = parseWeekKey(weekKey);
  const thu = addEtDays(sun, 4);
  const fri = addEtDays(sun, 5);
  const sat = addEtDays(sun, 6);

  return {
    unlockAt: easternWallClockToDate(sun.year, sun.month, sun.day, 10, 0),
    lockByDay: {
      thu: easternWallClockToDate(thu.year, thu.month, thu.day, 21, 0),
      fri: easternWallClockToDate(fri.year, fri.month, fri.day, 21, 0),
      sat: easternWallClockToDate(sat.year, sat.month, sat.day, 21, 0),
    },
  };
}

export function isWeekendDayOpenAt(day: WeekendDayId, now: Date = new Date(), weekKey?: string): boolean {
  const activeWeekKey = weekKey ?? getCurrentWeekKey(now);
  const window = getPollWindowForWeekKey(activeWeekKey);
  return now >= window.unlockAt && now < window.lockByDay[day];
}
