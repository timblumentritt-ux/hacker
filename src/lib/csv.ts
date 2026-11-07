// Metrics CSV export: one row per swing and metric (see SPEC.md, "Backup file").
import { ballResultLabel } from './ballResult';
import { parseSwingTypeId, clubById } from './swingTypes';
import type { Swing } from './types';

export interface MetricRow {
  swingId: string;
  name: string;
  value: number;
  unit: string;
}

const HEADER = [
  'swing_id', 'swing_type', 'club', 'power', 'rating', 'ball_result', 'recorded_at',
  'file_name', 'note', 'model_5', 'metric', 'value', 'unit',
];

export function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Swings with no metrics yet still get one row, so labels and ball results export. */
export function metricsCsv(swings: Swing[], metrics: MetricRow[]): string {
  const bySwing = new Map<string, MetricRow[]>();
  for (const m of metrics) bySwing.set(m.swingId, [...(bySwing.get(m.swingId) ?? []), m]);
  const lines = [HEADER.join(',')];
  const sorted = [...swings].sort((a, b) => a.swingType.localeCompare(b.swingType) || b.rating - a.rating || a.recordedAt - b.recordedAt);
  for (const s of sorted) {
    const t = parseSwingTypeId(s.swingType);
    const base = [
      s.id, t.label, clubById(t.club).label, t.power === 'none' ? '' : t.power, s.rating,
      ballResultLabel(s.ballResult), new Date(s.recordedAt).toISOString(), s.fileName, s.note, s.isModel ? 'yes' : '',
    ];
    const rows = bySwing.get(s.id) ?? [];
    if (rows.length === 0) lines.push([...base, '', '', ''].map(csvCell).join(','));
    for (const m of rows) lines.push([...base, m.name, m.value, m.unit].map(csvCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
