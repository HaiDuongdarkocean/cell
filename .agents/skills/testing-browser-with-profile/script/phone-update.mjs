// Zero-touch extension update on an Android Chromium fork (Quetta) via the
// self-hosted update_url channel. Run from the repo root after `npm run build`.
//
//   node .agents/skills/testing-browser-with-profile/script/phone-update.mjs --version 0.1.10.2
//
// What it does:
//   1. Temporarily writes `version` + `update_url` into dist/manifest.json
//      (restored afterwards — never leaves the bump behind).
//   2. Packs tmp/perf-campaign/update-serve/tihoka.crx with tihoka-key.pem
//      (same signing key -> same extension id -> real update path).
//   3. Generates updates.xml and serves the dir on 127.0.0.1:--port.
//   4. `adb reverse tcp:<port> tcp:<port>` so phone localhost reaches us.
//   5. chrome.runtime.requestUpdateCheck() -> expects "update_available".
//   6. chrome.runtime.reload(), then verifies getManifest().version on the
//      new service worker matches --version.
//
// Requirements: phone on USB (`adb devices`), `adb forward tcp:9444
// localabstract:chrome_devtools_remote`, Quetta running with the base build
// installed once via the .crx/.zip picker (one-time, manual).
// Options: --version <req> --cdp <127.0.0.1:9444> --port <8877> --adb <adb>
//          --key <tihoka-key.pem> --dist <dist> --timeout-ms <120000>

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : def; };
const VERSION = arg('version');
if (!VERSION) { console.error('usage: phone-update.mjs --version <x.y.z.w>'); process.exit(1); }
const CDP = `http://${arg('cdp', '127.0.0.1:9444')}`;
const PORT = Number(arg('port', '8877'));
const ADB = arg('adb', 'adb');
const KEY = path.join(ROOT, arg('key', 'tihoka-key.pem'));
const DIST = path.resolve(ROOT, arg('dist', 'dist'));
const SERVE = path.join(ROOT, 'tmp', 'perf-campaign', 'update-serve');
const TIMEOUT = Number(arg('timeout-ms', '120000'));

const SNAP = path.join(ROOT, 'tmp', 'perf-campaign', 'dist-snapshot');
fs.rmSync(SNAP, { recursive: true, force: true });
fs.cpSync(DIST, SNAP, { recursive: true });

