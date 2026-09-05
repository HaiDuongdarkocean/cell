# Universal Panel Tabs — Atomic Design & SSOT Audit

**Date:** 2026-09-05  
**Scope:** Dictionary, Study Modes, Settings tabs inside the Universal Panel, mapped from Page/Template down to Atom/Token.  
**Method:** `m3-design-standard/audit/audit.sh`, `design-system-guardian` greps, `COMPONENT_INVENTORY.json` verification, manual read. Two subagents (Dictionary, Study Modes) plus manual synthesis for Settings.  
**Status:** Read-only audit — no code changes.

---

## 1. Executive Summary

| Tab | P0 | P1 | P2 | Missing shared atoms/molecules | Existing shared atoms with issues |
|---|---|---|---|---|---|
| Dictionary | 4 | 10 | 6 | 8 | Button, Icon, IconButton, Input, Toggle, Dialog, BottomSheet |
| Study Modes | 3 | 8 | 5 | 5 | Button, Icon, Toggle, Input, Dialog, BottomSheet, NavItem |
| Settings | 4 | 9 | 7 | 6 | Button, Toggle, Input, NavItem, Sidebar, Dialog, MultiSelect, TtsLanguagePanel |
| **Total** | **11** | **27** | **18** | **19** | **reusable atoms: Button, Icon, Toggle, Input, Dialog, NavItem, Sidebar** |

Key SSOT violations:
- **19 custom molecules** should be promoted/reused, most notably `searchHistory`, `CandidateSkeleton`, `ModeCard`, `CueStrip`, `StepEditor`, `ApiKeyManager`, `TtsLanguagePanel`, `ThemePanel`.
- **Shared atoms** `Button`, `Icon`, `Toggle`, `Input`, `Dialog`, `NavItem`, `Sidebar` contain hardcoded px, hardcoded cubic-bezier, or raw `×`/emoji characters.
- **Legacy tokens** (`--font-size-xm`, `--border-radius-sm`, `--radius-m3-small`, `--border-radius-md`, `cell-*` namespace) break the token contract.
- **Native HTML inputs** bypass the shared UI in Card Creator, Dictionary Popup, and TTS settings.

---

## 2. Atomic Design Reference

| Layer | Responsibility | Examples in scope |
|---|---|---|
| **Page** | Route-level container | `DictionaryTab`, `StudyModesTab`, `SettingsTab` |
| **Template** | Layout / shell / pane split | `Dictionary`, `CardCreatorPanel`, `SettingsDialogContent` |
| **Organism** | Feature-level composition | `DictionaryPanelView`, `CandidateView`, `CustomModeBuilder`, `ThemePanel`, `TtsVoiceManagerPanel` |
| **Molecule** | Reusable UI pattern | `searchHistory`, `ModeCard`, `SettingsRow`, `CueStrip`, `ApiKeyManager` |
| **Atom** | Single-purpose shared component | `Button`, `Icon`, `Input`, `Toggle`, `Card`, `NavItem` |
| **Token** | Design foundation | `--space-*`, `--color-*`, `--radius-*`, `--duration-*`, etc. |

---

## 3. Dictionary Tab

### 3.1 Atomic Design tree

```text
[Page] DictionaryTab
  └── [Template] Dictionary
        └── [Organism] DictionaryPanelView
              ├── [Atom] SearchField
              ├── [Molecule] searchHistory          ← custom
              ├── [Molecule] CandidateSkeleton      ← custom
              ├── [Atom] Alert
              ├── [Atom] EmptyState
              ├── [Atom] Spinner
              ├── [Molecule] candidateChips         ← custom
              └── [Organism] CandidateView
                    ├── [Molecule] headerActions    ← custom (native <button>)
                    ├── [Molecule] readingControls  ← custom (native <button>)
                    ├── [Molecule] statusBadges     ← custom
                    ├── [Molecule] frequencyBadges  ← custom
                    ├── [Molecule] DictionaryToolbar ← custom
                    │     └── [Atom] Button
                    ├── [Molecule] AudioPanel       ← custom
                    ├── [Molecule] ImagePanel       ← custom
                    ├── [Molecule] TranslatePanel   ← custom
                    ├── [Molecule] LinksPanel       ← custom
                    ├── [Organism] PronunciationPanel ← custom
                    └── [Molecule] DefinitionItem   ← custom (native checkbox)
  └── [Template] CardCreatorPanel
        ├── [Atom] Spinner
        ├── [Atom] EmptyState
        └── [Organism] CardCreatorDialogContent
              ├── [Atom] Button
              ├── [Atom] Select
              ├── [Atom] Icon
              ├── [Molecule] FieldRow              ← custom
              │     ├── [Atom] Select
              │     ├── [Deprecated Atom] IconButton
              │     └── [Molecule] FieldAutoGrowInput ← custom
              ├── [Molecule] MediaList             ← custom
              ├── [Molecule] PreviewBlock          ← custom
              └── [Molecule] QueueSidebar          ← custom
```

