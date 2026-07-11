# Task: Shared UI Components (Phase 2)

> Implementation plan derived from `docs/specs/spec-shared-ui-components.md`. Each task should leave the system in a working state.

## Phase 1: Form Atoms

### Task 1: Label + Checkbox + Radio

**Description:** Add `Label`, `Checkbox`, and `Radio` atoms to `src/shared/ui/`. Include sizes and error states.

**Acceptance criteria:**
- `Label` supports `htmlFor`, `required`, `disabled` styling.
- `Checkbox` supports `label`, `indeterminate`, `error`, `disabled`.
- `Radio` supports `label`, `error`, `disabled`.
- All three have colocated tests in `*.test.tsx`.

**Verification:**
- `npx jest --selectProjects unit -- src/shared/ui/Label.test.tsx src/shared/ui/Checkbox.test.tsx src/shared/ui/Radio.test.tsx` passes.
- `npm run typecheck` passes.

**Files likely touched:**
- `src/shared/ui/Label.tsx`
- `src/shared/ui/Label.module.css`
- `src/shared/ui/Label.test.tsx`
- `src/shared/ui/Checkbox.tsx`
- `src/shared/ui/Checkbox.module.css`
- `src/shared/ui/Checkbox.test.tsx`
- `src/shared/ui/Radio.tsx`
- `src/shared/ui/Radio.module.css`
- `src/shared/ui/Radio.test.tsx`
- `src/shared/ui/index.ts`

**Estimated scope:** Medium
**Dependencies:** None

---

### Task 2: Textarea + Select + Badge

**Description:** Add `Textarea`, `Select`, and `Badge` atoms. `Select` is a plain HTML `<select>` wrapper. `Badge` supports variants: default, secondary, outline, destructive, success, warning.

**Acceptance criteria:**
- `Textarea` resizes vertically, supports `resize` prop, error, disabled.
- `Select` supports `placeholder`, `options` array, error, disabled.
- `Badge` renders variants and sizes `sm`/`md`.
- All three have colocated tests.

**Verification:**
- `npx jest --selectProjects unit -- src/shared/ui/Textarea.test.tsx src/shared/ui/Select.test.tsx src/shared/ui/Badge.test.tsx` passes.
- `npm run typecheck` passes.

**Files likely touched:**
- `src/shared/ui/Textarea.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Select.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Badge.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/index.ts`

**Estimated scope:** Medium
**Dependencies:** None

---

### Task 3: Form Molecules (InputField, FormGroup, CheckboxGroup, RadioGroup, SearchField)

**Description:** Compose atoms into molecules: `InputField`, `FormGroup`, `CheckboxGroup`, `RadioGroup`, `SearchField`. These are the building blocks for `SettingsDialog` and future forms.

**Acceptance criteria:**
- `InputField` = `Label` + `Input` + error/helper text.
- `FormGroup` wraps label + children with consistent spacing.
- `CheckboxGroup`/`RadioGroup` manage a list of options with name and selected state.
- `SearchField` = `Input` with leading search icon and clear button.
- All have colocated tests.

**Verification:**
- `npx jest --selectProjects unit -- src/shared/ui/InputField.test.tsx src/shared/ui/FormGroup.test.tsx src/shared/ui/CheckboxGroup.test.tsx src/shared/ui/RadioGroup.test.tsx src/shared/ui/SearchField.test.tsx` passes.

**Files likely touched:**
- `src/shared/ui/InputField.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/FormGroup.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/CheckboxGroup.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/RadioGroup.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/SearchField.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/index.ts`

**Estimated scope:** Medium
**Dependencies:** Task 1, Task 2

---

## Checkpoint 1: Form controls ready

- [ ] Unit tests for all new atoms/molecules pass.
- [ ] `npm run typecheck` passes.
- [ ] `npx eslint src/shared/ui/` passes (no errors).

---

## Phase 2: Feedback + Loading

### Task 4: Spinner + Progress + Skeleton

**Description:** Add loading/feedback atoms: `Spinner`, `Progress`, `Skeleton`. `Spinner` is used for buttons and inline loading. `Progress` is a horizontal progress bar. `Skeleton` is a placeholder shape.

**Acceptance criteria:**
- `Spinner` supports `size` prop `sm`/`md`/`lg` and `className`.
- `Progress` supports `value`, `max`, `indeterminate`.
- `Skeleton` supports `width`, `height`, `circle`/`rounded`/`rect` shapes.
- All have colocated tests.

**Verification:**
- `npx jest --selectProjects unit -- src/shared/ui/Spinner.test.tsx src/shared/ui/Progress.test.tsx src/shared/ui/Skeleton.test.tsx` passes.

**Files likely touched:**
- `src/shared/ui/Spinner.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Progress.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Skeleton.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/index.ts`

**Estimated scope:** Small
**Dependencies:** None

---

### Task 5: Alert + EmptyState + Tooltip

