import { describe, expect, it } from 'vitest';
import { parseNotes, parseShorthand } from '../src/lib/shorthand';

const ok = (line: string) => {
  const r = parseShorthand(line);
  if (!r.ok) throw new Error(`${line}: ${r.error}`);
  return r.label;
};
const err = (line: string) => {
  const r = parseShorthand(line);
  if (r.ok) throw new Error(`${line} should fail`);
  return r.error;
};

describe('swing shorthand', () => {
  it('reads the examples from the guide', () => {
    expect(ok('D 4 slice')).toEqual({ club: 'drive', power: 'full', rating: 4, result: 'slice', note: '' });
    expect(ok('F 3')).toEqual({ club: 'fairway', power: 'full', rating: 3, result: null, note: '' });
    expect(ok('L 5 solid')).toMatchObject({ club: 'long-iron', rating: 5, result: 'solid' });
    expect(ok('M 5')).toMatchObject({ club: 'mid-iron', power: 'full', rating: 5 });
    expect(ok('M3/4 4 pull')).toMatchObject({ club: 'mid-iron', power: 'three-quarter', rating: 4, result: 'pull' });
    expect(ok('W 2 fat chunked it')).toEqual({ club: 'wedge', power: 'full', rating: 2, result: 'fat', note: 'chunked it' });
    expect(ok('C 5')).toEqual({ club: 'chip', power: 'none', rating: 5, result: null, note: '' });
  });

  it('accepts the different ways of writing three-quarters', () => {
    for (const line of ['M 3/4 4', 'M3/4 4', 'M ¾ 4', 'M¾ 4', 'MQ 4', 'M q 4', 'w3/4 4']) {
      expect(ok(line).power).toBe('three-quarter');
    }
  });

  it('ignores capitals, extra spaces, and list markers from Notes', () => {
    expect(ok('  w   5   PUSH  ')).toMatchObject({ club: 'wedge', rating: 5, result: 'push' });
    expect(ok('1. W 5')).toMatchObject({ club: 'wedge', rating: 5 });
    expect(ok('3) D 2')).toMatchObject({ club: 'drive', rating: 2 });
    expect(ok('- C 4')).toMatchObject({ club: 'chip', rating: 4 });
    expect(ok('• M 3')).toMatchObject({ club: 'mid-iron', rating: 3 });
  });

  it('accepts the rating stuck to the club, and result before rating', () => {
    expect(ok('W5 push')).toMatchObject({ club: 'wedge', rating: 5, result: 'push' });
    expect(ok('M3/45')).toMatchObject({ club: 'mid-iron', power: 'three-quarter', rating: 5 });
    expect(ok('D slice 3')).toMatchObject({ club: 'drive', rating: 3, result: 'slice' });
    expect(ok('W 4/5 thin')).toMatchObject({ rating: 4, result: 'thin' });
  });

  it('understands club names and numbers', () => {
    expect(ok('driver 3').club).toBe('drive');
    expect(ok('7i 5').club).toBe('mid-iron');
    expect(ok('5i 4').club).toBe('long-iron');
    expect(ok('3i 4').club).toBe('long-iron');
    expect(ok('hybrid 4').club).toBe('fairway');
    expect(ok('3w 2').club).toBe('fairway');
    expect(ok('SW 3/4 5')).toMatchObject({ club: 'wedge', power: 'three-quarter' });
    expect(ok('M full 4').power).toBe('full');
  });

  it('reads plurals and past tense of results', () => {
    expect(ok('D 3 sliced').result).toBe('slice');
    expect(ok('W 2 thinned').result).toBe('thin');
    expect(ok('W 2 fatted').result).toBe('fat');
    expect(ok('D 4 hooks').result).toBe('hook');
    expect(ok('D 3 pushed it right')).toMatchObject({ result: 'push', note: 'it right' });
  });

  it('a word that is not a result starts the note', () => {
    expect(ok('W 5 great tempo')).toMatchObject({ result: null, note: 'great tempo' });
  });

  it('explains what is wrong', () => {
    expect(err('X 5')).toContain('not a club');
    expect(err('W push')).toContain('Missing the rating');
    expect(err('W 7')).toContain('1 to 5, not 7');
    expect(err('D 3/4 4')).toContain('no three-quarter');
    expect(err('C3/4 4')).toContain('no three-quarter');
  });
});

describe('pasted notes', () => {
  it('skips blank lines and keeps line numbers', () => {
    const lines = parseNotes('W 5 push\n\n  \nD 2 slice\nnonsense');
    expect(lines.map((l) => l.lineNo)).toEqual([1, 4, 5]);
    expect(lines.map((l) => l.parsed.ok)).toEqual([true, true, false]);
  });
});
