# Feature Inventory — Video Downloader Chrome Extension

> Complete catalog of every functional and non-functional capability in the codebase.
> Used as the basis for UI redesign prototypes.

---

## Functional Features

### Media Detection
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F1 | Network interception | Intercepts all HTTP requests via `chrome.webRequest.onBeforeRequest`, detects video/subtitle URLs by extension pattern | Indirect | `networkInterceptor.ts`, `videoDetector.ts`, `subtitleDetector.ts` |
| F2 | DOM page scanning | Content script scans `<video>`, `<source>`, `<track>`, `<a>` elements; `MutationObserver` for dynamic content | Indirect | `content-script.ts`, `pageScanner.ts` |
| F3 | Multi-format detection | Detects `.m3u8`, `.mp4`, `.ts`, `.webm` videos and `.ass`, `.vtt`, `.srt` subtitles | Yes (popup list) | `videoDetector.ts`, `subtitleDetector.ts` |
| F4 | Quality variants | M3U8 master playlists parsed for variants (bandwidth, resolution, codecs, quality label) | Yes (quality selector) | `m3u8Parser.ts` |

### Downloading
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F5 | M3U8 segment download | Fetches segments, writes to OPFS `input.ts` in playlist order | Yes (progress bar) | `downloader.ts`, `opfsStorage.ts` |
| F6 | Parallel segment fetch | Configurable 1–12 concurrent segment fetches via `Promise.all` | Yes (setting) | `downloader.ts` |
| F7 | MP4 direct download | Fetches `.mp4` files directly via single `fetch()` | Yes (progress bar) | `downloader.ts` |
| F8 | Download All / Download Selected | One-click download of all detected media, or selected subset via selection bar | Yes (header button + selection bar) | `App.redesigned.tsx`, `SelectionBar.tsx`, `background/index.ts` |
| F9 | Concurrent download queue | 1–10 concurrent downloads with queue management | Yes (setting) | `downloadQueue.ts` |
| F10 | Cancel download | Cancel by ID, cleanup OPFS temp files, optimistic UI removal | Yes (cancel button on DownloadCard) | `downloader.ts`, `downloadQueue.ts`, `DownloadCard.tsx` |
| F11 | Pause/Resume | Pause (cancel+re-queue strategy) and resume downloads | Yes (pause/resume button on DownloadCard) | `downloader.ts`, `downloadQueue.ts`, `DownloadCard.tsx` |
| F12 | Retry download | Reset failed/cancelled download, clear cancel flag, OPFS cleanup, re-queue | Yes (retry button on DownloadCard) | `downloader.ts`, `downloadQueue.ts`, `DownloadCard.tsx` |
| F12b | Remove download | Remove done/error download from queue + UI | Yes (remove button on DownloadCard) | `downloadQueue.ts`, `DownloadCard.tsx` |
| F12c | Retry logic (segment) | Up to 3 retries per segment on network/abort error | No | `downloader.ts` |
| F13 | Timeout handling | 30s per segment, 30s for media detection | No | `downloader.ts` |

### Conversion (TS→MP4)
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F14 | Sequential TS→MP4 | Streaming transmux via mux.js, 4MB chunks, ~1-2 fragments in memory | Yes (conversion phase) | `tsTransmuxer.ts`, `ffmpegRunner.ts` |
| F15 | Parallel TS→MP4 | Web Workers transmux segment groups independently, zero-copy Transferable Objects | Yes (worker count in progress) | `parallelTransmuxer.ts`, `transmuxWorker.ts`, `workerFactory.ts` |
| F16 | Safety analysis | Validates segment byte ranges are contiguous/monotonic before parallel | No | `parallelSafetyAnalyzer.ts` |
| F17 | Segment grouping | Groups contiguous segments into near-equal byte ranges for workers | No | `segmentGrouping.ts` |
| F18 | Fallback strategies | sequential / retry-reduced / save-ts / fail when parallel fails | Yes (setting) | `parallelFallback.ts` |
| F19 | MP4 validation | Checks ftyp/moov/moof/mdat boxes after parallel conversion | No | `mp4Validator.ts` |
| F20 | Conversion mode | always / small-only (≤150MB) / never | Yes (setting) | `downloader.ts` |
| F21 | Parallel mode | off / auto / manual (with worker count 2–6) | Yes (setting) | `parallelPolicy.ts`, `parallelPlanner.ts` |

