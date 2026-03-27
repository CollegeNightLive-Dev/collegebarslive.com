import type { DayDeals } from '@/constants/bar-deals-types';

/** UI-only specials for Standard bar — each block under its time */
export const STANDARD_BAR_DEAL_DAYS: DayDeals[] = [
  {
    id: 'thu',
    label: 'Thursday',
    short: 'THU',
    sections: [
      {
        timeLabel: '6PM – Midnight',
        rows: [
          { price: '$2', name: 'Double Well Drinks' },
          { price: '$2', name: 'Domestic Bottles' },
          { price: '$3', name: 'Lemon Drops' },
          { price: '$3', name: 'Green Teas' },
          { price: '$4', name: 'Boozy Lemonade' },
          { price: '$5', name: 'Smash Burger' },
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
        timeLabel: '6PM – Close',
        rows: [{ price: '$40', name: 'Buckeyes' }],
      },
    ],
  },
  {
    id: 'sat',
    label: 'Saturday',
    short: 'SAT',
    sections: [
      {
        timeLabel: '11AM – 3PM',
        rows: [{ price: '$15', name: 'Mimosa Service' }],
      },
    ],
  },
  {
    id: 'sun',
    label: 'Sunday',
    short: 'SUN',
    sections: [
      {
        timeLabel: '11AM – 3PM',
        rows: [{ price: '$15', name: 'Mimosa Service' }],
      },
    ],
  },
];

export function isStandardBarDealsName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === 'standard' ||
    n === 'the standard' ||
    n === 'standard bar' ||
    n === 'the standard bar'
  );
}
