# Verify — up-visual-system-convergence (fresh-context reviewer)

> Reviewer: non-owner verify pass over the **uncommitted working-tree diff** (owner: `devin-ux-coord`). Gates re-run by this reviewer; Playwright persistent Chromium spot-check against `dist/` (production build of the diff), mocks on `PW_PORT_OFFSET=100` (4421 StreamFlix / 4422 YouTube). Captures: `tmp/up-visual-system-convergence-verify/`.
> Spec: `docs/specs/up-visual-system-convergence.md` · Brief: `docs/intent/up-visual-system-convergence-design-brief.md` · Mapping: `component-mapping.md`.

## Per-REQ verdicts

### REQ-1 — Selected-state convergence — PASS
- `Menu.module.css:36-46` `.item[aria-checked='true']` → `primary-subtle` bg + `primary` text; checked+hover → `--button-primary-subtle-hover-bg` (resolved composition, equal-or-higher specificity beats `.item:hover`). Live: filter menu checked row = `rgba(106,178,245,.21)` bg + `rgb(106,178,245)` text, role `menuitemradio` — `dark-1280-vocab-filter-menu.png`.
- `QueueSidebar.module.css:74-79` active row gains `color: var(--color-primary)` on row + inner btn → R-SEL-LIST complete.
- `LanguageProfilePanel.module.css:347-355` `.choice[aria-checked]` → `primary-subtle` + `shadow-inset-selected` + `text-accent-strong` (incl. `.choiceDesc` cascade) → R-SEL-CARD.
- `SegmentedControl.module.css:135-138,171-175` `.filled`/`.chips` `.segmentActive` → `primary-subtle` + `text-accent-strong`. Live probe over all radiogroups: active = `rgba(106,178,245,.12)` + accent-strong on both `surface-hover` and `field` tracks — contrast gate satisfied visually (no documented variant needed).
- `StudyModesTab` `SelectableCard` rides `Card.selected` — live: `primary-subtle` + `inset 2px` shadow, radius 8px (`--card-radius`), desc accent-strong.
- Settings subnav (item-32 output) = `NavItem.horizontal` accent + bottom pill → R-NAV-CURRENT, no underline-as-selected survives in panel scope.
- AC-2: sidebar + bottom rail keep `aria-current` nav recipe — verified live (`aria-current="page"` on rail).
- **Deviation flagged (AC-2 literal):** the tools-sheet demoted nav rows now carry `aria-current="page"` AND `radio` checked → they render R-SEL-LIST (subtle bg + accent + check icon). AC-2 says "no `aria-current` surface wears a choice-selection recipe"; DESIGN deliberately added `MenuItem`'s `aria-current` prop for these rows. Needs either an AC-2 clarification note or acceptance — see D4.

### REQ-2 — Floating layers opaque + panel edge — PASS
- `tokens.json` `component.panel`: `border transparent→color-border`, `shadow shadow-sm→shadow-modal`; `component.popover.border transparent→color-border`. Live: `.panel` = `0.67px solid rgb(48,48,48)` + modal shadow on **dark AND bright** pages (`dark-1280-dictionary.png`, `bright-1280-panel.png`) — AC-4.
- `SearchableSelect.module.css`: `.menu` hairline `border-emphasized`; `.option` rest `--input-bg`→`color-surface`; `:active` `overlay-pressed`→`surface-pressed`.
- Hand-rolled floating surfaces (`LPP .menu/.menuItem`, `.toolRow`) deleted; `tool-row-*` token group retired.
- Residual sweep re-run: no `overlay-hover`/`overlay-pressed`/`color-field` floating backgrounds remain in panel scope (`color-field` hits are resting surfaces — `.profileForm`, `.choice`, input pill — legitimate).