### 3.2 Existing shared atoms — issues found

| Atom | Issues | Evidence |
|---|---|---|
| `Button` | Hardcoded focus outline `2px`/`3px`, hardcoded icon sizes `14/16/18/24/28px`, inline SVG filter via `dangerouslySetInnerHTML`, raw `×` in `Dialog` close. | `Button.module.css:90-91,127-128,142-143,154-155,166-167,181-182,382-383`; `Button.tsx:170`; `Dialog.tsx:104,116` |
| `Icon` | Feature code imports catalog wrapper `@/shared/icons/Icon` instead of public `@/shared/ui/Icon`; numeric `size` props bypass token mapping. | `DictionaryPanelView.tsx:11`, `CandidateView.tsx:1`, `DictionaryToolbar.tsx:1`, `AudioPanel.tsx:2`, `ImagePanel.tsx:2`, `MediaList.tsx:17`, etc. |
| `IconButton` | Deprecated wrapper; should be `Button shape="circle"`. | `IconButton.tsx:25-28`; used in `DictionaryPanelView`, `FieldRow`, `MediaList`, `QueueSidebar` |
| `Input` | Hardcoded `1px`/`2px` shadow offsets. | `Input.module.css:45-46,52,173,196,207` |
| `Toggle` | Hardcoded `4px`/`2px`/`0.5px` spacing, `0.3s linear` transition, inline SVG thumb. | `Toggle.module.css:21,26,31,48,76-79,82`; `Toggle.tsx:170` |
| `Dialog` | Close button uses raw `×` character; reduced-motion `0.01ms` hardcoded. | `Dialog.tsx:104,116`; `Dialog.module.css:83-84` |

### 3.3 Custom molecules/atoms that should be shared

| Custom node | Migration | Why |
|---|---|---|
| `searchHistory` | Reuse/extend `Chip` or create `HistoryChip` | Custom `Button`+`IconButton` markup, undefined `--font-size-xm`, hardcoded `18px` |
| `CandidateSkeleton` | Promote to `DictionarySkeleton` if reused | Good tokenization; only a pattern question |
| `DefinitionItem` | Use `Checkbox` | Native `<input type="checkbox">` |
| `FieldAutoGrowInput` | Extend `Textarea` with `autoGrow`/`clearable` | Native `<textarea>`, undefined `--input-focus-border` |
| `MediaList` | Use `Button shape="circle"` + `Icon` semantic sizes, replace opacity literals | Deprecated `IconButton`, numeric icon sizes, opacity, spacing-as-typography |
| `QueueSidebar` | Use `Badge` for status, fix `--color-background-hover` | Custom status `<span>`, deprecated `IconButton` |
| `AudioPanel` | Use `Button`, tokenize skeleton widths, fix `event` bug | Native `<button>`, `72px`/`96px` skeleton |
| `ImagePanel` | Use `Button`/`Checkbox` for image cards | Native `<button>`, hardcoded `8px`/`120px` fallbacks |
| `TranslatePanel` | Use `Button` toggle or `Checkbox` | `<div>` with `role="button"` but no keyboard handler |
| `PronunciationPanel` | Fix token, use `Alert`/`Text` for messages | Undefined `--border-radius-sm`, plain `<div>` messages |

### 3.4 P0/P1 issues

- **P0:** undefined token `--font-size-xm` (`DictionaryPanelView.module.css:158`), `--border-radius-sm` (`PronunciationPanel.module.css:36`), `--input-focus-border` (`FieldRow.module.css:111`), `--color-background-hover` (`QueueSidebar.module.css:52`); injection of global `components.css` to support raw `btn` classes.
- **P1:** `min-width: 6em`, `max-width: 192px`, `18px` badge, `text-decoration-thickness: 2px`, custom toolbar overrides `Button`, `CardCreatorDialog` body flattens elevation, `MediaList` opacity/typography token misuse.

