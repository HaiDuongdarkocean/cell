# ADR-012: SPA Two-Phase Render Wipe — Gate Overlay Init on Video Source

## Status
Accepted (đã implement + verify bằng Edge DevTools MCP trên kisskh.co + themoviebox.org)

## Context

Extension overlay UI (toggle button, subtitle overlay, import button) biến mất trên
`kisskh.co` (Angular SPA) ngay sau khi content-script init. Debug logs xác nhận:

1. `findAndInitOverlay` observer tìm thấy `<video>` (src="")
2. `initSubtitleOverlay` chạy → `controller.init` + `createToggleButton` → tất cả
   UI element **đã trong DOM** (logs: `hasOverlay: true`, `hasImportBtn: true`,
   `toggleInDom: true`)
3. Sau vài giây → `testidCount: 0` → **tất cả bị remove**

**Root cause**: Angular render `<video>` component **2 giai đoạn**:
- **Phase 1**: Template mount → tạo `<video>` element với `src=""` (chưa có source)
- **Phase 2**: Fetch xong → gán `src="blob:..."` (real source)

Content-script's MutationObserver fire **during phase 1** (callback chạy bên trong
Zone.js task, stack trace confirm: `onInvoke` → `template` → `value`). Extension
append foreign elements (không thuộc Angular template) vào `.videoplayer`. Angular
tiếp tục render trong cùng task → **wipe foreign elements**.

**Evidence**:
- Probe append **during phase 1** (video src="") → bị xóa (FAIL)
- Probe append **sau phase 2** (video src=blob:) → persist 15s (PASS)
- Probe persist qua hover + play/pause + class change `show-mouse`↔`hide-mouse`
  (52 checks, 0 loss) → Angular **không re-render** sau initial mount
- themoviebox.org (direct MP4, không Angular) → init ngay OK, không wipe

**Constraints:**
- `setTimeout(0)` không thoát Zone.js (Zone.js wrap setTimeout) → defer 0ms FAIL
- `document.body` append (approach c) overengineer — thay đổi positioning + fullscreen
- Re-init watcher (approach b) phức tạp, rủi ro listener leak + re-init loop
- Signal "Angular render xong" phải generic (không Angular-specific API)

## Decision

### D1: `isVideoReady` gate — đợi video có source thực trước khi init

```typescript
function isVideoReady(v: HTMLVideoElement): boolean {
  return (v.src !== '' && v.src.startsWith('blob:')) || v.readyState >= 2;
}
```

- `blob:` URL = SPA framework render xong (kisskh, HLS.js, mux.js streaming)
- `readyState >= 2` (HAVE_CURRENT_DATA) = direct MP4 sites (themoviebox — không
  framework re-render, readyState đạt 2 ngay khi video có data)
- Cả 2 signal = video có source thực, framework render done, append safe

### D2: Observer thêm `attributeFilter: ['src']` catch phase-2 src assignment

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

## Ponytail ceiling
- **Site gán src SAU readyState>=2**: gate pass sớm, nhưng nếu framework re-render
  sau đó → vẫn wipe. Verified kisskh/themoviebox không. Upgrade: combine với
  re-init watcher (approach b) nếu gặp.
- **Site không bao giờ gán src** (video element rỗng placeholder): gate block
  forever → overlay không init. Upgrade: timeout fallback init sau N giây.

## Alternatives considered
- **(a) `setTimeout(0)` defer**: FAIL — Zone.js wrap setTimeout, callback vẫn trong
  Angular render task. Verified bằng browser.
- **(b) Re-init watcher (không disconnect observer)**: robust nhưng phức tạp —
  listener leak, re-init loop risk, cần `controller.destroy()` trước re-init.
  Ponytail: rung cao hơn cần thiết.
- **(c) Append vào `document.body` + position fixed**: miễn immunity framework
  re-render NHƯNG overengineer — thay đổi positioning logic (getBoundingClientRect
  + scroll/resize sync) + fullscreen edge case. Ponytail: overengineer.
- **(d) `isVideoReady` gate (chosen)**: 1 helper + 1 condition + attributeFilter.
  Generic (framework-agnostic), verify pass, ít code nhất. Ponytail: rung thấp nhất.

## Verification (Edge DevTools MCP)
- **kisskh.co Ep2** (Angular SPA, blob URL): toggle/overlay/import persist,
  testidCount: 6. ✓
- **themoviebox.org** (direct MP4, readyState fallback): toggle/overlay/import OK,
  testidCount: 6. ✓ (regression)
- **Edge case A** (hover + play/pause kisskh): probe persist 52 checks, 0 loss. ✓
- **Edge case B** (episode switch kisskh Ep1→Ep2): navigation → content-script
  re-inject → (d2) chạy lại → toggle xuất hiện. ✓
- **Unit tests**: 1136/1137 pass (1 pre-existing `conversionTimer.test.ts`
  isolation issue, không liên quan). ✓
- **`npx tsc --noEmit`**: pass. ✓

## Files changed
- `src/content/content-script.ts`: `isVideoReady` helper + `findAndInitOverlay`
  rewrite (gate condition + `attributeFilter: ['src']`)
- `docs/2-architechture-system.md`: ADR-012 reference (tree line, file table,
  function index — 3 chỗ)
