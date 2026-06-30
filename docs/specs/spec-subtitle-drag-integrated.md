# Spec: Subtitle Drag Integrated (xóa icon riêng, drag trực tiếp overlay)

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-30
> **Intent source**: `docs/intent/intent-subtitle-drag-integrated.md`
> **Related**: ADR-013 (subtitle-appearance-manager — tạo drag handle icon riêng), commits `952d659` (fix inverted), `986df34` (fix handle shows no subtitle), `cc3fd04` (drag 1:1), `2658688` (second drag from current)

## Objective

Refactor subtitle overlay drag UX: **xóa drag handle button icon `move-vertical` riêng**, tích hợp drag trực tiếp vào **background overlay** (padding/border). Kéo background lên/xuống = move subtitle cùng chiều 1:1. Text span giữ nguyên `user-select: text` + `pointer-events: auto` cho select text + tra cứu từ điển.

**User**: Anh — người học ngoại ngữ xem video với bilingual subtitle overlay, muốn điều chỉnh vị trí subtitle mà không có icon rối mắt.

**Why now**: Icon `move-vertical` riêng (position absolute left -28px) chiếm chỗ, rối mắt. Overlay subtitle đã là element anh tương tác — drag trực tiếp tự nhiên hơn. Drag math đã fix (inverted/1:1/second-drag), chỉ cần thay trigger element.

**Success**:
- Không còn icon `move-vertical` riêng trên UI (xóa `overlay-${role}-drag-handle` button).
- Drag background overlay (padding/border) → subtitle follow 1:1 cùng chiều (lên → lên, xuống → xuống).
- Text span select text + tra cứu từ điển hoạt động bình thường (pointerdown trên text span không trigger drag).
- Drag bắt đầu ở background, kéo pointer qua text span → drag tiếp tục mượt (`setPointerCapture`).
- Cursor: `ns-resize` khi hover background, `grabbing` khi đang drag.
- ARIA: overlay div giữ `role="slider"` + aria orientation/min/max/now (di chuyển từ handle button).
- Unit tests pass (drag trigger từ overlay thay handle button).
- Browser verify: drag + select text + drag across text span.

## Assumptions (surface trước khi spec nội dung)

1. **Drag trigger area = background overlay** (padding/border, không phải text span). Overlay `pointer-events: auto` (thay `none` hiện tại). Text span `pointer-events: auto` + `stopPropagation` trên pointerdown (hoặc overlay check `e.target === textSpan` → skip drag).
2. **Text span giữ nguyên** `user-select: text` + `cursor: text` + `pointer-events: auto`. Select text + tra cứu từ điển không bị ảnh hưởng.
3. **setPointerCapture trên overlay** giữ drag tiếp tục khi pointer đi qua text span. Text span không select được trong lúc drag (pointer captured). Drag end → text span select hoạt động lại.
4. **Cursor**: hover background = `ns-resize` (giữ pattern cũ), đang drag = `grabbing` (native affordance). Không thêm element UI nào (không grip dots, không tooltip).
5. **Drag math giữ nguyên** — `calcYOffsetPercent(deltaY, containerHeight, startOffset)` (pure, đã fix inverted/1:1/second-drag). Chỉ thay element nhận Pointer Events (handle button → overlay div).
6. **ARIA migration**: `role="slider"` + `aria-orientation="vertical"` + `aria-valuemin="0"` + `aria-valuemax="95"` + `aria-valuenow` di chuyển từ handle button sang overlay div. `aria-label` per-role: `"Drag to move target subtitle"` / `"Drag to move native subtitle"` (phân biệt target/native — open question resolve ở spec này).
7. **Keyboard accessibility**: ponytail v1 skip (handle button cũ cũng không có). Ceiling v2: arrow up/down → ±1% offset. Out of scope spec này.
8. **`createDragHandle` refactor** → wire Pointer Events trực tiếp lên overlay (thay handle button). Signature có thể đổi: `createDragHandle(overlay, container, initialOffset, onDrag)` giữ nguyên, nhưng nội dung wire lên overlay thay handle.
9. **`createOverlayLayer` return type** thay đổi: không còn `dragHandle` (button bị xóa). Return `{ overlay, textSpan }` — hoặc giữ `dragHandle` nhưng = overlay div (để backward compat callers). Open question resolve ở spec.
10. **`applyStyle` display logic giữ nguyên** (commit `986df34` — chỉ set `none` khi `!visible`, không force `block`). ARIA `aria-valuenow` update từ handle button sang overlay div.
    - **⚠️ Implementation trap**: `applyStyle` (`subtitleUI.ts:184`) + `createDragHandle` (`subtitleDragPosition.ts:21`) hiện dùng `overlay.querySelector('[role="slider"]')` để tìm handle button **as descendant**. `querySelector` không match element chính nó. Sau refactor `role="slider"` chuyển lên chính overlay div → querySelector trả về `null` → (a) `applyStyle` ngừng update `aria-valuenow`, (b) `createDragHandle` rơi vào fallback branch tạo button mới (sai spec). **Refactor phải đổi thành `overlay.setAttribute('aria-valuenow', ...)` trực tiếp + bỏ querySelector handle-discovery trong `createDragHandle`.**

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (content script)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Testing**: Jest 30 (unit), Edge DevTools MCP (browser verify)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell)
- **No new dependency** — ponytail rung 5: native Pointer Events (đã dùng), không cần drag lib.

