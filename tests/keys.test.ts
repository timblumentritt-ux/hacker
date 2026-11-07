import { describe, expect, it } from 'vitest';
import { keyToAction } from '../src/ui/keys';

const k = (key: string, mods: Partial<{ shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) =>
  keyToAction({ key, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...mods });

describe('upload keys', () => {
  it('maps the keys in the spec', () => {
    expect(k('ArrowDown')).toEqual({ type: 'move', delta: 1 });
    expect(k('ArrowUp')).toEqual({ type: 'move', delta: -1 });
    expect(k('3')).toEqual({ type: 'rating', rating: 3 });
    expect(k('6')).toBeNull();
    expect(k('d')).toEqual({ type: 'club', club: 'drive' });
    expect(k('f')).toEqual({ type: 'club', club: 'fairway' });
    expect(k('l')).toEqual({ type: 'club', club: 'long-iron' });
    expect(k('m')).toEqual({ type: 'club', club: 'mid-iron' });
    expect(k('w')).toEqual({ type: 'club', club: 'wedge' });
    expect(k('c')).toEqual({ type: 'club', club: 'chip' });
    expect(k('q')).toEqual({ type: 'power' });
    expect(k('=')).toEqual({ type: 'copy-previous' });
    expect(k('o')).toEqual({ type: 'toggle-mode' });
    expect(k(' ')).toEqual({ type: 'play' });
    expect(k('?', { shiftKey: true })).toEqual({ type: 'help' });
  });

  it('Shift + letter sets the ball result, and Shift + L is slice, not long iron', () => {
    const expected: Record<string, string> = { S: 'solid', P: 'pull', U: 'push', L: 'slice', H: 'hook', F: 'fat', T: 'thin' };
    for (const [key, result] of Object.entries(expected)) {
      expect(k(key, { shiftKey: true })).toEqual({ type: 'result', result });
    }
  });

  it('Cmd or Ctrl + Enter starts; other browser shortcuts are left alone', () => {
    expect(k('Enter', { metaKey: true })).toEqual({ type: 'start' });
    expect(k('Enter', { ctrlKey: true })).toEqual({ type: 'start' });
    expect(k('d', { metaKey: true })).toBeNull();
    expect(k('f', { ctrlKey: true })).toBeNull();
    expect(k('w', { metaKey: true })).toBeNull();
  });

  it('works with Caps Lock on', () => {
    expect(k('D')).toEqual({ type: 'club', club: 'drive' });
  });
});
