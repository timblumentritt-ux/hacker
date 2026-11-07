import { describe, expect, it } from 'vitest';
import { csvCell, metricsCsv } from '../src/lib/csv';
import type { Swing } from '../src/lib/types';

const swing: Swing = {
  id: 'a1', swingType: 'wedge:three-quarter', rating: 4, recordedAt: Date.UTC(2026, 10, 5, 15), recordedAtSource: 'video-metadata',
  uploadedAt: 0, fileName: 'IMG_1.MOV', fileSize: 1, fileLastModified: 0, note: 'pushed, "a bit"', ballResult: 'push',
  videoFileName: null, cameraAngle: 'face-on', frameRate: 240, width: 1080, height: 1920, durationSec: 4, codec: 'hvc1',
  phases: null, metricsVersion: 0, isModel: false,
};

describe('metrics CSV', () => {
  it('escapes commas and quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(3)).toBe('3');
  });

  it('has a row for a swing with no metrics yet, with type, rating, and ball result', () => {
    const lines = metricsCsv([swing], []).trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Wedge, 3/4"');
    expect(lines[1]).toContain(',4,Push,');
    expect(lines[1]).toContain('"pushed, ""a bit"""');
  });

  it('has one row per swing and metric', () => {
    const csv = metricsCsv([swing], [
      { swingId: 'a1', name: 'tempo_ratio', value: 3.1, unit: 'ratio' },
      { swingId: 'a1', name: 'head_shift_x', value: 0.05, unit: 'shoulder widths' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1].endsWith(',tempo_ratio,3.1,ratio')).toBe(true);
  });
});
