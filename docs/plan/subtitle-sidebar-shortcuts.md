# Implementation Plan: Subtitle Floating Panel + Keyboard Shortcuts

## Overview
Floating panel draggable hiển thị danh sách subtitle cues (bilingual target/native), keyboard shortcuts (a/d/s/w/t) để navigate, remap trong settings tab riêng. Lazy load cho performance.

## Architecture Decisions
- **Floating panel** (không sidebar fixed): draggable, absolute trong video parent, không modify page layout
- **Bilingual SRT**: parse delimiter `\n` — target dòng lẻ, native dòng chẵn trong cùng cue text block
- **Keyboard handler**: content script `keydown` listener, check `e.target` không phải input/textarea
- **Settings**: extend `Settings` interface + `keyboardShortcuts` field, lưu `chrome.storage.local`
- **Lazy load**: IntersectionObserver, render buffer 5 items above/below viewport

## Task List

### Phase 1: Foundation (types + parser)
- [ ] Task 1: BilingualCue type + KeyboardShortcut type + default shortcuts
- [ ] Task 2: Bilingual SRT parser (delimiter `\n`, target lẻ/native chẵn)

### Checkpoint: Foundation
- [ ] Unit tests pass cho parser
- [ ] Typecheck pass
- [ ] Build pass

### Phase 2: Core Features (panel + shortcuts)
- [ ] Task 3: Keyboard shortcuts handler (a/d/s/w/t) — pure function, testable
- [ ] Task 4: Floating panel UI (createPanel, draggable, cue list, bilingual layout)
- [ ] Task 5: Smooth seek + auto-scroll current cue + highlight

### Checkpoint: Core Features
- [ ] Panel hiển thị cue list
- [ ] Shortcuts navigate cues
- [ ] Click timestamp → seek
- [ ] MCP browser test pass

### Phase 3: Polish (lazy load + remap + wire)
- [ ] Task 6: Lazy load cue list (IntersectionObserver)
- [ ] Task 7: Settings type + default shortcuts + remap UI tab
- [ ] Task 8: Wire panel + shortcuts vào content-script + controller

### Checkpoint: Complete
- [ ] All acceptance criteria met (spec AC-1 đến AC-7)
- [ ] Playwright E2E pass
- [ ] MCP browser test pass
- [ ] Ready for commit

## Task Details

### Task 1: BilingualCue + KeyboardShortcut types
**Description:** Add types to `src/types/media.ts` + defaults to `src/constants/config.ts`.
**Acceptance criteria:**
- [ ] `BilingualCue` interface: index, start, end, targetText, nativeText
- [ ] `KeyboardShortcut` interface: action, key
- [ ] `ShortcutAction` union type: 'prev-cue' | 'next-cue' | 'replay-cue' | 'toggle-overlay' | 'toggle-panel'
- [ ] Default shortcuts in config.ts: a/d/s/w/t
- [ ] `keyboardShortcuts` field added to `Settings` interface
**Verification:** `npm run typecheck` pass
**Dependencies:** None
**Files:** `src/types/media.ts`, `src/constants/config.ts`
**Scope:** S

### Task 2: Bilingual SRT parser
**Description:** Parse SRT với bilingual format (target dòng lẻ, native dòng chẵn). Reuse `parseSrt` từ `src/lib/parsers/srtParser.ts`, split text block thành target/native.
**Acceptance criteria:**
- [ ] `parseBilingualSrt(content: string): BilingualParseResult` — pure function
- [ ] Bilingual SRT (2 dòng/cue) → targetText + nativeText
- [ ] Single-language SRT (1 dòng/cue) → targetText, nativeText = ''
- [ ] Invalid format → error result
**Verification:** TDD unit test pass (`tests/unit/subtitleOverlay/subtitleBilingualParser.test.ts`)
**Dependencies:** Task 1
**Files:** `src/content/subtitleBilingualParser.ts`, `tests/unit/subtitleOverlay/subtitleBilingualParser.test.ts`
**Scope:** S

### Task 3: Keyboard shortcuts handler
**Description:** Pure function map key → action, guard against input/textarea focus.
**Acceptance criteria:**
- [ ] `handleShortcutKey(key, shortcuts, isActive, target): ShortcutAction | null` — pure function
- [ ] Returns action khi key match + không phải input/textarea
- [ ] Returns null khi focus trong input/textarea
- [ ] Returns null khi key không match
**Verification:** TDD unit test pass (`tests/unit/subtitleOverlay/subtitleShortcuts.test.ts`)
**Dependencies:** Task 1
**Files:** `src/content/subtitleShortcuts.ts`, `tests/unit/subtitleOverlay/subtitleShortcuts.test.ts`
**Scope:** S

