# Universal Panel Tabs — Design-System & Technical-Debt Audit

**Date:** 2026-09-05  
**Scope:** Dictionary, Study Modes, Settings tabs inside the Universal Panel, including their nested panels and shared dependencies (`src/features/universalPanel`, `src/features/dictionaryPopup`, `src/features/dictionary`, `src/features/studyModes`, `src/features/settings`, `src/features/cardCreator`, `src/features/pronunciation`, `src/features/theme`, `src/features/tts`).  
**Methods:** M3 Design Standard `audit.sh`, `design-system-guardian` heuristic greps, subagent hierarchy mapping, manual code/line verification.  
**Status:** Draft — no code changes were made during this audit.

---

## 1. Component Hierarchy (3–4 levels deep)

### 1.1 Dictionary tab

```
DictionaryTab
└─ .dictionaryTab
   ├─ .leftPane
   │  └─ Dictionary
   │     └─ DictionaryPanelView
   │        ├─ SearchField
   │        ├─ searchHistory (custom ul/li)
   │        ├─ CandidateSkeleton
   │        ├─ EmptyState / Alert
   │        └─ .candidateList
   │           └─ CandidateView
   │              ├─ .cellHeader (h2, send/quick-add icon-buttons)
   │              ├─ .cellHeaderReading (IPA + audio icon-buttons)
   │              ├─ .cellHeaderSecond (status pill, frequency pill)
   │              ├─ DictionaryToolbar (audio/image/translate/links/pronunciation tabs)
   │              ├─ Media panels
   │              │  ├─ AudioPanel
   │              │  ├─ ImagePanel
   │              │  ├─ TranslatePanel
   │              │  ├─ LinksPanel
   │              │  └─ PronunciationPanel
   │              └─ section.cellDef / DefinitionItem
   └─ .rightPane
      └─ CardCreatorPanel
         └─ CardCreatorDialogContent
            ├─ Select, FieldRow, FieldAutoGrowInput
            ├─ MediaList, PreviewBlock
            └─ QueueSidebar
```

### 1.2 Study Modes tab

```
StudyModesTab
├─ .tabHeader (Heading + Advanced Toggle)
├─ section "Play mode"
│  └─ .grid
│     └─ ModeCard
│        └─ Card.modeCard (Icon, title, desc, modeActions)
├─ section "Custom"
│  ├─ Button "New mode"
│  └─ .grid
│     ├─ ModeCard (custom)
│     └─ Card.newModeCard (dashed)
├─ (conditional) AdvancedSection
│  └─ Card.advancedCard
│     ├─ Chip row
│     ├─ Checkbox
│     └─ CustomModeBuilder
│        └─ BottomSheet
│           ├─ FormGroup / Input
│           ├─ CueStrip (cueBlock, cueAdd)
│           ├─ StepEditor (OptionGroup × 5)
│           └─ footer.builderFooter
└─ Dialog "Delete custom mode?"
```

### 1.3 Settings tab

```
SettingsTab
└─ SettingsDialogContent
   ├─ Sidebar (header="Settings")
   │  └─ Navigation / NavItem[]
   └─ mainCol (Scrollable)
      ├─ Card "Media" (SettingsRow / Toggle / MultiSelect)
      ├─ Card "Block" (SettingsRow / Toggle / HintIcon)
      ├─ Card "Language Profile" → LanguageProfilePanel
      ├─ Card "Keyboard Shortcuts" → ShortcutInput
      ├─ Card "Download" → SettingsRow / Select
      ├─ Card "Card Creator" → CardCreatorSettingsPanel
      ├─ Card "Dictionary Popup" → DictionaryPopupSettingsPanel
      ├─ Card "Pronunciation" → PronunciationSettingsPanel
      ├─ Card "Local Pronunciation" → LocalPronunciationSettingsPanel
      ├─ Card "Local Player" → SettingsRow / Toggle
      ├─ Card "Theme" → ThemePanel
      │  ├─ ModeCards
      │  ├─ PresetSwitcher
      │  ├─ ColorCustomization
      │  ├─ ContrastBadges
      │  ├─ ThemePreview
      │  └─ ThemeImportExport
      ├─ Card "TTS Voices" → TtsVoiceManagerPanel → TtsLanguagePanel
      └─ Card "Resources" → ResourcesPanel
```

