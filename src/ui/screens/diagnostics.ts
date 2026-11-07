// Diagnostics for milestone 0: can this browser play iPhone video, and can it use a folder?
// The owner runs this on each Mac and PC and copies the results back.
import type { Screen } from '../app';
import { h } from '../dom';
import { codecName, fileReader, readVideoHeader } from '../../lib/mp4';
import { getMeta, setMeta } from '../../lib/db';
import { tierFor, tierLabel } from '../../lib/quality';

const CODECS: [string, string][] = [
  ['H.264 (Most Compatible)', 'avc1.640028'],
  ['HEVC 8-bit (High Efficiency)', 'hvc1.1.6.L123.B0'],
  ['HEVC 10-bit (HDR)', 'hvc1.2.4.L123.B0'],
];

export interface CodecResult {
  name: string;
  canPlayType: string;
  mediaCapabilities: string;
  webCodecs: string;
}

export async function codecSupport(): Promise<CodecResult[]> {
  const out: CodecResult[] = [];
  for (const [name, codec] of CODECS) {
    const type = `video/mp4; codecs="${codec}"`;
    const canPlayType = document.createElement('video').canPlayType(type) || 'no';
    let mediaCapabilities = 'n/a';
    try {
      const r = await navigator.mediaCapabilities.decodingInfo({
        type: 'file',
        video: { contentType: type, width: 1920, height: 1080, bitrate: 20_000_000, framerate: 240 },
      });
      mediaCapabilities = r.supported ? `yes${r.powerEfficient ? ' (hardware)' : ''}` : 'no';
    } catch (e) {
      mediaCapabilities = `error: ${(e as Error).message}`;
    }
    let webCodecs = 'n/a';
    if ('VideoDecoder' in window) {
      try {
        const r = await VideoDecoder.isConfigSupported({ codec, codedWidth: 1920, codedHeight: 1080 });
        webCodecs = r.supported ? 'yes' : 'no';
      } catch (e) {
        webCodecs = `error: ${(e as Error).message}`;
      }
    }
    out.push({ name, canPlayType, mediaCapabilities, webCodecs });
  }
  return out;
}

function browserName(): string {
  const ua = navigator.userAgent;
  const edge = /Edg\/([\d.]+)/.exec(ua);
  if (edge) return `Edge ${edge[1]}`;
  const chrome = /Chrome\/([\d.]+)/.exec(ua);
  if (chrome) return `Chrome ${chrome[1]}`;
  const safari = /Version\/([\d.]+).*Safari/.exec(ua);
  if (safari) return `Safari ${safari[1]}`;
  return ua;
}

function osName(): string {
  const ua = navigator.userAgent;
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  return 'other';
}

type PermHandle = FileSystemDirectoryHandle & {
  queryPermission(d: { mode: string }): Promise<PermissionState>;
  requestPermission(d: { mode: string }): Promise<PermissionState>;
};

const TEST_FILE = 'hacker-folder-test.txt';

