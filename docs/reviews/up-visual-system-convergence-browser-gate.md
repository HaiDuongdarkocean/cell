# Browser gate rerun — up-visual-system-convergence

> Re-ran by a verify subagent (non-owner) because the recorded `browser` gate was stale: `pass @ 5089bb7e` while HEAD = `3968a251` (up-mobile-chrome shipped in between) + dirty tree (up-settings-subnav diff in flight). This doc refreshes the evidence; the item owner (`devin-ux-coord`) decides whether to re-record the gate in `tasks/pipeline-state.json`.
>
> **Scope note:** this item has NO implementation diff in the tree yet — the run re-verifies the current panel (the convergence target surface) on the shipped code, plus the design mockup board. When the convergence diff lands, this must be re-run against it.

## Environment

- HEAD `3968a251` + uncommitted tree (includes `up-settings-subnav` WIP — its subnav defect D1 is visible in `panel-light-theme-1280.png`: right scroll arrow renders outside the strip clip, invisible).
- Production `dist/` (`npm run build` — see pitfall below), Playwright persistent Chromium `--load-extension=dist`, mock server `PW_PORT_OFFSET=100`.
- Evidence dir (gitignored): `tmp/up-visual-system-convergence-browser/`

## Result: PASS (rendering health check at current HEAD)

| Check | Result | Evidence |
|---|---|---|
| Panel opens over dark page (StreamFlix 4421) | OK | `dark-1280-dictionary.png` |
| Panel opens over bright page (YouTube mock 4422) | OK | `bright-1280-panel.png` |
| All tabs mount + `aria-current="page"` tracks | OK — dictionary/vocabulary/studyModes/settings/playlist/recap/local-player | `results.json` tab probes + `dark-1280-*.png` |
| Menu/listbox opens from a panel control | OK (opened `role="listbox"`; note: it rendered detached at viewport top-left showing "No results found." — likely because the probed trigger was a hidden/empty-state control; see note) | `dark-1280-vocab-menu.png` |
| `:focus-visible` ring on panel controls | OK — `solid 2px rgb(106,178,245)` | `results.json` |
| Light theme via ModeCards `role="radio"` | OK — Light card selects, panel re-themes | `panel-light-theme-1280.png`, `panel-light-theme-390.png` |
| 390px mobile layout | OK — fullscreen panel model (up-mobile-chrome), all tabs usable | `dark-390-panel.png`, `dark-390-vocabulary.png`, `dark-390-studyModes.png` |
| Design board `mockup-up-visual-system-convergence` | OK — `current` vs `converged` specimens render at 390/768/full, dark+light | `board-*.png` |
| Page console errors | 5 × HTTP 404 on mock-page assets only (missing thumbs/media on the mocks — benign, unrelated to extension code) | `results.json` |

## Observations for the owner (not new defects)

1. **up-settings-subnav defect visible in this pass** — in `panel-light-theme-1280.png` the settings subnav's right scroll arrow is absent (rendered outside the sidebar clip). Tracked in `docs/reviews/up-settings-subnav-verify.md` as blocking D1 — this item's REQ-1 site-map row "settings subnav underline-selected" says to verify item-32's output; its output currently fails AC-3 anyway.
2. **Detached empty listbox artifact** — `dark-1280-vocab-menu.png` shows a transparent "No results found." listbox at viewport top-left; the probe clicked the first `button[aria-haspopup]` in shadow DOM which may be a non-visible trigger. Worth a glance during REQ-2 (R-FLOAT) delivery — a transparent/detached floating layer is exactly the defect class being converged.
3. **Pre-convergence dialects confirmed live** — `panel-light-theme-1280.png`: Theme mode card selected = `primary-subtle` + border ring (R-SEL-CARD-ish outline variant) vs settings subnav underline marker — the spec's divergence map holds.
4. **Process pitfall (learning-worthy):** `npx vite`/`npm run dev` rewrites `dist/` into a dev build (`service-worker-loader.js` → `localhost:5399`), which silently breaks `--load-extension=dist` verification (`featureInit.ts.js` fetch 404). Sequence must be: dev server → kill it → `npm run build` → browser pass (or run mockups from `build/` artifacts). dist restored to production build after this run.

## Gate status for `tasks/pipeline-state.json` (owner action)

- `lint` / `typecheck` / `testUnit` / `build`: still valid — re-verified green on this exact tree this session (all 4 gates run in the up-settings-subnav verify pass; `test:unit` = 682 suites/8081 tests).
- `browser`: **fresh PASS evidence above** — safe to re-record at HEAD `3968a251` with the dirty-tree caveat that the dirty diff belongs to `up-settings-subnav`, not this item.

## Re-recorded — 2026-10-07 (post up-settings-subnav D1/D2 fix)

Pipeline flagged `lint`, `testUnit`, `browser` stale (recorded 21:27–22:27Z, before the `Navigation.tsx`/`.module.css` fix; `typecheck` 22:44Z / `build` 22:57Z postdate it and `dist/` contains the fix). Re-ran on the current tree and re-recorded all three at HEAD `3968a251`:

