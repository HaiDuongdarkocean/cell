# TODO — Universal Panel Atomic Design & Visual Regression Fixes

> **Source:** `tasks/plan-universal-panel-atomic-design-audit.md`  
> **Status key:** `pending` / `in_progress` / `blocked` / `done`

## Phase 1: Foundation

- [x] **T1** — Fix undefined/legacy tokens across all audited files ✅ 2026-09-05
  - [x] `DictionaryPanelView.module.css` — `--font-size-xm` → `--font-size-xs`; `--color-fixed-white` → `--color-text-on-primary` (was undefined → broken)
  - [x] `PronunciationPanel.module.css` — `--border-radius-sm` → `--radius-sm`; `--color-on-primary` → `--color-text-on-primary`
  - [x] `SettingsDialog.module.css` — `--radius-m3-small` → `--radius-sm`; `--border-radius-md` → `--radius-md`
  - [x] `FieldRow.module.css` — `--input-focus-border` → `--color-border-focus`
  - [x] `QueueSidebar.module.css` — `--color-background-hover` → `--color-surface-hover`
  - [x] `ApiKeyManager.module.css` — `--color-primary-subtle-hover` → `--button-primary-subtle-hover-bg` + full tokenize (cubic-bezier/px outlines/rgba fallbacks → `--duration-*`/`--ease-standard`/`--space-*`/`--iconbutton-size-sm`/`--color-error-subtle`)
  - [x] `TtsLanguagePanel.module.css` — full `cell-*` rewrite to `--space-*`/`--font-size-*`/`--color-*` tokens
  - [x] `tokens.json` — added `static.strokeWidth.sm`/`md` (used by `MediaList`), regenerated `tokens.css`
  - [x] `components.css` — `--color-fixed-white` → `--color-text-on-primary`
  - [x] Verified: zero undefined `var(--*)` references in all audited paths
  - [x] `check-design-system-css` + `typecheck` + `lint` pass
  - [x] Bonus: `1px` borders → `--border-width-hairline` in `StudyModesTab.module.css` + `UniversalPanelBottomNav.module.css`
  - ⚠️ Breakpoints (`360/520/639/599/839px`) CANNOT be tokenized — plain CSS `@media` doesn't accept `var()`. **Decided:** JS side now uses `src/shared/styles/breakpoints.ts` (`MEDIA_QUERIES.mobileMax`) — `SettingsDialogContent` matchMedia migrated; CSS side stays literal, comment in breakpoints.ts documents the sync contract.

- [~] **T2** — Shared atom hardcode & SSOT cleanup *(near-complete)*
  - [x] `Button` — glass filter SVG now renders only when `material="liquid"` (was injected into every solid button); `dangerouslySetInnerHTML` is a deliberate .ts-escrowed filter (shadow-root `url(#id)` requires same-root presence) — kept, scoped to liquid
  - [x] `Sidebar` — `blur(12px)`→`--blur-lg`, `saturate(1.6)`→`160%` (codebase convention), dropped wrong `, 10` z-index fallback → `var(--z-sticky)` ✅
  - [x] `Icon` — all audited-path imports switched to `@/shared/ui/Icon` semantic wrapper (22 files); numeric sizes → `xs`/`sm`/`md`/`lg`; `MediaList.ThumbIcon` signature → semantic ✅
  - [x] `IconButton` — **all 43 repo files migrated** to `<Button shape="circle">` (variantMap: solid→primary, danger→destructive); `IconButton` kept as deprecated compat wrapper; new shared `SelectableCard` atom added
  - [x] `Input` — `useId` for `aria-describedby` ✅ (fixed real duplicate-ID a11y bug: `'input-error'`/`'input-helper'` were hardcoded literals)
  - [x] `Toggle` — `4px`→`--space-1`, `2px`→`--space-0-5`, `0.3s`→`--duration-300`, `0.4`→`--opacity-disabled` ✅ (kept `0.5px` drop-shadow — sub-pixel, no token)
  - [x] `Dialog` — `×` → shared `CloseButton` (SSOT) ✅
  - [x] `NavItem` — hover/active contrast fixed (M3 state layer: `surface-hover` / `primary-subtle` / `--button-primary-subtle-hover-bg`); `border-radius: 50%` + `z-index: 1` remain (intentional for pill morph + stacking)
  - [x] `SearchableSelect` — `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-activedescendant` on search input; `role="listbox"` moved to `<ul>` + stable `id` via `useId`; options get `${id}-option-${i}` ids ✅
  - [x] `SelectableCard`/`MultiSelect`/`SearchableSelect` registered in `COMPONENT_INVENTORY.json` (regen ✅); `Tabs`/`Stack`/`HStack`/`VStack` — check generator output
  - [x] `COMPONENT_INVENTORY.json` regenerated ✅

## Phase 2: Feature migrations (parallel)

