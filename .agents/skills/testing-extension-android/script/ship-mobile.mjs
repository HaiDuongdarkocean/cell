// Generic: build → pack .crx → auto-install into an Android Chromium browser → verify.
// Copy into your project, adjust CONFIG, wire a package script:
//   "ship:imobile": "node scripts/ship-mobile.mjs"
// Deps: adb (platform-tools), crx3, ws — see ../references/setup.md.
// Usage: node scripts/ship-mobile.mjs [--skip-build] [--skip-smoke]

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WS = require('ws');

const CONFIG = {
  extId: 'ifceodogdeeaacmdigljgmafnhkbfnia',   // manifest "key"-derived id
  extName: 'Tihoka',                            // must match the "Add "<name>"?" dialog
  browserPkg: 'net.quetta.browser',
  distDir: 'dist',
  keyFile: 'tihoka-key.pem',
  crxName: 'tihoka.crx',
  buildCmd: ['run', 'build'],
  servePort: 8799,
  cdpPort: 9225,
};

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, CONFIG.distDir);
const KEY = join(ROOT, CONFIG.keyFile);
const OUT_DIR = join(ROOT, 'tmp', 'android-install');
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
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const r = spawnSync(npm, CONFIG.buildCmd, { cwd: ROOT, stdio: 'inherit', shell: false });
    if (r.status !== 0) fail('build failed');
  }
  if (!existsSync(join(DIST, 'manifest.json'))) fail(`${CONFIG.distDir}/ missing — build first`);
  mkdirSync(OUT_DIR, { recursive: true });
  const crx = join(OUT_DIR, CONFIG.crxName);
  const crx3 = join(ROOT, 'node_modules', 'crx3', 'bin', 'crx3.js');
  const r = spawnSync(process.execPath, [crx3, '-p', KEY, '-o', crx, DIST], { stdio: 'inherit', shell: false });
  if (r.status !== 0 || !existsSync(crx)) fail('crx3 pack failed');
  log(`packed ${crx} (${(statSync(crx).size / 1048576).toFixed(1)} MB)`);
  return crx;
}

function serveCrx(crx) {
  return new Promise((res) => {
    const srv = createServer((req, rsp) => {
      if (!req.url.includes(CONFIG.crxName)) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, {
        'Content-Type': 'application/x-chrome-extension',
        'Content-Disposition': `attachment; filename=${CONFIG.crxName}`,
        'Content-Length': statSync(crx).size,
      });
      createReadStream(crx).pipe(rsp);
    });
    srv.listen(CONFIG.servePort, () => res(srv));
  });
}

function devtoolsSockets() {
  return adb(['shell', 'cat /proc/net/unix']).split('\n')
    .map((l) => l.match(/@(chrome_devtools_remote\S*)/)?.[1])
    .filter(Boolean);
}

async function findBrowserSocket(timeoutMs = 60000) {
  const t0 = Date.now();
  const tried = new Set();
  while (Date.now() - t0 < timeoutMs) {
    const procs = adb(['shell', 'ps -A -o PID,NAME']).split('\n')
      .filter((l) => l.trimEnd().endsWith(CONFIG.browserPkg))
      .map((l) => +l.trim().split(/\s+/)[0]);
    const sockets = devtoolsSockets().sort((a, b) =>
      (procs.some((p) => a.endsWith(`_${p}`)) ? -1 : 0) - (procs.some((p) => b.endsWith(`_${p}`)) ? -1 : 0));
    for (const sock of sockets) {
      if (tried.has(sock)) continue;
      adb(['forward', `tcp:${CONFIG.cdpPort}`, `localabstract:${sock}`]);
      try {
        const v = await fetch(`http://localhost:${CONFIG.cdpPort}/json/version`, { signal: AbortSignal.timeout(4000) })
          .then((r) => r.json());
        if (v['Android-Package'] === CONFIG.browserPkg) return sock;
      } catch { /* not target / not ready */ }
      tried.add(sock);
    }
    if (!procs.length) {
      try { adb(['shell', `monkey -p ${CONFIG.browserPkg} -c android.intent.category.LAUNCHER 1`]); } catch { /* noop */ }
      await sleep(4000);
    } else {
      await sleep(2000);
    }
  }
  fail(`devtools socket for ${CONFIG.browserPkg} not found in 60s — open the browser on the phone`);
}

const wsCmd = (ws, id, method, params) => new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('ws timeout')), 12000);
  const onMsg = (d) => {
    const m = JSON.parse(d.toString());
    if (m.id === id) { clearTimeout(to); ws.off('message', onMsg); res(m); }
  };
  ws.on('message', onMsg);
  ws.send(JSON.stringify({ id, method, params }));
});

async function navigateToCrx() {
  const list = await fetch(`http://localhost:${CONFIG.cdpPort}/json/list`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json());
  const page = list.find((t) => t.type === 'page' && /^https?:/.test(t.url));
  if (!page) fail('no http(s) tab to drive the download');
  const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  const r = await wsCmd(ws, 1, 'Page.navigate', { url: `http://localhost:${CONFIG.servePort}/${CONFIG.crxName}` });
  ws.close();
  log(`navigate → ${r.result?.isDownload ? 'download started' : JSON.stringify(r).slice(0, 120)}`);
}

async function extTargets() {
  return fetch(`http://localhost:${CONFIG.cdpPort}/json/list`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json());
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
  const POS = `${CONFIG.browserPkg}:id/positive_button`;
  const addRe = new RegExp(`Add ["']${CONFIG.extName}["']\\?`);
  const t0 = Date.now();
  let lastXml = '';
  while (Date.now() - t0 < timeoutMs) {
    const xml = uiDump();
    lastXml = xml;
    if (/Download anyway/.test(xml) && tapByResId(xml, POS)) { log('tapped "Download anyway"'); await sleep(2500); continue; }
    if (addRe.test(xml) && tapByResId(xml, POS)) { log(`tapped OK on Add "${CONFIG.extName}"?`); return true; }
    if (/Manage Extensions/.test(xml) && xml.includes(CONFIG.extName)) return true;
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
      list = await extTargets();
    } catch {
      if (++reforwarded < 4) {
        try { const s = await findBrowserSocket(20000); log(`re-forward → ${s}`); } catch { /* keep polling */ }
      }
      await sleep(2000);
      continue;
    }
    const targets = list
      .filter((t) => t.url.startsWith(`chrome-extension://${CONFIG.extId}/`))
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
  adb(['reverse', `tcp:${CONFIG.servePort}`, `tcp:${CONFIG.servePort}`]);
  const srv = await serveCrx(crx);
  try {
    const sock = await findBrowserSocket();
    log(`forward localhost:${CONFIG.cdpPort} → ${sock}`);
    await navigateToCrx();
    await confirmInstall();
    const v = await installedVersion();
    if (!v) fail('install confirmed but no extension target appeared');
    log(`installed version: ${v}${v === version ? ' (matches package.json)' : ` — expected ${version}`}`);
    if (v !== version) fail(`stale version on device: ${v} ≠ ${version}`);
    await reloadFirstHttpTab();
    await sleep(8000);
  } finally {
    srv.close();
  }

  if (!has('--skip-smoke')) {
    const smoke = join(ROOT, 'scripts', 'test-android.mjs'); // per-project smoke contract
    if (existsSync(smoke)) {
      log('smoke test…');
      spawnSync(process.execPath, [smoke], { stdio: 'inherit', env: { ...process.env, ADB }, shell: false });
    }
  }
  log('DONE: extension installed on Android');
};

main().catch((e) => fail(e.message));
