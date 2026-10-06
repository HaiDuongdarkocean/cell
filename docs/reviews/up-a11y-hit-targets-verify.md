# Verify review: up-a11y-hit-targets — Universal Panel accessibility floor

> Spec: `docs/specs/up-a11y-hit-targets.md` · Design: `docs/intent/up-a11y-hit-targets-design-brief.md` (PASS review `docs/reviews/up-a11y-hit-targets-design.md`)
> Reviewer: independent VERIFY pass (did not implement). Reviewed the uncommitted working-tree diff; foreign dirty files excluded per review brief (`package.json` version/`release:github`, `docs/mockups/player-mode-*.png`, `LICENSE`, `scripts/*.ps1`, `tihoka-*`, `docs/audits/*atomic*`, `src/entrypoints/mockup-up-*/`, `en/vi` `settings.nav.scroll*` keys → item 32).

## Verdict summary

Implementation is faithful and mostly verified end-to-end: a real coarse-pointer run (`Emulation.setTouchEmulationEnabled`, `matchMedia('(pointer: coarse)') === true` hard-asserted) drives `touchTargetViolations` to **0 at 44px** across all six tabs, fine pass **0 at 40px**, 0 overlaps. Two defects: one enumerated REQ-1 site missed (tools BottomSheet close, 32px — fails even the fine floor) and a transient second `role="status"` in the playlist loading state. Verdict: **APPROVE_WITH_CHANGES** — both fixes are one-liners; nothing systemic.