---

## 4. Study Modes Tab

### 4.1 Atomic Design tree

```text
[Template] UniversalPanel
  └── [Organism] StudyModesTab
        ├── [Molecule] TabHeader            ← custom
        │     ├── [Atom] Heading
        │     ├── [Atom] Text
        │     ├── [Atom] Toggle
        │     └── [Atom] HStack
        ├── [Molecule] PlayModeSection      ← custom
        │     └── [Molecule] ModeCard       ← custom
        │           ├── [Atom] Card
        │           ├── [Atom] Icon
        │           ├── [Atom] Text
        │           └── [Atom] Button
        ├── [Molecule] CustomSection        ← custom
        │     ├── [Atom] Button
        │     ├── [Molecule] ModeCard       ← custom
        │     └── [Molecule] NewModeCard    ← custom
        │           ├── [Atom] Card
        │           ├── [Atom] Icon
        │           └── [Atom] Text
        ├── [Molecule] AdvancedSection      ← custom
        │     ├── [Atom] Card
        │     ├── [Molecule] ChipRow        ← custom
        │     ├── [Atom] Chip
        │     ├── [Atom] Checkbox
        │     └── [Organism] CustomModeBuilder ← custom
        │           └── [Molecule] BottomSheet (shared, non-public)
        │                 ├── [Molecule] FormGroup
        │                 ├── [Molecule] CueStrip ← custom
        │                 │     ├── [Atom] HStack
        │                 │     ├── [Atom] Text
        │                 │     ├── [Atom] Icon
        │                 │     └── [Custom atom] <button> .cueBlock / .cueAdd
        │                 └── [Molecule] StepEditor ← custom
        │                       ├── [Atom] VStack / HStack
        │                       ├── [Atom] Text
        │                       ├── [Atom] Chip
        │                       └── [Atom] Button
        └── [Molecule] DeleteConfirmDialog  ← custom
              ├── [Atom] Dialog
              └── [Atom] Button
```

### 4.2 Existing shared atoms — issues found

| Atom | Issues | Evidence |
|---|---|---|
| `Button` | Same as Dictionary: hardcoded focus/icon sizes, inline SVG filter. | `Button.module.css:90-91,127-128,...`; `Button.tsx:170` |
| `Icon` | Imported from `@/shared/icons/Icon` with numeric `size` props in `StudyModesTab.tsx`, `CueStrip.tsx`, `StepEditor.tsx`. | `StudyModesTab.tsx:3`; `CueStrip.tsx:3`; `StepEditor.tsx:3` |
| `Toggle` | Same as Dictionary. | `Toggle.module.css` |
| `Input` | Same as Dictionary. | `Input.module.css` |
| `Dialog` | Close button raw `×`. | `Dialog.tsx:104,116` |
| `BottomSheet` | Non-public; hardcoded `width: 94%`, `max-height: 75vh`, `0.01ms` reduced-motion. | `BottomSheet.module.css:14-15,77-79` |
| `NavItem` | `border-radius: 50%` in collapsed state. | `NavItem.module.css:139` |

### 4.3 Custom molecules/atoms that should be shared

| Custom node | Migration | Why |
|---|---|---|
| `ModeCard` | Promote to `src/features/studyModes/ui/ModeCard.tsx` or shared `SelectableCard` | Numeric icon size, opacity hierarchy, redundant cursor/transition |
| `NewModeCard` | Extend `Button`/`Card` or create `PlaceholderCard` | Manual `role="button"`, `tabIndex`, `onKeyDown`, dashed border |
| `CueStrip` | Create `CueBlock`/`CueStrip` molecules or reuse `Chip as="button"` | Native `<button>`, `1px` border, numeric icon size |
| `StepEditor` | Fix accessible name; extract `OptionGroup` | Icon-only delete button lacks `aria-label`, inline `OptionGroup` |
| `CustomModeBuilder` | Own `CustomModeBuilder.module.css` | Coupled to `StudyModesTab.module.css` |

### 4.4 P0/P1 issues

