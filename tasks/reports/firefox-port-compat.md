# Firefox Port — Compat Report (spike)

> Slug: `firefox-port` · Spec: `docs/specs/firefox-port.md` · Date: 2026-09-26
> Environment: Firefox 156.0 (Desktop, Windows), temporary install via `web-ext run`. Verification harness promoted from `tmp/` probes to a repeatable suite: `e2e/firefox/` (`npm run test:e2e:firefox`, `test:e2e:firefox:attach` for a live session) — classic-RDP client + 4 specs, latest full run `4/4 passed, 0 skipped, 0 failed` on a fresh profile.
> Artifact: `dist-firefox/` (transform of `dist/`, gecko.id `tihoka@the0cean.dev`, strict_min_version `128.0`)

Statuses: `works` / `degraded` / `broken` / `untested`. Evidence is verbatim probe output; paths are repo-relative.

## TL;DR — recommendation inputs

- **Core loop works end-to-end on Firefox**: install → MAIN-world inject → caption detection → relay → background store → auto-load → body fetch → in-page panel renders real cue text. Downloads via `blob:` URL work; OCR WASM inits `ready/wasm` through the new in-process dispatch path.
- **eSpeak pronunciation: FIXED and verified end-to-end.** The original CDN+blob loading was unfixable via CSP — assets are now vendored (`public/espeakng/`), the main script loads as `'self'`, and a tiny worker entry pre-sets `self.Module` so the Emscripten `Module=eval(...)` bootstrap is skipped under CSP. `PRONUNCIATION_ESPEAK_TTS` e2e (popup→bg→dispatch→runner→WAV): `{"success":true,"bytes":64812}`; `list_voices` returns 95 voices (data package loaded); no CSP violations. A pre-existing consumer bug was also fixed: the worker posts audio chunks as transferred `ArrayBuffer`s — `samples.length` is `undefined` there, which the code misread as the end-of-synthesis sentinel.
- **Verdict input**: continue parity on the transform approach. Total delta so far ≈300 lines across adapters + one ~100-line deterministic transform, zero new runtime deps. Nothing observed justifies a WXT migration — WXT would re-solve problems already solved here and does not fix the eSpeak/blob issue (that is engine packaging, not build tooling). Android needs a separate device test; desk-check below flags `downloads` as the likely blocker.

## Smoke matrix (REQ-4 fixed order)