**Description:** Add feedback molecules: `Alert`, `EmptyState`, `Tooltip`. `Alert` variants: default, success, warning, error. `EmptyState` = icon + title + description + optional action. `Tooltip` wraps `HintIcon` with accessible `aria-describedby`.

**Acceptance criteria:**
- `Alert` supports title, description, dismiss button, role `alert`/`status`.
- `EmptyState` supports icon, title, description, action.
- `Tooltip` is accessible and uses `aria-describedby`.
- All have colocated tests.

**Verification:**
- `npx jest --selectProjects unit -- src/shared/ui/Alert.test.tsx src/shared/ui/EmptyState.test.tsx src/shared/ui/Tooltip.test.tsx` passes.

**Files likely touched:**
- `src/shared/ui/Alert.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/EmptyState.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Tooltip.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/index.ts`

**Estimated scope:** Medium
**Dependencies:** Task 4

---

## Checkpoint 2: Feedback components ready

- [ ] All new feedback/loading tests pass.
- [ ] `npm run typecheck` passes.

---

## Phase 3: Navigation + Layout

### Task 6: Tabs + Accordion + ListItem + NavItem

**Description:** Add navigation/structure molecules: `Tabs`, `Accordion`, `ListItem`, `NavItem`. `Tabs` uses compound API. `NavItem` replaces the sidebar item in `OptionsApp`.

**Acceptance criteria:**
- `Tabs` has `Tabs.List`, `Tabs.Trigger`, `Tabs.Content` compound components.
- `Accordion` supports single and multiple expanded sections.
- `ListItem` supports leading/trailing content and active state.
- `NavItem` supports icon, label, active, disabled, `orientation` `horizontal`/`vertical`.
- All have colocated tests.

**Verification:**
- `npx jest --selectProjects unit -- src/shared/ui/Tabs.test.tsx src/shared/ui/Accordion.test.tsx src/shared/ui/ListItem.test.tsx src/shared/ui/NavItem.test.tsx` passes.

**Files likely touched:**
- `src/shared/ui/Tabs.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Accordion.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/ListItem.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/NavItem.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/index.ts`

**Estimated scope:** Medium
**Dependencies:** None

---

### Task 7: Header + Sidebar + Drawer

**Description:** Add layout organisms: `Header`, `Sidebar`, `Drawer`. `Header` is for popup/options chrome. `Sidebar` is the vertical navigation container. `Drawer` is a slide-in panel for mobile/options.

**Acceptance criteria:**
- `Header` supports title, leading/trailing actions, responsive height.
- `Sidebar` supports `collapsible` and `collapsed` states.
- `Drawer` supports open/close, overlay, focus trap, swipe-away optional.
- All have colocated tests.

**Verification:**
- `npx jest --selectProjects unit -- src/shared/ui/Header.test.tsx src/shared/ui/Sidebar.test.tsx src/shared/ui/Drawer.test.tsx` passes.

**Files likely touched:**
- `src/shared/ui/Header.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Sidebar.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/Drawer.tsx` + `.module.css` + `.test.tsx`
- `src/shared/ui/index.ts`

**Estimated scope:** Medium
**Dependencies:** Task 6

---

## Checkpoint 3: Navigation and layout ready

- [ ] All navigation/layout tests pass.
- [ ] `npm run typecheck` passes.

---

## Phase 4: Migrate Existing Feature UI

### Task 8: Migrate Theme UI to Shared Components

**Description:** Convert `ColorCustomization`, `ThemePreview`, `ModeCards`, `ContrastBadges`, `ThemeImportExport` to use `Card`, `Button`, `Input`, `Label`, `Badge`, semantic tokens, and remove GitHub tokens.

**Acceptance criteria:**
- No GitHub tokens in `src/features/theme/ui/*.module.css`.
- No custom buttons; use `Button`.
- `ThemePanel` still works as before.

**Verification:**
- `npx jest --selectProjects unit -- src/features/theme/ui/` passes.
- `grep -R "--color-snow\|--color-slate-edge\|--font-mona-sans\|--text-subheading\|--text-body" src/features/theme/ui` returns empty.

**Files likely touched:**
- `src/features/theme/ui/ColorCustomization.tsx` + `.module.css`
- `src/features/theme/ui/ThemePreview.tsx` + `.module.css`
- `src/features/theme/ui/ModeCards.tsx` + `.module.css`
- `src/features/theme/ui/ContrastBadges.tsx` + `.module.css`
- `src/features/theme/ui/ThemeImportExport.tsx` + `.module.css`
- `src/features/theme/ui/ThemePanel.tsx` (if needed)

**Estimated scope:** Large
**Dependencies:** Task 1-3, Task 4-5

---

### Task 9: Migrate SettingsDialog to Shared Form Components

**Description:** Refactor `SettingsDialog` to use `InputField`, `FormGroup`, `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Select`, `Slider`, `Toggle`, `ShortcutInput`, `Button`, `Dialog`, `Card`. Remove custom form controls and raw colors.

