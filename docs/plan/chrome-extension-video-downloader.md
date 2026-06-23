# Plan: Chrome Extension Video Downloader

> Spec: `docs/spec/chrome-extension-video-downloader.md`
> Intent: `docs/intent/chrome-extension-video-downloader.md`

## Phase 2: Plan — Technical Implementation

### Major Components & Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                        POPUP UI (React)                              │
│  App.tsx                                                             │
│  ├─ components/ (VideoCard, SubtitleItem, ProgressBar, ...)          │
│  ├─ hooks/ (useDetectedMedia, useDownloadProgress, ...)              │
│  └─ store/ (popupStore — Zustand)                                    │
└──────────────┬──────────────────────────────────────────────────────┘
               │ chrome.runtime.sendMessage / port
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND (Service Worker MV3)                   │
│  index.ts                                                            │
│  ├─ networkInterceptor.ts  ← chrome.webRequest                      │
│  ├─ downloader.ts          ← chrome.downloads                       │
│  ├─ messageBus.ts          ← popup ↔ background                     │
│  └─ downloadQueue.ts       ← concurrent (default 3)                 │
└──────────────┬──────────────────────────────────────────────────────┘
               │
       ┌───────┴────────┬─────────────────┐
       ▼                ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   CONTENT    │ │  LIB (pure)  │ │  FFMPEG.WASM │
│  SCRIPT      │ │              │ │  (Offscreen) │
│              │ │  parsers/    │ │              │
│  pageScanner │ │  converters/ │ │  .ts → .mp4  │
│              │ │  detectors/  │ │              │
└──────────────┘ │  downloaders/│ └──────────────┘
                 │  utils/      │
                 └──────────────┘