## Per-AC verdict

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 coarse ≥44, violations empty | **PASS** | Live run: `a11y-coarse-390x844` → `pointerCoarse: true`, `touchTargetMin: 44`, violations `[]`, overlaps `[]` for all 6 tabs; `a11y-coarse-1440x900` clean (`loop/universal-panel-ux/state/computed-styles.json`). Emulation = CDP `Emulation.setTouchEmulationEnabled` (spec-blessed alternative), `matchMedia` hard-asserted true — cannot silently fall back to fine. |
| AC-2 fine ≥40, violations empty | **PASS** | `a11y-fine-1440x900` → `pointerCoarse: false`, floor 40, violations/overlaps `[]` × 6 tabs. Width-keyed threshold replaced by in-page `matchMedia` — the 390px fine run now correctly uses 40 (was the REQ-8 precondition bug). |
| AC-3 every enumerated site ≥ floor | **FAIL — 1 site missed** | Verified in code + measured run: Toggle xs/sm (label min-* + transparent-border inset-paint — correct math: `max(0px,(tt−size)/2)`), dict-link name/grip/edit/delete, HintIcon, mode kebab, vocab `.actionSlot` fill, profile flag (box→floor, flag paint stays 34px), `.statusBadge` (border-block inset-paint, interactive-only, static untouched), MobileSheet `.handle` + measured peek (JS constants deleted, rendered height measured), dict-toolbar tabs, audio-tester play, all inputs/selects `max(size, tt)` — all present and effective (0 measured violations). **Exception: tools `BottomSheet` close — `BottomSheet.tsx` close = `Button circle sm` = 32×32 (`.circle` resets min-* to 0), renders inside `.panel` but outside `.body`, so `.panel .body button` never reaches it; `BottomSheet.module.css` has no binding. Spec REQ-1 site row + design D7 both enumerate it. Audit never opens the sheet, so it escaped the measurement pass.** |
| AC-4 no intersecting hit rects | **PASS** | Pairwise `effectiveRect` (clip-ancestor-aware) check ≥0.5px both axes; ancestor/full-containment whitelisted (kebab-over-card pattern) — 0 overlaps, `whitelistedContainments` 0 (no containment pairs present in measured panes). |
| AC-5 open-focus visible + contained + restore | **PASS** | `useFocusTrap.ts:36-43` initial pick now filters `offsetParent !== null` (same predicate as the Tab-cycle path); panel-container fallback; `getRootNode()` reads preserved. New tab-switch rescue (`UniversalPanel.tsx:127-139`) refocuses the visible nav item when `activeElement` escapes/is hidden. Focus-trail assertions pass desktop + mobile; `initialFocus.insidePanel/visible` true. Caveat: `initialFocus` is sampled after `clickTab` — see N2. |
| AC-6 mobile DOM = visual order | **PASS** | DOM `sidebar → body → bottomNav`; `column-reverse` → `column` (atomic pair, `UniversalPanel.module.css:89`); ≤599px fullscreen inherits column; bottom nav still `display:none` ≥840px. `domOrder` assertions: `sidebarBeforeBody=before`, `bodyBeforeBottomNav=before`, `lastFocusableInBottomNav=true` at 390px (desktop correctly `false` — nav hidden). |
| AC-7 nav landmarks + `aria-current="page"` + named panes | **PASS** | Sidebar `as="nav"` (CollapsibleSidebar supports `'nav'`, keeps `aria-label`); bottom `<nav aria-label>` kept; both emit `aria-current="page"`. Six `.tabPane`s all `role="region"` + localized `aria-label`, exactly one non-hidden at a time — confirmed in artifact. `NavItem.module.css` `="true"` branches untouched (other consumers: settings subnav still emits `'true'` — visible in artifact); `.active` class preserved so sidebar keeps its tint; mobile selector widened to `[aria-current]` presence. |
| AC-8 customs in `radiogroup` | **PASS** | `StudyModesTab.tsx:164` `role="group"` → `role="radiogroup"` with existing label; empty-list guard retained (fixture had no custom modes → group absent in artifact — verified in code; preset group + radios confirm the assertion path). |
| AC-9 Advanced switch disclosure contract | **PASS** | `aria-controls="advanced-settings-region"` + `aria-describedby="advanced-settings-toggle-hint"` (localized `VisuallyHidden`); region carries `id` + `role="region"` + `aria-label` and stays mounted under `hidden={!open}` (spec's permitted strict option; `.stack[hidden]` guard added so `display:flex` can't beat `hidden`). `aria-checked` intact, `aria-expanded` absent — asserted in run. Toggle props additive/default-preserving. |
| AC-10 playlist single status + dedupe | **PASS w/ defect D2** | One `playlist-status-announcer` `role="status" aria-atomic="true"`, mounted before writes, dedupe via `lastAnnouncedRef`; per-card `aria-live` removed; `ariaLiveInActivePane === 0` asserted; `summarizeStatusTransitions` is pure + unit-tested (6 cases incl. first-refresh silence, plural, failed mix, non-terminal churn). **D2: loading branch keeps `<div class="empty" role="status">` — while `records === null` the tab contains two `role="status"` regions vs AC-10's "exactly one" (transient, but a real contract deviation — consolidate or drop the spinner's role).** |
| AC-11 evidence committed | **PASS** | Artifact `loop/universal-panel-ux/state/computed-styles.json` + `image/a11y/*.png` (coarse+fine, desktop+mobile) — real measured run, emulation mechanism named in-spec and in code comment. `loop/` is gitignored audit output (established path); screenshots are real Chrome pixels. |

## Defects

- **D1 (moderate) — tools BottomSheet close misses the floor.** `src/shared/ui/BottomSheet.tsx` close is `Button shape="circle" size="sm"` → 32×32 (`.circle,.iconOnly { min-*: 0 }` reset + `iconbutton-size-sm` 32px). It mounts inside `[data-cell-id="universal-panel"]` but as a sibling of `.body`, so `.panel .body button { min-*: var(--touch-target) }` doesn't reach it; `BottomSheet.module.css` `.closeIcon`/`.closeButtonAbsolute` carry no binding. Fails the 40px fine floor *and* 44px coarse on the mobile-only surface it appears on. Fix: `min-width/min-height: var(--touch-target)` on `.closeIcon`/`.closeButtonAbsolute` (doubled class to beat the circle reset), or swap to `CloseButton`.
- **D2 (minor) — transient second `role="status"` in playlist.** `PlaylistTab.tsx` loading branch keeps `role="status"` on `.empty` alongside the new announcer → two status regions while `records === null`. Fix: drop the role on the loading div (announcer covers it) or route the loading message through the announcer.

