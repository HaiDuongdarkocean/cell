# Spec: Chrome Extension Video Downloader

## Objective

Extension Chrome MV3 tự động detect và download video + subtitle từ free streaming sites, convert m3u8→mp4 và subtitle (.ass/.vtt)→srt, đơn giản hóa flow để người học ngoại ngữ tập trung vào học thay vì technical overhead.

### Features (theo tiền tố "Quản lý...")

#### Quản lý phát hiện media (Media Detection)
- Tự động detect video URL dạng m3u8, .ts, mp4 từ network requests
- Tự động detect subtitle URL dạng .ass, .vtt, .srt từ network requests
- Hiển thị danh sách media đã detect trong popup

#### Quản lý chất lượng video (Video Quality)
- Parse m3u8 master playlist để lấy danh sách chất lượng (720p, 1080p, ...)
- Cho user chọn chất lượng video trước khi download
- Mặc định chọn chất lượng cao nhất

#### Quản lý subtitle (Subtitle Management)
- Detect subtitle theo nhiều ngôn ngữ
- Cho user chọn subtitle language nếu có nhiều bản
- Convert .ass → .srt (chấp nhận mất style positioning)
- Convert .vtt → .srt
- Giữ nguyên .srt nếu đã là srt
- Đảm bảo subtitle sync với video sau convert

#### Quản lý tải xuống (Download Management)
- Download video: fetch .ts segments → merge → mp4 (dùng ffmpeg.wasm để transcode nếu cần)
- Download subtitle: convert → srt → save
- Concurrent downloads: mặc định 3, user có thể thay đổi
- Chức năng "Tải tất cả" (download all detected media)
- Queue management: hiện progress cho từng download
- Pause/resume/cancel download (optional, phase 2)

#### Quản lý tiến độ (Progress Management)
- Hiện progress bar cho từng download (0-100%)
- Hiện status: detecting, downloading, converting, done, error
- Hiện progress tổng nếu download nhiều file

#### Quản lý cài đặt (Settings Management)
- Concurrent downloads setting (default 3, user changeable)
- Default video quality setting
- Default subtitle language setting
- Download folder path (nếu Chrome cho phép)
- Lưu settings vào chrome.storage.local

#### Quản lý trạng thái extension (Extension State)
- Active/inactive indicator
- On/off toggle cho media detection
- Badge counter: số media đã detect

### User Stories

- **US-1**: Người học ngoại ngữ cài extension → vào trang xem phim → extension tự động detect video (m3u8/mp4) và subtitle (.ass/.vtt/.srt) → click download → file mp4 + srt lưu về thiết bị.
- **US-2**: Người học muốn xem progress download + conversion trong popup extension.
- **US-3**: Người học muốn chọn chất lượng video nếu có nhiều phiên bản (720p, 1080p).
- **US-4**: Người học muốn chọn subtitle language nếu có nhiều bản.
- **US-5**: Người học muốn download nhiều video cùng lúc (mặc định 3, có thể thay đổi).
- **US-6**: Người học muốn "Tải tất cả" media đã detect trong 1 click.
- **US-7**: Người học muốn tạm dừng/tiếp tục/hủy download.

### Success Criteria

- **SC-1**: Download success 100% cho 2 site test (hoathinh3d, kisskh)
- **SC-2**: Video convert m3u8→mp4 đúng, play được bằng video player phổ biến (VLC, MPC)
- **SC-3**: Subtitle convert .ass/.vtt→srt đúng, sync với video, load được bằng video player
- **SC-4**: Popup UI hiện được: detected videos list, subtitles list, download progress, conversion status
- **SC-5**: Unit test coverage ≥ 80% cho logic core (parser, converter, downloader)
- **SC-6**: E2E test pass cho 2 site test
- **SC-7**: Extension load được vào Chrome không lỗi, không crash

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Build | Vite | 6.x |
| Extension plugin | @crxjs/vite-plugin | 2.x (MV3 support) |
| UI framework | React | 19.x |
| Language | TypeScript | 5.x |
| Unit test | Jest | 29.x |
| Component test | React Testing Library | 16.x |
| E2E test | Playwright | 1.x |
| Debug | Chrome DevTools MCP Server | latest |
| Video conversion | ffmpeg.wasm | 0.12.x |
| Subtitle conversion | JS thuần (parser + writer) | — |
| UI/UX design reference | docs/reference-ui_ux_system.md | internal |

