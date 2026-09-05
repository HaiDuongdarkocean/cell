# Implementation Plan: Universal Panel — Atomic Design & Visual Regression Fixes

## Overview

Sửa toàn bộ phát hiện từ Atomic Design audit (`docs/audits/universal-panel-atomic-design-audit-2026-09-05.md`) và visual verification (`docs/audits/universal-panel-visual-findings-2026-09-05.md`). Mục tiêu: khôi phục tính đúng đắn (P0), sau đó chuẩn hoá shared component + feature-local component, cuối cùng polish.

## Architecture Decisions

- **Shared UI là SSOT.** Mọi component reuse/extend `src/shared/ui/*` trước khi tạo local mới.
- **Token là nguồn sự thật.** Mọi giá trị cứng (hex/px/vh/em/opacity/breakpoint) phải map sang `tokens.json` → `tokens.css`.
- **Shadow DOM & host scoping.** `UniversalPanel`, `SettingsDialog`, `PopupDictionary`, `OrbitalBadge` phải được shield bởi host selector hoặc `data-no-lookup` để `WebTriggerController` không tra cứu bên trong extension UI.
- **Theme scoping.** `ThemePanel` / `ThemeProvider` / `applyTheme` phải nhận `container` là shadow root hoặc preview element, không bao giờ mặc định ghi vào `document.documentElement` khi nằm trong panel.
- **Accessibility.** Tất cả interactive element phải có `aria-label`, `aria-describedby`, keyboard support (Enter/Space), focus-visible token.
- **Atomic Design layer rõ ràng.** Phân biệt Page / Template / Organism / Molecule / Atom / Token.

## Dependency Graph (bottom-up)

```text
Token fixes (Task 1)
    │
    ├── Shared atom fixes (Task 2)
    │       │
    │       ├── Feature-local migrations (Task 3–5)
    │       │       │
    │       │       ├── Showcase + visual regression (Task 6)
    │       │       │
    │       │       └── Pre-commit gates + tests (Task 7)
    │       │
    │       └── Icon/IconButton/Button/Dialog base fixes (parallel with 3–5)
    │
    ├── Theme scoping fix (Task 8)  ← depends on Task 1 tokens
    │
    ├── WebTrigger shield fix (Task 9)  ← depends on Task 1 tokens
    │
    └── Showcase placeholder → real StudyModesTab (Task 10)
```

## Parallelization

| Group | Tasks | Can run in parallel? |
|---|---|---|
| A — Token & shared atom base | 1, 2 | Yes |
| B — Feature-local migrations | 3 (Dictionary), 4 (Study Modes), 5 (Settings) | Yes (independent files) |
| C — Cross-cutting bugs | 8 (Theme scoping), 9 (WebTrigger shield) | Yes, but both touch `webTriggerController` / `ThemePanel`; coordinate if same file |
| D — Showcase & visual | 6, 10 | Yes, after A+B |
| E — Verification | 7 | No — always last |

## Task List

### Phase 1: Foundation — Token & shared atoms (parallel)

- [ ] **Task 1: Fix undefined/legacy tokens across all audited files**
  - **Description:** Replace every undefined/legacy token found in the audit with correct `tokens.json` keys or add missing tokens.
  - **Acceptance criteria:**
    - [ ] `grep` no longer finds `--font-size-xm`, `--border-radius-sm`, `--radius-m3-small`, `--border-radius-md`, `--input-focus-border`, `--color-background-hover`, `--color-primary-subtle-hover`, `cell-*` in audited paths.
    - [ ] `node scripts/check-design-system-css.mjs` passes on touched files.
    - [ ] `npm run typecheck` + `npm run lint` pass.
  - **Verification:** `npm run typecheck`, `npm run lint`, `bash .agents/skills/m3-design-standard/audit/audit.sh` (audited paths).
  - **Dependencies:** None
  - **Files likely touched:**
    - `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css` (`--font-size-xm`)
    - `src/features/pronunciation/ui/PronunciationPanel.module.css` (`--border-radius-sm`)
    - `src/features/settings/ui/SettingsDialog.module.css` (`--radius-m3-small`, `--border-radius-md`)
    - `src/features/cardCreator/ui/FieldRow.module.css` (`--input-focus-border`)
    - `src/features/cardCreator/ui/QueueSidebar.module.css` (`--color-background-hover`)
    - `src/features/settings/ui/ApiKeyManager.module.css` (`--color-primary-subtle-hover`)
    - `src/features/tts/ui/TtsLanguagePanel.module.css` (full `cell-*` rewrite)
    - `src/shared/styles/tokens.json` (if new tokens are needed)
  - **Estimated scope:** Medium

