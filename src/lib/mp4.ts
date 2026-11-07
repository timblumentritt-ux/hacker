// Reads the header of a .mov or .mp4 file: recording date, frame rate, size, and codec.
// It never decodes video, so it works even when the browser cannot play the file.

export interface VideoHeader {
  /** Recording date in ms since 1970, or null if the file has none. */
  recordedAt: number | null;
  recordedAtSource: 'apple-creationdate' | 'mvhd' | null;
  durationSec: number | null;
  /** Width and height as shown, after rotation. */
  width: number | null;
  height: number | null;
  /** Codec four-character code, such as "hvc1" (HEVC) or "avc1" (H.264). */
  codec: string | null;
  frameCount: number | null;
  /** Frame rate at full speed (ignores slowed-down stretches). */
  nominalFps: number | null;
  /** Frames divided by duration. Lower than nominal when part of the clip is slowed down. */
  averageFps: number | null;
  /** A caption or description stored in the file, if any (for example a Photos caption, if Photos includes it). */
  caption: string | null;
  /** Every text value found in the file's metadata, by key. */
  metadata: Record<string, string>;
}

/** Reads bytes from a file. Lets tests use a plain buffer. */
export type ByteReader = (offset: number, length: number) => Promise<Uint8Array>;

export function fileReader(file: Blob): ByteReader {
  return async (offset, length) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
}

export function bufferReader(buf: Uint8Array): ByteReader {
  return async (offset, length) => buf.subarray(offset, offset + length);
}

const MAX_MOOV_BYTES = 64 * 1024 * 1024;
// Seconds between 1904-01-01 (QuickTime epoch) and 1970-01-01.
const QT_EPOCH_OFFSET = 2082844800;

interface Box {
  type: string;
  start: number; // offset of the box header
  dataStart: number; // offset of the box contents
  end: number;
}

function fourcc(b: Uint8Array, at: number): string {
  return String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
}

/** Lists the boxes inside b[from..to). */
function childBoxes(b: Uint8Array, from: number, to: number): Box[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    let size = v.getUint32(at);
    const type = fourcc(b, at + 4);
    let header = 8;
    if (size === 1) {
      if (at + 16 > to) break;
      size = Number(v.getBigUint64(at + 8));
      header = 16;
    } else if (size === 0) {
      size = to - at;
    }
    if (size < header || at + size > to) break;
    out.push({ type, start: at, dataStart: at + header, end: at + size });
    at += size;
  }
  return out;
}

function child(b: Uint8Array, box: Box, type: string): Box | undefined {
  return childBoxes(b, box.dataStart, box.end).find((c) => c.type === type);
}

function path(b: Uint8Array, box: Box, ...types: string[]): Box | undefined {
  let cur: Box | undefined = box;
  for (const t of types) {
    if (!cur) return undefined;
    cur = child(b, cur, t);
  }
  return cur;
}

/** Finds the moov box at the top level of the file and returns its bytes. */
async function readMoov(read: ByteReader, fileSize: number): Promise<Uint8Array | null> {
  let at = 0;
  while (at + 8 <= fileSize) {
    const head = await read(at, 16);
    if (head.length < 8) return null;
    const v = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let size = v.getUint32(0);
    const type = fourcc(head, 4);
    if (size === 1) size = Number(v.getBigUint64(8));
    else if (size === 0) size = fileSize - at;
    if (size < 8) return null;
    if (type === 'moov') {
      if (size > MAX_MOOV_BYTES) return null;
      return read(at, size);
    }
    at += size;
  }
  return null;
}

function qtDate(seconds: number): number | null {
  // Ignore missing (0) or clearly wrong dates (before 2000).
  const ms = (seconds - QT_EPOCH_OFFSET) * 1000;
  return ms > Date.UTC(2000, 0, 1) ? ms : null;
}

/** Parses Apple dates such as "2026-11-05T14:23:11-0500". */
export function parseAppleDate(s: string): number | null {
  const fixed = s.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const ms = Date.parse(fixed);
  return Number.isFinite(ms) ? ms : null;
}

