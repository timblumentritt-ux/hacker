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
  /** Most common frame rate in the file. */
  nominalFps: number | null;
  /** Frames divided by duration. Lower than nominal when part of the clip is slowed down. */
  averageFps: number | null;
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

/** Reads com.apple.quicktime.creationdate from moov/meta (keys + ilst). */
function appleCreationDate(b: Uint8Array, moov: Box): number | null {
  const meta = child(b, moov, 'meta');
  if (!meta) return null;
  // QuickTime meta has children right away; MP4 meta has 4 bytes of version and flags first.
  let kids = childBoxes(b, meta.dataStart, meta.end);
  if (!kids.some((k) => k.type === 'keys')) kids = childBoxes(b, meta.dataStart + 4, meta.end);
  const keys = kids.find((k) => k.type === 'keys');
  const ilst = kids.find((k) => k.type === 'ilst');
  if (!keys || !ilst) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const count = v.getUint32(keys.dataStart + 4);
  let at = keys.dataStart + 8;
  let index = -1;
  for (let i = 1; i <= count && at + 8 <= keys.end; i++) {
    const size = v.getUint32(at);
    if (size < 8) break;
    const name = new TextDecoder().decode(b.subarray(at + 8, at + size));
    if (name === 'com.apple.quicktime.creationdate') index = i;
    at += size;
  }
  if (index < 0) return null;
  for (const item of childBoxes(b, ilst.dataStart, ilst.end)) {
    if (v.getUint32(item.start + 4) !== index) continue;
    const data = child(b, item, 'data');
    if (!data || data.dataStart + 8 > data.end) return null;
    return parseAppleDate(new TextDecoder().decode(b.subarray(data.dataStart + 8, data.end)));
  }
  return null;
}

interface TrackInfo {
  handler: string;
  timescale: number;
  duration: number;
  codec: string | null;
  width: number;
  height: number;
  frameCount: number;
  /** Most common time between frames, in timescale units. */
  commonDelta: number;
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

  let frameCount = 0;
  let commonDelta = 0;
  const stts = child(b, stbl, 'stts');
  if (stts) {
    const entries = v.getUint32(stts.dataStart + 4);
    let best = 0;
    for (let i = 0; i < entries; i++) {
      const at = stts.dataStart + 8 + i * 8;
      if (at + 8 > stts.end) break;
      const n = v.getUint32(at);
      const delta = v.getUint32(at + 4);
      frameCount += n;
      if (n > best && delta > 0) {
        best = n;
        commonDelta = delta;
      }
    }
  }
  return { handler, timescale, duration, codec, width, height, frameCount, commonDelta };
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
  const appleDate = appleCreationDate(bytes, moov);

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
    nominalFps: video && video.commonDelta ? round2(video.timescale / video.commonDelta) : null,
    averageFps: video && durationSec ? round2(video.frameCount / durationSec) : null,
  };
}

export function codecName(fourCC: string | null): string {
  if (!fourCC) return 'unknown';
  if (fourCC === 'hvc1' || fourCC === 'hev1') return 'HEVC';
  if (fourCC === 'avc1' || fourCC === 'avc3') return 'H.264';
  return fourCC;
}
