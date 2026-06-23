# Tasks: Chrome Extension Video Downloader

> Plan: `docs/plan/chrome-extension-video-downloader.md`
> Spec: `docs/spec/chrome-extension-video-downloader.md`

## Phase 3: Tasks — Discrete Implementable Units

### Task Format

```markdown
- [ ] Task: [Description]
  - Acceptance: [What must be true when done]
  - Verify: [How to confirm — test command, build, manual check]
  - Files: [Which files will be touched]
```

---

## Layer 0: Foundation

### Task 0.1: Project setup — Vite + @crxjs + React + TypeScript

- [ ] **Task**: Khởi tạo project Vite với @crxjs/vite-plugin, React 19, TypeScript 5, strict mode
- **Acceptance**:
  - `npm run build` tạo `dist/manifest.json` + `dist/popup.html`
  - `npm run dev` chạy Vite dev server không lỗi
  - TypeScript strict mode enabled (`strict: true` trong tsconfig.json)
  - Load `dist/` vào Chrome (`chrome://extensions` → Developer mode → Load unpacked) → popup mở không lỗi
- **Verify**:
  - `npm run build` → exit 0, `dist/manifest.json` tồn tại
  - `npm run typecheck` → exit 0
  - Manual: load extension vào Chrome, click icon → popup mở
- **Files**:
  - `package.json`, `vite.config.ts`, `tsconfig.json`
  - `public/manifest.json`
  - `src/popup/index.html`, `src/popup/main.tsx`, `src/popup/App.tsx` (placeholder)
  - `src/background/index.ts` (placeholder)
  - `.gitignore`

### Task 0.2: Type definitions

- [ ] **Task**: Định nghĩa TypeScript types cho media, message, manifest
- **Acceptance**:
  - `src/types/media.ts` chứa: `DetectedVideo`, `DetectedSubtitle`, `M3u8Playlist`, `TsSegment`, `VideoQuality`, `SubtitleFormat`, `DownloadStatus`, `DownloadItem`, `DownloadProgress`
  - `src/types/message.ts` chứa: `Message`, `MessageRequest`, `MessageResponse`, `MessageType` (union)
  - `src/types/manifest.d.ts` augment Chrome types nếu cần
  - `npm run typecheck` pass
- **Verify**: `npm run typecheck` → exit 0
- **Files**: `src/types/media.ts`, `src/types/message.ts`, `src/types/manifest.d.ts`

### Task 0.3: Constants

- [ ] **Task**: Định nghĩa constants cho URLs, message types, supported formats
- **Acceptance**:
  - `src/constants/urls.ts` chứa: `TEST_SITES` (hoathinh3d, kisskh), `SUPPORTED_VIDEO_FORMATS`, `SUPPORTED_SUBTITLE_FORMATS`
  - `src/constants/messages.ts` chứa: `MESSAGE_TYPES` (DETECT_MEDIA, DOWNLOAD_VIDEO, DOWNLOAD_SUBTITLE, GET_PROGRESS, etc.)
  - `src/constants/config.ts` chứa: `DEFAULT_CONCURRENT_DOWNLOADS` (3), `DEFAULT_QUALITY` ('highest'), `MAX_RETRY` (3)
- **Verify**: `npm run typecheck` → exit 0
- **Files**: `src/constants/urls.ts`, `src/constants/messages.ts`, `src/constants/config.ts`

### Task 0.4: Manifest V3 với permissions