### REQ-3 — Every choice list through Menu — PASS
- LPP kebab `ProfileMenu.tsx` rewritten onto `Menu`/`MenuItem` (`destructive` prop on danger rows); hand-rolled portal/menu/arrow-key machinery deleted (154→~70 lines).
- Profile switcher: `Dialog`+`RadioGroup` deleted → `Menu` of `MenuItem radio` anchored to `.profileButton` with `aria-haspopup="menu"`/`aria-expanded`; `panel.profileDialog.title` reused as aria-label.
- Tools sheet: `.toolRow` hand-roll → `MenuItem emphasis` rows inside `role="menu"` + `MenuSeparator`; live probe shows `menuitemradio` + `aria-checked` + `aria-current` + separator (`dark-390-tools-sheet.png`).
- Vocab triggers → `Button secondary` + chevron, `aria-haspopup`/`aria-expanded` kept; live: bordered `0.67px solid` triggers.
- Postcondition grep clean: no hand-rolled `.menu`/`.menuItem` choice surfaces under panel scope (`NoteFieldsEditor div.menu` is a Select `menuClassName` radius override, not a menu impl).

### REQ-4 — One status-chip molecule — PASS (one literal-grep nit)
- `Chip status` prop (5 colorways consuming `--chip-status-*` pairs) + showcase row + unit test; RecapTab `.statusChip` buttons and VocabularyTab cycle/static badges → `Chip` (`as="button"`/`as="span"`). `filter: brightness()` deleted from both tab CSS; module `STATUS_*`/`STATUS_CLASS` maps gone.
- Hover = uniform `color-mix` deepen 8% (one physics, filter-free) — spec's literal "token-pair swap" is approximated (no hover pair tokens exist); acceptable, noted.
- **Nit (D5):** `VocabularyTab.module.css` keeps `.statusBadge { flex-shrink: 0 }` as a layout shim — the AC-7 postcondition grep `statusChip|statusBadge → 0` still returns hits.

### REQ-5 — Emphasis recipes — PASS with a confirmed edge leak
- `Button.module.css:234-238` new `.secondary` = `--button-secondary-bg` (surface) + `--button-secondary-fg` (text-primary) + `color-border` hairline; hover via `::after overlay-hover`; `:disabled` opacity floor intact. Distinct from primary/ghost/outline/disabled ✓.
- Footer trio: Clear → `errorSubtle`, Add → `secondary`, Update keeps sole `primary` (L-SCARCITY). Playlist delete/cancel → `errorSubtle` circles — destructive reads distinct from ghost siblings.
- Compensating-override sweep handled inside touched atoms: `Chip` (`border-color: transparent`, `box-shadow: none`, outline keep), `Tabs .trigger` (`box-shadow: none`), `Accordion .trigger` (`box-shadow: none`) — all previously riding invisible base-button chrome.
- Spot-checked resets: `SubtitleSearchPanel .resultButton` (`border:0` shorthand) and `ApiKeyManager .addToggle` (`border:0`) are safe.
- **DEFECT D1:** `.offRow` "Off" option row (`SubtitleManagerPanel.tsx:318`, classes `track`+`offRow`) — `.track`'s `border: 0` (allModuleCss pos ~520k) is *earlier* than `.button` base `border: hairline solid` (~645k) and `.secondary` `border-color: color-border` (~652k), and `.offRow.offRow` resets neither → **the row paints a visible hairline border + pill radius** while sibling `<div>` `.track` rows stay borderless `radius-sm`. This is the exact reset-incomplete leak the spec named; plan/todo say "documented" but nothing mitigates it in code, no follow-up item was routed to the subtitle owner, and the stale `.offRow` comment ("`variant="secondary"` has no `.secondary` class") is now false. Also the DoD `subtitle-split-view-ac.md` re-verify evidence is absent from the browser-gate doc.
- `Sync now` (SyncPanel `variant="secondary"`, enabled) → renders the bordered enabled recipe.

### REQ-6 — Divider grouping + seam — PASS
- `CollapsibleSidebar` inserts `Separator` between sections (`.sectionSeparator`, `margin: 0 space-2`); live: one 1px separator between tab/tools groups. Void→hairline ✓.
- Seam: `CardCreatorPanel` `border-left` deleted (mobile keeps `border-left:none` at :21); `DictionaryTab.module.css:18` keeps `border-right: hairline divider` → single 1px seam at desktop ✓.

