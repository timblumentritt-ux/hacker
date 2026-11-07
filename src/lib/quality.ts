// Video quality tiers (see SPEC.md, "Video quality").
import type { QualityTier } from './types';

/** 120 fps or more is Full. A little slack allows for 119.88 fps files. */
export const FULL_TIER_MIN_FPS = 119.5;

export function tierFor(fps: number | null): QualityTier {
  if (fps === null || !Number.isFinite(fps) || fps <= 0) return 'unknown';
  return fps >= FULL_TIER_MIN_FPS ? 'full' : 'reduced';
}

export function tierLabel(t: QualityTier): string {
  return t === 'full' ? 'Full' : t === 'reduced' ? 'Reduced' : 'Unknown';
}
