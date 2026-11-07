import { describe, expect, it } from 'vitest';
import { bufferReader, parseAppleDate, readVideoHeader } from '../src/lib/mp4';

// Builders for a small synthetic QuickTime file.
const enc = new TextEncoder();
function u32(n: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; }
function u16(n: number): Uint8Array { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n); return b; }
function i32(n: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n); return b; }
function cat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
function box(type: string | Uint8Array, ...payload: Uint8Array[]): Uint8Array {
  const body = cat(...payload);
  return cat(u32(8 + body.length), typeof type === 'string' ? enc.encode(type) : type, body);
}
const zeros = (n: number) => new Uint8Array(n);
const QT_EPOCH = 2082844800;

function videoTrak(opts: { rotate: boolean; w: number; h: number; timescale: number; stts: [number, number][]; codec: string }) {
  const matrix = opts.rotate
    ? [0, 65536, 0, -65536, 0, 0, 0, 0, 0x40000000]
    : [65536, 0, 0, 0, 65536, 0, 0, 0, 0x40000000];
  const duration = opts.stts.reduce((n, [c, d]) => n + c * d, 0);
  const tkhd = box('tkhd', zeros(4), zeros(8), u32(1), zeros(4), u32(duration), zeros(8), u16(0), u16(0), u16(0), u16(0),
    ...matrix.map(i32), u32(opts.w * 65536), u32(opts.h * 65536));
  const mdhd = box('mdhd', zeros(4), zeros(8), u32(opts.timescale), u32(duration), zeros(4));
  const hdlr = box('hdlr', zeros(4), zeros(4), enc.encode('vide'), zeros(12));
  const stsd = box('stsd', zeros(4), u32(1), box(opts.codec, zeros(78)));
  const stts = box('stts', zeros(4), u32(opts.stts.length), ...opts.stts.flatMap(([c, d]) => [u32(c), u32(d)]));
  return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', box('stbl', stsd, stts))));
}
function audioTrak() {
  const tkhd = box('tkhd', zeros(80));
  const mdhd = box('mdhd', zeros(4), zeros(8), u32(44100), u32(44100), zeros(4));
  const hdlr = box('hdlr', zeros(4), zeros(4), enc.encode('soun'), zeros(12));
  return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', box('stbl'))));
}
function appleMeta(date: string) {
  const key = enc.encode('com.apple.quicktime.creationdate');
  const keys = box('keys', zeros(4), u32(1), cat(u32(8 + key.length), enc.encode('mdta'), key));
  const ilst = box('ilst', box(u32(1), box('data', u32(1), zeros(4), enc.encode(date))));
  return box('meta', box('hdlr', zeros(4), zeros(4), enc.encode('mdta'), zeros(12)), keys, ilst);
}
function mvhd(unixSeconds: number) {
  return box('mvhd', zeros(4), u32(unixSeconds + QT_EPOCH), u32(0), u32(600), u32(2400), zeros(80));
}

describe('video header', () => {
  it('reads an iPhone-like 240 fps portrait HEVC clip with moov at the end', async () => {
    const file = cat(
      box('ftyp', enc.encode('qt  '), zeros(4)),
      box('mdat', zeros(1000)),
      box('moov',
        mvhd(Date.UTC(2026, 10, 1) / 1000),
        audioTrak(),
        videoTrak({ rotate: true, w: 1920, h: 1080, timescale: 24000, stts: [[960, 100]], codec: 'hvc1' }),
        appleMeta('2026-11-05T14:23:11-0500'),
      ),
    );
    const h = await readVideoHeader(bufferReader(file), file.length);
    expect(h).not.toBeNull();
    expect(h!.codec).toBe('hvc1');
    expect(h!.width).toBe(1080);
    expect(h!.height).toBe(1920);
    expect(h!.nominalFps).toBe(240);
    expect(h!.averageFps).toBe(240);
    expect(h!.frameCount).toBe(960);
    expect(h!.durationSec).toBe(4);
    // The Apple recording date wins over mvhd.
    expect(h!.recordedAtSource).toBe('apple-creationdate');
    expect(h!.recordedAt).toBe(Date.UTC(2026, 10, 5, 19, 23, 11));
  });

  it('falls back to the mvhd date and reads a 30 fps landscape H.264 clip', async () => {
    const file = cat(
      box('ftyp', enc.encode('mp42'), zeros(4)),
      box('moov',
        mvhd(Date.UTC(2026, 9, 3) / 1000),
        videoTrak({ rotate: false, w: 512, h: 910, timescale: 600, stts: [[90, 20]], codec: 'avc1' }),
      ),
      box('mdat', zeros(500)),
    );
    const h = await readVideoHeader(bufferReader(file), file.length);
    expect(h!.nominalFps).toBe(30);
    expect(h!.width).toBe(512);
    expect(h!.height).toBe(910);
    expect(h!.recordedAtSource).toBe('mvhd');
    expect(h!.recordedAt).toBe(Date.UTC(2026, 9, 3));
  });

  it('reports the most common frame rate and a lower average for a slowed-down section', async () => {
    // 240 fps for most frames, plus a stretch shown 8 times slower.
    const file = box('moov', mvhd(0), videoTrak({ rotate: false, w: 1920, h: 1080, timescale: 24000, stts: [[600, 100], [200, 800]], codec: 'hvc1' }));
    const h = await readVideoHeader(bufferReader(file), file.length);
    expect(h!.nominalFps).toBe(240);
    expect(h!.averageFps).toBeLessThan(240);
    expect(h!.recordedAt).toBeNull(); // mvhd date before 2000 is ignored
  });

  it('returns null for a file that is not a QuickTime or MP4 file', async () => {
    const junk = enc.encode('this is not a video file at all, just text');
    expect(await readVideoHeader(bufferReader(junk), junk.length)).toBeNull();
  });

  it('parses Apple dates with time zones', () => {
    expect(parseAppleDate('2026-11-05T14:23:11-0500')).toBe(Date.UTC(2026, 10, 5, 19, 23, 11));
    expect(parseAppleDate('2026-11-05T14:23:11+0100')).toBe(Date.UTC(2026, 10, 5, 13, 23, 11));
    expect(parseAppleDate('garbage')).toBeNull();
  });
});

describe('frame rate from frame gaps', () => {
  it('reads 240 fps when a 600 timescale makes the gaps alternate between 2 and 3', async () => {
    const alt: [number, number][] = [];
    for (let i = 0; i < 240; i++) alt.push([1, i % 2 ? 2 : 3]);
    const file = box('moov', mvhd(0), videoTrak({ rotate: false, w: 1920, h: 1080, timescale: 600, stts: alt, codec: 'hvc1' }));
    const h = await readVideoHeader(bufferReader(file), file.length);
    expect(h!.nominalFps).toBe(240);
  });
});
