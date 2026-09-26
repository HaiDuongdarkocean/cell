# Sign-off Review — firefox-port

VERDICT: SIGN_OFF

## Scope verified

- Intent: `docs/intent/firefox-port.md` · Spec: `docs/specs/firefox-port.md` (REQ-1..REQ-5 + NFRs)
- ADR: `docs/adr/106-firefox-event-page-offscreen-dispatch.md`
- Implementation: `scripts/build-firefox.mjs` transform (`dist/` → `dist-firefox/`), in-process offscreen dispatch (`chrome-apis/offscreen.ts` + `OffscreenManager` + runner registration sites), adapter fixes (broadcast self-delivery, DNR→`webRequest` fallback, blob download, `onDeterminingFilename` guard, sidePanel degrade, keep-alive pin), Firefox CSP rewrite, vendored eSpeak (`public/espeakng/` + `espeakOffscreenEngine.ts`).
- Compat report: `tasks/reports/firefox-port-compat.md` · Verify: `docs/reviews/firefox-port-verify.md` (APPROVE_WITH_CHANGES → all applied + round-2 eSpeak verification)

## What runs on Firefox 156 (real RDP probes)

| Flow | Result |
|------|--------|
| Install + event-page boot | `tihoka@the0cean.dev` temp-installed; bg inits, no crash |
| Subtitle detect → relay → store → auto-load → render | Real ASR track; cue text rendered in shadow DOM (`subBlockDeep:38`) |
| Subtitle body fetch | 861 KB via direct cs fetch AND via bg→`offscreenFetch`→dispatch |
| Heavy work in-process dispatch | `OCR_INIT` e2e → `{status:'ready', backend:'wasm'}` |
| **Pronunciation / eSpeak TTS** | `PRONUNCIATION_ESPEAK_TTS` e2e → `{"success":true,"bytes":64812}` WAV; `voiceCount:95`, zero CSP violations |
| Download | `downloads.download(blob:)` → `{"downloadId":1}` (`data:` path correctly avoided on Firefox) |
| API surface | `offscreen`/`sidePanel`/`tts` absent → adapters degrade cleanly; no unhandled rejections |

## eSpeak blocker — resolution summary

1. Firefox MV3 CSP can never allow `blob:` `script-src` → CDN-fetch+blob-inject unfixable → assets vendored to `public/espeakng/` (`espeakng.js@1.49.0` mirror), loaded via `chrome.runtime.getURL` as `'self'` on both browsers. Removes the AMO remote-code red flag.
2. Workers inherit the page CSP → `espeakng.worker.js`'s `Module=eval(...)` bootstrap blocked → `espeakng-worker-entry.js` pre-sets `self.Module{locateFile}` (standard Emscripten pre-configuration) so the eval branch is skipped; `.data` resolves as a sibling URL. Remaining `ccall`/`cwrap` evals are unreachable via the postMessage API.
3. Pre-existing consumer bug: worker posts chunks as transferred `ArrayBuffer`s — `samples.length === undefined` was misread as the end-of-synthesis sentinel → `eSpeak returned empty audio`. Now unwraps `ArrayBuffer → Float32Array` per chunk; falsy `samples` = done.

## Deterministic gates (final, post-eSpeak)

| Gate | Result |
|------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass (`public/espeakng/` ignored as vendored) |
| `npm run test:unit` | 576 suites / 6877 tests pass |
| `npm run build` | pass |
| `npm run build:firefox` | pass — `dist-firefox/` written, gecko.id `tihoka@the0cean.dev`, min `128.0` |
| `npx web-ext lint --source-dir dist-firefox` | exit 1 — 3 `FILE_TOO_LARGE` errors (opencv.js + 2 worker-entry bundles >5 MB, scanner-unparseable — **known AMO blocker**, parity backlog #8) + 33 warnings |
| Chrome e2e | `e2e/extension-subtitle-manager.spec.ts` PASS (Chromium) |
| Firefox e2e | RDP probe suite PASS (`tmp/firefox-port/*.mjs`) |

## Known residuals (accepted, tracked in parity backlog)

- `FILE_TOO_LARGE` bundles → hard AMO scanner blocker; needs split/lazy-load before listing.
- AnkiConnect `untested` (no live `127.0.0.1:8765` in env — fetch returned NetworkError, not CSP block).
- ffmpeg merge + long-job keep-alive e2e untested (mechanism implemented, PARTIAL).
- Detection determinism across bg reload (timing-sensitive repost — follow-up).
- Chrome packed `.crx` smoke pending (pre-commit rule).
- `gecko.data_collection_permissions:{required:["none"]}` must be confirmed at listing.
- Icons are placeholders (`ICON_SIZE_INVALID` warnings) — replace before AMO.
- Android deferred: `browser.downloads` likely unavailable — separate parity decision.

## Decision

Recommendation recorded in the compat report: **continue parity on the transform approach** — WXT migration not justified (divergences are runtime semantics, not build plumbing); dropping Firefox unsupported by evidence (core value path works).

Owner directed fix + merge — proceeding to merge `feature/firefox-port` into `main`.
