// Upload and label (see SPEC.md, "How a swing gets in" and "Fast labeling").
// In milestone 1, "analysis" reads the video header, checks the video plays, and saves the labeled swing.
// Pose, phases, and metrics arrive in milestones 2 and 3.

import type { Screen } from '../app';
import { choose, formatDate, h } from '../dom';
import { KEY_HELP, keyToAction, type KeyAction } from '../keys';
import { BALL_RESULTS, ballResultHint, isBallResult, type BallResult, type Handedness } from '../../lib/ballResult';
import { codecName, fileReader, readVideoHeader, type VideoHeader } from '../../lib/mp4';
import { tierFor, tierLabel } from '../../lib/quality';
import {
  addLog, addSwing, flushVideoDeletes, getProfile, keepVideo, uploadLog, wasUploaded,
} from '../../lib/store';
import {
  RATINGS, SWING_TYPES, makeSwingTypeId, nextPower, parseSwingTypeId, powerForClub,
  type ClubId, type Power, type Rating,
} from '../../lib/swingTypes';
import { dupKeyOf, type QualityTier, type Swing, type UploadLogEntry } from '../../lib/types';
import { isQuotaError } from '../../lib/db';
import * as folder from '../../lib/videoFolder';
import { formatBytes } from '../../lib/storage';
import { parseNotes, parseShorthand, type SwingLabel } from '../../lib/shorthand';

const FORMAT_HELP =
  'This browser cannot play this video. On the iPhone, open Settings → Camera → Formats and choose Most Compatible, then film again. ' +
  'On a Windows PC, installing "HEVC Video Extensions" from the Microsoft Store can also help.';

interface Clip {
  key: string;
  file: File;
  url: string;
  dupKey: string;
  header: VideoHeader | null;
  recordedAt: number;
  recordedAtSource: Swing['recordedAtSource'];
  fps: number | null;
  tier: QualityTier;
  thumb: string | null;
  readable: 'pending' | 'ok' | 'failed';
  duplicate: boolean;
  club: ClubId | null;
  power: Power | null;
  rating: Rating | null;
  result: BallResult | null;
  note: string;
  mode: 'save' | 'check';
  status: 'ready' | 'working' | 'done' | 'skipped' | 'failed';
  message: string;
  missing: boolean;
  /** Where the labels came from, or a problem with a caption, shown under the row's status. */
  labelInfo: { kind: 'ok' | 'warn'; text: string } | null;
}

// The batch lives outside the screen, so it survives moving to another screen and back,
// and saving keeps running in the background.
const state = {
  clips: [] as Clip[],
  selected: 0,
  showHelp: true,
  running: false,
  progress: '',
  banner: '',
  /** False until the golfer labels or picks a clip; until then the selection stays on the first clip. */
  touched: false,
};
let rerender: (() => void) | null = null;
const changed = () => rerender?.();

/** True while clips are being saved, so the golfer cannot switch profiles midway. */
export function uploadBusy(): boolean {
  return state.running;
}

/** Forgets the clips waiting in the Upload table, for example when switching golfers. */
export function resetUploadBatch(): void {
  if (state.running) return;
  for (const c of state.clips) URL.revokeObjectURL(c.url);
  state.clips = [];
  state.selected = 0;
  state.progress = '';
  state.banner = '';
  state.touched = false;
}

const isVideoFile = (f: File) => f.type.startsWith('video/') || /\.(mov|mp4|m4v)$/i.test(f.name);
const editable = (c: Clip) => c.status === 'ready' && !state.running;
const current = (): Clip | undefined => state.clips[state.selected];

function sortClips(): void {
  const selKey = current()?.key;
  state.clips.sort((a, b) => a.recordedAt - b.recordedAt || a.file.name.localeCompare(b.file.name));
  const i = state.clips.findIndex((c) => c.key === selKey);
  state.selected = state.touched ? Math.max(0, i) : Math.max(0, state.clips.findIndex((c) => c.status === 'ready'));
}

