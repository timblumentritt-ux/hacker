// Swing shorthand: one short line per swing, typed in Notes on the phone or as a Photos caption.
// Examples: "W 5 push", "M3/4 4 pull felt quick", "D 2 slice", "7i 5", "C 3".
// Format: club, optional 3/4, rating 1-5, optional result, then anything else becomes the note.

import { BALL_RESULTS, type BallResult } from './ballResult';
import { clubById, type ClubId, type Power, type Rating } from './swingTypes';

export interface SwingLabel {
  club: ClubId;
  power: Power;
  rating: Rating;
  result: BallResult | null;
  note: string;
}

export type ParsedLine = { ok: true; label: SwingLabel } | { ok: false; error: string };

// Club words people might type. Letters match the Upload keyboard keys.
const CLUB_WORDS: Record<string, ClubId> = {
  d: 'drive', drive: 'drive', driver: 'drive', dr: 'drive',
  f: 'fairway', fw: 'fairway', wood: 'fairway', fairway: 'fairway', hybrid: 'fairway', hy: 'fairway', h: 'fairway',
  '3w': 'fairway', '5w': 'fairway', '7w': 'fairway',
  l: 'long-iron', long: 'long-iron', '3i': 'long-iron', '4i': 'long-iron', '5i': 'long-iron', '6i': 'long-iron',
  m: 'mid-iron', mid: 'mid-iron', '7i': 'mid-iron', '8i': 'mid-iron', '9i': 'mid-iron',
  w: 'wedge', wedge: 'wedge', pw: 'wedge', gw: 'wedge', aw: 'wedge', sw: 'wedge', lw: 'wedge',
  c: 'chip', chip: 'chip',
};

const THREE_QUARTER = /^(3\/4|¾|q|3q|34)$/;

/** "full" is allowed and simply ignored. */
const FULL = /^full$/;

function resultFor(word: string): BallResult | null {
  const w = word.replace(/[.,!]+$/, '');
  // "push", "pushes", "pushed", "sliced", "thinned", "fatted".
  const forms = (id: string) => [id, `${id}s`, `${id}es`, `${id}ed`, `${id}d`, `${id}${id.at(-1)}ed`];
  return BALL_RESULTS.find((r) => forms(r.id).includes(w))?.id ?? null;
}

/** Strips list markers that Notes adds or people type: "1.", "2)", "-", "•", checkboxes. */
function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:[-•*◦▪]|\d{1,2}[.)]|\[[ x]?\]|[☐☑✓✔])\s+/i, '');
}

export function parseShorthand(input: string): ParsedLine {
  const line = stripListMarker(input).trim();
  if (!line) return { ok: false, error: 'Empty line.' };
  const original = line.split(/\s+/);
  const tokens = original.map((t) => t.toLowerCase());
  let i = 0;

  // Club, possibly with 3/4 or the rating stuck on: "m3/4", "w¾", "mq", "w5", "m3/45".
  let first = tokens[i++];
  let power: Power | null = null;
  const stuckRating = /^([a-z]+)(3\/4|¾|q)?([1-5])$/.exec(first);
  if (stuckRating && CLUB_WORDS[stuckRating[1]] && !CLUB_WORDS[first]) {
    first = stuckRating[1];
    if (stuckRating[2]) power = 'three-quarter';
    tokens.splice(i, 0, stuckRating[3]);
    original.splice(i, 0, stuckRating[3]);
  } else {
    const stuckPower = /^([a-z]+)(3\/4|¾|q)$/.exec(first);
    if (stuckPower && CLUB_WORDS[stuckPower[1]] && !CLUB_WORDS[first]) {
      first = stuckPower[1];
      power = 'three-quarter';
    }
  }
  const club = CLUB_WORDS[first];
  if (!club) {
    return { ok: false, error: `"${original[0]}" is not a club. Start with D, F, L, M, W or C.` };
  }
  const allowed = clubById(club).powers;

  if (!power && i < tokens.length && THREE_QUARTER.test(tokens[i])) {
    power = 'three-quarter';
    i++;
  } else if (!power && i < tokens.length && FULL.test(tokens[i])) {
    i++;
  }
  if (power === 'three-quarter' && !allowed.includes('three-quarter')) {
    return { ok: false, error: `${clubById(club).label} has no three-quarter swing. Only M (7/8/9 iron) and W (wedge) do.` };
  }

  // Rating and result, in either order.
  let rating: Rating | null = null;
  let result: BallResult | null = null;
  for (let n = 0; n < 2 && i < tokens.length; n++) {
    const t = tokens[i].replace(/\/5$/, '');
    if (!rating && /^[1-5]$/.test(t)) {
      rating = Number(t) as Rating;
      i++;
    } else if (!result && resultFor(t)) {
      result = resultFor(t);
      i++;
    } else break;
  }
  if (!rating) {
    const next = original[i];
    return {
      ok: false,
      error: next && /^\d+$/.test(next) ? `The rating must be 1 to 5, not ${next}.` : 'Missing the rating (1 to 5) after the club.',
    };
  }

  return {
    ok: true,
    label: { club, power: power ?? allowed[0], rating, result, note: original.slice(i).join(' ') },
  };
}

export interface NotesLine {
  /** Line number in the pasted text, starting at 1. */
  lineNo: number;
  text: string;
  parsed: ParsedLine;
}

/** Splits pasted notes into swing lines, skipping blank lines. */
export function parseNotes(text: string): NotesLine[] {
  return text
    .split(/\r?\n/)
    .map((t, idx) => ({ lineNo: idx + 1, text: t.trim() }))
    .filter((l) => l.text.length > 0)
    .map((l) => ({ ...l, parsed: parseShorthand(l.text) }));
}