## Commands

```bash
Build:            npm run build
Typecheck:        npm run typecheck
Test unit only:   npm run test:unit         # ~3s
Test integration: npm run test:integration
Lint:             npm run lint
Lint fix:         npm run lint:fix
Browser verify:   edge-devtools MCP (install_extension → navigate → evaluate_script)
```

Note: `npm test -- --testPathPattern=` deprecated in jest 30; dùng `--testPathPatterns=`.

## Project Structure (files likely touched)

```
src/
├── content/
│   ├── subtitleUI.ts                  # MODIFY: createOverlayLayer — xóa dragHandle button, overlay pointer-events: auto + cursor ns-resize, ARIA role=slider trên overlay
│   ├── subtitleDragPosition.ts        # MODIFY: createDragHandle — wire Pointer Events lên overlay (thay handle button), cursor grabbing khi drag
│   └── subtitleOverlay.ts             # MODIFY: init() — createDragHandle(overlay, ...) thay (handle, ...); applyStyle ARIA update từ handle sang overlay
tests/
├── unit/
│   ├── subtitleDragPosition.test.ts   # MODIFY: drag trigger từ overlay (thay handle button), pointerdown trên text span không trigger drag
│   ├── subtitleOverlayLayer.test.ts   # MODIFY: assert không còn drag-handle button, overlay có role=slider + cursor ns-resize
│   └── subtitleOverlay/
│       └── subtitleAppearanceEdgeCases.test.ts  # MODIFY: ARIA assertion từ handle sang overlay
```

**Files NOT touched** (intentionally):
- `src/content/content-script.ts` — không thay (controller init flow giữ nguyên, chỉ thay element nhận drag).
- `src/popup/components/settings/SubtitleStylePanel.tsx` — slider value = yOffsetPercent trực tiếp, không liên quan drag handle.
- `src/constants/config.ts` — default settings không đổi.
- `src/types/subtitle.ts` — OverlayStyleConfig không đổi.

## Code Style

Functional components + hooks, named exports, colocate tests, pure functions for logic, TypeScript strict. Ponytail: shortest working diff, no unrequested abstractions, mark simplifications with `ponytail:` comment.

```typescript
// Drag wire lên overlay (thay handle button) — math giữ nguyên
export function createDragHandle(
  overlay: HTMLDivElement,  // was: handle button
  container: HTMLElement,
  initialOffset: number,
  onDrag: (newYOffsetPercent: number) => void,
): HTMLDivElement {  // return overlay (was: handle button)
  // ... wireDrag nội dung giữ nguyên, chỉ thay element
}
```

## Testing Strategy

- **Unit** (`tests/unit/`): Jest 30 + jsdom.
  - `subtitleDragPosition.test.ts`: **7 test rewrite (không phải tweak)** — dispatch pointerdown trên overlay div (thay handle button), assert `tagName === 'DIV'`, thêm test `pointerdown trên textSpan → drag không trigger` (e.target check), setPointerCapture trên overlay, cursor grabbing khi drag.
  - `subtitleOverlayLayer.test.ts`: assert không còn `[data-testid="overlay-${role}-drag-handle"]` button (cả target + native), overlay có `role="slider"` + `cursor: ns-resize`.
  - `subtitleAppearanceEdgeCases.test.ts`: file hiện **không có ARIA assertion trên handle** (chỉ assert display/font/bottom). Verify `[data-testid]` selector vẫn hoạt động sau xóa handle; thêm ARIA assertion trên overlay div nếu cần (aria-valuenow update sau applyStyle).
