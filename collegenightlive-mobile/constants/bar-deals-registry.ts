/**
 * Resolve static weekly deals for a bar name (Wait Times list). UI-only.
 * Order: most specific matchers first.
 */
import type { DayDeals } from '@/constants/bar-deals-types';
import { ETHYL_TANK_DEAL_DAYS, isEthylAndTankBarName } from '@/constants/ethyl-tank-deals';
import {
  THREE_ABOVE_HIGH_DEAL_DAYS,
  isThreeAboveHighBarName,
} from '@/constants/deals-three-above-high';
import { STANDARD_BAR_DEAL_DAYS, isStandardBarDealsName } from '@/constants/deals-standard-bar';
import {
  MIKES_LATE_NIGHT_DEAL_DAYS,
  isMikesLateNightBarName,
} from '@/constants/deals-mikes-late-night';

export function getBarDealsDays(barName: string): DayDeals[] | null {
  if (isEthylAndTankBarName(barName)) return ETHYL_TANK_DEAL_DAYS;
  if (isThreeAboveHighBarName(barName)) return THREE_ABOVE_HIGH_DEAL_DAYS;
  if (isMikesLateNightBarName(barName)) return MIKES_LATE_NIGHT_DEAL_DAYS;
  if (isStandardBarDealsName(barName)) return STANDARD_BAR_DEAL_DAYS;
  return null;
}