async function addFiles(files: File[]): Promise<void> {
  const known = new Set(state.clips.map((c) => c.dupKey));
  const added: Clip[] = [];
  for (const file of files) {
    if (!isVideoFile(file)) continue;
    const dupKey = dupKeyOf(file);
    if (known.has(dupKey)) continue;
    known.add(dupKey);
    const clip: Clip = {
      key: crypto.randomUUID(), file, url: URL.createObjectURL(file), dupKey, header: null,
      recordedAt: file.lastModified, recordedAtSource: 'file-date', fps: null, tier: 'unknown', thumb: null,
      readable: 'pending', duplicate: false, club: null, power: null, rating: null, result: null, note: '',
      mode: 'save', status: 'ready', message: '', missing: false, labelInfo: null,
    };
    state.clips.push(clip);
    added.push(clip);
  }
  if (added.length === 0) return;
  if (!state.clips.some((c) => c.status === 'ready' && !added.includes(c))) state.touched = false;
  state.banner = '';
  sortClips();
  changed();
  for (const clip of added) {
    await inspect(clip);
    sortClips();
    changed();
  }
}

async function inspect(clip: Clip): Promise<void> {
  try {
    clip.header = await readVideoHeader(fileReader(clip.file), clip.file.size);
  } catch {
    clip.header = null;
  }
  if (clip.header?.recordedAt) {
    clip.recordedAt = clip.header.recordedAt;
    clip.recordedAtSource = 'video-metadata';
  }
  clip.fps = clip.header?.nominalFps ?? null;
  clip.tier = tierFor(clip.fps);
  if (clip.tier === 'reduced') clip.mode = 'check';
  clip.duplicate = await wasUploaded(clip.dupKey);
  clip.thumb = await makeThumb(clip.url);
  clip.readable = clip.thumb ? 'ok' : 'failed';
  applyCaption(clip);
}

function applyLabel(c: Clip, label: SwingLabel): void {
  c.club = label.club;
  c.power = label.power;
  c.rating = label.rating;
  c.result = label.result;
  c.note = label.note;
  c.missing = false;
}

/** If the video carries a caption in the swing shorthand, use it, unless the golfer has labeled the clip already. */
function applyCaption(c: Clip): void {
  const caption = c.header?.caption;
  if (!caption || c.club || c.rating) return;
  const parsed = parseShorthand(caption);
  if (parsed.ok) {
    applyLabel(c, parsed.label);
    c.labelInfo = { kind: 'ok', text: `Filled in from the video's caption "${caption}".` };
  } else {
    c.labelInfo = { kind: 'warn', text: `Caption "${caption}" not understood: ${parsed.error}` };
  }
}

/** Fills in clips from pasted notes: line 1 goes to the first waiting clip, line 2 to the second, and so on. */
function applyNotes(text: string): { filled: number; problems: string[]; summary: string } {
  const lines = parseNotes(text);
  const waiting = state.clips.filter((c) => c.status === 'ready');
  const problems: string[] = [];
  let filled = 0;
  lines.forEach((line, i) => {
    const clip = waiting[i];
    if (!clip) return;
    if (line.parsed.ok) {
      applyLabel(clip, line.parsed.label);
      clip.labelInfo = { kind: 'ok', text: `Filled in from your notes: "${line.text}".` };
      filled++;
    } else {
      clip.labelInfo = { kind: 'warn', text: `Note "${line.text}" not understood: ${line.parsed.error}` };
      problems.push(`Line ${line.lineNo} ("${line.text}"), clip ${state.clips.indexOf(clip) + 1}: ${line.parsed.error}`);
    }
  });
  let summary = `Filled in ${filled} of ${waiting.length} clip${waiting.length === 1 ? '' : 's'}.`;
  if (lines.length > waiting.length) summary += ` ${lines.length - waiting.length} extra line${lines.length - waiting.length === 1 ? ' was' : 's were'} not used: there are more lines than clips.`;
  if (lines.length < waiting.length) summary += ` ${waiting.length - lines.length} clip${waiting.length - lines.length === 1 ? ' has' : 's have'} no line: there are more clips than lines.`;
  if (lines.length !== waiting.length) summary += ' Check that the notes and clips line up.';
  state.touched = true;
  changed();
  return { filled, problems, summary };
}