- [~] **T3** — Dictionary + Card Creator *(partial)*
  - [x] `searchHistory` — all buttons already shared `Button`; `li` pill + 2-action structure can't fit `Chip` (nested button invalid); `icon-btn`/`btn` globals removed; `componentsCss` injection deleted (dead code) ✅
  - [~] `DefinitionItem` → `Checkbox` — **skipped**: custom dot→checkbox morph is a deliberate bespoke design; native `<input type=checkbox>` + `aria-label` is already a11y-correct.
  - [~] `FieldAutoGrowInput` → **skipped**: native `<textarea>` is correct semantics; `field-sizing`+rows fallback works; shared `Textarea` base styles would fight `.fieldInput__control` — promoting would need a new variant for one consumer.
  - [x] `MediaList` — `Icon` sizes → semantic ✅, `Button shape="circle"` ✅; `Badge` — N/A (no badge markup exists in MediaList)
  - [x] Dead CSS sweep — `select`/`input`/`textarea`/`checkbox` local rules removed from `DictionaryPopupSettingsPanel`/`CardCreatorSettingsPanel`/`TtsVoiceManagerPanel` modules (shared atoms own styling now; `.urlInput` dropped) ✅
  - [x] `CandidateView`/`AudioPanel` — `icon-btn`/`icon-btn--*` natives → `Button shape="circle"` ✅; remaining natives are bespoke (subtabs role=tab, aria-pressed labels, status pill, def-checkbox) — documented
  - [x] `DictionaryPanelView`/`CandidateView` — term `<h2>` → `Heading level={2} size={2}` ✅; `SettingsDialogContent` 13× `h4`→`Heading level={4}` + `p.cardDesc`→`Text as="p" color="secondary"`; `TtsVoiceManagerPanel`/`CardCreatorDialogContent`/`ResourcesPanel` `h2`/`h3`→`Heading` ✅
  - [x] Tokenize `6em`→`calc(--space-3 * 7)` (exact 84px), `192px`→`calc(--space-6 * 8)`, `18px`→`--space-4-5`, `2px`→`--border-width-thick`, `9999px`→`--radius-full` (OrbitalBadge ×6), `320/420px`→space calc (PopupDictionary), `280/600px`→space calc ✅; `590px` breakpoint — media queries can't take `var()`
  - [x] `npm run test:unit` — 3123 tests pass ✅
  - [x] Test hygiene — `webTextDictionaryController.test.ts`: `act()` warnings 231 → 10 (all `handleLookup`/`dismissLookup`/`destroy`/`dispatchEvent`/`advanceTimers`/`updateSettings`/`Promise.resolve` flushes wrapped; residual 10 are promise-`.then` deferred mounts during `waitFor` polling — cosmetic); `phraseMatchBenchmark` flaky `<1ms` single-shot → best-of-5 ✅
  - [x] `DictionaryPanelView.module.css` (972 → 239 lines) split → `AudioPanel`/`ImagePanel`/`TranslatePanel`/`LinksPanel`/`DictionaryToolbar`/`CandidateView` own modules + `DictionaryCheckable.module.css` owns the unified checkbox contract (`cellDefCheck*` + host classes + cross-panel compounds); parent keeps chrome/popupMode/search/chips/shared-error ✅

