import { describe, expect, it } from 'vitest';
import { SWING_TYPES, makeSwingTypeId, nextPower, powerForClub } from '../src/lib/swingTypes';
import { ballResultHint } from '../src/lib/ballResult';

describe('swing types', () => {
  it('has exactly the eight swing types in the spec', () => {
    expect(SWING_TYPES.map((t) => t.id)).toEqual([
      'drive:full', 'fairway:full', 'long-iron:full', 'mid-iron:full', 'mid-iron:three-quarter',
      'wedge:full', 'wedge:three-quarter', 'chip:none',
    ]);
  });

  it('only 7/8/9 iron and wedge allow three-quarters', () => {
    expect(() => makeSwingTypeId('drive', 'three-quarter')).toThrow();
    expect(() => makeSwingTypeId('long-iron', 'three-quarter')).toThrow();
    expect(() => makeSwingTypeId('chip', 'full')).toThrow();
    expect(makeSwingTypeId('wedge', 'three-quarter')).toBe('wedge:three-quarter');
  });

  it('Q switches power only where allowed', () => {
    expect(nextPower('mid-iron', 'full')).toBe('three-quarter');
    expect(nextPower('mid-iron', 'three-quarter')).toBe('full');
    expect(nextPower('drive', 'full')).toBe('full');
    expect(nextPower('chip', 'none')).toBe('none');
  });

  it('keeps power when switching between clubs that allow it', () => {
    expect(powerForClub('wedge', 'three-quarter')).toBe('three-quarter');
    expect(powerForClub('drive', 'three-quarter')).toBe('full');
    expect(powerForClub('chip', 'full')).toBe('none');
    expect(powerForClub('mid-iron', 'none')).toBe('full');
  });

  it('ball result hints follow handedness', () => {
    expect(ballResultHint('pull', 'right')).toContain('left');
    expect(ballResultHint('pull', 'left')).toContain('right');
    expect(ballResultHint('slice', 'right')).toContain('right');
    expect(ballResultHint('slice', 'left')).toContain('left');
  });
});