/** Draws one early frame. Returns null if the browser cannot decode the video. */
function makeThumb(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    let done = false;
    const finish = (r: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      resolve(r);
    };
    const timer = setTimeout(() => finish(null), 20_000);
    v.onerror = () => finish(null);
    v.onloadedmetadata = () => {
      if (!v.videoWidth) return finish(null); // audio only: the video track cannot be decoded
      v.currentTime = Math.min(v.duration * 0.2, 3);
    };
    v.onseeked = () => {
      const c = document.createElement('canvas');
      const scale = 200 / Math.max(v.videoWidth, v.videoHeight);
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      finish(c.toDataURL('image/jpeg', 0.7));
    };
    v.src = url;
  });
}

function applyAction(a: KeyAction, ui: { preview: HTMLVideoElement; focusNote: () => void }): void {
  const c = current();
  if (a.type !== 'play' && a.type !== 'help') state.touched = true;
  switch (a.type) {
    case 'move':
      state.selected = Math.max(0, Math.min(state.clips.length - 1, state.selected + a.delta));
      return changed();
    case 'help':
      state.showHelp = !state.showHelp;
      return changed();
    case 'play':
      if (ui.preview.paused) ui.preview.play().catch(() => {});
      else ui.preview.pause();
      return;
    case 'start':
      void startAnalysis();
      return;
  }
  if (!c || !editable(c)) return;
  switch (a.type) {
    case 'rating':
      c.rating = a.rating;
      break;
    case 'club':
      c.club = a.club;
      c.power = powerForClub(a.club, c.power);
      break;
    case 'power':
      if (c.club) c.power = nextPower(c.club, c.power ?? 'full');
      break;
    case 'result':
      c.result = c.result === a.result ? null : a.result;
      break;
    case 'copy-previous': {
      const prev = state.clips[state.selected - 1];
      if (prev) {
        c.club = prev.club;
        c.power = prev.power;
        c.result = prev.result;
      }
      break;
    }
    case 'toggle-mode':
      if (c.tier === 'reduced') state.banner = 'This clip is under 120 fps (Reduced), so it can only be checked, not saved.';
      else c.mode = c.mode === 'save' ? 'check' : 'save';
      break;
    case 'note':
      ui.focusNote();
      return;
    case 'remove':
      URL.revokeObjectURL(c.url);
      state.clips.splice(state.selected, 1);
      state.selected = Math.min(state.selected, Math.max(0, state.clips.length - 1));
      break;
  }
  c.missing = false;
  changed();
}

async function startAnalysis(): Promise<void> {
  if (state.running) return;
  const todo = state.clips.filter((c) => c.status === 'ready');
  if (todo.length === 0) {
    state.banner = 'There are no clips waiting. Drop some videos first.';
    return changed();
  }
  if (todo.some((c) => c.readable === 'pending')) {
    state.banner = 'Still reading the clips. Try again in a moment.';
    return changed();
  }
  const needsLabels = (c: Clip) => c.mode === 'save' && c.readable === 'ok' && !c.duplicate && (!c.club || !c.rating);
  const missing = todo.filter(needsLabels);
  if (missing.length > 0) {
    for (const c of todo) c.missing = needsLabels(c);
    state.selected = state.clips.indexOf(missing[0]);
    state.banner = `${missing.length} clip${missing.length === 1 ? ' needs' : 's need'} a swing type and a rating before saving (highlighted).`;
    return changed();
  }

  let keepVideos = false;
  if (todo.some((c) => c.mode === 'save')) {
    let st = await folder.getStatus();
    if (st.state === 'needs-permission' || st.state === 'error') {
      const choice = await choose(
        'Video folder not connected',
        `Hacker cannot reach the video folder "${st.name}" right now. Reconnect it to keep these videos, or continue and save the swings without their videos.`,
        [
          { label: 'Continue without keeping video', value: 'continue' },
          { label: 'Reconnect folder', value: 'reconnect', primary: true },
        ],
      );
      if (choice === null) return;
      if (choice === 'reconnect') st = await folder.reconnect();
    }
    keepVideos = st.state === 'ready';
    if (keepVideos) await flushVideoDeletes();
  }

  state.running = true;
  state.banner = '';
  let stopped = false;
  for (let i = 0; i < todo.length; i++) {
    state.progress = `Working on clip ${i + 1} of ${todo.length}…`;
    todo[i].status = 'working';
    changed();
    if ((await processClip(todo[i], keepVideos)) === 'stop') {
      stopped = true;
      break;
    }
  }
  state.running = false;
  const saved = todo.filter((c) => c.status === 'done' && c.mode === 'save').length;
  state.progress = stopped ? 'Stopped.' : `Finished: ${saved} saved, ${todo.length - saved} not saved. See each row for details.`;
  changed();
}