### Task 4: Floating panel UI
**Description:** Create draggable panel với cue list. Bilingual layout (target prominent, native muted).
**Acceptance criteria:**
- [ ] `createPanel(video): HTMLDivElement` — panel appended to video parent
- [ ] Panel draggable (mouse drag → di chuyển)
- [ ] `renderCueList(panel, cues)` — render cue items
- [ ] Mỗi item: timestamp (clickable) + target text (14px white) + native text (12px muted)
- [ ] Toggle button outside panel
- [ ] Panel có ARIA labels
**Verification:** TDD unit test pass + MCP browser test
**Dependencies:** Task 1, Task 2
**Files:** `src/content/subtitlePanel.ts`, `tests/unit/subtitleOverlay/subtitlePanel.test.ts`
**Scope:** M

### Task 5: Smooth seek + auto-scroll + highlight
**Description:** Click timestamp/shortcut → smooth seek. Auto-scroll current cue into view. Highlight current cue.
**Acceptance criteria:**
- [ ] `seekToCue(video, cue)` — set currentTime + CSS transition
- [ ] `highlightCue(panel, index)` — highlight current cue background
- [ ] `scrollToCue(panel, index)` — auto-scroll current cue into view
- [ ] Current cue highlighted khi video plays
**Verification:** TDD unit test pass + MCP browser test
**Dependencies:** Task 4
**Files:** `src/content/subtitlePanel.ts` (extend), `tests/unit/subtitleOverlay/subtitlePanel.test.ts` (extend)
**Scope:** S

### Task 6: Lazy load cue list
**Description:** IntersectionObserver, render buffer 5 items above/below viewport.
**Acceptance criteria:**
- [ ] `renderCueListLazy(panel, cues, observer)` — chỉ render visible items
- [ ] IntersectionObserver trigger render thêm khi scroll
- [ ] 100 cues render < 500ms
**Verification:** TDD unit test pass + MCP browser test (performance)
**Dependencies:** Task 4
**Files:** `src/content/subtitlePanel.ts` (extend), `tests/unit/subtitleOverlay/subtitlePanel.test.ts` (extend)
**Scope:** S

### Task 7: Settings remap UI tab
**Description:** Add "Shortcuts" tab to SettingsDialog. Remap key per action, save to chrome.storage.
**Acceptance criteria:**
- [ ] SettingsDialog có tab "Shortcuts"
- [ ] Mỗi action có input field remap key
- [ ] Save → `chrome.storage.local` → `settings.keyboardShortcuts`
- [ ] Content script load shortcuts on init
**Verification:** TDD unit test pass
**Dependencies:** Task 1
**Files:** `src/popup/components/settings/SettingsDialog.tsx`, `src/popup/store/popupStore.ts`
**Scope:** M

### Task 8: Wire all vào content-script
**Description:** Wire panel + shortcuts + lazy load vào content-script + SubtitleOverlayController.
**Acceptance criteria:**
- [ ] Panel hiển thị sau khi load subtitle
- [ ] Shortcuts hoạt động (a/d/s/w/t)
- [ ] Click timestamp → seek
- [ ] Current cue highlighted + auto-scroll
- [ ] Toggle panel (t)
- [ ] Toggle overlay (w)
**Verification:** MCP browser test pass + Playwright E2E pass
**Dependencies:** Task 2, 3, 4, 5, 6, 7
**Files:** `src/content/content-script.ts`, `src/content/subtitleOverlay.ts`
**Scope:** M

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Bilingual SRT format không standard | Med | v1: delimiter `\n`, fallback single-language |
| Panel che video trên small screens | Low | Toggle button ẩn panel |
| Shortcuts interfere với site shortcuts | Med | Check `e.target` không phải input/textarea, chỉ active khi video visible |
| Lazy load complexity | Low | v1: simple IntersectionObserver, fallback render all nếu < 50 cues |

## Open Questions
- Bilingual SRT: delimiter `\n` (1 file) hay dual-file? → v1: delimiter `\n`
- Panel position default: right? → Yes, draggable lên xuống
