# Verify Review — firefox-port (DELIVER)

VERDICT: APPROVE_WITH_CHANGES — the engineering is sound and verified; the compat report contains one falsified claim (SC-2 lint evidence) that must be corrected before the owner consumes it as decision-grade evidence.

## Scope reviewed

- Spec `docs/specs/firefox-port.md` (REQ-1..5, NFR-1..6, SC-1..SC-12), intent, plan, ADR-106, compat report.
- Diff: `chrome-apis/{offscreen,downloads,declarativeNetRequest,sidePanel}.ts`, `offscreenManager.ts`, `messageBus.ts`, `downloadSaver.ts`, runner registration sites (`ffmpegRunner.ts:472`, `ttsRunner.ts:20`, `pronunciationRunner.ts:17`), `featureInit.ts`, `scripts/build-firefox.mjs`, `package.json`, `.gitignore`, `eslint.config.ts`, new test `tests/unit/shared/lib/chrome-apis/offscreenDispatch.test.ts`.
- Fresh-context verify ran independent evidence: re-executed the manifest transform, ran `web-ext lint`, re-ran typecheck/lint/unit suite, diffed emitted manifests.

## Independent evidence gathered this review

- `node scripts/build-firefox.mjs` re-run → `dist-firefox/manifest.json` sha256 identical before/after (`2a0548cb…`) — transform is deterministic; `dist/` untouched (verified — Chrome manifest still has `service_worker`, `side_panel`, `offscreen`/`sidePanel`/`tts`, original CSP).
- Emitted `dist-firefox/manifest.json` inspected: `background.page=firefox-background.html`, `persistent:false`, `gecko{id:"tihoka@the0cean.dev", strict_min_version:"128.0"}`, zero forbidden keys, `webRequestBlocking` added, `match_origin_as_fallback`/`use_dynamic_url` stripped, 5 `world:"MAIN"` scripts retained, CSP rewritten to Firefox-legal tokens.
- `npx web-ext lint --source-dir dist-firefox` → **exit 1, errors=3** (FILE_TOO_LARGE ×3: `assets/opencv*.js`, two `worker-entry-*.js` bundles >5MB), warnings=28.
- `npm run typecheck` — pass. `npm run lint` — pass. `npm run test:unit` — pass, 576 suites / 6877 tests (exactly matches report claim).

## Per-SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 build+manifest | PASS | verified emitted artifact; deterministic re-run byte-identical |
| SC-2 web-ext lint 0 errors | **FAIL** | reproduced: exit 1, 3 FILE_TOO_LARGE errors — report's "0 errors" claim is false (Finding 1) |
| SC-3 install + bg init | PASS (report evidence) | `web-ext run` temporary install + `[BG-BOOT]` log; probes in `tmp/firefox-port/` corroborate |
| SC-4 inject + cues | PASS (report evidence) | MAIN-world markers + real cue text extracted from deep shadow DOM |
| SC-5 download attempted | PASS w/ caveat | `downloads.download` of `blob:` verified; dispatch path proven e2e via `FETCH_SUBTITLE_CONTENT`→in-process (bodyLen 861701) and OpenCV init `ready/wasm`; **ffmpeg transcode itself untested** — matrix row honestly says `degraded`, SC table "PASS" elides this (Finding 7) |
| SC-6 sidePanel degrade | PASS | code-verified: adapter throws → `sidePanelRelay.ts:51-55` returns `{success:false,error}`; in-page panel works per probe |
| SC-7 Chrome gates | PASS | typecheck/lint/test:unit re-run green; `public/manifest.json` untouched → emitted manifest semantically identical modulo hashes |
| SC-8 report exists | PASS | matrix, API-gap list, AMO, Android sections all present |
| SC-9 deps | PASS | `package.json` dependencies untouched; web-ext via `npx` only |
| SC-10 zero unhandled rejections | PASS (not independently verifiable) | bootstrap page installs an `unhandledrejection` hook (`build-firefox.mjs:86-90`); probes capture `pageError`/`consoleAPICall`; claim hedged ("clean of *new* rejections") — acceptable |
| SC-11 keep-alive mid-job | PARTIAL — honestly marked | mechanism implemented (`offscreenManager.ts:233-245`); real long-job e2e in parity backlog |
| SC-12 Anki card | RECORDED untested — acceptable per REQ-4 rule | no live AnkiConnect; CSP path cleared for localhost |

