# UI DRY / SSOT Refactor — Loop Log

## Goal
Refactor UI code in the Cell codebase to preserve correctness, maintainability, updatability, and performance. Approach: discover duplicated UI patterns, extract SSOT components/utilities, verify, and loop until the system has no avoidable duplicate UI code.

## Feature inventory

Major features identified from `docs/2-architechture-system.md` and the codebase:

1. Video Detection — network + DOM scanning for videos and HLS streams
2. Subtitle Discovery — generic pipeline with adapters (HLS, encrypted, JSON, iframe hash, etc.)
3. Subtitle Overlay — shadow-root bilingual subtitle display
4. Player Mode — full-viewport overlay with action dock
5. Split View — side-by-side video + subtitle panel
6. Subtitle Manager Panel — select, load, import, manage subtitles
7. Subtitle Offset Adjustment — offset control with slider/input
8. Subtitle Search — SubDL / OpenSubtitles with key management
9. Subtitle Navigation Cluster — on-screen playback controls
10. Popup UI — detected media, download cards, quick settings
11. Side Panel — cue list, timestamps, seek
12. Video Download — HLS fetch, AES-128, TS→fMP4
13. Subtitle Download — SRT/VTT/ASS/TTML with conversion
14. Download Queue — pause/resume/cancel/retry
15. Auto-Download Whitelist — per-domain auto download
16. Dictionary Popup — orbital badge lookup with media panels
17. Dictionary Import — TXT/JSON/Yomitan/Cambridge/SQLite
18. Phrase Template System — phrase indexing and frequency bands
19. Card Creator — Anki flashcard creation with media capture
20. Universal Panel — Dictionary + Card Creator + Settings tabs
21. Tokenize on Media — page text tokenization with frequency metadata
22. Theme System — light/dark with color generation and import/export
23. Settings Management — settings UI, validation, keyboard shortcuts
24. Design System Showcase — offline component preview
25. Platform-Specific Detection — YouTube/Netflix/iQiyi MAIN-world scripts
26. Text-to-Speech — word/sentence pronunciation

## Loop log

### Loop 1 — Loading spinner SSOT
- **Discovery:** `@keyframes spin` and `.spinner` CSS duplicated in `Button`, `IconButton`, `VideoCard`, `SubtitleCard`, and `MasteryBadge`.
- **Plan:** Replace all `Icon name="loader"` usages with the existing `shared/ui/Spinner`.
- **AC:**
  1. Only one `@keyframes spin` in `src/`, in `Spinner.module.css`.
  2. Loading states keep the same visual size.
  3. Typecheck and build pass.
- **Do:** Replaced loader `Icon` with `Spinner` in 5 components; removed duplicate `@keyframes spin` and `.spinner` CSS.
- **Verify:**
  - `npm run typecheck` ✅
  - `npm run build` ✅
  - `npx vite build --mode development` ✅
  - Relevant unit tests (`Button`, `IconButton`, `MasteryBadge`) ✅
  - Subagent review (agent id `825d6208`) ✅
- **Status:** Complete.

### Loop 2 — Card enter/expand animations SSOT
- **Discovery:** `VideoCard.module.css` and `SubtitleCard.module.css` both contained `@keyframes fade-in` and `@keyframes slide-down`.
- **Plan:** Extract shared card animations into a dedicated CSS module `CardAnimations.module.css` and import its classes in the two card components.
- **AC:**
  1. Single source for `fade-in` and `slide-down` keyframes.
  2. `VideoCard` and `SubtitleCard` apply animation classes from the shared module.
  3. No local keyframes remain in card module CSS.
  4. Build passes and built CSS contains one copy of each keyframe.
- **Do:** Created `src/shared/ui/CardAnimations.module.css`; removed keyframes and `animation:` rules from `VideoCard`/`SubtitleCard` module CSS; applied shared classes in TSX.
- **Verify:**
  - `npm run typecheck` ✅
  - `npm run build` ✅
  - `npx vite build --mode development` ✅
  - Built-CSS grep showed exactly one `fade-in` and one `slide-down` keyframe definition ✅
  - Subagent review (agent id `75ad504a`) ✅
- **Status:** Complete.

