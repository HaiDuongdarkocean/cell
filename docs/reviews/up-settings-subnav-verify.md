# VERIFY Review — up-settings-subnav (Labeled settings sub-navigation)

> Reviewer: fresh-context verify agent (did NOT implement). Spec: `docs/specs/up-settings-subnav.md`. Design: `docs/intent/up-settings-subnav-design-brief.md`.
> Method: full diff audit + gates + real-Chromium check (Playwright persistent Chromium, `--load-extension=dist`, StreamFlix mock `PW_PORT_OFFSET=100`) + mockup surface (`mockup-up-settings-subnav?concept=real`, real `SettingsDialogContent` `navMode="auto"`). Evidence: `tmp/up-settings-subnav-verify/*.png` + raw metrics below.

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; 4 pre-existing warnings in unrelated srs files) |
| `npm run test:unit` | PASS (682 suites / 8081 tests) |
| `npm run build` | PASS (prebuild `check-design-system-css` 0 violations) |

## Per-AC verdict

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 labels on all 13 items at 320/390/600–767/≥768, both surfaces | PASS (rendering) | Panel@1280/390/320 + mockup stage 320/390/700/960: 13 `[data-section-id]` items, label spans measure real widths (en 29–103px, vi 37–93px); `mockup-real-*.png` show icon+label. Caveat: see D1 — right-edge items can be clipped once the left arrow mounts. |
| AC-2 dialog 600–767 → labeled strip, ≥768 → expanded sidebar | PASS | Mockup `concept=real` (`navMode="auto"`): stageW 700 → `data-orientation="horizontal"`, no `data-collapsed`; stageW 960 → `vertical` expanded. `SettingsDialogContent.tsx:138` uses `SIDEBAR_LABEL_MIN_WIDTH` (768) — collapsed rail unreachable in product, CSS preserved per spec. |
| AC-3 overflow affordance: arrows+fades on overflowing edges only, page ±0.75, hide at bounds | **FAIL** → resolved (see Re-verify D1/D2) | D1 below. Right arrow renders *outside* the `.navWrap`/sidebar clip box in every horizontal render — invisible at 320/390/700 mockup and panel@390 (rect beyond viewport). scrollBy +bounds logic itself works (scrollLeft 0→436 on click, arrows hide at bounds). |
| AC-4 scroll-sync + click-nav identical | PASS | Click `data-section-id="sync"` → content scrolled (Sync section top), `aria-current` moved; content scroll-to-bottom → spy set `activeId` correctly; auto-center clamps at scroll bound as before. `Navigation.tsx` spy/guard internals untouched. |
| AC-5 active state legible | PASS | Active item = primary color + centered underline pill (`panel-1280-settings.png`, `mockup-real-390-en.png`). |
| AC-6 i18n en+vi, no wrap/truncate | PASS | `settings.nav.scrollLeft/Right` added to both `en.json`/`vi.json`; vi labels render ("Chung", "Hồ sơ ngôn ngữ", "Tài nguyên"); `.label` ellipsis/`min-width:0` correctly scoped to `.vertical` (`NavItem.module.css:143-147`); horizontal items `flex-shrink:0; width:auto` — no truncation possible. |
| AC-7 a11y preserved | PASS (with D1 caveat) | `<nav aria-label="Settings sections">` landmark intact; `aria-current="true"` on active; `:focus-visible` ring verified (2px solid rgb(106,178,245)); arrows are real `Button`s, `type="button"`, localized aria-labels; no `tablist`/`tab` roles on the subnav (the tablist found in the shadow root is the pre-existing Dictionary-popup surface strip — unrelated). Caveat: an invisible (clipped) arrow is still Tab-focusable — keyboard users get a focus stop on an off-screen control at small widths. |

## Defects

### D1 — BLOCKING: scroll arrows render outside the wrap's clip box; right arrow invisible; nav right edge clips mid-glyph

**Root cause:** `Navigation.module.css` — `.nav` has `flex-shrink: 0` (line 3) and `.horizontal` has `width: 100%` (line 32). Inside the new `.navWrap` flex row the `<nav>` therefore keeps 100% of the wrap width and never shrinks; the arrow `Button`s (40px + `gap: var(--space-1)` each) are pushed past the wrap's right edge.