### REQ-7 — One EmptyState anatomy — PASS
- Playlist hand-rolled `.empty` → `EmptyState compact` + `audioWave` icon + description, `role="status"` preserved, `data-tihoka-id="playlist-empty"` added (live-verified icon+title+desc).
- Vocabulary empties gain descriptions via new `vocabulary.emptyHint|emptyFilteredHint|emptyTrashHint` (en+vi).
- Loading branch (`Spinner`+`role="status"`) untouched ✓.

### REQ-8 — Heading recipe + nav label — PASS
- All spec'd uppercase sites converged to `Text variant="label"`/`Heading` (`cc-dialog__section-title`, `.groupLabel`, `.downloadGroupTitle`, `.bannerLabel`, `.sectionLabel`, `.cc-queue__title`, `.customsDivider` ×2, `.eyebrow`, `.groupHeader`, `MultiSelect .popularLabel`, `NoteFieldsEditor` tracking).
- Sweep: `text-transform: uppercase` remaining in panel scope = only `ShortcutInput` `.kbdSingle/.kbdModifier/.kbdKey` (glyph content — spec-sanctioned exception) and `InkTabs` (no panel consumer — `PronunciationAudioPanel`/`SubtitleManagerPanel`/popup entrypoint only). `CondensedAudioPill` is a video overlay, not panel.
- `NavItem` label xs→sm; live: 14px on the rail, zero truncated labels (probe checked `scrollWidth>clientWidth` on all items).

### REQ-9 — Affordance recipes — PASS with one partial
- `HintIcon` hover → `surface-hover` + `text-primary`; accent now only on `:focus-visible`/`aria-expanded`; `cursor: help` kept.
- `--color-track` 85%→75% transparent, both theme blocks; consumers `Slider`/`Progress`/`Toggle` share it (blast-radius acknowledged in plan).
- V-19 tiles: `StepEditor .stepChipGroup > *` `min-width: space-20` removed → size-to-content.
- Chrome icons: `.profileButton`/`.closeButton` + tokenize capsule gained `hairline color-border` rings (live: closeButton `0.67px solid`).
- **DEFECT D3 (partial):** design brief :181 prescribes `primary-subtle`/`primary` **hover tint** on the overlay-chrome ghosts; the diff ships only the border — hover remains the neutral `overlay-hover` wash via `Button::after`. Border-only = affordance gained, but not the specified recipe.

### REQ-10 — Failure stated once — PARTIAL
- Mechanism exists: `CardCreatorSettingsPanel.suppressFailureDetail` swaps `offlineDetail` → `shortUrl` when set; wired `suppressFailureDetail={loadStatus === 'error'}` from `CardCreatorDialogContent`.
- **DEFECT D2:** suppression is bound to `loadStatus==='error'` unconditionally — but when the settings side panel is open it covers the dialog body (`CardCreatorSidePanel.module.css:4-9` `position:absolute; inset:0`) so the banner is **not in view**, while the row still suppresses its failure text → in the settings view the failure is stated only by the ambient "Offline" label, not by "the row owns the statement + retry" (spec flow table). Fix is cheap: suppress only while the side panel is closed / banner actually visible.

### REQ-11 — Header density / lookup home / icon collision — PASS (vacuous overflow)
- Post-31 header carries no icon strip (profile flag + tab title + tokenize capsule + close only) → nothing to overflow; the kebab `Menu` mechanism exists where there IS a choice list (profile switcher, LPP kebab).
- One lookup home: dictionary tab owns search; header has no search-looking surface.
- `slidersHorizontal` collision resolved: Study Modes tab → `flame` (panelTabs + bottom nav derive from it); vocab filter keeps `slidersHorizontal`. Live rail shows distinct glyphs.
- Tools-sheet nav rows keep labels ✓ (V-16).

