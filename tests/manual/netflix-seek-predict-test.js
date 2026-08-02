/**
 * Netflix seek predict test — chạy trong DevTools console trên Netflix watch page.
 *
 * Cách dùng:
 *   1. Mở Netflix watch page (https://www.netflix.com/watch/XXX)
 *   2. Mở Side Panel extension (để cues load)
 *   3. Mở DevTools console (F12) trên Netflix page
 *   4. Paste toàn bộ file này + Enter
 *   5. Gọi: await runSeekTests()
 *
 * Test sẽ:
 *   - Seek video tới mốc cụ thể (qua __NF_SEEK → Netflix player API, không M7375)
 *   - Predict A/S/D seek target theo logic content script (dùng cues thật)
 *   - Dispatch keydown (content script handler → seekVideo)
 *   - Verify actual seek match predict (trong tolerance 50ms)
 *   - Log PASS/FAIL + chi tiết nếu fail (pos, expected, actual, diff, cue context, browser)
 *
 * Quan trọng: cues phải khớp với bilingualCues của content script (từ TTML parse).
 * Lấy cues thật từ Side Panel React fiber (xem extractRealCues() bên dưới).
 *
 * Ponytail: snippet manual, không vào build. Ceiling: synthetic keydown không
 * trigger React handler trong Side Panel — chỉ test content script path.
 */