---

## 2. Static Scan Summary

| Signal | Count | Source |
|---|---|---|
| M3 `audit.sh` violations in scope | ~58 | `m3-design-standard/audit/audit.sh` per feature dir |
| Undefined / legacy CSS tokens | 4 + 26 `cell-*` | `grep var(--...)` cross-checked with `tokens.css` |
| Hardcoded `1px` / `2px` border/outline | 10+ in scope | `grep` for `\b1px\b` / `\b2px\b` in `*.module.css` |
| Native HTML inputs in TSX | 7 in scope | `audit.sh [9]` + manual TSX read |
| Emoji in TSX | 6 in scope | `audit.sh [8]` |
| Non-SSOT `.panel/.container/.wrapper` | 8 in scope | `audit.sh [11]` |

> Note: M3 `audit.sh` is a heuristic; some matches are in CSS comments or tokenized values that simply begin with a number (e.g. `box-shadow: 0 calc(-1 * var(--space-1)) ...`). All findings below were manually verified.

---

## 3. Findings by Tab

### 3.1 Dictionary Tab

#### P0 — Blocker

1. **Undefined token `--font-size-xm` kills label text**
   - **File:** `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css:158`
   - **Current:** `.cellLabel { font-size: var(--font-size-xm); }`
   - **Evidence:** No `--font-size-xm` in `tokens.css`; rule is invalid.
   - **Proposed:** Replace with `var(--font-size-xs)` or `var(--font-size-sm)`.

2. **Undefined token `--border-radius-sm` in Pronunciation panel**
   - **File:** `src/features/pronunciation/ui/PronunciationPanel.module.css:36`
   - **Current:** `.phoneme { border-radius: var(--border-radius-sm); }`
   - **Evidence:** No such token; phoneme buttons become square.
   - **Proposed:** Replace with `var(--radius-sm)`.

#### P1 — Major

3. **Status pill `min-width: 6em` is not tokenized**
   - **File:** `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css:272`
   - **Current:** `min-width: 6em`
   - **Proposed:** `min-width: calc(6 * var(--font-size-sm))`.

4. **Toolbar tab overrides shared `Button` contract**
   - **File:** `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css:488-499`
   - **Current:** `.cellToolbar .cellToolbarTab` resets `height`, `min-height`, `padding`, `gap` to `0`/`var(--iconbutton-size-sm)`, beats the 40 px touch target.
   - **Proposed:** Use `IconButton` for icon-only tabs, or `Button` with `size="sm"` and remove local overrides.

5. **Candidate chip underline uses `2px` hardcoded**
   - **File:** `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css:715`
   - **Current:** `text-decoration-thickness: 2px`
   - **Proposed:** `var(--border-width-thick)` (or `var(--space-0-5)`).

6. **Search history term hardcoded width and remove badge size**
   - **Files:** `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css:107`, `:126-127`
   - **Current:** `max-width: 192px`, `width: 18px`, `height: 18px`
   - **Proposed:** `max-width: 24ch`, `width/height: var(--iconbutton-size-xs)`.

7. **Card Creator body flattens elevation**
   - **File:** `src/features/cardCreator/ui/CardCreatorDialog.module.css:80`
   - **Current:** `.cc-dialog__body--panel { background: var(--color-background); }`
   - **Evidence:** The wrapping `CardCreatorPanel` is `var(--color-surface-elevated)`, so the body drops the surface back down.
   - **Proposed:** `var(--color-surface-elevated)` or `var(--color-surface)`.

8. **Audio/Image panel fallbacks are hardcoded**
   - **Files:** `src/features/dictionaryPopup/ui/AudioPanel.tsx:133-134`, `ImagePanel.tsx:44-45`
   - **Current:** `72px`, `96px`, `8px`, `120px`
   - **Proposed:** Token-based skeleton sizes or `var(--space-*)`.

#### P2 — Minor