## Dependencies & Installation Sources

### NPM packages (cài qua `npm install`)

| Package | Version | Source | Lệnh cài |
|---|---|---|---|
| vite | ^6.0.0 | https://www.npmjs.com/package/vite | `npm i -D vite` |
| @crxjs/vite-plugin | ^2.0.0-beta | https://crxjs.dev/vite-plugin | `npm i -D @crxjs/vite-plugin` |
| react | ^19.0.0 | https://www.npmjs.com/package/react | `npm i react` |
| react-dom | ^19.0.0 | https://www.npmjs.com/package/react-dom | `npm i react-dom` |
| @types/react | ^19.0.0 | https://www.npmjs.com/package/@types/react | `npm i -D @types/react` |
| @types/react-dom | ^19.0.0 | https://www.npmjs.com/package/@types/react-dom | `npm i -D @types/react-dom` |
| @types/chrome | ^0.0.x | https://www.npmjs.com/package/@types/chrome | `npm i -D @types/chrome` |
| typescript | ^5.7.0 | https://www.npmjs.com/package/typescript | `npm i -D typescript` |
| jest | ^29.7.0 | https://www.npmjs.com/package/jest | `npm i -D jest` |
| ts-jest | ^29.2.0 | https://www.npmjs.com/package/ts-jest | `npm i -D ts-jest` |
| @testing-library/react | ^16.0.0 | https://www.npmjs.com/package/@testing-library/react | `npm i -D @testing-library/react` |
| @testing-library/jest-dom | ^6.6.0 | https://www.npmjs.com/package/@testing-library/jest-dom | `npm i -D @testing-library/jest-dom` |
| jest-environment-jsdom | ^29.7.0 | https://www.npmjs.com/package/jest-environment-jsdom | `npm i -D jest-environment-jsdom` |
| @playwright/test | ^1.49.0 | https://www.npmjs.com/package/@playwright/test | `npm i -D @playwright/test` |
| eslint | ^9.17.0 | https://www.npmjs.com/package/eslint | `npm i -D eslint` |
| @typescript-eslint/parser | ^8.18.0 | https://www.npmjs.com/package/@typescript-eslint/parser | `npm i -D @typescript-eslint/parser` |
| @typescript-eslint/eslint-plugin | ^8.18.0 | https://www.npmjs.com/package/@typescript-eslint/eslint-plugin | `npm i -D @typescript-eslint/eslint-plugin` |
| eslint-plugin-react | ^7.37.0 | https://www.npmjs.com/package/eslint-plugin-react | `npm i -D eslint-plugin-react` |
| eslint-plugin-react-hooks | ^5.1.0 | https://www.npmjs.com/package/eslint-plugin-react-hooks | `npm i -D eslint-plugin-react-hooks` |
| @ffmpeg/ffmpeg | ^0.12.15 | https://www.npmjs.com/package/@ffmpeg/ffmpeg | `npm i @ffmpeg/ffmpeg` |
| @ffmpeg/util | ^0.12.2 | https://www.npmjs.com/package/@ffmpeg/util | `npm i @ffmpeg/util` |
| zustand | ^5.0.0 | https://www.npmjs.com/package/zustand | `npm i zustand` |

### ffmpeg.wasm core files (không qua npm, load runtime)

| File | Source | Cách dùng |
|---|---|---|
| ffmpeg-core.js | https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js | `await loadFFmpeg({ corePath: '...' })` |
| ffmpeg-core.wasm | https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm | Auto-load bởi ffmpeg-core.js |

> **Lưu ý**: ffmpeg.wasm core ~30MB, không bundle vào extension. Load từ CDN (unpkg.com) hoặc bundle local trong `public/ffmpeg/` nếu cần offline.

### Chrome DevTools MCP Server (debug, không cài trong project)

| Tool | Source | Cài đặt |
|---|---|---|
| chrome-devtools-mcp | https://github.com/ChromeDevTools/chrome-devtools-mcp | `npx chrome-devtools-mcp@latest` |
| Docs | https://developer.chrome.com/blog/chrome-devtools-mcp | Reference |

### Fonts (theo UI/UX reference)

