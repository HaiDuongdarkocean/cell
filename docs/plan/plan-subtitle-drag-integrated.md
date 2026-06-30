# Implementation Plan: Subtitle Drag Integrated

> **Giai đoạn**: G2 Implementation Plan (output planning-and-task-breakdown high-level)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-30
> **Spec source**: `docs/specs/spec-subtitle-drag-integrated.md` (mọi mục cite spec §)
> **Review source**: `docs/reviews/review-subtitle-drag-integrated.md` (APPROVED post-update)
> **Lưu ý**: File này là plan HIGH-LEVEL (approach, risk, milestones). Task list chi tiết chạy ở G4 đầu (sau Spec G1 + Plan G2 + ADR G3).

## Overview

Refactor subtitle overlay drag UX: xóa drag handle button icon `move-vertical` riêng, tích hợp drag trực tiếp vào background overlay. Approach: **single vertical slice** — refactor `createOverlayLayer` (xóa handle button, overlay `pointer-events: auto` + ARIA role=slider) + `createDragHandle` (wire Pointer Events lên overlay thay handle) + `applyStyle` (ARIA update trực tiếp trên overlay, bỏ querySelector) trong 1 pass, rồi update 3 unit test file, rồi browser verify. Refactor nhỏ (3 file source + 3 file test), math `calcYOffsetPercent` giữ nguyên.

## Architecture Decisions (build-vs-buy có cơ sở — cite spec)

