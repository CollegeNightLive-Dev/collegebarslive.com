import type { DayDeals } from '@/constants/bar-deals-types';

/** UI-only specials for Three Above High — times as provided */
export const THREE_ABOVE_HIGH_DEAL_DAYS: DayDeals[] = [
  {
    id: 'tue',
    label: 'Tuesday',
    short: 'TUE',
    sections: [
      {
        timeLabel: '9PM – Close',
        rows: [{ price: '$1', name: 'Well Drinks' }],
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
        rows: [
          { price: '$3', name: 'Pails' },
          { price: '$5', name: '40s' },
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
        timeLabel: '8:00 PM – 8:30 PM',
        rows: [{ price: '$1', name: 'Everything' }],
      },
      {
        timeLabel: '8:30 PM – 9:30 PM',
        rows: [{ price: '$2', name: 'Everything' }],
      },
      {
        timeLabel: '9:30 PM – 10:30 PM',
        rows: [{ price: '$3', name: 'Everything' }],
      },
    ],
  },
];

export function isThreeAboveHighBarName(name: string): boolean {
  const n = name.toLowerCase();
  const hasAboveHigh = n.includes('above') && n.includes('high');
  if (!hasAboveHigh) return false;
  return n.includes('three') || n.includes('threes') || /\b3\b/.test(n);
}
