// ship:imobile — build, pack, auto-install Tihoka into Quetta Browser on Android, verify.
// Install path proven on LG V60 / Quetta: serve the .crx over adb reverse, navigate a
// Quetta tab to it → Quetta shows "File might be harmful / Download anyway" then
// "Add \"Tihoka\"? / OK" — both are tapped via uiautomator dump + input tap.
// Usage: node scripts/ship-mobile.mjs [--skip-build] [--skip-smoke]

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WS = require('ws');

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const KEY = join(ROOT, 'tihoka-key.pem');
const OUT_DIR = join(ROOT, 'tmp', 'android-install');
const EXT_ID = 'ifceodogdeeaacmdigljgmafnhkbfnia';
const SERVE_PORT = 8799;
const CDP_PORT = 9225;
const args = process.argv.slice(2);
const has = (f) => args.includes(f);

const ADB = process.env.ADB
  ?? (existsSync(join(homedir(), 'platform-tools-install/platform-tools/adb.exe'))
    ? join(homedir(), 'platform-tools-install/platform-tools/adb.exe')
    : 'adb');

const adb = (a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log(`[imobile] ${s}`);
const fail = (s) => { console.error(`[imobile] FAIL: ${s}`); process.exit(1); };

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

function checkDevice() {
  const devs = adb(['devices']).split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  const online = devs.filter((l) => l.endsWith('device'));
  if (!online.length) {
    fail(devs.some((l) => l.includes('unauthorized'))
      ? 'Device unauthorized — accept the RSA prompt on the phone.'
      : 'No adb device. Enable USB debugging + plug the phone in.');
  }
  log(`device: ${online[0].split(/\s/)[0]}`);
}

async function pack() {
  if (!has('--skip-build')) {
    log('npm run build …');
    const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: false });
    if (r.status !== 0) fail('build failed');
  }
  if (!existsSync(join(DIST, 'manifest.json'))) fail('dist/ missing — run npm run build');
  mkdirSync(OUT_DIR, { recursive: true });
  const crx = join(OUT_DIR, 'tihoka.crx');
  const crx3 = join(ROOT, 'node_modules', 'crx3', 'bin', 'crx3.js');
  const r = spawnSync(process.execPath, [crx3, '-p', KEY, '-o', crx, DIST], { stdio: 'inherit', shell: false });
  if (r.status !== 0 || !existsSync(crx)) fail('crx3 pack failed');
  log(`packed ${crx} (${(statSync(crx).size / 1048576).toFixed(1)} MB)`);
  return crx;
}

function serveCrx(crx) {
  return new Promise((res) => {
    const srv = createServer((req, rsp) => {
      if (!req.url.includes('tihoka.crx')) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, {
        'Content-Type': 'application/x-chrome-extension',
        'Content-Disposition': 'attachment; filename=tihoka.crx',
        'Content-Length': statSync(crx).size,
      });
      createReadStream(crx).pipe(rsp);
    });
    srv.listen(SERVE_PORT, () => res(srv));
  });
}

async function launchQuetta() {
  log('launch Quetta …');
  try { adb(['shell', 'monkey -p net.quetta.browser -c android.intent.category.LAUNCHER 1']); } catch { /* best effort */ }
  await sleep(4000);
}

function devtoolsSockets() {
  return adb(['shell', 'cat /proc/net/unix']).split('\n')
    .map((l) => l.match(/@(chrome_devtools_remote\S*)/)?.[1])
    .filter(Boolean);
}

async function findQuettaSocket(timeoutMs = 60000) {
  const t0 = Date.now();
  const tried = new Set();
  while (Date.now() - t0 < timeoutMs) {
    const procs = adb(['shell', 'ps -A -o PID,NAME']).split('\n')
      .filter((l) => l.trimEnd().endsWith('net.quetta.browser'))
      .map((l) => +l.trim().split(/\s+/)[0]);
    const sockets = devtoolsSockets().sort((a, b) =>
      (procs.some((p) => a.endsWith(`_${p}`)) ? -1 : 0) - (procs.some((p) => b.endsWith(`_${p}`)) ? -1 : 0));
    for (const sock of sockets) {
      if (tried.has(sock)) continue;
      adb(['forward', `tcp:${CDP_PORT}`, `localabstract:${sock}`]);
      try {
        const v = await fetch(`http://localhost:${CDP_PORT}/json/version`, { signal: AbortSignal.timeout(4000) })
          .then((r) => r.json());
        if (v['Android-Package'] === 'net.quetta.browser') return sock;
      } catch { /* not quetta / not ready */ }
      tried.add(sock);
    }
    if (!procs.length) {
      try { adb(['shell', 'monkey -p net.quetta.browser -c android.intent.category.LAUNCHER 1']); } catch { /* noop */ }
      await sleep(4000);
    } else {
      await sleep(2000);
    }
  }
  fail('Quetta devtools socket not found in 60s — open Quetta on the phone');
}

