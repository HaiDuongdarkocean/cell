import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'tasks/shortcut-redesign';
fs.mkdirSync(OUT, { recursive: true });

const rootOf = `(() => { let r; const w = (x) => { for (const e of x.querySelectorAll('*')) { const id = e.getAttribute && (e.getAttribute('data-tihoka-id') || e.getAttribute('data-cell-id')); if (id === 'universal-panel') r = e.getRootNode(); if (e.shadowRoot) w(e.shadowRoot); } }; w(document); return r; })()`;

const b = await chromium.connectOverCDP('http://127.0.0.1:9331');
const c = b.contexts()[0];
const allPages = b.contexts().flatMap((x) => x.pages());
console.log('pages:', allPages.map((x) => x.url()).join(' | '));
let p = allPages.find((x) => x.url().startsWith('http'));
if (!p) p = allPages[0];
if (!p) { console.log('NO PAGE'); process.exit(1); }
await p.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
await p.bringToFront();
console.log('page:', p.url());

const diag = await p.evaluate(`(() => {
  let n = 0; const ids = [];
  const w = (r) => { for (const e of r.querySelectorAll('*')) { const id = e.getAttribute && (e.getAttribute('data-tihoka-id') || e.getAttribute('data-cell-id')); if (id) { n++; ids.push(id); } if (e.shadowRoot) w(e.shadowRoot); } };
  w(document);
  return { tihokaNodes: n, ids: ids.slice(0, 10), chromeRuntime: typeof chrome !== 'undefined' && !!chrome.runtime };
})()`);
console.log('diag:', JSON.stringify(diag));
await p.click('body').catch(() => {});

const panelOpen = () => p.evaluate(`(() => { let f = false; const w = (r) => { for (const e of r.querySelectorAll('*')) { const id = e.getAttribute && (e.getAttribute('data-tihoka-id') || e.getAttribute('data-cell-id')); if (id === 'universal-panel') f = true; if (e.shadowRoot) w(e.shadowRoot); } }; w(document); return f; })()`);

async function ensurePanel() {
  if (await panelOpen()) return 'already';
  await p.keyboard.press('Control+u');
  await p.waitForTimeout(2500);
  return (await panelOpen()) ? 'opened' : 'FAILED';
}

console.log('panel:', await ensurePanel());

const tabClicked = await p.evaluate(`(() => {
  const root = ${rootOf};
  if (!root) return 'no-root';
  const tab = root.querySelector('[data-tihoka-id="universal-panel-tab-settings"],[data-cell-id="universal-panel-tab-settings"]');
  if (tab) { tab.click(); return 'tab'; }
  const cands = [...root.querySelectorAll('button,[role=tab]')];
  const s = cands.find((e) => /settings|cài đặt/i.test(e.textContent || ''));
  if (s) { s.click(); return 'text'; }
  return 'none';
})()`);
console.log('settings tab:', tabClicked);
await p.waitForTimeout(800);

const navClicked = await p.evaluate(`(() => {
  const root = ${rootOf};
  if (!root) return 'no-root';
  const items = [...root.querySelectorAll('button,[role=link],[role=tab],a')];
  const it = items.find((e) => /shortcuts|phím tắt/i.test((e.textContent || '').trim()));
  if (it) { it.click(); return 'clicked:' + (it.textContent || '').trim().slice(0, 30); }
  return 'none';
})()`);
console.log('nav:', navClicked);
await p.waitForTimeout(800);

const clip = await p.evaluate(`(() => {
  const root = ${rootOf};
  if (!root) return 'no-root';
  const sec = root.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const sc = root.querySelector('[class*=mainCol]');
  if (sc) { sc.style.scrollBehavior = 'auto'; sc.scrollTop = sec.offsetTop - 60; }
  const r = sec.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight;
  return { x: Math.max(0, Math.round(r.x) - 6), y: Math.max(0, Math.round(r.y) - 6), width: Math.min(vw - Math.max(0, Math.round(r.x) - 6), Math.round(r.width) + 12), height: Math.min(vh, Math.round(r.height) + 12) };
})()`);
console.log('clip:', JSON.stringify(clip));
await p.waitForTimeout(300);

if (clip && typeof clip === 'object') {
  await p.screenshot({ path: `${OUT}/real-shortcuts-desktop.png`, clip });
  await p.screenshot({ path: `${OUT}/real-shortcuts-full.png` });
} else {
  await p.screenshot({ path: `${OUT}/real-shortcuts-fail.png` });
}

const cd = await c.newCDPSession(p);
await cd.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 850, deviceScaleFactor: 2, mobile: true, screenWidth: 400, screenHeight: 850 });
await p.waitForTimeout(800);
const clip2 = await p.evaluate(`(() => {
  const root = ${rootOf};
  if (!root) return 'no-root';
  const sec = root.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const sc = root.querySelector('[class*=mainCol]');
  if (sc) { sc.style.scrollBehavior = 'auto'; sc.scrollTop = sec.offsetTop - 60; }
  const r = sec.getBoundingClientRect();
  return { x: Math.max(0, Math.round(r.x) - 4), y: Math.max(0, Math.round(r.y) - 4), width: Math.min(400 - Math.max(0, Math.round(r.x) - 4), Math.round(r.width) + 8), height: Math.min(850, Math.round(r.height) + 8) };
})()`);
console.log('clip-mobile:', JSON.stringify(clip2));
if (clip2 && typeof clip2 === 'object') {
  await p.screenshot({ path: `${OUT}/real-shortcuts-mobile.png`, clip: clip2 });
}
await cd.send('Emulation.clearDeviceMetricsOverride');

const dom = await p.evaluate(`(() => {
  const root = ${rootOf};
  if (!root) return 'no-root';
  const sec = root.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const pills = [...sec.querySelectorAll('[data-tihoka-keycapture]')];
  const rects = pills.map((e) => Math.round(e.getBoundingClientRect().right));
  return { pillCount: pills.length, pillRightEdges: [...new Set(rects)], invalid: pills.filter((e) => e.getAttribute('aria-invalid') === 'true').length };
})()`);
console.log('dom:', JSON.stringify(dom));

process.exit(0);
