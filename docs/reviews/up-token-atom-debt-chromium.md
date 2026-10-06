# VERIFY-RESULTS — up-token-atom-debt (real Chromium)

- Date: 2026-10-07 · Build under test: `dist/` (built 2026-10-06 23:48, newer than last src change 23:43 — includes all uncommitted working-tree changes)
- Environment: Playwright 1.63.0 bundled Chromium, **headed** persistent context with `--load-extension=dist` + `--disable-extensions-except` (repo fixture pattern; headless can't load MV3)
- Mock site: StreamFlix at `http://127.0.0.1:4421/index.html` (`node scripts/serve-mock-pages.mjs --stream --no-build` with `PW_PORT_OFFSET=100` — port 4321 was occupied by a stale `serve-mock-pages --stream --youtube` process returning 404, left untouched)
- Scripts: `tmp/up-token-atom-debt/verify.mjs` (checks 1–5), `verify-extra.mjs` (check 6)
- Raw results: `results.json`, `results-extra.json` · Captures: `captures/` (19 PNGs)

## Verdict: PASS (8/8 functional checks; 0 extension console errors)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1a | Panel Escape — closes panel with focus on the host page (document-global, delta D4) | PASS | state assertions; `captures/desktop-00-panel-open.png` |
| 1b | Profile Dialog — Esc closes dialog only; panel still open; 2nd Esc closes panel | PASS | `captures/desktop-01-profile-dialog.png` |
| 1c | Tools BottomSheet (390px) — Esc closes sheet only; panel still open; 2nd Esc closes panel | PASS | `captures/mobile-01-tools-sheet.png` |
| 2 | Dictionary popup `composedPath` level resolution — Esc inside focused level-2 popup pops only level 2 (hosts 2→1, panel open); next Esc pops level 1 (hosts→0, panel open); 3rd Esc closes panel | PASS | `captures/desktop-02-popup-2levels.png` |
| 3a | FieldAutoGrowInput autosize — setting 3-line value grew `rows` 1→3 and height 41→83px | PASS | in-page measurement |
| 3b | TagInput IME guard — `compositionstart` + Enter (`isComposing:true`, flag verified true) swallowed (0 chips, raw text kept); `compositionend` + plain Enter committed chip (1 chip) | PASS | in-page DOM assertions |
| 4 | `.when` and `.statusChip` computed `font-size` = `12px` (accepted deltas D1/D2) | PASS | computed style; `captures/desktop-03-recap.png` |
| 5 | Zero-drift smoke — per-tab captures desktop (1280×800) + mobile (390×844) × 6 tabs; no console errors from the extension | PASS* | `captures/desktop-tab-*.png`, `captures/mobile-tab-*.png` |
| 6 | Reverse LIFO — popup opened from page text first, then panel: Esc closes panel (top layer), popup survives mounted (hosts still 1), next Esc pops it | PASS | `captures/desktop-05-popup-under-panel.png` |

\* The only console errors observed (2×) are `Failed to load resource: 404` for `/fonts/Inter/InterVariable-subset.woff2` — reproduced on a plain Chromium page load **without the extension**, i.e. pre-existing mock-serving noise from `src/shared/styles/fonts.css` (untouched by this diff), not a regression.

## How each risk spot was driven

- **Panel/sheet/dialog**: badge click opens `#cell-universal-panel-host`; tools via `[data-cell-id="universal-panel-mobile-tools"]` at 390×844; profile dialog via `[data-cell-id="universal-panel-profile-button"]` (language profile seeded via `chrome.storage.local settings` — schemaVersion 35, `activeProfileId: 'p1'`).
- **Popup over panel**: seeded `orca-dict-devmode0-en` (service-worker IndexedDB, mirror of `e2e/stage2/dictionary-nested-popup.spec.ts`); searched `silence` in the panel's integrated Dictionary, clicked `absence` in its `[data-allow-lookup]` definitions → `.js-cell-popup-host` mounted **above** the open panel (`isLookupFromUniversalPanel` → `abovePanel`), then `state` inside it → 2nd level. Focused a level-2 element via `el.focus()` so `composedPath` resolved the focused level.
- **FieldRow**: card creator renders in the Dictionary tab's right pane unconditionally; drove `cc-target-word-input` textarea and `cc-tags-input` via React-safe native setters + synthetic `CompositionEvent`/`KeyboardEvent` (`isComposing` constructor flag — verified readable as `true`).
- **Recap font deltas**: seeded `orca-local-player` (video + history record) + `langWordStatus` entry inside the session window → Recap hero rendered `.when` and derived `.statusChip`; computed styles read from the shadow root.

## Notes / observations for the owner

- Ordering confirmed in **both** directions: popup layer pushed after the panel's pops first (focused level first, then top level); popup layer pushed before the panel's waits until the panel closes — matching `pushEscapeLayer` LIFO + spec D4/D5.
- Popup opened from page text stays **mounted** under the open panel (z-index drop via `syncPanelZIndex`), pops on the next Escape after the panel closes.
- Leftover artifacts in `tmp/up-token-atom-debt/`: `verify.mjs`, `verify-extra.mjs`, `results*.json`, `captures/`, `.profile-*` dirs (browser profiles — safe to delete; kept for reproduction).
- Not modified: no `src/` files touched, no pipeline state mutated, nothing committed.