/** Reads every text value in moov/meta (keys + ilst), such as com.apple.quicktime.creationdate. */
function appleKeys(b: Uint8Array, moov: Box): Record<string, string> {
  const out: Record<string, string> = {};
  const meta = child(b, moov, 'meta');
  if (!meta) return out;
  // QuickTime meta has children right away; MP4 meta has 4 bytes of version and flags first.
  let kids = childBoxes(b, meta.dataStart, meta.end);
  if (!kids.some((k) => k.type === 'keys')) kids = childBoxes(b, meta.dataStart + 4, meta.end);
  const keys = kids.find((k) => k.type === 'keys');
  const ilst = kids.find((k) => k.type === 'ilst');
  if (!keys || !ilst) return out;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const count = v.getUint32(keys.dataStart + 4);
  const names: string[] = [];
  let at = keys.dataStart + 8;
  for (let i = 1; i <= count && at + 8 <= keys.end; i++) {
    const size = v.getUint32(at);
    if (size < 8) break;
    names[i] = new TextDecoder().decode(b.subarray(at + 8, at + size));
    at += size;
  }
  for (const item of childBoxes(b, ilst.dataStart, ilst.end)) {
    const name = names[v.getUint32(item.start + 4)];
    const data = child(b, item, 'data');
    if (!name || !data || data.dataStart + 8 > data.end) continue;
    const type = v.getUint32(data.dataStart);
    if (type === 1) out[name] = new TextDecoder().decode(b.subarray(data.dataStart + 8, data.end)); // UTF-8 text
  }
  return out;
}

/** Reads QuickTime user-data text such as ©des (description), ©nam (title), ©cmt (comment). */
function userDataText(b: Uint8Array, moov: Box): Record<string, string> {
  const out: Record<string, string> = {};
  const udta = child(b, moov, 'udta');
  if (!udta) return out;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (const box of childBoxes(b, udta.dataStart, udta.end)) {
    if (box.type.charCodeAt(0) !== 0xa9 || box.dataStart + 4 > box.end) continue;
    const len = v.getUint16(box.dataStart);
    const end = Math.min(box.dataStart + 4 + len, box.end);
    out[`udta.${box.type.slice(1)}`] = new TextDecoder().decode(b.subarray(box.dataStart + 4, end));
  }
  return out;
}

/** Where a caption or description might be stored, most likely first. */
const CAPTION_KEYS = [
  'com.apple.quicktime.description', 'com.apple.quicktime.title', 'com.apple.quicktime.comment',
  'udta.des', 'udta.nam', 'udta.cmt',
];

interface TrackInfo {
  handler: string;
  timescale: number;
  duration: number;
  codec: string | null;
  width: number;
  height: number;
  frameCount: number;
  /** Typical time between frames at full speed, in timescale units (may be fractional). */
  fastDelta: number;
}

