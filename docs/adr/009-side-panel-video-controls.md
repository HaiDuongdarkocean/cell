# ADR-009: Side Panel Video Controls (Hotkeys + Media Clear)

## Status
Accepted (đã implement + verify)

## Context

ADR-008 (Side Panel Subtitle) hiển thị subtitle cues + sync thời gian, nhưng user không thể điều khiển video từ panel:
1. **Không pause/play** — phải click vào trang web, mất focus khỏi panel
2. **Không navigate cue** — hotkeys (a/d/s/w/t) chỉ hoạt động trong content page
3. **Media accumulate** — `onTabUpdated` loading chỉ reset auto-download guard, không clear media (comment cũ "Media is NOT cleared here")

**Constraints:**
- Side Panel không có direct access đến `<video>` — phải relay qua background → content-script
- `handleShortcutKey` pure function đã export từ `subtitleShortcuts.ts` — reuse không duplicate
- `DEFAULT_KEYBOARD_SHORTCUTS` đã có trong `constants/config.ts`
- Cue-seeking logic đã có trong content-script keydown handler — reuse không duplicate
- `networkInterceptor.clearTab` + `clearSessionMedia` đã có (dùng trong `onTabRemoved`)

**Forces (trade-off):**
- **Relay qua background** vs **direct content-script access**: Side Panel không thể `chrome.tabs.sendMessage` trực tiếp đến content-script của active tab? → Có thể, nhưng background resolve active tab + relay nhất quán với `SEEK_TO` pattern (ADR-008 D1).
- **Reuse `handleShortcutKey`** vs **duplicate logic**: reuse = 1 source of truth, nhưng side panel import từ `content/` layer (cross-layer). Tradeoff acceptable — pure function không side effect.
- **Clear media on navigation** vs **persist across navigation**: persist = user không mất media khi switch tab. Clear = mỗi episode chỉ có media của nó. User requirement: clear.

## Decision

### D1: Relay pattern cho video controls (reuse SEEK_TO)
- Side Panel → `chrome.runtime.sendMessage({ type: 'TOGGLE_PLAY' | 'SHORTCUT_ACTION' })` → Background → `chrome.tabs.sendMessage(tabId, ...)` → Content-script
- Background resolve active tab khi `tabId` missing (reuse `handleSeekTo` pattern)
- Content-script xử lý action (reuse existing cue-seeking + overlay logic)

### D2: Reuse `handleShortcutKey` pure function
- Side Panel import `handleShortcutKey` từ `@/content/subtitleShortcuts`
- Load shortcuts từ `chrome.storage.local` async, fallback `DEFAULT_KEYBOARD_SHORTCUTS`
- Cross-layer import acceptable: pure function, no side effect, 1 source of truth

### D3: Media clear on `onTabUpdated` loading
- `onTabUpdated` loading → `clearTab` + `clearSessionMedia` + `lastCuesByTab.delete` + `updateBadgeForTab`
- Reuse methods đã có (dùng trong `onTabRemoved`) — chỉ thêm 4 dòng vào `onTabUpdated`
- Update comment cũ "Media is NOT cleared here" → "Clear media from previous page"

### D4: `SHORTCUT_ACTION` generic message (1 type cho 4 actions)
- Thay vì 4 message types riêng (PREV_CUE, NEXT_CUE, REPLAY_CUE, TOGGLE_OVERLAY) → 1 `SHORTCUT_ACTION` với `action` payload
- Content-script switch-case xử lý (reuse existing logic)
- `toggle-panel` → no-op (đã ở trong panel)

## Consequences

### Positive
- User điều khiển video từ panel không cần rời panel
- 1 source of truth cho shortcut logic (`handleShortcutKey`)
- 1 source of truth cho cue-seeking logic (content-script)
- Media clear fix là root cause (shared `onTabUpdated`), không patch symptom
- Không dependency mới, không abstraction mới

### Negative
- Cross-layer import: side panel import từ `content/subtitleShortcuts` — nếu layer separation strict, cần extract pure function ra `lib/`. Acceptable now: pure function, no side effect.
- 2 message hops (~10-20ms) cho hotkey — acceptable (< 50ms NFR-1)
- Media clear trên SPA navigation không reload → media biến mất tạm thời → re-detect sau. Acceptable.

### Neutral
- `toggle-panel` từ panel = no-op (by design)

## References
- `docs/adr/008-side-panel-subtitle.md` — parent Side Panel architecture
- `docs/specs/spec-side-panel-video-controls.md` — PRD
- `src/content/subtitleShortcuts.ts` — `handleShortcutKey` (reused)
- `src/background/index.ts` — `handleSeekTo` (pattern reused)
