// Opens a browser invisibly, loads the dev server, and reports video support and playback of the generated test videos.
// Start the dev server first (npm run dev), then:
//   node scripts/probe-browser.mjs "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 9333
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [bin, port] = process.argv.slice(2);
const profile = mkdtempSync(join(tmpdir(), 'probe-'));
const proc = spawn(bin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(200); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:5173/#/diagnostics' });
await sleep(2500);
const expr = `(async () => {
  const out = { ua: navigator.userAgent.match(/(Edg|Chrome)\\/[\\d.]+/g)?.join(' ') };
  const v = document.createElement('video');
  for (const [n, c] of [['h264','avc1.640028'],['hevc8','hvc1.1.6.L123.B0'],['hevc10','hvc1.2.4.L123.B0']]) {
    const t = 'video/mp4; codecs="' + c + '"';
    const mc = await navigator.mediaCapabilities.decodingInfo({ type: 'file', video: { contentType: t, width: 1920, height: 1080, bitrate: 20e6, framerate: 240 } });
    const wc = await VideoDecoder.isConfigSupported({ codec: c, codedWidth: 1920, codedHeight: 1080 });
    out[n] = { canPlayType: v.canPlayType(t) || 'no', mediaCapabilities: mc.supported, hardware: mc.powerEfficient, webCodecs: wc.supported };
  }
  out.folderAccess = 'showDirectoryPicker' in window;
  for (const f of ['synthetic-240fps-hevc-a.mov', 'synthetic-240fps-h264.mov']) {
    out[f] = await new Promise((res) => {
      const e = document.createElement('video'); e.muted = true;
      const to = setTimeout(() => res('timeout'), 8000);
      e.onloadeddata = () => { clearTimeout(to); res(e.videoWidth ? 'plays ' + e.videoWidth + 'x' + e.videoHeight : 'no picture'); };
      e.onerror = () => { clearTimeout(to); res('error ' + (e.error && e.error.message)); };
      e.src = '/TestVideos/synthetic/' + f;
    });
  }
  return JSON.stringify(out, null, 1);
})()`;
const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(r.result?.result?.value ?? JSON.stringify(r));
ws.close(); proc.kill(); await sleep(500); rmSync(profile, { recursive: true, force: true });
