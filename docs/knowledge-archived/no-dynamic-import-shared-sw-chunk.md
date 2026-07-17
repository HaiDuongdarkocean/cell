# No dynamic import for modules shared with the SW chunk (learned while fixing themoviebox detection)

> **Principle**: [Avoid dynamic import in code reachable from the service worker chunk](principles.md#avoid-dynamic-import-in-code-reachable-from-the-service-worker-chunk)

## Problem

Sau commit `56cc4f7` (subtitle time offset feature), load extension + vào
`themoviebox.org` → popup không detect được video + subtitle (trống). Content-script
console không có log `[content-script]` nào, overlay UI không inject.

Extension Errors page (`edge://extensions/?errors=<id>`) báo 4 lỗi, trong đó critical:

- `Uncaught ReferenceError: document is not defined`
  tại `assets/modulepreload-polyfill-*.js:1`
- `Service worker registration failed. Status code: 15`
- `Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.`

## Root causes

### Vite injects `modulepreload-polyfill` into any chunk with a dynamic import

Vite's `modulepreload-polyfill` patch (auto-injected) reads `document` to polyfill
`<link rel="modulepreload">` for browsers without native support. Vite injects it
into **any chunk that contains a dynamic `import()`**.

### `settingsStore` is a shared chunk reachable from the SW

`settingsStore` được import bởi:
- Background SW (via `helpers.ts` → `loadSettings`/`saveSettings`)
- Content-script (via `contentScriptController.ts`, `offsetController.ts`, ...)

Vite tách `settingsStore` thành shared chunk để nhiều entry point reuse.

### Dynamic import trong offsetController → polyfill vào shared chunk → SW crash

`offsetController.ts` thêm:
```ts
const { loadSettings } = await import('@/shared/lib/storage/settingsStore');
```

→ Vite inject `modulepreload-polyfill` (dùng `document`) vào shared chunk
`settingsStore-*.js`. SW cũng import chunk này → SW load polyfill →
`ReferenceError: document is not defined` (SW không có `document`) →
**SW registration fail (status 15)** → SW chết.

### Content-script messages fail vì SW chết

Content-script gửi `PAGE_SCAN_RESULT` qua `chrome.runtime.sendMessage` → không có
receiver → "Receiving end does not exist" → background không bao giờ nhận media →
popup trống.

## Fix

Đổi dynamic import → static import trong
`src/features/subtitle/ui/offsetController.ts`:

```ts
// Trước:
import { saveSettings } from '@/shared/lib/storage/settingsStore';
// ...
const { loadSettings } = await import('@/shared/lib/storage/settingsStore');

// Sau:
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
// ...
return loadSettings();
```

Ponytail: `saveSettings` đã static import sẵn → module đã trong bundle → dynamic
import không mang lại lợi ích (không code-split, không lazy). Comment trong file
giải thích lý do để tránh tái phạm.

## Key insight

Trong MV3 extension có nhiều entry point (SW, content-script, popup, sidepanel,
offscreen), **một module có thể nằm trong shared chunk được import bởi cả DOM
context (popup/content) lẫn non-DOM context (SW)**. Dynamic `import()` ở bất kỳ
caller nào → Vite inject `modulepreload-polyfill` (dùng `document`) vào shared
chunk → crash SW (không có `document`).

Rule: với module shared với SW bundle, **luôn static import**. Dynamic import chỉ
an toàn khi module đó KHÔNG reachable từ SW (ví dụ: UI-only module chỉ popup/sidepanel
dùng).

## Verification

- `tsc --noEmit` ✅
- 27 offsetController unit tests ✅
- `npm run build` ✅ — SW bundle (`assets/index.ts-*.js`) không còn reference
  `modulepreload`; `settingsStore-*.js` chunk clean polyfill
- **Browser verify (Edge MCP)**: reinstall extension → reload themoviebox URL →
  SW alive (`sw-18`) → `chrome.storage.session.session_media` có **1 video**
  (`bcdnxw.hakunaymatata.com/...mp4`, Princess Mononoke) + **6 subtitles**
  (ar, fr, en, hi, id, pt — `.srt`) ✅