### Loop 3 — Empty state SSOT
- **Discovery:** `DictionaryPanelView`, `TranslatePanel`, `LinksPanel` each had their own empty-state markup and CSS; `shared/ui/EmptyState` only had a single large `md` size.
- **Plan:** Extend `EmptyState` with `size` (`md`/`compact`/`sm`) and extra-props passthrough; replace dictionary panel empties; remove duplicate CSS.
- **AC:**
  1. `EmptyState` supports `size` prop and passes `data-*`/extra props to the root.
  2. `DictionaryPanelView`, `TranslatePanel`, `LinksPanel` use `EmptyState`.
  3. No `.cellTranslateEmpty`, `.cellLinksEmpty`, `.cellAudioEmpty`, or visual `.dictionaryEmpty` CSS remains.
  4. Tests and build pass.
- **Do:**
  - Extended `EmptyState` with `size` prop, `HTMLAttributes` passthrough, and compact/sm CSS variants.
  - Added unit tests for size and data attributes.
  - Replaced empty state in `DictionaryPanelView` (compact), `TranslatePanel` (sm), and `LinksPanel` (sm).
  - Removed redundant empty-state CSS blocks from `DictionaryPanelView.module.css`.
- **Verify:**
  - `npm run typecheck` ✅
  - `npm run build` ✅
  - `npx vite build --mode development` ✅
  - Targeted unit tests (`EmptyState`, `DictionaryPanelView`, `TranslatePanel`, `LinksPanel`) ✅
  - Subagent review (agent id `e6cd3503`) ✅
- **Status:** Complete. Future: `ImagePanel` and `CandidateView` empty states remain.

### Loop 4 — Synonym/Antonym chip SSOT
- **Discovery:** `SynonymChip` and `AntonymChip` had nearly identical code and separate CSS modules, only differing by token (`color-success` vs `color-error`).
- **Plan:** Extend `shared/ui/Chip` with a `color` prop (`success`/`error`), convert `SynonymChip` and `AntonymChip` into thin wrappers around `Chip`, delete their CSS modules.
- **AC:**
  1. `Chip` supports `color?: 'success' | 'error'`.
  2. `SynonymChip`/`AntonymChip` render `Chip` with the correct color and no longer have `.module.css` files.
  3. Tests and build pass.
- **Do:**
  - Added `color` prop to `Chip` with `.success`/`.error` styles, hover, focus, and disabled states.
  - Updated `Chip.test.tsx` and `Chip.showcase.tsx`.
  - Replaced `SynonymChip`/`AntonymChip` bodies with `Chip` wrappers and dropped their CSS modules.
- **Verify:**
  - `npm run typecheck` ✅
  - `npm run build` ✅
  - `npx vite build --mode development` ✅
  - Targeted unit tests (`Chip`, `SynonymChip`, `AntonymChip`) ✅
  - Subagent review (agent id `aee8e9f1`) ✅
- **Status:** Complete.

### Loop 5 — Hidden scrollbar SSOT
- **Discovery:** `*.module.css` files repeated the same two declarations (`scrollbar-width: none` + `::-webkit-scrollbar { display: none; }`) in 12 places.
- **Plan:** Create `shared/ui/Scrollable.module.css` with a single `.hide` class and replace every duplicate block with CSS Modules `composes: hide from ...`.
- **AC:**
  1. `Scrollable.module.css` contains only the two hidden-scrollbar rules.
  2. No `scrollbar-width: none` or `::-webkit-scrollbar { display: none; }` remains in other `.module.css` files.
  3. Build and affected tests pass.
- **Do:**
  - Created `src/shared/ui/Scrollable.module.css`.
  - Replaced 12 duplicate blocks across `DictionaryPanelView`, `PopupDictionary`, `SettingsDialog`, and `App.redesigned` module CSS.
- **Verify:**
  - `npm run typecheck` ✅
  - `npm run build` ✅
  - `npx vite build --mode development` ✅
  - Targeted unit tests (`DictionaryPanelView`, `PopupDictionary`, `SettingsDialog`) ✅
  - Subagent review (agent id `87c5eab8`) ✅
- **Status:** Complete.

### Loop 6 — (pending candidates)
- Themed scrollbar CSS in `Dialog`, `Select`, `SearchableSelect`, `MultiSelect`, `QueueSidebar`, `SettingsDialog`.
- Domain chip/badge còn lại (`WordChip`, `SourceBadge`, `FrequencyBadge`, `MasteryBadge`, `StatusBadge`).
- Header / actions layout pattern consolidation.
- Finish remaining empty states (`ImagePanel`, `CandidateView`).

## Loop count / goal check

- **Loops completed:** 5
- **Goal reached?** No — additional duplicate UI patterns remain.
- **Confirmation questions asked to user:** 2 ("continue Loop 3?" on 2026-08-13; "choose Loop 5 candidate?" after Loop 4)
