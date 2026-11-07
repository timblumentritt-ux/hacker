// Stored records (see SPEC.md, "Data model").

import type { BallResult, Handedness } from './ballResult';
import type { Rating, SwingTypeId } from './swingTypes';

export interface Profile {
  name: string;
  handedness: Handedness;
}

export type KeepVideoMode = 'all' | 'model-only';

export interface Settings {
  keepVideo: KeepVideoMode;
}

export const DEFAULT_SETTINGS: Settings = { keepVideo: 'all' };

export type QualityTier = 'full' | 'reduced' | 'unknown';

/** Phase times in seconds from the start of the clip. Filled in by milestone 2. */
export interface PhaseTimes {
  address: number;
  top: number;
  impact: number;
  finish: number;
}

export interface Swing {
  id: string;
  swingType: SwingTypeId;
  rating: Rating;
  /** Recording date, ms since 1970. */
  recordedAt: number;
  recordedAtSource: 'video-metadata' | 'file-date';
  /** Upload date, ms since 1970. */
  uploadedAt: number;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  note: string;
  ballResult: BallResult | null;
  /** Name of the video file inside the Hacker Data folder, if kept. */
  videoFileName: string | null;
  cameraAngle: 'face-on';
  /** Frame rate from the file header; milestone 2 measures the real one. */
  frameRate: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  codec: string | null;
  phases: PhaseTimes | null;
  /** 0 until metrics exist (milestone 3). */
  metricsVersion: number;
  isModel: boolean;
}

export interface UploadCounter {
  swingType: SwingTypeId;
  count: number;
}

export type UploadResult =
  | 'saved'
  | 'saved-dropped' // saved, but older than the five already stored, so dropped at once
  | 'checked'
  | 'already uploaded'
  | 'video format not supported'
  | 'storage full'
  | 'error';

export interface UploadLogEntry {
  id?: number;
  time: number;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  /** name|size|lastModified, used to spot duplicate uploads. */
  dupKey: string;
  result: UploadResult;
  message: string;
  swingId: string | null;
}

export function dupKeyOf(f: { name: string; size: number; lastModified: number }): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

/** Results that count as "uploaded before" for duplicate detection. */
export const UPLOADED_RESULTS: readonly UploadResult[] = ['saved', 'saved-dropped'];
