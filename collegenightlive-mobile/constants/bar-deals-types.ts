/**
 * Shared shapes for per-bar weekly deals modals (UI-only).
 */
export type DealDayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type DealRow = {
  /** Omit for event / info lines (name only) */
  price?: string;
  name: string;
  detail?: string;
};

export type DealSection = {
  timeLabel?: string;
  /** Highlighted title (uses campus accent when useAccent is true) */
  banner?: { text: string; useAccent?: boolean };
  /** Small text under the section rows, e.g. event + time */
  footNote?: string;
  rows: DealRow[];
};

export type DayDeals = {
  id: DealDayId;
  label: string;
  short: string;
  sections: DealSection[];
};

/** First day in `days` matching today (JS getDay), else first entry. */
export function defaultDealDayForDays(days: DayDeals[]): DealDayId {
  if (days.length === 0) return 'tue';
  const allowed = new Set(days.map((d) => d.id));
  const js = new Date().getDay();
  const map: DealDayId[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = map[js];
  if (allowed.has(today)) return today;
  return days[0].id;
}