| Font | Source | Cách dùng |
|---|---|---|
| Inter | https://fonts.google.com/specimen/Inter | `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` |
| EB Garamond | https://fonts.google.com/specimen/EB+Garamond | `@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap')` |
| JetBrains Mono | https://fonts.google.com/specimen/JetBrains+Mono | `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap')` |

> **Lưu ý**: Extension popup không load external font được do CSP. Bundle font local trong `public/fonts/` hoặc dùng system font fallback.

### Install all (one command)

```bash
# Dev dependencies
npm i -D vite @crxjs/vite-plugin typescript @types/react @types/react-dom @types/chrome \
  jest ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom \
  @playwright/test eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-react eslint-plugin-react-hooks

# Production dependencies
npm i react react-dom @ffmpeg/ffmpeg @ffmpeg/util zustand
```

## Commands

```bash
# Development
npm run dev              # Vite dev mode (HMR cho popup)
npm run build            # Build production extension → dist/
npm run preview          # Preview build

# Test
npm test                 # Run Jest unit tests
npm run test:coverage    # Run Jest với coverage report
npm run test:watch       # Jest watch mode
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Playwright UI mode (debug)

# Lint
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run typecheck        # TypeScript type check

# Load extension vào Chrome (manual)
# 1. chrome://extensions
# 2. Enable Developer mode
# 3. Load unpacked → chọn dist/
```

## Project Structure

```
chrome-extension-video-downloader/
├── docs/                          # Documentation
│   ├── intent/                    # Confirmed intent
│   └── spec/                      # Specs (this file)
├── public/                        # Static assets
│   ├── icons/                     # Extension icons (16, 48, 128px)
│   └── manifest.json              # MV3 manifest
├── src/                           # Application source code
│   ├── background/                # Service worker (MV3)
│   │   ├── index.ts               # Entry point
│   │   ├── networkInterceptor.ts  # chrome.webRequest — detect m3u8/.ts/subtitle
│   │   ├── downloader.ts          # chrome.downloads API
│   │   └── messageBus.ts          # Message passing popup ↔ background
│   ├── content/                   # Content script
│   │   ├── index.ts               # Entry point
│   │   └── pageScanner.ts         # Scan page DOM cho video/subtitle links
│   ├── popup/                     # Popup UI (React)
│   │   ├── index.html             # Popup HTML
│   │   ├── main.tsx               # React entry
│   │   ├── App.tsx                # Root component
│   │   ├── components/            # Reusable components
│   │   │   ├── VideoCard.tsx      # Hiện 1 video detected
│   │   │   ├── SubtitleItem.tsx   # Hiện 1 subtitle detected
│   │   │   ├── ProgressBar.tsx    # Download/conversion progress
│   │   │   ├── StatusBadge.tsx    # Status indicator
│   │   │   └── DownloadButton.tsx # Download trigger
│   │   ├── hooks/                 # Custom hooks
│   │   │   ├── useDetectedMedia.ts    # Subscribe background media list
│   │   │   ├── useDownloadProgress.ts # Track download progress
│   │   │   └── useExtensionStatus.ts  # Extension active/inactive
│   │   ├── store/                 # State management
│   │   │   └── popupStore.ts      # Zustand store (popup state)
│   │   └── styles/                # CSS modules
│   │       └── popup.module.css
│   ├── lib/                       # Shared utilities (pure logic, dễ unit test)
│   │   ├── parsers/               # Parsers
│   │   │   ├── m3u8Parser.ts      # Parse .m3u8 playlist
│   │   │   ├── assParser.ts       # Parse .ass subtitle
│   │   │   ├── vttParser.ts       # Parse .vtt subtitle
│   │   │   └── srtParser.ts       # Parse .srt subtitle
│   │   ├── converters/            # Converters
│   │   │   ├── m3u8ToMp4.ts       # Fetch .ts segments → merge → mp4
│   │   │   ├── assToSrt.ts        # Convert .ass → .srt
│   │   │   ├── vttToSrt.ts        # Convert .vtt → .srt
│   │   │   └── segmentMerger.ts   # Merge .ts segments
│   │   ├── detectors/             # Media detectors
│   │   │   ├── videoDetector.ts   # Detect video URLs từ network
│   │   │   └── subtitleDetector.ts # Detect subtitle URLs
│   │   ├── downloaders/           # Download logic
│   │   │   └── fileDownloader.ts  # chrome.downloads wrapper
│   │   └── utils/                 # Pure utilities
│   │       ├── urlUtils.ts        # URL manipulation
│   │       ├── timeUtils.ts       # Time format conversion
│   │       └── fileUtils.ts       # File name, extension utils
│   ├── types/                     # TypeScript types
│   │   ├── media.ts               # Video, Subtitle, Segment types
│   │   ├── message.ts             # Message passing types
│   │   └── manifest.d.ts          # Chrome extension type augment
│   └── constants/                 # Constants
│       ├── urls.ts                # Test URLs, supported sites
│       └── messages.ts            # Message type constants
├── tests/                         # Unit tests
│   ├── unit/                      # Jest unit tests
│   │   ├── parsers/
│   │   │   ├── m3u8Parser.test.ts
│   │   │   ├── assParser.test.ts
│   │   │   ├── vttParser.test.ts
│   │   │   └── srtParser.test.ts
│   │   ├── converters/
│   │   │   ├── m3u8ToMp4.test.ts
│   │   │   ├── assToSrt.test.ts
│   │   │   └── vttToSrt.test.ts
│   │   ├── detectors/
│   │   │   ├── videoDetector.test.ts
│   │   │   └── subtitleDetector.test.ts
│   │   └── utils/
│   │       ├── urlUtils.test.ts
│   │       └── timeUtils.test.ts
│   └── components/                # React component tests
│       ├── VideoCard.test.tsx
│       ├── SubtitleItem.test.tsx
│       └── ProgressBar.test.tsx
├── e2e/                           # Playwright E2E tests
│   ├── fixtures/                  # Test fixtures
│   │   └── extension.ts           # Load extension vào Playwright
│   ├── hoathinh3d.spec.ts         # Test hoathinh3d
│   └── kisskh.spec.ts             # Test kisskh
├── vite.config.ts                 # Vite config + @crxjs/vite-plugin
├── tsconfig.json                  # TypeScript config
├── jest.config.ts                 # Jest config
├── playwright.config.ts           # Playwright config
├── package.json
└── README.md
```

