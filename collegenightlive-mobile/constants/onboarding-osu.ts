/**
 * Ohio State residence halls for onboarding (ROI order: high-density first).
 * UI-only; sync to backend later.
 */
export type OsuDormSection = 'towers' | 'south' | 'mid' | 'low';

export type OsuDorm = {
  id: string;
  name: string;
  maxFloors: number;
  section: OsuDormSection;
};

export const OSU_DORM_SECTION_LABELS: Record<OsuDormSection, string> = {
  towers: 'HIGH-RISE TOWERS',
  south: 'SOUTH CAMPUS HIGH-RISE',
  mid: 'MID-RISE',
  low: 'LOW-RISE',
};

/** Fixed display order; includes per-building max floors for floor picker (1 … maxFloors). */
export const OSU_DORMS: OsuDorm[] = [
  // High-rise / towers
  { id: 'lincoln-tower', name: 'Lincoln Tower', maxFloors: 23, section: 'towers' },
  { id: 'morrill-tower', name: 'Morrill Tower', maxFloors: 23, section: 'towers' },
  { id: 'taylor-tower', name: 'Taylor Tower', maxFloors: 12, section: 'towers' },
  { id: 'drackett-tower', name: 'Drackett Tower', maxFloors: 12, section: 'towers' },
  { id: 'jones-tower', name: 'Jones Tower', maxFloors: 15, section: 'towers' },
  { id: 'lawrence-tower', name: 'Lawrence Tower', maxFloors: 10, section: 'towers' },
  // South campus high-rise cluster
  { id: 'smith-steeb-hall', name: 'Smith-Steeb Hall', maxFloors: 10, section: 'south' },
  { id: 'park-stradley-hall', name: 'Park-Stradley Hall', maxFloors: 11, section: 'south' },
  { id: 'siebert-hall', name: 'Siebert Hall', maxFloors: 10, section: 'south' },
  { id: 'torres-house', name: 'Torres House', maxFloors: 6, section: 'south' },
  { id: 'raney-house', name: 'Raney House', maxFloors: 5, section: 'south' },
  // Mid-rise (5–8)
  { id: 'residence-on-tenth', name: 'The Residence on Tenth', maxFloors: 6, section: 'mid' },
  { id: 'mack-hall', name: 'Mack Hall', maxFloors: 4, section: 'mid' },
  { id: 'haverfield-house', name: 'Haverfield House', maxFloors: 4, section: 'mid' },
  { id: 'houck-house', name: 'Houck House', maxFloors: 4, section: 'mid' },
  { id: 'houston-house', name: 'Houston House', maxFloors: 6, section: 'mid' },
  { id: 'blackburn-house', name: 'Blackburn House', maxFloors: 8, section: 'mid' },
  { id: 'busch-house', name: 'Busch House', maxFloors: 6, section: 'mid' },
  // Low-rise / smaller halls
  { id: 'archer-house', name: 'Archer House', maxFloors: 4, section: 'low' },
  { id: 'barrett-house', name: 'Barrett House', maxFloors: 4, section: 'low' },
  { id: 'bowen-house', name: 'Bowen House', maxFloors: 6, section: 'low' },
  { id: 'canfield-hall', name: 'Canfield Hall', maxFloors: 4, section: 'low' },
  { id: 'bradley-hall', name: 'Bradley Hall', maxFloors: 4, section: 'low' },
  { id: 'halloran-house', name: 'Halloran House', maxFloors: 4, section: 'low' },
  { id: 'mendoza-house', name: 'Mendoza House', maxFloors: 3, section: 'low' },
  { id: 'norton-house', name: 'Norton House', maxFloors: 4, section: 'low' },
  { id: 'nosker-house', name: 'Nosker House', maxFloors: 6, section: 'low' },
  { id: 'scott-house', name: 'Scott House', maxFloors: 7, section: 'low' },
  { id: 'german-house', name: 'German House', maxFloors: 2, section: 'low' },
  { id: 'hanley-house', name: 'Hanley House', maxFloors: 2, section: 'low' },
  { id: 'morrison-tower', name: 'Morrison Tower', maxFloors: 6, section: 'low' },
  { id: 'paterson-hall', name: 'Paterson Hall', maxFloors: 4, section: 'low' },
  { id: 'pennsylvania-place', name: 'Pennsylvania Place', maxFloors: 4, section: 'low' },
  { id: 'pomerene-house', name: 'Pomerene House', maxFloors: 3, section: 'low' },
  { id: 'scholars-east-west', name: 'Scholars East / West', maxFloors: 3, section: 'low' },
  { id: 'worthington-building', name: 'Worthington Building', maxFloors: 5, section: 'low' },
];

export type OsuDormListItem =
  | { kind: 'header'; section: OsuDormSection; key: string }
  | { kind: 'dorm'; dorm: OsuDorm; key: string };

export function buildOsuDormListItems(
  dorms: OsuDorm[],
  includeHeaders: boolean,
): OsuDormListItem[] {
  if (!includeHeaders) {
    return dorms.map((dorm) => ({ kind: 'dorm' as const, dorm, key: dorm.id }));
  }
  const items: OsuDormListItem[] = [];
  let last: OsuDormSection | undefined;
  for (const dorm of dorms) {
    if (dorm.section !== last) {
      items.push({
        kind: 'header',
        section: dorm.section,
        key: `header-${dorm.section}`,
      });
      last = dorm.section;
    }
    items.push({ kind: 'dorm', dorm, key: dorm.id });
  }
  return items;
}