### Subtitle Handling
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F22 | ASS→SRT conversion | Strips styling/drawing, sorts by time, outputs SRT | No | `assToSrt.ts`, `assParser.ts` |
| F23 | VTT→SRT conversion | Strips VTT/HTML tags, outputs plain-text SRT | No | `vttToSrt.ts`, `vttParser.ts` |
| F24 | SRT normalization | Handles BOM, WEBVTT headers, dot/comma timestamps, re-numbers | No | `srtNormalizer.ts`, `srtParser.ts` |

### Progress & Observability
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F25 | Download progress | Percentage, current/total segments, bytes downloaded, file size, **two-phase (downloadProgress + convertProgress)** | Yes (progress bar + detail) | `downloader.ts`, `useDownloadProgress.ts`, `DownloadCard.tsx` |
| F26 | Conversion progress | Phase (planning/transmuxing/merging/validating/done), percent, bytes processed, worker count, usedWorkers, **phase labels in DownloadCard** | Yes (DownloadCard phase labels + detail items) | `parallelProgress.ts`, `ffmpegRunner.ts`, `DownloadCard.tsx` |
| F27 | _Removed_ | _ConversionTimer deleted — all production usage was console.log-only_ | — | — |
| F28 | Benchmark harness | Measures sequential vs parallel performance | No (CLI scripts) | `benchmarkHarness.ts` |

### Settings & Configuration
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F29 | Settings persistence | Saved to `chrome.storage.local`, loaded on popup mount + background init | Yes | `popupStore.ts`, `config.ts` |
| F30 | 10 configurable settings | concurrentDownloads, defaultQuality, defaultSubtitleLanguage, theme, convertToMp4, parallelConversion, manualWorkerCount, parallelFallback, segmentConcurrency, **filenameSource** | Yes (settings panel) | `SettingsDialog.tsx`, `media.ts` |
| F30b | Default quality auto-apply | Changing defaultQuality reorders video variants so matched quality is first | Yes (VideoCard updates) | `App.redesigned.tsx` |

### UI / UX
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F34b | Selection bar | Fixed bottom bar with clear/count/download when media selected | Yes | `SelectionBar.tsx`, `App.redesigned.tsx` |
| F34c | Two-phase progress | Separate download + convert progress bars in DownloadCard | Yes | `DownloadCard.tsx` |
| F34d | Phase labels | Planning/Transmuxing/Merging/Validating/Done shown in DownloadCard | Yes | `DownloadCard.tsx` |
| F34e | Quality badge | Pill badge showing quality (e.g. "1080p") next to download title | Yes | `DownloadCard.tsx` |
| F34f | Progress details | Bytes/total, worker count, duration shown in DownloadCard | Yes | `DownloadCard.tsx` |
| F34g | Format icons | Video (▶) and subtitle (T) icons on media cards | Yes | `VideoCard.tsx`, `SubtitleCard.tsx` |

### Extension Management
| # | Feature | Description | User-facing | Key files |
|---|---------|-------------|-------------|-----------|
| F31 | Extension on/off toggle | Enable/disable without uninstalling, stops network interception | Yes (header button) | `background/index.ts`, `useExtensionStatus.ts` |
| F32 | Theme toggle | Light (Cluely Light) / Dark (Midnight Command Center) | Yes (header button) | `theme.css`, `App.tsx` |
| F33 | Offscreen document lifecycle | Lazy creation, ping handshake, Blob URL management | No | `offscreenManager.ts`, `ffmpegRunner.ts` |
| F34 | OPFS orphan cleanup | Scans and removes orphaned OPFS files on startup | No | `opfsStorage.ts` |

---

## Non-Functional Capabilities