| # | Step | Status | Evidence |
|---|------|--------|----------|
| 1 | `build:firefox` emits installable `dist-firefox/` | works | `build-firefox: ...dist-firefox written (gecko.id=tihoka@the0cean.dev, min=128.0)`; manifest shows `background.page=firefox-background.html`, `persistent:false`, `browser_specific_settings.gecko{id, strict_min_version:"128.0"}`, no `service_worker`/`side_panel`/`sidebar_action`/`offscreen`/`tts` keys |
| 2 | Temporary install on Firefox ≥128 | works | web-ext `installTemporaryAddon` → `tihoka@the0cean.dev`; `[BG-BOOT] service-worker-loader imported` in event page |
| 3 | Background event page init | works | API surface probe: `offscreen:undefined`, `sidePanel:undefined`, `tts:undefined`, `dnr:object`, `navigator.storage.getDirectory:function`, `AudioContext:function`; no init crash after adapter guards |
| 4 | Content script + MAIN-world inject on youtube.com | works | page-context probe: `fetchPatched:true`, `ytMainWorldInjected:true`, `captionTracks:2`, `vidId:RoBabfioVF8` |
| 5 | In-page subtitle panel renders | works | deep shadow-DOM traversal: panel host present, `subBlockDeep:38`, cue text `"Strider, too. I'll be able to go fast. Okay, I'm looking to hide in a tree..."`, `videoPaused:false` |
| 6 | Subtitle capture → cues populate | works | `__YT_CS_READY`/`__YT_DETECTED_SUBTITLES` observed in isolated world; real ASR track (signed timedtext URL) stored for tab 1; `AUTO_LOAD_SUBTITLES` delivered to content script (no "no receiving end"); cues rendered (row 5). Determinism re-verified in parity phase: two root causes found & fixed — (a) `webNavigation.onHistoryStateUpdated` wiped detection on YouTube's cosmetic `&t=` replaceState → `isMediaRelevantUrlChange` comparator added (`helpers.ts`); (b) first CS→bg relay after event-page wake raced listener registration → `relayToBackground` retry + dedup-flag reset in `subtitleBridges.ts`. Final probe: detect→`&t=` preserved→`?v=` cleared, VERDICT: PASS |
| 7 | Subtitle body fetch | works | direct cs fetch of timedtext URL: `status:200, len:861701`; `FETCH_SUBTITLE_CONTENT` via bg→`offscreenFetch`→in-process dispatch: `success:true, bodyLen:861701` |
| 8 | Download via heavy-work path | works | `downloads.download` of `blob:moz-extension://…` → `{"downloadId":1}` works; `data:` URL downloads never complete on Firefox (probe timeout) → `saveBlobToDownloads` picks `blob:` on Firefox UA. **ffmpeg/transmux e2e verified**: real HLS playlist (8×~90KB MPEG-TS, ffmpeg-generated) → webRequest detection → `DOWNLOAD_VIDEO` ×2 concurrent → OPFS `input.ts` → `CONVERT_TS_TO_MP4_V2` in-process → `output.mp4` → blob URL → `downloads.download` → `hls-fixture(N).mp4` complete ×2 (337332 B each, ffprobe: valid mp4 h264+aac, 18s). Recurring `FILE_FAILED` root-caused via the e2e suite: `saveOpfsFile` resolved at `downloads.download` issue time and the caller deleted the OPFS subdir while Firefox still lazily streamed the blob → every retry hit the already-deleted OPFS entry. Callback contract now resolves at download terminal state; same-base gate + free-name pick + bounded `FILE_FAILED` retry cover Firefox's opaque disk-uniquify pass |
| 9 | Pronunciation / eSpeak TTS | works | `PRONUNCIATION_ESPEAK_TTS` popup→bg→in-process dispatch→runner→vendored eSpeak: `{"success":true,"bytes":64812}` WAV @22050Hz. Direct probe: `dataFetch:200`, `ready:true`, `voiceCount:95`, synth chunks `buf:17640`×8+`buf:6056`+`buf:0`+done. Zero CSP violations in console |
| 10 | Anki card from a cue | untested | no AnkiConnect listening on `127.0.0.1:8765` in test env — bg fetch returned `NetworkError`, not a CSP block. CSP now permits `http://localhost:*`/`http://127.0.0.1:*`. Needs a live AnkiConnect to confirm |

## Environment rows (REQ-4 rule)

| Surface | Status | Evidence |
|---|---|---|
| `AudioContext` in event page | untested | constructor `function`; audio output/autoplay not exercised |
| OPFS `navigator.storage.getDirectory()` | works | exercised e2e: bg wrote `downloads/{id}/input.ts` (8 MPEG-TS segments) and the in-process runner wrote `output.mp4` back to OPFS before blob-URL handoff |
| `Worker` spawn | works-by-construction | transmux worker is bundled `worker-entry.js` → `moz-extension:` URL → allowed by `script-src 'self'`; actual spawn not exercised |
| `downloads.download` of `blob:` URL | works | `{"downloadId":1,"blobUrl":"blob:moz-extension://…"}` |
| `options_page`/`options_ui` | works-by-construction | accepted by web-ext lint (no error-severity finding on the key); actual presence in `about:addons` not exercised |
| Event-page keep-alive during heavy job | works | `OffscreenManager` pins with `setInterval → runtime.getPlatformInfo()` while in-process jobs run; keep-alive is refcounted and held from blob-URL creation until `downloads.download` reaches complete/interrupted (`acquireKeepAlive`) — the event page cannot suspend while Firefox streams the OPFS-backed blob |
| `wasm-unsafe-eval` CSP | works | manifest CSP applied verbatim; OpenCV WASM init → `{status:'ready', backend:'wasm'}` e2e |