**Measured (mockup `concept=real`, `?w=`):**
- w=390 en/vi: nav/sidebar right = 834, rightArrow rect = 838..878 → entirely outside the `.stage`/`.sidebar` (`overflow:hidden`) clip → invisible.
- w=320: arrow at 803..843 vs sidebar right 799 → invisible.
- w=700: arrow at 993..1033 vs sidebar right 989 → invisible.
- Panel@1280: strip right edge 1231, arrow at 1235..1275 → hangs outside the panel boundary over the scrim.
- Panel@390: arrow 383..423 vs viewport 390 → fully off-screen.
- Panel@1280 after paging once: left arrow lands correctly at wrap start (219..259) but the nav itself now spans 263..1275 → its right ~44px is clipped by `Sidebar.module.css:10` `overflow:hidden` → `panel-1280-active-sync.png`/`panel-320-settings.png` show the rightmost item (Sync) clipped mid-glyph *with no cue* (fadeEnd correctly removed at bound) — the exact failure REQ-3 exists to prevent.

**Consequence:** AC-3 fails at every tested width — the rightward overflow affordance is never visibly rendered inside the strip; items clip mid-glyph once the left arrow mounts; at ≤390px the unreachable arrow is also a phantom Tab stop (AC-7 caveat).

**Fix direction (implementer's call):** let the nav shrink inside `.navWrap` — e.g. `.navWrap > .nav { flex: 1 1 auto; min-width: 0; }` (or set `flex-shrink: 1`/`width: auto` on `.horizontal` when wrapped) so arrows sit inside the strip bounds. Re-verify both-edge state (both arrows mounted = 88px+ of sibling width) at 320px.

### D2 — minor: arrow visibility not reactive to label-width changes

`Navigation.tsx:129-153` — the overflow effect depends on `[orientation, itemCount]` and observes the nav's own box via `ResizeObserver`. Locale switches (`setUiLanguageOverride`) change label widths/scrollWidth without changing `itemCount` or the nav's border box → arrow state stays stale until the next scroll/resize (e.g. en→vi turning a fitting strip into an overflowing one shows no right arrow until user scrolls). Same ceiling exists in the `StudyModeActionBar` precedent, so it's a shared limitation, not a regression — worth a `MutationObserver`-free follow-up or observing an inner sentinel.

## Non-defect observations

- `overscroll-behavior-x: contain` on `.horizontal` — small, in-scope addition listed in the design brief (scrollTrack precedent).
- `Navigation` horizontal consumers confirmed = `SettingsDialogContent` only (panel rail is a different `nav`; bottom nav uses `Button`; showcases don't ship). `.vertical` and both `@container` collapsed rules in `NavItem.module.css` are byte-identical; `.label` ellipsis correctly re-scoped to `.vertical` — `CollapsibleSidebar` (vertical-only consumer) unaffected.
- `t('settings.nav.scrollLeft/Right')` inside the shared atom is spec-mandated (`en.json:414-415`, `vi.json:414-415`); `data-cell-id` hooks present; `aria-current`, nav `aria-label`, `title` tooltip contract preserved.
- Strip height: sidebar horizontal rect = 49px ≤ `max-height` budget (56px fine / 60px coarse) — spec's open-risk item resolved fine.
- Arrow hit area: measured 40×40 under fine pointer; `.arrow` enforces `min --touch-target` block/inline → 44px under coarse pointer. OK.
- Item-30 contracts intact (buttons keep `aria-label`, `title`, `type="button"`); item-31/33 boundaries respected (no bottom-nav, no recipe changes).

## Scope-leak notes (uncommitted tree is shared — NOT this item's diff)

`package.json` version bump 0.1.3→0.1.4 + `release:github` script, `LICENSE`, `public/LICENSE.txt`, `scripts/release-github.ps1`, `scripts/pack-firefox.ps1`, `tihoka-*.zip/.tar.gz`, `docs/mockups/player-mode-*.png` edits, `docs/audits/*`, all `up-visual-system-convergence` docs + `src/entrypoints/mockup-up-visual-system-convergence/`, `tasks/plan-figma-atomic-design-system.md` — foreign work in the same tree; exclude from this item's commit. `src/entrypoints/mockup-up-settings-subnav/` belongs to this item's design stage (delete at ship per AGENTS.md). Also note that mockup's "real" concept note text is now stale (describes pre-change behavior).

## Re-verify D1/D2 (after fixes)

> Re-verifier: fresh verify pass, adversarial, focused only on D1 + D2 + regressions.
> Method: `git diff` audit + real Chromium (Playwright persistent, headed, `--load-extension=dist`, StreamFlix mock on `PW_PORT_OFFSET=100` → :4421) + mockup surface served by `vite --config vite.pages.config.ts` on :5455 (prior :5399 dev server had died mid-run). Scripts: `tmp/up-settings-subnav-verify/reverify.mjs`, `reverify-mockup.mjs`. Captures: `tmp/up-settings-subnav-verify/reverify/*.png`.
> Note on measurement noise: `lastLabel`/`labelW` readings of 18px in raw metrics select the item's inner icon span (`span:last-child` also matches it), not the text label — does not affect any verdict.

### Diff audit

`src/shared/ui/Navigation.module.css` — `.navWrap > .nav { flex: 1 1 auto; min-width: 0; }` present exactly as prescribed (also `.navWrap`, `.arrow`, `.fadeStart/End`, `overscroll-behavior-x` from the original diff). `src/shared/ui/Navigation.tsx` — overflow effect now observes `MutationObserver(nav, { characterData: true, subtree: true })` alongside `ResizeObserver` + `scroll`. Built `dist/` confirmed to contain both (unbundled build: `dist/src/shared/ui/Navigation.tsx.js` has the observer; `Navigation.module.css__inline.js` has the flex rule).

### D1 — RESOLVED

Arrows now render **inside** the strip bounds at every width; nav shrinks inside `.navWrap`.

| Context | Evidence |
|---|---|
| Panel @1280 en | nav 218.8–1187.2 inside wrap 218.8–1231.2; right arrow 1191.2–1231.2 inside wrap+viewport, `elementFromPoint` → `BUTTON#settings-nav-scroll-right` (painted, topmost). |
| Panel @1280 right bound | right arrow unmounted; left arrow 218.8–258.8 inside wrap; **last item 1146.3–1223.3 fully inside nav right edge 1231.2 — no mid-glyph clip** (was: nav extended to 1275, clipped by sidebar `overflow:hidden`). |
| Panel @390 vi | both arrows mounted mid-scroll: left 0.7–40.7, right 339.3–379.3, wrap right 379.3 — both inside wrap & 390 viewport, both painted. |
| Panel @390 right bound | last item 271.8–371.5 fully inside nav right 379.3; last label fully inside. |
| Panel @320 vi | right arrow 269.3–309.3 inside wrap 0.7–309.3 & 320 viewport; mid-scroll both arrows inside bounds. |
| Mockup 320/390/700 (`concept=real`, bare) | nav inside wrap inside sidebar at all three; right arrow inside wrap+sidebar, painted; at right bound last item fully inside nav; left arrow inside wrap. |
| Phantom Tab stop | Left/right arrows are conditionally rendered — absent from DOM at bounds (verified panel @1280/@320 initial `leftArrowInDom:false` at `scrollLeft===0`; mockup 320/390/700 after scroll-to-left). When mounted, real reachable control: `.focus()` landed on-screen at 390 (`root.activeElement === arrow`, rect 1–41 inside viewport). |

### D2 — RESOLVED

- **End-to-end in real panel:** at right bound in en (scrollLeft 480 = max 481, right arrow hidden), drove the actual `settings-ui-language` Select → "Tiếng Việt". Labels re-rendered in place (no remount; arrow aria-labels became "Cuộn các mục sang trái/phải"). scrollWidth 1449→1500, scrollLeft unchanged (no scroll event), nav border box unchanged until the arrow mounted (no preceding ResizeObserver fire) → **right arrow re-mounted purely via the MutationObserver path**. Post-switch state consistent with fresh metrics (left+right arrows, both inside bounds).
- **Mechanism proof (mockup, deterministic):** scrolled to right bound (arrow hidden), lengthened a label via `textNode.data` — the same `characterData` mutation React performs on locale switch — scrollWidth max 1067→1316 with `scrollLeft` untouched → **right arrow re-appeared without any scroll/resize event**. Restoring the label kept arrow state consistent with metrics (still visible: new max 1111 > scrollLeft 1067 — correct, arrow mount had shrunk clientWidth), and scrolling to the new bound hid it again.

### Regression checks — PASS

- `.vertical` Navigation unwrapped: mockup w=960 → `data-orientation="vertical"`, nav parent is plain `DIV` (no `.navWrap`), zero arrows in DOM, all 13 labels visible. (w=700 bare → horizontal strip, consistent with the 600–767 band.)
- Touch floors: arrows `min-inline/min-block: var(--touch-target)` → 40×40px under fine pointer (measured), **44×44px** under `(pointer: coarse)` (measured with `hasTouch` context: `pointerCoarse:true`, `minInline/minBlock:"44px"`).
- Unit suite: `src/shared/ui/Navigation.test.tsx` PASS (full `--selectProjects unit` run green, no failures).
- Bound semantics unchanged: arrows hide at both bounds, re-mount mid-scroll, click paging works (right arrow click paged strip at 390/320).

VERDICT: PASS