const manifestPath = path.join(SNAP, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const keyDigest = Buffer.from(manifest.key, 'base64');
const { createHash } = await import('node:crypto');
const extId = [...createHash('sha256').update(keyDigest).digest().subarray(0, 16)]
  .map((b) => 'abcdefghijklmnop'[b >> 4] + 'abcdefghijklmnop'[b & 15]).join('');
const updateUrl = `http://127.0.0.1:${PORT}/updates.xml`;

fs.mkdirSync(SERVE, { recursive: true });
const updatesXml = `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="${extId}">
    <updatecheck codebase="http://127.0.0.1:${PORT}/tihoka.crx" version="${VERSION}" prodversionmin="64.0.3242" />
  </app>
</gupdate>
`;
fs.writeFileSync(path.join(SERVE, 'updates.xml'), updatesXml);

manifest.version = VERSION;
manifest.update_url = updateUrl;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
{
  const crx3js = path.join(ROOT, 'node_modules', 'crx3', 'bin', 'crx3.js');
  const cmd = fs.existsSync(crx3js) ? process.execPath : 'npx';
  const pre = fs.existsSync(crx3js) ? [crx3js] : ['--yes', 'crx3'];
  const r = spawnSync(cmd, [...pre, '-p', KEY, '-o', path.join(SERVE, 'tihoka.crx'), '-x', path.join(SERVE, 'updates.xml'), '--crxURL', `http://127.0.0.1:${PORT}/tihoka.crx`, '--appVersion', VERSION, SNAP], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('crx3 pack failed');
}

const MIME = { '.crx': 'application/x-chrome-extension', '.xml': 'text/xml' };
const server = http.createServer((req, res) => {
  const f = path.join(SERVE, path.basename(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(SERVE) || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
const listen = () => new Promise((res, rej) => { server.once('error', rej); server.listen(PORT, '127.0.0.1', res); });
try {
  await listen();
} catch {
  const stalePid = spawnSync('netstat', ['-ano']).stdout.toString()
    .split('\n').map((l) => l.trim().split(/\s+/))
    .find((c) => c[1] === `127.0.0.1:${PORT}` && c[3] === 'LISTENING')?.[4];
  if (!stalePid || !/^\d+$/.test(stalePid)) { console.error(`port ${PORT} busy and no listener pid found`); process.exit(1); }
  console.log(`[serve] killing stale listener pid ${stalePid}`);
  spawnSync('taskkill', ['/PID', stalePid, '/F']);
  await new Promise((r) => setTimeout(r, 1000));
  await listen();
}
console.log(`[serve] http://127.0.0.1:${PORT} -> ${SERVE}`);

const adb = spawnSync(ADB, ['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
if (adb.status !== 0) { console.error('adb reverse failed:', adb.stderr?.toString()); process.exit(1); }

const ver = await fetch(`${CDP}/json/version`).then((r) => r.json()).catch(() => null);
if (!ver) { console.error('CDP unreachable — run: adb forward tcp:9444 localabstract:chrome_devtools_remote'); process.exit(1); }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('browser ws open failed')); });
let seq = 0;
const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id == null) return;
  const p = pend.get(m.id); if (!p) return;
  pend.delete(m.id); p(m);
};
const send = (method, params, sid, ms = 20000) => new Promise((resolve, reject) => {
  const i = ++seq;
  const t = setTimeout(() => { pend.delete(i); reject(new Error(`cdp timeout: ${method}`)); }, ms);
  pend.set(i, (m) => { clearTimeout(t); resolve(m); });
  const msg = { id: i, method, params }; if (sid) msg.sessionId = sid;
  ws.send(JSON.stringify(msg));
});
const attach = async (targetId) => (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
const evalIn = async (sid, expr, ms) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid, ms);
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const listExt = async () => (await fetch(`${CDP}/json/list`).then((r) => r.json())).filter((x) => x.url.startsWith(`chrome-extension://${extId}/`));

const deadline = Date.now() + TIMEOUT;
const evalExt = async (expr, ms = 15000) => {
  let lastErr = null;
  for (let i = 0; i < 10 && Date.now() < deadline; i++) {
    const ext = await listExt();
    for (const cand of ext.filter((x) => x.type === 'service_worker' || x.type === 'page')) {
      try {
        const s = await attach(cand.id);
        return { value: await evalIn(s, expr, ms), sid: s, cand };
      } catch (e) { lastErr = e; console.log(`  [retry ${i}] ${cand.type} dead (${e.message})`); }
    }
    const off = ext.find((x) => x.type === 'other');
    if (off) {
      try {
        const s = await attach(off.id);
        await evalIn(s, `chrome.runtime.sendMessage({type:'RESOURCE_LIST',payload:{langCode:'en'}}).then(()=>1).catch(()=>0)`, 15000);
      } catch { /* offscreen may lack sendMessage too */ }
    }
    const pg = (await fetch(`${CDP}/json/list`).then((r) => r.json())).find((x) => x.type === 'page' && /^https?:/.test(x.url));
    if (pg) { try { await send('Page.reload', { ignoreCache: false }, await attach(pg.id)); } catch {} }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw lastErr ?? new Error('no usable extension target');
};

const first = await evalExt('chrome.runtime.getManifest().version');
console.log(`[installed] ${first.value} -> target ${VERSION}`);
if (first.value === VERSION) { console.log('already at target version'); server.close(); process.exit(0); }

const updExpr = `(async () => {
  const staged = new Promise(r => chrome.runtime.onUpdateAvailable.addListener(d => r(d.version)));
  const check = await new Promise(r => chrome.runtime.requestUpdateCheck((s, d) => r({ status: s, details: d })));
  if (check.status !== 'update_available') return { check };
  const st = await Promise.race([staged, new Promise(r => setTimeout(() => r('stage-timeout'), 75000))]);
  chrome.runtime.reload();
  return { check, staged: st };
})()`;
const upd = (await evalExt(updExpr, 100000)).value;
console.log('[update]', JSON.stringify(upd));
if (upd?.check?.status !== 'update_available') {
  const now = (await evalExt('chrome.runtime.getManifest().version').catch(() => ({ value: null }))).value;
  if (now === VERSION) { console.log(`[ok] extension updated to ${now}`); server.close(); ws.close(); process.exit(0); }
  console.error('no update_available — abort'); server.close(); process.exit(1);
}

while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 12000));
  try {
    const now = (await evalExt('chrome.runtime.getManifest().version')).value;
    if (now === VERSION) { console.log(`[ok] extension updated to ${now}`); server.close(); ws.close(); process.exit(0); }
    console.log(`[wait] still ${now} — reloading to apply staged update`);
    await evalExt('chrome.runtime.reload()').catch(() => {});
  } catch (e) { console.log('[wait]', e.message); }
}
console.error('update did not take effect within timeout'); server.close(); process.exit(1);
