// Optional ball result for each swing (see SPEC.md, "Ball result").

export type Handedness = 'right' | 'left';
export type BallResult = 'solid' | 'pull' | 'push' | 'slice' | 'hook' | 'fat' | 'thin';

export interface BallResultInfo {
  id: BallResult;
  label: string;
  /** Pressed with Shift in the Upload table. */
  key: string;
}

export const BALL_RESULTS: readonly BallResultInfo[] = [
  { id: 'solid', label: 'Solid', key: 's' },
  { id: 'pull', label: 'Pull', key: 'p' },
  { id: 'push', label: 'Push', key: 'u' },
  { id: 'slice', label: 'Slice', key: 'l' },
  { id: 'hook', label: 'Hook', key: 'h' },
  { id: 'fat', label: 'Fat', key: 'f' },
  { id: 'thin', label: 'Thin', key: 't' },
];

export function isBallResult(v: unknown): v is BallResult {
  return BALL_RESULTS.some((r) => r.id === v);
}

export function ballResultLabel(r: BallResult | null): string {
  return r ? (BALL_RESULTS.find((b) => b.id === r)?.label ?? r) : '';
}

/** Tooltip explaining the result for this golfer's hand. */
export function ballResultHint(r: BallResult, hand: Handedness): string {
  const right = hand === 'right';
  const L = right ? 'left' : 'right';
  const R = right ? 'right' : 'left';
  switch (r) {
    case 'solid':
      return 'Struck well, on line.';
    case 'pull':
      return `Starts ${L} of the target and stays there.`;
    case 'push':
      return `Starts ${R} of the target and stays there.`;
    case 'slice':
      return `Curves hard to the ${R}.`;
    case 'hook':
      return `Curves hard to the ${L}.`;
    case 'fat':
      return 'Hits the ground before the ball.';
    case 'thin':
      return 'Hits the ball low on the face, too little ground.';
  }
}
