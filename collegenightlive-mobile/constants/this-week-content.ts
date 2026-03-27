export type WeekendDayId = 'thu' | 'fri' | 'sat';

export const WEEKEND_DAY_ORDER: WeekendDayId[] = ['thu', 'fri', 'sat'];

export const WEEKEND_DAY_LABELS: Record<WeekendDayId, string> = {
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};

export type BarDayMetrics = {
  percent: number;
  percentDorm: number;
  percentFloor: number;
};

export type VotingRowItem = {
  id: string;
  name: string;
  percent: number;
  percentDorm: number;
  percentFloor: number;
};

export type DormPulse = {
  dormName: string;
  floorDisplay: string;
  floorGoingOutPercent: number;
  barMetricDormLabel: string;
  barMetricFloorLabel: string;
};