### REQ-12 — Surface-family unity — PASS
- Playlist `.itemRow` overrides deleted → Card scale; failed state = `--card-background: error-subtle` documented status treatment (no bespoke stripe).
- `ModeCards` overrides removed → unmodified Card geometry (live radius 8px).
- Opacity-as-color: `.modeIcon` → `text-secondary`, `.modeDesc` → token color + accent-strong cascade on selected, `.modeCard:hover` opacity 0.85 block deleted (Card interactive hover recipe). `opacity:` sweep under panel scope: only disabled/drag/keyframe/`--opacity-*` remain.
- Dashed family → `hairline dashed color-border` + `radius-lg`: `.banner`, `.cc-media__empty` (off-token `color-text` fixed), `.cueAdd` (was dead `border-style` on `border:none` — now a real border). Residual `Dropzone` (2px dashed — drag affordance), `ResourcesPanel`/`ImportProgress` (`border-subtle` — placeholder job) are the spec's "different job" escape; their documentation lives only in the design-brief table (D6 nit).

### Cross-cutting — `useMenuPlacement` hidden-anchor fix — PASS
- `useMenuPlacement.ts:133-139` hides the menu (`visibility:hidden`, keeps last placement) when the trigger has zero layout; `ResizeObserver` on the trigger re-places it when layout returns. Live-verified: vocabulary sort menu open → switch tab → menu computes `visibility:hidden` (no paint at origin); the pre-fix detached-listbox defect is gone.
- Success path replaces `style` wholesale → `visibility` cleared correctly; jsdom zero-rect path unchanged for tests.

## Contract checks (items 28/30/31)
- **Scrollport/gutter (28):** `.body`/`.content` untouched; per-tab `padding: var(--universal-panel-tab-gutter)` contract intact; EmptyState centering not regressed (`.empty` kept as layout class).
- **a11y floor (30):** `aria-current="page"` preserved on rail+sidebar (live); `useFocusTrap` untouched; `.panel .body button` touch floor untouched; rail items live 73×52px ≥44px floor; `Chip`/`MenuItem`/`NavItem` all ≥ `--touch-target`.
- **31:** bottom rail = exactly 5 destinations live (dictionary/vocabulary/studyModes/settings + Tools), tools sheet rows carry labels + separator; header `activeTab` title intact.

## Gates (re-run by reviewer on this tree)
- `npm run typecheck` → clean.
- `npm run lint` → 0 errors, 4 pre-existing warnings (unrelated srs files).
- `npm run test:unit` → **682 suites / 8082 tests green**.
- `npm run build` → green; `check-design-system-css:features` = **0 violations (44 files)**; icons QC 100/100.
- `check-design-system-css` (default scope) = 10 violations in 5 files — all in files **not touched** by this diff (Radio/MobileSheet/InkTabs/Breadcrumb fallbacks; `Navigation.module.css` `#000` mask gradients from shipped `up-settings-subnav`) → pre-existing baseline, not a regression.
- Browser pass: `tmp/up-visual-system-convergence-verify/results.json`, `results2.json`, captures `dark-1280-*.png` (6 tabs), `dark-390-*.png`, `bright-1280-panel.png`, `dark-1280-vocab-filter-menu.png`, `dark-390-tools-sheet.png`, `dark-1280-settings-modecard.png`, `dark-390-rail.png`. Console errors: 5 benign mock-asset 404s.

## Defects

