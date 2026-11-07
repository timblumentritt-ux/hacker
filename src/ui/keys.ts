// Keyboard shortcuts for fast labeling in the Upload table (see SPEC.md, "Fast labeling").
// Pure mapping from a key press to an action, so it can be tested from the terminal.

import { BALL_RESULTS, type BallResult } from '../lib/ballResult';
import { CLUBS, type ClubId, type Rating } from '../lib/swingTypes';

export type KeyAction =
  | { type: 'move'; delta: -1 | 1 }
  | { type: 'rating'; rating: Rating }
  | { type: 'club'; club: ClubId }
  | { type: 'power' }
  | { type: 'result'; result: BallResult }
  | { type: 'copy-previous' }
  | { type: 'toggle-mode' }
  | { type: 'play' }
  | { type: 'start' }
  | { type: 'help' }
  | { type: 'note' }
  | { type: 'remove' };

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export function keyToAction(e: KeyLike): KeyAction | null {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') return { type: 'start' };
  // Leave every other browser shortcut (Cmd+D, Ctrl+F and so on) alone.
  if (e.metaKey || e.ctrlKey || e.altKey) return null;

  switch (e.key) {
    case 'ArrowUp':
      return { type: 'move', delta: -1 };
    case 'ArrowDown':
      return { type: 'move', delta: 1 };
    case '?':
      return { type: 'help' };
    case '=':
      return { type: 'copy-previous' };
    case ' ':
      return { type: 'play' };
    case 'Enter':
      return { type: 'note' };
    case 'Delete':
    case 'Backspace':
      return { type: 'remove' };
  }

  const k = e.key.toLowerCase();
  if (k.length !== 1) return null;

  if (e.shiftKey) {
    const r = BALL_RESULTS.find((b) => b.key === k);
    return r ? { type: 'result', result: r.id } : null;
  }
  if (k >= '1' && k <= '5') return { type: 'rating', rating: Number(k) as Rating };
  const club = CLUBS.find((c) => c.key === k);
  if (club) return { type: 'club', club: club.id };
  if (k === 'q') return { type: 'power' };
  if (k === 'o') return { type: 'toggle-mode' };
  if (k === 'n') return { type: 'note' };
  return null;
}

/** The key list shown on screen. */
export const KEY_HELP: readonly [string, string][] = [
  ['↑ ↓', 'Move between clips'],
  ['1 – 5', 'Set the rating'],
  ['D F L M W C', 'Swing type: Drive, Fairway wood, Long iron (4/5/6), Mid iron (7/8/9), Wedge, Chip'],
  ['Q', 'Switch full / three-quarters, where allowed'],
  ['Shift + S P U L H F T', 'Result: Solid, Pull, pUsh, sLice, Hook, Fat, Thin (again to clear)'],
  ['=', "Copy the previous clip's swing type, power, and result"],
  ['O', 'Switch between Save and Check only'],
  ['N or Enter', 'Type a note (Enter or Esc to finish)'],
  ['Delete', 'Remove the clip from this batch'],
  ['Space', 'Play or pause the preview'],
  ['Cmd/Ctrl + Enter', 'Start analysis'],
  ['?', 'Show or hide this list'],
];
