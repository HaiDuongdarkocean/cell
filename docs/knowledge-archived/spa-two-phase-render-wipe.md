# SPA two-phase render wipe (learned while fixing kisskh.co overlay injection)

> **Principle**: [Wait for framework render completion before injecting foreign elements](principles.md#wait-for-framework-render-completion-before-injecting-foreign-elements)

## Problem

Extension overlay UI (toggle button ☰, subtitle overlay, import button) biến mất trên
`kisskh.co` (Angular SPA) ngay sau khi content-script init. Debug logs xác nhận tất cả
UI element **đã được append vào DOM** thành công (`hasOverlay: true`,
`hasImportBtn: true`, `toggleInDom: true`), nhưng sau vài giây → `testidCount: 0` →
**tất cả bị remove**.

Trên `themoviebox.org` (direct MP4, không Angular) → overlay UI hoạt động bình thường.

## Root causes

### Angular two-phase render

Angular render `<video>` component **2 giai đoạn**:
- **Phase 1**: Template mount → tạo `<video>` element với `src=""` (chưa có source)
- **Phase 2**: Fetch xong → gán `src="blob:..."` (real source)

### MutationObserver fire during phase 1

Content-script's `findAndInitOverlay` MutationObserver fire khi `<video>` element
xuất hiện (phase 1, src=""). Observer callback chạy **bên trong Zone.js task**
(stack trace confirm: `onInvoke` → `template` → `value`). Extension append foreign
elements (không thuộc Angular template) vào `.videoplayer`. Angular tiếp tục render
trong cùng task → **wipe foreign elements**.

### `setTimeout(0)` không thoát Zone.js

Zone.js wrap `setTimeout` → callback vẫn chạy trong Angular zone → defer 0ms không
giúp. Verified bằng browser: probe append qua `setTimeout(0)` vẫn bị xóa.

## Fix

### `isVideoReady` gate — đợi video có source thực

```typescript
function isVideoReady(v: HTMLVideoElement): boolean {
  return (v.src !== '' && v.src.startsWith('blob:')) || v.readyState >= 2;
}
```

- `blob:` URL = SPA framework render xong (kisskh, HLS.js, mux.js streaming)
- `readyState >= 2` (HAVE_CURRENT_DATA) = direct MP4 sites (themoviebox — không
  framework re-render, readyState đạt 2 ngay)
- Cả 2 signal = video có source thực, framework render done, append safe

### Observer thêm `attributeFilter: ['src']`

```typescript
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src'],
});
```

- `childList` catch phase-1 (element mount) → `isVideoReady` trả false (src="") → skip
- `attributes: ['src']` catch phase-2 (src=blob:) → `isVideoReady` trả true → init
- Không `attributeFilter` → observer miss phase-2 src change → init không bao giờ fire

## Key insight

SPA frameworks (Angular, React, Vue) render dynamic elements trong nhiều phase. Nếu
content-script append foreign elements **during render cycle**, framework wipe chúng
trong re-render tiếp theo. Signal "render done" = element có data thực (blob URL cho
streaming, readyState>=2 cho direct source). `setTimeout` không đủ — Zone.js/React
Concurrent mode wrap timer callbacks.

## Verification (Edge DevTools MCP)

| Test | Site | Kết quả |
|---|---|---|
| Initial mount (blob URL) | kisskh.co Ep2 | toggle/overlay/import persist, testidCount: 6 ✓ |
| Regression (direct MP4) | themoviebox.org | toggle/overlay/import OK, readyState fallback ✓ |
| Edge case A (hover/play-pause) | kisskh.co Ep2 | probe persist 52 checks, 0 loss ✓ |
| Edge case B (episode switch) | kisskh.co Ep1→Ep2 | navigation → re-inject → (d2) chạy lại ✓ |
| `setTimeout(0)` defer | kisskh.co | FAIL — Zone.js wrap, probe bị xóa |
| Probe append sau phase 2 | kisskh.co | persist 15s ✓ |

Unit tests: 1136/1137 pass (1 pre-existing isolation issue). `npx tsc --noEmit`: pass.

## Alternative mechanisms

| Approach | Test | Kết quả |
|---|---|---|
| (a) `setTimeout(0)` defer | browser | FAIL — Zone.js wrap setTimeout |
| (b) Re-init watcher (no disconnect) | — | robust nhưng phức tico, listener leak risk |
| (c) Append `document.body` + fixed position | — | miễn nhiễm nhưng overengineer positioning |
| **(d) `isVideoReady` gate** | browser | **PASS** — 1 helper + 1 condition, generic |

Ponytail: (d) rung thấp nhất (1 helper + attributeFilter), (c) rung cao (overengineer).