- **P0:** double padding with `UniversalPanel.content` (`StudyModesTab.module.css:2` + `UniversalPanel.module.css:48`), error text color conflict (`CustomModeBuilder.tsx:177`), icon-only delete button missing accessible name (`StepEditor.tsx:60-67`).
- **P1:** `1px` cue border, `0.04em` letter-spacing, `360/520/639px` breakpoints, opacity hierarchy, redundant `cursor`/`transition`, multiple `<Heading level={2}>` for sub-sections.

---

## 5. Settings Tab

### 5.1 Atomic Design tree

```text
[Page] SettingsTab
  └── [Template] SettingsDialogContent
        ├── [Organism] Sidebar            ← shared
        │     ├── [Atom] Heading
        │     └── [Molecule] Navigation   ← shared
        │           └── [Atom] NavItem
        └── [Template] mainCol
              ├── [Organism] Card "Media"  ← custom section wrapper
              │     ├── [Atom] Card
              │     ├── [Molecule] SettingsRow ← shared
              │     │     ├── [Atom] Toggle
              │     │     └── [Molecule] MultiSelect ← custom
              │     └── [Atom] HintIcon
              ├── [Organism] Card "Block"  ← custom section wrapper
              │     └── [Molecule] SettingsRow + Toggle + HintIcon
              ├── [Organism] LanguageProfilePanel ← custom
              │     ├── [Atom] SettingsRow
              │     ├── [Atom] SearchableSelect
              │     ├── [Atom] Button
              │     ├── [Atom] IconButton
              │     ├── [Atom] Dialog
              │     └── [Atom] Alert
              ├── [Organism] Card "Keyboard Shortcuts"
              │     └── [Atom] ShortcutInput
              ├── [Organism] Card "Download"
              │     ├── [Atom] SettingsRow
              │     └── [Atom] Select
              ├── [Organism] CardCreatorSettingsPanel ← custom
              │     ├── [Native input/select/button]
              │     └── [Atom] Button
              ├── [Organism] DictionaryPopupSettingsPanel ← custom
              │     ├── [Native input/select]
              │     └── [Atom] Slider
              ├── [Organism] PronunciationSettingsPanel ← custom
              │     ├── [Atom] VStack
              │     ├── [Atom] SettingsRow
              │     ├── [Atom] Button
              │     └── [Custom list] engineList
              ├── [Organism] LocalPronunciationSettingsPanel ← custom
              │     ├── [Atom] VStack / SettingsRow
              │     ├── [Atom] Select / Input / Button
              │     └── [Native file picker]
              ├── [Organism] Card "Local Player"
              │     └── [Atom] SettingsRow / Toggle / HintIcon
              ├── [Organism] ThemePanel     ← custom
              │     ├── [Molecule] ModeCards ← custom
              │     ├── [Atom] Select (PresetSwitcher)
              │     ├── [Molecule] ColorCustomization ← custom
              │     ├── [Molecule] ContrastBadges ← custom
              │     ├── [Molecule] ThemePreview ← custom
              │     ├── [Molecule] ThemeImportExport ← custom
              │     └── [Atom] Button
              ├── [Organism] TtsVoiceManagerPanel ← custom
              │     ├── [Atom] Card
              │     ├── [Atom] Button / IconButton
              │     ├── [Native select/textarea]
              │     └── [Organism] TtsLanguagePanel ← custom
              │         ├── [Atom] SettingsRow
              │         ├── [Atom] Toggle
              │         ├── [Atom] Select
              │         ├── [Atom] Button
              │         └── [Custom progress/badge]
              └── [Organism] ResourcesPanel ← custom
                    ├── [Atom] Alert
                    ├── [Molecule] Dropzone    ← custom
                    ├── [Molecule] ResourceCard ← custom
                    ├── [Molecule] ImportProgress ← custom
                    └── [Molecule] DeleteConfirmModal ← custom
```

### 5.2 Existing shared atoms — issues found