async function processClip(c: Clip, keepVideos: boolean): Promise<'ok' | 'stop'> {
  const base = { fileName: c.file.name, fileSize: c.file.size, fileLastModified: c.file.lastModified, dupKey: c.dupKey };
  const log = (result: UploadLogEntry['result'], message: string, swingId: string | null = null) =>
    addLog({ ...base, time: Date.now(), result, message, swingId }).catch(() => {});

  if (c.readable !== 'ok') {
    c.status = 'failed';
    c.message = FORMAT_HELP;
    await log('video format not supported', FORMAT_HELP);
    return 'ok';
  }
  if (c.mode === 'check') {
    c.status = 'done';
    c.message = 'Checked only, nothing saved. Pose analysis and metrics arrive in milestone 2.';
    await log('checked', c.message);
    return 'ok';
  }
  if (await wasUploaded(c.dupKey)) {
    c.status = 'skipped';
    c.message = 'Already uploaded, skipped.';
    await log('already uploaded', c.message);
    return 'ok';
  }

  const h = c.header;
  const swing: Swing = {
    id: crypto.randomUUID(),
    swingType: makeSwingTypeId(c.club!, c.power!),
    rating: c.rating!,
    recordedAt: c.recordedAt,
    recordedAtSource: c.recordedAtSource,
    uploadedAt: Date.now(),
    fileName: c.file.name,
    fileSize: c.file.size,
    fileLastModified: c.file.lastModified,
    note: c.note.trim(),
    ballResult: c.result,
    videoFileName: null,
    cameraAngle: 'face-on',
    frameRate: c.fps,
    width: h?.width ?? null,
    height: h?.height ?? null,
    durationSec: h?.durationSec ?? null,
    codec: h?.codec ?? null,
    phases: null,
    metricsVersion: 0,
    isModel: false,
  };

  let result;
  try {
    result = await addSwing(swing, base);
  } catch (e) {
    c.status = 'failed';
    if (isQuotaError(e)) {
      c.message = "The browser's storage is full or blocked. Nothing from this clip was saved. Free some disk space, then upload again.";
      await log('storage full', c.message);
      state.banner = c.message;
      return 'stop';
    }
    c.message = `Could not save: ${e instanceof Error ? e.message : String(e)}`;
    await log('error', c.message);
    return 'ok';
  }

  const parts: string[] = [];
  if (!result.kept) {
    parts.push('Counted, but not kept: it is older than the five swings already stored for this swing type and rating.');
  } else {
    parts.push('Saved.');
    if (result.evicted.length) parts.push(`Replaced ${result.evicted.length} older swing${result.evicted.length > 1 ? 's' : ''} in this set.`);
    if (keepVideos) {
      const v = await keepVideo(result.swing, c.file);
      if (v?.ok) parts.push('Video kept.');
      else if (v && v.reason === 'disk-full') {
        const size = await folder.folderSize().catch(() => null);
        parts.push(`Video not kept: the disk is full. The video folder uses ${formatBytes(size?.bytes ?? null)}.`);
      } else if (v) parts.push(`Video not kept: ${v.message}`);
    }
  }
  c.status = 'done';
  c.message = parts.join(' ');
  return 'ok';
}