function readTrack(b: Uint8Array, trak: Box): TrackInfo | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tkhd = child(b, trak, 'tkhd');
  const mdhd = path(b, trak, 'mdia', 'mdhd');
  const hdlr = path(b, trak, 'mdia', 'hdlr');
  const stbl = path(b, trak, 'mdia', 'minf', 'stbl');
  if (!tkhd || !mdhd || !hdlr || !stbl) return null;

  const handler = fourcc(b, hdlr.dataStart + 8);

  const mdVersion = b[mdhd.dataStart];
  const timescale = v.getUint32(mdhd.dataStart + (mdVersion === 1 ? 20 : 12));
  const duration =
    mdVersion === 1 ? Number(v.getBigUint64(mdhd.dataStart + 24)) : v.getUint32(mdhd.dataStart + 16);

  // tkhd: the matrix and size sit after the version-dependent date fields.
  const tkVersion = b[tkhd.dataStart];
  const afterDates = tkhd.dataStart + (tkVersion === 1 ? 36 : 24);
  const matrixAt = afterDates + 16; // reserved 8, layer 2, group 2, volume 2, reserved 2
  const a = v.getInt32(matrixAt);
  const bb = v.getInt32(matrixAt + 4);
  const rawW = v.getUint32(matrixAt + 36) / 65536;
  const rawH = v.getUint32(matrixAt + 40) / 65536;
  const rotated = a === 0 && bb !== 0;
  const width = Math.round(rotated ? rawH : rawW);
  const height = Math.round(rotated ? rawW : rawH);

  const stsd = child(b, stbl, 'stsd');
  const codec = stsd && stsd.dataStart + 16 <= stsd.end ? fourcc(b, stsd.dataStart + 12) : null;

  // Frame times are whole timescale units, so 240 fps at a 600 timescale alternates gaps of 2 and 3.
  // Average the gaps close to the shortest one, which ignores slowed-down stretches.
  const runs: [count: number, delta: number][] = [];
  const stts = child(b, stbl, 'stts');
  if (stts) {
    const entries = v.getUint32(stts.dataStart + 4);
    for (let i = 0; i < entries; i++) {
      const at = stts.dataStart + 8 + i * 8;
      if (at + 8 > stts.end) break;
      runs.push([v.getUint32(at), v.getUint32(at + 4)]);
    }
  }
  const frameCount = runs.reduce((n, [c]) => n + c, 0);
  const positive = runs.filter(([c, d]) => c > 0 && d > 0);
  const minDelta = positive.length ? Math.min(...positive.map(([, d]) => d)) : 0;
  const fast = positive.filter(([, d]) => d <= minDelta * 2);
  const fastFrames = fast.reduce((n, [c]) => n + c, 0);
  const fastDelta = fastFrames ? fast.reduce((n, [c, d]) => n + c * d, 0) / fastFrames : 0;
  return { handler, timescale, duration, codec, width, height, frameCount, fastDelta };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function readVideoHeader(read: ByteReader, fileSize: number): Promise<VideoHeader | null> {
  const bytes = await readMoov(read, fileSize);
  if (!bytes) return null;
  const moov: Box = { type: 'moov', start: 0, dataStart: 8, end: bytes.length };
  // A moov with a 64-bit size has a 16-byte header.
  if (new DataView(bytes.buffer, bytes.byteOffset).getUint32(0) === 1) moov.dataStart = 16;

  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let mvhdDate: number | null = null;
  const mvhd = child(bytes, moov, 'mvhd');
  if (mvhd) {
    const ver = bytes[mvhd.dataStart];
    mvhdDate = qtDate(ver === 1 ? Number(v.getBigUint64(mvhd.dataStart + 4)) : v.getUint32(mvhd.dataStart + 4));
  }
  const metadata = { ...userDataText(bytes, moov), ...appleKeys(bytes, moov) };
  const created = metadata['com.apple.quicktime.creationdate'];
  const appleDate = created ? parseAppleDate(created) : null;
  const caption = CAPTION_KEYS.map((k) => metadata[k]?.trim()).find((t) => t) ?? null;

  const video = childBoxes(bytes, moov.dataStart, moov.end)
    .filter((c) => c.type === 'trak')
    .map((t) => readTrack(bytes, t))
    .find((t): t is TrackInfo => t !== null && t.handler === 'vide');

  const durationSec = video && video.timescale ? video.duration / video.timescale : null;
  return {
    recordedAt: appleDate ?? mvhdDate,
    recordedAtSource: appleDate ? 'apple-creationdate' : mvhdDate ? 'mvhd' : null,
    durationSec: durationSec !== null ? round2(durationSec) : null,
    width: video?.width || null,
    height: video?.height || null,
    codec: video?.codec ?? null,
    frameCount: video?.frameCount || null,
    nominalFps: video && video.fastDelta ? round2(video.timescale / video.fastDelta) : null,
    averageFps: video && durationSec ? round2(video.frameCount / durationSec) : null,
    caption,
    metadata,
  };
}

export function codecName(fourCC: string | null): string {
  if (!fourCC) return 'unknown';
  if (fourCC === 'hvc1' || fourCC === 'hev1') return 'HEVC';
  if (fourCC === 'avc1' || fourCC === 'avc3') return 'H.264';
  return fourCC;
}