| Atom | Issues | Evidence |
|---|---|---|
| `Button` | Same as Dictionary/Study Modes. | `Button.module.css` |
| `Icon` | Imported via catalog in some settings files? Need replace with `@/shared/ui/Icon`. | `ApiKeyManager.tsx`, `LanguageProfilePanel.tsx`, `TtsVoiceManagerPanel.tsx` use `IconButton`/`Icon` with numeric sizes |
| `Toggle` | Same as above. | `Toggle.module.css` |
| `Input` | Same as above. | `Input.module.css` |
| `NavItem` | `border-radius: 50%` in collapsed state. | `NavItem.module.css:139` |
| `Sidebar` | Redundant "Settings" header in panel mode. | `SettingsDialogContent.tsx:160` |
| `Dialog` | Raw `×` close. | `Dialog.tsx:104,116` |

### 5.3 Custom molecules/atoms that should be shared

| Custom node | Migration | Why |
|---|---|---|
| `MultiSelect` | Promote to `src/shared/ui/MultiSelect.tsx` | Used in Media section; hardcoded `50vh`, scale keyframes, non-SSOT `.container` |
| `ApiKeyManager` | Promote to `src/shared/ui/ApiKeyManager` or keep feature-organism | Hardcoded transitions/cubic-bezier, `2px` focus rings, `rgba(239,68,68,0.1)` fallback, `.root` wrapper |
| `TtsLanguagePanel` | Full rewrite to tokens; then evaluate if reusable | Entire `cell-*` token namespace + hardcoded hex |
| `ThemePanel`/`ModeCards`/`ColorCustomization`/`ContrastBadges`/`ThemePreview`/`ThemeImportExport` | Split into shared molecules or keep as feature organisms | Non-SSOT `.panel`/`.wrapper`, emoji in TSX, spacing token used as font-size, `opacity: 0.8` |
| `CardCreatorSettingsPanel` / `DictionaryPopupSettingsPanel` | Use `Input`/`Select` from `@/shared/ui` | Native `<input>`/`<select>` |
| `ResourcesPanel` / `Dropzone` / `ResourceCard` / `ImportProgress` | Use `Card` surface, `Badge`, `Progress`; remove `.panel` wrapper | Non-SSOT wrapper, custom card chrome |

### 5.4 P0/P1 issues

- **P0:** `TtsLanguagePanel.module.css` entire file uses `cell-*` tokens and falls back to hardcoded hex/type; duplicate Settings header (`SettingsDialogContent.tsx:160`); nested card surfaces (`ThemePanel`, `TtsVoiceManagerPanel`, `ResourcesPanel`); undefined tokens `--radius-m3-small`/`--border-radius-md` (`SettingsDialog.module.css:138,253`).
- **P1:** `ApiKeyManager.module.css` hardcoded transitions/cubic-bezier/`2px` outline; native inputs in `CardCreatorSettingsPanel`, `DictionaryPopupSettingsPanel`, `TtsVoiceManagerPanel`; `SettingsDialog.module.css` hardcoded `1px`/`280px`; `ModeCards` uses spacing token for `font-size`/`border-width`; `MultiSelect` `50vh`; `NavItem` `border-radius: 50%`.

---

## 6. Shared-Atom Issues Across All Tabs

| Atom | P0/P1 issue | Fix |
|---|---|---|
| `Button` | `outline: 2px` / `outline-offset: 3px`, icon sizes `14/16/18/24/28px`, inline SVG filter | Use `--border-width-thick`/`--space-*`; tokenize icon sizes; externalize SVG filter |
| `Icon` | Feature files import `@/shared/icons/Icon` with numeric `size` | Force import from `@/shared/ui/Icon`; map sizes to tokens |
| `IconButton` | Deprecated; should be `Button shape="circle"` | Replace all occurrences |
| `Toggle` | `4px/2px/0.5px` hardcoded, `0.3s` transition, inline SVG thumb | Use `--space-*`, `--duration-normal`, `--ease-*`; externalize SVG |
| `Input` | `1px/2px` shadow offsets | Use `--border-width-hairline`/`--space-1` or add shadow tokens |
| `Dialog` | Raw `×` character for close | Use `<Icon name="x" />` |
| `NavItem` | `border-radius: 50%` | Use `--radius-full` |
| `Sidebar` | Double header in panel mode | Add `showSidebarHeader`/`panel` prop |
| `BottomSheet` | `width: 94%`, `max-height: 75vh`, `0.01ms` reduced-motion | Tokenize width/height/duration; make public if reused |

---

## 7. Missing Shared Components / Molecules