const wsSend = (ws, id, method, params) =>
  ws.send(JSON.stringify({ id, method, params }));
const wsCmd = (ws, id, method, params) => new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('ws timeout')), 12000);
  const onMsg = (d) => {
    const m = JSON.parse(d.toString());
    if (m.id === id) { clearTimeout(to); ws.off('message', onMsg); res(m); }
  };
  ws.on('message', onMsg);
  wsSend(ws, id, method, params);
});

async function navigateToCrx() {
  const list = await fetch(`http://localhost:${CDP_PORT}/json/list`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json());
  // Frozen/occluded web tabs accept the ws handshake but never respond on
  // Android — the extension's own options page stays live, so it is a
  // dependable fallback driver for the download navigation.
  const pages = [
    ...list.filter((t) => t.type === 'page' && /^https?:/.test(t.url)),
    ...list.filter((t) => t.type === 'page' && t.url.startsWith(`chrome-extension://${EXT_ID}/options`)),
  ];
  if (!pages.length) fail('no page in Quetta to drive the download');
  for (const page of pages) {
    try {
      const ws = new WS(page.webSocketDebuggerUrl);
      await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
      const r = await wsCmd(ws, 1, 'Page.navigate', { url: `http://localhost:${SERVE_PORT}/tihoka.crx` });
      ws.close();
      log(`navigate ${page.url.slice(0, 50)} → ${r.result?.isDownload ? 'download started' : JSON.stringify(r).slice(0, 120)}`);
      return;
    } catch {
      // stale target (ws connects but never responds) — try the next tab
    }
  }
  fail('every http(s) tab ws call timed out');
}

async function extTargets() {
  const list = await fetch(`http://localhost:${CDP_PORT}/json/list`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json());
  return list;
}