## Code Style

### UI/UX Design Reference

Toàn bộ UI/UX design **bắt buộc** tham chiếu `docs/reference-ui_ux_system.md` (1264 lines, hệ thống theme Orca).

#### Theme system (từ reference)

| Element | Spec |
|---|---|
| **Light mode** | Cluely — Radiant cloud-native, frosted glass, digital blue accent `#3c83f6` |
| **Dark mode** | Midnight Command Center — subtle translucency, glowing blue/green/violet |
| **CSS variables** | Token-based design system (color, typography, spacing, radius, shadow) |
| **Accessibility** | WCAG AA contrast ratio cho cả 2 mode |
| **Theme switching** | CSS variables → instant switch, không reload |

#### Tokens phải dùng (từ reference)

```css
/* Colors */
--color-primary: #3c83f6;
--color-canvas: #ffffff;
--color-surface: #f3f8ff;
--color-text-primary: #000000;
--color-success: #00ff26;
--color-warning: #f59e0b;
--color-error: #ef4444;

/* Typography */
--font-family-primary: 'Inter', sans-serif;
--font-family-display: 'EB Garamond', serif;
--font-family-mono: 'JetBrains Mono', monospace;
--text-sm: 14px;
--text-base: 16px;

/* Spacing */
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-4: 16px;

/* Radius */
--radius-sm: 4px;
--radius-md: 8px;
```

#### Áp dụng cho extension popup

| Component | Style theo reference |
|---|---|
| Popup container | `--color-canvas` background, `--spacing-4` padding |
| VideoCard | `--color-surface` card, `--radius-md`, subtle shadow |
| StatusBadge | `--color-success/warning/error` theo status |
| ProgressBar | `--color-primary` fill, `--color-surface` track |
| DownloadButton | `--color-primary` bg, `--color-text-inverse` text |
| Typography | `--font-family-primary` (Inter), `--text-sm` cho body |

> **Bắt buộc**: Mọi component phải dùng CSS variables từ reference, không hardcode color/spacing. Theme switching (light/dark) phải work.