### AD1: Drag trigger = overlay background, text span skip qua `e.target` check
- **Decision**: Overlay `pointer-events: auto` + `cursor: ns-resize` (hover) / `grabbing` (drag). Pointerdown handler check `e.target === textSpan` → skip drag (text span giữ select text). `setPointerCapture` trên overlay giữ drag mượt khi pointer qua text span.
- **Rationale** (spec §A1, §A3, Edge Cases #5/#6): 1 dòng check `e.target === textSpan` (ponytail rung 6), không cần sửa text span. `setPointerCapture` đã có pattern trong code hiện tại (`subtitleDragPosition.ts:64`).
- **Build-vs-buy**: Ponytail rung 3-4 (native Pointer Events, đã dùng). Không lib.
- **Alternatives rejected**:
  - `stopPropagation` trên text span pointerdown → cần sửa text span, thêm event listener. `e.target` check gọn hơn.
  - Text span `pointer-events: none` trong lúc drag → phức tạp hơn (toggle state), `setPointerCapture` đã giải quyết.

### AD2: ARIA role=slider di chuyển từ handle button sang overlay div
- **Decision**: Overlay div nhận `role="slider"` + `aria-orientation` + `aria-valuemin/max/now` + `aria-label` per-role (`"Drag to move target subtitle"` / `"Drag to move native subtitle"`). `applyStyle` update `aria-valuenow` trực tiếp trên overlay (`overlay.setAttribute`), **bỏ `overlay.querySelector('[role="slider"]')`** (querySelector không match self — CRITICAL trap từ review).
- **Rationale** (spec §A6, §A10 warning, review Risk #1): querySelector trap sẽ break `applyStyle` + `createDragHandle` fallback branch. Set attribute trực tiếp an toàn + đơn giản hơn.
- **Build-vs-buy**: N/A — native ARIA.
- **Alternatives rejected**:
  - Giữ handle button ẩn + ARIA trên nó → vẫn còn element thừa, vi phạm goal "xóa icon".
  - `aria-hidden` trên overlay + ARIA trên text span → sai semantics (text span là content, không phải slider).

### AD3: `createOverlayLayer` return `{ overlay, textSpan }` (xóa `dragHandle` field)
- **Decision**: Return type bỏ field `dragHandle`. Callers (`subtitleOverlay.ts:65-67`) chỉ dùng `.overlay` + `.textSpan` — `dragHandle` không dùng sau init (review OQ #1 verified).
- **Rationale** (spec §OQ1 resolved, review): Dead field sau refactor, xóa cho clean. Ponytail rung 1 (YAGNI).
- **Build-vs-buy**: N/A.
- **Alternatives rejected**:
  - Giữ `dragHandle = overlay` (backward compat) → dead field, gây nhầm caller nghĩ còn handle.

### AD4: Drag math giữ nguyên (`calcYOffsetPercent`)
- **Decision**: Không thay đổi `calcYOffsetPercent(deltaY, containerHeight, startOffset)` (pure, đã fix inverted/1:1/second-drag). Chỉ thay element nhận Pointer Events.
- **Rationale** (spec §A5, Out of Scope): Math đã verify qua 3 commit fix + unit tests. Refactor này chỉ thay UI trigger, không động logic.
- **Build-vs-buy**: N/A — reuse codebase (ponytail rung 2).

## Approach per Requirement (cite spec §)

| Spec Req | Approach | Cite |
|---|---|---|
| Drag trigger background | `createOverlayLayer`: overlay `pointer-events: auto` + `cursor: ns-resize`. Xóa drag handle button block (lines 124-152). Text span giữ `pointer-events: auto` + `user-select: text`. | §A1, §SC#2 |
| Text span skip drag | `createDragHandle` overlay pointerdown handler: `if (e.target === textSpan) return;` (1 dòng). | §A1, §OQ2, Edge #5 |
| Drag across text span | `setPointerCapture(e.pointerId)` trên overlay (giữ pattern hiện tại). | §A3, Edge #6 |
| Cursor ns-resize → grabbing | Overlay `cursor: ns-resize` mặc định. `onPointerDown` → `overlay.style.cursor = 'grabbing'`. `onPointerUp` → restore `ns-resize`. | §A4, §SC#5 |
| ARIA role=slider trên overlay | `createOverlayLayer`: overlay `setAttribute('role','slider')` + `aria-orientation/min/max/now` + `aria-label` per-role. | §A6, §SC#6 |
| applyStyle ARIA update trực tiếp | `applyStyle`: `overlay.setAttribute('aria-valuenow', ...)` thay `querySelector('[role="slider"]')`. | §A10, review Risk #1 |
| createDragHandle wire overlay | `createDragHandle(overlay, container, initialOffset, onDrag)`: bỏ querySelector handle-discovery, wire trực tiếp lên overlay. | §A8, review Risk #1 |
| createOverlayLayer return | Return `{ overlay, textSpan }` (xóa `dragHandle`). | §OQ1, AD3 |
| Xóa icon | `createOverlayLayer` không tạo `dragHandle` button. `MOVE_VERTICAL_SVG` constant có thể xóa (dead code). | §SC#1 |

## Milestones (high-level — task chi tiết ở G4)

### M1: Refactor source (3 file)
- `src/content/subtitleUI.ts`: `createOverlayLayer` xóa handle button + overlay pointer-events/cursor/ARIA; `applyStyle` ARIA trực tiếp; xóa `MOVE_VERTICAL_SVG` nếu dead.
- `src/content/subtitleDragPosition.ts`: `createDragHandle` wire overlay + `e.target === textSpan` check + cursor grabbing.
- `src/content/subtitleOverlay.ts`: init gọi `createDragHandle(overlay, ...)` thay `(handle, ...)`; return type destructure.

### Checkpoint M1: typecheck + unit test baseline
- `npx tsc --noEmit` exit 0.
- `npm run test:unit -- --testPathPatterns=subtitle` — expect existing tests fail (drag trigger đổi) → M2 fix.

### M2: Update unit tests (3 file)
- `tests/unit/subtitleDragPosition.test.ts`: 7 test rewrite (dispatch trên overlay, assert `tagName === 'DIV'`, thêm test pointerdown trên textSpan skip drag).
- `tests/unit/subtitleOverlayLayer.test.ts`: assert không còn handle button (target + native), overlay có role=slider + cursor ns-resize.
- `tests/unit/subtitleOverlay/subtitleAppearanceEdgeCases.test.ts`: verify `[data-testid]` selector sau xóa handle; ARIA assertion trên overlay nếu cần.

### Checkpoint M2: all unit tests pass
- `npm run test:unit -- --testPathPatterns=subtitle` → all pass.
- `npx tsc --noEmit` exit 0.
- `npm run lint` clean.

### M3: Browser verify (Edge DevTools MCP)
- Install unpacked extension → navigate video page → drag background → subtitle follow 1:1.
- Select text trên text span → `window.getSelection().toString()` trả text.
- Drag qua text span → drag tiếp tục (capture).
- Cursor ns-resize hover / grabbing drag.
- Bilingual overlap: native drag ở vùng không bị target che.
- Fullscreen: drag vẫn hoạt động.

### Checkpoint M3: all success criteria pass
- 9 success criteria (spec §SC) verified.
- Browser test report saved `docs/test-reports/`.

## Risks and Mitigations

| Risk | Severity | Impact | Mitigation |
|---|---|---|---|
| `querySelector('[role="slider"]')` trap (review Risk #1) | CRITICAL | `applyStyle` ngừng update ARIA + `createDragHandle` fallback sai | AD2: set attribute trực tiếp, bỏ querySelector. Test: assert `aria-valuenow` update sau applyStyle. |
| Bilingual overlap native drag blocked (review Risk #2) | HIGH | Native drag không hoạt động ở vùng bị target che | Edge Cases #1: acceptable (target on top). Browser verify M3 check vùng không che. |
| 7 test rewrite lớn hơn tweak (review Risk #4) | MEDIUM | Test rewrite tốn thời gian, có thể miss case | M2 task note rõ rewrite, không phải tweak. Test list: dispatch overlay, tagName DIV, textSpan skip, capture, cursor. |
| `setPointerCapture` trên div (không phải button) trong fullscreen | MEDIUM | Drag có thể đứt trong fullscreen | Edge Cases #2: verify via Edge MCP fullscreen toggle (M3). |
| `MOVE_VERTICAL_SVG` dead code sau xóa handle | LOW | Lint warning unused | M1: xóa constant nếu không còn reference (grep verify). |

## Open Questions

Không còn open question — 3 OQ spec đã resolved ở review (xóa dragHandle field, e.target check, aria-label per-role).

## Parallelization

Refactor nhỏ (3 file source liên quan chặt, 3 file test phụ thuộc source change) → **sequential**, không parallel. M1 → M2 → M3 dependency chain. Tổng 1 session.
