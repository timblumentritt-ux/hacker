// Runs against real files in TestVideos when they exist (the folder is not in Git).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bufferReader, readVideoHeader } from '../src/lib/mp4';

const dir = join(__dirname, '..', 'TestVideos', 'synthetic');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.mov$/i.test(f)) : [];

describe.skipIf(files.length === 0)('headers of generated test videos', () => {
  it.each(files)('%s', async (name) => {
    const buf = new Uint8Array(readFileSync(join(dir, name)));
    const h = await readVideoHeader(bufferReader(buf), buf.length);
    console.log(name, JSON.stringify(h));
    expect(h).not.toBeNull();
    const fps = Number(/(\d+)fps/.exec(name)![1]);
    expect(Math.round(h!.nominalFps!)).toBe(fps);
    expect(h!.codec).toBe(name.includes('hevc') ? 'hvc1' : 'avc1');
    expect(h!.height).toBeGreaterThan(h!.width!); // portrait after rotation
    expect(h!.recordedAtSource).toBe('apple-creationdate');
  });
});