**Acceptance criteria:**
- Settings sections use `FormGroup` and `InputField` where appropriate.
- Toggles/Sliders/ShortcutInputs are the existing shared atoms (no change needed if already used).
- No GitHub tokens in `src/features/settings/ui/*.module.css`.

**Verification:**
- `npx jest --selectProjects unit -- tests/unit/features/settings/ui/` passes.
- `npx eslint src/features/settings/ui/` passes.

**Files likely touched:**
- `src/features/settings/ui/SettingsDialog.tsx` + `.module.css`
- `src/features/settings/ui/SettingsDialogShortcuts.tsx` (if exists)
- `src/features/settings/ui/SubtitleStylePanel.tsx` (if exists)

**Estimated scope:** Large
**Dependencies:** Task 1-3

---

### Task 10: Migrate Popup Media Components to Shared Components

**Description:** Convert `MediaEmpty`, `Header`, `VideoCard`, `SubtitleCard`, `DownloadCard` to use `Card`, `Button`, `IconButton`, `Badge`, `EmptyState`, `Progress`, semantic tokens. Remove custom `.btn`, `.card`, `.downloadBtn` styles.

**Acceptance criteria:**
- `MediaEmpty` uses `EmptyState`.
- `Header` uses `Button`/`IconButton`.
- `VideoCard`, `SubtitleCard`, `DownloadCard` use `Card` for outer container.
- No GitHub tokens in `src/entrypoints/popup/components/**/*.module.css`.

**Verification:**
- `npx jest --selectProjects unit -- tests/unit/entrypoints/popup/` passes.
- `npm run typecheck` passes.

**Files likely touched:**
- `src/entrypoints/popup/components/layout/Header.tsx` + `.module.css`
- `src/entrypoints/popup/components/media/VideoCard.tsx` + `.module.css`
- `src/entrypoints/popup/components/media/SubtitleCard.tsx` + `.module.css`
- `src/entrypoints/popup/components/media/DownloadCard.tsx` + `.module.css`
- `src/entrypoints/popup/components/media/MediaEmpty.tsx` + `.module.css`
- `src/entrypoints/popup/App.redesigned.tsx` + `.module.css`

**Estimated scope:** Large
**Dependencies:** Task 2, Task 4-5, Task 6-7

---

## Checkpoint 4: Feature migration complete

- [ ] All theme, settings, popup tests pass.
- [ ] `npm run typecheck` passes.
- [ ] `npx eslint src/` passes (or only pre-existing warnings).
- [ ] No legacy GitHub tokens in `src/` CSS.

---

## Phase 5: Audit + Documentation

### Task 11: Token Audit + Fix Stragglers

**Description:** Search for raw colors, legacy tokens, and custom buttons in `src/`. Fix any remaining occurrences. Update `docs/design-system/design-system.md` if implementation diverges from the spec.

**Acceptance criteria:**
- `grep -R "rgba(255,255,255\|rgba(255, 255, 255\|#0d1117\|#151a22\|#21262d\|#a4aea6\|#7c8980\|#5fed83\|#08872b\|#818b98" src/` returns empty.
- `grep -R "--color-snow\|--color-pearl\|--color-moss\|--color-slate-edge\|--color-obsidian\|--color-deep-void\|--color-mercury\|--color-terminal-green\|--color-phosphor\|--font-mona-sans\|--text-body\|--text-caption\|--text-heading\|--text-subheading\|--text-body-sm" src/` returns empty (except comments).

**Verification:**
- `npm run typecheck` and `npx jest --selectProjects unit --passWithNoTests` pass.

**Files likely touched:**
- Any remaining `*.module.css` in `src/`
- `docs/design-system/design-system.md`

**Estimated scope:** Medium
**Dependencies:** Task 8-10

---

### Task 12: Update Architecture Docs

**Description:** Update `docs/2-architechture-system.md` with the final shared UI tree and any new component usage. Update `docs/0-wiki.md` if new docs files were added.

**Acceptance criteria:**
- `docs/2-architechture-system.md` `shared/ui` section lists all components.
- `docs/0-wiki.md` mục lục includes `docs/task/task-shared-ui-components.md` and `docs/specs/spec-shared-ui-components.md`.

**Verification:**
- Review `docs/2-architechture-system.md` and `docs/0-wiki.md` manually.

**Files likely touched:**
- `docs/2-architechture-system.md`
- `docs/0-wiki.md`

**Estimated scope:** Small
**Dependencies:** Task 11

---

## Final Checkpoint

- [ ] All unit tests pass: `npx jest --selectProjects unit --passWithNoTests`.
- [ ] Typecheck passes: `npm run typecheck`.
- [ ] No legacy tokens or raw colors in `src/`.
- [ ] All new components exported from `src/shared/ui/index.ts`.
- [ ] Spec and task docs committed/updated.
