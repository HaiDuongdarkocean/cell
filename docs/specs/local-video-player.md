# Spec: Local Video Player

> Status: **Final — review-resolved, implementation-ready**.
> Intent source: `docs/intent/local-video-player.md` (confirmed 2026-08-20).
> Review log: xem cuối file (3 adversarial reports synthesized).

## Objective

Local Player — player video local chạy trong trang extension (Chrome MV3). User mở trang player trước → dùng File System Access API (`showOpenFilePicker`) hoặc drag-drop để chọn video. Player auto-match subtitle cùng tên trong cùng folder, render song ngữ (target + native) với styling do player kiểm soát. Hỗ trợ switch/extract audio + subtitle track từ container (MKV). Condense audio — extract audio theo subtitle timing, remove silence → MP3 cho passive immersion. Library lưu resume position, history, bookmark, folder watch.

> **Quyết định quan trọng (từ review):** Luồng `file://` redirect đã bị loại bỏ hoàn toàn — không khả thi cho production extension (content script không chạy reliably trên `file://`, `fetch` directory listing không work, "default app" registration impossible cho extension). Tất cả file access dùng File System Access API.

### User

Language learner 10-25 tuổi, máy RAM ≥1GB available, đa số file MP4/MKV. Persona nhiều nhất 10-25 tuổi, mọi ngành nghề yêu thích học ngoại ngữ.

### Phased Scope

Spec chia 3 phase — mỗi feature/user story đánh dấu `[P1]`, `[P2]`, hoặc `[P3]`.

| Phase | Goal | Features |
|-------|------|----------|
| **P1 (MVP)** | Core player | MP4/WebM/OGG native, subtitle auto-match via File System Access API, bilingual render, basic controls, keyboard shortcuts, resume position, history |
| **P2 (Library + Track Extraction)** | Library + MKV track manipulation | bookmarks, folder watch, MKV track switch, extract audio/subtitle, thumbnails |
| **P3 (Condense Audio + Legacy Codec)** | Advanced audio + full format | condense algorithm, ffmpeg.wasm fallback, mobile support evaluation |

### Non-goals (per phase)

**P1 non-goals:**
- Folder watch (defer P2)
- Track extraction (defer P2)
- Bookmarks (defer P2)
- Condense audio (defer P3)
- Legacy codec support AVI/FLV/WMV (defer P3)
- Thumbnails (defer P2)
- MKV/TS/FLV/AVI/WMV playback (defer P2 — pending MSE+WebCodecs research spike)

**P2 non-goals:**
- Condense audio (defer P3)
- Legacy codec support (defer P3)
- Bitmap track extraction PGS/VOBSUB (out of scope — requires OCR)

**P3 non-goals:**
- Bitmap track extraction (out of scope)
- Real-time transcription Whisper (out of scope per intent)
- Burn-in subtitle (out of scope per intent)

### User stories

1. **[P1] Manual open:** User mở trang player (qua extension icon menu hoặc shortcut) → bấm "Open file" hoặc drag-drop video vào → player pick file via `showOpenFilePicker` → auto-match subtitle → play.
2. **[P1] Subtitle auto-match:** Video `Movie_720p.mp4` trong folder có `Movie.en.srt`, `Movie.vi.srt`, `Movie.srt` → player strip `_720p` → match base `Movie` → ưu tiên `.en.srt` (target) + `.vi.srt` (native) → load song ngữ. Nếu chỉ có `Movie.srt` → load làm target.
3. **[P1] Multiple subtitle pick:** Folder có 3 subtitle cùng base name → player hiện list pick, default = profile target. Sort multiple matches alphabetically, default = first.
4. **[P1] Subtitle match failure:** Không tìm thấy subtitle cùng folder → show "No subtitle found" + "Open subtitle file" button.
5. **[P1] Resume position:** User tắt player ở giây 120 → mở lại → player hỏi "Continue from 2:00?" hoặc auto-continue.
6. **[P1] History:** User mở library → thấy list video đã xem (gần đây trước) → click → mở lại.
7. **[P2] Bookmark:** User đang xem → bấm "Bookmark" (hoặc shortcut) → đánh dấu thời điểm hiện tại + ghi note optional → lưu vào library.
8. **[P2] Folder watch:** User chọn folder via `showDirectoryPicker` → player scan tất cả video → browse như media library → click video → play.
9. **[P2] Switch audio track:** MKV có 3 audio (en/jp/vi) → user right-click hoặc menu → switch audio track real-time.
10. **[P2] Switch subtitle track:** MKV có embedded subtitle tracks → user menu → switch track real-time.
11. **[P2] Extract audio:** User bấm "Extract audio" → chọn track → chọn format (MP3 192kbps) → save file. AAC deferred to P3.
12. **[P2] Extract subtitle:** User bấm "Extract subtitle" → chọn track → chọn option (giữ nguyên format / convert sang SRT) → save file.
13. **[P3] Condense audio:** User bấm "Condense audio" → player extract audio theo subtitle timing, remove silence, merge gap <1300ms, pad ±500ms, filter sound effects → output MP3 + re-timed SRT.
14. **[P3] Legacy codec playback:** User mở AVI/FLV/WMV → ffmpeg.wasm fallback (desktop only, single-threaded).

## Tech Stack

- **Framework:** React 19 + TypeScript 6 (existing)
- **Build:** Vite 8 + @crxjs/vite-plugin (existing)
- **State:** Zustand 5 (existing)
- **Storage:** IndexedDB (library metadata) + chrome.storage.local (settings) + OPFS (temp processing)
- **Subtitle parse:** existing parsers (SRT/VTT/TTML/ASS/SSA) + new SBV/SMI parsers
- **Video decode:**
  - Tier 1: MP4/WebM/OGG → native HTML5 `<video>` [P1]
  - Tier 2: MKV/TS/FLV/AVI/WMV → web-demuxer + WebCodecs [P2 — pending MSE research spike]
  - Tier 3: Rare legacy codecs not supported by web-demuxer → ffmpeg.wasm fallback [P3]
- **Audio encode:** lamejs (MP3, pure JS, universal support) [P2]. AAC deferred to P3 (ffmpeg.wasm).
- **MKV track + subtitle extraction:** web-demuxer (bilibili) — multi-format demux + WebCodecs integration + embedded subtitle extraction
- **File access:** File System Access API (`showOpenFilePicker`, `showDirectoryPicker`) — all phases
- **Design system:** existing tokens.css + shared/ui atoms + shared/domain/video/atoms

### New dependencies (bundle size + source verified)

