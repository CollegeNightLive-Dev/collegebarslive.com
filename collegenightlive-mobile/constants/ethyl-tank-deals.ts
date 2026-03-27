/**
 * Ethyl & Tank weekly specials (Tue–Sun). Times match venue flyer columns.
 */
import type { DayDeals, DealDayId } from '@/constants/bar-deals-types';
import { defaultDealDayForDays } from '@/constants/bar-deals-types';

export type { DealDayId as EthylDealDay } from '@/constants/bar-deals-types';

export const ETHYL_TANK_DEAL_DAYS: DayDeals[] = [
  {
    id: 'tue',
    label: 'Tuesday',
    short: 'TUE',
    sections: [
      {
        timeLabel: 'All day',
        rows: [
          { price: '$5', name: 'Martinis' },
          { price: '$3', name: 'Martini Shots' },
          { price: '$10', name: 'Martini Flights' },
        ],
      },
    ],
  },
  {
    id: 'wed',
    label: 'Wednesday',
    short: 'WED',
    sections: [
      {
        timeLabel: 'All day',
        rows: [
          { price: '$10', name: '10 Wings' },
          { price: '$10', name: 'Big Ass Mule' },
          { price: '$15', name: 'BOTA Wine Box', detail: 'Pinot Grigio / Cabernet' },
        ],
      },
    ],
  },
  {
    id: 'thu',
    label: 'Thursday',
    short: 'THU',
    sections: [
      {
        timeLabel: 'Open – Close',
        banner: { text: 'Tank Club', useAccent: true },
        rows: [
          { price: '$3', name: 'Beer/Well Tanks', detail: 'with glass tank' },
          { price: '$5', name: 'Well & Beer Tanks' },
          { price: '$5', name: 'Tank Nachos' },
          { price: '$10', name: 'Tanktails' },
          { price: '$2', name: 'Lemon Drops' },
        ],
      },
    ],
  },
  {
    id: 'fri',
    label: 'Friday',
    short: 'FRI',
    sections: [
      {
        timeLabel: '3PM – 7PM',
        rows: [
          { price: '$5', name: 'Smashburger' },
          { price: '$8', name: 'Doubles' },
        ],
      },
      {
        timeLabel: '10PM – Close',
        rows: [
          { price: '$15', name: 'Beer Buckets' },
          { price: '$5', name: 'Scarlet Spritz' },
          { price: '$3', name: 'Rumple Shots' },
        ],
      },
    ],
  },
  {
    id: 'sat',
    label: 'Saturday',
    short: 'SAT',
    sections: [
      {
        timeLabel: '10AM – 2PM',
        rows: [
          { price: '$20', name: 'Sharable Mimosa' },
          { price: '$6', name: 'Espresso Martinis' },
        ],
      },
      {
        timeLabel: 'Power Hour 2PM – 3PM',
        rows: [
          { price: '$1', name: 'Beers' },
          { price: '$1', name: 'Wells' },
        ],
      },
      {
        timeLabel: '10PM – Close',
        rows: [
          { price: '$5', name: 'House Marg' },
          { price: '2 for $8', name: "Nutrl's" },
          { price: '2 for $8', name: 'Mich Ultra' },
          { price: '$3', name: 'White Teas' },
        ],
      },
    ],
  },
  {
    id: 'sun',
    label: 'Sunday',
    short: 'SUN',
    sections: [
      {
        timeLabel: '10AM – 2PM',
        rows: [
          { price: '$20', name: 'Sharable Mimosa' },
          { price: '$6', name: 'Espresso Martinis' },
        ],
      },
      {
        timeLabel: 'After 2PM',
        rows: [
          { price: '$15', name: '10 Wings & Pitcher', detail: "Sycamore Light or 2 Nutrl's" },
        ],
      },
    ],
  },
];

const ETHYL_NAME_RE = /ethyl/i;
const TANK_RE = /tank/i;

export function isEthylAndTankBarName(name: string): boolean {
  const n = name.trim();
  return ETHYL_NAME_RE.test(n) && TANK_RE.test(n);
}

export function defaultEthylDealDay(): DealDayId {
  return defaultDealDayForDays(ETHYL_TANK_DEAL_DAYS);
}