- [ ] **Task**: Cấu hình manifest.json MV3 với permissions cần thiết
- **Acceptance**:
  - `manifest_version: 3`
  - Permissions: `webRequest`, `downloads`, `storage`, `offscreen`, `activeTab`
  - Host permissions: `<all_urls>` (intercept network)
  - `content_security_policy.extension_pages`: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`
  - `web_accessible_resources`: ffmpeg core files
  - Background: service worker (`src/background/index.ts`)
  - Content scripts: match `<all_urls>`, run at `document_idle`
  - Popup: `src/popup/index.html`
  - Icons: 16, 48, 128px
- **Verify**:
  - `npm run build` → `dist/manifest.json` valid
  - Load vào Chrome → no permission errors trong console
- **Files**: `public/manifest.json`, `public/icons/` (placeholder icons)

### Task 0.5: Jest + ts-jest + jsdom config

- [ ] **Task**: Cấu hình Jest với ts-jest, jsdom environment cho component tests
- **Acceptance**:
  - `jest.config.ts` configured với `preset: 'ts-jest'`, `testEnvironment: 'jsdom'`
  - `tests/setup.ts` imports `@testing-library/jest-dom`
  - `npm test` chạy không có test nào → exit 0 (no tests found)
  - `npm run test:coverage` generate coverage report
  - Coverage threshold: 80% cho `src/lib/`, 70% cho `src/popup/components/`
- **Verify**:
  - `npm test` → exit 0
  - `npm run test:coverage` → coverage report generated
- **Files**: `jest.config.ts`, `tests/setup.ts`, `package.json` (test scripts)

### Task 0.6: ESLint + Prettier config

- [ ] **Task**: Cấu hình ESLint 9 + TypeScript ESLint + React + React Hooks plugins
- **Acceptance**:
  - `eslint.config.ts` (flat config) với TypeScript + React rules
  - `npm run lint` → exit 0 (no errors)
  - `npm run lint:fix` → auto-fix pass
  - React hooks rules enabled (`eslint-plugin-react-hooks`)
  - No `any` type allowed (`@typescript-eslint/no-explicit-any: error`)
- **Verify**: `npm run lint` → exit 0
- **Files**: `eslint.config.ts`, `.prettierrc`, `package.json` (lint scripts)

### Checkpoint CP-0: Build tool works

- **Verify**: `npm run build && npm test && npm run lint && npm run typecheck` → all exit 0
- **Gate**: Proceed to Layer 1 only if CP-0 passes

---

## Layer 1: Pure Logic (no Chrome API)

### Task 1.1: m3u8Parser

- [ ] **Task**: Parse .m3u8 playlist content → `M3u8Playlist` object
- **Acceptance**:
  - `parseM3u8(content: string): M3u8Playlist` trả về version, segments[], targetDuration
  - Handle master playlist (multiple qualities) → trả về variants[]
  - Handle media playlist (single quality) → trả về segments[]
  - Edge cases: empty content, malformed lines, missing #EXTINF, relative URLs
  - Unit tests: ≥ 5 test cases (valid, empty, malformed, master, relative URL)
- **Verify**: `npm test -- --testPathPattern=m3u8Parser` → all pass, coverage 100%
- **Files**: `src/lib/parsers/m3u8Parser.ts`, `tests/unit/parsers/m3u8Parser.test.ts`, `tests/unit/fixtures/sample.m3u8`

### Task 1.2: assParser

- [ ] **Task**: Parse .ass subtitle content → structured object
- **Acceptance**:
  - `parseAss(content: string): AssSubtitle` trả về header, styles[], dialogues[]
  - Parse [Script Info], [V4+ Styles], [Events] sections
  - Parse dialogue: Layer, Start, End, Style, Name, Text
  - Parse timing format `H:MM:SS.cc`
  - Edge cases: empty, missing sections, malformed dialogue
  - Unit tests: ≥ 5 test cases
- **Verify**: `npm test -- --testPathPattern=assParser` → all pass
- **Files**: `src/lib/parsers/assParser.ts`, `tests/unit/parsers/assParser.test.ts`, `tests/unit/fixtures/sample.ass`

### Task 1.3: vttParser

- [ ] **Task**: Parse .vtt subtitle content → structured object
- **Acceptance**:
  - `parseVtt(content: string): VttSubtitle` trả về cues[]
  - Parse WEBVTT header, cue ID, timing (`HH:MM:SS.mmm`), cue text
  - Handle cue settings (align, line, position) — ignore cho MVP
  - Edge cases: empty, missing WEBVTT header, malformed timing
  - Unit tests: ≥ 5 test cases
- **Verify**: `npm test -- --testPathPattern=vttParser` → all pass
- **Files**: `src/lib/parsers/vttParser.ts`, `tests/unit/parsers/vttParser.test.ts`, `tests/unit/fixtures/sample.vtt`

### Task 1.4: srtParser

- [ ] **Task**: Parse .srt subtitle content → structured object
- **Acceptance**:
  - `parseSrt(content: string): SrtSubtitle` trả về cues[]
  - Parse cue index, timing (`HH:MM:SS,mmm`), cue text
  - Edge cases: empty, missing index, malformed timing, BOM
  - Unit tests: ≥ 5 test cases
- **Verify**: `npm test -- --testPathPattern=srtParser` → all pass
- **Files**: `src/lib/parsers/srtParser.ts`, `tests/unit/parsers/srtParser.test.ts`, `tests/unit/fixtures/sample.srt`

### Task 1.5: Utils (url, time, file)

- [ ] **Task**: Pure utility functions cho URL, time format, file operations
- **Acceptance**:
  - `urlUtils.ts`: `resolveUrl(base, relative)`, `isAbsoluteUrl(url)`, `getFileExtension(url)`, `normalizeUrl(url)`
  - `timeUtils.ts`: `assTimeToMs(time)`, `vttTimeToMs(time)`, `srtTimeToMs(time)`, `msToSrtTime(ms)`, `msToAssTime(ms)`
  - `fileUtils.ts`: `sanitizeFileName(name)`, `changeExtension(filename, ext)`, `generateFileName(video, subtitle)`
  - Unit tests: ≥ 3 test cases per function
- **Verify**: `npm test -- --testPathPattern=utils` → all pass
- **Files**: `src/lib/utils/urlUtils.ts`, `src/lib/utils/timeUtils.ts`, `src/lib/utils/fileUtils.ts`, `tests/unit/utils/*.test.ts`

### Task 1.6: assToSrt converter

- [ ] **Task**: Convert parsed .ass → .srt string
- **Acceptance**:
  - `convertAssToSrt(assContent: string): string` trả về valid .srt
  - Timing convert: `H:MM:SS.cc` → `HH:MM:SS,mmm`
  - Strip ASS styling tags (`{\an8}`, `{\b1}`, etc.) — giữ plain text
  - Strip drawing commands
  - Keep dialogue text only
  - Sort cues by start time
  - Unit tests: ≥ 3 test cases (basic, with styling, with drawing)
- **Verify**: `npm test -- --testPathPattern=assToSrt` → all pass
- **Files**: `src/lib/converters/assToSrt.ts`, `tests/unit/converters/assToSrt.test.ts`

### Task 1.7: vttToSrt converter

- [ ] **Task**: Convert parsed .vtt → .srt string
- **Acceptance**:
  - `convertVttToSrt(vttContent: string): string` trả về valid .srt
  - Timing convert: `HH:MM:SS.mmm` → `HH:MM:SS,mmm` (dot → comma)
  - Strip WEBVTT header
  - Strip cue settings (align, line, position)
  - Add sequential cue index
  - Unit tests: ≥ 3 test cases
- **Verify**: `npm test -- --testPathPattern=vttToSrt` → all pass
- **Files**: `src/lib/converters/vttToSrt.ts`, `tests/unit/converters/vttToSrt.test.ts`

### Task 1.8: segmentMerger

- [ ] **Task**: Merge .ts segment Blobs → single Blob
- **Acceptance**:
  - `mergeTsSegments(segments: Blob[]): Blob` trả về merged Blob
  - Handle empty array → throw error
  - Handle single segment → return as-is
  - Order preserved
  - Unit tests: ≥ 3 test cases (empty, single, multiple)
- **Verify**: `npm test -- --testPathPattern=segmentMerger` → all pass
- **Files**: `src/lib/converters/segmentMerger.ts`, `tests/unit/converters/segmentMerger.test.ts`

### Task 1.9: videoDetector

- [ ] **Task**: Detect video URLs từ network request objects
- **Acceptance**:
  - `detectVideo(request: NetworkRequest): DetectedVideo | null`
  - Detect URL pattern: `.m3u8`, `.ts`, `.mp4`
  - Extract quality từ URL hoặc m3u8 master playlist
  - Return null nếu không phải video
  - Unit tests: ≥ 5 test cases (m3u8, ts, mp4, non-video, master playlist)
- **Verify**: `npm test -- --testPathPattern=videoDetector` → all pass
- **Files**: `src/lib/detectors/videoDetector.ts`, `tests/unit/detectors/videoDetector.test.ts`

### Task 1.10: subtitleDetector

- [ ] **Task**: Detect subtitle URLs từ network request objects
- **Acceptance**:
  - `detectSubtitle(request: NetworkRequest): DetectedSubtitle | null`
  - Detect URL pattern: `.ass`, `.vtt`, `.srt`
  - Extract language từ URL hoặc filename nếu có
  - Return null nếu không phải subtitle
  - Unit tests: ≥ 5 test cases (ass, vtt, srt, non-subtitle, with language)
- **Verify**: `npm test -- --testPathPattern=subtitleDetector` → all pass
- **Files**: `src/lib/detectors/subtitleDetector.ts`, `tests/unit/detectors/subtitleDetector.test.ts`

### Checkpoint CP-1: Pure logic correct

- **Verify**: `npm run test:coverage` → coverage ≥ 80% cho `src/lib/`
- **Gate**: Proceed to Layer 2 only if CP-1 passes

---

## Layer 2: Chrome API Wrappers

### Task 2.1: networkInterceptor

- [ ] **Task**: Intercept network requests bằng chrome.webRequest, detect media
- **Acceptance**:
  - `NetworkInterceptor` class wrap `chrome.webRequest.onBeforeRequest`
  - Filter URLs theo pattern (`.m3u8`, `.ts`, `.mp4`, `.ass`, `.vtt`, `.srt`)
  - Call `videoDetector` / `subtitleDetector` → store detected media
  - Emit event khi media detected (cho popup subscribe)
  - Handle tab-specific detection (media thuộc tab nào)
- **Verify**:
  - Manual: load extension → vào test site → check service worker console → log detected URLs
  - Unit test: mock `chrome.webRequest`, verify callback called
- **Files**: `src/background/networkInterceptor.ts`, `tests/unit/background/networkInterceptor.test.ts`

### Task 2.2: messageBus

- [ ] **Task**: Message passing giữa popup ↔ background ↔ content script
- **Acceptance**:
  - `MessageBus` class wrap `chrome.runtime.sendMessage` / `onMessage`
  - Typed messages (dùng `MessageRequest`, `MessageResponse` từ types)
  - Support request-response pattern
  - Support event subscription (popup subscribe media detected events)
  - Error handling: message timeout, no response
- **Verify**: Unit test mock `chrome.runtime`, verify send/receive
- **Files**: `src/background/messageBus.ts`, `tests/unit/background/messageBus.test.ts`

### Task 2.3: downloadQueue

- [ ] **Task**: Queue management cho concurrent downloads (default 3)
- **Acceptance**:
  - `DownloadQueue` class manage download items
  - Max concurrent: configurable (default 3)
  - States: queued, downloading, converting, done, error, cancelled
  - Methods: `add(item)`, `cancel(id)`, `pause(id)`, `resume(id)`, `getAll()`, `getById(id)`
  - Emit progress events
  - "Download all" method: add multiple items, queue handles concurrency
- **Verify**: Unit test với mock timers, verify concurrency limit
- **Files**: `src/background/downloadQueue.ts`, `tests/unit/background/downloadQueue.test.ts`

### Task 2.4: downloader

- [ ] **Task**: Download + convert + save media file
- **Acceptance**:
  - `Downloader` class orchestrate: fetch segments → merge → ffmpeg convert → chrome.downloads
  - For m3u8: parse playlist → fetch all .ts segments → merge → ffmpeg.wasm transcode → mp4
  - For mp4: fetch directly → save
  - For subtitle: fetch → convert (if needed) → save as .srt
  - Progress callback: report % per segment / per file
  - Retry logic: 3 retries per segment on network error
  - Timeout: 30s per segment
- **Verify**:
  - Unit test: mock fetch + ffmpeg + chrome.downloads, verify flow
  - Manual: download 1 video từ test site → verify file saved
- **Files**: `src/background/downloader.ts`, `tests/unit/background/downloader.test.ts`

### Task 2.5: pageScanner (content script)

- [ ] **Task**: Content script scan page DOM cho video/subtitle links
- **Acceptance**:
  - `PageScanner` class scan `<video>`, `<source>`, `<track>` tags
  - Extract src URLs
  - Send detected URLs to background via messageBus
  - Run on page load + on DOM mutation (MutationObserver)
  - Handle dynamically loaded content (SPA)
- **Verify**:
  - Manual: vào test site → check content script console → log scanned URLs
  - Unit test: mock DOM, verify scan logic
- **Files**: `src/content/pageScanner.ts`, `src/content/index.ts`, `tests/unit/content/pageScanner.test.ts`

### Task 2.6: ffmpegRunner (offscreen)

- [ ] **Task**: ffmpeg.wasm runner trong offscreen document
- **Acceptance**:
  - `offscreen/ffmpeg.html` + `offscreen/ffmpegRunner.ts`
  - Load `@ffmpeg/ffmpeg` + core từ `chrome.runtime.getURL('ffmpeg/ffmpeg-core.js')`
  - Listen message từ background: `CONVERT_TS_TO_MP4`
  - Write segments to ffmpeg FS → transcode → read mp4 → send back
  - Handle ffmpeg load error
- **Verify**:
  - Manual: trigger download → check offscreen document console → ffmpeg loaded
  - Unit test: mock ffmpeg, verify message handling
- **Files**: `src/offscreen/ffmpeg.html`, `src/offscreen/ffmpegRunner.ts`, `tests/unit/offscreen/ffmpegRunner.test.ts`

### Checkpoint CP-2: Chrome API wrappers work

- **Verify**: Load extension → vào test site → service worker console log detected media → no errors
- **Gate**: Proceed to Layer 3 only if CP-2 passes

---

## Layer 3: Popup UI (React)

### Task 3.1: popupStore (Zustand)

- [ ] **Task**: Zustand store cho popup state
- **Acceptance**:
  - State: `detectedVideos[]`, `detectedSubtitles[]`, `downloads[]`, `settings`, `extensionStatus`
  - Actions: `setVideos`, `setSubtitles`, `addDownload`, `updateDownload`, `removeDownload`, `updateSettings`
  - Persist settings to `chrome.storage.local`
  - Subscribe to messageBus events
- **Verify**: Unit test store actions
- **Files**: `src/popup/store/popupStore.ts`, `tests/unit/popup/store.test.ts`

### Task 3.2: useDetectedMedia hook

- [ ] **Task**: React hook subscribe detected media từ background
- **Acceptance**:
  - `useDetectedMedia()` trả về `{ videos, subtitles }`
  - Auto-subscribe on mount, unsubscribe on unmount
  - Re-render khi media list change
- **Verify**: Component test với mock messageBus
- **Files**: `src/popup/hooks/useDetectedMedia.ts`

### Task 3.3: useDownloadProgress hook

- [ ] **Task**: React hook track download progress
- **Acceptance**:
  - `useDownloadProgress()` trả về `{ downloads, totalProgress }`
  - Auto-subscribe on mount
  - Re-render khi progress update
- **Verify**: Component test với mock messageBus
- **Files**: `src/popup/hooks/useDownloadProgress.ts`

### Task 3.4: useExtensionStatus hook

- [ ] **Task**: React hook track extension active/inactive
- **Acceptance**:
  - `useExtensionStatus()` trả về `{ isActive, toggle }`
  - Toggle send message to background
  - Persist state to chrome.storage.local
- **Verify**: Component test
- **Files**: `src/popup/hooks/useExtensionStatus.ts`

### Task 3.5: VideoCard component

- [ ] **Task**: Component hiển thị 1 video detected
- **Acceptance**:
  - Props: `video: DetectedVideo`, `onDownload: (id) => void`, `onSelectQuality: (id, quality) => void`
  - Render: title, quality selector (if multiple), download button
  - `data-testid="video-card"`, `data-testid="video-title"`, `data-testid="download-button"`
  - Style theo `reference-ui_ux_system.md` (CSS variables)
- **Verify**: Component test — render, click download, quality select
- **Files**: `src/popup/components/VideoCard.tsx`, `src/popup/components/VideoCard.module.css`, `tests/components/VideoCard.test.tsx`

### Task 3.6: SubtitleItem component

- [ ] **Task**: Component hiển thị 1 subtitle detected
- **Acceptance**:
  - Props: `subtitle: DetectedSubtitle`, `onDownload: (id) => void`
  - Render: language, format, download button
  - `data-testid="subtitle-item"`, `data-testid="subtitle-download"`
  - Style theo reference
- **Verify**: Component test
- **Files**: `src/popup/components/SubtitleItem.tsx`, `src/popup/components/SubtitleItem.module.css`, `tests/components/SubtitleItem.test.tsx`

### Task 3.7: ProgressBar component

- [ ] **Task**: Component hiển thị download progress
- **Acceptance**:
  - Props: `progress: number` (0-100), `status: DownloadStatus`
  - Render: progress bar + status text
  - Color theo status: downloading (primary), converting (warning), done (success), error (error)
  - `data-testid="progress-bar"`, `data-testid="progress-status"`
  - Style theo reference
- **Verify**: Component test — render不同 progress/status
- **Files**: `src/popup/components/ProgressBar.tsx`, `src/popup/components/ProgressBar.module.css`, `tests/components/ProgressBar.test.tsx`

### Task 3.8: StatusBadge component

- [ ] **Task**: Component hiển thị status indicator
- **Acceptance**:
  - Props: `status: DownloadStatus`
  - Render: colored badge với status text
  - `data-testid="status-badge"`
  - Style theo reference (success/warning/error/info colors)
- **Verify**: Component test
- **Files**: `src/popup/components/StatusBadge.tsx`, `src/popup/components/StatusBadge.module.css`, `tests/components/StatusBadge.test.tsx`

### Task 3.9: DownloadButton component

- [ ] **Task**: Reusable download button
- **Acceptance**:
  - Props: `onClick: () => void`, `disabled?: boolean`, `label?: string`, `variant?: 'single' | 'all'`
  - `data-testid="download-button"`
  - Style theo reference (primary color)
- **Verify**: Component test — click, disabled state
- **Files**: `src/popup/components/DownloadButton.tsx`, `src/popup/components/DownloadButton.module.css`, `tests/components/DownloadButton.test.tsx`

### Task 3.10: SettingsPanel component

- [ ] **Task**: Component hiển thị + edit settings
- **Acceptance**:
  - Props: `settings: Settings`, `onChange: (settings) => void`
  - Fields: concurrent downloads (number input, default 3), default quality (select), default subtitle language (select)
  - `data-testid="settings-panel"`, `data-testid="concurrent-input"`, `data-testid="quality-select"`
  - Style theo reference
- **Verify**: Component test — change settings, verify onChange called
- **Files**: `src/popup/components/SettingsPanel.tsx`, `src/popup/components/SettingsPanel.module.css`, `tests/components/SettingsPanel.test.tsx`

### Task 3.11: App.tsx — Root component

- [ ] **Task**: Assemble tất cả components thành popup UI
- **Acceptance**:
  - Layout: header (extension status + toggle), detected media list (videos + subtitles), downloads list (progress), settings panel (collapsible)
  - "Download All" button ở header
  - Empty state khi không có media detected
  - Error state khi detection fail
  - Responsive: fit popup width (400px default)
  - Theme: light/dark toggle (CSS variables)
- **Verify**:
  - Component test: render App với mock store, verify layout
  - Manual: open popup → verify UI renders
- **Files**: `src/popup/App.tsx`, `src/popup/App.module.css`, `tests/components/App.test.tsx`

### Task 3.12: CSS theme system

- [ ] **Task**: Implement CSS variables từ `reference-ui_ux_system.md`
- **Acceptance**:
  - `src/popup/styles/theme.css` chứa tất cả CSS variables (color, typography, spacing, radius, shadow)
  - Light mode + dark mode (via `:root` và `[data-theme="dark"]`)
  - Theme toggle persist to chrome.storage.local
  - All components use CSS variables, no hardcoded colors
- **Verify**:
  - Manual: toggle theme → UI switch instant
  - Visual: compare với reference-ui_ux_system.md
- **Files**: `src/popup/styles/theme.css`, `src/popup/styles/global.css`

### Checkpoint CP-3: Popup UI renders

- **Verify**: `npm test` (all component tests pass) + manual popup open → UI renders correctly
- **Gate**: Proceed to Layer 4 only if CP-3 passes

---

## Layer 4: Integration

### Task 4.1: Wire background ↔ popup

- [ ] **Task**: Connect popup UI với background service worker qua messageBus
- **Acceptance**:
  - Popup subscribe detected media events từ background
  - Popup send download command → background execute
  - Popup receive progress updates → update store
  - Popup send settings change → background persist
- **Verify**:
  - Manual: vào test site → open popup → see detected media → click download → see progress
- **Files**: `src/popup/App.tsx` (update), `src/background/index.ts` (update)

### Task 4.2: Wire background ↔ offscreen (ffmpeg)

- [ ] **Task**: Connect background với offscreen document cho ffmpeg.wasm
- **Acceptance**:
  - Background create offscreen document on demand (when download starts)
  - Send segments to offscreen → receive mp4 back
  - Close offscreen document after conversion done
  - Handle offscreen creation error
- **Verify**:
  - Manual: download m3u8 video → check offscreen document created → ffmpeg runs → mp4 saved
- **Files**: `src/background/downloader.ts` (update), `src/offscreen/ffmpegRunner.ts` (update)

### Task 4.3: Wire content script ↔ background

- [ ] **Task**: Connect content script với background cho page scanning
- **Acceptance**:
  - Content script scan DOM → send URLs to background
  - Background merge networkInterceptor + pageScanner results
  - Deduplicate URLs
- **Verify**:
  - Manual: vào test site → check popup → media từ cả network + DOM
- **Files**: `src/content/index.ts` (update), `src/background/index.ts` (update)

### Task 4.4: Settings persistence

- [ ] **Task**: Persist settings to chrome.storage.local
- **Acceptance**:
  - Settings save on change
  - Settings load on popup open
  - Settings load on background startup
  - Handle storage quota exceeded (log error, suggest unlimitedStorage)
- **Verify**:
  - Manual: change settings → close popup → reopen → settings persisted
- **Files**: `src/popup/store/popupStore.ts` (update), `src/background/index.ts` (update)

### Checkpoint CP-4: Integration works

- **Verify**: Manual full flow: vào test site → popup hiện media → click download → progress → file saved
- **Gate**: Proceed to Layer 5 only if CP-4 passes

---

## Layer 5: E2E Tests

### Task 5.1: Playwright config + extension fixture

- [ ] **Task**: Cấu hình Playwright load extension vào browser
- **Acceptance**:
  - `playwright.config.ts` configured với Chromium
  - `e2e/fixtures/extension.ts` load `dist/` as unpacked extension
  - Launch browser with extension loaded
  - Helper: open popup, navigate to URL, wait for media detection
- **Verify**: `npm run test:e2e -- --list` → list tests không lỗi
- **Files**: `playwright.config.ts`, `e2e/fixtures/extension.ts`

### Task 5.2: E2E test — hoathinh3d

- [ ] **Task**: E2E test cho hoathinh3d site
- **Acceptance**:
  - Navigate to `https://hoathinh3d.co/xem-phim-vinh-sinh/tap-1-sv1.html`
  - Wait for media detection (timeout 30s)
  - Verify popup shows detected video
  - Click download → wait for completion (timeout 5min)
  - Verify file saved (check downloads folder or chrome.downloads API)
  - Verify subtitle detected + downloadable
- **Verify**: `npm run test:e2e -- --grep hoathinh3d` → pass
- **Files**: `e2e/hoathinh3d.spec.ts`

### Task 5.3: E2E test — kisskh

- [ ] **Task**: E2E test cho kisskh site
- **Acceptance**:
  - Navigate to `https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816`
  - Wait for media detection (timeout 30s)
  - Verify popup shows detected video
  - Click download → wait for completion (timeout 5min)
  - Verify file saved
  - Verify subtitle detected + downloadable
- **Verify**: `npm run test:e2e -- --grep kisskh` → pass
- **Files**: `e2e/kisskh.spec.ts`

### Checkpoint CP-5: E2E pass

- **Verify**: `npm run test:e2e` → 2 site test pass 100%
- **Gate**: Project done — ready for ship phase

---

## Task Summary

| Layer | Tasks | Parallel groups | Est. complexity |
|---|---|---|---|
| 0. Foundation | 6 | Sequential | Low |
| 1. Pure Logic | 10 | 7 parallel + 3 sequential | Medium |
| 2. Chrome API | 6 | Mixed | High |
| 3. Popup UI | 12 | Components parallel | Medium |
| 4. Integration | 4 | Sequential | High |
| 5. E2E | 3 | 2 parallel | Medium |
| **Total** | **41 tasks** | | |

## Next Step

Phase 4: Implement — Execute tasks one at a time following `incremental-implementation` + `test-driven-development`.
Start with Task 0.1 (Project setup).