- [ ] **Task 2: Shared atom hardcode & SSOT cleanup**
  - **Description:** Tokenize hardcoded values inside `src/shared/ui` and remove deprecated/unsafe patterns.
  - **Acceptance criteria:**
    - [ ] `Button.module.css`/`Button.tsx` no longer contain `dangerouslySetInnerHTML` for SVG filter; use a static SVG asset or `filter` token.
    - [ ] `Button.module.css` focus outline/icon sizes use `--border-width-*`, `--space-*`, `--icon-*` tokens.
    - [ ] `Toggle.module.css`, `Input.module.css`, `Dialog.module.css`, `NavItem.module.css`, `Sidebar.module.css`, `BottomSheet.module.css` have no hardcoded `px`, `cubic-bezier`, `vh`, `0.01ms`, `50%`, `z-index` fallbacks.
    - [ ] `Dialog` close button uses `<Icon name="x" />` instead of `×`.
    - [ ] `IconButton` usages replaced with `Button shape="circle"`.
    - [ ] `Input` uses `useId` for `aria-describedby` ids.
    - [ ] `SearchableSelect` implements `aria-activedescendant`/`aria-controls`/option `id`s like `Select`.
    - [ ] `Tabs`, `Stack`/`HStack`/`VStack` added to `COMPONENT_INVENTORY.json`.
  - **Verification:** `npm run test:unit`, `npm run typecheck`, `npm run lint`.
  - **Dependencies:** Task 1 (some tokens may be new).
  - **Files likely touched:** `src/shared/ui/{Button,Icon,IconButton,Toggle,Input,Dialog,NavItem,Sidebar,SearchableSelect,Tabs,Stack,BottomSheet}.*`, `docs/design-system/COMPONENT_INVENTORY.json`
  - **Estimated scope:** Large (split into Task 2a Button/Icon/IconButton, Task 2b Input/Toggle/Dialog, Task 2c NavItem/Sidebar/Stack/Inventory, Task 2d SearchableSelect)

### Phase 2: Feature-local migrations (parallel)

- [ ] **Task 3: Dictionary tab — local components → shared**
  - **Description:** Replace custom/natives in Dictionary & Card Creator with shared components or promoted molecules.
  - **Acceptance criteria:**
    - [ ] `searchHistory` uses `Chip` or new `HistoryChip`; undefined `--font-size-xm` fixed.
    - [ ] `DefinitionItem` uses `Checkbox`.
    - [ ] `FieldAutoGrowInput` uses `Textarea` variant or `AutoGrowTextarea` molecule.
    - [ ] `MediaList` uses `Button shape="circle"`, `Icon` semantic sizes, `Badge` for status; opacity literals removed.
    - [ ] `AudioPanel`/`ImagePanel`/`TranslatePanel`/`PronunciationPanel`/`QueueSidebar` no longer use native `<button>`/`<div>` controls or deprecated `IconButton`.
    - [ ] `DictionaryPanelView` uses `Heading`/`Text`/`Label` for headings and descriptive text.
    - [ ] `min-width: 6em`, `max-width: 192px`, `18px`, `2px`, `text-decoration-thickness` tokenized.
    - [ ] `DictionaryTab.module.css` breakpoint `min-width: 590px` tokenized.
  - **Verification:** `npm run test:unit` (dictionary paths), `npm run typecheck`, `npm run lint`, `design-system-guardian` pass on touched files.
  - **Dependencies:** Task 1, Task 2
  - **Files likely touched:** `src/features/dictionaryPopup/ui/*`, `src/features/cardCreator/ui/*`, `src/features/universalPanel/tabs/DictionaryTab.module.css`
  - **Estimated scope:** Large

