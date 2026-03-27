import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { WeekendDayId } from '@/constants/this-week-content';
import { db } from '@/lib/firebase';

export type VotesByDay = Record<WeekendDayId, string | null>;

export type DayPercentByBar = Record<string, number>;
export type WeekendPercentages = Record<WeekendDayId, DayPercentByBar>;

export type WeekendVoteSnapshot = {
  myVotes: VotesByDay;
  percentages: WeekendPercentages;
  floorGoingOutByDay: Record<WeekendDayId, number>;
  activeFloorPopulation: number;
};

export const EMPTY_VOTES_BY_DAY: VotesByDay = {
  thu: null,
  fri: null,
  sat: null,
};

export const EMPTY_PERCENTAGES: WeekendPercentages = {
  thu: {},
  fri: {},
  sat: {},
};

type VoteDoc = {
  byDay: VotesByDay;
};

function buildPercentagesFromAggregate(days: unknown): WeekendPercentages {
  const out: WeekendPercentages = { thu: {}, fri: {}, sat: {} };
  const safeDays = (days && typeof days === 'object' ? days : {}) as Record<
    WeekendDayId,
    { totalVotes?: number; barVotes?: Record<string, number> }
  >;

  (['thu', 'fri', 'sat'] as WeekendDayId[]).forEach((day) => {
    const dayData = safeDays[day];
    const denom = dayData?.totalVotes ?? 0;
    const barVotes = dayData?.barVotes ?? {};
    if (denom <= 0) return;
    Object.entries(barVotes).forEach(([barId, count]) => {
      out[day][barId] = Math.round(((count as number) / denom) * 100);
    });
  });
  return out;
}

function buildFloorGoingOutByDayFromAggregate(
  days: unknown,
  activeFloorPopulation: number,
): Record<WeekendDayId, number> {
  const safeDays = (days && typeof days === 'object' ? days : {}) as Record<
    WeekendDayId,
    { uniqueVoters?: number }
  >;
  const denom = Math.max(1, Number(activeFloorPopulation || 0));
  return {
    thu: Math.round(((safeDays.thu?.uniqueVoters ?? 0) / denom) * 100),
    fri: Math.round(((safeDays.fri?.uniqueVoters ?? 0) / denom) * 100),
    sat: Math.round(((safeDays.sat?.uniqueVoters ?? 0) / denom) * 100),
  };
}

function floorKey(dormId: string, floor: number): string {
  return `${dormId}__${floor}`;
}

export function subscribeToThisWeekVotes(
  schoolId: string,
  weekKey: string,
  uid: string | null,
  viewerDormId: string | null,
  viewerFloor: number | null,
  onData: (snapshot: WeekendVoteSnapshot) => void,
): Unsubscribe {
  let myVotes: VotesByDay = EMPTY_VOTES_BY_DAY;
  let percentages: WeekendPercentages = EMPTY_PERCENTAGES;
  let floorGoingOutByDay: Record<WeekendDayId, number> = { thu: 0, fri: 0, sat: 0 };
  let activeFloorPopulation = 0;

  const emit = () => onData({ myVotes, percentages, floorGoingOutByDay, activeFloorPopulation });
  const unsubs: Unsubscribe[] = [];

  if (uid) {
    const myVoteRef = doc(db, 'universities', schoolId, 'this_week_polls', weekKey, 'votes', uid);
    unsubs.push(
      onSnapshot(
        myVoteRef,
        (snap) => {
          const raw = (snap.data() ?? {}) as VoteDoc;
          myVotes = {
            thu: raw.byDay?.thu ?? null,
            fri: raw.byDay?.fri ?? null,
            sat: raw.byDay?.sat ?? null,
          };
          emit();
        },
        (err) => {
          console.error('This Week my vote sync error:', err);
          myVotes = EMPTY_VOTES_BY_DAY;
          emit();
        },
      ),
    );
  }

  if (viewerDormId && viewerFloor != null) {
    const aggregateRef = doc(
      db,
      'universities',
      schoolId,
      'this_week_aggregates',
      weekKey,
      'floors',
      floorKey(viewerDormId, viewerFloor),
    );

    unsubs.push(
      onSnapshot(
        aggregateRef,
        (snap) => {
          const raw = snap.data() as
            | {
                active30DayPopulation?: number;
                days?: unknown;
              }
            | undefined;
          const days = raw?.days ?? {};
          const activePopulation = raw?.active30DayPopulation ?? 0;
          activeFloorPopulation = activePopulation;
          percentages = buildPercentagesFromAggregate(days);
          floorGoingOutByDay = buildFloorGoingOutByDayFromAggregate(days, activePopulation);
          emit();
        },
        (err) => {
          console.error('This Week aggregate sync error:', err);
          percentages = EMPTY_PERCENTAGES;
          floorGoingOutByDay = { thu: 0, fri: 0, sat: 0 };
          activeFloorPopulation = 0;
          emit();
        },
      ),
    );
  } else {
    percentages = EMPTY_PERCENTAGES;
    floorGoingOutByDay = { thu: 0, fri: 0, sat: 0 };
    activeFloorPopulation = 0;
    emit();
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function upsertThisWeekVote(
  schoolId: string,
  weekKey: string,
  uid: string,
  day: WeekendDayId,
  barId: string,
  voterDormId: string | null,
  voterFloor: number | null,
): Promise<void> {
  const voteRef = doc(db, 'universities', schoolId, 'this_week_polls', weekKey, 'votes', uid);
  await setDoc(
    voteRef,
    {
      byDay: { [day]: barId },
      voterDormId,
      voterFloor,
      updatedAt: serverTimestamp(),
      weekKey,
    },
    { merge: true },
  );
}