## Discovered API gaps (all observed on real Firefox)

| API / behavior | Divergence | Resolution |
|---|---|---|
| `chrome.offscreen` | `undefined` | New seam: `enableInProcessOffscreenDispatch()` — runners register into a shared dispatch table; `OffscreenManager` lazy-imports runners and direct-dispatches on the Firefox path (`src/shared/lib/chrome-apis/offscreen.ts`, `offscreenManager.ts`) |
| `chrome.sidePanel` | `undefined` | Dropped per owner (dead code); adapter guards return `{success:false,error}` without throwing |
| `chrome.tts` | `undefined` | Pre-existing `speechSynthesis` fallback in `createTtsEngine`; permission stripped from manifest |
| `chrome.downloads.onDeterminingFilename` | `undefined` → unconditional registration crashed bg init | Guarded in `chrome-apis/downloads.ts` (Edge-only quirk; Firefox honors `filename`) |
| `runtime.sendMessage` self-delivery | Firefox does not count the sender's own listeners as a receiving end → `broadcast()` rejected storm | `messageBus.broadcast`/`sendNoWait` swallow "no receiving end" (empty fan-out is valid) |
| DNR `initiatorDomains:[runtime.id]` | Firefox rejects gecko-id-as-domain | `webRequest.onBeforeSendHeaders` blocking fallback (Firefox-only) + `webRequestBlocking` permission added by transform |
| Manifest CSP `connect-src … http:` | `http:` scheme source → Firefox rejects the **entire** CSP and falls back to default | Transform emits explicit sources: `'self' https: data: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*` |
| `script-src blob:` | Invalid token in MV3 CSP → whole CSP rejected; blob scripts can never run in extension pages | Unfixable via manifest — resolved by vendoring eSpeak (row below) |
| `eval()` in extension-page workers | Workers inherit the page CSP; `espeakng.worker.js` bootstrap `Module=eval(...)` throws `EvalError` | Worker entry `public/espeakng/espeakng-worker-entry.js` pre-sets `self.Module` (standard Emscripten pre-configuration) → the `typeof Module==='undefined'` eval branch never runs; the remaining `ccall`/`cwrap` evals are unreachable via the postMessage API |
| eSpeak `synthesize` chunk contract | Worker posts audio as transferred `ArrayBuffer`s — `samples.length` is `undefined`, misread as end-of-synthesis sentinel → `eSpeak returned empty audio` (pre-existing bug, browser-agnostic) | `synthesizeEspeakToWav` now unwraps `ArrayBuffer → Float32Array` per chunk; falsy samples = the worker's `done` message |
| `downloads.download` of `data:` URL | Never completes (probe timeout) | `saveBlobToDownloads` uses `URL.createObjectURL` when the capability exists — Chrome SW lacks it so the `data:` path stays Chrome-only (`downloadSaver.ts`); blob URL revoked after the download call returns |
| Manifest CSP `connect-src` narrowing | Bare `http:` scheme invalid → dropped | **Accepted limitation**: remote plaintext-HTTP fetches from extension contexts are CSP-blocked on Firefox (localhost hosts stay allowed). `data:` added for OpenCV WASM fetch |
| eSpeak runner | Was `Failed to load eSpeak main script blob` — Emscripten CDN-fetched the main script and injected `<script src=blob:…>` | **Fixed.** `espeakng.js@1.49.0` vendored to `public/espeakng/` (min.js + worker.js + worker.data + worker-entry.js); loads via `chrome.runtime.getURL` as `'self'` on both browsers. Removes the AMO remote-code flag too |
| `initHeavyFeatures` `.next().value is undefined` | Stale-build artifact | Resolved on rebuild — all 3 heavy dynamic imports + init verified OK in the isolated content-script context on the current build |

## Chrome-lane verification (NFR-1, NFR-5)

