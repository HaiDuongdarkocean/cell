# ADR: Firefox Event Page — In-Process Offscreen Dispatch + Manifest Transform

**Date:** 2026-09-26
**Status:** Accepted (spike-verified; revisited at parity decision)

## Context

Tihoka targets Firefox ≥128 alongside Chrome (`firefox-port` item). Three hard platform divergences shape the architecture:

1. Firefox MV3 refuses `background.service_worker` entirely — the background must run as an event page (`background.page`), which is a full document context.
2. `chrome.offscreen` does not exist on Firefox, but the codebase routes all heavy WASM work (ffmpeg, OCR, TTS, pronunciation) through `OffscreenManager` → offscreen document → runner `onMessage` listeners.
3. The browser `sidePanel` surface is dead code per owner (the in-page subtitle panel is canonical), so Firefox drops it rather than porting to `sidebar_action`.

Two build outputs must come from one SSOT manifest and one source tree, with zero Chrome regression.

## Decision

1. **Build lane: post-build transform, not a second manifest or a framework.** `scripts/build-firefox.mjs` reads `dist/` and emits `dist-firefox/`: rewrites `background` to `{page: "firefox-background.html", persistent: false}` (wrapper HTML loads the emitted module via `<script type="module">`), drops `side_panel` + `offscreen`/`sidePanel`/`tts` permissions, injects `browser_specific_settings.gecko`, adds `webRequestBlocking`, and rewrites CSP to Firefox-legal tokens (explicit `connect-src` sources; no `blob:`/`http:` scheme sources — Firefox rejects the entire policy on an invalid token). `public/manifest.json` remains the only manifest source.

2. **Offscreen seam: shared listener registry.** `chrome-apis/offscreen.ts` gains `registerOffscreenListener(fn)`/`unregisterOffscreenListener(fn)`/`dispatchOffscreenMessage(request)`. Runner registration sites swap `onMessage(listener)` → `registerOffscreenListener(listener)` — a 1-line change each; runner business logic untouched. `OffscreenManager.sendToOffscreen` branches on `isOffscreenSupported()`: Chrome keeps the real offscreen path; Firefox lazy-imports the runner modules (they self-register into the registry) and dispatches in-process in the event page.

3. **Opt-in flag, not API sniffing, on the listener side.** `enableInProcessOffscreenDispatch()` is called by `OffscreenManager` before lazy-importing runners. Listener modules cannot infer mode from `typeof chrome.offscreen` (test envs mock the chrome object), so the mode is set explicitly by the only component that knows the host.

4. **Keep-alive pin for non-persistent event page.** While in-process jobs run, `OffscreenManager` polls `chrome.runtime.getPlatformInfo()` on an interval so the event page does not suspend mid-job and invalidate `blob:` URLs minted for `downloads.download` (NFR-6).

5. **Firefox quirks fixed at adapter seams, not call sites.** `downloads.download` gets `blob:` URLs on Firefox (`data:` never completes); `broadcast`/`sendNoWait` swallow "no receiving end" (Firefox does not count the sender's own listeners); DNR `initiatorDomains` falls back to `webRequest.onBeforeSendHeaders` (gecko IDs aren't valid domains); `onDeterminingFilename` registration is guarded (API absent).

## Consequences

- Chrome lane is untouched by construction: every branch keys off `typeof chrome.x`/UA inside adapters; gates stay green and `dist/` semantics unchanged.
- A single `sender`-less listener contract now serves two hosts (offscreen document and event page) — dispatch mirrors `runtime.sendMessage` semantics (first responder wins, undefined when none).
- Known limitation carried forward: eSpeak's Emscripten runtime injects a `blob:` `<script>`, which Firefox MV3 CSP can never allow — pronunciation is `broken` until assets are vendored (parity backlog, also an AMO requirement).
- If parity proceeds, this ADR stands; if the owner picks WXT migration instead, items 2–4 stay valid (they are runtime seams, not build plumbing) and only the transform is replaced.
