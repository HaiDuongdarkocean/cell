# Spec: Subtitle Floating Panel + Keyboard Shortcuts

## Overview
Floating panel draggable hiển thị danh sách subtitle cues (bilingual), keyboard shortcuts để navigate, remap trong settings tab.

## Functional Requirements

### FR-1: Bilingual SRT Parser
- Parse SRT với delimiter `\n` giữa target và native language
- Format: target dòng lẻ, native dòng chẵn trong cùng 1 cue text block
- Output: `BilingualCue { index, start, end, targetText, nativeText }`
- Fallback: nếu không có native text, `nativeText = ''`

### FR-2: Floating Panel
- Panel draggable (di chuyển lên xuống bằng mouse drag)
- Default position: bên phải video, top-aligned
- Width: 280px fixed
- Semi-transparent background (rgba(20,20,20,0.85))
- Panel có header (title "Subtitles" + drag handle + close button)
- Panel có body (scrollable cue list)
- Toggle button ngoài panel để show/hide
- Switch position left/right via toggle button

### FR-3: Cue List Item
- Mỗi item: timestamp (clickable → smooth seek) + bilingual text
- Target text: fontSize 14px, color #ffffff (prominent)
- Native text: fontSize 12px, color rgba(255,255,255,0.6) (muted)
- Native text nằm dưới target text
- Current cue: highlighted background (rgba(0,150,255,0.3))
- Auto-scroll current cue into view

### FR-4: Keyboard Shortcuts
- `a` = previous cue (seek to prev cue start)
- `d` = next cue (seek to next cue start)
- `s` = replay current cue (seek to current cue start)
- `w` = toggle subtitle overlay (show/hide overlay text on video)
- `t` = toggle panel (show/hide floating panel)
- Shortcuts chỉ active khi focus trên video area (không interfere với input fields)
- Prevent default browser behavior cho các key này

### FR-5: Smooth Seek
- Click timestamp hoặc shortcut → `video.currentTime = cue.startTime`
- CSS transition trên video cho smooth seek
- Auto-scroll panel đến cue tương ứng

### FR-6: Lazy Load
- Cue list render với IntersectionObserver
- Chỉ render items trong viewport + buffer (5 items above/below)
- Performance: < 100ms cho 100+ cues

### FR-7: Remap Shortcuts
- Settings tab riêng "Shortcuts" trong popup
- Mỗi action có input field để remap key
- Lưu vào `chrome.storage.local` dưới `settings.keyboardShortcuts`
- Default: a/d/s/w/t
- Content script load shortcuts từ storage on init

## Non-Functional Requirements

### NFR-1: Performance
- All interactions < 3s (target < 100ms)
- Panel render < 500ms cho 100 cues
- Shortcut response < 50ms

### NFR-2: Accessibility
- Panel có ARIA labels
- Cue items keyboard navigable (tab + enter)
- Shortcuts không interfere với form inputs

### NFR-3: Browser Compatibility
- Chrome/Edge only (Chrome Extension MV3)
- Desktop only (keyboard shortcuts)

## Acceptance Criteria

### AC-1: Bilingual Parse
- [ ] Parse SRT với bilingual format → BilingualCue[]
- [ ] Parse SRT đơn giản (không native) → nativeText = ''
- [ ] Invalid format → error result

### AC-2: Panel Display
- [ ] Panel hiển thị bên phải video sau khi load subtitle
- [ ] Panel draggable (mouse drag → di chuyển)
- [ ] Toggle button ẩn/hiện panel
- [ ] Switch left/right position

### AC-3: Cue List
- [ ] Mỗi cue item có timestamp + bilingual text
- [ ] Target text prominent, native text muted
- [ ] Current cue highlighted
- [ ] Auto-scroll to current cue

### AC-4: Shortcuts
- [ ] a = prev cue, video seeks
- [ ] d = next cue, video seeks
- [ ] s = replay current cue
- [ ] w = toggle overlay
- [ ] t = toggle panel
- [ ] Shortcuts không hoạt động trong input fields

### AC-5: Smooth Seek
- [ ] Click timestamp → video seeks smoothly
- [ ] Shortcut → video seeks smoothly

### AC-6: Lazy Load
- [ ] 100 cues render < 500ms
- [ ] Only visible items rendered

### AC-7: Remap
- [ ] Settings tab "Shortcuts" hiển thị
- [ ] Remap key → lưu storage
- [ ] Content script load remapped shortcuts

## Data Model

```typescript
interface BilingualCue {
  readonly index: number;
  readonly start: number;   // ms
  readonly end: number;     // ms
  readonly targetText: string;
  readonly nativeText: string;
}

interface KeyboardShortcut {
  readonly action: 'prev-cue' | 'next-cue' | 'replay-cue' | 'toggle-overlay' | 'toggle-panel';
  readonly key: string;
}

// Add to Settings:
readonly keyboardShortcuts: KeyboardShortcut[];
```

## File Impact
- NEW: `src/content/subtitleBilingualParser.ts` — bilingual SRT parser
- NEW: `src/content/subtitlePanel.ts` — floating panel UI
- NEW: `src/content/subtitleShortcuts.ts` — keyboard handler
- MODIFY: `src/content/content-script.ts` — wire panel + shortcuts
- MODIFY: `src/content/subtitleOverlay.ts` — expose cues for panel
- MODIFY: `src/types/media.ts` — add BilingualCue, KeyboardShortcut
- MODIFY: `src/constants/config.ts` — default shortcuts
- MODIFY: `src/popup/components/settings/SettingsDialog.tsx` — shortcuts tab
- NEW: `tests/unit/subtitleOverlay/subtitleBilingualParser.test.ts`
- NEW: `tests/unit/subtitleOverlay/subtitlePanel.test.ts`
- NEW: `tests/unit/subtitleOverlay/subtitleShortcuts.test.ts`
- NEW: `e2e/subtitle-panel-shortcuts.spec.ts`