async function seedTokenizeForFirstTab() {
  try {
    const list = await extTargets();
    const page = list.find((t) => t.type === 'page' && /^https?:/.test(t.url));
    const sw = list.find((t) => t.url.startsWith(`chrome-extension://${EXT_ID}/`));
    if (!page || !sw) return;
    const ws = new WS(sw.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    const u = new URL(page.url);
    const key = `${u.origin}${u.pathname}${u.searchParams.get('v') ? `?v=${u.searchParams.get('v')}` : ''}`;
    await wsCmd(ws, 1, 'Runtime.evaluate', {
      expression: `(async () => {
        const { tokenizeSettings } = await chrome.storage.local.get('tokenizeSettings');
        const s = tokenizeSettings ?? {};
        for (const k of ['urls', 'origins', 'subtitleUrls', 'subtitleOrigins']) s[k] ??= {};
        s.urls[${JSON.stringify(key)}] = true;
        s.subtitleUrls[${JSON.stringify(key)}] = true;
        s.origins[${JSON.stringify(u.origin)}] = true;
        s.subtitleOrigins[${JSON.stringify(u.origin)}] = true;
        await chrome.storage.local.set({ tokenizeSettings: s });
      })()`,
      awaitPromise: true,
    });
    ws.close();
    log(`tokenize enabled for ${u.origin}`);
  } catch { /* best effort */ }
}

async function reloadFirstHttpTab() {
  try {
    const list = await extTargets();
    const page = list.find((t) => t.type === 'page' && /^https?:/.test(t.url));
    if (!page) return;
    const ws = new WS(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    await wsCmd(ws, 1, 'Page.reload', {});
    ws.close();
    log('reloaded tab so the new content script injects');
  } catch { /* best effort */ }
}

function uiDump() {
  try {
    adb(['shell', 'uiautomator dump /sdcard/_ui.xml']);
    return adb(['shell', 'cat /sdcard/_ui.xml']);
  } catch { return ''; }
}

function tapByResId(xml, resId) {
  const re = new RegExp(`<node[^>]*resource-id="${resId.replace(/[/.]/g, '\\$&')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
  const m = xml.match(re);
  if (!m) return false;
  const x = (+m[1] + +m[3]) / 2 | 0;
  const y = (+m[2] + +m[4]) / 2 | 0;
  adb(['shell', 'input tap ' + x + ' ' + y]);
  return true;
}

async function confirmInstall(timeoutMs = 90000) {
  const POS = 'net.quetta.browser:id/positive_button';
  const t0 = Date.now();
  let lastXml = '';
  while (Date.now() - t0 < timeoutMs) {
    const xml = uiDump();
    lastXml = xml;
    if (/Download anyway/.test(xml) && tapByResId(xml, POS)) { log('tapped "Download anyway"'); await sleep(2500); continue; }
    if (/[Dd]ownload (file )?again|download it again/i.test(xml) && tapByResId(xml, POS)) { log('tapped re-download confirm'); await sleep(2500); continue; }
    if (/Add ["']Tihoka["']\?/.test(xml) && tapByResId(xml, POS)) { log('tapped OK on Add "Tihoka"?'); return true; }
    if (/Manage Extensions/.test(xml) && /Tihoka/.test(xml)) return true; // already on ext list
    await sleep(1500);
  }
  console.error(lastXml.match(/text=["'][^"']*["']/g)?.join('\n') ?? '(empty ui dump)');
  fail('install dialog never confirmed');
}

async function installedVersion(timeoutMs = 120000) {
  const t0 = Date.now();
  let reforwarded = 0;
  while (Date.now() - t0 < timeoutMs) {
    let list;
    try {
      list = await fetch(`http://localhost:${CDP_PORT}/json/list`, { signal: AbortSignal.timeout(4000) })
        .then((r) => r.json());
    } catch {
      if (++reforwarded < 4) { // quetta restart → new socket name
        try { const s = await findQuettaSocket(20000); log(`re-forward → ${s}`); } catch { /* keep polling */ }
      }
      await sleep(2000);
      continue;
    }
    const targets = list
      .filter((t) => t.url.startsWith(`chrome-extension://${EXT_ID}/`))
      .sort((a) => (a.type === 'service_worker' ? -1 : 1));
    for (const t of targets) {
      try {
        const ws = new WS(t.webSocketDebuggerUrl);
        await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
        const r = await wsCmd(ws, 1, 'Runtime.evaluate', {
          expression: 'chrome.runtime.getManifest().version', returnByValue: true,
        });
        ws.close();
        if (r.result?.result?.value) return r.result.result.value;
      } catch { /* target stale — try next */ }
    }
    await sleep(2000);
  }
  return null;
}

const main = async () => {
  checkDevice();
  const crx = await pack();
  adb(['reverse', `tcp:${SERVE_PORT}`, `tcp:${SERVE_PORT}`]);
  const srv = await serveCrx(crx);
  try {
    await launchQuetta();
    const sock = await findQuettaSocket();
    log(`forward localhost:${CDP_PORT} → ${sock}`);
    await navigateToCrx();
    await confirmInstall();
    const v = await installedVersion();
    if (!v) fail('extension installed dialog confirmed but no extension target appeared');
    log(`installed version: ${v}${v === version ? ' (matches package.json)' : ` — expected ${version}`}`);
    if (v !== version) fail(`stale version on device: ${v} ≠ ${version}`);
    await seedTokenizeForFirstTab();
    await reloadFirstHttpTab();
    await sleep(8000);
  } finally {
    srv.close();
  }

  if (!has('--skip-smoke')) {
    log('smoke test…');
    const env = { ...process.env, ADB };
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/test-quetta-android.mjs')],
      { stdio: 'inherit', env, shell: false });
    if (r.status !== 0) {
      console.warn('[imobile] smoke test failed — open a video page in Quetta and rerun: node scripts/test-quetta-android.mjs');
    }
  }
  log('DONE: Tihoka installed on Quetta Android');
};

main().catch((e) => fail(e.message));