## Coverage gaps / notes (non-blocking)

- **N1:** Audit never opens the tools BottomSheet, profile Dialog, or MobileSheet — controls inside opened overlays are in REQ-1 scope but unmeasured (this is how D1 escaped). Suggest an overlay-open measurement pass or a manual rect check as recorded evidence.
- **N2:** `initialFocus` is collected after `clickTab`, so it asserts containment of the clicked nav item rather than open-time landing; the visible-pick path is verified by code review + focus-trail, but a post-`open()` immediate check would close the loop.
- **N3:** `useFocusTrap` fallback `panel.tabIndex >= 0` skips `tabindex="-1"` containers — matches the spec's "else leave focus" branch; UniversalPanel's Surface carries no tabindex, so the fallback is inert there. Acceptable.
- **N4:** Collector samples ≤200 interactives / first 2000px per pane — pragmatic; deep vocab lists beyond the cap are unmeasured (second-wave clause covers follow-ups).
- **N5:** New explanatory comments added in `useFocusTrap.ts`/`UniversalPanel.tsx`/CSS — repo convention prefers self-explanatory code; cosmetic only.
- **N6:** `MobileSheet` peek math now measures the rendered handle+header per drag — SSOT kept, layout read per pointermove is a minor perf cost, correctness fine.
- **N7:** `Emulation.setTouchEmulationEnabled` (rather than `setEmulatedMedia`) is what flips `(pointer: coarse)` — verified working (`pointerCoarse: true` in artifact), spec allows either mechanism.

## Scope-leak check

- `en.json`/`vi.json` `settings.nav.scrollLeft/scrollRight` — item 32 keys in the shared files' hunks; **not attributed to this item**.
- Settings subnav keeps `aria-current="true"` (visible in artifact) — item 31/32 surface untouched, as spec required.
- No `tokens.json` value changes (ask-first boundary respected); no `manifest.json`, no subtitle split-view files, no new dependencies.
- `CollapsibleSidebar.tsx` `'true'→'page'` is a shared-atom edit, but UniversalPanel is its only consumer — no blast radius; `NavItem` `="true"` branches intact for other emitters.
- Design-time `src/entrypoints/mockup-up-a11y-hit-targets/` still present — delete at ship per repo hygiene (mockups are design-time).
- `package.json` version bump + `release:github` script, `docs/mockups/player-mode-*.png`, `LICENSE`, `scripts/*.ps1`, `tihoka-*`, sibling intent/spec/review docs — foreign dirty files, ignored.

## Gate results (re-run by reviewer)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (0 errors) |
| `npm run lint` | PASS — 0 errors, 4 pre-existing warnings (srs files, unrelated) |
| `npm run test:unit` | PASS — 681 suites / 8064 tests (incl. `UniversalPanel.test.tsx` nav assertion + new `playlistStatusSummary.test.ts`) |
| `npm run build` | PASS — Vite build + token/icon/cycle/CSS checks clean |
| `npx playwright test --config=playwright.stream.config.ts e2e/stage2/universal-panel-ux-audit.spec.ts --project=stage2` (PW_PORT_OFFSET=100 — 4322 held) | **4/4 PASS in 1.6m** — incl. `a11y: pointer-adaptive hit target floor, focus and semantics` |

## Post-review fixes (applied by coordinator, re-verified)

- **D1 resolved** — `src/shared/ui/BottomSheet.tsx` now renders the shared `CloseButton` atom (its `.closeBtn.closeBtn` binding beats Button's `.circle` min-* reset → `var(--touch-target)` floor: 40px fine / 44px coarse). Dead `Button`/`Icon`/`t` imports removed. `typecheck` + full `test:unit` re-run: 681 suites / 8064 pass.
- **D2 resolved** — `PlaylistTab.tsx` loading branch `.empty` no longer carries `role="status"`; the hidden `playlist-status-announcer` is the single status region in every state.

VERDICT: PASS