## Dispatch-seam audit (REQ-2 contract) — verified correct

- **No double-registration**: `inProcessDispatch` flag set in `doEnsureOffscreenDocument` (`offscreenManager.ts:88`) strictly before the dynamic runner imports; runners register at module eval (`ffmpegRunner` via `bootstrapOffscreenListener`→`startMessageListener`, tts/pronunciation at top level). Runner modules are not statically reachable from the background bundle (grep-verified) — the flag-vs-import ordering cannot invert in production.
- **Sender filter**: synthetic `sender={}` (`offscreen.ts:58`) — all three listeners key on `!sender?.tab` only; ffmpegRunner/ocrRunner ignore sender entirely. Passes.
- **First-response-wins / async**: `responded`/`waitingAsync` logic (`offscreen.ts:48-70`) mirrors `sendMessage`: sync `sendResponse` wins immediately; `return true` holds the Promise open; `false`/`undefined` without response advances to the next listener; none → resolves `undefined` (vs sendMessage's reject-if-zero-listeners — reachable only if ping raced registration, and the 20×100ms retry tolerates it).
- **`_OFFSCREEN_` normalization preserved**: normalization lives inside the ffmpegRunner listener (`ffmpegRunner.ts:339-352`), not in dispatch — dispatch passes the raw request through; `OCR_INIT`/`_OFFSCREEN_OCR_INIT` both handled.
- **Keep-alive lifecycle**: interval started only when `!isOffscreenSupported()` and `activeSends>0`, stopped at 0 (`offscreenManager.ts:197,210-211,233-245`); no leak path found (idle-close on Firefox just resets `documentExists`/`isReady`; event-page suspension wipes all module state cleanly so re-wake re-initializes).
- **Chrome path**: `sendToHeavyHost` returns the same `sendMessage` call on Chrome; error-path flag reset still gated to Chrome. Byte-equivalent behavior.

## Findings (severity-ordered)

### Major

1. **Falsified SC-2 evidence + missed AMO-significant lint findings.** `tasks/reports/firefox-port-compat.md:110` claims `web-ext lint` "exits 0 with no ERROR-severity findings"; reproduced today: exit 1, **3 `FILE_TOO_LARGE` errors** (`assets/opencv*.js`, `worker-entry-*.js` ×2 — >5MB, unparseable by the AMO scanner) and **28 warnings** including `MISSING_DATA_COLLECTION_PERMISSIONS` — `browser_specific_settings.gecko.data_collection_permissions` is *required for all new Firefox extensions* per the linter. Neither the errors nor the data-collection warning appear in the report's warning enumeration (`firefox-port-compat.md:73`) or AMO-readiness section — yet the AMO scanner is the same linter, so this is exactly the evidence the spike exists to collect. Required: correct SC-2 to its real outcome (FAIL-as-specified / blocked), enumerate the actual warnings, and add both items to AMO-readiness (unparseable bundles are a review blocker independent of CSP; `data_collection_permissions` is a required manifest addition for listing).

### Moderate

2. **CSP rewrite silently narrows `connect-src` and the report never records it.** `scripts/build-firefox.mjs:71-77` rewrites `connect-src 'self' http: https:` → `'self' https: data: http://localhost:* …` — all non-localhost plaintext-HTTP fetches from extension contexts (subtitle/media sources served over `http:`) are now CSP-blocked on Firefox; `data:` was *added*. This is forced by Firefox CSP legality (bare `http:` invalidates the whole policy), but it is a real semantic narrowing of the shipped CSP and belongs in the API-gap/limitation table. Not a Chrome regression (transform only).

3. **`downloadSaver.ts:121` UA-sniff violates the stated Boundary.** Spec Boundaries: "capability-detect, never UA-sniff". The `navigator.userAgent.includes('Firefox')` term is also redundant — `saveBlobToDownloads` is only called from background (`downloader.ts:319`), where Chrome SW lacks `URL.createObjectURL` and the Firefox event page has it; `typeof URL.createObjectURL === 'function'` alone is the pure capability check with identical outcome. Harmless in practice, but it normalizes a pattern the spec forbids — drop the UA term or document why both are needed.

### Minor

4. **DNR fallback edge cases** (`declarativeNetRequest.ts`): (a) `refererListenerRegistered=true` is set *before* `addListener` (line ~66-68) — if `addListener` throws (e.g. a Chrome transient DNR failure path where `webRequestBlocking` permission is absent → `'blocking'` rejected), the flag stays set and all later overrides are silently dead; (b) the fallback applies the Referer/Origin rewrite to **any** resource type, whereas the DNR rule scoped `resourceTypes:['xmlhttprequest']`; (c) `dnrInitiatorSupported` latches `false` on *any* `updateDynamicRules` failure including transient Chrome errors — a one-off Chrome hiccup permanently switches the session to the fallback. All three are error-path nits; worth a comment/guard, not blocking.

5. **`messageBus` swallow widens Chrome behavior change.** `swallowNoReceivingEnd` (`messageBus.ts:23-28`) suppresses "no receiving end" rejections on Chrome too (previously unhandled-rejections) and downgrades other send failures to `console.warn`. Justified for Firefox (sender's own listeners don't count as receiving ends) and defensible for fire-and-forget, but it removes a signal that could mask a genuinely missing handler on Chrome. Acceptable; noted.

6. **`URL.createObjectURL` blob never revoked on Firefox** (`downloadSaver.ts`): each download mints a `blob:` URL that lives until event-page suspension. Bounded by the non-persistent page's lifecycle (self-cleaning on suspend), but a long session accumulates blobs; could revoke on `downloads.onChanged` terminal state. Minor.

7. **Report granularity slips**: (a) `options_page` row marked `works` on lint acceptance alone — actual options-page presence in `about:addons` not exercised; (b) SC-5 table says `PASS` while its own matrix row 8 honestly says `degraded` + ffmpeg e2e `untested` — SC row should read PARTIAL/degraded to match; (c) untested rows elsewhere (Anki, OPFS, AudioContext, Android) are honest — no silent gaps.

8. **Repo hygiene**: `docs/0-wiki.md` not updated despite `docs/` changes (ADR-106, spec, intent) — repo rule requires a wiki touch-up; ADR not indexed anywhere.

## What checked out clean

- Spec/intent stale `sidebar_action` lines all fixed (grep-verified — only intentional mentions remain).
- `sidePanel.ts` degrade throws inside adapter → existing handler converts to `{success:false,error}` — REQ-3 contract met; `setPanelBehavior` no-op fine (dead code noted in report).
- `downloads.ts` `onDeterminingFilename` guard correct; `initHeavyFeatures` stack logging is neutral.
- New unit test covers the dispatch contract (sync/async response, no-handler, skip-false, synthetic sender, unregister) — passes.
- Runner business logic untouched — only registration-site swaps, per Boundary.
- `eslint.config.ts` + `.gitignore` correctly exclude `dist-firefox/`; `package.json` `build:firefox` = build + transform as spec'd.
- ADR-106 accurately documents the seam including the eSpeak `blob:`-script CSP blocker.

## Required changes (before owner consumes the report / merge)

1. Fix `firefox-port-compat.md` SC-2 row + smoke matrix: record the real lint output (exit 1; 3 FILE_TOO_LARGE errors; 28 warnings incl. `MISSING_DATA_COLLECTION_PERMISSIONS`); mark SC-2 as failed/blocked rather than PASS.
2. Add to AMO-readiness: >5MB unparseable bundles (scanner blocker) and required `gecko.data_collection_permissions`.
3. Record the `connect-src` narrowing (remote `http:` dropped → localhost-scoped) as a discovered limitation in the API-gap table.
4. Change SC-5 traceability row to PARTIAL (ffmpeg e2e untested) to match the matrix's own `degraded` status.

## Recommended (non-blocking)

5. `downloadSaver.ts`: drop the `navigator.userAgent` term (pure capability check is equivalent) or add a one-line justification.
6. `declarativeNetRequest.ts`: set `refererListenerRegistered` after successful `addListener`; optionally scope the fallback to `xmlhttprequest`.
7. Update `docs/0-wiki.md` for the Firefox lane + ADR-106.
8. Optional: revoke minted `blob:` URLs post-download in `downloadSaver`.

## Applied fixes (post-review, 2026-09-26)

1. ✅ Required 1–4: compat report corrected — SC-2 now records the real lint outcome (exit 1, 3 `FILE_TOO_LARGE` errors, 29 warnings); AMO table enumerates the actual warning classes + the bundle-size scanner blocker; `connect-src` narrowing recorded as an accepted limitation; SC-5 marked PARTIAL; `options_page` downgraded to works-by-construction; parity backlog += FILE_TOO_LARGE remediation + data-collection declaration confirmation.
2. ✅ `MISSING_DATA_COLLECTION_PERMISSIONS` resolved: transform emits `gecko.data_collection_permissions:{required:["none"]}` (lint warning gone, re-verified).
3. ✅ `downloadSaver.ts`: UA term dropped → pure capability check `typeof URL.createObjectURL` per spec boundary; minted `blob:` URL revoked after `chromeDownload` returns. The 3 downloader tests now call `simulateServiceWorkerContext()` (removes the jsdom `createObjectURL` mock) — they honestly simulate the Chrome SW they claim to test; `afterEach` restores the mock.
4. ✅ `declarativeNetRequest.ts` nits: `refererListenerRegistered` set after `addListener` succeeds; fallback listener scoped to `types:['xmlhttprequest']` (matching the DNR rule's `resourceTypes`); `dnrInitiatorSupported` only latches on initiator-related rejections — transient/other `updateDynamicRules` failures rethrow.
5. ✅ `docs/0-wiki.md` updated with the Firefox lane + ADR-106.
6. Not applied: `messageBus` swallow widening (Finding 5) — accepted by reviewer as defensible for fire-and-forget; keeping as-is.

## Residual risks

- Firefox smoke evidence is report-based; I verified build/test artifacts and code paths but did not re-run `web-ext run` + RDP probes — SC-3/4/10 accepted on report + probe-script corroboration.
- Keep-alive effectiveness for jobs >30s is implemented but unproven end-to-end (report honestly marks PARTIAL); parity backlog item #3 covers it.
- Chrome packed-`.crx` real-browser smoke still pending (report flags it; parity backlog #5) — required by repo rules before merge.

## Post-fix verification — eSpeak vendored (2026-09-26, round 2)

Owner directed: fix the eSpeak blocker and take the item to merge.

| Check | Evidence |
|---|---|
| Vendored assets | `public/espeakng/` = `espeakng.min.js` + `espeakng.worker.js` + `espeakng.worker.data` (jsDelivr espeakng.js@1.49.0) + `espeakng-worker-entry.js` (pre-sets `self.Module` → skips CSP-blocked `Module=eval` bootstrap; `locateFile` resolves `.data` as sibling URL). Copied verbatim to `dist-firefox/espeakng/` |
| Runtime CDN fetch removed | `espeakOffscreenEngine.ts` now appends `<script src=chrome.runtime.getURL(...)>`; zero `cdn.jsdelivr` references remain in src |
| Firefox e2e | `PRONUNCIATION_ESPEAK_TTS` popup→bg→in-process dispatch→runner: `{"success":true,"bytes":64812}` WAV. Direct probe: `ready:true`, `voiceCount:95`, synth chunks `buf:17640`×8 + `buf:6056` + `buf:0` + done sentinel |
| CSP | No script-src/eval violations in post-fix smoke console (previously `EvalError: call to eval() blocked by CSP` at worker bootstrap, and `script-src-elem` blob block) |
| Consumer bug fixed | Worker posts audio chunks as transferred `ArrayBuffer`s; old code read `samples.length` (undefined on ArrayBuffer) as end sentinel → `eSpeak returned empty audio`. Now unwraps `ArrayBuffer→Float32Array` per chunk; falsy `samples` = worker `done` message |
| Gates re-run | typecheck ✓ lint ✓ (espeakng ignored as vendored, `eslint.config.ts`) test:unit ✓ (576/6877) build ✓; `web-ext lint` unchanged profile: 3 `FILE_TOO_LARGE` errors, 33 warnings (+4 `DANGEROUS_EVAL`/`UNSAFE_VAR` flagged inside vendored worker.js — eval branches unreachable via postMessage API) |
| Chrome lane | `npx playwright test e2e/extension-subtitle-manager.spec.ts` — PASS post-change |

Residual: pronunciation proven for `en`; per-language voice data ships in the single `.data` package (95 voices enumerated). AnkiConnect still `untested` (no live service).