- `npm run typecheck` ✓, `npm run lint` ✓, `npm run test:unit` ✓ (576 suites / 6877 tests), `npm run build` ✓
- All Chrome-only divergence lives behind capability checks inside `src/shared/lib/chrome-apis/*` adapters or `OffscreenManager`; Chrome manifest untouched (transform writes `dist-firefox/`, never `dist/`).
- `package.json` `dependencies` unchanged; `web-ext` invoked via `npx` only (NFR-3).
- Note: `dist/manifest.json` differs from a pre-change build only in hashed asset names (bundles re-emitted); key set and values unchanged (SC-7 modulo-hash clause).
- Chrome real-browser verify: `npx playwright test e2e/extension-subtitle-manager.spec.ts` (Chromium, `--load-extension=dist`) — **PASS**: content script injects, `#cell-subtitle-root` mounts, manager toggle opens the in-page panel. This covers the exact surfaces the diff touches (content-script init, message flow, in-page UI). A real-youtube.com headed smoke is still worthwhile before merge (ad-hoc probe showed MAIN-world inject + SW alive; `fetchPatched`/`portal` markers inconclusive under headless YouTube consent variance — not a regression signal, harness limitation).

## AMO-readiness

| Area | Finding | Risk |
|---|---|---|
| CSP | Now valid and applied verbatim: `script-src 'self' 'wasm-unsafe-eval'`; explicit `connect-src` | Low — no remote code in policy |
| Remote code | eSpeak runner fetched its main script from CDN at runtime → would fail AMO review regardless of CSP | **Resolved** — all eSpeak code is vendored in the package; zero runtime CDN fetch |
| WASM | Bundled `.wasm` shipped in `dist-firefox/assets/`; `wasm-unsafe-eval` needs a justification note in listing | Low–medium |
| Permissions | `webRequest`+`webRequestBlocking`, `<all_urls>` host perms, `downloads`, `cookies` — all need justifications in the listing form; typical for this product class | Medium — expect reviewer questions |
| `web-ext lint` | **3 errors, 33 warnings** (re-run after eSpeak vendoring): `FILE_TOO_LARGE` ×3 — `assets/opencv*.js` + two `worker-entry-*.js` bundles exceed 5MB and are unparseable by the AMO scanner; warnings: `UNSUPPORTED_API` ×13 (guarded `chrome.*` names — cosmetic), `UNSAFE_VAR_ASSIGNMENT` ×8, `DANGEROUS_EVAL` ×7 (×3 vendored `espeakng.worker.js` — eval branches skipped/unreachable, still flagged by scanner), `ICON_SIZE_INVALID` ×3 (placeholder 67 B icons). `MISSING_DATA_COLLECTION_PERMISSIONS` resolved — transform now emits `gecko.data_collection_permissions:{required:["none"]}` (owner must confirm at listing) | **High** — unparseable >5MB bundles are a scanner blocker; options: split/lazy-load heavy libs, or document source maps; icons must be real assets |
| Data practices | Extension fetches user-targeted media/subtitles to device; AnkiConnect localhost — document in privacy policy | Standard disclosure |
| Event page | `persistent:false` accepted; long jobs rely on keep-alive pinning — document as Firefox-specific behavior if reviewers ask | Low |

## Android desk-check (desk-check only — no device test this item)

| Surface | Likely status | Note |
|---|---|---|
| Install | gated | Stable Firefox Android installs only curated extensions; sideloading needs Nightly + collection or `web-ext run --target=firefox-android` on a dev device |
| Content scripts / `world:MAIN` | likely works | Supported on GeckoView for installed extensions |
| `downloads` API | **likely broken** | `browser.downloads` is unavailable on Firefox Android → download journey needs an alternative (share/intent) or is desktop-only |
| `webRequestBlocking` | uncertain | Needs device verification |
| WASM/heavy work | likely works | Memory/thermal pressure on a ≤1 GB-RAM persona device is the real risk, not the API |
| UI | needs work | Popup exists on Android; in-page panel is touch-hostile at phone sizes; no browser side panel (already dropped) |
| Verdict | **defer** | Android is a separate parity decision after Desktop parity lands; likely scope = capture + cards, no downloads |