| Package | Size (verified) | Purpose | Load strategy | Phase | Source |
|---------|-----------------|---------|---------------|-------|--------|
| `web-demuxer` (bilibili) | Full: 1131 KB gzipped (3.0MB uncompressed) / Mini: 493 KB gzipped (804.3KB uncompressed) | MKV/TS/FLV/AVI/WMV demux + WebCodecs + embedded subtitle extraction (`getMediaStream('subtitle')`, `readMediaPacket('subtitle')`) | Dynamic import on first non-MP4 file | P2 | [GitHub README](https://github.com/bilibili/web-demuxer#readme), [npm](https://www.npmjs.com/package/web-demuxer) |
| `lamejs` | ~100KB | MP3 encoding (condense + extract audio). API: `Mp3Encoder(channels, sampleRate, kbps)`, `encodeBuffer(Int16Array)`, `flush()`. Author claims 20x faster than realtime (132s sample in 6.5s) — UNVERIFIED independently. | Dynamic import on extract/condense | P2 | [GitHub README](https://github.com/zhuker/lamejs#readme) |
| `@ffmpeg/core-mt` (multi-threaded) | ~32MB | Legacy codec transcode fallback (Tier 3) + AAC encoding | Dynamic import only when legacy codec detected | P3 | [GitHub](https://github.com/ffmpegwasm/ffmpeg.wasm), [ffmpeg-cookbook](https://ffmpeg-cookbook.com/en/articles/ffmpeg-sharedarraybuffer-error/) |

> **Source-verified findings (2026-08-20):**

> **ffmpeg.wasm multi-threaded CAN work in Chrome extension pages** — contrary to initial adversarial review. Chrome extensions opt into cross-origin isolation via manifest keys `cross_origin_embedder_policy` + `cross_origin_opener_policy` (available since Chrome 93). Source: [Chrome Extensions — Cross-origin isolation](https://developer.chrome.com/docs/extensions/develop/concepts/cross-origin-isolation), [COEP manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/cross-origin-embedder-policy), [COOP manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/cross-origin-opener-policy). Current `manifest.json` does NOT have these keys — **MUST add** for P3 ffmpeg.wasm multi-threaded support. Sandboxed pages in iframes do NOT get cross-origin isolation (source: [chromium-extensions discussion](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/lR1th8cacSk)).

> **Ponytail ceiling:** ffmpeg.wasm ~32MB lazy-load only khi legacy codec (Tier 3). Multi-threaded `@ffmpeg/core-mt` requires `SharedArrayBuffer` → needs cross-origin isolation via manifest keys (see above). Single-threaded `@ffmpeg/core` (~31MB) works without COOP/COEP but is 2-4x slower. RAM usage UNVERIFIED — estimate 500MB-2GB, requires benchmarking on target devices. Mobile kill tab ở ~500MB — ffmpeg.wasm path disable trên mobile. 90% file (MP4/MKV) đi WebCodecs path (~100-200MB RAM, UNVERIFIED). ffmpeg.wasm uses WORKERFS/MEMFS for file I/O — document integration with OPFS.

> **WebCodecs audio encoding (source: [MDN Codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)):**
> - MP3 encoding via WebCodecs: **0% browser support** → MUST use lamejs (pure JS)
> - AAC encoding via WebCodecs: **90.1% support** — NOT on Firefox (any platform) or desktop Linux (any browser). Universally supported on Safari 26+
> - Opus encoding via WebCodecs: **96.1% support** — MDN-recommended for most WebCodecs audio encoding. Consider Opus in WebM container as alternative to AAC in MP4
> - `AudioEncoder` outputs `EncodedAudioChunk` (elementary stream), NOT playable file → need muxer (mp4-muxer or mediabunny) for AAC. lamejs outputs playable MP3 directly (no muxer needed)
> - `AudioData` uses `f32-planar` layout → need Float32→Int16 conversion before lamejs

> **File System Access API (source: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), [Chrome — Storing handles](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), [Chrome — Persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)):**
> - `showOpenFilePicker()` / `showDirectoryPicker()` — confirmed available in extension pages (secure context)
> - Handles are serializable → CAN store in IndexedDB + transfer via `postMessage()`
> - Permission reverts to `"prompt"` on retrieval from IndexedDB → must call `queryPermission()` then `requestPermission()`
> - `requestPermission()` requires **transient user activation** (button press) — cannot auto-prompt on page load
> - Chrome 122+ has improved persistent permissions (3-way prompt: "Allow this time" / "Allow on every visit" / "Don't allow")
> - `showDirectoryPicker()` accepts `id` parameter to help Chrome remember last-picked directory

> **Removed dependency:** `@cryguy/mkv-subtitle-extractor` — 0 stars, 6 weekly downloads, created Jan 2026, unknown maintainer. HIGH RISK. Use web-demuxer for MKV embedded subtitle extraction instead — `getMediaStream('subtitle')` and `readMediaPacket('subtitle')` confirmed in [README API docs](https://github.com/bilibili/web-demuxer#readmediapackettype-mediatype-start-number-end-number-seekflag-avseekflag).

## Commands

```bash
# Build (regenerate tokens + check icons + vite build)
npm run build

# Dev (regenerate tokens + vite serve)
npm run dev

# Type check
npm run typecheck

# Unit tests (fast, no network)
npm run test:unit

# Integration tests (network)
npm run test:integration

# E2E tests (Playwright, real Chrome)
npm run test:e2e

# Lint
npm run lint
npm run lint:fix

# Mock pages (for testing)
npm run mock
```

## Project Structure

```
src/
├── entrypoints/
│   ├── local-player/              # NEW — standalone player page
│   │   ├── index.html               # HTML entry (pattern: sidepanel/index.html)
│   │   ├── main.tsx                 # React mount + ThemeProvider + ErrorBoundary
│   │   ├── App.tsx                  # Root: route between Library view ↔ Player view
│   │   ├── App.module.css
│   │   ├── styles/
│   │   │   └── global.css           # @import tokens.css + scrollbars
│   │   ├── store/
│   │   │   └── localPlayerStore.ts # Zustand: current video, playback state, library view
│   │   ├── components/
│   │   │   ├── PlayerView.tsx       # Player layout: video + controls + subtitle overlay + dock
│   │   │   ├── PlayerView.module.css
│   │   │   ├── PlayerControls.tsx   # Control bar: PlayPauseButton + Timeline + VolumeControl + SpeedControl + FullscreenButton + PiPButton + CaptionsButton + TimeDisplay
│   │   │   ├── PlayerControls.module.css
│   │   │   ├── PlayerMenuBar.tsx    # Top menu: Open file, Extract audio, Extract subtitle, Condense, Bookmark, Library
│   │   │   ├── PlayerMenuBar.module.css
│   │   │   ├── EmptyState.tsx       # Dropzone + "Open file" button when no video loaded
│   │   │   ├── EmptyState.module.css
│   │   │   ├── LibraryView.tsx      # Library: history list + folder watch browse + bookmark list
│   │   │   ├── LibraryView.module.css
│   │   │   ├── LibraryCard.tsx      # Video card in library (thumbnail, title, resume %, last watched)
│   │   │   ├── LibraryCard.module.css
│   │   │   ├── BookmarkList.tsx     # Bookmark list for current video
│   │   │   ├── BookmarkList.module.css
│   │   │   ├── TrackSelector.tsx    # Audio/subtitle track picker dropdown
│   │   │   ├── TrackSelector.module.css
│   │   │   ├── CondenseDialog.tsx   # Condense audio config dialog (padding, merge gap, filters, format)
│   │   │   ├── CondenseDialog.module.css
│   │   │   ├── CondenseProgress.tsx # Condense progress bar (%, ETA, cancel)
│   │   │   ├── CondenseProgress.module.css
│   │   │   ├── ExtractDialog.tsx    # Extract audio/subtitle config dialog (track, format, save)
│   │   │   └── ExtractDialog.module.css
│   │   └── hooks/
│   │       ├── useLocalVideo.ts     # Video element ref + playback state + timeupdate → store
│   │       ├── useSubtitleMatch.ts  # Auto-match subtitle file in same folder as video
│   │       ├── useResumePosition.ts # Save/restore resume position via IndexedDB
│   │       └── useFileSystemAccess.ts # showOpenFilePicker/showDirectoryPicker + handle persistence
│   │
│   ├── background/
│   │   └── localPlayerHandlers.ts   # NEW — message handlers for extract/condense/library + keep-alive
│   └── offscreen/
│       ├── audioExtractWorker.ts    # NEW — worker: audio extraction + encoding (lamejs)
│       └── condenseWorker.ts        # NEW — worker: condense audio processing
│
├── features/
│   ├── local-player/              # NEW — feature domain (screaming architecture)
│   │   ├── logic/
│   │   │   ├── subtitleMatch.ts     # Pure: strip resolution suffix, match base name, language priority
│   │   │   ├── subtitleMatch.test.ts
│   │   │   ├── condenseAudio.ts     # Pure: cue timeline → merged+padded+filtered segments
│   │   │   ├── condenseAudio.test.ts
│   │   │   ├── condenseRetime.ts    # Pure: re-time subtitle cues to match condensed audio
│   │   │   ├── condenseRetime.test.ts
│   │   │   ├── trackExtraction.ts   # Pure: track metadata, format conversion plan
│   │   │   ├── trackExtraction.test.ts
│   │   │   ├── librarySort.ts       # Pure: sort library by addedAt/lastWatchedAt/title
│   │   │   └── librarySort.test.ts
│   │   ├── services/
│   │   │   ├── mediaLibraryRepository.ts  # IndexedDB CRUD: videos, bookmarks, history, folderHandles
│   │   │   ├── folderWatchService.ts     # File System Access API: pick folder, scan, store handle, re-prompt
│   │   │   ├── audioExtractionService.ts # Orchestrate: web-demuxer → WebCodecs → lamejs → save
│   │   │   ├── subtitleExtractionService.ts # Orchestrate: web-demuxer → convert → save
│   │   │   └── condenseService.ts        # Orchestrate: parse subtitle → condenseAudio → extract+encode → save
│   │   └── ui/
│   │       └── (components live in entrypoints/local-player/components/)
│   │
│   └── subtitle/                    # EXISTING — reuse + extend
│       └── logic/
│           └── (existing parsers, cue engine, offset — no changes)
│
├── shared/
│   ├── lib/
│   │   └── parsers/
│   │       ├── sbvParser.ts         # NEW — SBV (YouTube captions) → SrtCue[]
│   │       ├── sbvParser.test.ts
│   │       ├── sbvToSrt.ts          # NEW — SBV → SRT string
│   │       ├── smiParser.ts         # NEW — SMI/SAMI → SrtCue[]
│   │       ├── smiParser.test.ts
│   │       └── smiToSrt.ts          # NEW — SMI → SRT string
│   └── domain/
│       └── video/
│           └── atoms/
│               ├── PlaybackSpeedControl.tsx    # NEW — speed selector (0.25x-2x), reference YouTubePlayer
│               └── PlaybackSpeedControl.module.css
│
└── entities/
    └── message/
        └── types.ts                 # EXTEND — add local player message types
```

> **Removed from draft:** `src/entrypoints/content/fileRedirect.ts` và `useFileRedirect` hook — file:// redirect flow đã bị loại bỏ hoàn toàn.

### Files modified (existing)

| File | Change |
|------|--------|
| `public/manifest.json` | Add `web_accessible_resources` for local-player page + `unlimitedStorage` permission. **P3:** Add `cross_origin_embedder_policy: { value: "require-corp" }` + `cross_origin_opener_policy: { value: "same-origin" }` for ffmpeg.wasm multi-threaded SharedArrayBuffer support. Source: [Chrome — Cross-origin isolation](https://developer.chrome.com/docs/extensions/develop/concepts/cross-origin-isolation) |
| `vite.config.ts` | Add `localPlayer` to `rollupOptions.input` |
| `src/shared/config/config.ts` | Add `OFFLINE_PLAYER_LIBRARY` storage key + `DEFAULT_OFFLINE_PLAYER_SETTINGS` |
| `src/shared/lib/storage/settingsStore.ts` | Add schema v22 migration for local player settings |
| `src/entities/message/types.ts` | Add message types: `EXTRACT_AUDIO`, `EXTRACT_SUBTITLE`, `CONDENSE_AUDIO`, `GET_LIBRARY`, `SAVE_RESUME_POSITION`, etc. |
| `src/entrypoints/background/index.ts` | Register local player message handlers + keep-alive for long ops |
| `src/features/settings/ui/SettingsDialogContent.tsx` | Add "Local Player" settings section |

## Code Style

```typescript
// Named export, function component, no `any`, SSOT, pure logic tách hàm
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { SrtCue } from '@/entities/subtitle';

export interface SubtitleMatchResult {
  readonly targetPath: string | null;
  readonly nativePath: string | null;
  readonly candidates: readonly SubtitleCandidate[];
}

/** Pure: strip resolution suffix from video filename → base name for subtitle matching. */
export function stripResolutionSuffix(filename: string): string {
  // ponytail: regex covers common resolution suffixes (_1080p, _720p, _480p, _360p, _240p, _144p)
  // ceiling: non-standard suffixes (e.g. _4K, _HDR, _DV, _REMUX) not stripped — upgrade: extend RESOLUTION_RE
  const RESOLUTION_RE = /[_\-.](?:4320|2160|1440|1080|720|576|480|360|240|144)p?(?:[_\-.].*)?$/i;
  return filename.replace(RESOLUTION_RE, '');
}

/** Pure: match subtitle files to video by base name + language priority. */
export function matchSubtitles(
  videoFilename: string,
  subtitleFiles: readonly string[],
  targetLang: string,
  nativeLang: string,
): SubtitleMatchResult {
  // ... pure logic, no side effects
}
```

### Conventions

- Named export, DON'T default export
- Function component + hooks, DON'T class component
- MUST NOT use `any` (ESLint `no-explicit-any` enforced)
- Pure logic tách hàm → dễ test, DON'T side effect trong logic
- CSS module per component, tokens from `tokens.css` via `var(--token-name)`
- Icon: import from `ICON_CATALOG` (`src/shared/icons/index.ts`), DON'T inline SVG
- UI atoms: import from `@/shared/ui`, DON'T tự tạo

## Testing Strategy

### Unit tests (jest, fast, no network)

| Module | Test file | What's tested | Phase |
|--------|-----------|---------------|-------|
| `subtitleMatch.ts` | `subtitleMatch.test.ts` | Strip suffix, base name match, language priority, edge cases (multi-resolution, `.en.srt` vs `.eng.srt`, case sensitivity, no subtitle, multiple candidates, alphabetical sort) | P1 |
| `condenseAudio.ts` | `condenseAudio.test.ts` | Cue merge (gap <1300ms), padding (±500ms), filter (regex `^\[.*\]$`, parentheses), segment list output | P3 |
| `condenseRetime.ts` | `condenseRetime.test.ts` | Re-time cues to match condensed audio timeline | P3 |
| `trackExtraction.ts` | `trackExtraction.test.ts` | Track metadata parsing, format conversion plan (ASS→SRT, VTT→SRT) | P2 |
| `librarySort.ts` | `librarySort.test.ts` | Sort by addedAt/lastWatchedAt/title, empty list, single item | P1 |
| `sbvParser.ts` | `sbvParser.test.ts` | SBV format parse → SrtCue[], edge cases | P1 |
| `smiParser.ts` | `smiParser.test.ts` | SMI/SAMI format parse → SrtCue[], edge cases | P1 |
| `mediaLibraryRepository.ts` | `mediaLibraryRepository.test.ts` | CRUD operations (use fake-indexeddb) | P1 |

### E2E tests (Playwright, real Chrome)

| Scenario | What's tested | Phase |
|----------|---------------|-------|
| Open file via File System Access API picker | Pick video → player loads → subtitle auto-match → play | P1 |
| Open file via drag-drop | Drag video → player loads → subtitle auto-match → play | P1 |
| Subtitle match failure | No subtitle in folder → "No subtitle found" + "Open subtitle file" button | P1 |
| Switch audio track | MKV with multiple audio → switch → audio changes | P2 |
| Extract audio | Click extract → choose track + format → file downloads | P2 |
| Condense audio | Click condense → configure → progress bar → MP3 downloads | P3 |
| Resume position | Play → close → reopen → resume prompt | P1 |
| Bookmark | Play → bookmark → see in bookmark list → click → seek | P2 |
| Folder watch | Pick folder → scan → library shows videos → click → play | P2 |
| Export overwrite confirmation | Export to existing filename → confirmation dialog | P2 |
| Permission denial | Deny File System Access API → graceful error message | P1 |

### Test data

- `data/resource/media/video and subtitle/` — existing sample (Adele-Hello MP4 multi-resolution + SRT)
- Add test MKV with multiple audio + subtitle tracks for track extraction tests [P2]
- Add test AVI/FLV/WMV for ffmpeg.wasm fallback tests [P3]

## Boundaries

### Always do

- Run `npm run typecheck` + `npm run test:unit` + `npm run build` after every `.ts`/`.tsx`/`.css`/`.json` change in `src/`
- Follow naming conventions (named export, function component, no `any`)
- Validate input at trust boundaries (file picker, drag-drop)
- Use tokens from `tokens.css` via `var()`, DON'T hardcode colors/sizes
- Import icons from `ICON_CATALOG`, DON'T inline SVG
- Import UI atoms from `@/shared/ui`, DON'T tự tạo
- Pure logic in `features/local-player/logic/`, side effects in `services/` or `hooks/`
- Update `docs/2-architechture-system.md` when adding/removing/modifying `src/` files
- Update `docs/0-wiki.md` when adding/removing/modifying `docs/` files
- Record architecture decisions in `docs/adr/`

### Ask first

- Adding new dependencies (check bundle size first)
- Modifying `manifest.json` (must test in real Chrome)
- Changing `vite.config.ts` build config
- Database schema changes (IndexedDB object stores)
- New permissions in manifest

### Never do

- Commit secrets or API keys
- Hardcode values that should be tokens
- Use `any` type
- Default export
- Class component (except ErrorBoundary — React requirement)
- Inline SVG in components
- Add ffmpeg.wasm to main bundle (must be lazy-load dynamic import)
- Use multi-threaded `@ffmpeg/core-mt` (COOP/COEP impossible on `chrome-extension://` pages) — use single-threaded `@ffmpeg/core` only
- Run ffmpeg.wasm on mobile (navigator.deviceMemory < 4 — disable + warn)
- Use `file://` redirect flow (technically infeasible for production extensions)

## Success Criteria

### Browser requirements

- [ ] Chrome 86+ required for File System Access API (show error on older versions)
- [ ] Chrome 94+ required for WebCodecs (Tier 2/3 — fallback to Tier 1 native only)
- [ ] Firefox/Linux: AAC encoding disabled (P3), MP3 only
- [ ] Graceful degradation for older Chrome versions with clear error messages

### Player core [P1]

- [ ] Open video file via File System Access API picker → video plays within 3s (UNVERIFIED — requires benchmarking)
- [ ] Open video file via drag-drop → video plays within 3s (UNVERIFIED)
- [ ] First time user opens file → system picker dialog. Subsequent opens remember last directory via File System Access API `id` parameter.
- [ ] Play/pause, seek, volume, fullscreen, playback speed, PiP all work
- [ ] Keyboard shortcuts: space (play/pause), ←/→ (seek ±5s), shift+←/→ (±10s), m (mute), f (fullscreen), 0-9 (seek 0-90%)
- [ ] Subtitle auto-match: video `Adele-Hello-Official-Music-Video_1080p.mp4` → loads `Adele-Hello-Official-Music-Video.srt` automatically (via File System Access API, same folder)
- [ ] Subtitle match failure: no subtitle found → show "No subtitle found" + "Open subtitle file" button
- [ ] Subtitle render song ngữ (target + native) với player-controlled styling
- [ ] NavCluster (6 nút: prev/repeat/next/rewind/play/forward) works
- [ ] CueList hiển thị + click seek + auto-scroll current cue
- [ ] AB-loop / hold-to-loop works
- [ ] Subtitle offset adjustment works
- [ ] Player page initial load < 3s (excluding video file) — UNVERIFIED, requires benchmarking
- [ ] Subtitle auto-match < 500ms — UNVERIFIED, requires benchmarking
- [ ] Permission denial handling: graceful error messages when File System Access API denied

### Format support

- [ ] [P1] MP4 (H.264/HEVC) plays via native HTML5
- [ ] [P1] WebM (VP8/VP9/AV1) plays via native HTML5
- [ ] [P1] OGG plays via native HTML5
- [ ] [P2] MKV (H.264/VP9 inside) plays via web-demuxer + WebCodecs (pending MSE research spike)
- [ ] [P2] TS plays via web-demuxer + WebCodecs
- [ ] [P2] FLV/AVI/WMV plays via web-demuxer + WebCodecs
- [ ] [P3] Rare legacy codecs not supported by web-demuxer → ffmpeg.wasm fallback (with warning + RAM check)
- [ ] [P3] ffmpeg.wasm disabled on mobile (navigator.deviceMemory < 4 or fallback) — show "Format not supported on this device" message

### Subtitle format support [P1]

- [ ] SRT parses + renders
- [ ] VTT parses + renders (convert to SRT internally)
- [ ] ASS/SSA parses + renders (convert to SRT, player styles)
- [ ] TTML parses + renders (convert to SRT)
- [ ] SBV parses + renders (convert to SRT)
- [ ] SMI parses + renders (convert to SRT)
- [ ] All formats → unified SRT pipeline → SubtitleBlock renders with OverlayStyleConfig

### Track extraction [P2]

- [ ] MKV audio track switch real-time
- [ ] MKV subtitle track switch real-time
- [ ] Extract audio → MP3 192kbps file saved
- [ ] Extract subtitle → giữ nguyên format (`.ass` → `.ass`)
- [ ] Extract subtitle → convert sang `.srt`
- [ ] Bitmap track (PGS/VOBSUB) → disable extract + warn "image-based, not supported"
- [ ] Export overwrite confirmation: if file exists, show "Overwrite existing file?" dialog with Cancel/Overwrite

### Condense audio [P3]

- [ ] Condense audio → MP3 output, silence removed
- [ ] Merge gap <1300ms (no stutter)
- [ ] Pad ±500ms (context preserved)
- [ ] Filter: skip lines matching `^\[.*\]$` (e.g., [MUSIC], [APPLAUSE]) and lines wrapped in parentheses `(singing)`, `(laughs)`
- [ ] OP/ED filter: Phase 1 = skip entirely. Phase 3 = chapter-based if MKV metadata available.
- [ ] Re-timed SRT output matches condensed audio timeline
- [ ] Condense progress: progress bar with %, ETA, cancel button
- [ ] Condense audio: 10min video → processing completes without browser freeze (UNVERIFIED — target <60s requires benchmarking)

### Library

- [ ] [P1] Resume position: close at 120s → reopen → continue from 120s
- [ ] [P1] History: list video đã mở, sort by lastWatchedAt, click → reopen
- [ ] [P2] Bookmark: add bookmark at time T with optional note → list → click → seek to T
- [ ] [P2] Folder watch: pick folder → scan videos → library list → click → play
- [ ] [P2] Thumbnail: Phase 1 = generic video icon. Phase 2 = `<video>` seek to 10% + canvas capture, lazy on scroll, store in IndexedDB.

### Performance (UNVERIFIED — requires benchmarking on target devices)

- [ ] Player page initial load < 3s (excluding video file) — TO BE MEASURED
- [ ] Subtitle auto-match < 500ms — TO BE MEASURED
- [ ] Track switch < 1s — TO BE MEASURED
- [ ] Condense audio: 10min video → < 60s processing (offscreen worker) — UNVERIFIED. NOTE: lamejs reports show variable performance (may be 1x real-time or slower). 6x real-time processing unlikely on 1GB RAM devices.
- [ ] ffmpeg.wasm not loaded until legacy codec detected (check network tab)

> `navigator.deviceMemory`: Chrome 63+ only, Firefox NOT supported. Mobile detection must use fallback (e.g., `navigator.userAgent` mobile detection + `hardwareConcurrency`).

## Architecture

### Entrypoint

New entrypoint `src/entrypoints/local-player/` theo pattern sidepanel:
- `index.html` → `main.tsx` → `ThemeProvider` → `ErrorBoundary` → `App`
- `global.css` imports `tokens.css` + `scrollbars-document.css`
- Add to `vite.config.ts` `rollupOptions.input`
- Add to `manifest.json` `web_accessible_resources`

### File access flow (File System Access API)

```
[User opens player page via extension icon]
        ↓
[EmptyState: "Open file" button + drag-drop zone]
        ↓
[showOpenFilePicker() — user picks video file]
   OR [drag-drop video file onto dropzone]
        ↓
[Player loads video via URL.createObjectURL(file)]
        ↓
[useSubtitleMatch: showDirectoryPicker() OR use parent directory of picked file]
   - Use `id` parameter in showDirectoryPicker() to help Chrome remember last-picked directory
   - List subtitle files in same folder (filter by extension)
   - Match base name + language priority
        ↓
[If subtitle found → load + render bilingual]
[If no subtitle → show "No subtitle found" + "Open subtitle file" button]
```

> **Permission persistence:** Handles stored in IndexedDB require `requestPermission()` re-prompt on each session. Extension pages (`chrome-extension://`) do NOT get PWA-style automatic permission persistence — user will see permission prompt on every browser session unless using PWA installation flow. Use `id` parameter in `showDirectoryPicker()` to help Chrome remember the last-picked directory.

### Subtitle match algorithm

```typescript
// Pure logic in features/local-player/logic/subtitleMatch.ts

// Step 1: Strip resolution suffix
//   Adele-Hello-Official-Music-Video_1080p.mp4 → Adele-Hello-Official-Music-Video
const RESOLUTION_RE = /[_\-.](?:4320|2160|1440|1080|720|576|480|360|240|144)p?(?:[_\-.].*)?$/i;
// ponytail: non-standard suffixes (_4K, _HDR, _DV, _REMUX) not stripped — upgrade: extend RESOLUTION_RE

// Step 2: List subtitle files in same folder (via File System Access API directory handle)
//   Filter: .srt, .vtt, .ass, .ssa, .ttml, .dfxp, .sbv, .smi

// Step 3: Match base name (case-insensitive)
//   Adele-Hello-Official-Music-Video.srt → match
//   Adele-Hello-Official-Music-Video.en.srt → match + lang=en
//   Adele-Hello-Official-Music-Video_1080p.srt → match (strip suffix on subtitle too)

// Step 4: Language priority (LOCKED decision)
//   1. Exact match target lang: filename.en.srt (targetLang=en) → target
//   2. Exact match native lang: filename.vi.srt (nativeLang=vi) → native
//   3. ISO 639-2 fallback: filename.eng.srt → en (via ISO_639_2_TO_639_1)
//   4. BCP 47 subtag: filename.zh-Hans.srt → zh (via languageMatches)
//   5. No lang suffix: filename.srt → target (fallback)
//   6. Multiple matches same lang → sort alphabetically, default = first

// Step 5: If multiple subtitle files → show TrackSelector, default = profile target
```

**Edge cases (tested in subtitleMatch.test.ts):**
- Multi-resolution suffix: `_1080p`, `_720p`, `_480p`, `_360p`, `_240p`, `_144p`. Ponytail: `_4K`, `_HDR`, `_DV`, `_REMUX` not covered.
- Language suffix variants: `.en.srt`, `.eng.srt`, `.en-US.srt`, `.zh-Hans.srt`
- Case sensitivity: `Movie.EN.srt` vs `movie.en.srt` (case-insensitive match)
- No subtitle found → empty state + "Open subtitle file" button
- Multiple subtitle same lang → sort alphabetically, default = first
- Bilingual SRT (single file, target + native interleaved) → parse via `parseBilingualSrt`
- Subtitle in subfolder (`subs/` directory) → scan 1 level deep (File System Access API supports recursive scan with explicit permission)

### Unified subtitle pipeline

```
[Any format: SRT/VTT/ASS/SSA/TTML/SBV/SMI]
        ↓
[Parse to SrtCue[] or convert to SRT string then parse]
  - SRT: parseSrt() directly
  - VTT: convertVttToSrt() → parseSrt()
  - ASS/SSA: convertAssToSrt() → parseSrt()
  - TTML: convertTtmlToSrt() → parseSrt() (or parseTtml() directly)
  - SBV: convertSbvToSrt() → parseSrt()  [NEW]
  - SMI: convertSmiToSrt() → parseSrt()  [NEW]
        ↓
[SrtCue[] or BilingualCue[]]
        ↓
[SubtitleBlock renders with OverlayStyleConfig — player controls styling]
```

Player own the styling — không giữ source format styling (ASS positioning, VTT CSS). Tất cả render qua `SubtitleBlock` với `targetStyle` + `nativeStyle` từ settings.

### Video decode pipeline

```
[Video file loaded]
        ↓
[Detect container format: .mp4/.webm/.ogg → native, .mkv/.ts/.flv/.avi/.wmv → web-demuxer]
        ↓
[Tier 1: MP4/WebM/OGG → native HTML5 <video src>]  [P1]
[Tier 2: MKV/TS/FLV/AVI/WMV → web-demuxer demux → WebCodecs decode → MSE → <video>]  [P2]
[Tier 3: Rare legacy codecs not supported by web-demuxer → ffmpeg.wasm transcode → fMP4 → MSE]  [P3]
        ↓
[<video> element in PlayerView — preserves SubtitleCueEngine/PiP/fullscreen compatibility]
```

> **CRITICAL — Canvas vs HTMLVideoElement incompatibility:** WebCodecs decode + Canvas rendering is INCOMPATIBLE with existing components:
> - `SubtitleCueEngine` requires `HTMLVideoElement` (calls `video.currentTime`, `video.play()`, `video.pause()`)
> - `PiPButton` requires `HTMLVideoElement` PiP API (Canvas PiP requires experimental Document PiP API)
> - Fullscreen with subtitle overlay doesn't work the same with Canvas
> - `captureStream()` doesn't exist on Canvas
>
> **Resolution:** Use MSE (MediaSource Extensions) to feed WebCodecs output back into an `<video>` element — preserves SubtitleCueEngine/PiP/fullscreen compatibility. **This is a research spike (see Research Spikes #1).** If MSE approach proves infeasible, defer Tier 2/3 to Phase 2+ and ship Tier 1 only in Phase 1.

**Tier 3 guard:**
```typescript
if (isLegacyCodec(filename) && !isSufficientMemory()) {
  showError('Format not supported on this device. Requires ffmpeg.wasm (~25MB) and sufficient RAM.');
  // disable play, show message
}

function isSufficientMemory(): boolean {
  // navigator.deviceMemory: Chrome 63+ only, Firefox NOT supported
  if (typeof navigator.deviceMemory === 'number') {
    return navigator.deviceMemory >= 4;
  }
  // fallback: hardwareConcurrency + userAgent mobile detection
  return navigator.hardwareConcurrency >= 4 && !isMobileUserAgent();
}
```

### Track extraction flow [P2]

```
[User clicks "Extract audio" or "Extract subtitle"]
        ↓
[TrackSelector shows available tracks from web-demuxer getMediaInfo()]
        ↓
[User selects track + output format]
        ↓
[Audio extraction]:
  web-demuxer.readMediaPacket('audio', start, end) → raw audio packets
  → WebCodecs AudioDecoder → Float32 PCM
  → Float32 → Int16 conversion (multiply by 32767, clamp)
  → lamejs (MP3) encode
  → save via File System Access API (prompt before overwrite)

[Subtitle extraction]:
  web-demuxer extract embedded subtitle track → track text + format
  → if "convert to SRT": convertAssToSrt/convertVttToSrt
  → save via File System Access API (prompt before overwrite)
```

> **Removed:** `@cryguy/mkv-subtitle-extractor` — use web-demuxer for embedded subtitle extraction instead.
> **AAC encoding:** Deferred to P3. WebCodecs AudioEncoder outputs `EncodedAudioChunk` (elementary stream), NOT playable files — needs muxer (mp4-muxer or mediabunny). WebCodecs AAC encoding not supported on Firefox/Linux. P2 ships MP3 only (lamejs, pure JS, universal support).

### Condense audio flow [P3]

```
[User clicks "Condense audio"]
        ↓
[CondenseDialog: configure padding (default 500ms), merge gap (default 1300ms), filters, output format (MP3 only P3)]
        ↓
[Step 1: Parse subtitle → (start, end) cues]
[Step 2: condenseAudio.ts — merge gaps <1300ms, pad ±500ms, filter sound effects]
  - Non-dialogue filter (LOCKED): skip lines matching ^\[.*\]$ (e.g., [MUSIC], [APPLAUSE])
    and lines wrapped in parentheses (singing), (laughs)
  - OP/ED filter (LOCKED): Phase 1 = skip entirely. Phase 3 = chapter-based if MKV metadata available.
[Step 3: For each segment → extract audio from video]
  - Tier 1 (MP4): web-demuxer extract audio track → WebCodecs AudioDecoder → PCM
    (if moov atom at start; fallback to real-time captureStream — document as slow)
  - Tier 2 (MKV): web-demuxer → WebCodecs AudioDecoder → PCM slice
  - Tier 3 (legacy): ffmpeg.wasm -ss {start} -t {duration} -i input → audio
[Step 4: Process PCM in OfflineAudioContext (slice, concat)]
  → encode MP3 (lamejs)
[Step 5: condenseRetime.ts — re-time subtitle cues to match condensed timeline]
[Step 6: Save audio + re-timed SRT via File System Access API (prompt before overwrite)]
        ↓
[CondenseProgress: progress bar with %, ETA, cancel button]
```

> **CRITICAL fix:** `captureStream()` + AudioContext "slice" is INVALID — `OfflineAudioContext` doesn't support `createMediaElementSource()`, and `captureStream` is real-time only. Corrected approach: use web-demuxer to extract audio track → WebCodecs AudioDecoder → PCM → process in OfflineAudioContext (slice, concat, encode).

> **Runs in offscreen document** (Web Workers for parallel segment extraction, pattern: `transmuxWorker.ts`). See Service Worker Lifetime Handling below.

### Library storage

**IndexedDB** (pattern: `baseRepository.ts` + `dictionaryRepository.ts`):

```
DB: orca-media-library (schema version 1)
Stores:
  - videos: { id, filename, title, durationMs, addedAt, lastWatchedAt, resumePositionMs, folderHandleId? }
    (resumePositionMs merged into videos — no separate resumePositions store)
  - bookmarks: { id, videoId, timeMs, note?, createdAt } (index: by_videoId)
  - history: { id, videoId, watchedAt, durationWatchedMs } (index: by_videoId, by_watchedAt)
  - folderHandles: { id, name, handle (FileSystemDirectoryHandle) }
    WARNING: Handles retrieved from IndexedDB require user activation + requestPermission()
    to regain access. Extension pages do NOT get automatic permission persistence like installed PWAs.
```

> **Fix:** `resumePositions` merged into `videos` store as `resumePositionMs` field — separate store adds unnecessary join complexity.

**Zustand store** (`localPlayerStore.ts`):
- `currentVideo: VideoMeta | null`
- `isPlaying: boolean`
- `currentTimeMs: number`
- `durationMs: number`
- `library: VideoMeta[]` (cached from IndexedDB)
- `bookmarks: Bookmark[]` (for current video)
- Actions: `loadVideo`, `play`, `pause`, `seek`, `loadLibrary`, `addBookmark`, etc.

### Message types (new)

| Type | Direction | Payload | Response | Phase |
|------|-----------|---------|----------|-------|
| `EXTRACT_AUDIO` | player → bg | `{ videoFile, trackIndex, format: 'mp3', bitrate }` | `{ success, downloadId? }` | P2 |
| `EXTRACT_SUBTITLE` | player → bg | `{ videoFile, trackIndex, convertToSrt: boolean }` | `{ success, downloadId? }` | P2 |
| `CONDENSE_AUDIO` | player → bg | `{ videoFile, subtitleContent, format, padding, mergeGap, filters }` | `{ success, downloadId? }` | P3 |
| `GET_LIBRARY` | player → bg | `{ sortBy? }` | `{ videos: VideoMeta[] }` | P1 |
| `SAVE_RESUME_POSITION` | player → bg | `{ videoId, timeMs, durationMs }` | `{ success }` | P1 |
| `ADD_BOOKMARK` | player → bg | `{ videoId, timeMs, note? }` | `{ success, bookmarkId? }` | P2 |
| `GET_BOOKMARKS` | player → bg | `{ videoId }` | `{ bookmarks: Bookmark[] }` | P2 |
| `DELETE_BOOKMARK` | player → bg | `{ bookmarkId }` | `{ success }` | P2 |
| `SCAN_FOLDER` | player → bg | `{ folderHandleId }` | `{ videos: VideoMeta[] }` | P2 |
| `KEEP_ALIVE` | offscreen → bg | `{ operationId }` | `{ alive: true }` | P3 |

Background routes heavy processing (extract/condense) to offscreen document.

### Service worker lifetime handling

> Extension service workers terminate after 30s inactivity (Chrome 110+). Long-running condense operations (60s+ for 10min video) may trigger SW termination.

**Mitigation:**
- Long operations (>30s) send keep-alive messages from offscreen worker → background SW every 25s
- Use `chrome.alarms` as backup keep-alive mechanism
- Offscreen document lifetime: depends on `reason` — `AUDIO_PLAYBACK` closes after 30s without audio. Use appropriate reason for processing tasks.
- Large data transfer: use `MessagePort`/transferable objects (ArrayBuffer transfer), NOT `chrome.runtime.sendMessage` (JSON serialization limits)

### Settings integration

New settings slice in `DEFAULT_SETTINGS`:

```typescript
interface LocalPlayerSettings {
  defaultCondensePadding: number;      // 500 (ms)
  defaultCondenseMergeGap: number;     // 1300 (ms)
  defaultCondenseFormat: 'mp3';        // 'mp3' only P3, AAC deferred
  defaultCondenseBitrate: number;       // 192 (kbps for MP3)
  autoResume: boolean;                  // true — auto-continue from last position
  folderWatchEnabled: boolean;          // false
  lastFolderHandleId: string | null;    // for restoring folder watch on reopen (requires re-prompt)
}
```

Schema migration v21 → v22 in `settingsStore.ts`. New "Local Player" section in `SettingsDialogContent.tsx`.

## Cross-Browser Limitations

| Feature | Chrome | Firefox | Edge/Brave | Mitigation |
|---------|--------|---------|------------|------------|
| File System Access API | 86+ | NOT supported | 86+ (Chromium) | Show "unsupported browser" message on Firefox |
| WebCodecs | 94+ | Partial (no AAC encode on Linux) | 94+ (Chromium) | Fallback to Tier 1 native only |
| `navigator.deviceMemory` | 63+ | NOT supported | 63+ (Chromium) | Fallback: `hardwareConcurrency` + UA mobile detection |
| AAC encoding (WebCodecs) | Supported | NOT supported (Linux) | Supported | P3: use ffmpeg.wasm for AAC instead of WebCodecs |
| ffmpeg.wasm multi-threaded | Requires cross-origin isolation — **CAN opt in via manifest keys** (`cross_origin_embedder_policy` + `cross_origin_opener_policy`, Chrome 93+) | Same | Same | Add manifest keys for P3. Source: [Chrome — Cross-origin isolation](https://developer.chrome.com/docs/extensions/develop/concepts/cross-origin-isolation). Sandboxed iframes do NOT get isolation. |
| OPFS | Supported | Partial | Supported | Handle `QuotaExceededError` for large files |

## Research Spikes

> Must be completed before implementing the corresponding phase. Findings already source-verified are marked ✅.

| # | Spike | Phase gate | What to verify | Status |
|---|-------|------------|----------------|--------|
| 1 | MSE + WebCodecs pipeline for Tier 2/3 | P2 | Feed WebCodecs decode output back into `<video>` via MSE — preserves SubtitleCueEngine/PiP/fullscreen compatibility. If infeasible, defer Tier 2/3. | Open |
| 2 | lamejs performance benchmark on 1GB RAM device | P3 | Encode 10min audio on target device. Measure actual time vs 60s target. Adjust condense target if needed. Author claims 20x realtime but UNVERIFIED independently. | Open |
| 3 | File System Access API permission persistence in extension context | P1 | ✅ **Source-verified**: handles CAN be stored in IndexedDB, permission reverts to "prompt" on retrieval, `requestPermission()` needs user gesture. Chrome 122+ has improved persistent permissions. `showDirectoryPicker()` accepts `id` parameter. Source: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), [Chrome — Persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api). Remaining: test in actual `chrome-extension://` page context. | Partially verified |
| 4 | ffmpeg.wasm multi-threaded in extension context | P3 | ✅ **Source-verified**: Chrome extensions CAN opt into cross-origin isolation via manifest keys `cross_origin_embedder_policy` + `cross_origin_opener_policy` (Chrome 93+). Multi-threaded `@ffmpeg/core-mt` CAN work. Sandboxed iframes do NOT get isolation. Source: [Chrome — Cross-origin isolation](https://developer.chrome.com/docs/extensions/develop/concepts/cross-origin-isolation). Remaining: benchmark transcode speed + RAM on 1GB device, verify WORKERFS/MEMFS+OPFS integration. | Partially verified |
| 5 | web-demuxer mini build format coverage | P2 | ✅ **Source-verified from [README](https://github.com/bilibili/web-demuxer)**: Mini (493KB) supports mov/mp4/mkv/webm/m4v only. Full (1131KB) adds avi/flv/mpeg/asf/mpegts/wmv. **Decision**: use Full build — AVI/FLV/WMV require it. API confirmed: `getMediaStream('subtitle')` + `readMediaPacket('subtitle')` for embedded subtitle extraction. | ✅ Verified |
| 6 | WebCodecs audio encoding support matrix | P2/P3 | ✅ **Source-verified from [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)**: MP3 encode 0%, AAC encode 90.1% (no Firefox/Linux), Opus encode 96.1%. `AudioEncoder` outputs `EncodedAudioChunk` (needs muxer). `AudioData` is f32-planar (needs Int16 conversion for lamejs). | ✅ Verified |

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| MSE + WebCodecs pipeline infeasible → Tier 2/3 blocked | CRITICAL | MEDIUM | Research spike #1 before P2. Fallback: defer Tier 2/3, ship Tier 1 only. |
| COOP/COEP prevents ffmpeg.wasm multithreading | CRITICAL | CERTAIN | Use single-threaded `@ffmpeg/core`, accept 2-4x slowdown. |
| Canvas rendering breaks SubtitleCueEngine/PiP/fullscreen | CRITICAL | HIGH | Use MSE to feed WebCodecs output into `<video>` (preserves compatibility). |
| lamejs too slow for condense target | HIGH | MEDIUM | Research spike #2. Adjust targets or use different encoder. |
| Service worker terminates during long condense operation | MEDIUM | MEDIUM | Keep-alive messaging every 25s + `chrome.alarms` backup. |
| `navigator.deviceMemory` not supported on Firefox | LOW | MEDIUM | Fallback: `hardwareConcurrency` + UA mobile detection. |
| Performance targets unmet on 1GB RAM devices | MEDIUM | HIGH | Benchmark early (research spike #2, #4). Adjust scope or targets. |
| File System Access API permission re-prompt UX friction | MEDIUM | HIGH | Document limitation. Use `id` parameter for directory memory. Consider PWA installation flow. |
| OPFS QuotaExceededError for large video files | MEDIUM | MEDIUM | Handle error gracefully, show user message, chunk large files. |
| Stale file handles after browser restart | MEDIUM | HIGH | Re-prompt permission on handle retrieval. Show "re-connect folder" UI. |

## Failure Scenarios

### Stale file handles
- **Scenario:** User picks folder via File System Access API. Browser restarts. Handle retrieved from IndexedDB but permission revoked.
- **Impact:** Library shows folder but clicking "scan" fails.
- **Recovery:** Re-prompt `requestPermission()` on handle retrieval. Show "Re-connect folder" button if denied.

### Wrong subtitle selected automatically
- **Scenario:** Profile target=en. Folder has `Movie.en.srt` (signs/songs only) and `Movie.en.forced.srt` (dialogue). Auto-match picks `Movie.en.srt` (alphabetically first).
- **Impact:** User watches 30 minutes before realizing subtitles are wrong.
- **Mitigation:** Sort alphabetically, default = first. User can switch via TrackSelector. Document that "forced" vs "full" distinction is not auto-detected.

### Moved/renamed files
- **Scenario:** User moves video file after adding to library. IndexedDB stores `filename` + `folderHandleId`.
- **Impact:** Clicking library entry → file not found.
- **Recovery:** Show "File not found — re-import" message. Store `FileSystemFileHandle` when possible (persists across moves within same permission scope).

### Privacy implications of folder watch
- **Scenario:** User picks `/Users/username/Documents/` for folder watch. Extension scans all files.
- **Impact:** Privacy concern — extension reads non-video files.
- **Mitigation:** Filter by video extension BEFORE reading file content. Document in UI: "Scans video files only (.mp4, .mkv, .webm, etc.)". Show disclosure before scan.

### Hearing-impaired track selection
- **Scenario:** MKV has 3 English tracks: `eng` (dialogue), `eng:cc` (closed captions), `eng:sdh` (SDH — hearing impaired). Profile target=en.
- **Gap:** No priority for track types. Default may pick SDH (includes [MUSIC], [APPLAUSE] tags).
- **Mitigation:** P2: show track type labels in TrackSelector. P3: add track type priority (dialogue > cc > sdh).

### Nested folders
- **Scenario:** User has `/Movies/Action/2024/Movie.mp4` and `/Movies/Subs/Action/Movie.srt`.
- **Impact:** Auto-match fails (subtitle not in same folder).
- **Recovery:** P1: scan 1 level deep only. User can manually drag-drop subtitle. P2: consider recursive scan with explicit permission.

### Multiple editions/cuts
- **Scenario:** Folder has `Movie_1080p_Theatrical.mp4` and `Movie_1080p_DirectorsCut.mp4`. Both have `Movie.srt`.
- **Impact:** Resolution stripping doesn't account for edition suffixes. Subtitle may be out of sync for Director's Cut.
- **Mitigation:** Ponytail: regex doesn't cover edition suffixes. User must manually verify sync.

## Open Questions

### Resolved

1. **File System Access API vs fetch file://** — **DECISION:** Use File System Access API (`showOpenFilePicker` / `showDirectoryPicker`) for ALL file access. `fetch('file:///path/to/folder/')` is unreliable across platforms. Requires user gesture for first folder access. Handle permission re-prompt on reload via IndexedDB handle retrieval + `requestPermission()`. Use `id` parameter in `showDirectoryPicker()` to help Chrome remember last-picked directory.

2. **Thumbnail generation** — **DECISION:** Phase 1 = generic video icon. Phase 2 = `<video>` seek to 10% + canvas capture, lazy on scroll, store in IndexedDB. Fallback image if video corrupted.

3. **OP/ED chapter detection** — **DECISION:** Phase 1 = skip filter entirely. Phase 3 = chapter-based if MKV metadata available (via web-demuxer `getMediaInfo`). MP4 has no standard chapter metadata — filter is no-op for MP4.

4. **Condense progress** — **DECISION:** Real-time progress bar with %, ETA, cancel button. Worker `postMessage` progress updates every 1s.

5. **Subtitle match priority** — **DECISION:** See locked priority table in Subtitle match algorithm above. Sort multiple matches alphabetically, default = first.

6. **Non-dialogue filter** — **DECISION:** Skip lines matching `^\[.*\]$` (e.g., [MUSIC], [APPLAUSE]) and lines wrapped in parentheses `(singing)`, `(laughs)`.

7. **Export overwrite** — **DECISION:** Prompt before overwrite (Option B). Show "Overwrite existing file?" dialog with Cancel/Overwrite.

8. **Folder watch persistence** — **DECISION:** Use File System Access API `id` parameter to help Chrome remember directory. Re-request permission on each session via `requestPermission()`.

9. **Audio encoding** — **DECISION:** MP3 only (lamejs) for P2. AAC deferred to P3 via ffmpeg.wasm (WebCodecs AudioEncoder has platform gaps + needs muxer).

### New open questions (from research spikes)

10. **MSE + WebCodecs pipeline feasibility** — Can WebCodecs decode output be reliably fed into `<video>` via MSE? If not, Tier 2/3 deferred indefinitely. (Research spike #1)

11. **lamejs actual performance on 1GB RAM** — Is <60s for 10min video achievable? If not, what's the realistic target? (Research spike #2)

12. **ffmpeg.wasm single-threaded RAM ceiling** — What's the actual RAM usage on target devices? Does WORKERFS + OPFS integration work for large files? (Research spike #4)

13. **web-demuxer mini build coverage** — Does the 493KB mini build support all claimed formats, or do some require the full 1.1MB build? (Research spike #5)

## Reuse Summary

### Fully reusable (no adaptation)

| Component | File | What it does |
|-----------|------|--------------|
| `parseSrt` | `shared/lib/parsers/srtParser.ts` | SRT parser |
| `parseVtt` | `shared/lib/parsers/vttParser.ts` | VTT parser |
| `parseTtml` | `shared/lib/parsers/ttmlParser.ts` | TTML parser |
| `parseAss` | `shared/lib/parsers/assParser.ts` | ASS/SSA parser |
| `convertAssToSrt` | `shared/lib/parsers/assToSrt.ts` | ASS → SRT |
| `convertVttToSrt` | `shared/lib/parsers/vttToSrt.ts` | VTT → SRT |
| `convertTtmlToSrt` | `shared/lib/parsers/ttmlToSrt.ts` | TTML → SRT |
| `parseSubtitle` | `features/subtitle/logic/subtitleParser.ts` | Unified parser adapter |
| `parseBilingualSrt` | `features/subtitle/logic/subtitleBilingualParser.ts` | Bilingual SRT parser |
| `SubtitleCueEngine` | `features/subtitle/ui/subtitleCueEngine.ts` | Cue/time/repeat engine (works with any HTMLVideoElement) |
| `NavCluster` | `features/subtitle/ui/NavCluster.tsx` | 6-button nav cluster |
| `CueList` | `entrypoints/sidepanel/components/CueList.tsx` | Subtitle list + seek-on-click |
| `SubtitleBlock` | `features/subtitle/ui/SubtitleBlock.tsx` | Subtitle render (props mode) |
| `SubtitlePanel` | `features/subtitle/ui/SubtitlePanel.tsx` | Panel wrapper for CueList |
| `SubtitleHint` | `features/subtitle/ui/SubtitleHint.tsx` | Drag-drop hint |
| `SubtitleToast` | `features/subtitle/ui/SubtitleToast.tsx` | Toast notifications |
| `subtitleOffset.ts` | `features/subtitle/logic/subtitleOffset.ts` | Pure offset logic |
| `subtitleDragDrop.ts` | `features/subtitle/logic/subtitleDragDrop.ts` | File drag-drop parse |
| `subtitleImport.ts` | `features/subtitle/logic/subtitleImport.ts` | File import + role assign |
| `subtitleShortcuts.ts` | `features/subtitle/ui/subtitleShortcuts.ts` | Keyboard shortcut handler |
| `PlayPauseButton` | `shared/domain/video/atoms/PlayPauseButton.tsx` | Play/pause toggle |
| `Timeline` | `shared/domain/video/atoms/Timeline.tsx` | Seek bar (seek bar only — chapter markers/bookmark indicators must be added as overlay) |
| `VolumeControl` | `shared/domain/video/atoms/VolumeControl.tsx` | Volume + mute |
| `FullscreenButton` | `shared/domain/video/atoms/FullscreenButton.tsx` | Fullscreen toggle |
| `PiPButton` | `shared/domain/video/atoms/PiPButton.tsx` | PiP toggle |
| `SkipButton` | `shared/domain/video/atoms/SkipButton.tsx` | Seek ±N seconds |
| `TimeDisplay` | `shared/domain/video/atoms/TimeDisplay.tsx` | Time formatter |
| `CaptionsButton` | `shared/domain/video/atoms/CaptionsButton.tsx` | CC toggle |
| `playerModeGeometry.ts` | `features/subtitle/logic/playerModeGeometry.ts` | Pure layout calculations |
| `baseRepository.ts` | `features/dictionary/repositories/baseRepository.ts` | IndexedDB pattern |
| `languageMatches` | `shared/config/languageRegistry.ts` | BCP 47 language matching |
| `fileUtils.ts` | `shared/utils/fileUtils.ts` | Filename utilities |
| `ThemeProvider` | `features/theme/ui/ThemeProvider.tsx` | Theme system |
| `MessageBus` | `entrypoints/background/messageBus.ts` | Typed message bus |
| `opfsStorage.ts` | `shared/lib/storage/opfsStorage.ts` | OPFS for temp files |
| `Offscreen document` | `entrypoints/offscreen/ffmpegRunner.ts` | WASM processing host |
| `Web Worker pattern` | `entrypoints/offscreen/transmuxWorker.ts` | Parallel processing template |

### Build new

| Component | Purpose | Phase |
|-----------|---------|-------|
| `src/entrypoints/local-player/*` | New entrypoint (player page) | P1 |
| `src/features/local-player/logic/subtitleMatch.ts` | File-based subtitle matching | P1 |
| `src/features/local-player/logic/condenseAudio.ts` | Condense algorithm | P3 |
| `src/features/local-player/logic/condenseRetime.ts` | Subtitle re-timing | P3 |
| `src/features/local-player/logic/trackExtraction.ts` | Track metadata + conversion plan | P2 |
| `src/features/local-player/logic/librarySort.ts` | Library sorting | P1 |
| `src/features/local-player/services/mediaLibraryRepository.ts` | IndexedDB CRUD | P1 |
| `src/features/local-player/services/folderWatchService.ts` | File System Access API + re-prompt | P2 |
| `src/features/local-player/services/audioExtractionService.ts` | Audio extraction orchestration | P2 |
| `src/features/local-player/services/subtitleExtractionService.ts` | Subtitle extraction orchestration (web-demuxer) | P2 |
| `src/features/local-player/services/condenseService.ts` | Condense orchestration | P3 |
| `src/shared/lib/parsers/sbvParser.ts` | SBV parser | P1 |
| `src/shared/lib/parsers/smiParser.ts` | SMI parser | P1 |
| `src/shared/domain/video/atoms/PlaybackSpeedControl.tsx` | Speed selector (0.25x-2x) — does NOT exist in codebase, must build new | P1 |
| `src/entrypoints/offscreen/audioExtractWorker.ts` | Audio extraction worker | P2 |
| `src/entrypoints/offscreen/condenseWorker.ts` | Condense processing worker | P3 |
| `src/entrypoints/background/localPlayerHandlers.ts` | Message handlers + keep-alive | P1 |

> **Removed from reuse table:** `PlaybackSpeedControl` — does NOT exist at `src/shared/domain/video/atoms/PlaybackSpeedControl.tsx`. Moved to "Build new" section.

---

## Review Log

> Synthesized from 3 adversarial review reports (2026-08-20).

### Critical resolutions applied

1. **Removed file:// redirect flow entirely.** Both adversarial reviewers confirmed it's technically infeasible for production extensions (content scripts can't reliably run on file://, fetch directory listing doesn't work, "default app" registration impossible for extensions). Replaced with File System Access API (`showOpenFilePicker` / `showDirectoryPicker`). Removed user story #1 (double-click open), file:// redirect architecture section, `useFileRedirect` hook, `fileRedirect.ts` content script.

2. **File System Access API for ALL file access.** Documented that handles stored in IndexedDB require `requestPermission()` re-prompt on each session (extension pages don't get PWA-style persistent permissions). Use `id` parameter in `showDirectoryPicker()` to help Chrome remember last-picked directory.

3. **Fixed video decode pipeline.** web-demuxer already supports MKV/TS/FLV/AVI/WMV — no need for ffmpeg.wasm for those. Corrected tiers: Tier 1 (native), Tier 2 (web-demuxer + WebCodecs), Tier 3 (ffmpeg.wasm for rare legacy only). Documented Canvas vs HTMLVideoElement incompatibility — recommend MSE approach to feed WebCodecs output back into `<video>`. Marked as research spike.

4. **Fixed audio encoding.** WebCodecs AudioEncoder outputs EncodedAudioChunk (elementary stream), NOT playable files — needs muxer. WebCodecs AAC not supported on Firefox/Linux. Corrected: MP3 (lamejs) only for P2, AAC via ffmpeg.wasm in P3.

5. **Fixed condense audio architecture.** `captureStream()` + AudioContext "slice" is invalid — OfflineAudioContext doesn't support `createMediaElementSource()`, captureStream is real-time only. Corrected: web-demuxer → WebCodecs AudioDecoder → PCM → OfflineAudioContext (slice, concat, encode).

6. **Fixed ffmpeg.wasm constraints.** ~~Multi-threaded `@ffmpeg/core-mt` requires COOP/COEP headers which `chrome-extension://` pages CANNOT set.~~ **SOURCE VERIFICATION CORRECTION (2026-08-20):** Chrome extensions CAN opt into cross-origin isolation via manifest keys `cross_origin_embedder_policy` + `cross_origin_opener_policy` (Chrome 93+). Multi-threaded `@ffmpeg/core-mt` CAN work in extension pages. Source: [Chrome — Cross-origin isolation](https://developer.chrome.com/docs/extensions/develop/concepts/cross-origin-isolation). Single-threaded `@ffmpeg/core` still needed as fallback. RAM usage UNVERIFIED — requires benchmarking.

7. **Removed @cryguy/mkv-subtitle-extractor.** 0 stars, 6 weekly downloads, created Jan 2026, unknown maintainer. Use web-demuxer for MKV embedded subtitle extraction instead.

8. **Fixed web-demuxer size.** Actual: ~1.1MB (full) or ~493KB (mini) gzipped, not ~2-5MB.

9. **Moved PlaybackSpeedControl to "Build new" section.** Does not exist in codebase. Removed from reuse table.

10. **Merged resumePositions into videos store.** `videos: { id, filename, title, durationMs, addedAt, lastWatchedAt, resumePositionMs, folderHandleId? }` — no separate store, no join complexity.

11. **Added phased scope.** Decomposed into 3 phases (P1 MVP, P2 Library + Track Extraction, P3 Condense + Legacy). Each feature/user story marked with phase. Added Non-goals per phase.

12. **Locked product decisions:** subtitle match priority table, non-dialogue filter regex, OP/ED filter (skip P1, chapter-based P3), thumbnail (generic icon P1, canvas capture P2), export overwrite (prompt before), folder watch persistence (`id` parameter + re-prompt).

13. **Added missing acceptance criteria:** File System Access API picker flow, subtitle match failure, condense progress, export overwrite confirmation, mobile format support, browser version requirements, permission denial handling, large file handling, service worker keep-alive.

14. **Marked all performance targets UNVERIFIED.** Added "requires benchmarking on target devices" notes. `navigator.deviceMemory` not supported on Firefox — added fallback.

15. **Added research spikes section:** MSE + WebCodecs pipeline, lamejs performance, File System Access API permission persistence, ffmpeg.wasm single-threaded performance, web-demuxer mini build coverage.

16. **Added risk register** (severity × likelihood) from adversarial engineering review.

17. **Added failure scenarios** from scope challenge: stale file handles, wrong subtitle selected, moved/renamed files, privacy implications of folder watch, hearing-impaired track selection, nested folders, multiple editions.

18. **Updated Open Questions:** resolved #1-9, added new #10-13 from research spikes.

19. **Added cross-browser limitations section:** Firefox/Linux AAC disabled, navigator.deviceMemory fallback, WebCodecs support variance, COOP/COEP constraint.

20. **Added service worker lifetime handling:** keep-alive messages for >30s operations, offscreen document lifetime management, MessagePort/transferable objects for large data.

### Source verification (2026-08-20, via source-driven-development skill)

All external library claims verified against official sources:

| Claim | Source | Status |
|-------|--------|--------|
| web-demuxer size: Full 1131KB / Mini 493KB gzipped | [GitHub README](https://github.com/bilibili/web-demuxer#readme) | ✅ Verified |
| web-demuxer supports embedded subtitle extraction | [README API](https://github.com/bilibili/web-demuxer#getmediastreamtype-mediatype-streamindex-number) — `getMediaStream('subtitle')`, `readMediaPacket('subtitle')` | ✅ Verified |
| web-demuxer format coverage: Full = mov/mp4/avi/flv/mkv/webm/mpeg/asf/mpegts; Mini = mov/mp4/mkv/webm/m4v | [README table](https://github.com/bilibili/web-demuxer#custom-demuxer) | ✅ Verified |
| lamejs API: `Mp3Encoder(channels, sampleRate, kbps)`, `encodeBuffer(Int16Array)`, `flush()` | [GitHub README](https://github.com/zhuker/lamejs#readme) | ✅ Verified |
| lamejs performance: "20x faster than realtime" | [README](https://github.com/zhuker/lamejs#readme) — author claim, not independently benchmarked | ⚠️ Unverified independently |
| ffmpeg.wasm multi-threaded requires SharedArrayBuffer + COOP/COEP | [ffmpeg-cookbook](https://ffmpeg-cookbook.com/en/articles/ffmpeg-sharedarraybuffer-error/) | ✅ Verified |
| **Chrome extensions CAN opt into cross-origin isolation via manifest keys** | [Chrome — Cross-origin isolation](https://developer.chrome.com/docs/extensions/develop/concepts/cross-origin-isolation), [COEP](https://developer.chrome.com/docs/extensions/reference/manifest/cross-origin-embedder-policy), [COOP](https://developer.chrome.com/docs/extensions/reference/manifest/cross-origin-opener-policy) | ✅ Verified — **corrects adversarial review claim** |
| Sandboxed iframes in extensions do NOT get cross-origin isolation | [chromium-extensions discussion](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/lR1th8cacSk) | ✅ Verified |
| File System Access API: handles serializable to IndexedDB | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), [Chrome — Storing handles](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) | ✅ Verified |
| Permission reverts to "prompt" on retrieval, needs `requestPermission()` | [MDN — queryPermission](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission), [Chrome — Persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) | ✅ Verified |
| `requestPermission()` requires transient user activation | [MDN — requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission) | ✅ Verified |
| Chrome 122+ improved persistent permissions (3-way prompt) | [Chrome — Persistent permissions blog](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) | ✅ Verified |
| WebCodecs MP3 encoding: 0% browser support | [MDN — Codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection) | ✅ Verified |
| WebCodecs AAC encoding: 90.1% (no Firefox/Linux) | [MDN — Codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection) | ✅ Verified |
| WebCodecs Opus encoding: 96.1% (MDN-recommended) | [MDN — Codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection) | ✅ Verified |
| `AudioEncoder` outputs `EncodedAudioChunk` (elementary stream, needs muxer) | [MDN — WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) | ✅ Verified |
| `AudioData` uses f32-planar layout | [MDN — Codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection) | ✅ Verified |