| Candidate | Suggested path | Layer | Consumers |
|---|---|---|---|
| `HistoryChip` / `SearchHistory` | `src/shared/ui/SearchHistory.tsx` | Molecule | Dictionary search history |
| `DictionarySkeleton` | `src/shared/ui/DictionarySkeleton.tsx` | Molecule | Candidate loading state |
| `DefinitionItem` | extend `Checkbox` | Atom/Molecule | Dictionary definitions |
| `AutoGrowTextarea` | `src/shared/ui/AutoGrowTextarea.tsx` | Molecule | Card Creator `FieldRow` |
| `MediaList` / `MediaGallery` | `src/shared/ui/MediaList.tsx` | Molecule | Card Creator |
| `Badge` usage | promote usage of existing `Badge` | Atom | Status, frequency, queue, TTS badges |
| `Chip` usage | promote usage of existing `Chip` | Atom | Search history, cue blocks, candidate chips |
| `ModeCard` / `SelectableCard` | `src/shared/ui/SelectableCard.tsx` | Molecule | Study Modes, potentially theme |
| `PlaceholderCard` | `src/shared/ui/PlaceholderCard.tsx` | Molecule | Study Modes new-mode card |
| `CueBlock` / `CueStrip` | `src/shared/ui/CueStrip.tsx` | Molecule | Study Modes builder |
| `StepEditor` / `OptionGroup` | `src/shared/ui/StepEditor.tsx` | Molecule | Study Modes builder |
| `MultiSelect` | `src/shared/ui/MultiSelect.tsx` | Molecule | Settings Media section |
| `ApiKeyManager` | keep as feature organism or promote | Organism | Settings |
| `TtsLanguagePanel` | rewrite first, then decide | Organism | TTS Voices |
| `ThemePanel` family | split into shared molecules | Organism/Molecule | Theme settings |

---

## 8. Token Issues

| Token | Status | Location | Fix |
|---|---|---|---|
| `--font-size-xm` | undefined | `DictionaryPanelView.module.css:158` | `--font-size-xs` or `--font-size-sm` |
| `--border-radius-sm` | undefined | `PronunciationPanel.module.css:36` | `--radius-sm` |
| `--input-focus-border` | undefined | `FieldRow.module.css:111` | `--input-border-focus` |
| `--color-background-hover` | undefined | `QueueSidebar.module.css:52` | `--color-surface-hover` |
| `--radius-m3-small` | undefined | `SettingsDialog.module.css:138` | `--radius-md` or `--radius-sm` |
| `--border-radius-md` | undefined | `SettingsDialog.module.css:253` | `--radius-md` |
| `cell-*` | legacy/undefined | `TtsLanguagePanel.module.css` | rewrite to `--space-*`, `--color-text-*`, `--font-size-*`, etc. |

---

## 9. Roadmap (priority)

1. **P0 first**
   - Rewrite `TtsLanguagePanel.module.css` to current tokens.
   - Fix all undefined tokens (`--font-size-xm`, `--border-radius-sm`, `--radius-m3-small`, `--border-radius-md`, `--input-focus-border`, `--color-background-hover`).
   - Remove double padding in Study Modes.
   - Suppress duplicate Settings header in panel mode.
   - Remove nested card surfaces in Theme/TTS/Resources.

2. **P1 shared-atom cleanup**
   - Tokenize `Button` focus/icon sizes and remove `dangerouslySetInnerHTML` filter.
   - Tokenize `Toggle`/`Input` hardcoded px.
   - Replace `Dialog` `×` with `Icon`.
   - Use `@/shared/ui/Icon` everywhere; remove `@/shared/icons/Icon` direct usage.
   - Replace deprecated `IconButton` with `Button shape="circle"`.

3. **P1 local-to-shared migration**
   - Replace native inputs in Card Creator, Dictionary Popup, TTS Voice Manager with `Input`/`Select`/`Textarea`.
   - Promote/extract `MultiSelect`, `CueStrip`, `StepEditor`, `ModeCard`, `AutoGrowTextarea`.
   - Fix `ApiKeyManager.module.css` transitions/cubic-bezier/outline.

4. **P2/P3 polish**
   - Remove emoji in Theme UI.
   - Replace opacity hierarchy with semantic text colors.
   - Standardize Study Modes breakpoints.
   - Add/adjust shadow tokens for custom shadows.

---

*Generated with Devin. Read-only audit; no source files were modified.*