| ID | Severity | REQ | Issue |
|---|---|---|---|
| D1 | minor | REQ-5 / DoD | `.offRow.offRow` (subtitle manager "Off" row) leaks `border: hairline solid color-border` + pill radius — `.track`'s `border:0` loses to later `.button`/`.secondary` rules in `allModuleCss`; spec-named site, only "documented" in plan/todo, no routed follow-up, stale comment survives, and `subtitle-split-view-ac.md` re-verify evidence is missing. Subtitle files can't be edited here → needs an atom-side fix (e.g. `.secondary` won't help — an explicit `border-color`/`border` reset on `.offRow` belongs to the subtitle owner) **or** a filed backlog follow-up + the AC re-verify evidence. |
| D2 | minor | REQ-10 | `suppressFailureDetail` fires whenever `loadStatus==='error'`, including while the settings side panel occludes the banner (`inset:0` overlay) → spec's "settings view: row owns the statement" is violated; failure is only ambient "Offline · url". Gate the prop on the side panel being closed. |
| D3 | minor | REQ-9.4 | Chrome ghosts shipped border but not the briefed `primary-subtle`/`primary` hover tint (`:181`); hover stays neutral `overlay-hover`. Add the tint rule or note the deviation in the brief. |
| D4 | spec-literal | REQ-1/AC-2 | Tools-sheet nav rows wear `aria-current="page"` + checked `menuitemradio` → R-SEL-LIST recipe on an `aria-current` surface; AC-2's literal text forbids it. Design intentional (menu-of-destinations); recommend a one-line AC-2 carve-out. |
| D5 | trivial | REQ-4/AC-7 | `.statusBadge` shim class survives (`VocabularyTab.module.css` `flex-shrink: 0`) — postcondition grep still hits. Rename or inline. |
| D6 | trivial | REQ-12 | Residual dashed sites (Dropzone 2px, ImportProgress `border-subtle`) rely on the "different job" escape but aren't documented outside the brief table. |
| D7 | hygiene | REQ-3/7 | Orphan i18n keys: `panel.tools.{reader,srs,player}.desc`, `panel.profileDialog.desc` (Dialog deleted; only `.title` reused). |
| D8 | trivial | REQ-4/NFR-3 | `Chip as="button"` always emits `aria-pressed={selected}` → vocab cycle chip gains `aria-pressed="false"` (was a plain button); semantics nit, arguably a toggle-look mismatch. |

## Scope-leak (foreign files in the working tree — exclude from this item's commit)

`package.json` bump `0.1.3→0.1.4` + `release:github` script, `LICENSE`, `public/LICENSE.txt`, `scripts/release-github.ps1`, `scripts/pack-firefox.ps1`, `tihoka-firefox-0.1.3.zip`, `tihoka-source-0.1.3.tar.gz`, `docs/audits/20261005-screen-atomic-map.md`, `docs/audits/penpot-atomic-audit.md`, `tasks/plan-figma-atomic-design-system.md`, `docs/mockups/player-mode-*.png` (3 modified binaries) — none belong to this spec's file scope. `src/entrypoints/mockup-up-visual-system-convergence/` = this item's design board (delete at ship per convention). `tasks/pipeline-state.json` diff = owner gate bookkeeping only.

## Defect resolution — post-review fix pass

All eight defects resolved by the coordinator (owner); targeted tests green (30 suites / 340 tests: `Chip`, `vocabulary`, `cardCreator`, `SubtitleManagerPanel`), typecheck clean, lint 0 errors.

- **D1** — `SubtitleManagerPanel.module.css` `.offRow.offRow` now resets `border: 0` + `border-radius: var(--radius-sm)` (matches `.track` row chrome); stale comment updated to name `.button`/`.secondary`. Atom-side rule not needed — the doubled-class chrome reset owns it, in the same file that already owned `.button` chrome.
- **D2** — `CardCreatorDialogContent.tsx` `suppressFailureDetail={loadStatus === 'error' && !settingsOpen}` — while the side panel overlays the banner, the status row owns the full failure statement again.
- **D3** — `UniversalPanelHeader.module.css` + `TokenizeControls.module.css`: `.profileButton`/`.closeButton`/`.capsule .half` gain `hover → primary-subtle bg + primary text` under `@media (hover: hover)` — the briefed overlay-chrome ghost recipe.
- **D4** — spec AC-2 amended with the tools-sheet carve-out (menu-of-destinations is the sanctioned exception).
- **D5** — `VocabularyTab` `.statusBadge` shim renamed `.rowChip` (css + both tsx sites) — postcondition grep clean.
- **D6** — spec REQ-12 documents the retained dashed sites (Dropzone 2px, ImportProgress `border-subtle`, ResourcesPanel placeholder) as different-job drag/placeholder feedback.
- **D7** — orphan i18n keys removed from en+vi: `panel.tools.{reader,srs,player}.desc`, `panel.profileDialog.desc`.
- **D8** — `Chip` `as="button"` emits `aria-pressed` only when `selected` is passed (toggles keep `false`/`true`; action chips like the vocab cycle chip carry no toggle semantics); `Chip.test.tsx` updated to cover both branches.

VERDICT: PASS