- [ ] **Task 4: Study Modes tab — fix + showcase real component**
  - **Description:** Fix double padding, heading hierarchy, error color, accessibility, custom molecules, and render the real `StudyModesTab` in the showcase.
  - **Acceptance criteria:**
    - [ ] `StudyModesTab.module.css` no longer double-pads with `UniversalPanel.module.css`.
    - [ ] `CustomModeBuilder` error text uses `color="error"` and does not conflict with local error style.
    - [ ] `StepEditor` icon-only delete button has `aria-label="Remove step"` and a focus ring.
    - [ ] `CueStrip`/`StepEditor` native `<button>` migrated to `Button`/`Chip` or new `CueBlock` molecule.
    - [ ] `ModeCard`/`NewModeCard` use `Card`/`Button`/`Icon` or promoted `SelectableCard`/`PlaceholderCard`.
    - [ ] `Heading level={3}` used for sub-sections while keeping visual size via `size` prop.
    - [ ] Hardcoded `1px` cue border, `0.04em` letter-spacing, `360/520/639px` breakpoints tokenized.
    - [ ] `CustomModeBuilder`/`CueStrip`/`StepEditor` styles extracted to own `.module.css` files.
    - [ ] `UniversalPanelPage.showcase.tsx` renders real `StudyModesTab` (or a mock).
    - [ ] No hardcoded icon sizes (`14`, `16`, `28`, `32`) or `@/shared/icons/Icon` imports.
  - **Verification:** `npm run test:unit` (studyModes paths), `npm run typecheck`, `npm run lint`, visual check in showcase.
  - **Dependencies:** Task 1, Task 2
  - **Files likely touched:** `src/features/studyModes/ui/*`, `src/features/universalPanel/tabs/StudyModesTab.module.css`, `src/entrypoints/design-system-showcase/pages/UniversalPanelPage.showcase.tsx`
  - **Estimated scope:** Large

- [ ] **Task 5: Settings tab — deduplicate header, scope theme, migrate natives, promote `MultiSelect`**
  - **Description:** Fix duplicate header, `ThemePanel` global overwrite, native controls, `ApiKeyManager`/`TtsLanguagePanel` token drift, `Dropzone` keyboard, `ImportProgress`/`ResourcesPanel` surfaces.
  - **Acceptance criteria:**
    - [ ] `SettingsDialogContent` no longer renders duplicate "Settings" when inside `UniversalPanel` (`showSidebarHeader` prop).
    - [ ] `ThemePanel` receives a scoped `container` and calls `applyTheme` only on it; no `document.documentElement` writes.
    - [ ] `CardCreatorSettingsPanel`, `DictionaryPopupSettingsPanel`, `TtsVoiceManagerPanel` use `Input`/`Select`/`Toggle`/`Textarea` instead of native controls.
    - [ ] `ApiKeyManager.module.css` uses tokens for transitions/cubic-bezier/`2px` outlines/`rgba` fallbacks.
    - [ ] `TtsLanguagePanel.module.css` fully rewritten to current tokens.
    - [ ] `MultiSelect` promoted to `src/shared/ui/MultiSelect.tsx` and uses `Select` listbox patterns + `aria-activedescendant`.
    - [ ] `Dropzone` supports `Enter`/`Space` activation or uses a shared `FileDrop` molecule.
    - [ ] `ImportProgress` uses shared `Progress`; `ResourcesPanel` removes nested `.panel`/`.section` surfaces.
    - [ ] `ThemePanel`/`ColorCustomization`/`ModeCards`/`ContrastBadges`/`ThemePreview`/`ThemeImportExport` remove emoji, use `Icon`, and fix `title`-only accessibility.
  - **Verification:** `npm run test:unit` (settings/theme paths), `npm run typecheck`, `npm run lint`, visual check.
  - **Dependencies:** Task 1, Task 2
  - **Files likely touched:** `src/features/settings/ui/*`, `src/features/theme/ui/*`, `src/features/dictionary/ui/*`, `src/features/tts/ui/*`, `src/shared/ui/MultiSelect.tsx` (new)
  - **Estimated scope:** Large