### Performance
| # | Capability | Description |
|---|-----------|-------------|
| NF1 | Zero-copy transfer | Transferable Objects for ArrayBuffer between main thread and Web Workers |
| NF2 | Streaming OPFS writes | Single persistent writable stream per download (not open/close per chunk) |
| NF3 | Chunked processing | 4MB chunks for TS→MP4, ~1-2 fragments in memory regardless of file size |
| NF4 | Parallel transmux | Up to 6 Web Workers on separate CPU cores |
| NF5 | Configurable segment concurrency | 1–12 parallel segment fetches |

### Safety
| # | Capability | Description |
|---|-----------|-------------|
| NF6 | Safety analyzer | Validates segment metadata before parallel; fails closed |
| NF7 | File size gates | Parallel only for ≥150MB (auto), ≥300MB for 4 workers |
| NF8 | Worker limits | Min 2, max 6, clamped to `hardwareConcurrency - 1` |
| NF9 | MP4 validation | Structure validation after parallel conversion |
| NF10 | Quota exceeded handling | Catches `QuotaExceededError` from OPFS, reports to user |

### Architecture
| # | Capability | Description |
|---|-----------|-------------|
| NF11 | MV3 service worker | Background script (no WASM, no WebWorkers directly) |
| NF12 | Offscreen document | Runs mux.js + Web Workers, shares OPFS with service worker |
| NF13 | Message bus | Typed request-response with timeout, fire-and-forget, broadcast |
| NF14 | Content script | Injects into all pages, scans DOM, observes mutations |
| NF15 | OPFS shared storage | Service worker and offscreen document share files via OPFS |

### Testing
| # | Capability | Description |
|---|-----------|-------------|
| NF16 | 574 Jest unit tests | 46 test suites covering background, popup, converters, parsers, storage |
| NF17 | E2E Playwright tests | download-duplicate, hoathinh3d, kisskh, m3u8-local, redesigned-popup, subtitle-download |
| NF18 | Benchmark scripts | `benchmark-m3u8.mjs` (Promise.all), `benchmark-m3u8-workers.mjs` (worker_threads) |

---

## Current UI State

### Two existing layouts:
1. **App.tsx (original):** Header → Download All → Detected Media (videos + subtitles) → Downloads → Settings (collapsible)
2. **App.redesigned.tsx:** Header → TabBar (Videos/Subtitles/Downloads) → Tab content → Settings dialog (modal)

### Design system: Orca
- **Light:** Cluely Light — radiant cloud-native, frosted glass, digital blue (#3c83f6)
- **Dark:** Midnight Command Center — midnight canvas, glowing accents, spacious
- **Typography:** Inter (primary), EB Garamond (display), JetBrains Mono (mono)
- **Spacing:** 4px scale (xs=4, sm=8, md=16, lg=24, xl=32)
- **Radius:** sm=4, md=8, lg=12, full=9999
- **Shadows:** sm/md/lg with dark-mode adjustments

### Popup dimensions: 400×600px (fixed)

### Components inventory:
| Component | Status | Notes |
|-----------|--------|-------|
| ProgressBar | Active | Shows % + status text, color-coded |
| ProgressDetail | Active | Shows file size, bytes, phase, workers |
| StatusBadge | Active | Colored status badge |
| VideoCard (original) | Active | Title, quality, download button |
| VideoCard (redesigned) | Active | Enhanced with variants, file size |
| SubtitleItem | Active | Language, format, download button |
| SubtitleCard | Active | Redesigned subtitle card |
| SettingsPanel | Active | All 9 settings |
| SettingsDialog | Active | Modal wrapper for settings |
| Header | Active | Title, toggles |
| TabBar | Active | Tab navigation |
| Button/Badge/Icon/Skeleton | Active | UI primitives |
| MediaEmpty | Active | Empty state |
| MediaList | Active | List container |

### What's missing in the UI:
- Cancel/Pause/Resume buttons not wired to UI (messages exist)
- No download history (completed downloads disappear on popup close)
- No file size estimate before download
- No batch quality selection
- No search/filter for detected media
- No per-download error retry button
- No visual indication of parallel vs sequential conversion mode
- No benchmark/auto-enablement status visible
- No storage usage indicator (OPFS quota)