async function folderRoundTrip(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const steps: string[] = [];
  const text = `Hacker folder test ${new Date().toISOString()}`;
  const fh = await dir.getFileHandle(TEST_FILE, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
  steps.push('wrote test file: ok');
  const back = await (await fh.getFile()).text();
  steps.push(`read it back: ${back === text ? 'ok' : 'MISMATCH'}`);
  await dir.removeEntry(TEST_FILE);
  let gone = false;
  try {
    await dir.getFileHandle(TEST_FILE);
  } catch {
    gone = true;
  }
  steps.push(`deleted it: ${gone ? 'ok' : 'FAILED'}`);
  return steps;
}

export const diagnosticsScreen: Screen = {
  title: 'Diagnostics',
  async mount(root) {
    const lines: string[] = [];
    const report = h('pre', { id: 'diag-report', style: 'white-space: pre-wrap; background: #fff; border: 1px solid #ddd; padding: 8px' });
    const log = (s: string) => { lines.push(s); report.textContent = lines.join('\n'); };

    log(`Browser: ${browserName()} on ${osName()}`);
    log(`Folder access (File System Access API): ${'showDirectoryPicker' in window ? 'available' : 'NOT available'}`);
    log(`WebCodecs: ${'VideoDecoder' in window ? 'available' : 'NOT available'}`);

    const codecTable = h('tbody');
    const codecs = await codecSupport();
    for (const c of codecs) {
      codecTable.append(h('tr', null, h('td', null, c.name), h('td', null, c.canPlayType), h('td', null, c.mediaCapabilities), h('td', null, c.webCodecs)));
      log(`${c.name}: canPlayType=${c.canPlayType}, mediaCapabilities=${c.mediaCapabilities}, WebCodecs=${c.webCodecs}`);
    }

    // Video test
    const videoOut = h('div');
    const videoInput = h('input', {
      type: 'file', accept: 'video/*,.mov,.mp4',
      onchange: async () => {
        const file = videoInput.files?.[0];
        if (!file) return;
        videoOut.replaceChildren();
        const hdr = await readVideoHeader(fileReader(file), file.size).catch(() => null);
        const desc = hdr
          ? `${hdr.width}×${hdr.height}, ${codecName(hdr.codec)}, ${hdr.nominalFps ?? '?'} fps (average ${hdr.averageFps ?? '?'}), ${hdr.frameCount ?? '?'} frames, ${hdr.durationSec ?? '?'} s, ${tierLabel(tierFor(hdr.nominalFps))} tier, recorded ${hdr.recordedAt ? new Date(hdr.recordedAt).toLocaleString() : 'unknown'}`
          : 'header could not be read';
        log(`Video "${file.name}" (${(file.size / 1e6).toFixed(1)} MB): ${desc}`);
        const v = h('video', { controls: true, muted: true, playsInline: true, style: 'max-height: 400px; background: #000' });
        v.addEventListener('loadeddata', () => {
          log(v.videoWidth ? `  plays in this browser: YES (${v.videoWidth}×${v.videoHeight}, ${v.duration.toFixed(2)} s as played)` : '  plays in this browser: NO (no picture)');
          v.play().catch(() => {});
        }, { once: true });
        v.addEventListener('error', () => log('  plays in this browser: NO (the browser could not decode it)'), { once: true });
        v.src = URL.createObjectURL(file);
        videoOut.append(v);
      },
    });

    // Folder test
    const folderOut = h('div');
    const stored = await getMeta<PermHandle>('diagFolderHandle');
    if (stored) {
      const p = await stored.queryPermission({ mode: 'readwrite' }).catch(() => 'error');
      log(`Test folder remembered from an earlier visit: "${stored.name}", permission now: ${p}`);
    }
    const runStored = async () => {
      const handle = await getMeta<PermHandle>('diagFolderHandle');
      if (!handle) return log('No test folder remembered yet.');
      try {
        const p = await handle.requestPermission({ mode: 'readwrite' });
        log(`Reopened remembered folder "${handle.name}": permission ${p}`);
        if (p === 'granted') for (const s of await folderRoundTrip(handle)) log(`  ${s}`);
      } catch (e) {
        log(`Remembered folder failed: ${(e as Error).message}`);
      }
    };
    const runNew = async () => {
      if (!window.showDirectoryPicker) return log('This browser cannot open folders.');
      try {
        const dir = await window.showDirectoryPicker({ id: 'hacker-diag', mode: 'readwrite' });
        await setMeta('diagFolderHandle', dir);
        log(`Chose folder "${dir.name}"`);
        for (const s of await folderRoundTrip(dir)) log(`  ${s}`);
      } catch (e) {
        log(`Folder test failed: ${(e as Error).message}`);
      }
    };

    root.append(
      h('h1', null, 'Diagnostics'),
      h('p', null, 'These checks tell us whether this browser can play your iPhone videos and keep videos in a folder. Run them on each computer, then click Copy results and paste them to Claude.'),
      h('h2', null, '1. Video formats this browser says it can play'),
      h('table', null, h('thead', null, h('tr', null, ['Format', 'Plays (canPlayType)', 'Plays smoothly (MediaCapabilities)', 'Frame reading (WebCodecs)'].map((t) => h('th', null, t)))), codecTable),
      h('h2', null, '2. Try one of your iPhone slow-motion videos'),
      h('p', null, videoInput),
      videoOut,
      h('h2', null, '3. Folder access'),
      h('p', null, 'Choose any folder, such as Documents. Hacker writes a small test file there, reads it back, and deletes it. Then close the browser completely, open this page again, and click "Test the remembered folder".'),
      h('div', { class: 'row' }, h('button', { onclick: runNew }, 'Choose a test folder'), h('button', { onclick: runStored }, 'Test the remembered folder')),
      folderOut,
      h('h2', null, 'Results'),
      h('div', { class: 'row' }, h('button', {
        class: 'primary',
        onclick: async (e: Event) => {
          await navigator.clipboard.writeText(report.textContent ?? '');
          (e.target as HTMLButtonElement).textContent = 'Copied';
        },
      }, 'Copy results')),
      report,
    );
  },
};