```

### Component Dependency Graph

| Component | Depends on | Reason |
|---|---|---|
| `types/media.ts`, `types/message.ts` | nothing | Foundation — types cho mọi module |
| `constants/urls.ts`, `constants/messages.ts` | types | Foundation — constants dùng types |
| `lib/parsers/*` | types | Pure logic, parse m3u8/ass/vtt/srt |
| `lib/converters/*` | parsers | Convert dựa trên parsed data |
| `lib/detectors/*` | types, constants | Detect media từ network requests |
| `lib/utils/*` | types | Pure utilities |
| `background/networkInterceptor.ts` | detectors, constants | Intercept network → detect media |
| `background/messageBus.ts` | types, constants | Message passing popup ↔ bg |
| `background/downloadQueue.ts` | types | Queue management (concurrent 3) |
| `background/downloader.ts` | downloadQueue, converters, chrome.downloads | Download + convert + save |
| `content/pageScanner.ts` | detectors | Scan DOM cho media links |
| `popup/store/popupStore.ts` | types | Zustand state |
| `popup/hooks/*` | store, messageBus | React hooks wrap store + messages |
| `popup/components/*` | hooks, types | React components |
| `popup/App.tsx` | components, hooks | Root component |
| `offscreen/ffmpegRunner.ts` | @ffmpeg/ffmpeg | ffmpeg.wasm chạy trong offscreen document (MV3 limitation) |

### Implementation Order

#### Layer 0: Foundation (must be first)

| # | Task | Why first |
|---|---|---|
| 0.1 | Project setup: Vite + @crxjs + React + TS | Mọi thứ khác cần build tool |
| 0.2 | `types/media.ts`, `types/message.ts` | Mọi module đều import types |
| 0.3 | `constants/urls.ts`, `constants/messages.ts` | Mọi module đều import constants |
| 0.4 | `manifest.json` (MV3, permissions) | Extension cần manifest để load |
| 0.5 | Jest + ts-jest + jsdom config | Test infrastructure |
| 0.6 | ESLint + Prettier + tsconfig strict | Code quality baseline |

#### Layer 1: Pure Logic (no Chrome API, dễ unit test)

| # | Task | Depends on | Can parallel? |
|---|---|---|---|
| 1.1 | `lib/parsers/m3u8Parser.ts` + tests | 0.2 | Yes (1.1-1.5 parallel) |
| 1.2 | `lib/parsers/assParser.ts` + tests | 0.2 | Yes |
| 1.3 | `lib/parsers/vttParser.ts` + tests | 0.2 | Yes |
| 1.4 | `lib/parsers/srtParser.ts` + tests | 0.2 | Yes |
| 1.5 | `lib/utils/*` (url, time, file) + tests | 0.2 | Yes |
| 1.6 | `lib/converters/assToSrt.ts` + tests | 1.2 | After 1.2 |
| 1.7 | `lib/converters/vttToSrt.ts` + tests | 1.3 | After 1.3 |
| 1.8 | `lib/converters/segmentMerger.ts` + tests | 1.1 | After 1.1 |
| 1.9 | `lib/detectors/videoDetector.ts` + tests | 0.2, 0.3 | Yes (after 0.2, 0.3) |
| 1.10 | `lib/detectors/subtitleDetector.ts` + tests | 0.2, 0.3 | Yes |

#### Layer 2: Chrome API Wrappers (mock-able)

| # | Task | Depends on | Can parallel? |
|---|---|---|---|
| 2.1 | `background/networkInterceptor.ts` | 1.9, 1.10 | After 1.9, 1.10 |
| 2.2 | `background/messageBus.ts` | 0.2, 0.3 | Yes (after 0.2, 0.3) |
| 2.3 | `background/downloadQueue.ts` | 0.2 | Yes |
| 2.4 | `background/downloader.ts` | 2.3, 1.6, 1.7, 1.8 | After 2.3, 1.6-1.8 |
| 2.5 | `content/pageScanner.ts` | 1.9, 1.10 | After 1.9, 1.10 |
| 2.6 | `offscreen/ffmpegRunner.ts` | @ffmpeg/ffmpeg | Yes (independent) |

#### Layer 3: Popup UI (React)

| # | Task | Depends on | Can parallel? |
|---|---|---|---|
| 3.1 | `popup/store/popupStore.ts` (Zustand) | 0.2 | After 0.2 |
| 3.2 | `popup/hooks/useDetectedMedia.ts` | 2.2, 3.1 | After 2.2, 3.1 |
| 3.3 | `popup/hooks/useDownloadProgress.ts` | 2.2, 3.1 | After 2.2, 3.1 |
| 3.4 | `popup/hooks/useExtensionStatus.ts` | 2.2, 3.1 | After 2.2, 3.1 |
| 3.5 | `popup/components/VideoCard.tsx` + test | 3.2 | After 3.2 |
| 3.6 | `popup/components/SubtitleItem.tsx` + test | 3.2 | After 3.2 |
| 3.7 | `popup/components/ProgressBar.tsx` + test | 3.3 | After 3.3 |
| 3.8 | `popup/components/StatusBadge.tsx` + test | 3.1 | Yes (after 3.1) |
| 3.9 | `popup/components/DownloadButton.tsx` + test | 3.1 | Yes |
| 3.10 | `popup/components/SettingsPanel.tsx` + test | 3.1 | Yes |
| 3.11 | `popup/App.tsx` | 3.5-3.10 | After all components |
| 3.12 | CSS variables + theme (from reference-ui_ux_system.md) | 0.1 | Yes (after 0.1) |

#### Layer 4: Integration

| # | Task | Depends on | Can parallel? |
|---|---|---|---|
| 4.1 | Wire background ↔ popup (messageBus) | 2.2, 3.11 | After 2.2, 3.11 |
| 4.2 | Wire background ↔ offscreen (ffmpeg) | 2.4, 2.6 | After 2.4, 2.6 |
| 4.3 | Wire content script ↔ background | 2.1, 2.5 | After 2.1, 2.5 |
| 4.4 | Settings persistence (chrome.storage.local) | 3.10 | After 3.10 |

#### Layer 5: E2E Tests

| # | Task | Depends on | Can parallel? |
|---|---|---|---|
| 5.1 | Playwright config + extension fixture | 4.1 | After 4.1 |
| 5.2 | E2E hoathinh3d.spec.ts | 5.1 | After 5.1 |
| 5.3 | E2E kisskh.spec.ts | 5.1 | After 5.1 (parallel with 5.2) |

### Risks & Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| **ffmpeg.wasm không chạy trong MV3 service worker** (Wasm cần DOM/Worker) | **HIGH** | Dùng **Offscreen API** (`chrome.offscreen.createDocument`) — MV3 cho phép offscreen document chạy ffmpeg.wasm. Ref: https://developer.chrome.com/docs/extensions/reference/offscreen/ |
| **ffmpeg-core.wasm ~30MB** load chậm | MEDIUM | Bundle local trong `public/ffmpeg/` thay vì CDN. Lazy load chỉ khi user click download. |
| **chrome.webRequest không intercept response body** (chỉ intercept headers) | **HIGH** | Dùng `chrome.debugger` API hoặc `fetch` từ content script để lấy m3u8 content. Hoặc parse DOM trực tiếp. |
| **CSP (Content Security Policy) chặn ffmpeg.wasm** | MEDIUM | Config `content_security_policy.extension` trong manifest cho phép `wasm-unsafe-eval`. Ref: https://developer.chrome.com/docs/extensions/mv3/manifest/sandbox/ |
| **Test sites (hoathinh3d, kisskh) thay đổi DOM/API** | MEDIUM | Detector flexible, không hardcode selector. E2E test dùng try/catch + graceful failure. |
| **.ts segments download chậm/lỗi network** | MEDIUM | Retry logic (3 lần), timeout per segment, progress feedback. |
| **Subtitle sync sai sau convert** | LOW | Unit test với sample .ass/.vtt có timing known. So sánh timing trước/sau. |
| **chrome.storage.local 10MB limit** | LOW | Settings + state < 1MB. Nếu exceed, thêm `unlimitedStorage` permission. |
| **Concurrent downloads gây overload** | LOW | Queue management, default 3, user changeable. |

### Parallel vs Sequential

```
Layer 0 (Sequential — foundation)
    │
    ▼
Layer 1 (Parallel — pure logic, không depend lẫn nhau)
    ├─ 1.1 m3u8Parser    ─┐
    ├─ 1.2 assParser     ─┤
    ├─ 1.3 vttParser     ─┤── All parallel
    ├─ 1.4 srtParser     ─┤
    ├─ 1.5 utils         ─┤
    ├─ 1.9 videoDetector ─┤
    └─ 1.10 subtitleDetector ─┘
         │
         ▼
    1.6 assToSrt (after 1.2)
    1.7 vttToSrt (after 1.3)
    1.8 segmentMerger (after 1.1)
         │
         ▼
Layer 2 (Mixed — Chrome API wrappers)
    ├─ 2.1 networkInterceptor (after 1.9, 1.10)
    ├─ 2.2 messageBus (parallel)
    ├─ 2.3 downloadQueue (parallel)
    ├─ 2.5 pageScanner (after 1.9, 1.10)
    └─ 2.6 ffmpegRunner (parallel, independent)
         │
         ▼
    2.4 downloader (after 2.3, 1.6, 1.7, 1.8)
         │
         ▼
Layer 3 (Parallel — React components)
    ├─ 3.1 store
    ├─ 3.8 StatusBadge (parallel)
    ├─ 3.9 DownloadButton (parallel)
    ├─ 3.10 SettingsPanel (parallel)
    └─ 3.12 CSS theme (parallel)
         │
         ▼
    3.2-3.4 hooks (after 3.1, 2.2)
         │
         ▼
    3.5-3.7 components (after hooks)
         │
         ▼
    3.11 App.tsx (after all components)
         │
         ▼
Layer 4 (Sequential — integration)
    4.1 → 4.2 → 4.3 → 4.4
         │
         ▼
Layer 5 (Parallel — E2E)
    5.1 config
         │
         ▼
    5.2 hoathinh3d ┐
    5.3 kisskh     ┘── Parallel
```

### Verification Checkpoints

| Checkpoint | After layer | Verify bằng | Gate |
|---|---|---|---|
| **CP-0**: Build tool works | Layer 0 | `npm run build` → dist/ có manifest.json + popup.html | Pass build |
| **CP-1**: Pure logic correct | Layer 1 | `npm test -- --coverage` ≥ 80% cho `src/lib/` | Coverage ≥ 80% |
| **CP-2**: Chrome API wrappers work | Layer 2 | Manual load extension → check console service worker | No errors |
| **CP-3**: Popup UI renders | Layer 3 | `npm test` (component tests pass) + manual popup open | UI renders |
| **CP-4**: Integration works | Layer 4 | Manual: vào test site → popup hiện detected media | Media detected |
| **CP-5**: E2E pass | Layer 5 | `npm run test:e2e` → 2 site test pass | 100% E2E pass |

### Critical Path (longest dependency chain)

```
0.1 Project setup
  → 0.2 types
    → 1.1 m3u8Parser
      → 1.8 segmentMerger
        → 2.4 downloader
          → 4.2 wire ffmpeg
            → 4.1 wire popup
              → 3.11 App.tsx
                → 5.1 Playwright config
                  → 5.2 E2E hoathinh3d
```

**Critical path length**: 11 steps. Đây là chuỗi dài nhất, quyết định timeline tổng.

### ffmpeg.wasm trong MV3 — Technical Decision

**Vấn đề**: MV3 service worker không có DOM, không chạy Wasm trực tiếp.

**Giải pháp**: Dùng **Offscreen API**

```typescript
// background/downloader.ts
async function convertTsToMp4(segments: Blob[]): Promise<Blob> {
  // Tạo offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen/ffmpeg.html',
    reasons: ['DOM_PARSER'],
    justification: 'ffmpeg.wasm cần DOM để chạy'
  });

  // Gửi segments tới offscreen, nhận mp4 back
  const mp4 = await chrome.runtime.sendMessage({
    type: 'CONVERT_TS_TO_MP4',
    segments
  });

  // Close offscreen document
  await chrome.offscreen.closeDocument();
  return mp4;
}
```

```typescript
// offscreen/ffmpegRunner.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = new FFmpeg();
await ffmpeg.load({
  corePath: chrome.runtime.getURL('ffmpeg/ffmpeg-core.js')
});

// Listen message từ background
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'CONVERT_TS_TO_MP4') {
    // Write segments to ffmpeg FS
    // Transcode → mp4
    // Return mp4 blob
  }
});
```

**Manifest cần**:
```json
{
  "permissions": ["offscreen"],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "web_accessible_resources": [{
    "resources": ["ffmpeg/ffmpeg-core.js", "ffmpeg/ffmpeg-core.wasm"],
    "matches": ["<all_urls>"]
  }]
}
```

### Network Interception — Technical Decision

**Vấn đề**: `chrome.webRequest` chỉ intercept headers, không đọc response body.

**Giải pháp 1 (preferred)**: Dùng `chrome.debugger` API
- Attach debugger → intercept network → đọc response body
- **Nhược điểm**: Cần `debugger` permission, hiện banner "extension is debugging this browser"

**Giải pháp 2**: Content script + `fetch`
- Content script inject vào page → `fetch` lại URL m3u8/subtitle → parse
- **Nhược điểm**: CORS có thể chặn, cần handle

**Giải pháp 3**: `chrome.webRequest.onBeforeRequest` + URL pattern
- Intercept URL pattern (`.m3u8`, `.ts`, `.ass`, `.vtt`, `.srt`) → store URL
- Content script `fetch` URL đã store → parse content
- **Khuyến nghị**: Dùng giải pháp 3 cho MVP

## Next Step

Phase 3: Tasks — Break plan thành discrete tasks với acceptance criteria + verification.