9. **Custom toolbar shadow uses raw numbers**
   - **File:** `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css:689`
   - **Current:** `box-shadow: 0 calc(-1 * var(--space-1)) var(--space-2) var(--color-shadow);`
   - **Evidence:** Not using `--shadow-*` token; custom inverted shadow.
   - **Proposed:** Use `var(--shadow-sm)` or add a `--shadow-top` token.

10. **PopupDictionary border hardcoded `1px`**
    - **File:** `src/features/dictionaryPopup/ui/PopupDictionary.module.css:46`
    - **Current:** `border-bottom: 1px solid var(--color-border);`
    - **Proposed:** `var(--border-width-hairline)`.

11. **Search history remove badge uses border color as background**
    - **File:** `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css:400-403`
    - **Current:** `background: var(--color-border); color: var(--color-text-inverse);`
    - **Risk:** Contrast may fail depending on theme.
    - **Proposed:** Use `var(--color-surface-hover)` or a semantic destructive token.

12. **Dead CSS `.phonemeActive`**
    - **File:** `src/features/pronunciation/ui/PronunciationPanel.module.css:54-59`
    - **Current:** `.phonemeActive` is defined but never applied in TSX.
    - **Proposed:** Remove or wire to active state.

### 3.2 Study Modes Tab

#### P0 — Blocker

1. **Double padding with `UniversalPanel.content`**
   - **Files:** `src/features/universalPanel/UniversalPanel.module.css:48`, `src/features/studyModes/ui/StudyModesTab.module.css:2`
   - **Current:** `.content` adds `padding: var(--space-4)`, `.tab` adds `padding: var(--space-6)`; Dictionary/Settings get `padding: 0` override.
   - **Evidence:** Study Modes is not in the `.content[data-cell-id="..."]` zero-padding list.
   - **Proposed:** Add `.content[data-cell-id="universal-panel-content-studyModes"] { padding: var(--space-0); }` or remove `.tab` padding.

2. **Custom mode builder error color ambiguous**
   - **File:** `src/features/studyModes/ui/CustomModeBuilder.tsx:177`
   - **Current:** `<Text color="secondary" className={styles.builderError}>` where `styles.builderError` sets `color: var(--color-error)`.
   - **Risk:** Class load order can render the text as `color-text-secondary` instead of error red.
   - **Proposed:** Remove `color="secondary"`; let the class own the color.

#### P1 — Major

3. **Custom builder styles coupled to tab module**
   - **Files:** `src/features/studyModes/ui/CustomModeBuilder.tsx`, `CueStrip.tsx`, `StepEditor.tsx`
   - **Current:** All import `StudyModesTab.module.css`.
   - **Proposed:** Create `CustomModeBuilder.module.css` and move `.builder*`, `.cue*`, `.step*` classes.

4. **Hardcoded `1px` border on cue blocks**
   - **File:** `src/features/studyModes/ui/StudyModesTab.module.css:165`
   - **Current:** `border: 1px solid var(--color-border);`
   - **Proposed:** `var(--border-width-hairline)`.

5. **Opacity used for hierarchy instead of color tokens**
   - **File:** `src/features/studyModes/ui/StudyModesTab.module.css:92,104`
   - **Current:** `.modeIcon { opacity: 0.8; }`, `.modeDesc { opacity: 0.85; }`
   - **Proposed:** Use `var(--color-text-tertiary)` / `var(--color-text-secondary)`.

6. **Hardcoded breakpoints outside Cell standard**
   - **File:** `src/features/studyModes/ui/StudyModesTab.module.css:51,57,268`
   - **Current:** `360px`, `520px`, `639px`
   - **Proposed:** Align with `480px` / `768px` or add `--breakpoint-*` tokens.

7. **Icon sizes hardcoded in TSX**
   - **File:** `src/features/studyModes/ui/StudyModesTab.tsx:121,151,227,242,251`; `CueStrip.tsx:89`
   - **Current:** `size={14}`, `size={16}`, `size={28}`, `size={32}`
   - **Proposed:** Extend `Icon` to accept `size="sm|md|lg"` mapped to tokens, or document exceptions.

#### P2 — Minor

