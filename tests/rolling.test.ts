import { describe, expect, it } from 'vitest';
import { planInsert, planSet, SET_SIZE, type RollingSwing } from '../src/lib/rolling';
import type { Rating, SwingTypeId } from '../src/lib/swingTypes';

const T: SwingTypeId = 'mid-iron:full';
const day = (d: number) => Date.UTC(2026, 10, d);
function sw(id: string, recordedDay: number, opts: Partial<RollingSwing> = {}): RollingSwing {
  return { id, swingType: T, rating: 5 as Rating, recordedAt: day(recordedDay), uploadedAt: day(20), isModel: false, ...opts };
}
const ids = (xs: RollingSwing[]) => xs.map((x) => x.id).sort();

describe('rolling rule', () => {
  it('keeps everything while the set has room', () => {
    const p = planInsert([sw('a', 1), sw('b', 2)], sw('c', 3));
    expect(p.incomingKept).toBe(true);
    expect(p.evict).toEqual([]);
    expect(p.keep).toHaveLength(3);
  });

  it('keeps exactly five', () => {
    const existing = [1, 2, 3, 4].map((d) => sw(`s${d}`, d));
    const p = planInsert(existing, sw('new', 5));
    expect(p.keep).toHaveLength(SET_SIZE);
    expect(p.evict).toEqual([]);
  });

  it('a sixth swing deletes the oldest', () => {
    const existing = [1, 2, 3, 4, 5].map((d) => sw(`s${d}`, d));
    const p = planInsert(existing, sw('new', 6));
    expect(p.incomingKept).toBe(true);
    expect(ids(p.evict)).toEqual(['s1']);
    expect(ids(p.keep)).toEqual(['new', 's2', 's3', 's4', 's5']);
  });

  it('newest means recording date, not upload order', () => {
    // Uploading an old backlog clip into a full set drops the incoming clip itself.
    const existing = [5, 6, 7, 8, 9].map((d) => sw(`s${d}`, d));
    const p = planInsert(existing, sw('old', 1, { uploadedAt: day(25) }));
    expect(p.incomingKept).toBe(false);
    expect(ids(p.evict)).toEqual(['old']);
    expect(p.keep).toHaveLength(5);
  });

  it('never deletes the model swing, and the model counts as one of the five', () => {
    const existing = [sw('model', 1, { isModel: true }), ...[2, 3, 4, 5].map((d) => sw(`s${d}`, d))];
    const p = planInsert(existing, sw('new', 6));
    expect(ids(p.evict)).toEqual(['s2']);
    expect(ids(p.keep)).toEqual(['model', 'new', 's3', 's4', 's5']);
  });

  it('keeps the model even when every other swing is newer', () => {
    let set = [sw('model', 1, { isModel: true })];
    for (let d = 2; d <= 12; d++) {
      const p = planInsert(set, sw(`s${d}`, d));
      expect(p.keep.some((s) => s.id === 'model')).toBe(true);
      expect(p.keep).toHaveLength(Math.min(d, SET_SIZE));
      set = p.keep;
    }
    expect(ids(set)).toEqual(['model', 's10', 's11', 's12', 's9']);
  });

  it('breaks recording-date ties by upload date, then id, the same way every time', () => {
    const existing = [1, 2, 3, 4, 5].map((n) => sw(`t${n}`, 1, { uploadedAt: day(n) }));
    const p = planInsert(existing, sw('t6', 1, { uploadedAt: day(6) }));
    expect(ids(p.evict)).toEqual(['t1']);
    const q = planSet([...existing].reverse());
    expect(ids(q.keep)).toEqual(ids(planSet(existing).keep));
  });

  it('moving a swing that is already in the set does not count it twice', () => {
    const existing = [1, 2, 3, 4, 5].map((d) => sw(`s${d}`, d));
    const p = planInsert(existing, { ...existing[0], note: 'x' } as RollingSwing);
    expect(p.evict).toEqual([]);
    expect(p.keep).toHaveLength(5);
  });

  it('refuses swings from different sets', () => {
    expect(() => planSet([sw('a', 1), sw('b', 2, { rating: 4 })])).toThrow();
    expect(() => planSet([sw('a', 1), sw('b', 2, { swingType: 'drive:full' })])).toThrow();
  });

  it('an over-full set (for example after a bad restore) is trimmed to five', () => {
    const set = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => sw(`s${d}`, d));
    const p = planSet(set);
    expect(ids(p.evict)).toEqual(['s1', 's2', 's3']);
  });
});
