# ADR-015: Subtitle Drag Integrated — Xóa Icon Riêng, Drag Trực Tiếp Overlay Background

## Status

Accepted (G4 implemented + G5 verified — browser MCP verify 9/9 SC pass, test report: `docs/test-reports/2026-06-30-subtitle-drag-integrated-mcp.md`)

## Context

ADR-013 (subtitle-appearance-manager) tạo 2 overlay layer độc lập, mỗi layer có 1 drag handle button icon `move-vertical` (position absolute left -28px, `pointer-events: auto`). Drag handle hoạt động tốt (math đã fix qua 3 commit: `952d659` inverted, `cc3fd04` 1:1, `2658688` second-drag), nhưng **icon riêng chiếm chỗ, rối mắt** — user explicitly request xóa icon, tích hợp drag trực tiếp vào overlay.

**Forces (từ spec `docs/specs/spec-subtitle-drag-integrated.md` + review `docs/reviews/review-subtitle-drag-integrated.md`)**:
- UX: icon `move-vertical` riêng rối mắt, overlay subtitle đã là element user tương tác → drag trực tiếp tự nhiên hơn.
- Preserve usecase: text span `user-select: text` + `pointer-events: auto` cho select text + tra cứu từ điển (ADR-005/ADR-007) — **phải giữ nguyên**.
- Drag math đã verify (3 commit fix) — **giữ nguyên**, chỉ thay trigger element.
- `applyStyle` display logic đã fix (commit `986df34`) — **giữ nguyên**.
- Bilingual 2 overlay overlap (target z-index 999999, native 999998) — native drag bị target che ở vùng overlap (acceptable).
- ARIA accessibility: `role="slider"` phải di chuyển từ handle button sang overlay div.