8. **Redundant `cursor: pointer` and `transition` on mode cards**
   - **File:** `src/features/studyModes/ui/StudyModesTab.module.css:77-82,124`
   - **Current:** Duplicates `Card.module.css`.
   - **Proposed:** Remove or `transition: inherit`.

9. **`letter-spacing: 0.04em` not tokenized**
   - **File:** `src/features/studyModes/ui/StudyModesTab.module.css:30`
   - **Current:** `.eyebrow { letter-spacing: 0.04em; }`
   - **Proposed:** `var(--tracking-wide)`.

10. **Section headings all `level={2}`**
    - **File:** `src/features/studyModes/ui/StudyModesTab.tsx:96,117,269`
    - **Current:** Multiple `<h2>` for sub-sections.
    - **Proposed:** Use `level={3}` with `size={3}`.

11. **`UniversalPanelBottomNav` transition hardcoded**
    - **File:** `src/features/universalPanel/UniversalPanelBottomNav.module.css:46`
    - **Current:** `transition: background 120ms ease, border-color 120ms ease;`
    - **Proposed:** `var(--duration-fast) var(--ease-in-out)`.

### 3.3 Settings Tab

#### P0 — Blocker

1. **`TtsLanguagePanel` is written in a non-existent `cell-*` token namespace**
   - **File:** `src/features/tts/ui/TtsLanguagePanel.module.css` (entire file)
   - **Current:** Uses `var(--cell-gap-sm, 8px)`, `var(--cell-color-text-primary, #111)`, `font: var(--cell-text-body, 14px / 1.5 sans-serif)`, etc. None of these `cell-*` tokens exist in `tokens.css`.
   - **Impact:** Everything falls back to hardcoded hex/type on every theme, breaking dark mode, contrast, and SSOT.
   - **Proposed:** Rewrite to current tokens (`--space-*`, `--color-text-*`, `--font-size-*`, `--font-family`, `--radius-*`, `--color-error`).

2. **Undefined tokens `--radius-m3-small` and `--border-radius-md`**
   - **Files:** `src/features/settings/ui/SettingsDialog.module.css:138`, `:253`
   - **Current:** `.shortcutField { border-radius: var(--radius-m3-small); }`, `.engineItem { border-radius: var(--border-radius-md); }`
   - **Proposed:** `var(--radius-md)` / `var(--radius-sm)`.

3. **Duplicate "Settings" header inside the panel**
   - **Files:** `src/features/universalPanel/tabs/SettingsTab.tsx:74`, `src/features/settings/ui/SettingsDialogContent.tsx:160`
   - **Current:** `SettingsDialogContent` renders `<Sidebar header="Settings">`; the Universal Panel tab chrome already labels the tab.
   - **Proposed:** Add `showSidebarHeader?: boolean` (or `panel` prop) to `SettingsDialogContent` and set it `false` in `SettingsTab`.

4. **Nested card surfaces create double borders/backgrounds**
   - **Files:** `src/features/theme/ui/ThemePanel.module.css`, `src/features/tts/ui/TtsVoiceManagerPanel.module.css`, `src/features/dictionary/ui/ResourcesPanel.module.css`
   - **Current:** Each defines its own `.panel`/`.section` with `background`, `border`, `border-radius`, `padding`, then is wrapped in the shared `Card` from `SettingsDialogContent`.
   - **Proposed:** Remove inner card chrome when parent already supplies `Card`.

#### P1 — Major

5. **Native form controls in Settings and Card Creator settings**
   - **Files:**
     - `src/features/settings/ui/CardCreatorSettingsPanel.tsx:179`
     - `src/features/settings/ui/DictionaryPopupSettingsPanel.tsx:76,90,138,179`
     - `src/features/tts/ui/TtsVoiceManagerPanel.tsx:295,351,381,394`
     - `src/features/cardCreator/ui/FieldRow.tsx:103,147`
   - **Current:** Native `<input>`, `<select>`, `<textarea>`.
   - **Proposed:** Use `Input`, `Select`, `Textarea` from `@/shared/ui` and delete local input restyles.

