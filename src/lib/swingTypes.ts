// Club categories, power levels, and the eight swing types (see SPEC.md, "Club categories and power").

export type ClubId = 'drive' | 'fairway' | 'long-iron' | 'mid-iron' | 'wedge' | 'chip';
export type Power = 'full' | 'three-quarter' | 'none';

export interface Club {
  id: ClubId;
  label: string;
  /** Keyboard shortcut in the Upload table. */
  key: string;
  /** Allowed power levels; the first is the default. */
  powers: Power[];
}

export const CLUBS: readonly Club[] = [
  { id: 'drive', label: 'Drive', key: 'd', powers: ['full'] },
  { id: 'fairway', label: 'Fairway wood', key: 'f', powers: ['full'] },
  { id: 'long-iron', label: '4/5/6 iron', key: 'l', powers: ['full'] },
  { id: 'mid-iron', label: '7/8/9 iron', key: 'm', powers: ['full', 'three-quarter'] },
  { id: 'wedge', label: 'Wedge', key: 'w', powers: ['full', 'three-quarter'] },
  { id: 'chip', label: 'Chip', key: 'c', powers: ['none'] },
];

/** A swing type id such as "mid-iron:three-quarter". */
export type SwingTypeId = `${ClubId}:${Power}`;

export interface SwingType {
  id: SwingTypeId;
  club: ClubId;
  power: Power;
  label: string;
}

const POWER_LABEL: Record<Power, string> = { full: 'full', 'three-quarter': '3/4', none: '' };

export function clubById(id: ClubId): Club {
  const club = CLUBS.find((c) => c.id === id);
  if (!club) throw new Error(`Unknown club ${id}`);
  return club;
}

export function makeSwingTypeId(club: ClubId, power: Power): SwingTypeId {
  if (!clubById(club).powers.includes(power)) {
    throw new Error(`${club} cannot be played at power ${power}`);
  }
  return `${club}:${power}`;
}

export function swingTypeLabel(club: ClubId, power: Power): string {
  const c = clubById(club);
  return c.powers.length > 1 ? `${c.label}, ${POWER_LABEL[power]}` : c.label;
}

export const SWING_TYPES: readonly SwingType[] = CLUBS.flatMap((c) =>
  c.powers.map((p) => ({ id: makeSwingTypeId(c.id, p), club: c.id, power: p, label: swingTypeLabel(c.id, p) })),
);

export function parseSwingTypeId(id: string): SwingType {
  const t = SWING_TYPES.find((s) => s.id === id);
  if (!t) throw new Error(`Unknown swing type ${id}`);
  return t;
}

export function isSwingTypeId(id: string): id is SwingTypeId {
  return SWING_TYPES.some((s) => s.id === id);
}

/** Next power level for a club (Q key). Returns the same power if the club has only one. */
export function nextPower(club: ClubId, power: Power): Power {
  const powers = clubById(club).powers;
  const i = powers.indexOf(power);
  return powers[(i + 1) % powers.length];
}

/** Power to use when switching to a club: keep the current one if allowed, else the club's default. */
export function powerForClub(club: ClubId, current: Power | null): Power {
  const powers = clubById(club).powers;
  return current && powers.includes(current) ? current : powers[0];
}

export type Rating = 1 | 2 | 3 | 4 | 5;
export const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];

export function isRating(n: unknown): n is Rating {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}