- [~] **T4** — Study Modes *(partial)*
  - [x] `StudyModesTab` double padding — `universal-panel-content-studyModes` added to the `.content` flush rule (was dictionary+settings only; studyModes stacked space-4 + space-6) ✅
  - [x] `CustomModeBuilder` — `Text color="secondary"` + `.builderError` fought over `color`; dropped the prop so `--color-error` wins + added `role="alert"` ✅
  - [x] `Heading level={3}` — section headings were `level={2}` (same as tab title) → `level={3}` ✅
  - [x] `StepEditor` — `aria-label="Remove step N"` added to icon-only delete `Button` ✅
  - [x] `ModeCard`/`NewModeCard` → new shared `SelectableCard` (absorbs role/tabIndex/Enter-Space/aria-checked boilerplate) ✅
  - [x] CSS split: `CueStrip.module.css` + `StepEditor.module.css` + `CustomModeBuilder.module.css` extracted from monolithic `StudyModesTab.module.css` ✅
  - [~] `CueStrip`/`StepEditor` natives — `cueBlock`/`cueAdd` remain native `<button>` (roving-tabindex + Shift-arrow reorder is a bespoke listbox-like control; shared `Chip` doesn't fit the stacked cue layout) — documented
  - [ ] `Heading level={3}` for sub-sections
  - [~] Tokenize `1px` border ✅ (→ `--border-width-hairline`); `0.04em` letter-spacing + `360/520/639px` breakpoints open (media queries can't take `var()` — needs preprocessor decision)
  - [x] `UniversalPanelPage.showcase.tsx` — renders real `StudyModesTab` ✅
  - [x] Numeric icon sizes → semantic (`xs`/`sm`/`lg`); `Icon` imports via `@/shared/ui` ✅
  - [x] `npm run test:unit` (studyModes) — passing ✅

- [~] **T5** — Settings *(partial)*
  - [x] `SettingsDialogContent` — `showSidebarHeader` prop added; `SettingsTab` passes `false` ✅
  - [x] `ThemePanel` — redundant `applyTheme` effect removed entirely (providers own apply; fixes global `document.documentElement` overwrite) ✅
  - [x] `DictionaryPopupSettingsPanel` — checkbox→`Toggle`, 4×`<select>`→`Select`, 2×`<input type=number>`→`Input` ✅
  - [x] `CardCreatorSettingsPanel` — url input→`Input`, 6 auto-complete checkboxes→`Toggle`, fallback select→`Select` ✅
  - [x] `TtsVoiceManagerPanel` — enable checkbox→`Toggle`, 3 selects→`Select`, tester textarea→`Textarea`, order input→`Input`, voice checkbox→`Checkbox`; slot radios kept (correct native radio-group semantics) ✅
  - [x] `ApiKeyManager.module.css` — fully tokenized (0 hardcodes remaining) ✅
  - [x] `TtsLanguagePanel.module.css` — rewritten to current tokens ✅
  - [x] `MultiSelect` → promoted to `src/shared/ui/MultiSelect.tsx` + `.module.css`; barrel export added; settings re-export updated; new `--multi-select-max-height` token registered ✅
  - [x] `Dropzone` — `Enter`/`Space` keyboard activation added (`onKeyDown` → `inputRef.click()`) ✅
  - [x] `ImportProgress` — bespoke bar → shared `Progress` (`indeterminate` when total=0); dead `.bar`/`.fill` CSS removed; `ResourcesPanel` `.section` card surface stripped (card-in-card) ✅
  - [x] `ThemePanel`/`ColorCustomization`/`ModeCards`/`ThemeImportExport` emoji → `Icon` (`sun`/`moon`/`settings`/`download`/`copy`/`folderOpen`) ✅; `ContrastBadges` redundant `title` removed (info already visible — test updated to assert visible text); `ThemePreview` native input → `Input` ✅
  - [x] `npm run test:unit` (settings/theme) — passing ✅

## Phase 3: Cross-cutting P0s (parallel)

- [x] **T8** — Theme scoping ✅ 2026-09-05
  - [x] `ThemePanel` no longer calls `applyTheme` — providers (`ThemeProvider`/`ShadowThemeProvider`) own application on every real mount; global overwrite eliminated
  - [x] `mountUniversalPanel` already wraps in `ShadowThemeProvider` on the inner shadow container (verified)
  - [x] Showcase `SettingsTab` no longer flips page theme — e2e test `data-theme` stays `light` ✅
  - [x] Light/dark screenshots verified (`fixed-settings-light-v2.png`, `fixed-settings-dark-boundary.png`)
  - [x] `npm run test:unit` (theme) — ThemeProvider + ThemePanel tests pass
  - [x] `ThemePanel.showcase.tsx` wrapped in `ThemeProvider` (standalone context)

- [x] **T9** — WebTrigger shield ✅ 2026-09-05
  - [x] `UniversalPanel` backdrop root carries `.js-cell-universal-panel` (`.js-` hook per htmlcss-032 — not `data-*`)
  - [x] SSOT `src/shared/lib/dom/cellUiHosts.ts` — `CELL_UI_HOST_SELECTORS` + `CELL_UI_POINTER_EVENT_HOST_SELECTORS` now shared by `webTriggerController.ts`, `tokenizeBlock.ts`, `subtitleShortcuts.ts` (3 copies had already drifted: `tokenizeBlock` was missing `#cell-subtitle-root`)
  - [x] Per-component `data-no-lookup` unnecessary — `closest()`/`composedPath()` via the root hook covers the whole subtree; `[data-allow-lookup]` regions still work
  - [x] e2e covers nav clicks (vacuous in showcase without content script — real verification is the host-shield contract test)
  - [x] `npm run test:unit` (webTrigger/tokenize/subtitleShortcuts) — all pass

## Phase 4: Showcase & inventory

- [x] **T6** — Showcase updates ✅ 2026-09-05
  - [x] `UniversalPanelPage.showcase.tsx` — real `StudyModesTab`, `.js-cell-universal-panel` via component root, `data-theme`/`data-preset` boundary (mirrors `ShadowThemeProvider` shadow container)
  - [x] `mode`/`preset`/`tab`/`open` query params all respected (`mode`/`preset` were dead before)
  - [x] `npm run build:design-system` ✅ + e2e 7/7 ✅ + manual screenshots light+dark ✅
  - [x] `SettingsDialog.module.css` — `.sidebarWidth` definite width ≥840px (fixes container-query + `max-content` collapse loop introduced by NavItem parent-container refactor)

- [ ] **T10** — Component inventory update
  - [ ] Add `Stack`, `Tabs`, `MultiSelect`, `CueStrip`, `StepEditor`, `ModeCard`, `HistoryChip`, `AutoGrowTextarea`, `ColorInput`, `FileDrop`, `SelectableCard`, `PlaceholderCard`, `DictionarySkeleton` to `COMPONENT_INVENTORY.json` with correct level/status
  - [ ] `generate-component-inventory.mjs` regenerates without errors

## Phase 5: Final verification

- [ ] **T7** — Quality gates + visual regression
  - [ ] `npm run typecheck` pass
  - [ ] `npm run lint` pass
  - [ ] `npm run test:unit` pass
  - [ ] `npm run build` pass
  - [ ] `check-design-system-css` pass
  - [ ] M3 audit script pass on all audited paths
  - [ ] Screenshots re-captured (light + dark, all 3 tabs) — no popup on nav clicks, no duplicate header, no global theme overwrite
  - [ ] `COMPONENT_INVENTORY.json` committed

---

## Phase 6: Extended audit (post-panel areas) — 2026-09-05

Full findings: `docs/audits/post-universal-panel-areas-audit-2026-09-05.md`
(4 parallel audits: popup / sidepanel+launcher / subtitle / srs-study+sheets)

- [~] **T11** — P0 sweep (9 items): 8 done, 1 deferred
  - [x] `--stroke-width-xl` → `--stroke-width-md` (`SelectionBar.module.css`)
  - [x] `VideoCard` custom listbox → shared `Select` (options render quality+size via ReactNode label)
  - [x] `CueList` → `role="list"`/`listitem`; timestamp span → `<button>` + `aria-label` + focus-visible
  - [~] Launcher tiles/Settings/Add buttons — **deferred**: WIP design-concept page, handlers need product intent (can't wire fake actions)
  - [x] `LauncherSearchBar` input → `aria-label={placeholder}`
  - [x] `SubtitleHint` → `tabIndex={0}` + Enter/Space handler
  - [x] `--shadow-text-soft`/`--shadow-text-cinema` → token names exist as `--shadow-textSoft`/`--shadow-textCinema` (camelCase) — fixed reference, no registration needed
- [x] **T12** — P1 atom migrations + undefined-token sweep:
  - [x] All undefined `var(--*)` fixed → registered names (`--duration-normal`, `--duration-150`, `--iconbutton-icon-md`, `--color-border-emphasized`, `--blur-sm`, `--ease-spring`, `--color-error`, `--shadow-textSoft/Cinema`, `--stroke-width-md`) — incl. files outside audit scope (local-player, VolumeControl)
  - [x] Atom migrations: `Badge` ×3, `Heading` ×2, `Progress` (DownloadCard 4-phase), `Select` (VideoCard quality, SubtitleStylePanel font), `Input` (StylePanel text/number ×4), `Textarea` (UserCssPanel), `EmptyState` (sidepanel), Icon barrel ×8 files
  - [x] `Sheet` a11y: `aria-label` prop + `useFocusTrap` + keyboard close handle; consumers pass labels
  - [x] `trackList` → `role="listbox"`; SrsReviewCard progress dots → `role=list/listitem` + `aria-current`
  - [x] Destructive actions → `variant="destructive"` (SrsManagePanel ×3, SrsReviewCardBack ×2)
  - [~] Deferred w/ rationale: bare inputs inside styled chrome wrappers (`searchBar`, `valueField`) — shared `Input` would double-chrome, aria-label already present; `type="color"` inputs stay native (no `ColorInput` atom); `mainRow`/`copyBtn` keep role=button (inside Card) + gained `:focus-visible`
- [ ] **T13** — P2 tokenization + dead CSS: opacity tokens, `ease`→`--ease-*`, `inset 0 0 0 1px`→`--border-width-hairline`, drop `var(--t, literal)` fallbacks for registered tokens, dead selectors (srs App ×10, SubtitlePanel ×5, SubtitleManagerPanel ×3, SubtitleSearchPanel ×1), destructive `ghost`→`destructive`, `@/shared/icons/Icon`→`@/shared/ui/Icon` barrel, Button CSS overrides (`.toolRow`, `.audioButton`…)
- [ ] **T14** — P3 document intentional: subtitle content px sizing, preview scale, error-boundary crash styles, `SHEET_MARGIN_PX`
- [ ] **T15** — Inventory: confirm generator picks up `SelectableCard`/`MultiSelect`/`BottomSheet` (shared/ui-only scan — feature components like `CueStrip`/`StepEditor`/`Dropzone` are out of generator scope by design)