### Phase 3: Cross-cutting P0s (parallel)

- [ ] **Task 8: Theme scoping — `ThemePanel`/`ThemeProvider`/`applyTheme`**
  - **Description:** Make `applyTheme` always receive a scoped `container` when running inside the Universal Panel or any shadow root.
  - **Acceptance criteria:**
    - [ ] `ThemePanel` no longer calls `applyTheme` on `document.documentElement` when embedded in the panel.
    - [ ] `UniversalPanel`/`mountUniversalPanel` pass a `container` or `ShadowThemeProvider` context to `ThemePanel`.
    - [ ] Design-system showcase `UniversalPanel` does not switch `document.documentElement` `data-theme` when Settings tab is opened.
    - [ ] Screenshot `universal-panel-settings-light-direct.png` in light mode stays light.
  - **Verification:** `npm run test:unit`, `npm run typecheck`, visual check in both light/dark.
  - **Dependencies:** Task 1, Task 5
  - **Files likely touched:** `src/features/theme/ui/ThemePanel.tsx`, `src/features/universalPanel/UniversalPanel.tsx`, `src/features/universalPanel/mountUniversalPanel.ts`, `src/shared/lib/shadowRoot/ShadowThemeProvider.tsx`
  - **Estimated scope:** Medium

- [ ] **Task 9: Shield Universal Panel & extension UI from `WebTriggerController`**
  - **Description:** Ensure clicks inside any Cell UI (Universal Panel, Settings, Card Creator, Dictionary popup) never trigger `WebTriggerController` lookups, even when the component is not mounted into `#cell-universal-panel-host`.
  - **Acceptance criteria:**
    - [ ] `UniversalPanel` root has a stable selector added to `UI_HOST_SELECTORS` (e.g. `data-cell-id="universal-panel"` or a `js-cell-*` class).
    - [ ] `SettingsDialogContent`, `CardCreatorDialogContent`, `PopupDictionary`, `OrbitalBadge`, `NavItem`, `Navigation` carry `data-no-lookup` or `data-allow-lookup` as appropriate.
    - [ ] Clicking "Study Modes", "Settings", "TTS Voices", etc. inside the panel does **not** open `PopupDictionary`.
    - [ ] `isInsideBlockedHostForLookup` and `pathMatchesSelector` still work with shadow DOM (`composedPath()`).
    - [ ] `webTriggerController.test.ts` updated to cover the new shield.
  - **Verification:** `npm run test:unit` (webTrigger paths), `npm run typecheck`, visual check in showcase (click each nav item — no popup).
  - **Dependencies:** Task 1, Task 3, Task 4, Task 5
  - **Files likely touched:** `src/features/dictionaryPopup/trigger/webTriggerController.ts`, `src/features/universalPanel/UniversalPanel.tsx`, `src/features/universalPanel/UniversalPanel.module.css`, `src/features/settings/ui/SettingsDialogContent.tsx`, `src/shared/ui/NavItem.tsx`, `src/shared/ui/Navigation.tsx`, `src/features/dictionaryPopup/ui/PopupDictionary.tsx`, `src/features/dictionaryPopup/ui/OrbitalBadge.tsx`
  - **Estimated scope:** Medium

