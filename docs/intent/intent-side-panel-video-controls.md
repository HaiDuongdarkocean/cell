# Intent — Side Panel Video Controls

> **Giai đoạn**: G0 — Discovery/Ideation
> **Trạng thái**: Confirmed (đã implement + verify)
> **Ngày**: 2026-06-28
> **Parent**: `docs/intent/intent-side-panel-subtitle.md` (out of scope "Playback control từ panel — future phase")

## Problem Statement

Side Panel (ADR-008) hiển thị subtitle cues + sync thời gian, nhưng user không thể điều khiển video từ panel:
1. **Không pause/play được** — phải click vào trang web để pause, mất focus khỏi panel
2. **Không navigate cue được** — hotkeys (a/d/s/w/t) chỉ hoạt động trong content page, không trong panel
3. **Media accumulate across navigation** — khi chuyển episode trong cùng tab, media cũ không clear, gây confusion (11 → 22 media)

## Vision

Mở rộng Side Panel thành **playback controller đầy đủ**:
- **Spacebar** → toggle play/pause (không remappable, luôn Space)
- **All configured hotkeys** (a/d/s/w/t) → điều khiển video từ panel, reuse `handleShortcutKey` pure function
- **Media clear on navigation** — mỗi page load (episode mới) start fresh, không accumulate

## Opportunity

- User không cần rời panel để điều khiển video → UX mượt hơn
- Reuse existing `handleShortcutKey` + `DEFAULT_KEYBOARD_SHORTCUTS` + cue-seeking logic — không code mới cho logic
- Fix media accumulation là root cause fix (clear trong `onTabUpdated` loading), không patch symptom

## Constraints

- Side Panel không có direct access đến `<video>` element — phải relay qua background → content-script
- Hotkeys load từ `chrome.storage.local` (user-configured) — panel phải load async, fallback defaults
- `toggle-panel` action không có ý nghĩa từ trong panel (đã ở trong panel rồi) → no-op

## Out of scope

- Remap Spacebar (luôn Space, không configurable)
- Volume control từ panel
- Fullscreen toggle từ panel
- Seek bằng arrow keys (left/right) — future phase

## References

- `docs/intent/intent-side-panel-subtitle.md` — parent intent (Side Panel subtitle)
- `docs/adr/008-side-panel-subtitle.md` — Side Panel architecture
- `src/content/subtitleShortcuts.ts` — `handleShortcutKey` pure function (reuse)
- `src/constants/config.ts` — `DEFAULT_KEYBOARD_SHORTCUTS` (a/d/s/w/t)
