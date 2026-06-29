# Intent: Subtitle Appearance Manager

> **Giai đoạn**: G0 Discovery (output idea-refine + interview-me)
> **Status**: Confirmed — sẵn sàng vào G1 Spec
> **Date**: 2026-06-29

## Problem Statement

> **How Might We**: Làm thế nào để người học ngoại ngữ tùy biến đầy đủ giao diện subtitle overlay (cỡ chữ, màu, bóng chữ, vị trí) cho **target** và **native** subtitle độc lập, trực quan (kéo handle) và tức thì (realtime), mà không phải sửa code mỗi lần?

## Background (ground truth từ codebase)

- `OverlayConfig` type đã có field: `fontSize`, `position` (bottom/top/center), `backgroundColor`, `textColor`, `showTimestamps` — nhưng **hardcoded** trong `DEFAULT_OVERLAY_CONFIG` (`src/content/content-script.ts:69`), comment ghi `"settings wiring is phase 2"`.
- `SettingsDialog.tsx` chỉ có: target language, native language, auto-load toggle. **Không có** appearance/position control.
- `subtitleUI.ts` hiện tạo **1 overlay div chứa 2 span** (target + native chung), position chỉ 3 preset (bottom 10% / top 10% / center), **không drag, không Y-offset numeric**.
- Bilingual layout hardcoded: native = 0.85em, opacity 0.85, marginTop 2px (`subtitleUI.ts:44-53`).
- **Không có**: text shadow, font family, opacity control, drag, persist wiring.

→ Type có sẵn móng, nhưng 0 wiring settings ↔ overlay, 0 drag, 0 shadow, 1 overlay chung.

## Recommended Direction

**Tách 2 overlay độc lập + full appearance control per-overlay + drag handle + realtime persist.**

### Kiến trúc mới (thay đổi lớn)
- Hiện tại: 1 overlay div, 2 span bên trong (target + native chung).
- **Mới**: 2 overlay div độc lập — `targetOverlay` + `nativeOverlay`, mỗi cái:
  - Drag handle riêng (icon SVG `move-vertical` — 2 mũi tên lên/xuống, đúng ngữ cảnh "di chuyển subtitle")
  - Y-position riêng (persist độc lập, drag + numeric input)
  - **Appearance độc lập hoàn toàn**: font size, text color, bg color + alpha, text shadow (color/blur/offset X/Y), font family, text opacity
- Hệ quả: "swap order" (C3) tự động đạt được qua vị trí độc lập — target kéo xuống dưới, native kéo lên trên cùng (ví dụ anh nêu) → không cần field swap riêng.
- "Size ratio" (C2) trở thành per-overlay font size — tự nhiên hơn ratio.

### Scope v1 (confirmed)
**In:**
- 2 overlay độc lập (target + native), mỗi overlay:
  - Font size (slider + input px)
  - Text color (color picker)
  - Background color + alpha (color + opacity slider tách rời)
  - Text shadow (color + blur + offset X/Y)
  - Font family (sans/serif/mono + web-safe)
  - Text opacity
  - Drag handle (icon `move-vertical`) để kéo lên/xuống độc lập
  - Y-offset input (px hoặc %)
  - Horizontal align (left/center/right)
- Native on/off toggle (ẩn/hiện native overlay)
- Live preview trong settings dialog (realtime)
- Persist to chrome.storage + sync xuống content script realtime (debounce ~50ms)
- Reset to defaults (D3)

**Out (Not Doing — v2 hoặc không làm):**
- Preset themes (D4) — v2
- Border radius / padding / line-height fine control — hardcode default đẹp
- Export/import theme JSON — chưa cần
- Custom font upload — security + size, web-safe đủ
- Per-site override profile — 1 global profile đủ
- Max width % control — hardcode 90% (chỉ thêm nếu user nêu)
- C3 swap order field — tự động đạt được qua vị trí độc lập