(() => {
  'use strict';

  // --- Config ---
  const TOLERANCE_MS = 50; // __NF_SEEK detail = requested target, nên tolerance rất nhỏ
  const SEEK_SETTLE_MS = 800; // đợi seek xong + video ổn định
  const PLAY_AFTER_SEEK = true;

  // --- State ---
  let realCues = [];
  let seekLog = [];

  // --- Utils ---
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : 'Unknown';
  const video = () => document.querySelector('video');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

  // --- Setup: hook __NF_SEEK để log actual seek ---
  function hookSeekLog() {
    seekLog = [];
    document.addEventListener('__NF_SEEK', (e) => {
      seekLog.push({ seekMs: e.detail, time: Date.now() });
    }, { once: false });
    console.log('[seek-test] hooked __NF_SEEK listener');
  }

  // --- Extract real cues từ Side Panel React fiber ---
  // Chạy trên Side Panel page (chrome-extension://), KHÔNG chạy trên Netflix page.
  // Lấy cues từ CueList component props (fiber.memoizedProps.cues).
  // Trả về 934 cues từ TTML parse — khớp với bilingualCues của content script.
  function extractRealCues() {
    const all = document.querySelectorAll('[data-cell-id="cue-item"]');
    if (all.length === 0) {
      console.error('[seek-test] no cue items in DOM. Are you on the Side Panel page?');
      return null;
    }
    const el = all[0];
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    if (!fiberKey) {
      console.error('[seek-test] no React fiber on cue item');
      return null;
    }
    let fiber = el[fiberKey];
    for (let i = 0; i < 30 && fiber; i++) {
      const props = fiber.memoizedProps;
      if (props && props.cues && Array.isArray(props.cues) && props.cues.length > 100) {
        const cues = props.cues.map(c => ({ start: c.start, end: c.end }));
        console.log(`[seek-test] extracted ${cues.length} cues from React fiber, range [${cues[0].start} - ${cues[cues.length-1].end}]ms`);
        return cues;
      }
      fiber = fiber.return;
    }
    console.error('[seek-test] could not find cues in fiber props');
    return null;
  }

  function setRealCues(cues) {
    realCues = cues;
    console.log(`[seek-test] set ${cues.length} cues, range [${cues[0].start} - ${cues[cues.length-1].end}]ms`);
  }

  // --- Predict logic (mirror contentScriptController.ts keyboard handler) ---
  // offsetMs = 0 (default). seekToCue seeks to (cue.start - offsetMs) / 1000.
  // __NF_SEEK detail = cue.start (when offsetMs=0).
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

  // --- Lấy nearCues để debug khi fail ---
  function getNearCues(ms, radius = 5000) {
    return realCues
      .filter(c => c.start > ms - radius && c.start < ms + radius)
      .map(c => ({ start: c.start, end: c.end }));
  }

  // --- Run 1 test case ---
  async function runCase(tc) {
    // 1. Seek tới mốc test
    await seekTo(tc.pos);
    const actualPos = Math.round(video().currentTime * 1000);

    // 2. Predict
    const expected = predictSeek(tc.action, actualPos, tc.offsetMs ?? 0);
    if (expected === null) {
      const r = { ...tc, pos: actualPos, expected: null, actual: null, pass: false, reason: 'predict null (no matching cue)', nearCues: getNearCues(actualPos) };
      logFail(r, r.reason);
      return r;
    }

    // 3. Dispatch keydown (rapid hoặc single)
    seekLog = [];
    if (tc.rapid) {
      for (let i = 0; i < tc.rapid; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: tc.key, bubbles: true, cancelable: true }));
      }
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: tc.key, bubbles: true, cancelable: true }));
    }
    await sleep(SEEK_SETTLE_MS);

    // 4. Verify
    const actualSeek = seekLog[0]?.seekMs ?? null;
    const count = seekLog.length;
    const diff = actualSeek !== null ? Math.round(actualSeek - expected) : null;

    // Pass conditions:
    // - count === 1 (dedupe works: single seek for single/rapid press)
    // - |diff| <= TOLERANCE_MS (seek target matches predict)
    const pass = actualSeek !== null && Math.abs(diff) <= TOLERANCE_MS && count === 1;

    let reason = null;
    if (!pass) {
      if (count === 0) reason = 'no seek fired (handler not triggered or bilingualCues empty)';
      else if (count > 1) reason = `dedupe failed: ${count} seeks (expected 1)`;
      else if (actualSeek === null) reason = 'seekLog empty';
      else reason = `seek mismatch: diff=${diff}ms > tolerance=${TOLERANCE_MS}ms`;
    }

    const result = { ...tc, pos: actualPos, expected, actual: actualSeek, diff, count, pass, reason, nearCues: getNearCues(actualPos) };
    if (pass) logPass(result); else logFail(result, reason);
    return result;
  }

  // --- Run all test cases ---
  async function runSeekTests(cases) {
    if (realCues.length === 0) {
      console.error('[seek-test] NO CUES SET. Call setRealCues([...]) first. See extractRealCues() for how to get cues from Side Panel.');
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

  // --- Default test cases (dựa trên cues thật từ Side Panel, range 2235-2265s) ---
  // Cues thật (934 cues từ TTML parse, khớp bilingualCues của content script):
  //   [0] 2237026.46 - 2238653.08
  //   [1] 2241614.38 - 2242990.75
  //   [2] 2243491.25 - 2246202.29
  //   [3] 2246786.21 - 2250539.96
  //   [4] 2250623.38 - 2254669.08
  //   [5] 2254752.50 - 2256963.04
  //   [6] 2257046.46 - 2259799.21
  //   [7] 2259882.63 - 2262426.83
  //   [8] 2262510.25 - 2264220.29
  //   [9] 2264303.71 - 2268349.42
  function defaultCases() {
    return [
      { name: 'TC1: D from cue[3] middle (2248000) → next cue[4] 2250623', pos: 2248000, key: 'd', action: 'next-cue' },
      { name: 'TC2: A from cue[4] start (2250623) → prev cue[3] 2246786', pos: 2250623, key: 'a', action: 'prev-cue' },
      { name: 'TC3: A from gap (2255000) → prev cue[4] 2250623', pos: 2255000, key: 'a', action: 'prev-cue' },
      { name: 'TC4: S from cue[4] middle (2252000) → replay cue[4] 2250623', pos: 2252000, key: 's', action: 'replay-cue' },
      { name: 'TC5: S from gap (2254800) → replay cue[4] 2250623', pos: 2254800, key: 's', action: 'replay-cue' },
      { name: 'TC6: D from cue[6] middle (2258000) → next cue[7] 2259882', pos: 2258000, key: 'd', action: 'next-cue' },
      { name: 'TC7: A from cue[7] middle (2261000) → prev cue[6] 2257046', pos: 2261000, key: 'a', action: 'prev-cue' },
      { name: 'TC8: rapid D×3 sync → 1 seek (dedupe)', pos: 2250000, key: 'd', action: 'next-cue', rapid: 3 },
      { name: 'TC9: rapid A×3 sync → 1 seek (dedupe)', pos: 2250000, key: 'a', action: 'prev-cue', rapid: 3 },
      { name: 'TC10: rapid S×3 sync → 1 seek (dedupe)', pos: 2250000, key: 's', action: 'replay-cue', rapid: 3 },
    ];
  }

  // --- Run sequence tests (10× nhấn liên tiếp, verify sequence chính xác) ---
  // Test ADR-033: rapid cue-nav không stuck, seek qua 10 cues khác nhau theo trình tự.
  // Expected sequence hardcoded từ cues thật (50 cues rendered, rounded ms).
  // Tolerance 5ms cho TTML float rounding (663329.3334 → 663329).
  async function runSequenceTests() {
    const SEQ_TOLERANCE_MS = 5;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const v = () => document.querySelector('video');
    let seekLog = [];
    document.addEventListener('__NF_SEEK', (e) => seekLog.push({ seekMs: e.detail, time: Date.now() }), { once: false });

    const seekTo = async (ms) => {
      document.dispatchEvent(new CustomEvent('__NF_SEEK', { detail: ms }));
      await sleep(800);
      v()?.play();
      await sleep(200);
    };

    const runRapid = async (key, startPos, count, intervalMs) => {
      await seekTo(startPos);
      await sleep(1200); // đợi lastSeekTarget clear (ADR-033 time guard 1s)
      const actualStart = Math.round(v().currentTime * 1000);
      seekLog = [];
      for (let i = 0; i < count; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        if (intervalMs > 0) await sleep(intervalMs);
      }
      await sleep(800);
      return { startPos: actualStart, seekCount: seekLog.length, seeks: seekLog.map(s => Math.round(s.seekMs)) };
    };

    const verify = (name, actual, expected) => {
      if (actual.length !== expected.length) {
        return { name, pass: false, reason: `count mismatch: actual=${actual.length} expected=${expected.length}`, actual, expected };
      }
      const diffs = actual.map((a, i) => Math.abs(a - expected[i]));
      const maxDiff = Math.max(...diffs);
      const pass = maxDiff <= SEQ_TOLERANCE_MS;
      return {
        name, pass, maxDiff, tolerance: SEQ_TOLERANCE_MS, actual, expected, diffs,
        reason: pass ? null : `max diff ${maxDiff}ms > tolerance ${SEQ_TOLERANCE_MS}ms at index ${diffs.indexOf(maxDiff)}`,
      };
    };

    // Cues thật (50 rendered, rounded ms):
    //   [0] 101893 OUTCAST STICK
    //   [1] 190648 I AM A DUMBASS
    //   [2] 660826 LIVE STUDENT BASHING
    //   [3] 661994 THE GRIM REAPER APPEARS
    //   [4] 663329 EXHILARATING! SPICY!
    //   [5] 666540 SLAP, SLAP, SLAP, SLAP
    //   [6] 668125 HUMAN RIGHTS BEING VIOLATED
    //   [7] 670419 GRIM REAPER.MP4 SMILE
    //   [8] 671629 GRACE SHOWN BY TEACHERS
    //   [9] 702868 PUBLIC OFFICIAL ID CARD
    const d10r = await runRapid('d', 50000, 10, 400);
    const d10 = verify(
      '10×D next-cue (OUTCAST→PUBLIC OFFICIAL, tăng dần)',
      d10r.seeks,
      [101893, 190648, 660826, 661994, 663329, 666540, 668125, 670419, 671629, 702868]
    );
    await sleep(500);

    const a10r = await runRapid('a', 710000, 10, 400);
    const a10 = verify(
      '10×A prev-cue (PUBLIC OFFICIAL→OUTCAST, giảm dần)',
      a10r.seeks,
      [702868, 671629, 670419, 668125, 666540, 663329, 661994, 660826, 190648, 101893]
    );
    await sleep(500);

    const s10r = await runRapid('s', 665000, 10, 400);
    const s10 = verify(
      '10×S replay-cue (EXHILARATING ×10, lặp cùng cue)',
      s10r.seeks,
      [663329, 663329, 663329, 663329, 663329, 663329, 663329, 663329, 663329, 663329]
    );

    const results = [d10, a10, s10];
    const passed = results.filter(r => r.pass).length;
    for (const r of results) {
      if (r.pass) console.log(`%c[PASS] ${r.name}`, 'color:green;font-weight:bold', r);
      else console.log(`%c[FAIL] ${r.name}`, 'color:red;font-weight:bold', r);
    }
    console.log(`%c[seek-test-sequence] DONE: ${passed}/${results.length} PASS on ${browser}`, passed === results.length ? 'color:green;font-weight:bold' : 'color:red;font-weight:bold');
    return { browser, passed, failed: results.length - passed, total: results.length, results };
  }

  // --- Expose API ---
  window.__seekTest = {
    setRealCues,
    runSeekTests,
    runSequenceTests,
    predictSeek,
    getNearCues,
    extractRealCues,
    browser,
    TOLERANCE_MS,
  };

  // --- Hướng dẫn dùng ---
  console.log(`%c[seek-test] loaded on ${browser}. Usage:`, 'color:blue;font-weight:bold');
  console.log('  1. On Side Panel page: __seekTest.extractRealCues() → copy cues');
  console.log('  2. On Netflix page: __seekTest.setRealCues([...])');
  console.log('  3. await __seekTest.runSeekTests()  — single press + dedupe');
  console.log('  4. await __seekTest.runSequenceTests()  — 10× sequence (ADR-033)');
})();
