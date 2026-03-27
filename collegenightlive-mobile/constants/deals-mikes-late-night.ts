import type { DayDeals } from '@/constants/bar-deals-types';

/**
 * Mike's Late Night — drink blocks + separate 8PM–10PM event rows per day (as pasted).
 */
export const MIKES_LATE_NIGHT_DEAL_DAYS: DayDeals[] = [
  {
    id: 'sun',
    label: 'Sunday',
    short: 'SUN',
    sections: [
      {
        timeLabel: 'Sunday specials',
        rows: [
          { price: '$18', name: 'Bottomless Mimosas' },
          { price: '$4', name: "Bloody Mikey's" },
          { price: '$2', name: 'Domestic Drafts' },
          { price: '$2', name: 'Bombs' },
        ],
      },
    ],
  },
  {
    id: 'mon',
    label: 'Monday',
    short: 'MON',
    sections: [
      {
        timeLabel: 'Monday specials',
        rows: [
          { price: '$4', name: 'Mules', detail: 'well' },
          { price: '$3', name: 'Lemon Drops' },
        ],
      },
    ],
  },
  {
    id: 'tue',
    label: 'Tuesday',
    short: 'TUE',
    sections: [
      {
        timeLabel: 'Drink specials',
        rows: [
          { price: '$8', name: 'Margarita Pitchers' },
          { price: '$5', name: 'Espolon Shot' },
          { price: '$2', name: 'Mini Margarita Shots' },
        ],
      },
      {
        timeLabel: '8PM – 10PM',
        rows: [{ name: 'Join us for Excess Bingo' }],
      },
    ],
  },
  {
    id: 'wed',
    label: 'Wednesday',
    short: 'WED',
    sections: [
      {
        timeLabel: 'Drink specials',
        rows: [
          { price: '$3', name: 'Whiskey Sours' },
          {
            price: '$5',
            name: 'Miller High Life Draft & Shot',
            detail: 'Well Whiskey',
          },
          { price: '$2', name: 'Green Tea' },
        ],
      },
      {
        timeLabel: '8PM – 10PM',
        rows: [{ name: 'Join us for Big Mike Karaoke' }],
      },
    ],
  },
  {
    id: 'thu',
    label: 'Thursday',
    short: 'THU',
    sections: [
      {
        timeLabel: 'Drink specials',
        rows: [
          { price: '$3', name: 'Wells' },
          { price: '$3', name: 'Domestic Cans' },
          { price: '$3', name: 'White Claw' },
          { price: '$3', name: 'Unicorn Shots' },
        ],
      },
      {
        timeLabel: '8PM – 10PM',
        rows: [{ name: 'Join us for Thursday Trivia' }],
      },
    ],
  },
  {
    id: 'fri',
    label: 'Friday',
    short: 'FRI',
    sections: [
      {
        timeLabel: 'Open – Close',
        rows: [
          { price: '$12', name: 'Domestic Pitchers' },
          { price: '$3', name: 'Wells' },
          { price: '$2', name: 'Unicorn Shots' },
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
        timeLabel: '1:00 PM',
        rows: [
          { price: '$1', name: 'House Beer Draft', detail: 'Decent Ass' },
          { price: '$1', name: 'Wells' },
          { price: '$1', name: 'Unicorn Shot' },
          {
            price: '$1',
            name: 'Cheese or Pepp Slice',
            detail: '12 cut · Thin Slice',
          },
        ],
      },
      {
        timeLabel: '2:00 PM',
        rows: [
          { price: '$2', name: 'House Beer Draft' },
          { price: '$2', name: 'Wells' },
          { price: '$2', name: 'Vodka Bomb' },
          {
            price: '$2',
            name: 'Cheese or Pepp Slice',
            detail: '12 cut · Thin Slice',
          },
        ],
      },
      {
        timeLabel: '3:00 PM',
        rows: [
          { price: '$3', name: 'House Beer Draft' },
          { price: '$3', name: 'Wells' },
          { price: '$3', name: 'Vodka Bombs' },
          {
            price: '$3',
            name: 'Cheese or Pepp Slice',
            detail: '12 cut · Thin Slice',
          },
        ],
      },
      {
        timeLabel: '4:00 PM',
        rows: [
          { price: '$4', name: 'House Beer Draft' },
          { price: '$4', name: 'Double Well' },
          { price: '$4', name: 'Vodka Bombs' },
          { price: '$4', name: 'Breadsticks' },
        ],
      },
      {
        timeLabel: '7:00 PM – Close',
        rows: [
          { price: '$2', name: 'PBR or Miller High Life Draft' },
          { price: '$2', name: 'Wells' },
          { price: '$2', name: 'Unicorn Shots' },
          { price: '$25', name: 'Barrel of Fun' },
        ],
      },
    ],
  },
];

export function isMikesLateNightBarName(name: string): boolean {
  const n = name.toLowerCase();
  if (!n.includes('mike')) return false;
  if (n.includes('late') && n.includes('night')) return true;
  if (n.includes('late night')) return true;
  if (n.includes('slice') && n.includes('mike')) return true;
  return false;
}