### Drag handle icon (confirmed requirement)
- Dùng icon SVG `move-vertical` (2 mũi tên lên/xuống) — Lucide `move-vertical` hoặc custom cùng phong cách.
- Lý do: đúng ngữ cảnh "di chuyển subtitle lên/xuống", không phải "grip sắp xếp" (6 chấm).
- Handle là vùng nhỏ riêng ở cạnh overlay, không che text, không xung đột `user-select: text` (text span vẫn select để copy word tra cứu).

## Key Assumptions to Validate

- [ ] **A1**: 2 overlay độc lập không gây layout collision khi kéo cùng vị trí → cần z-index rule + visual feedback khi overlap (vd: handle sáng lên khi gần nhau).
- [ ] **A2**: Drag handle không xung đột `user-select: text` (đang dùng copy word) → handle vùng nhỏ riêng, `pointer-events: auto` chỉ trên handle, text span giữ `user-select: text`.
- [ ] **A3**: Realtime apply qua `chrome.runtime.sendMessage` popup → content script không lag khi kéo slider liên tục → debounce ~50ms + chỉ update style (không recreate overlay).
- [ ] **A4**: 2 overlay độc lập vẫn sync đúng cue qua 2 binary search song song (đã có sẵn `loadBilingualCues` — chỉ tách output ra 2 div thay vì 2 span trong 1 div).
- [ ] **A5**: Persist 2 bộ config (target + native) trong chrome.storage không bloat — ~400 bytes, OK.
- [ ] **A6**: Drag handle trong fullscreen vẫn hoạt động — overlay đã append vào video-wrapper (fullscreen target shared container, ADR đã có), handle cùng container → OK.

## MVP Scope

Minimum để test core assumption (2 overlay độc lập + drag + realtime persist):
1. Refactor `createOverlay` → `createOverlayLayer(role: 'target' | 'native', config)` — 2 div độc lập.
2. Drag handle + Y-position persist cho mỗi overlay.
3. Settings dialog: per-overlay appearance (font size, color, shadow, opacity) + position input.
4. chrome.storage persist + message sync realtime.
5. Live preview trong settings.
6. Reset to defaults.

## Open Questions (cho G1 Spec)

- Q1: Y-offset đơn vị là **px** hay **%** video height? (% responsive hơn khi resize/fullscreen, px chính xác hơn — đề xuất % với step 1%).
- Q2: Text shadow preset (Cinema/Soft/None) hay full control 4 field (color/blur/offsetX/offsetY)? Full control linh hoạt nhưng UI dài — đề xuất 3 preset + 1 "Custom" expand.
- Q3: Font family list cụ thể? Đề xuất: `sans-serif` (system), `serif` (Georgia), `monospace` (Menlo), + 1 CJK-friendly (`Noto Sans JP/CN` qua web font? hay fallback system). Cần check bundle size nếu thêm web font.
- Q4: Khi native off, drag handle native có ẩn không? Đề xuất: ẩn luôn cả overlay native (không chỉ handle).
- Q5: Settings dialog layout — tab (Target / Native) hay scroll dài 2 section? Tab gọn hơn khi per-overlay độc lập.

## Feasibility go/no-go (nhẹ — cuối G0)

- **Build-vs-buy**: Không có lib nào fit — đây là UI tùy biến overlay cho Chrome extension content script, phải tự build. Ponytail rung 1-2: YAGNI? — KHÔNG, user explicitly request + appearance control là gap rõ ràng (hardcoded hiện tại). Reuse codebase? — có, `OverlayConfig` type + `createOverlay` móng có sẵn, refactor không viết lại từ 0.
- **Risk thô**:
  - Refactor 1-overlay → 2-overlay chạm `subtitleOverlay.ts` (orchestrator) + `subtitleUI.ts` + `content-script.ts` — impact radius trung bình, đã có test.
  - Realtime message sync popup ↔ content script — đã có pattern (subtitle cues sync), reuse được.
  - Drag handle trong fullscreen — đã có ADR `fullscreen-target-shared-container.md`, overlay append đúng container → low risk.
- **Recommendation**: **GO** — vào G1 viết spec. Complexity trung bình, móng có sẵn, user request rõ ràng, không có risk chặn.
