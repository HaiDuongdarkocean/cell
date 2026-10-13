# Plan — firefox-port (spike → compat report)

Spec: `docs/specs/firefox-port.md` · Intent: `docs/intent/firefox-port.md` · Worktree: `Tihoka-worktrees/firefox-port` · Branch: `feature/firefox-port`

## Task breakdown

| # | Task | REQ | Files | Parallel | AC |
|---|---|---|---|---|---|
| T1 | Manifest transform + build script | REQ-1 | `scripts/build-firefox.mjs` (new), `package.json` (+`build:firefox`) | — | SC-1, SC-2, SC-9 |
| T2 | Offscreen seam: dispatch registry + Firefox in-process path + event-page keep-alive | REQ-2 | `chrome-apis/offscreen.ts`, `offscreenManager.ts`, `ffmpegRunner.ts`, `ttsRunner.ts`, `pronunciationRunner.ts` | after T1 | SC-3, SC-5, SC-10, SC-11 |
| T3 | sidePanel + audit guards (no-op degrade) | REQ-3 | `chrome-apis/sidePanel.ts` | parallel w/ T2 | SC-6 |
| T4 | Chrome gates green | NFR-1 | — | after T1-T3 | SC-7 |
| T5 | web-ext lint + Firefox install + smoke matrix | REQ-4 | `tasks/reports/` evidence | after T4 | SC-3..SC-6, SC-10-12 |
| T6 | Compat report | REQ-5 | `tasks/reports/firefox-port-compat.md` | after T5 | SC-8 |
| T7 | Fresh verify + sign-off + ship | — | `docs/reviews/*-verify.md`, `-signoff.md`; docs updates | after T6 | all |

## Dispatch contract (T2 design)

Runners register listeners via `onMessage` → on Chrome they're real offscreen listeners; on Firefox they'd double-fire if also attached to the event page's `chrome.runtime.onMessage`. Solution: dedicated registry in `chrome-apis/offscreen.ts`:

- `isOffscreenSupported()` — `typeof chrome !== 'undefined' && !!chrome.offscreen`
- `registerOffscreenListener(fn)` — Chrome: `onMessage(fn)`; Firefox/no-offscreen: registry.add(fn)
- `unregisterOffscreenListener(fn)` — symmetric removal (registry + real onMessage)
- `dispatchOffscreenMessage(request)` — iterate registry; synthetic `sender={}` (passes `!sender?.tab` filters); sendResponse→Promise, first response wins; listener returning false/undefined without sendResponse → next listener; none respond → `undefined` (mirrors sendMessage)

`OffscreenManager` Firefox path: `ensureOffscreenDocument` → lazy `import()` of the 3 self-registering runner modules (`ffmpegRunner` pulls `ocrRunner` via its `ocrMessageListener` import; all three self-register into the registry at import). `sendToOffscreen` → dispatch + keep-alive pin while `activeSends>0` (`setInterval(chrome.runtime.getPlatformInfo, 20s)` — pins event page so `blob:` URLs survive the job). `closeOffscreenDocument` → no-op.

Runner edits are 1-line swaps at registration sites: `onMessage(listener)` → `registerOffscreenListener(listener)`; `removeOnMessageListener` → `unregisterOffscreenListener`.

## Manifest transform rules (T1)

Read `dist/manifest.json` → emit `dist-firefox/`:
- `background`: `{service_worker,type}` → `{page:"firefox-background.html", persistent:false}` + write wrapper HTML (`<script type="module" src="<emitted sw file>">`)
- delete `side_panel`; permissions minus `offscreen`,`sidePanel`,`tts`
- `browser_specific_settings.gecko={id:"tihoka@the0cean.dev",strict_min_version:"128.0"}`
- strip `match_origin_as_fallback` (content_scripts), `use_dynamic_url` (WAR)
- keep `world:"MAIN"`, locales, CSP, options_page, action, icons
- `npm run build:firefox` = `npm run build` + `node scripts/build-firefox.mjs` (standalone runnable)

## Smoke matrix (T5)

install → inject(youtube) → in-page panel → capture → download (blob-URL lifetime) → Anki card → env rows: AudioContext/OPFS/Worker/blob-download/options_page. Statuses: works|degraded|broken|untested. Missing Firefox on the machine → mark untested with honest note (report stays decision-grade on what ran).