- **Browser verify** (Edge DevTools MCP): drag background → subtitle follow 1:1; select text trên text span → vẫn hoạt động; drag qua text span → drag tiếp tục (capture); cursor ns-resize hover / grabbing drag.

## Boundaries

- **Always**: Run `npm run test:unit` + `npx tsc --noEmit` before commit. Browser verify (MCP) cho content-script/DOM change. Update `docs/2-architechture-system.md` nếu file structure đổi.
- **Ask first**: Thay đổi `createDragHandle` signature (callers affected). Thay đổi ARIA role trên overlay div (accessibility impact).
- **Never**: Commit secrets. Thay đổi drag math `calcYOffsetPercent` (đã fix, ngoài scope). Thay đổi `applyStyle` display logic (commit `986df34`, ngoài scope). Thay đổi text span `user-select: text` (usecase tra cứu).

## Success Criteria

1. **No icon**: `document.querySelector('[data-testid="overlay-target-drag-handle"]')` AND `document.querySelector('[data-testid="overlay-native-drag-handle"]')` đều returns `null` (cả 2 button bị xóa).
2. **Drag background**: pointerdown trên overlay (không phải text span) + pointermove → `overlay.style.bottom` thay đổi, subtitle follow 1:1.
3. **Select text preserved**: pointerdown trên text span → drag không trigger (overlay `bottom` không đổi), text selection hoạt động (`window.getSelection().toString()` trả text).
4. **Drag across text span**: drag bắt đầu ở background, pointer đi qua text span → drag tiếp tục (overlay `bottom` tiếp tục đổi, không đứt).
5. **Cursor**: hover background overlay → `getComputedStyle(overlay).cursor === 'ns-resize'`; đang drag → `'grabbing'`.
6. **ARIA**: overlay div `getAttribute('role') === 'slider'`, `aria-orientation='vertical'`, `aria-valuemin='0'`, `aria-valuemax='95'`, `aria-valuenow` update sau drag.
7. **Unit tests**: `npm run test:unit -- --testPathPatterns=subtitle` → all pass.
8. **Typecheck**: `npx tsc --noEmit` → exit 0 (cho files touched).
9. **Browser verify**: Edge MCP — drag + select text + drag across text span + cursor check.

## Open Questions (resolved at spec review — spec-reviewer verified)

1. **`createOverlayLayer` return type**: **RESOLVED — xóa field `dragHandle`, return `{ overlay, textSpan }`**. Spec-reviewer verify `subtitleOverlay.ts:65-67` chỉ dùng `.overlay` + `.textSpan`, `dragHandle` không dùng sau init → safe xóa.
2. **Text span drag prevention**: **RESOLVED — `e.target === textSpan` check** trong overlay pointerdown handler (1 dòng, ponytail rung 6, không cần sửa text span).
3. **ARIA `aria-label` per-role**: **RESOLVED — per-role** (`"Drag to move target subtitle"` / `"Drag to move native subtitle"`) — rõ hơn cho screen reader.

## Edge Cases

1. **Bilingual overlap**: target (z-index 999999) + native (999998) overlap khi stacked. Vùng overlap → pointerdown hit target (topmost) → native drag không hoạt động ở vùng bị target che. **Acceptable** — target on top, native drag ở vùng không bị che. Note trong spec, không cần hit-test phức tạp.
2. **Fullscreen**: overlay append vào video-wrapper (fullscreen-safe per `subtitleUI.ts:93`). `setPointerCapture` trên overlay div giữ drag trong fullscreen — verify via Edge MCP fullscreen toggle.
3. **Touch device**: Pointer Events cover mouse + touch, không code riêng.
4. **Pointer capture fail**: try/catch đã có (`subtitleDragPosition.ts:64-68`), drag vẫn hoạt động (document listener fallback).
5. **Drag start trên text span**: `e.target === textSpan` check trong overlay pointerdown handler → skip drag, text selection hoạt động bình thường.
6. **Drag qua text span**: `setPointerCapture` trên overlay giữ drag tiếp tục, text span không select được trong lúc drag (pointer captured), restore khi drag end.

## Out of Scope

- Keyboard accessibility (arrow up/down → ±1% offset) — ceiling v2.
- Hint UI ngoài cursor (grip dots, tooltip) — confirmed out ở interview.
- Drag math change (`calcYOffsetPercent` đã fix).
- `applyStyle` display logic change (commit `986df34`).
- Popup slider `SubtitleStylePanel` change.
- Mobile/touch-specific UX (Pointer Events đã cover).