6. **`ApiKeyManager` hardcoded focus rings, durations, and hex fallback**
   - **File:** `src/features/settings/ui/ApiKeyManager.module.css`
   - **Current:** `outline: 2px solid var(--color-primary); outline-offset: 2px;`, `150ms`/`220ms`/`300ms` transitions, `rgba(239,68,68,0.1)` fallback.
   - **Proposed:** Use `var(--space-0-5)` for 2 px, `var(--duration-fast/normal/slow)`, `var(--color-error-subtle)`.

7. **`SettingsDialog` hardcoded `1px` border and `280px` min-width**
   - **Files:** `src/features/settings/ui/SettingsDialog.module.css:283`, `:334`
   - **Current:** `border: 1px solid ...`, `min-width: 280px`
   - **Proposed:** `var(--border-width-hairline)`, `calc(var(--space-5) * 14)`.

8. **`ModeCards` spacing token used for type and border**
   - **File:** `src/features/theme/ui/ModeCards.module.css:15,22`
   - **Current:** `border-width: var(--space-0-5); font-size: var(--space-6);`
   - **Proposed:** `var(--border-width-hairline)`, `var(--font-size-2xl)`.

9. **`MultiSelect` max-height mixes token with `50vh`**
   - **File:** `src/features/settings/ui/MultiSelect.module.css:97`
   - **Current:** `max-height: min(var(--list-max-height, ...), 50vh);`
   - **Proposed:** Use `calc(100dvh - var(--space-16))` or a token-based cap.

10. **`SettingsDialog.module.css` hardcoded padding in comment matched by M3 heuristics**
    - **File:** `src/features/settings/ui/SettingsDialog.module.css:93` (comment only)
    - **Note:** No actual violation; `.groupLabel` uses tokens. Track as false-positive to refine `audit.sh`.

#### P2 — Minor

11. **Emojis used in Theme UI**
    - **Files:** `src/features/theme/ui/ModeCards.tsx:18-20`, `ColorCustomization.tsx:65-66`, `ThemeImportExport.tsx:107`
    - **Current:** Raw emoji characters.
    - **Proposed:** Use `<Icon name="..." />` from `ICON_CATALOG`.

12. **`cardEnter` keyframe uses `4px`**
    - **File:** `src/features/settings/ui/SettingsDialog.module.css:174`
    - **Current:** `transform: translateY(4px);`
    - **Proposed:** `var(--space-1)` or remove for reduced-motion.

13. **`ContrastBadges` opacity not tokenized**
    - **File:** `src/features/theme/ui/ContrastBadges.module.css:41`
    - **Current:** `.ratio { opacity: 0.8; }`
    - **Proposed:** `color: var(--color-text-secondary)`.

14. **Local settings panels share `SettingsDialog.module.css`**
    - **Files:** `src/features/settings/ui/SettingsDialog.module.css` imported by `PronunciationSettingsPanel` and `LocalPronunciationSettingsPanel`.
    - **Proposed:** Give each panel its own module.

15. **`NavItem` collapsed state uses `border-radius: 50%`**
    - **File:** `src/shared/ui/NavItem.module.css:139`
    - **Current:** `border-radius: 50%;`
    - **Proposed:** `var(--radius-full)`.

### 3.4 Universal Panel shared shell

#### P1 — Major

1. **`.panel` mobile reset `border-radius: 0`**
   - **File:** `src/features/universalPanel/UniversalPanel.module.css:95`
   - **Current:** `border-radius: 0;`
   - **Proposed:** `border-radius: var(--radius-none);`.

2. **Bottom nav border hardcoded `1px`**
   - **File:** `src/features/universalPanel/UniversalPanelBottomNav.module.css:11`
   - **Current:** `border-top: 1px solid var(--universal-panel-bottom-nav-border);`
   - **Proposed:** `var(--border-width-hairline)`.

#### P2 — Minor

3. **`.panel` is a non-SSOT wrapper**
   - **File:** `src/features/universalPanel/UniversalPanel.module.css:10`
   - **Current:** `.panel` is a feature-level layout wrapper.
   - **Note:** Acceptable for the panel shell, but should own only layout (not spacing/surface if children do).