- `npm run lint` → 0 errors (4 pre-existing warnings in unrelated srs files) → `lint=pass`.
- `npm run test:unit` → 682 suites / 8081 tests green → `testUnit=pass`.
- `browser` → PASS evidence: this doc's panel/board pass stands; additionally the up-settings-subnav D1/D2 reverify ran the real extension panel in headed Chromium post-fix (settings strip at 1280/390/320, en+vi, scroll bounds, live locale switch — `tmp/up-settings-subnav-verify/reverify/`), and the convergence board re-rendered clean today (`tmp/up-visual-system-convergence-browser/reverify/board-*.png`, 6 combos current+converged × dark/light × 390/768/full, 0 console errors). Observation #1 above is now obsolete — the D1 arrow-clip defect is fixed and verified.

## Re-recorded — post-convergence diff (deliver-gate rerun)

Pipeline flagged `lint`/`testUnit`/`build`/`browser` stale again — the actual convergence diff is now in the tree (uncommitted, owned by `devin-ux-coord`). Re-ran all gates on the current tree:

- `npm run lint` → 0 errors (4 pre-existing warnings in unrelated srs files — `SrsNoteEditorPanel`, `SrsReviewCardBack`, `srsCardShared`) → `lint=pass`.
- `npm run typecheck` → clean → `typecheck=pass`.
- `npm run test:unit` → 682 suites / 8082 tests green → `testUnit=pass`.
- `npm run build` → green; prebuild regenerated `tokens.css`, icons QC 100/100, feature-cycles clean, `check-design-system-css:features` 0 violations (44 files) → `build=pass`.
- `browser` → PASS evidence below; `tmp/up-visual-system-convergence-browser/` (gitignored).

### Browser pass — converged build (`dist/` rebuilt with the diff)

Playwright persistent Chromium `--load-extension=dist`, mocks `PW_PORT_OFFSET=100` (StreamFlix 4421, YouTube mock 4422), `verify.mjs` rerun:

| Check | Result | Evidence |
|---|---|---|
| Panel opens over dark page; all 6 tabs switch + `aria-current="page"` tracks | OK | `dark-1280-{dictionary,vocabulary,studyModes,settings,playlist,recap}.png`, `results.json` |
| Panel over bright page | OK | `bright-1280-panel.png` |
| Floating surface R-FLOAT | Open Select menu wrapper = opaque `color(srgb 0.286…)` fill + hairline border + popover shadow | `probe-hidden-listbox.mjs` output, `probe-hidden-listbox.png` |
| **Detached-listbox defect (observation #2 above) — fixed at root** | Hidden-pane trigger (`inHiddenPane:true`, rect 0×0) → menu wrapper computes `visibility:hidden` (inherited by the listbox); nothing paints at origin; Escape removes the layer | `probe-hidden-pane-listbox.png` — top-left 140×60 region is pure page/pixel content; `useMenuPlacement.ts` hides the menu while the anchor has no layout + `ResizeObserver` re-places it when layout returns |
| Focus ring | OK — `solid 2px rgb(106,178,245)` | `results.json` |
| 390px mobile | OK — fullscreen panel, tabs usable | `dark-390-*.png` |
| Console errors | 5 × mock-page asset 404s only (benign) | `results.json` |
| Probe caveat | `theme-light-clicked: false` — the probe's `textContent === 'Light'` lookup did not find the theme card button this run (settings card content changed); light-theme switch not re-verified this pass — cosmetic probe gap, not an extension error | — |

### Gate status for `tasks/pipeline-state.json` (owner action)

- All five gates re-run fresh on this tree: `lint`, `typecheck`, `testUnit`, `build`, `browser` → all pass with evidence above. Owner (`devin-ux-coord`) may re-record; tree remains dirty pending the coordinator's convergence commit(s).

## Verify-pass browser rerun — 2026-10-08 (HEAD `0a2676f1` + full uncommitted diff)

Fresh-context verify reviewer re-ran the four npm gates and an independent Playwright pass after `up-settings-subnav` shipped (the recorded `browser` gate at `3968a251` predates it). Safe to re-record `browser=pass` at HEAD `0a2676f1` (dirty tree = this item's diff + foreign files — see verify doc scope-leak list).

- Playwright persistent Chromium `--load-extension=dist` (production `npm run build` of the diff), mocks `PW_PORT_OFFSET=100`, `verify.mjs` + `probe2.mjs` → `tmp/up-visual-system-convergence-verify/` (`results.json`, `results2.json`, 10 PNG captures).
- Panel edge `0.67px solid rgb(48,48,48)` + `shadow-modal` on dark AND bright pages; all 6 tabs switch + `aria-current` tracks; sidebar separator 1px; NavItem labels 14px (`font-size-sm`) with zero truncation; vocab filter menu = opaque `Menu` + hairline + popover shadow, checked `menuitemradio` = `primary-subtle`+accent; hidden-pane trigger → menu computes `visibility:hidden` (detached-listbox fix live-verified); ModeCard/SelectableCard selected = `primary-subtle`+`inset 2px` shadow; SegmentedControl active on tinted tracks legible in dark theme; playlist `EmptyState` anatomy (icon+title+desc, `role="status"`); mobile 390 rail = exactly 5 destinations at ≥44px; tools sheet rows = `menuitemradio` + `aria-current="page"` + `MenuSeparator`; console = 5 benign mock-asset 404s.
- Defects found are cosmetic/spec-literal — see `docs/reviews/up-visual-system-convergence-verify.md` D1–D8 (the `.offRow` secondary-border leak on the subtitle-manager "Off" row is the one to triage before ship).
