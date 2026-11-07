// The rolling rule (see SPEC.md, "Rolling sets").
// Pure functions only, so the rule can be tested from the terminal.

import type { Rating, SwingTypeId } from './swingTypes';

export const SET_SIZE = 5;

/** The fields of a swing that the rolling rule looks at. */
export interface RollingSwing {
  id: string;
  swingType: SwingTypeId;
  rating: Rating;
  /** Recording date in ms. "Newest" means the latest recording date. */
  recordedAt: number;
  /** Upload date in ms, used only to break ties. */
  uploadedAt: number;
  isModel: boolean;
}

export interface RollingPlan<T extends RollingSwing> {
  keep: T[];
  evict: T[];
}

/** Newest first; ties broken by upload date, then id, so the result is always the same. */
export function newestFirst(a: RollingSwing, b: RollingSwing): number {
  return b.recordedAt - a.recordedAt || b.uploadedAt - a.uploadedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

/**
 * Given every swing in one set (one swing type at one rating), decide which to keep.
 * The model swing is pinned and counts as one of the five. The rest are kept newest first.
 */
export function planSet<T extends RollingSwing>(swings: T[]): RollingPlan<T> {
  const first = swings[0];
  if (first && swings.some((s) => s.swingType !== first.swingType || s.rating !== first.rating)) {
    throw new Error('planSet needs swings from a single set');
  }
  const pinned = swings.filter((s) => s.isModel);
  const others = swings.filter((s) => !s.isModel).sort(newestFirst);
  const room = Math.max(0, SET_SIZE - pinned.length);
  const keep = [...pinned, ...others.slice(0, room)].sort(newestFirst);
  const evict = others.slice(room);
  return { keep, evict };
}

/**
 * Plan adding (or moving) a swing into a set.
 * `existing` are the swings already in the target set; `incoming` is the new or moved swing.
 * `incomingKept` is false when the incoming swing is older than five stored swings, so it is dropped at once.
 */
export function planInsert<T extends RollingSwing>(
  existing: T[],
  incoming: T,
): RollingPlan<T> & { incomingKept: boolean } {
  const plan = planSet([...existing.filter((s) => s.id !== incoming.id), incoming]);
  return { ...plan, incomingKept: plan.keep.some((s) => s.id === incoming.id) };
}

/** Group swings by set key "swingType|rating". */
export function setKey(s: { swingType: SwingTypeId; rating: Rating }): string {
  return `${s.swingType}|${s.rating}`;
}