### Naming conventions

```typescript
// Files: camelCase cho utils, PascalCase cho components
// src/lib/parsers/m3u8Parser.ts
// src/popup/components/VideoCard.tsx

// Functions: camelCase, verb prefix
export function parseM3u8(content: string): M3u8Playlist { ... }
export function convertAssToSrt(assContent: string): string { ... }
export async function fetchTsSegments(segments: TsSegment[]): Promise<Blob[]> { ... }

// Types: PascalCase
interface M3u8Playlist {
  version: number;
  segments: TsSegment[];
  targetDuration: number;
}

// Constants: UPPER_SNAKE_CASE
export const MESSAGE_TYPES = {
  DETECT_MEDIA: 'DETECT_MEDIA',
  DOWNLOAD_VIDEO: 'DOWNLOAD_VIDEO',
} as const;

// Components: PascalCase, props interface suffix "Props"
interface VideoCardProps {
  video: DetectedVideo;
  onDownload: (videoId: string) => void;
}
export function VideoCard({ video, onDownload }: VideoCardProps): JSX.Element { ... }
```

### Example: Pure logic (dễ unit test)

```typescript
// src/lib/parsers/m3u8Parser.ts
import type { M3u8Playlist, TsSegment } from '../../types/media';

export function parseM3u8(content: string): M3u8Playlist {
  const lines = content.split('\n').map(l => l.trim());
  const segments: TsSegment[] = [];
  let targetDuration = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = parseInt(line.split(':')[1], 10);
    } else if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(':')[1].split(',')[0]);
      const url = lines[i + 1];
      if (url && !url.startsWith('#')) {
        segments.push({ url, duration });
      }
    }
  }

  return { version: 3, segments, targetDuration };
}
```

### Example: React component (dễ test auto)

```typescript
// src/popup/components/VideoCard.tsx
import type { DetectedVideo } from '../../types/media';

interface VideoCardProps {
  video: DetectedVideo;
  onDownload: (videoId: string) => void;
}

export function VideoCard({ video, onDownload }: VideoCardProps): JSX.Element {
  return (
    <div data-testid="video-card" className="video-card">
      <h3 data-testid="video-title">{video.title}</h3>
      <span data-testid="video-quality">{video.quality}</span>
      <button
        data-testid="download-button"
        onClick={() => onDownload(video.id)}
      >
        Download
      </button>
    </div>
  );
}
```

### Key conventions

- **Pure logic tách riêng** trong `src/lib/` — không depend trên Chrome API, dễ unit test
- **Chrome API wrapper** tách riêng — dễ mock trong test
- **`data-testid`** trên mọi interactive element — Playwright select dễ
- **TypeScript strict mode** — no `any`, explicit types
- **ESLint + Prettier** — format tự động

## Testing Strategy

### Test pyramid

```
            ╱╲
           ╱  ╲         E2E (Playwright) — ~5%
          ╱    ╲        Load extension → test 2 sites thật
         ╱──────╲
        ╱        ╲      Integration — ~15%
       ╱          ╲     Component test (React Testing Library)
      ╱────────────╲
     ╱              ╲   Unit (Jest) — ~80%
    ╱                ╲  Parsers, converters, detectors, utils
   ╱──────────────────╲
```

### Framework & locations

| Level | Framework | Location | Coverage |
|---|---|---|---|
| Unit | Jest | `tests/unit/` | ≥ 80% cho `src/lib/` |
| Component | React Testing Library + Jest | `tests/components/` | ≥ 70% cho `src/popup/components/` |
| E2E | Playwright | `e2e/` | 2 site test pass |

### Test data

- **Unit test**: Dùng fixture files (sample .m3u8, .ass, .vtt, .srt) trong `tests/unit/fixtures/`
- **E2E test**: Test thật 2 site:
  - https://hoathinh3d.co/xem-phim-vinh-sinh/tap-1-sv1.html
  - https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816

### Debug

- **Chrome DevTools MCP Server**: inspect popup, service worker console, network trace khi E2E fail
- Ref: https://developer.chrome.com/blog/chrome-devtools-mcp

### What to test

