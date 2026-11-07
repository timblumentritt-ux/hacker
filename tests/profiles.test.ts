import { describe, expect, it } from 'vitest';
import { folderNameFor } from '../src/lib/profiles';

describe('profile folder names', () => {
  const id = '3f2a9c00-0000-4000-8000-000000000000';
  it('uses the name plus a short id so two golfers with the same name do not clash', () => {
    expect(folderNameFor('Tim', id)).toBe('Tim (3f2a)');
  });
  it('removes characters that Mac or Windows do not allow in folder names', () => {
    expect(folderNameFor('A/B:C*D?"<>|', id)).toBe('ABCD (3f2a)');
    expect(folderNameFor('Pat. ', id)).toBe('Pat (3f2a)');
  });
  it('never makes an empty name', () => {
    expect(folderNameFor('///', id)).toBe('Golfer (3f2a)');
  });
});
