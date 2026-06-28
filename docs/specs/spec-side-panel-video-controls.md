# Spec — Side Panel Video Controls (PRD)

> **Giai đoạn**: G2 — Requirements/Spec
> **Input**: `docs/intent/intent-side-panel-video-controls.md`, `docs/plan/plan-side-panel-video-controls.md`
> **Ngày**: 2026-06-28

## Functional Requirements

### FR-1: Spacebar toggle play/pause
- **When**: User press Space trong side panel (không focus input/textarea/contenteditable)
- **Then**: Video toggle play/pause
- **Message flow**: Side Panel → `TOGGLE_PLAY` → background → `TOGGLE_PLAY` → content-script → `video.play()`/`video.pause()`
- **Side effect**: `VIDEO_PLAY_STATE` relay back → panel update `▶`/`⏸` icon
- **Guard**: `e.preventDefault()` để ngăn page scroll

### FR-2: Hotkeys from side panel
- **When**: User press configured hotkey (a/d/s/w/t) trong side panel
- **Then**: Action thực thi trên video trong content page
- **Actions**:
  - `prev-cue` (a) → seek đến cue trước
  - `next-cue` (d) → seek đến cue kế tiếp
  - `replay-cue` (s) → replay cue hiện tại
  - `toggle-overlay` (w) → show/hide overlay trong content page
  - `toggle-panel` (t) → no-op (đã ở trong panel)
- **Message flow**: Side Panel → `SHORTCUT_ACTION` { action } → background → `SHORTCUT_ACTION` { action } → content-script → cue-seeking / overlay toggle
- **Shortcuts source**: `chrome.storage.local` settings → fallback `DEFAULT_KEYBOARD_SHORTCUTS`
- **Guard**: Skip khi focus trong input/textarea/contenteditable

### FR-3: Media clear on navigation
- **When**: Tab navigate (SPA route change hoặc full reload, `onTabUpdated` `status === 'loading'`)
- **Then**: Media của tab đó clear (videos + subtitles + session storage + cues cache + badge)
- **Scope**: Chỉ clear media của tab đang navigate, không ảnh hưởng tab khác
- **Auto-download guard**: Reset `autoDownloadedTabs` (đã có từ trước)

## Non-Functional Requirements

### NFR-1: Latency
- Hotkey → video action: < 50ms (2 message hops × ~10-20ms)
- Spacebar → play/pause: < 50ms

### NFR-2: Reuse
- Reuse `handleShortcutKey` pure function (không duplicate logic)
- Reuse `DEFAULT_KEYBOARD_SHORTCUTS` (không hardcode)
- Reuse cue-seeking logic trong content-script (không duplicate)
- Reuse `networkInterceptor.clearTab` + `clearSessionMedia` (đã có trong `onTabRemoved`)

### NFR-3: No new dependencies
- Không thêm package mới
- Không abstraction mới

## Acceptance Criteria

### AC-1: Spacebar toggle
- [x] Press Space trong panel (không focus input) → video toggle play/pause
- [x] Panel icon update `▶`/`⏸`
- [x] Press Space trong input → không toggle (input handle space)
- [x] Page không scroll khi press Space

### AC-2: Hotkeys
- [x] Press `a` → seek đến cue trước
- [x] Press `d` → seek đến cue kế tiếp
- [x] Press `s` → replay cue hiện tại
- [x] Press `w` → toggle overlay trong content page
- [x] Press `t` → no-op (không crash)
- [x] User-configured shortcuts (remapped) hoạt động
- [x] Press hotkey trong input → không trigger

### AC-3: Media clear on navigation
- [x] Tab 1 load episode 1 → 11 media detected
- [x] Tab 1 navigate episode 2 → media cũ clear → 11 media mới (không 22)
- [x] Tab 2 (khác) vẫn giữ media riêng
- [x] Badge update sau clear

## Error Cases

| Case | Behavior |
|---|---|
| Content-script chưa inject | `chrome.tabs.sendMessage` throw → background return `{ success: false, error }` |
| No active tab | Background return `{ success: false, error: 'No active tab found' }` |
| `video.play()` blocked (autoplay) | `.catch(() => {})` silent — user click play manually |
| Storage load fail | Fallback `DEFAULT_KEYBOARD_SHORTCUTS` |
| Invalid action | Background return `{ success: false, error: 'Invalid shortcut action' }` |

## Data Flow

```
Spacebar:
  Side Panel keydown → chrome.runtime.sendMessage({ type: 'TOGGLE_PLAY' })
  → Background handleTogglePlay → chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_PLAY' })
  → Content-script → video.play()/video.pause()
  → VIDEO_PLAY_STATE → Background → Side Panel (update icon)

Hotkey (a/d/s/w):
  Side Panel keydown → handleShortcutKey(key, shortcuts, target) → action
  → chrome.runtime.sendMessage({ type: 'SHORTCUT_ACTION', payload: { action } })
  → Background handleShortcutAction → chrome.tabs.sendMessage(tabId, { type: 'SHORTCUT_ACTION', payload: { action } })
  → Content-script → cue-seeking / overlay toggle

Media clear:
  Tab navigate → chrome.tabs.onUpdated (status: 'loading')
  → onTabUpdated → clearTab + clearSessionMedia + lastCuesByTab.delete + updateBadgeForTab
```

## Message Types Added

| Type | Direction | Payload | Handler |
|---|---|---|---|
| `TOGGLE_PLAY` | Panel → BG → CS | `{ tabId? }` | `handleTogglePlay` |
| `SHORTCUT_ACTION` | Panel → BG → CS | `{ tabId?, action }` | `handleShortcutAction` |

## References
- `docs/intent/intent-side-panel-video-controls.md` — intent
- `docs/plan/plan-side-panel-video-controls.md` — feasibility
- `docs/adr/008-side-panel-subtitle.md` — parent Side Panel architecture
- `src/content/subtitleShortcuts.ts` — `handleShortcutKey` (reuse)
- `src/constants/config.ts` — `DEFAULT_KEYBOARD_SHORTCUTS`
