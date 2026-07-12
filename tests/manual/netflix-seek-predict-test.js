/**
 * Netflix seek predict test — chạy trong DevTools console trên Netflix watch page.
 *
 * Cách dùng:
 *   1. Mở Netflix watch page (https://www.netflix.com/watch/XXX)
 *   2. Mở Side Panel extension (để cues load)
 *   3. Mở DevTools console (F12)
 *   4. Paste toàn bộ file này + Enter
 *   5. Gọi: await runSeekTests()
 *
 * Test sẽ:
 *   - Lấy cues thật từ Side Panel DOM (qua chrome.runtime message)
 *   - Seek video tới mốc cụ thể (qua __NF_SEEK → Netflix player API, không M7375)
 *   - Predict A/S/D seek target theo logic content script
 *   - Dispatch keydown (content script handler → seekVideo)
 *   - Verify actual seek match predict (trong tolerance 250ms)
 *   - Log PASS/FAIL + chi tiết nếu fail (pos, expected, actual, diff, cue context, browser)
 *
 * Ponytail: snippet manual, không vào build. Ceiling: synthetic keydown không
 * trigger React handler trong Side Panel — chỉ test content script path.
 * Test Side Panel relay cần nhấn phím thật.
 */

(() => {
  'use strict';

  // --- Config ---
  const TOLERANCE_MS = 250; // Netflix seek có latency ~200ms
  const SEEK_SETTLE_MS = 800; // đợi seek xong + video ổn định
  const PLAY_AFTER_SEEK = true; // play video để seek chính xác hơn

  // --- State ---
  let realCues = [];
  let seekLog = [];

  // --- Utils ---
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : 'Unknown';
  const video = () => document.querySelector('video');

  function logPass(tc) {
    console.log(`%c[PASS] ${tc.name}`, 'color:green;font-weight:bold', {
      key: tc.key, pos: tc.pos, expected: tc.expected, actual: tc.actual, diff: tc.diff, count: tc.count, browser,
    });
  }

  function logFail(tc, reason) {
    console.log(`%c[FAIL] ${tc.name}`, 'color:red;font-weight:bold', {
      key: tc.key, pos: tc.pos, expected: tc.expected, actual: tc.actual, diff: tc.diff, count: tc.count, reason, browser,
      nearCues: tc.nearCues,
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // --- Setup: hook __NF_SEEK để log actual seek ---
  function hookSeekLog() {
    seekLog = [];
    document.addEventListener('__NF_SEEK', (e) => {
      seekLog.push({ seekMs: e.detail, time: Date.now(), stack: new Error().stack });
    }, { once: false });
    console.log('[seek-test] hooked __NF_SEEK listener');
  }

  // --- Setup: lấy cues thật từ Side Panel ---
  // Side Panel là page riêng (chrome-extension://), không truy cập DOM trực tiếp.
  // Cách 1: query Side Panel store qua chrome.runtime message (cần content script expose).
  // Cách 2: scan Netflix page subtitle list (nếu có).
  // Cách 3: Anh yêu paste cues từ Side Panel DevTools console.
  // Default: dùng cues hardcoded (cập nhật từ Side Panel trước khi test).
  async function fetchCuesFromSidePanel() {
    // Thử query content script (ISOLATED world) — không work từ MAIN world.
    // Trả về null → fallback hardcoded.
    return null;
  }

  function setRealCues(cues) {
    // cues: [{start, end, text}, ...] — end = start của cue tiếp theo
    realCues = cues;
    console.log(`[seek-test] set ${cues.length} cues, range [${cues[0].start} - ${cues[cues.length-1].end}]ms`);
  }

  // --- Predict logic (mirror contentScriptController.ts keyboard handler) ---
  function predictSeek(action, currentMs, offsetMs = 0) {
    const effectiveMs = currentMs + offsetMs;
    if (action === 'prev-cue') {
      const prev = [...realCues].reverse().find(c => c.end < effectiveMs);
      return prev ? prev.start : null;
    }
    if (action === 'next-cue') {
      const next = realCues.find(c => c.start > effectiveMs + 100);
      return next ? next.start : null;
    }
    if (action === 'replay-cue') {
      const current = realCues.find(c => c.start <= effectiveMs && c.end > effectiveMs)
        ?? [...realCues].reverse().find(c => c.start < effectiveMs);
      return current ? current.start : null;
    }
    return null;
  }

  // --- Seek video tới mốc (qua __NF_SEEK, không M7375) ---
  async function seekTo(ms) {
    document.dispatchEvent(new CustomEvent('__NF_SEEK', { detail: ms }));
    await sleep(SEEK_SETTLE_MS);
    if (PLAY_AFTER_SEEK) {
      video()?.play();
      await sleep(200);
    }
  }

  // --- Dispatch keydown (trigger content script handler) ---
  function dispatchKey(key) {
    seekLog = [];
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  // --- Lấy nearCues để debug khi fail ---
  function getNearCues(ms, radius = 5000) {
    return realCues
      .filter(c => c.start > ms - radius && c.start < ms + radius)
      .map(c => ({ start: c.start, end: c.end, text: c.text?.slice(0, 30) || '' }));
  }

  // --- Run 1 test case ---
  async function runCase(tc) {
    // 1. Seek tới mốc test
    await seekTo(tc.pos);
    const actualPos = Math.round(video().currentTime * 1000);

    // 2. Predict
    const expected = predictSeek(tc.action, actualPos, tc.offsetMs ?? 0);
    if (expected === null) {
      logFail({ ...tc, pos: actualPos, expected: null, actual: null, diff: null, count: 0, nearCues: getNearCues(actualPos) }, 'predict returned null (no matching cue)');
      return { ...tc, pos: actualPos, expected, actual: null, pass: false, reason: 'predict null' };
    }

    // 3. Dispatch keydown
    dispatchKey(tc.key);
    await sleep(SEEK_SETTLE_MS);

    // 4. Verify
    const actualSeek = seekLog[0]?.seekMs ?? null;
    const count = seekLog.length;
    const diff = actualSeek !== null ? Math.round(actualSeek - expected) : null;
    const pass = actualSeek !== null && Math.abs(diff) <= TOLERANCE_MS && count === 1;

    const result = { ...tc, pos: actualPos, expected, actual: actualSeek, diff, count, pass, nearCues: getNearCues(actualPos) };

    if (pass) {
      logPass(result);
    } else {
      let reason;
      if (count === 0) reason = 'no seek fired (keydown handler not triggered or dedupe skipped all)';
      else if (count > 1) reason = `dedupe failed: ${count} seeks fired (expected 1)`;
      else if (actualSeek === null) reason = 'seekLog empty';
      else reason = `seek mismatch: diff=${diff}ms > tolerance=${TOLERANCE_MS}ms`;
      logFail(result, reason);
    }
    return result;
  }

  // --- Run all test cases ---
  async function runSeekTests(cases) {
    if (realCues.length === 0) {
      console.error('[seek-test] NO CUES SET. Call setRealCues([...]) first. See file header for how to get cues.');
      return { error: 'no cues' };
    }
    hookSeekLog();
    const testCases = cases || defaultCases();
    console.log(`%c[seek-test] running ${testCases.length} cases on ${browser}`, 'color:blue;font-weight:bold');
    const results = [];
    for (const tc of testCases) {
      const r = await runCase(tc);
      results.push(r);
      await sleep(300); // đợi dedupe window reset
    }
    const passed = results.filter(r => r.pass).length;
    const failed = results.length - passed;
    console.log(`%c[seek-test] DONE: ${passed}/${results.length} PASS, ${failed} FAIL on ${browser}`, failed === 0 ? 'color:green;font-weight:bold' : 'color:red;font-weight:bold');
    return { browser, passed, failed, total: results.length, results };
  }

  // --- Default test cases (dựa trên cues thật từ Side Panel) ---
  // Cập nhật pos theo cues thật. pos = mốc trong phim để test.
  function defaultCases() {
    return [
      { name: 'TC1: D from cue middle → next cue', pos: 2178500, key: 'd', action: 'next-cue' },
      { name: 'TC2: A from cue start → prev cue', pos: 2179927, key: 'a', action: 'prev-cue' },
      { name: 'TC3: A from gap → prev cue (gap-fill)', pos: 2185000, key: 'a', action: 'prev-cue' },
      { name: 'TC4: S from cue middle → replay current cue', pos: 2189000, key: 's', action: 'replay-cue' },
      { name: 'TC5: S from gap → replay nearest cue before', pos: 2195000, key: 's', action: 'replay-cue' },
      { name: 'TC6: D from cue start → next cue', pos: 2207205, key: 'd', action: 'next-cue' },
      { name: 'TC7: A from cue middle (has music cue after) → prev cue', pos: 2215000, key: 'a', action: 'prev-cue' },
      { name: 'TC8: rapid D×3 sync → 1 seek (dedupe)', pos: 2210000, key: 'd', action: 'next-cue', rapid: 3 },
      { name: 'TC9: rapid A×3 sync → 1 seek (dedupe)', pos: 2210000, key: 'a', action: 'prev-cue', rapid: 3 },
      { name: 'TC10: rapid S×3 sync → 1 seek (dedupe)', pos: 2210000, key: 's', action: 'replay-cue', rapid: 3 },
    ];
  }

  // --- Rapid press test (dedupe) ---
  async function runRapidTest(key, action, pos, count = 3) {
    await seekTo(pos);
    const actualPos = Math.round(video().currentTime * 1000);
    const expected = predictSeek(action, actualPos);
    seekLog = [];
    for (let i = 0; i < count; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    await sleep(SEEK_SETTLE_MS);
    const seekCount = seekLog.length;
    const pass = seekCount === 1;
    const result = { name: `Rapid ${key}×${count} sync`, key, pos: actualPos, expected, actual: seekLog[0]?.seekMs, count: seekCount, pass, browser };
    if (pass) {
      console.log(`%c[PASS] ${result.name}`, 'color:green;font-weight:bold', result);
    } else {
      console.log(`%c[FAIL] ${result.name}`, 'color:red;font-weight:bold', { ...result, reason: seekCount === 0 ? 'no seek' : `dedupe failed: ${seekCount} seeks (expected 1)` });
    }
    return result;
  }

  // --- Expose API ---
  window.__seekTest = {
    setRealCues,
    runSeekTests,
    runRapidTest,
    predictSeek,
    getNearCues,
    fetchCuesFromSidePanel,
    browser,
    TOLERANCE_MS,
  };

  // --- Helper: parse cues từ Side Panel DevTools console ---
  // Chạy trong Side Panel DevTools console:
  //   copy(JSON.stringify([...document.querySelectorAll('[data-testid="cue-item"]')].map((item, i) => {
  //     const ts = item.querySelector('[data-testid="cue-timestamp"]')?.textContent || '';
  //     const target = item.querySelector('[data-testid="cue-target-text"]')?.textContent?.slice(0, 40) || '';
  //     const m = ts.match(/(\d+):(\d+):(\d+)\.(\d+)/);
  //     const start = m ? (+m[1]*3600 + +m[2]*60 + +m[3]) * 1000 + +m[4] : 0;
  //     return { start, text: target };
  //   })))
  // Paste kết quả vào setRealCues() + thêm end = start của cue tiếp theo.

  console.log(`%c[seek-test] loaded on ${browser}. Usage:`, 'color:blue;font-weight:bold');
  console.log('  1. Get cues from Side Panel DevTools console (see file header)');
  console.log('  2. __seekTest.setRealCues([...])');
  console.log('  3. await __seekTest.runSeekTests()');
  console.log('  Or rapid: await __seekTest.runRapidTest("d", "next-cue", 2210000, 3)');
})();