// ---------- screen ----------

export const uploadScreen: Screen = {
  title: 'Upload',
  async mount(root) {
    const hand: Handedness = (await getProfile())?.handedness ?? 'right';

    const fileInput = h('input', {
      type: 'file', multiple: true, accept: 'video/*,.mov,.mp4', hidden: true,
      onchange: () => {
        void addFiles([...(fileInput.files ?? [])]);
        fileInput.value = '';
      },
    });
    const drop = h('div', { class: 'dropzone' },
      'Drop swing videos here, or ', h('button', { onclick: () => fileInput.click() }, 'choose videos'), fileInput);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      void addFiles([...(e.dataTransfer?.files ?? [])]);
    });

    const folderLine = h('div', { class: 'row' });
    const refreshFolder = async () => {
      const st = await folder.getStatus();
      folderLine.replaceChildren();
      if (st.state === 'ready') folderLine.append(h('span', { class: 'muted' }, `Videos are kept in "${folder.displayPath(st.name)}".`));
      else if (st.state === 'needs-permission' || st.state === 'error')
        folderLine.append(
          h('span', { class: 'warn' }, `The video folder "${st.name}" needs to be reconnected.`),
          h('button', { onclick: async () => { await folder.reconnect(); await flushVideoDeletes(); void refreshFolder(); } }, 'Reconnect folder'),
        );
      else folderLine.append(h('span', { class: 'muted' }, 'No video folder chosen, so videos are not kept. You can choose one in Settings.'));
    };
    void refreshFolder();

    const preview = h('video', { controls: true, muted: true, playsInline: true });
    const previewName = h('div', { class: 'muted' });
    const speed = h('select', { onchange: () => (preview.playbackRate = Number(speed.value)) },
      ['1', '0.5', '0.25', '0.125'].map((s) => h('option', { value: s }, `${s}×`)));
    preview.addEventListener('loadedmetadata', () => (preview.playbackRate = Number(speed.value)));
    let previewKey = '';

    const keysBox = h('div', { class: 'card' });
    const table = h('div', { class: 'table-scroll' });
    const logBox = h('div');
    const statusLine = h('div');

    const notesInput = h('textarea', {
      rows: 6, style: 'width: 100%; font-family: ui-monospace, monospace',
      placeholder: 'W 5 push\nM3/4 4 pull felt quick\nD 2 slice\nC 5',
    });
    const notesResult = h('div');
    const notesBox = h('details', { class: 'card' },
      h('summary', null, h('strong', null, 'Paste notes from your phone'), h('span', { class: 'muted' }, ' – fill in many clips at once')),
      h('p', null, 'One line per swing, in the order you filmed them. Line 1 fills the first waiting clip, line 2 the second, and so on. ',
        h('a', { href: '#/guide' }, 'How to write the lines')),
      notesInput,
      h('div', { class: 'row' },
        h('button', {
          class: 'primary',
          onclick: () => {
            if (!state.clips.some((c) => c.status === 'ready')) {
              notesResult.replaceChildren(h('p', { class: 'warn' }, 'Drop the videos first, then paste your notes.'));
              return;
            }
            if (state.clips.some((c) => c.readable === 'pending')) {
              notesResult.replaceChildren(h('p', { class: 'warn' }, 'Still reading the clips. Try again in a moment.'));
              return;
            }
            const r = applyNotes(notesInput.value);
            notesResult.replaceChildren(
              h('p', { class: r.problems.length || /line up/.test(r.summary) ? 'warn' : 'good' }, r.summary),
              r.problems.length ? h('ul', null, r.problems.map((p) => h('li', { class: 'warn' }, p))) : '',
            );
          },
        }, 'Fill in clips'),
        h('span', { class: 'muted' }, 'You can still change anything afterwards.'),
      ),
      notesResult,
    );

    const focusNote = () => {
      const input = table.querySelector<HTMLInputElement>('tr.selected input.note');
      input?.focus();
      input?.select();
    };

    const select = <T extends string | number>(
      value: T | null, options: [T, string][], disabled: boolean, onPick: (v: string) => void, title?: string,
    ) => h('select', {
      disabled, title,
      onchange: (e: Event) => { onPick((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).blur(); changed(); },
    },
      h('option', { value: '', selected: value === null }, '—'),
      options.map(([v, label]) => h('option', { value: String(v), selected: value === v }, label)));

    const renderRow = (c: Clip, i: number) => {
      const off = !editable(c);
      const typeId = c.club && c.power ? makeSwingTypeId(c.club, c.power) : null;
      const hdr = c.header;
      const videoInfo = c.readable === 'pending'
        ? h('span', { class: 'muted' }, 'reading…')
        : [
            h('span', { class: `tier-${c.tier}` }, tierLabel(c.tier)), ' ',
            c.fps ? `${Math.round(c.fps)} fps` : 'fps unknown',
            h('br'),
            h('span', { class: 'muted' }, `${hdr?.width ?? '?'}×${hdr?.height ?? '?'} ${codecName(hdr?.codec ?? null)}`),
          ];
      let status: Node | string = '';
      if (c.status === 'working') status = 'working…';
      else if (c.status !== 'ready') status = h('span', { class: c.status === 'done' ? 'good' : c.status === 'failed' ? 'error' : 'warn' }, c.message);
      else if (c.readable === 'failed') status = h('span', { class: 'error' }, 'Cannot play this video in this browser.');
      else if (c.duplicate) status = h('span', { class: 'warn' }, 'Already uploaded; will be skipped.');
      else if (c.labelInfo) status = h('span', { class: c.labelInfo.kind === 'ok' ? 'muted' : 'warn' }, c.labelInfo.text);

      const note = h('input', {
        class: 'note', type: 'text', value: c.note, disabled: off, placeholder: 'note',
        oninput: (e: Event) => (c.note = (e.target as HTMLInputElement).value),
        onfocus: () => { state.touched = true; if (state.selected !== i) { state.selected = i; updateSelection(); } },
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          e.stopPropagation();
        },
      });

      return h('tr', {
        class: `${i === state.selected ? 'selected' : ''} ${c.missing ? 'missing' : ''}`,
        onclick: () => { state.touched = true; if (state.selected !== i) { state.selected = i; changed(); } },
      },
        h('td', null, String(i + 1)),
        h('td', null, c.thumb ? h('img', { src: c.thumb, alt: '' }) : ''),
        h('td', null, c.file.name, h('br'), h('span', { class: 'muted', title: c.recordedAtSource === 'video-metadata' ? 'Recording date from the video' : 'File date (the video had no recording date)' }, formatDate(c.recordedAt))),
        h('td', null, videoInfo),
        h('td', { class: 'need' }, select(typeId, SWING_TYPES.map((t) => [t.id, t.label]), off, (v) => {
          if (!v) { c.club = null; c.power = null; return; }
          const t = parseSwingTypeId(v);
          c.club = t.club;
          c.power = t.power;
        })),
        h('td', { class: 'need' }, select(c.rating, RATINGS.map((r) => [r, String(r)]), off, (v) => (c.rating = v ? (Number(v) as Rating) : null))),
        h('td', null, select(c.result, BALL_RESULTS.map((r) => [r.id, r.label]), off,
          (v) => (c.result = isBallResult(v) ? v : null), c.result ? ballResultHint(c.result, hand) : 'Where the ball went (optional)')),
        h('td', null, note),
        h('td', null, h('select', {
          disabled: off || c.tier === 'reduced',
          title: c.tier === 'reduced' ? 'Under 120 fps: Check only' : '',
          onchange: (e: Event) => { c.mode = (e.target as HTMLSelectElement).value as Clip['mode']; (e.target as HTMLSelectElement).blur(); changed(); },
        }, h('option', { value: 'save', selected: c.mode === 'save' }, 'Save'), h('option', { value: 'check', selected: c.mode === 'check' }, 'Check only'))),
        h('td', { style: 'white-space: normal; max-width: 260px' }, status),
      );
    };

    const updateSelection = () => {
      table.querySelectorAll('tbody tr').forEach((tr, i) => tr.classList.toggle('selected', i === state.selected));
      updatePreview();
    };

    const updatePreview = () => {
      const c = current();
      if (!c) {
        preview.removeAttribute('src');
        previewKey = '';
        previewName.textContent = 'No clip selected.';
        return;
      }
      if (c.key !== previewKey) {
        previewKey = c.key;
        preview.src = c.url;
      }
      previewName.textContent = `${state.selected + 1}. ${c.file.name}`;
    };

    const render = async () => {
      const ready = state.clips.filter((c) => c.status === 'ready').length;
      statusLine.replaceChildren(
        h('div', { class: 'row' },
          h('button', { class: 'primary', disabled: state.running || ready === 0, onclick: () => void startAnalysis() }, `Analyze and save ${ready} clip${ready === 1 ? '' : 's'}`),
          h('span', { class: 'muted' }, 'or press Cmd/Ctrl + Enter'),
          state.clips.some((c) => c.status !== 'ready') && !state.running
            ? h('button', { onclick: () => { state.clips = state.clips.filter((c) => { const keep = c.status === 'ready'; if (!keep) URL.revokeObjectURL(c.url); return keep; }); state.selected = 0; state.progress = ''; changed(); } }, 'Clear finished')
            : '',
        ),
        state.progress ? h('p', null, state.progress) : '',
        state.banner ? h('p', { class: 'warn' }, state.banner) : '',
      );

      table.replaceChildren(state.clips.length === 0
        ? h('p', { class: 'muted' }, 'No clips yet. Clips are listed by recording time, oldest first, to match your notes.')
        : h('table', { class: 'clips' },
            h('thead', null, h('tr', null, ['#', '', 'Clip', 'Video', 'Swing type', 'Rating', 'Result', 'Note', 'Save?', 'Status'].map((t) => h('th', null, t)))),
            h('tbody', null, state.clips.map(renderRow)),
          ));
      table.querySelector('tr.selected')?.scrollIntoView({ block: 'nearest' });

      keysBox.replaceChildren(
        h('div', { class: 'row' }, h('strong', null, 'Keys'), h('button', { onclick: () => { state.showHelp = !state.showHelp; changed(); } }, state.showHelp ? 'Hide (?)' : 'Show (?)')),
        state.showHelp ? h('table', { class: 'keys' }, KEY_HELP.map(([k, d]) => h('tr', null, h('td', null, k), h('td', null, d)))) : '',
      );
      updatePreview();
    };

    const renderLog = async () => {
      const entries = (await uploadLog()).slice(0, 30);
      logBox.replaceChildren(
        h('h2', null, 'Upload log'),
        entries.length === 0 ? h('p', { class: 'muted' }, 'Nothing uploaded yet.') :
          h('table', null,
            h('thead', null, h('tr', null, ['Time', 'File', 'Result', 'Details'].map((t) => h('th', null, t)))),
            h('tbody', null, entries.map((e) => h('tr', null,
              h('td', null, formatDate(e.time)), h('td', null, e.fileName), h('td', null, e.result),
              h('td', { style: 'max-width: 480px' }, e.message))))),
      );
    };

    rerender = () => { void render(); if (!state.running) void renderLog(); };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (document.querySelector('dialog[open]')) return;
      const action = keyToAction(e);
      if (!action) return;
      e.preventDefault();
      applyAction(action, { preview, focusNote });
    };
    document.addEventListener('keydown', onKey);

    root.append(
      h('h1', null, 'Upload swings'),
      folderLine,
      h('div', { class: 'upload-layout' },
        h('div', null, drop, notesBox, statusLine, table, logBox),
        h('div', { class: 'preview' },
          h('div', { class: 'card' }, previewName, preview, h('div', { class: 'row' }, 'Speed ', speed, h('span', { class: 'muted' }, 'Space plays or pauses'))),
          keysBox,
        ),
      ),
    );
    changed();

    return () => {
      document.removeEventListener('keydown', onKey);
      preview.pause();
      rerender = null;
    };
  },
};