| Module | Test level | What |
|---|---|---|
| `m3u8Parser` | Unit | Parse đúng segments, duration, edge cases (empty, malformed) |
| `assParser` | Unit | Parse đúng dialogue, style, timing |
| `vttParser` | Unit | Parse đúng cue, timing |
| `srtParser` | Unit | Parse đúng cue, timing |
| `assToSrt` | Unit | Convert đúng format, giữ timing |
| `vttToSrt` | Unit | Convert đúng format, giữ timing |
| `m3u8ToMp4` | Unit (mock fetch) | Fetch segments đúng order, merge đúng |
| `videoDetector` | Unit | Detect m3u8/mp4 từ network requests |
| `subtitleDetector` | Unit | Detect .ass/.vtt/.srt từ network requests |
| `VideoCard` | Component | Render đúng title/quality, click download gọi callback |
| `ProgressBar` | Component | Render đúng progress % |
| E2E hoathinh3d | E2E | Load extension → vào site → detect video → download → verify file |
| E2E kisskh | E2E | Load extension → vào site → detect video → download → verify file |

## Boundaries

### Always do

- Run `npm test` trước khi commit
- Run `npm run typecheck` trước khi commit
- Run `npm run lint` trước khi commit
- Follow naming conventions (camelCase functions, PascalCase components/types)
- Validate input trong parsers/converters (handle empty, malformed)
- Thêm `data-testid` cho mọi interactive element
- Tách pure logic khỏi Chrome API wrapper (dễ test)
- Cite Chrome API docs từ developer.chrome.com khi implement

### Ask first

- Thêm dependency mới (npm package)
- Thay đổi manifest permissions
- Thay đổi CI config
- Thay đổi test framework
- Handle site mới ngoài 2 site test

### Never do

- Commit secrets/keys
- Edit `node_modules/` hoặc vendor directories
- Remove failing tests mà không có approval
- Bypass TypeScript strict mode (`any`, `@ts-ignore`)
- Hardcode URL cụ thể trong logic (dùng constants)
- Commit `dist/` build output

## Resolved Questions

1. **ffmpeg.wasm**: Dùng ffmpeg.wasm để transcode .ts → mp4 (đảm bảo play được mọi player)
2. **Subtitle sync**: .ass → .srt chấp nhận mất style positioning, giữ timing sync
3. **Multi-quality video**: Cho user chọn quality, mặc định cao nhất
4. **Concurrent downloads**: Mặc định 3, user có thể thay đổi, có chức năng "Tải tất cả"
5. **Storage limit**: Cần investigate — chrome.storage.local limit 10MB, có thể cần chrome.storage.unlimited permission nếu settings/state vượt limit. Download file đi thẳng chrome.downloads, không lưu storage.

## Open Questions

1. **Storage limit**: Cần test thực tế xem settings + state có vượt 10MB không. Nếu có, thêm `unlimitedStorage` permission vào manifest.

## References

- Intent: `docs/intent/chrome-extension-video-downloader.md`
- **UI/UX Design Reference**: `docs/reference-ui_ux_system.md` (1264 lines, theme system Orca)
- Chrome Extension MV3: https://developer.chrome.com/docs/extensions/mv3/intro/
- chrome.webRequest: https://developer.chrome.com/docs/extensions/reference/webRequest/
- chrome.downloads: https://developer.chrome.com/docs/extensions/reference/downloads/
- chrome.storage.local: https://developer.chrome.com/docs/extensions/reference/storage/
- Chrome DevTools MCP: https://developer.chrome.com/blog/chrome-devtools-mcp
- chrome-devtools-mcp repo: https://github.com/ChromeDevTools/chrome-devtools-mcp
- @crxjs/vite-plugin: https://crxjs.dev/vite-plugin
- ffmpeg.wasm: https://ffmpegwasm.netlify.app/
- @ffmpeg/ffmpeg npm: https://www.npmjs.com/package/@ffmpeg/ffmpeg
- @ffmpeg/core CDN: https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/
- React 19: https://react.dev/
- Vite: https://vite.dev/
- Jest: https://jestjs.io/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright: https://playwright.dev/
- Zustand: https://github.com/pmndrs/zustand
- Inter font: https://fonts.google.com/specimen/Inter
- EB Garamond font: https://fonts.google.com/specimen/EB+Garamond
- JetBrains Mono font: https://fonts.google.com/specimen/JetBrains+Mono
