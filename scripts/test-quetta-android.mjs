/* global document, location */
// Quetta Android test harness — adb forward + CDP smoke check.
// Usage: node scripts/test-quetta-android.mjs [--push dist-build.crx]
// Requires: platform-tools adb on PATH (or ADB env), phone connected, USB debugging on.

import { execSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ADB = process.env.ADB ?? 'adb';
const sh = (args) => execFileSync(ADB, args.split(' '), { encoding: 'utf8', shell: false }).trim();

function findQuettaSocket() {
  const unix = sh('shell cat /proc/net/unix');
  const procs = sh('shell ps -A');
  const quettaPid = procs.split('\n')
    .find((l) => /\snet\.quetta\.browser\s*$/.test(l))
    ?.trim().split(/\s+/)[1];
  if (!quettaPid) throw new Error('Quetta not running on device — open it first');
  const names = unix.split('\n')
    .map((l) => l.match(/@(\S*devtools\S*)/)?.[1])
    .filter(Boolean);
  const sock = names.find((n) => n === `chrome_devtools_remote_${quettaPid}`)
    ?? names.find((n) => n === 'chrome_devtools_remote');
  if (!sock) throw new Error('No devtools socket for Quetta');
  return sock;
}

const main = async () => {
  const devs = sh('devices').split('\n').slice(1).filter((l) => l.trim() && !l.includes('offline'));
  if (!devs.length) throw new Error('No adb device. Enable USB debugging + accept RSA prompt.');
  if (devs[0].includes('unauthorized')) throw new Error('Device unauthorized — accept the RSA prompt on the phone.');

  if (process.argv.includes('--push')) {
    const idx = process.argv.indexOf('--push');
    const file = process.argv[idx + 1] ?? 'dist.crx';
    execSync(`${ADB} push "${file}" /sdcard/Download/tihoka.crx`, { stdio: 'inherit' });
    console.log('[push] done → /sdcard/Download/tihoka.crx — install via Quetta → Extensions → Dev mode → .crx');
  }

  const sock = findQuettaSocket();
  const port = 9225;
  sh(`forward tcp:${port} localabstract:${sock}`);
  console.log(`[forward] localhost:${port} → ${sock}`);

  const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
  const ctx = browser.contexts()[0];
  const pages = ctx.pages().filter((p) => !p.url().startsWith('chrome-extension://'));
  let videoPage, report;
  for (const p of pages) {
    const probe = await p.evaluate(() => ({
      url: location.href,
      video: !!document.querySelector('video'),
      subtitleRoot: !!document.querySelector('#cell-subtitle-root'),
      tokens: document.querySelector('#cell-subtitle-root')?.shadowRoot?.querySelectorAll('.js-cell-token').length ?? 0,
      universalPanel: !!document.querySelector('#cell-universal-panel-host'),
    })).catch(() => null);
    if (probe?.subtitleRoot) { videoPage = p; report = probe; break; }
  }
  if (!videoPage) throw new Error('No page with active Cell overlay — open a video site first');

  // No tokens usually means the video is parked where no cue renders — seek
  // into a caption-bearing timestamp and re-probe.
  if (report.tokens === 0) {
    const seeked = await videoPage.evaluate(() => {
      const v = document.querySelector('video');
      const cues = [...(v?.textTracks?.[0]?.cues ?? [])];
      const mid = cues[Math.floor(cues.length / 3)];
      if (!mid) return false;
      v.currentTime = (mid.startTime + mid.endTime) / 2;
      v.muted = true;
      return v.play().then(() => true).catch(() => true);
    }).catch(() => false);
    if (seeked) {
      await videoPage.waitForTimeout(6000);
      report = await videoPage.evaluate(() => ({
        url: location.href,
        video: !!document.querySelector('video'),
        subtitleRoot: !!document.querySelector('#cell-subtitle-root'),
        tokens: document.querySelector('#cell-subtitle-root')?.shadowRoot?.querySelectorAll('.js-cell-token').length ?? 0,
        universalPanel: !!document.querySelector('#cell-universal-panel-host'),
      }));
    }
  }

  const detail = await videoPage.evaluate(() => {
    const sr = document.querySelector('#cell-subtitle-root').shadowRoot;
    const toks = [...sr.querySelectorAll('.js-cell-token')];
    const withReading = toks.filter((t) => t.querySelector('.js-cell-token-word')?.hasAttribute('data-reading'));
    return { tokensWithReading: withReading.length };
  });
  report.tokensWithReading = detail.tokensWithReading;
  console.log('[report]', JSON.stringify(report, null, 2));
  // universalPanel mounts on demand; tokensWithReading needs an imported
  // dictionary — a fresh CRX install wipes both, so they are warnings only.
  const pass = report.video && report.subtitleRoot && report.tokens > 0;
  if (pass && (!report.universalPanel || !report.tokensWithReading)) {
    console.log('[warn] universalPanel/readings absent — expected right after reinstall (storage wiped, no dictionary yet)');
  }
  console.log(pass ? 'PASS: Cell active on Quetta Android' : 'FAIL: check report');
  process.exit(pass ? 0 : 1);
};

main().catch((e) => { console.error(e.message); process.exit(1); });
