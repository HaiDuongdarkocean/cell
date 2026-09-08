/* global document, getComputedStyle, innerHeight */
/* Batch journey sweep: every showcase page x data state x viewport.
 * Captures screenshots into loop/universal-panel-ui-audit/image/sweep/.
 * Usage: node scripts/journey-sweep.cjs [baseUrl]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.argv[2] || 'http://localhost:5180';
const OUT = path.resolve(__dirname, '../loop/universal-panel-ui-audit/image/sweep');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = (process.env.SWEEP_PAGES ? process.env.SWEEP_PAGES.split(',') : [
  'Universal Panel Page',
  'Study Modes Panel',
  'Settings Dialog Page',
  'Popup Page',
  'Side Panel Page',
  'Subtitle Overlay Page',
  'Player Mode Overlay Page',
  'Dictionary Popup Page',
  'Card Creator Dialog Page',
  'Clipboard Page',
  'Video Player Test Page',
  'Pronunciation Panel',
]);
const DATA = ['full', 'empty', 'overflow'];
const VIEWPORTS = [
  { name: '320', w: 320, h: 640 },
  { name: '768', w: 768, h: 800 },
  { name: '1280', w: 1280, h: 900 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const report = [];
  for (const name of PAGES) {
    for (const data of DATA) {
      for (const vp of VIEWPORTS) {
        const url = `${BASE}/src/entrypoints/design-system-showcase/index.html?showcase=${encodeURIComponent(name)}&mode=light&data=${data}`;
        try {
          await page.setViewportSize({ width: vp.w, height: vp.h });
          await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(400);
          // Measure horizontal overflow anywhere on the page
          const overflow = await page.evaluate(() => {
            const bad = [];
            document.querySelectorAll('body *').forEach((el) => {
              if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
                const cs = getComputedStyle(el);
                if (cs.overflowX === 'visible' || cs.overflowX === 'clip') {
                  const r = el.getBoundingClientRect();
                  if (r.width > 20 && r.bottom > 0 && r.top < innerHeight) {
                    bad.push(`${(el.className || el.tagName).toString().slice(0, 60)} sw=${el.scrollWidth} cw=${el.clientWidth}`);
                  }
                }
              }
            });
            return bad.slice(0, 8);
          });
          const file = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${data}-${vp.name}.png`;
          await page.screenshot({ path: path.join(OUT, file) });
          report.push({ page: name, data, vp: vp.name, file, overflow });
          console.log(`${name} | ${data} | ${vp.name} → ${overflow.length} overflow`);
        } catch (e) {
          report.push({ page: name, data, vp: vp.name, error: String(e).slice(0, 200) });
          console.log(`${name} | ${data} | ${vp.name} → ERROR ${String(e).slice(0, 80)}`);
        }
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  const withOverflow = report.filter((r) => r.overflow && r.overflow.length);
  console.log(`\n=== ${report.length} captures, ${withOverflow.length} with visible overflow ===`);
  withOverflow.forEach((r) => console.log(`- ${r.page} ${r.data} ${r.vp}: ${r.overflow.join(' | ')}`));
})();
