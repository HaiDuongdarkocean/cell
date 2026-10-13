import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'tasks/shortcut-redesign';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.connectOverCDP('http://127.0.0.1:9331');
const c = b.contexts()[0];
const p = await c.newPage();
p.on('console', (m) => { const t = m.text(); if (/tihoka|extension|content|error|failed/i.test(t)) console.log('[pg]', t.slice(0, 200)); });
p.on('pageerror', (e) => console.log('[pgerr]', String(e).slice(0, 200)));
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);

const hasCs = await p.evaluate(() => typeof chrome !== 'undefined' && !!chrome.runtime?.id);
console.log('content-script runtime:', hasCs);

await p.keyboard.press('Control+u');
await p.waitForTimeout(2000);
const panel = await p.evaluate(() => {
  const host = document.getElementById('Tihoka-universal-panel-host');
  return host && host.shadowRoot ? 'open' : 'closed';
});
console.log('panel:', panel);
if (panel !== 'open') { await p.screenshot({ path: `${OUT}/ext-nopanel.png` }); process.exit(1); }

const SHADOW = `document.getElementById('Tihoka-universal-panel-host').shadowRoot`;

const tabClicked = await p.evaluate(`(() => {
  const t = ${SHADOW}.querySelector('[data-testid="universal-panel-tab-settings"], [data-tihoka-id="universal-panel-tab-settings"]');
  if (!t) return false;
  t.click();
  return true;
})()`);
console.log('settings tab clicked:', tabClicked);
await p.waitForTimeout(2500);

async function clipShot(name) {
  await p.evaluate(`(() => {
    const sec = ${SHADOW}.querySelector('[data-section="shortcuts"]');
    if (!sec) return;
    let el = sec.parentElement;
    while (el) {
      if (el.scrollHeight > el.clientHeight + 10) {
        el.style.scrollBehavior = 'auto';
        el.scrollTop += sec.getBoundingClientRect().top - el.getBoundingClientRect().top - 16;
      }
      el = el.parentElement;
    }
  })()`);
  await p.waitForTimeout(400);
  const info = await p.evaluate(`(() => {
    const sec = ${SHADOW}.querySelector('[data-section="shortcuts"]');
    if (!sec) return 'no-section';
    const r = sec.getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.round(r.width), height: Math.min(Math.round(r.height), innerHeight - Math.max(0, Math.round(r.y))) };
  })()`);
  console.log(name, 'clip:', JSON.stringify(info));
  if (info && typeof info === 'object' && info.height > 50) {
    await p.screenshot({ path: `${OUT}/${name}.png`, clip: info });
  }
  return info;
}

const dom = await p.evaluate(`(() => {
  const sec = ${SHADOW}.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const pills = [...sec.querySelectorAll('[data-tihoka-keycapture]')];
  const cards = [...sec.querySelectorAll('[class*=shortcutCard]')];
  const edges = cards.map((cd) => [...new Set([...cd.querySelectorAll('[data-tihoka-keycapture]')].map((e) => Math.round(e.getBoundingClientRect().right)))]);
  const masonry = sec.querySelector('[class*=shortcutMasonry]');
  return {
    pillCount: pills.length, cardCount: cards.length, perCardRightEdges: edges,
    cols: masonry ? getComputedStyle(masonry).columnCount : 'n/a',
  };
})()`);
console.log('dom:', JSON.stringify(dom));
await clipShot('ext-desktop');

const rebind = await p.evaluate(`(() => {
  const btn = ${SHADOW}.querySelector('[data-tihoka-id="shortcut-replay-cue"]');
  if (!btn) return 'no-pill';
  btn.focus();
  return btn.getAttribute('aria-label') || 'focused';
})()`);
console.log('rebind target:', rebind);
await p.keyboard.press('q');
await p.waitForTimeout(800);
const after = await p.evaluate(`(() => {
  const btn = ${SHADOW}.querySelector('[data-tihoka-id="shortcut-replay-cue"]');
  return btn ? btn.textContent.trim() : 'gone';
})()`);
console.log('replay-cue after press q:', JSON.stringify(after));

const conflict = await p.evaluate(`(() => {
  const btn = ${SHADOW}.querySelector('[data-tihoka-id="shortcut-prev-cue"]');
  if (!btn) return 'no-pill';
  btn.focus();
  return 'ok';
})()`);
if (conflict === 'ok') {
  await p.keyboard.press('q');
  await p.waitForTimeout(800);
}
const conflictState = await p.evaluate(`(() => {
  const invalid = [...${SHADOW}.querySelectorAll('[data-section="shortcuts"] [aria-invalid="true"]')].map((e) => e.getAttribute('data-tihoka-id'));
  const dots = ${SHADOW}.querySelectorAll('[data-section="shortcuts"] [class*=conflictDot]').length;
  return { invalid, dots };
})()`);
console.log('conflict:', JSON.stringify(conflictState));
await clipShot('ext-conflict');

for (const [id, key] of [['shortcut-prev-cue', 'a'], ['shortcut-replay-cue', 's']]) {
  await p.evaluate(`(() => { const b = ${SHADOW}.querySelector('[data-tihoka-id="${id}"]'); b.focus(); })()`);
  await p.keyboard.press(key);
  await p.waitForTimeout(500);
}
const restored = await p.evaluate(`(() => {
  const invalid = ${SHADOW}.querySelectorAll('[data-section="shortcuts"] [aria-invalid="true"]').length;
  const prev = ${SHADOW}.querySelector('[data-tihoka-id="shortcut-prev-cue"]').textContent.trim();
  const replay = ${SHADOW}.querySelector('[data-tihoka-id="shortcut-replay-cue"]').textContent.trim();
  return { invalid, prev, replay };
})()`);
console.log('restored:', JSON.stringify(restored));

await p.setViewportSize({ width: 375, height: 760 });
await p.waitForTimeout(1200);
const mob = await p.evaluate(`(() => {
  const sec = ${SHADOW}.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const masonry = sec.querySelector('[class*=shortcutMasonry]');
  const pills = [...sec.querySelectorAll('[data-tihoka-keycapture]')];
  const overflow = pills.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -2 || r.right > innerWidth + 2; }).length;
  return {
    cols: masonry ? getComputedStyle(masonry).columnCount : 'n/a',
    pillCount: pills.length, pillsOverflowingViewport: overflow,
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
})()`);
console.log('mobile:', JSON.stringify(mob));
await clipShot('ext-mobile-375');

await p.close();
process.exit(0);
