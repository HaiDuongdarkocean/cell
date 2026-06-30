# Intent: Subtitle Drag Integrated (xóa icon riêng, drag trực tiếp overlay)

> **Giai đoạn**: G0 Discovery (output interview-me)
> **Status**: Confirmed — sẵn sàng vào G1 Spec
> **Date**: 2026-06-30
> **Related**: ADR-013 (subtitle-appearance-manager — tạo drag handle icon riêng), commits `952d659` (fix inverted direction), `986df34` (fix handle shows no subtitle), `cc3fd04` (drag 1:1), `2658688` (second drag from current position)

## Problem Statement

> **How Might We**: Làm thế nào để di chuyển vị trí subtitle overlay (target + native) mà không có icon `move-vertical` riêng chiếm chỗ rối mắt, nhưng vẫn giữ nguyên usecase select text + tra cứu từ điển trên text span?

## Background (ground truth từ codebase)

- `createOverlayLayer` (`src/content/subtitleUI.ts:95-162`) tạo 3 element: overlay div (pointer-events: none) + text span (pointer-events: auto, user-select: text) + drag handle button (icon SVG `move-vertical`, position absolute left -28px, pointer-events: auto).
- `subtitleDragPosition.ts:14-37` `createDragHandle` wire Pointer Events (pointerdown/move/up) trên handle button, dùng `calcYOffsetPercent` (pure) cho math, `setPointerCapture` giữ drag mượt.
- Drag math đã fix (commit `952d659` — inverted direction, `cc3fd04` — 1:1, `2658688` — second drag from current). **Math giữ nguyên**, chỉ thay trigger element.
- Text span `user-select: text` + `cursor: text` + `pointer-events: auto` → user select word → tra cứu từ điển (usecase ADR-005/ADR-007). **Phải giữ nguyên**.
- `applyStyle` (commit `986df34`) chỉ set `display: none` khi `visible: false`, không force `block` → display do `timeupdate` quản lý. **Giữ nguyên**.

## Recommended Direction

**Xóa drag handle button riêng, tích hợp drag vào background overlay. Text span giữ select text + tra cứu.**

### Kiến trúc thay đổi
- **Hiện tại**: overlay (pointer-events: none) + text span (auto, select text) + drag handle button (auto, drag).
- **Mới**: overlay (pointer-events: auto, drag + cursor ns-resize/grabbing) + text span (auto, select text, **stop propagation pointerdown** để không trigger drag overlay).

### Drag trigger area
- **Background only** (padding/border của overlay, không phải text span).
- Text span `pointer-events: auto` + `user-select: text` giữ nguyên. Pointerdown trên text span **không trigger drag** (text span stopPropagation hoặc overlay check `e.target === textSpan`).

### Visual affordance (confirmed interview)
- Hover background overlay → `cursor: ns-resize` (giữ pattern cũ).
- Đang drag → `cursor: grabbing` (native drag affordance, rõ ràng đang kéo).
- Không thêm element UI nào (không grip dots, không hint text).

### Drag across text span (confirmed interview)
- `setPointerCapture` trên overlay giữ drag tiếp tục dù pointer đi qua text span.
- Text span không select được trong lúc drag (pointer captured bởi overlay).
- Drag end → restore cursor ns-resize, text span select text hoạt động lại.

## Scope v1 (confirmed)

**In:**
- Xóa drag handle button (`overlay-${role}-drag-handle`) khỏi `createOverlayLayer`.
- Overlay `pointer-events: auto` + `cursor: ns-resize` (hover) / `grabbing` (dragging).
- Text span `pointer-events: auto` + `user-select: text` + stopPropagation pointerdown (không trigger drag overlay).
- `createDragHandle` refactor → wire Pointer Events trực tiếp lên overlay (thay handle button). Math `calcYOffsetPercent` giữ nguyên.
- ARIA: overlay giữ `role="slider"` + `aria-orientation` + `aria-valuemin/max/now` (di chuyển từ handle button sang overlay div, hoặc giữ trên overlay).
- Update unit tests (`subtitleDragPosition.test.ts`, `subtitleOverlayLayer.test.ts`) — drag trigger từ overlay thay vì handle button.
- Browser verify: drag background → subtitle follow 1:1; select text trên text span → vẫn hoạt động; drag qua text span → drag tiếp tục (capture).

**Out of scope:**
- Không thêm hint UI ngoài cursor (không grip dots, không tooltip).
- Không thay đổi logic select text/tra cứu từ điển.
- Không thay đổi drag math (`calcYOffsetPercent` đã fix).
- Không thay đổi `applyStyle` display logic (commit `986df34`).
- Không thay đổi popup slider `SubtitleStylePanel` (slider value = yOffsetPercent trực tiếp, không liên quan drag handle).

## Feasibility go/no-go (nhẹ)

- **Build-vs-buy**: N/A — refactor nội bộ, không có third-party drag lib (Pointer Events native đủ).
- **Risk thô**:
  - Conflict drag vs select text → giải quyết bằng `e.target === textSpan` check hoặc text span `stopPropagation`. **Low risk** — pattern chuẩn.
  - ARIA migration (handle button → overlay div) → overlay div `role="slider"` hợp lệ. **Low risk**.
  - Touch device (mobile) → Pointer Events đã cover mouse + touch. **No risk**.
- **Recommendation**: **GO** — refactor nhỏ, math giữ nguyên, test coverage có sẵn. Lợi ích UX rõ (xóa icon rối mắt).

## Open questions (resolve ở G1 Spec)

- ARIA: overlay div `role="slider"` có cần `aria-label` riêng per-role (target/native) không? (Hiện handle button có `aria-label="Drag to move subtitle"` — generic, không phân biệt target/native).
- Keyboard accessibility: overlay div `role="slider"` có cần arrow key handler (up/down → ±1% offset) không? (Handle button hiện không có — ponytail v1 skip, ceiling v2).