### Phase 4: Showcase & verification

- [ ] **Task 6: Showcase updates**
  - **Description:** Make the Universal Panel showcase use the real `StudyModesTab`, mount `UniversalPanel` in a proper host, and prevent global theme overwrites.
  - **Acceptance criteria:**
    - [ ] `UniversalPanelPage.showcase.tsx` uses `StudyModesTab` (or a stub that doesn't trigger lookup).
    - [ ] `UniversalPanel` is wrapped in a host element matching `UI_HOST_SELECTORS` for the showcase, or `data-no-lookup` is present.
    - [ ] `SettingsTab` in the showcase uses a scoped theme container so it does not flip the whole page dark.
    - [ ] `mode=light`/`mode=dark` query params actually control the showcase theme without being overridden by `ThemePanel`.
  - **Verification:** `npm run build:design-system`, `npm run design-system`, manual click-through.
  - **Dependencies:** Task 1–5, Task 8, Task 9
  - **Files likely touched:** `src/entrypoints/design-system-showcase/pages/UniversalPanelPage.showcase.tsx`, `src/entrypoints/design-system-showcase/mockProviders.tsx`
  - **Estimated scope:** Medium

- [ ] **Task 10: Update `docs/design-system/COMPONENT_INVENTORY.json`**
  - **Description:** Add missing components (`Stack`, `Tabs`, `MultiSelect`, `CueStrip`, `StepEditor`, `ModeCard`, `HistoryChip`, `AutoGrowTextarea`, `ColorInput`, `FileDrop`, `SelectableCard`, `PlaceholderCard`, `DictionarySkeleton`) with correct atomic levels and status.
  - **Acceptance criteria:**
    - [ ] `node scripts/generate-component-inventory.mjs` regenerates the inventory without errors.
    - [ ] All new shared components are `stable`/`experimental` with correct `level`.
    - [ ] `IconButton`/`MultiSelect`/`Tabs`/`Stack` are no longer missing or misclassified.
  - **Verification:** `node scripts/generate-component-inventory.mjs`, `npm run check-design-system-css`
  - **Dependencies:** Task 2–5
  - **Files likely touched:** `docs/design-system/COMPONENT_INVENTORY.json`, `scripts/generate-component-inventory.mjs`
  - **Estimated scope:** Small

### Phase 5: Final verification

- [ ] **Task 7: Run all quality gates + visual regression**
  - **Description:** Run the full pre-commit gate and visual verification after all fixes.
  - **Acceptance criteria:**
    - [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` pass.
    - [ ] `bash .agents/skills/m3-design-standard/audit/audit.sh` passes on `src/features/universalPanel`, `src/features/dictionaryPopup`, `src/features/cardCreator`, `src/features/studyModes`, `src/features/settings`, `src/features/theme`, `src/features/tts`, `src/features/dictionary`, `src/shared/ui`.
    - [ ] `node scripts/check-design-system-css.mjs` passes.
    - [ ] Screenshots in `docs/audits/screenshots/` re-captured in light + dark, dictionary + study modes + settings, and show no `PopupDictionary` overlay on nav clicks, no duplicate "Settings" header, no global theme overwrite.
    - [ ] `COMPONENT_INVENTORY.json` regenerated and committed.
  - **Verification:** All of the above + manual review of screenshots.
  - **Dependencies:** All previous tasks
  - **Files likely touched:** `docs/audits/screenshots/*`, `docs/design-system/COMPONENT_INVENTORY.json`
  - **Estimated scope:** Medium

## Checkpoints

### Checkpoint 1 — Foundation (after Task 1 + Task 2)
- [ ] All tokens resolved; no undefined/legacy tokens in audited paths.
- [ ] Shared atoms cleaned (hardcoded px removed, `IconButton`/`Dialog`/`Input`/`SearchableSelect` fixed).
- [ ] `npm run typecheck` + `npm run lint` pass.
- [ ] `COMPONENT_INVENTORY.json` updated for `Stack`, `Tabs`, `IconButton`.

### Checkpoint 2 — Feature migrations (after Task 3 + Task 4 + Task 5)
- [ ] Dictionary, Study Modes, Settings use shared components for all repeated patterns.
- [ ] No native controls outside shared atoms.
- [ ] No nested card surfaces.
- [ ] `npm run test:unit` passes for all touched features.

### Checkpoint 3 — Cross-cutting P0s (after Task 8 + Task 9)
- [ ] No `PopupDictionary` opens on panel nav clicks.
- [ ] `ThemePanel` no longer overwrites `document.documentElement`.
- [ ] Screenshots confirm the two P0s are gone.

### Checkpoint 4 — Showcase & final (after Task 6 + Task 10 + Task 7)
- [ ] `StudyModesTab` renders in the showcase.
- [ ] `COMPONENT_INVENTORY.json` is complete.
- [ ] All quality gates pass.
- [ ] Light + dark screenshots look consistent.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **P0 regressions in production** — content-script lookup and theme overwrite may already affect real pages | High | Fix `UI_HOST_SELECTORS` and `ThemePanel` scoping first; add unit tests in `webTriggerController.test.ts` and `ThemePanel` tests. |
| **Shared-atom changes ripple** — `Button`/`Icon`/`Toggle` used everywhere | High | Run `npm run test:unit` + `npm run test:e2e` (if available) + visual regression on all showcases. |
| **Native-control migration misses edge cases** — `MultiSelect`, `Dropzone`, `FieldAutoGrowInput`, `ColorCustomization` | Medium | Preserve behavior; use `Select`/`Textarea`/`Input`/`FileDrop` patterns; add keyboard tests. |
| **TtsLanguagePanel rewrite is large** — legacy `cell-*` tokens | Medium | Rewrite to a small subset of tokens first, then polish; run `design-system-guardian` on that file. |
| **Showcase theme params still conflict** | Medium | Add `container` prop to `ThemePanel` and wire `mode`/`tab` query params to showcase state. |
| **Component inventory generated by script** — manual edits may be lost | Low | Update `scripts/generate-component-inventory.mjs` or its source data, not the JSON directly. |

## Open Questions

- Should `MultiSelect` become a shared molecule (`src/shared/ui/MultiSelect`) or remain settings-local?
- Should `ThemePanel` preview apply to a sandboxed `ThemePreview` element instead of the panel root?
- Is `BorderRadius: 50%` in `NavItem` intentionally pill-shaped, or should it use `--radius-full`?
- Should `TokenizeControls` keep a shadow or go flat with a border?
- Should `CueStrip`/`StepEditor` become shared molecules or stay feature-local?

---

## Task ↔ Subagent mapping

| Task | Can be a parallel subagent? | Notes |
|---|---|---|
| Task 1 | Yes | Token-only changes; can run with Task 2. |
| Task 2 | Yes | Split into 2a–2d for 4 parallel agents if needed. |
| Task 3 | Yes | Dictionary/Card Creator files only. |
| Task 4 | Yes | Study Modes files only. |
| Task 5 | Yes | Settings/Theme/TTS/Dictionary files only. |
| Task 8 | Yes | ThemePanel + UniversalPanel only; coordinate with Task 5 if same file. |
| Task 9 | Yes | `webTriggerController` + panel host attributes only. |
| Task 6 | Yes | Showcase files only. |
| Task 10 | Yes | Inventory generator + JSON only. |
| Task 7 | No | Final verification after everything. |

---

*Generated with Devin. This plan is based on `docs/audits/universal-panel-atomic-design-audit-2026-09-05.md` and `docs/audits/universal-panel-visual-findings-2026-09-05.md`.*