**Constraints (codebase)**:
- `applyStyle` (`subtitleUI.ts:184`) + `createDragHandle` (`subtitleDragPosition.ts:21`) hiện dùng `overlay.querySelector('[role="slider"]')` để tìm handle **as descendant**. `querySelector` không match element chính nó → sau refactor `role="slider"` lên overlay div, querySelector trả `null` → break ARIA update + fallback sai. **CRITICAL trap** (review Risk #1).
- `createOverlayLayer` return `{ overlay, textSpan, dragHandle }` — `dragHandle` field không dùng sau init (`subtitleOverlay.ts:65-67` chỉ dùng `.overlay` + `.textSpan`).
- `setPointerCapture` đã có pattern (`subtitleDragPosition.ts:64`), hoạt động trên div như button.

## Decision

### D1: Drag trigger = overlay background, text span skip qua `e.target === textSpan` check

```typescript
// OLD: handle button nhận pointerdown
handle.addEventListener('pointerdown', onPointerDown);

// NEW: overlay nhận pointerdown, skip nếu target là text span
overlay.addEventListener('pointerdown', (e) => {
  if (e.target === textSpan) return;  // text span giữ select text
  onPointerDown(e);
});
```

- Overlay `pointer-events: auto` (thay `none`) + `cursor: ns-resize` (hover) / `grabbing` (drag).
- Text span `pointer-events: auto` + `user-select: text` giữ nguyên.
- `setPointerCapture(e.pointerId)` trên overlay giữ drag mượt khi pointer qua text span.
- **Rationale**: 1 dòng `e.target === textSpan` check (ponytail rung 6), không cần sửa text span. `stopPropagation` rejected (cần thêm listener trên text span).

### D2: ARIA role=slider di chuyển từ handle button sang overlay div, bỏ querySelector trap

```typescript
// OLD: applyStyle query descendant handle
const handle = overlay.querySelector('[role="slider"]') as HTMLButtonElement | null;
if (handle) handle.setAttribute('aria-valuenow', String(config.yOffsetPercent));

// NEW: set attribute trực tiếp trên overlay
overlay.setAttribute('aria-valuenow', String(config.yOffsetPercent));
```

- `createOverlayLayer`: overlay `setAttribute('role','slider')` + `aria-orientation='vertical'` + `aria-valuemin='0'` + `aria-valuemax='95'` + `aria-valuenow` + `aria-label` per-role (`"Drag to move target subtitle"` / `"Drag to move native subtitle"`).
- `createDragHandle`: bỏ `overlay.querySelector('[role="slider"]')` handle-discovery, wire trực tiếp lên overlay.
- **Rationale**: querySelector không match self → CRITICAL trap. Set attribute trực tiếp an toàn + đơn giản hơn.

### D3: `createOverlayLayer` return `{ overlay, textSpan }` (xóa `dragHandle` field)

```typescript
// OLD
): { overlay: HTMLDivElement; textSpan: HTMLSpanElement; dragHandle: HTMLButtonElement }

// NEW
): { overlay: HTMLDivElement; textSpan: HTMLSpanElement }
```

- Callers (`subtitleOverlay.ts:65-67`) chỉ dùng `.overlay` + `.textSpan` — `dragHandle` dead field sau refactor.
- `MOVE_VERTICAL_SVG` constant → dead code, xóa (grep verify không còn reference).

### D4: Drag math `calcYOffsetPercent` giữ nguyên

- Không thay đổi pure function `calcYOffsetPercent(deltaY, containerHeight, startOffset)` (đã fix inverted/1:1/second-drag).
- Chỉ thay element nhận Pointer Events (handle button → overlay div).
- **Rationale**: Math đã verify qua 3 commit + unit tests. Refactor này chỉ thay UI trigger.

## Consequences

**Positive**:
- UX sạch hơn — không icon rối mắt, drag trực tiếp overlay tự nhiên.
- Code gọn hơn — xóa handle button block (~30 dòng) + `MOVE_VERTICAL_SVG` constant + querySelector handle-discovery.
- ARIA semantics đúng — `role="slider"` trên chính element draggable (overlay), không phải proxy button.
- Text span select text + tra cứu từ điển giữ nguyên (usecase ADR-005/ADR-007).

**Negative**:
- Bilingual overlap: native drag không hoạt động ở vùng bị target che (target z-index 999999 on top). **Acceptable** — native drag ở vùng không che, target on top là default stacking.
- Discoverability giảm nhẹ — không còn icon `move-vertical` explicit, user phải phát hiện qua cursor `ns-resize` khi hover background. Trade-off accepted (interview confirmed: no hint UI ngoài cursor).

**Neutral**:
- 7 unit test trong `subtitleDragPosition.test.ts` rewrite (dispatch trên overlay thay handle, assert `tagName === 'DIV'`, thêm test textSpan skip).
- `subtitleOverlayLayer.test.ts` + `subtitleAppearanceEdgeCases.test.ts` update (assert không còn handle button, ARIA trên overlay).

## Alternatives Considered

### A1: Giữ handle button nhưng ẩn (`display: none`) + drag trên overlay
- **Rejected**: Vẫn còn element thừa trong DOM, ARIA trên element ẩn không reach screen reader hiệu quả, vi phạm goal "xóa icon".

### A2: `stopPropagation` trên text span pointerdown thay `e.target` check
- **Rejected**: Cần thêm event listener trên text span, phức tạp hơn 1 dòng `e.target === textSpan` check trong overlay handler.

### A3: Text span `pointer-events: none` trong lúc drag, restore khi drag end
- **Rejected**: Toggle state phức tạp hơn, `setPointerCapture` đã giải quyết drag-across-text-span mà không cần disable text events.

### A4: Grip dots (⋯) bên trong overlay thay icon riêng
- **Rejected ở interview**: Vẫn có element phụ, không clean bằng drag trực tiếp background.

### A5: Key+drag (Shift/Ctrl + kéo overlay)
- **Rejected ở interview**: Cần discoverability (hint UI), phức tạp hơn drag trực tiếp.

## Verification Plan (G5)

- Unit: `npm run test:unit -- --testPathPatterns=subtitle` all pass.
- Typecheck: `npx tsc --noEmit` exit 0.
- Browser (Edge MCP): drag background → 1:1; select text trên text span; drag qua text span (capture); cursor ns-resize/grabbing; bilingual overlap; fullscreen.
- 9 success criteria (spec §SC) verified.

## Related

- **Supersedes partial**: ADR-013 D4 (drag handle button icon `move-vertical`) — thay bằng drag trực tiếp overlay background. ADR-013 D1-D3, D5-D6 giữ nguyên.
- **Builds on**: commits `952d659` (inverted fix), `986df34` (display fix), `cc3fd04` (1:1 fix), `2658688` (second-drag fix).
- **Spec**: `docs/specs/spec-subtitle-drag-integrated.md`
- **Plan**: `docs/plan/plan-subtitle-drag-integrated.md`
- **Review**: `docs/reviews/review-subtitle-drag-integrated.md` (APPROVED post-update)