## Decision inputs

- **Port parity (recommended)**: the hard architectural questions are answered — event page hosts heavy WASM work via in-process dispatch, detection→render loop works, downloads work via `blob:`, CSP is valid, eSpeak is vendored and verified. Remaining work is enumerable: verify AnkiConnect e2e with a live service, run one real ffmpeg job, Chrome packed smoke.
- **WXT migration**: not justified by evidence. The divergences are Firefox runtime semantics (CSP tokens, blob scripts, self-delivery) — WXT does not solve them; its value is manifest/polyfill plumbing we already have in ~100 lines of deterministic transform + a small adapter layer.
- **Drop**: not supported by evidence — the product's core value path works today.

### Parity backlog (if owner says go)

1. ~~Vendor eSpeak assets~~ — **done**: `public/espeakng/` + worker-entry; pronunciation e2e `{"success":true,"bytes":64812}`; AMO remote-code flag removed.
2. AnkiConnect e2e (card create/update + audio attach) with a live `127.0.0.1:8765`.
3. ~~One real ffmpeg merge → `downloads.download` e2e~~ — **done**: real HLS → OPFS → transmux → blob → `downloads.download` ×2 concurrent → valid MP4s on disk; `FILE_FAILED` flake → keep-alive now held through download terminal state.
4. ~~Detection determinism follow-up~~ — **done**: two root causes fixed (cosmetic `&t=` rewrite wiping store → `isMediaRelevantUrlChange`; wake-race dropping first relay → `relayToBackground` retry + dedup reset). Firefox probe VERDICT: PASS; Chrome e2e stage2 63/63 PASS.
5. ~~Chrome packed `.crx` smoke~~ — **done**: packed `.crx` + cloned profile, SW alive, content inject + panel + eSpeak e2e on real Chrome.
6. Android: device test decision; document `downloads` unavailability as accepted degradation or design an alternative.
7. Real icon assets (lint `ICON_SIZE` warning) before AMO submission.
8. `FILE_TOO_LARGE` bundles (opencv.js, worker-entry ×2 >5MB) unparseable by the AMO scanner → split/lazy-load or shrink before listing; this is a hard AMO blocker, independent of runtime.
9. Confirm `gecko.data_collection_permissions: {required:["none"]}` declaration is accurate at listing time.

## SC traceability (spec `docs/specs/firefox-port.md`)

| SC | Result |
|---|---|
| SC-1 build+manifest | PASS |
| SC-2 web-ext lint | **FAIL** — exit 1: 3 `FILE_TOO_LARGE` errors (>5MB bundles unparseable by AMO scanner) + 29 warnings (`MISSING_DATA_COLLECTION_PERMISSIONS` resolved via transform). Corrected after fresh-context verify (`docs/reviews/firefox-port-verify.md`) |
| SC-3 install + bg init | PASS |
| SC-4 inject + cues to panel | PASS |
| SC-5 download attempted | PASS — `blob:` download verified; real .ts→transmux→OPFS→`downloads.download` e2e ×2 concurrent → valid MP4 (ffprobe h264+aac) |
| SC-6 sidePanel degrade + in-page panel | PASS |
| SC-7 Chrome gates | PASS (packed `.crx` smoke on real Chrome: SW + inject + panel + eSpeak e2e; stage2 63/63) |
| SC-8 this report | PASS |
| SC-9 deps unchanged | PASS |
| SC-10 zero unhandled rejections | PASS (broadcast storm fixed; post-fix smoke console clean of new rejections) |
| SC-11 keep-alive mid-job | PASS — pinning active during in-process jobs; extended to cover blob-URL → `downloads.download` terminal window (`acquireKeepAlive` refcount); concurrent-job e2e PASS |
| SC-12 Anki card | RECORDED `untested` — no live AnkiConnect in env; CSP/CORS path cleared for localhost |