---

## 4. Cross-Cutting Themes

1. **Undefined / legacy tokens** — `TtsLanguagePanel` is the worst offender (`cell-*` namespace), followed by `--font-size-xm`, `--border-radius-sm`, `--radius-m3-small`, `--border-radius-md`.
2. **Native form controls** — Card Creator, Dictionary Popup settings, TTS Voice Manager, and Card Creator `FieldRow` all bypass `@/shared/ui` atoms.
3. **Hardcoded `1px` / `2px`** — borders, outlines, text-decoration-thickness, and shadow offsets are still written as literal pixels in multiple files.
4. **Spacing-stack / dead spacing** — `DictionaryPanelView.module.css` (73 spacing declarations), `SettingsDialog.module.css` (31), `TtsVoiceManagerPanel.module.css` (24), `ApiKeyManager.module.css` (25), `StudyModesTab.module.css` (21). Many are legitimate, but several files need leaf→root review.
5. **Non-SSOT wrappers** — `.panel`/`.container`/`.wrapper` classes in `ResourcesPanel`, `ApiKeyManager`, `CardCreatorSettingsPanel`, `DictionaryPopupSettingsPanel`, `MultiSelect`, `ThemePanel`, `TtsLanguagePanel`, `TtsVoiceManagerPanel`.

---

## 5. Roadmap

### Immediate (P0 + quick P1)
1. Rewrite `TtsLanguagePanel.module.css` to current token set.
2. Fix undefined tokens in `DictionaryPanelView`, `PronunciationPanel`, `SettingsDialog`.
3. Remove double padding in `StudyModesTab`.
4. Suppress duplicate Settings header in panel mode.
5. Replace native inputs in `CardCreatorSettingsPanel`, `DictionaryPopupSettingsPanel`, `TtsVoiceManagerPanel`, `FieldRow`.

### Short term (remaining P1)
6. Tokenize `1px`/`2px` borders, outlines, and text-decoration-thickness.
7. Split `CustomModeBuilder` into its own CSS module.
8. Remove nested card surfaces in `ThemePanel`, `TtsVoiceManagerPanel`, `ResourcesPanel`.
9. Audit and clean spacing stacks in the top 4 largest module files.

### Follow-up (P2/P3)
10. Tokenize icon sizes in `StudyModesTab`.
11. Remove emoji in Theme UI.
12. Replace opacity dimming with semantic text colors.
13. Standardize Study Modes breakpoints.
14. Add/adjust shadow tokens for custom shadows.

---

## 6. Files to Modify (in priority order)

- `src/features/tts/ui/TtsLanguagePanel.module.css` (full rewrite)
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`
- `src/features/pronunciation/ui/PronunciationPanel.module.css`
- `src/features/settings/ui/SettingsDialog.module.css`
- `src/features/settings/ui/ApiKeyManager.module.css`
- `src/features/studyModes/ui/StudyModesTab.module.css`
- `src/features/studyModes/ui/CustomModeBuilder.tsx` (+ new module)
- `src/features/universalPanel/UniversalPanel.module.css`
- `src/features/universalPanel/UniversalPanelBottomNav.module.css`
- `src/features/cardCreator/ui/CardCreatorDialog.module.css`
- `src/features/theme/ui/ThemePanel.module.css`
- `src/features/tts/ui/TtsVoiceManagerPanel.module.css`
- `src/features/dictionary/ui/ResourcesPanel.module.css`
- `src/features/settings/ui/SettingsDialogContent.tsx`
- `src/features/universalPanel/tabs/SettingsTab.tsx`
- `src/features/settings/ui/CardCreatorSettingsPanel.tsx`
- `src/features/settings/ui/DictionaryPopupSettingsPanel.tsx`
- `src/features/tts/ui/TtsVoiceManagerPanel.tsx`
- `src/features/cardCreator/ui/FieldRow.tsx`
- `src/features/theme/ui/ModeCards.tsx`, `ColorCustomization.tsx`, `ThemeImportExport.tsx`

---

*Audit report generated with agent tooling. No source files were modified.*
