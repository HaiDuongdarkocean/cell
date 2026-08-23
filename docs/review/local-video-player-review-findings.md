# Review Findings: Local Video Player Spec

## Report 1: Technical Architecture Review (c36f687f)

Subagent c36f687f completed successfully:

# Technical Review Report: Local Video Player Specification

**Reviewer**: Independent Senior Browser-Media/Chrome-Extension Technical Lead  
**Spec**: `C:\Users\The0cean\Programming\The0cean ecosystem\cell\docs\specs\local-video-player.md`  
**Date**: 2026-08-20

---

## Verdict

**CONDITIONAL APPROVAL WITH CRITICAL BLOCKERS**

The specification is technically feasible for Chrome 99+ on desktop with significant architectural corrections. The core video decode pipeline (native + web-demuxer + WebCodecs) is sound, but the audio encoding architecture has platform gaps, the file:// access flow has browser version dependencies, and several reuse claims are incorrect.

**Recommendation**: Do not proceed to implementation until critical blockers are resolved. The spec requires major revisions to audio encoding, file:// access strategy, and dependency validation.

---

## Technical Blockers

### 1. **WebCodecs AAC Encoding Platform Gaps** (CRITICAL)

**Spec Claim** (line 39): "Audio encode: lamejs (MP3) + WebCodecs AudioEncoder (AAC)"

**Reality**:
- WebCodecs `AudioEncoder` AAC encoding is **NOT supported** in:
  - Firefox (all platforms)
  - Desktop Linux (all browsers)
  - Partial support on Apple devices
- MP3 encoding via WebCodecs is **NOT supported by any major browser**
- Source: [MDN Codec Selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)

**Impact**: The AAC encoding path will fail on Firefox/Linux. The spec's cross-browser requirement (AGENTS.md line 25) is violated.

**Required Fix**: 
- Remove WebCodecs AudioEncoder for AAC
- Use lamejs for both MP3 and AAC (AAC requires additional library like `aac.js` or ffmpeg.wasm)
- Add browser detection and fallback strategy
- Update success criteria to reflect platform limitations

### 2. **file:// Access Browser Version Dependency** (CRITICAL)

**Spec Claim** (lines 382-394): Content script detects file:// → redirect to player page → player fetches file://

**Reality**:
- `fetch()` in service worker **DOES NOT support file://** (only http/https)
- `fetch()` in chrome-extension:// pages **DOES support file://** since Chrome 99+ (requires `file://*/*` in host_permissions)
- Chrome 98 and older cannot fetch file:// from extension pages
- User must enable "Allow access to file URLs" toggle in chrome://extensions
- Source: [StackOverflow MV3 file:// access](https://stackoverflow.com/questions/66245298/chrome-extension-how-to-access-local-file-with-manifest-v3)

**Impact**: The redirect flow will fail on Chrome 98 and older. The spec does not specify minimum Chrome version.

**Required Fix**:
- Add minimum Chrome version requirement: Chrome 99+
- Add `file://*/*` to host_permissions in manifest.json (line 19)
- Add user-facing error message when toggle is disabled
- Consider alternative: File System Access API for file access (no version requirement, but requires user gesture)

### 3. **@cryguy/mkv-subtitle-extractor Protocol Mismatch** (CRITICAL)

**Spec Claim** (line 50): "@cryguy/mkv-subtitle-extractor — MKV embedded subtitle extraction"

**Reality**:
- Package extracts subtitles from **remote MKV files via HTTP Range requests**
- Does NOT work with local file:// URLs
- Requires HTTP server or custom fetch implementation
- Source: [npm package](https://www.npmjs.com/package/@cryguy/mkv-subtitle-extractor)

**Impact**: Cannot extract embedded subtitles from local MKV files as specified.

**Required Fix**:
- Remove @cryguy/mkv-subtitle-extractor for local file extraction
- Use web-demuxer (which already supports MKV parsing) for embedded subtitle extraction
- Update dependency table to reflect web-demuxer handles both video demux and subtitle extraction

### 4. **PlaybackSpeedControl Component Does Not Exist** (HIGH)

**Spec Claim** (line 165, line 622): "PlaybackSpeedControl.tsx — NEW — speed selector (0.25x-2x), reference YouTubePlayer"

**Reality**:
- File does not exist at `src/shared/domain/video/atoms/PlaybackSpeedControl.tsx`
- Grep search confirms no such file in codebase
- Existing video atoms: PlayPauseButton, Timeline, VolumeControl, FullscreenButton, PiPButton, SkipButton, TimeDisplay, CaptionsButton, MuteButton

**Impact**: Reuse claim is false. Component must be built from scratch.

**Required Fix**:
- Remove from "Fully reusable" table (line 622)
- Move to "Build new" table (line 637)
- Or implement as new shared atom before local player implementation

---

## Invalid/Unsafe Assumptions

### 1. **File System Access API Permission Persistence**

**Spec Claim** (line 529): "folderHandles: { id, name, handle (FileSystemDirectoryHandle) } (for folder watch persistence)"

**Reality**:
- Handles CAN be stored in IndexedDB
- BUT permission state may revert to "prompt" on page reload
- Requires calling `requestPermission()` on handle retrieved from IndexedDB
- User may need to re-grant permission on each session
- Clearing browsing data clears all persisted handles
- Source: [Chrome Dev Blog Persistent Permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)

**Impact**: Folder watch may not persist across browser restarts without user re-approval.

**Required Fix**:
- Add permission re-prompt flow on handle retrieval
- Document that folder watch requires user gesture per session
- Consider chrome.storage.local for folder path string as fallback (less secure but persistent)

### 2. **Subtitle Auto-Match via fetch file:// Directory Listing**

**Spec Open Question** (line 577): "Option A: fetch('file:///path/to/folder/') — Chrome có thể trả directory listing HTML, parse được"

**Reality**:
- `fetch('file:///path/to/folder/')` returns directory listing HTML ONLY on some OS/browser combinations
- Behavior is inconsistent across platforms (Windows vs macOS vs Linux)
- Not a reliable API for directory enumeration
- Source: Chrome file:// protocol behavior is implementation-specific

**Impact**: Subtitle auto-match will fail on many systems.

**Required Fix**:
- Use File System Access API `showDirectoryPicker()` for folder access
- Requires user gesture (not transparent as spec desires)
- Or use WebKitdirectoryEntry on `<input type="file" webkitdirectory>` for folder selection

### 3. **OP/ED Chapter Detection Filter**

**Spec Claim** (line 351): "Filter: skip OP/ED chapters (if chapter metadata available)"

**Reality**:
- MKV chapter metadata is available via web-demuxer
- MP4 has NO standard chapter metadata
- Most MP4 files do not contain chapter information
- Filter will be a no-op for 90% of MP4 files

**Impact**: Condense audio filter will not work for most MP4 files.

**Required Fix**:
- Document that OP/ED filter only works for MKV with chapter metadata
- Remove from default condense configuration
- Or implement subtitle-based OP/ED detection (pattern matching on cue text)

---

## Architecture Corrections

### 1. **Video Decode Pipeline Tier Assignment**

**Spec Claim** (lines 458-465): Three-tier decode pipeline

**Correction Needed**:
- **Tier 1 (MP4/WebM/OGG)**: Native HTML5 `<video>` - CORRECT
- **Tier 2 (MKV/TS)**: web-demuxer + WebCodecs - CORRECT
- **Tier 3 (AVI/FLV/WMV)**: ffmpeg.wasm - INCORRECT

**Reason**: web-demuxer already supports AVI/FLV/WMV (source: [web-demuxer README](https://github.com/bilibili/web-demuxer)). No need for ffmpeg.wasm for these formats.

**Corrected Pipeline**:
- Tier 1: MP4/WebM/OGG → native HTML5
- Tier 2: MKV/TS/FLV/AVI/WMV → web-demuxer + WebCodecs
- Tier 3: Legacy codecs NOT supported by web-demuxer (rare) → ffmpeg.wasm fallback

### 2. **Audio Extraction Architecture**

**Spec Claim** (lines 484-493): web-demuxer → WebCodecs AudioDecoder → lamejs/AAC

**Correction Needed**:
- WebCodecs AudioDecoder outputs PCM
- lamejs requires Int16 PCM input
- WebCodecs AudioDecoder outputs Float32 AudioData
- Requires Float32 → Int16 conversion before lamejs
- AAC encoding via WebCodecs has platform gaps (see Blocker #1)

**Corrected Flow**:
- web-demuxer → WebCodecs AudioDecoder → Float32 PCM
- Float32 → Int16 conversion (multiply by 32767, clamp)
- lamejs (MP3) OR aac.js (AAC) for encoding
- Remove WebCodecs AudioEncoder from pipeline

### 3. **Condense Audio captureStream() Limitations**

**Spec Claim** (lines 506-508): Tier 1 (MP4): <video>.captureStream() → AudioContext → slice

**Reality**:
- `captureStream()` captures real-time playback, not arbitrary seeking
- To extract specific time ranges, must:
  1. Seek video to start time
  2. Play video (muted)
  3. Capture stream for duration
  4. Stop
- This is slow and unreliable for precise segment extraction
- Better approach: web-demuxer can extract audio packets by byte range (for MP4 with proper moov atom)

**Correction Needed**:
- For MP4: Use web-demuxer to extract audio packets directly (if moov atom at start)
- Fallback: captureStream() with muted playback (document as slow/unreliable)
- For MKV: web-demuxer → WebCodecs (correct as spec)

### 4. **IndexedDB Schema Design**

**Spec Claim** (lines 523-530): Separate stores for videos, resumePositions, bookmarks, history, folderHandles

**Correction Needed**:
- `resumePositions` should be merged into `videos` store as a field
- Separate store adds unnecessary join complexity
- `folderHandles` storing FileSystemDirectoryHandle in IndexedDB is correct BUT permission re-prompt required (see Invalid Assumption #1)

**Corrected Schema**:
```
videos: { id, filename, title, durationMs, addedAt, lastWatchedAt, resumePositionMs, folderHandleId? }
bookmarks: { id, videoId, timeMs, note?, createdAt } (index: by_videoId)
history: { id, videoId, watchedAt, durationWatchedMs } (index: by_videoId, by_watchedAt)
folderHandles: { id, name, handle } (for re-prompt flow)
```

---

## Dependency Corrections

### 1. **web-demuxer Size**

**Spec Claim** (line 47): "~2-5MB wasm"

**Reality**:
- Full version: 1131 KB gzipped (~1.1MB)
- Mini version: 493 KB gzipped (~0.5MB)
- Source: [web-demuxer npm](https://www.npmjs.com/package/web-demuxer)

**Correction**: Update to "~500KB (mini) or ~1.1MB (full) gzipped"

### 2. **@ffmpeg/core-mt Size**

**Spec Claim** (line 49): "~31MB"

**Reality**: This is correct for the multi-threaded version. Single-threaded is ~25MB.

**Status**: No correction needed, but document that this is the multi-threaded version.

### 3. **lamejs Size**

**Spec Claim** (line 48): "~100KB"

**Reality**: Correct. lamejs.min.js is ~100KB.

**Status**: No correction needed.

### 4. **Missing Dependency for AAC Encoding**

**Spec Claim** (line 39): "WebCodecs AudioEncoder (AAC)"

**Reality**: WebCodecs AAC encoding has platform gaps (see Blocker #1). Need alternative:

**Required Addition**:
- `aac.js` or similar pure JS AAC encoder
- OR remove AAC output option, support only MP3
- OR use ffmpeg.wasm for AAC (already in dependency list)

---

## Reuse Corrections

### 1. **PlaybackSpeedControl** (FALSE CLAIM)

**Spec Claim** (line 622): "PlaybackSpeedControl — shared/domain/video/atoms/PlaybackSpeedControl.tsx"

**Reality**: File does not exist.

**Correction**: Move to "Build new" section (line 637)

### 2. **Timeline Component** (MISLEADING)

**Spec Claim** (line 618): "Timeline — shared/domain/video/atoms/Timeline.tsx — Seek bar"

**Reality**: Timeline component exists (`src/shared/domain/video/atoms/Timeline.tsx`) but is a seek bar with keyboard navigation, not a full timeline with chapters/bookmarks.

**Correction**: Document that Timeline provides seek bar only. Chapter markers and bookmark indicators must be added as overlay.

### 3. **Subtitle Parsers** (PARTIALLY CORRECT)

**Spec Claim** (lines 597-604): parseSrt, parseVtt, parseTtml, parseAss, convertAssToSrt, convertVttToSrt, convertTtmlToSrt

**Reality**: All exist in `src/shared/lib/parsers/` (verified via `index.ts` line 8-15). SBV and SMI parsers are NEW (correctly identified in "Build new").

**Status**: No correction needed for existing parsers.

### 4. **baseRepository Pattern** (CORRECT)

**Spec Claim** (line 626): "baseRepository.ts — IndexedDB pattern"

**Reality**: Exists at `src/features/dictionary/repositories/baseRepository.ts` with DB schema versioning, migration pattern, and transaction helpers.

**Status**: Reuse is valid. Follow the pattern for mediaLibraryRepository.

### 5. **opfsStorage** (CORRECT)

**Spec Claim** (line 631): "opfsStorage.ts — OPFS for temp files"

**Reality**: Exists at `src/shared/lib/storage/opfsStorage.ts` with appendChunk, createOpfsWriter, cleanupOrphanedDownloads.

**Status**: Reuse is valid.

### 6. **messageBus** (CORRECT)

**Spec Claim** (line 630): "MessageBus — entrypoints/background/messageBus.ts — Typed message bus"

**Reality**: Exists at `src/entrypoints/background/messageBus.ts` with typed MessageRequest/MessageResponse, timeout handling, and tabId injection.

**Status**: Reuse is valid.

---

## Missing Technical Acceptance Criteria

### 1. **Browser Version Requirements**

**Missing**: Minimum Chrome version (99+ for file:// fetch), WebCodecs support (94+), File System Access API (86+)

**Add to Success Criteria**:
- [ ] Chrome 99+ required for file:// fetch
- [ ] Chrome 94+ required for WebCodecs
- [ ] Graceful degradation for older Chrome versions

### 2. **Permission Granting Flows**

**Missing**: User-facing flows for:
- "Allow access to file URLs" toggle enablement
- File System Access API permission re-prompt on reload
- Folder watch permission grant

**Add to Success Criteria**:
- [ ] Show instructions when file:// toggle is disabled
- [ ] Re-prompt for folder handle permission on reload
- [ ] Handle permission denial gracefully

### 3. **Cross-Browser Limitations**

**Missing**: Firefox/Linux limitations for WebCodecs AAC encoding

**Add to Success Criteria**:
- [ ] Detect Firefox/Linux and disable AAC encoding option
- [ ] Show platform-specific message for unsupported features
- [ ] Fallback to MP3-only on unsupported platforms

### 4. **Error Handling for Large Files**

**Missing**: OPFS quota exceeded, IndexedDB RAM limits, message size limits (64MiB)

**Add to Success Criteria**:
- [ ] Handle OPFS QuotaExceededError for large video files
- [ ] Chunk large files to avoid 64MiB message limit
- [ ] Show progress for long-running operations (>30s)

### 5. **Memory Constraints**

**Missing**: RAM limits for ffmpeg.wasm (500MB-2GB), WebCodecs (100-200MB)

**Add to Success Criteria**:
- [ ] Check navigator.deviceMemory before loading ffmpeg.wasm
- [ ] Warn user before ffmpeg.wasm load on low-RAM devices
- [ ] Disable ffmpeg.wasm on mobile (deviceMemory < 4)

---

## Recommended Exact Spec Changes

### 1. Update Tech Stack (lines 31-51)

```diff
- **Video decode:** native HTML5 (MP4/WebM/OGG) + WebCodecs + web-demuxer (MKV/TS) + ffmpeg.wasm lazy-load (AVI/FLV/WMV legacy)
+ **Video decode:** native HTML5 (MP4/WebM/OGG) + web-demuxer (MKV/TS/FLV/AVI/WMV) + WebCodecs + ffmpeg.wasm lazy-load (rare legacy codecs only)
- **Audio encode:** lamejs (MP3) + WebCodecs AudioEncoder (AAC)
+ **Audio encode:** lamejs (MP3) + aac.js (AAC) OR ffmpeg.wasm (AAC fallback)
- **MKV track extraction:** web-demuxer (bilibili) — multi-format demux + WebCodecs integration
+ **MKV track extraction:** web-demuxer (bilibili) — multi-format demux + WebCodecs integration + embedded subtitle extraction
```

### 2. Update New Dependencies (lines 43-51)

```diff
| `web-demuxer` (bilibili) | ~2-5MB wasm | MKV/TS/FLV/AVI demux + WebCodecs | Dynamic import on first MKV/TS file |
+ | `web-demuxer` (bilibili) | ~500KB (mini) or ~1.1MB (full) gzipped | MKV/TS/FLV/AVI/WMV demux + WebCodecs + embedded subtitle extraction | Dynamic import on first non-MP4 file |
| `@cryguy/mkv-subtitle-extractor` | ~50KB | MKV embedded subtitle extraction | Dynamic import on MKV subtitle extract |
- (REMOVE - does not work with file://)
+ | `aac.js` | ~50KB | AAC encoding (pure JS) | Dynamic import on AAC export |
```

### 3. Update Manifest Modifications (line 181)

```diff
| `public/manifest.json` | Add `web_accessible_resources` for local-player page + `unlimitedStorage` permission |
+ | `public/manifest.json` | Add `web_accessible_resources` for local-player page + `unlimitedStorage` permission + `file://*/*` host_permissions |
```

### 4. Update Open Questions (lines 575-590)

```diff
1. **File System Access API vs fetch file://:** Để đọc folder listing (list subtitle files trong cùng folder với video), dùng mechanism nào?
-   - **Option A:** `fetch('file:///path/to/folder/')` — Chrome có thể trả directory listing HTML, parse được. Đơn giản, không cần permission thêm.
-   - **Option B:** File System Access API `showDirectoryPicker()` — user pick folder 1 lần, store handle. Robust hơn nhưng cần user gesture.
-   - **GUESS:** Option A cho auto-match (transparent, no picker), Option B cho folder watch (user explicitly picks). Cần verify Option A hoạt động với file:// + toggle "Allow access to file URLs".
+   - **DECISION:** Use File System Access API `showDirectoryPicker()` for both auto-match and folder watch. fetch('file:///path/to/folder/') is unreliable across platforms. Requires user gesture for first folder access. Handle permission re-prompt on reload via IndexedDB handle retrieval + requestPermission().
```

### 5. Update Reuse Summary (lines 593-634)

```diff
| `PlaybackSpeedControl` | `shared/domain/video/atoms/PlaybackSpeedControl.tsx` | Speed selector (0.25x-2x), reference YouTubePlayer |
- (REMOVE - does not exist)
+ (MOVE to "Build new" section)
```

### 6. Update Success Criteria (lines 299-369)

```diff
+ ### Browser requirements
+ - [ ] Chrome 99+ required for file:// fetch (show error on older versions)
+ - [ ] Chrome 94+ required for WebCodecs (fallback to native only)
+ - [ ] Firefox/Linux: AAC encoding disabled, MP3 only
+ 
### Player core
- [ ] Open video file via drag-drop → video plays within 3s
- [ ] Open video file via file:// redirect → player page loads within 3s
+ [ ] Open video file via file:// redirect → player page loads within 3s (Chrome 99+ only)
+ [ ] Show error message when "Allow access to file URLs" toggle is disabled
```

### 7. Update Architecture - File System Access API (lines 575-580)

```diff
**Constraint:** User must enable "Allow access to file URLs" in chrome://extensions → details. Content script không chạy trên file:// nếu toggle off. Player page hiển thị warning + instructions nếu toggle off.
+ **Constraint:** User must enable "Allow access to file URLs" in chrome://extensions → details. Content script không chạy trên file:// nếu toggle off. Player page hiển thị warning + instructions nếu toggle off. Chrome 99+ required for file:// fetch in extension pages. For folder access, File System Access API requires user gesture; permission may revert to "prompt" on reload, requiring re-approval via requestPermission().
```

---

## Verified Reuse Strengths

The following reuse claims are **VALID** and should be leveraged:

1. **Subtitle Parsers** (`src/shared/lib/parsers/`):
   - parseSrt, parseVtt, parseTtml, parseAss exist and are tested
   - convertAssToSrt, convertVttToSrt, convertTtmlToSrt exist
   - SBV and SMI parsers are NEW additions (correctly identified)

2. **baseRepository Pattern** (`src/features/dictionary/repositories/baseRepository.ts`):
   - Schema versioning (currently v11)
   - Migration pattern (create-all only for fresh DB)
   - Transaction helpers (getStore, awaitTx)
   - Use this pattern for mediaLibraryRepository

3. **opfsStorage** (`src/shared/lib/storage/opfsStorage.ts`):
   - appendChunk, createOpfsWriter for streaming writes
   - cleanupOrphanedDownloads for temp file management
   - isQuotaExceededError for error handling
   - Valid for condense audio temp storage

4. **messageBus** (`src/entrypoints/background/messageBus.ts`):
   - Typed MessageRequest/MessageResponse
   - 30s timeout with error handling
   - tabId/frameId injection for content scripts
   - Valid for EXTRACT_AUDIO, CONDENSE_AUDIO message types

5. **SubtitleCueEngine** (`src/features/subtitle/ui/subtitleCueEngine.ts`):
   - Cue/time/repeat engine shared by ReactSubtitleController
   - Works with any HTMLVideoElement
   - Valid for local player subtitle sync

6. **NavCluster** (`src/features/subtitle/ui/NavCluster.tsx`):
   - 6-button nav cluster with collapse mode
   - Reusable for local player controls

7. **SubtitleBlock** (`src/features/subtitle/ui/SubtitleBlock.tsx`):
   - Bilingual subtitle render with OverlayStyleConfig
   - Valid for local player subtitle display

8. **Video Atoms** (`src/shared/domain/video/atoms/`):
   - PlayPauseButton, VolumeControl, FullscreenButton, PiPButton, TimeDisplay, CaptionsButton exist
   - Timeline exists but is seek bar only (not full timeline)
   - MuteButton exists (not in spec but available)

---

## Summary

**Critical Issues**:
1. WebCodecs AAC encoding fails on Firefox/Linux
2. file:// fetch requires Chrome 99+
3. @cryguy/mkv-subtitle-extractor doesn't work with local files
4. PlaybackSpeedControl component doesn't exist

**Major Issues**:
1. File System Access API permission re-prompt not addressed
2. Subtitle auto-match via fetch file:// directory is unreliable
3. OP/ED chapter filter won't work for MP4
4. captureStream() for audio extraction is slow/unreliable

**Minor Issues**:
1. web-demuxer size is overstated
2. Timeline component is seek bar only, not full timeline
3. Missing browser version requirements
4. Missing cross-browser limitation documentation

**Recommendation**: Address all critical and major issues before implementation. The spec has a solid foundation but requires significant architectural corrections for audio encoding, file access, and dependency validation.
---

## Report 2: Adversarial Engineering Review (d8579fff)

Subagent d8579fff completed successfully:

# ADVERSARIAL REVIEW: Local Video Player Specification

## EXECUTIVE SUMMARY

**Status: CRITICAL - 8 MAJOR ARCHITECTURAL FLAWS IDENTIFIED**

The specification contains multiple falsified technical claims, unverified assumptions, and architectural decisions that will fail in production. The proposed architecture is not feasible as written without significant redesign.

---

## 1. FILE:// CONTENT-SCRIPT BEHAVIOR AND REDIRECT FEASIBILITY

### FALSIFIED CLAIMS

**Claim (Line 382-394):** Content script can detect file:// URLs and redirect to player page via `chrome.tabs.update()`.

**EVIDENCE OF FALSIFICATION:**

1. **Missing file:// host permission** - The current `manifest.json` (line 19) has `"host_permissions": ["<all_urls>"]` but does NOT include `"file:///*"`. Without this explicit permission, content scripts cannot run on file:// URLs.

2. **"Allow access to file URLs" toggle requirement** - Per Chrome docs, users must manually enable "Allow access to file URLs" in chrome://extensions for the extension to run on file://. This is NOT automatic for published extensions (only unpacked). The spec acknowledges this (line 394) but treats it as a minor constraint rather than a critical UX barrier.

3. **Redirect limitation** - `chrome.tabs.update()` from a content script on file:// may be blocked due to security restrictions. The spec assumes this works without verification.

4. **Sibling-directory enumeration via fetch file:///** - The spec proposes (line 578-580) using `fetch('file:///path/to/folder/')` to get directory listings. **THIS IS FALSE.** Chrome does NOT return directory listings via fetch for file:// URLs. The only way to enumerate directories is:
   - File System Access API (`showDirectoryPicker()`) - requires user gesture
   - Parsing Chrome's native directory listing HTML (unreliable, varies by Chrome version)
   - Chrome's native file:// directory listing is not machine-parseable via fetch

**EVIDENCE URLS:**
- https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- https://groups.google.com/a/chromium.org/g/chromium-extensions/c/5u5emIgeuz0
- https://jorgecardoso.eu/static/blog/2012-08-30-Listing-a-user-directory-with-javascript-in-a-Chrome-extension.html

### MUST-CHANGE WORDING

**Line 382-394:** Replace the entire file:// redirect flow section with:
```
file:// redirect flow is NOT FEASIBLE for production extensions. 
Reasons:
1. Requires user to manually enable "Allow access to file URLs" in chrome://extensions
2. Published extensions cannot auto-enable this (only unpacked dev builds)
3. Cannot enumerate sibling directories via fetch file:///
4. chrome.tabs.update() from file:// may be blocked

ALTERNATIVE: User must explicitly open player page first, then use File System Access API to pick file/folder.
```

---

## 2. CHROME DEFAULT-APP FLOW ON WINDOWS

### FALSIFIED CLAIMS

**Claim (Line 17):** "User set Chrome làm default app cho .mp4 → double-click → Chrome mở tab file:///... → extension detect → redirect"

**EVIDENCE OF FALSIFICATION:**

1. **Chrome does NOT open local video files in-browser by default** - When Chrome is the default app for .mp4 on Windows, it typically downloads the file or opens it in the OS default player, NOT in a browser tab. The behavior varies by Chrome version and Windows configuration.

2. **No documented "default app" flow for extensions** - Chrome extensions cannot register as default file handlers on Windows. Only PWAs (Progressive Web Apps) can register file handlers via Windows registry, and this requires PWA installation, not just extension installation.

3. **Spec assumes Chrome opens file:// URL in tab** - This is not guaranteed. Chrome may:
   - Download the file to Downloads folder
   - Open in external player
   - Show a "download or open" prompt
   - Behavior varies by file type and Chrome settings

**EVIDENCE URLS:**
- https://stackoverflow.com/questions/64605721/how-to-force-chrome-to-open-local-video-files-in-browser-instead-of-downloading
- https://chromium.googlesource.com/chromium/src/+/main/docs/windows_pwa_integration.md

### MUST-CHANGE WORDING

**Line 17:** Replace with:
```
User opens Chrome extension player page → clicks "Open file" or drag-drop video.
NOTE: Chrome cannot be set as default app for local video files to open in-browser.
The "double-click file:// → redirect" flow is NOT SUPPORTED by Chrome on Windows.
```

---

## 3. FILE SYSTEM ACCESS API HANDLE TRANSFER, STORAGE, PERMISSION PERSISTENCE

### VERIFIED CLAIMS (with caveats)

**Claim:** File handles can be stored in IndexedDB and transferred via postMessage.

**VERIFICATION:** TRUE - This is supported per Chrome docs.

**CRITICAL CAVEATS NOT ADDRESSED:**

1. **Permission state on retrieval** - When a handle is retrieved from IndexedDB, its permission state is typically "prompt" (not "granted"). The spec assumes stored handles maintain granted permissions, but they often require re-confirmation via `requestPermission()`.

2. **User activation requirement** - `requestPermission()` requires user activation (click/gesture). The spec does not account for this in the "folder watch persistence" flow.

3. **Installed apps only** - Automatic permission persistence (without re-prompting) only works for INSTALLED apps (PWA), not regular extensions. The spec assumes extension pages get this behavior - FALSE.

4. **Extension page behavior** - Extension pages (chrome-extension://) are NOT considered "installed apps" for File System Access API permission persistence. They will require re-prompting.

**EVIDENCE URLS:**
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api

### MUST-CHANGE WORDING

**Line 529:** Replace folderHandles storage note with:
```
folderHandles: { id, name, handle (FileSystemDirectoryHandle) }
WARNING: Handles retrieved from IndexedDB require user activation + requestPermission() 
to regain access. Extension pages do NOT get automatic permission persistence like installed PWAs.
User will see permission prompt on every browser session unless using PWA installation flow.
```

---

## 4. WEB-DEMUXER, WEBCODECS, MSE, MKV/TS SUPPORT

### VERIFIED CLAIMS

**Claim:** web-demuxer supports MKV/TS demuxing for WebCodecs.

**VERIFICATION:** TRUE - web-demuxer 4.0.0 supports mov/mp4/mkv/webm/flv/m4v/wmv/avi/mpegts.

**PACKAGE SIZE DISCREPANCY:**

**Spec claim (Line 47):** "~2-5MB wasm"

**ACTUAL SIZE (verified):**
- Full build: 1131 KB gzipped (~1.1MB, not 2-5MB)
- Mini build: 493 KB gzipped (~0.5MB)

The spec overestimates by 2-4x. This is actually GOOD news (smaller), but shows lack of verification.

**CRITICAL ARCHITECTURAL FLAW - CANVAS vs HTMLVideoElement:**

**Spec (Line 464):** Claims either `<video>` or `<canvas>` element in PlayerView.

**INCOMPATIBILITY WITH EXISTING COMPONENTS:**

1. **SubtitleCueEngine requires HTMLVideoElement** - The existing `SubtitleCueEngine` (line 116) constructor takes `private readonly video: HTMLVideoElement`. It calls `video.currentTime`, `video.play()`, `video.pause()`. This CANNOT work with a Canvas-based rendering pipeline.

2. **PiPButton requires HTMLVideoElement** - The existing `PiPButton` (line 26-30) checks `document.pictureInPictureEnabled` but assumes HTMLVideoElement PiP API. Canvas-based PiP requires the experimental Document PiP API (not in spec).

3. **Fullscreen incompatibility** - Canvas fullscreen (`requestFullscreen()`) does NOT preserve subtitle overlays in the same way as HTMLVideoElement fullscreen. The spec's SubtitleBlock overlay would not appear in fullscreen Canvas mode.

4. **captureStream incompatibility** - The spec's condense audio flow (line 506) uses `<video>.captureStream()`. This does NOT exist on Canvas.

**EVIDENCE URLS:**
- https://github.com/bilibili/web-demuxer
- https://github.com/w3c/picture-in-picture/issues/209
- https://bugzilla.mozilla.org/show_bug.cgi?id=1760369

### MUST-CHANGE WORDING

**Line 453-465:** Replace video decode pipeline with:
```
[Video file loaded]
        ↓
[Detect container format: .mp4 → native HTML5 <video src>, .mkv/.ts → NOT SUPPORTED in v1]
        ↓
[Tier 1: MP4/WebM/OGG → native HTML5 <video src> ONLY]
[Tier 2: MKV/TS → DEFERRED to v2 - requires Canvas rewrite of SubtitleCueEngine/PiP/fullscreen]
[Tier 3: AVI/FLV/WMV → ffmpeg.wasm fallback (with warning + RAM check)]

ARCHITECTURAL CONSTRAINT: WebCodecs + Canvas rendering is INCOMPATIBLE with existing
SubtitleCueEngine, PiPButton, and fullscreen behavior. Requires complete rewrite of
video rendering layer to support Canvas-based pipeline.
```

---

## 5. FFMPEG.WASM MULTITHREADING PREREQUISITES

### FALSIFIED CLAIMS

**Claim (Line 52):** ffmpeg.wasm ~31MB lazy-load, RAM ~500MB-2GB when active.

**VERIFICATION:**
- Size: TRUE - @ffmpeg/core-mt is 32.7MB (verified via UNPKG)
- RAM claim: UNVERIFIED - No evidence provided for 500MB-2GB RAM usage

**CRITICAL - COOP/COEP REQUIREMENT NOT ADDRESSED:**

The spec completely fails to mention that the multi-threaded version (@ffmpeg/core-mt) requires:
- `Cross-Origin-Opener-Policy: same-origin` HTTP header
- `Cross-Origin-Embedder-Policy: require-corp` HTTP header

**EXTENSION PAGE LIMITATION:** Chrome extension pages (chrome-extension://) CANNOT set these headers. They are controlled by Chrome, not the extension. Therefore:
- @ffmpeg/core-mt WILL NOT WORK in extension pages
- Must use single-threaded @ffmpeg/core (no SharedArrayBuffer)
- Single-threaded is 2-4x slower

**WORKERFS/MEMFS NOT MENTIONED:** The spec mentions OPFS integration but not the virtual filesystems (WORKERFS/MEMFS) that ffmpeg.wasm uses for file I/O.

**2GB CEILING CLAIM:** The spec mentions a 2GB ceiling but provides no evidence. Real-world reports indicate ffmpeg.wasm has memory limits but the exact ceiling varies by browser/device.

**EVIDENCE URLS:**
- https://github.com/ffmpegwasm/ffmpeg.wasm
- https://ffmpeg-cookbook.com/en/articles/ffmpeg-sharedarraybuffer-error/
- https://dev.to/doublecitizen/ffmpegwasm-in-production-deadlocks-a-2-gb-ceiling-and-a-codec-that-lies-to-users-1lj8

### MUST-CHANGE WORDING

**Line 52:** Replace with:
```
Ponytail ceiling: ffmpeg.wasm ~32.7MB lazy-load only when legacy codec detected.
CRITICAL: Multi-threaded @ffmpeg/core-mt REQUIRES COOP/COEP headers which CANNOT be set
on chrome-extension:// pages. Must use single-threaded @ffmpeg/core (2-4x slower, no SharedArrayBuffer).
RAM usage: UNVERIFIED - estimate 500MB-2GB but requires benchmarking on target devices.
Mobile kill tab at ~500MB — ffmpeg.wasm path disabled on mobile (navigator.deviceMemory < 4).
```

---

## 6. MP3/AAC ENCODING CLAIMS

### FALSIFIED CLAIMS

**Claim (Line 39):** lamejs (MP3) + WebCodecs AudioEncoder (AAC)

**LAMEJS VERIFICATION:**
- Package exists: TRUE
- Size claim (~100KB): UNVERIFIED - no npm size data provided
- Performance claim: FALSE - Reports show lamejs can be SLOW (54s file took 50s to encode in some cases)
- Quality: UNVERIFIED - no comparison to native encoders provided

**WEBCODECS AUDIOENCODER CRITICAL FLAW:**

**Spec (Line 487):** Claims WebCodecs AudioEncoder outputs AAC that can be saved.

**EVIDENCE OF FALSIFICATION:**

WebCodecs AudioEncoder outputs `EncodedAudioChunk` objects (elementary streams), NOT playable M4A files. These chunks MUST be muxed into a container (MP4/ADTS) using a muxer library (e.g., mediabunny, mp4-muxer). The spec mentions no muxer.

**Browser codec support variance:**
- AAC: Firefox only supports if OS provides it (not guaranteed)
- MP3: Universally supported
- The spec assumes AAC works everywhere - FALSE

**EVIDENCE URLS:**
- https://github.com/zhuker/lamejs
- https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Using_the_WebCodecs_API
- https://webcodecsfundamentals.org/audio/encoded-audio-chunk/

### MUST-CHANGE WORDING

**Line 39:** Replace with:
```
Audio encode: lamejs (MP3) + WebCodecs AudioEncoder (AAC) + muxer (REQUIRED)
NOTE: WebCodecs AudioEncoder outputs EncodedAudioChunk (elementary stream), NOT playable file.
Must use muxer library (mediabunny or mp4-muxer) to create M4A/ADTS container.
lamejs performance: UNVERIFIED - reports show variable performance (may be slow on large files).
AAC support: Firefox requires OS support, not guaranteed.
```

---

## 7. CONDENSE PATH USING HTMLMediaElement.captureStream + AudioContext

### FALSIFIED CLAIM

**Spec (Line 506):** Claims `<video>.captureStream()` → AudioContext → slice for random-access offline processing.

**EVIDENCE OF FALSIFICATION:**

1. **OfflineAudioContext does NOT support createMediaElementSource()** - This was explicitly removed from the Web Audio API spec over a decade ago. The spec assumes this works - FALSE.

2. **captureStream is real-time only** - `captureStream()` captures the live playback stream, not random-access segments. To extract audio from specific time ranges, you must:
   - Seek video to start time
   - Play in real-time
   - Capture stream
   - This is NOT offline/random-access processing

3. **No "slice" operation exists** - AudioContext has no "slice" method. The spec invents an API that doesn't exist.

4. **Correct approach for offline processing:** Use `AudioContext.decodeAudioData()` on the entire file, then process AudioBuffer in OfflineAudioContext. But this requires the audio to be extracted first (demuxed), which the spec doesn't address.

**EVIDENCE URLS:**
- https://danielbarta.com/export-audio-on-the-web/
- https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext

### MUST-CHANGE WORDING

**Line 506-508:** Replace with:
```
[Step 3: For each segment → extract audio from video]
  - Tier 1 (MP4): web-demuxer extract audio track → AudioContext.decodeAudioData() → process
  - Tier 2 (MKV): web-demuxer → WebCodecs AudioDecoder → PCM
  - Tier 3 (legacy): ffmpeg.wasm extract audio

NOTE: <video>.captureStream() + AudioContext CANNOT do random-access offline processing.
OfflineAudioContext does NOT support createMediaElementSource().
Must demux audio track first, then decode/encode.
```

---

## 8. OFFSCREEN DOCUMENT MESSAGING AND LIMITATIONS

### UNVERIFIED CLAIMS

**Spec (Line 516):** Claims offscreen document with Web Workers for parallel segment extraction.

**LIMITATIONS NOT ADDRESSED:**

1. **Message transfer size limit** - chrome.runtime.sendMessage uses JSON serialization and has practical limits (though no hard limit documented). Large ArrayBuffers should use transferable objects or web messaging (MessagePort), not runtime.sendMessage.

2. **Service worker lifetime** - Extension service workers are terminated after 30 seconds of inactivity (Chrome 110+). Long-running condense operations (60s for 10min video) may trigger SW termination unless the SW is kept alive via message events or API calls.

3. **Offscreen document lifetime** - Offscreen documents have lifetime limits based on the "reason" specified. For `AUDIO_PLAYBACK`, the document closes after 30 seconds without audio playing. For other reasons, no explicit limit but may be terminated by Chrome for resource management.

**EVIDENCE URLS:**
- https://developer.chrome.com/docs/extensions/reference/api/offscreen
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://groups.google.com/a/chromium.org/g/chromium-extensions/c/bBp80JvnJus

### MUST-CHANGE WORDING

**Line 516:** Replace with:
```
Runs in offscreen document (Web Workers for parallel segment extraction).
WARNING: Service worker terminates after 30s inactivity. Long operations (>30s) must
send keep-alive messages or use chrome.alarms. Offscreen document lifetime depends on
'reason' - AUDIO_PLAYBACK closes after 30s without audio. Large data transfer should
use MessagePort/transferable objects, not chrome.runtime.sendMessage.
```

---

## 9. DEPENDENCY PACKAGE MATURITY/SECURITY/MAINTENANCE

### VERIFIED PACKAGES

| Package | Status | Notes |
|---------|--------|-------|
| web-demuxer | VERIFIED | 185 stars, active (last push Dec 2025), MIT license |
| lamejs | VERIFIED | 894 stars, active, MIT license |
| @ffmpeg/core-mt | VERIFIED | 10.7K weekly downloads, active, GPL-2.0 license |
| @cryguy/mkv-subtitle-extractor | UNVERIFIED | 0 stars, 6 weekly downloads, created Jan 2026, MIT license |

**CRITICAL - @cryguy/mkv-subtitle-extractor:**
- 0 GitHub stars
- 6 weekly downloads (extremely low)
- Created January 2026 (very new)
- Author: "Shy <shy@shy.zone>" - unknown maintainer
- No security audit history
- Spec claims ~50KB size - UNVERIFIED

**RECOMMENDATION:** Do NOT use @cryguy/mkv-subtitle-extractor in production. Use web-demuxer for MKV subtitle extraction instead (it supports embedded tracks).

### MUST-CHANGE WORDING

**Line 50:** Replace with:
```
@cryguy/mkv-subtitle-extractor | ~50KB | MKV embedded subtitle extraction | Dynamic import on MKV subtitle extract
WARNING: 0 stars, 6 weekly downloads, created Jan 2026, unknown maintainer. HIGH RISK.
RECOMMENDATION: Use web-demuxer for MKV subtitle extraction instead (supports embedded tracks).
```

---

## 10. PERFORMANCE SUCCESS CRITERIA

### UNVERIFIED CLAIMS

**Spec (Line 363-368):**
- Player page initial load < 3s
- Subtitle auto-match < 500ms
- Track switch < 1s
- Condense audio: 10min video → < 60s processing

**EVIDENCE:**

1. **navigator.deviceMemory support** - Chrome 63+, Firefox NOT supported. The spec uses this for mobile detection (line 469) but it doesn't work on Firefox.

2. **No benchmarking data** - None of the performance claims are backed by measurements on 1GB RAM devices.

3. **Condense 10min → 60s** - This assumes 6x real-time processing. With lamejs (reports of 1x speed or slower) and WebCodecs overhead, this is UNVERIFIED and likely UNREALISTIC on low-end devices.

**EVIDENCE URLS:**
- https://caniuse.com/mdn-api_navigator_devicememory
- https://github.com/zhuker/lamejs/issues/44

### MUST-CHANGE WORDING

**Line 363-368:** Replace with:
```
Performance (UNVERIFIED - requires benchmarking on target devices):
- Player page initial load < 3s (excluding video file) - TO BE MEASURED
- Subtitle auto-match < 500ms - TO BE MEASURED
- Track switch < 1s - TO BE MEASURED
- Condense audio: 10min video → < 60s processing (offscreen worker) - UNVERIFIED
  NOTE: lamejs reports show variable performance (may be 1x real-time or slower).
  6x real-time processing unlikely on 1GB RAM devices.

navigator.deviceMemory: Chrome 63+ only, Firefox NOT supported. Mobile detection
must use fallback for Firefox.
```

---

## UNVERIFIED CLAIMS - RESEARCH SPIKES REQUIRED

1. **React 19 + TypeScript 6** - Spec claims these versions. React 19 is released (Dec 2024), TypeScript 6.0 is announced but actual release status unclear. Verify exact versions in package.json.

2. **Vite 8** - Spec claims Vite 8. Vite 8.0 was released March 2026. Current package.json shows Vite 8.0.16. Verify compatibility with @crxjs/vite-plugin.

3. **Zustand 5** - Spec claims Zustand 5. Current package.json shows Zustand 5.0.14. Verify API compatibility.

4. **OPFS integration for ffmpeg.wasm** - Spec mentions OPFS integration but no details on how ffmpeg.wasm would use OPFS (it typically uses MEMFS/WORKERFS). Research required.

5. **31MB asset loading** - Spec mentions "31MB asset loading" but no details on how this would be chunked/streamed in extension context.

---

## FEASIBLE CORRECTED ARCHITECTURE OPTIONS

### OPTION A: CONSERVATIVE V1 (RECOMMENDED)

**Scope:**
- MP4/WebM/OGG only via native HTML5 `<video>`
- External subtitle files (SRT/VTT/ASS/TTML/SBV/SMI) via file picker
- No MKV/TS support in v1
- No embedded subtitle track extraction in v1
- No condense audio in v1
- Library (resume, history, bookmarks) via IndexedDB
- Folder watch via File System Access API (user picks folder each session)

**Rationale:**
- Uses only proven, verified technologies
- Compatible with existing SubtitleCueEngine, PiPButton, fullscreen
- No ffmpeg.wasm/COOP/COEP issues
- No Canvas/WebCodecs complexity
- Can ship and iterate

### OPTION B: AGGRESSIVE V1 (HIGH RISK)

**Scope:**
- Everything in spec BUT with fixes:
  - Remove file:// redirect flow
  - Add muxer for AAC output
  - Use single-threaded @ffmpeg/core (not -mt)
  - Replace @cryguy/mkv-subtitle-extractor with web-demuxer
  - Rewrite condense to use demuxer + decodeAudioData
  - Accept Canvas rendering incompatibility (defer PiP/fullscreen or use Document PiP)

**Rationale:**
- Attempts full feature set
- High technical risk
- Requires significant R&D
- May miss performance targets

---

## MUST-ADD EXPERIMENTS/PROTOTYPES BEFORE COMMITMENT

1. **File System Access API permission persistence test** - Verify that extension pages can store/retrieve handles without re-prompting each session.

2. **web-demuxer + WebCodecs integration prototype** - Build minimal MKV player using web-demuxer + WebCodecs + Canvas rendering. Test performance on 1GB RAM device.

3. **lamejs performance benchmark** - Encode 10min audio on target device. Measure actual time vs 60s target.

4. **WebCodecs AudioEncoder + muxer prototype** - Verify AAC encoding + muxing produces playable M4A files.

5. **Offscreen document lifetime test** - Run 60s+ operation in offscreen worker. Verify SW doesn't terminate.

6. **SubtitleCueEngine with Canvas test** - Attempt to adapt SubtitleCueEngine to work with Canvas-based video rendering. Measure effort.

---

## TEST FIXTURES REQUIRED

1. **Test video files:**
   - MP4 (H.264/AAC)
   - MKV with multiple audio tracks
   - MKV with embedded subtitles
   - TS file
   - AVI/FLV/WMV (for ffmpeg.wasm fallback)

2. **Test subtitle files:**
   - SRT (target + native)
   - VTT
   - ASS/SSA
   - TTML
   - SBV
   - SMI

3. **Test devices:**
   - Desktop with 1GB RAM (or simulate via Chrome DevTools throttling)
   - Mobile device (Android Chrome)
   - Firefox desktop (verify deviceMemory fallback)

---

## RISK REGISTER

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| file:// redirect flow fails in production | CRITICAL | HIGH | Remove from v1, use File System Access API only |
| COOP/COEP prevents ffmpeg.wasm multithreading | CRITICAL | CERTAIN | Use single-threaded @ffmpeg/core, accept 2-4x slowdown |
| Canvas rendering breaks SubtitleCueEngine/PiP/fullscreen | CRITICAL | HIGH | Use HTMLVideoElement only in v1, defer Canvas/WebCodecs |
| WebCodecs AudioEncoder output not playable without muxer | HIGH | CERTAIN | Add muxer library (mediabunny) to architecture |
| lamejs too slow for condense target | HIGH | MEDIUM | Benchmark early, adjust targets or use different encoder |
| @cryguy/mkv-subtitle-extractor abandoned/insecure | HIGH | MEDIUM | Use web-demuxer instead |
| Service worker terminates during long condense operation | MEDIUM | MEDIUM | Implement keep-alive messaging or chrome.alarms |
| navigator.deviceMemory not supported on Firefox | LOW | MEDIUM | Add fallback detection logic |
| Performance targets unmet on 1GB RAM devices | MEDIUM | HIGH | Benchmark early, adjust scope or targets |
| File System Access API permission re-prompt UX issue | MEDIUM | HIGH | Document limitation, consider PWA installation flow |

---

## FINAL RECOMMENDATION

**DO NOT PROCEED with current spec as written.**

**Required actions before implementation:**
1. Remove file:// redirect flow (not feasible)
2. Remove Canvas/WebCodecs pipeline from v1 (incompatible with existing components)
3. Add muxer library for AAC encoding
4. Replace @cryguy/mkv-subtitle-extractor with web-demuxer
5. Address COOP/COEP limitation for ffmpeg.wasm
6. Fix condense audio architecture (remove captureStream approach)
7. Add performance benchmarking as prerequisite
8. Reduce v1 scope to MP4/WebM + external subtitles only

**Estimated effort to fix spec:** 2-3 weeks of research + prototyping

**Recommended path:** Implement Option A (Conservative V1) first, ship validated features, then iterate toward Option B based on real-world performance data.
---

## Report 3: Adversarial Scope Challenge (8318c2fa)

Subagent 8318c2fa completed successfully:

# Adversarial Review: Local Video Player Spec

## Stop-ship objections

### 1. File:// redirect flow is technically impossible
**Lines 17, 382-394**: The spec claims content scripts can detect `file:///` URLs and redirect to the player page. This is fundamentally broken:

- **Chrome security model**: Content scripts on `file://` require users to manually enable "Allow access to file URLs" in chrome://extensions details page. The spec mentions this as a footnote but treats it as a minor toggle. For unpacked extensions (dev), this is auto-enabled, but for CWS published extensions, users must manually enable it - most won't.
- **Directory listing via fetch() impossible**: Lines 405-406 claim `fetch('file:///path/to/folder/')` returns directory listing HTML. **This is false.** Chrome does not return directory listings for `file://` URLs via fetch(). The File System Access API is required, but it needs `showDirectoryPicker()` which requires user gesture - cannot be transparent.
- **Open Question #1 (lines 577-580)**: The spec guesses Option A (fetch directory listing) might work. Research confirms it does NOT. Only Option B (File System Access API) works, but it requires explicit user picker per folder - breaks the "auto-match" promise.

**Recommendation**: Remove file:// redirect entirely. Require users to open player page first, then use drag-drop or file picker. This is a UX change, not a technical limitation.

### 2. "Default app" file association is impossible for Chrome extensions
**Line 17**: "User set Chrome làm default app cho `.mp4` → double-click → extension redirect"

**Research confirms**: Chrome extensions CANNOT register as OS file handlers. Only PWAs (installed web apps) can use the File Handling API to register as default app. Extensions are different:
- Chrome apps (deprecated) could do this
- PWAs can do this via `file_handlers` in web app manifest
- Chrome extensions (MV3) have NO file handler registration capability

**Spec intent vs reality**: The user must manually set Chrome.exe as default for .mp4, then the extension redirects. But this means ALL .mp4 files open in Chrome, not just those the user wants to play in the extension. This is a poor UX.

**Recommendation**: Remove "double-click open" user story. Replace with "Right-click file in OS file manager → Open with Chrome → extension detects and offers to open in player" (still requires file:// toggle).

### 3. Condense audio algorithm is underspecified and likely incorrect
**Lines 25, 79-84, 345-353**: The spec references subs2cia algorithm but the implementation details are missing:

- **Overlapping cues**: How are simultaneous subtitles merged? The spec says "merge gap <1300ms" but doesn't define what happens when cues overlap (e.g., two speakers talking at once). subs2cia merges overlapping cues, but the spec doesn't specify the merge logic.
- **Non-dialogue filtering**: Lines 351-352 mention "skip (sound effects)" and "skip OP/ED chapters" but no regex patterns are defined. subs2cia has built-in heuristics, but the spec doesn't specify which ones to use.
- **Audio stream delay**: If audio track is out of sync with subtitles (common in MKV), condensing will produce misaligned audio. The spec doesn't account for subtitle offset before condensing.
- **Re-timing algorithm**: Line 352 mentions "re-timed SRT output matches condensed audio timeline" but no algorithm is specified. Simply scaling timestamps won't work for merged segments.

**Research on subs2cia**: The actual algorithm is:
- Padding: 150ms (spec says 500ms - different)
- Merge threshold: 1000ms + 2×padding = 1300ms (spec matches)
- Non-dialogue filter: Built-in heuristics for signs, music, lyrics (spec doesn't specify)

**Recommendation**: Defer condense audio to Phase 3. First release must prove the algorithm works with real test data before committing to UI.

### 4. Dependency claims are inaccurate
**Lines 47-49**: Dependency size claims are wrong:

| Package | Spec claims | Actual size | Source |
|---------|-------------|-------------|--------|
| web-demuxer | ~2-5MB wasm | 1.1MB gzipped (full), 493KB (mini) | npm/web-search |
| @cryguy/mkv-subtitle-extractor | ~50KB | 50KB (correct) | npm |
| @ffmpeg/core-mt | ~31MB | 31MB (correct) | web-search |
| lamejs | ~100KB | ~100KB (correct) | npm |

**Critical issue**: @cryguy/mkv-subtitle-extractor has only 6 weekly downloads and was created 2026-01-31 (very recent, unmaintained). Using this for production is risky.

**Recommendation**: Verify web-demuxer actually supports all claimed formats (mov/mp4/mkv/webm/flv/m4v/wmv/avi/ts) with the mini build (493KB). If not, use full build or reconsider dependency.

### 5. Mobile support is contradictory
**Line 52**: "Mobile kill tab ở ~500MB — ffmpeg.wasm path disable trên mobile (navigator.deviceMemory < 4)"

**Problem**: The spec claims "ALWAYS design for extension cross browser... desktop, tablet, android" (AGENTS.md line 25) but then disables a core feature (legacy codec support) on mobile. This means:
- Mobile users cannot play AVI/FLV/WMV files
- Mobile users get different UX (warning message)
- No mobile-specific keyboard shortcuts defined
- No touch-specific UI for NavCluster (hold-to-loop assumes mouse/touch but no gesture spec)

**Recommendation**: Either commit to full mobile support (find alternative to ffmpeg.wasm for mobile) or explicitly mark local player as desktop-only in scope.

## Scope decomposition

The spec is secretly 5+ products. Must be sliced:

### Product 1: Local Video Player (Core)
- Play MP4/WebM/OGG via native HTML5
- Play MKV/TS via web-demuxer + WebCodecs
- Subtitle auto-match (same folder, File System Access API)
- Bilingual subtitle rendering (reuse existing SubtitleBlock)
- Basic player controls (play/pause/seek/volume/fullscreen/speed)
- Keyboard shortcuts

### Product 2: Media Library
- Resume position (IndexedDB)
- History list
- Bookmarks
- **DEFER**: Folder watch (requires File System Access API + persistent handles - complex permission model)

### Product 3: Track Extractor
- MKV audio track switch (real-time)
- MKV subtitle track switch (real-time)
- Extract audio to MP3/AAC
- Extract subtitle to SRT/keep format
- **DEFER**: Bitmap track extraction (PGS/VOBSUB - requires OCR, out of scope per intent)

### Product 4: Audio Condenser
- Parse subtitle timing
- Merge gaps <1300ms
- Pad ±500ms
- Filter non-dialogue
- Extract audio segments
- Concatenate + encode
- Re-time subtitles
- **DEFER**: OP/ED chapter detection (requires MKV chapter metadata - not all formats have this)

### Product 5: Transcoder Fallback
- ffmpeg.wasm for AVI/FLV/WMV
- **DEFER**: Mobile support (disabled per spec)
- **DEFER**: WORKERFS for large files (>128MB) - spec doesn't mention this

## Failure scenarios

### User journey failures

**Scenario 1: User double-clicks .mp4 file**
- Expected: Chrome opens player page, auto-loads subtitle
- Actual: Chrome opens bare `file:///` page (native video player). Content script doesn't run because "Allow access to file URLs" is off by default. User sees nothing.
- Recovery: User must manually toggle permission, then double-click again. No in-app guidance.

**Scenario 2: User has video in `/Movies/Action/` and subtitle in `/Movies/Subs/`**
- Expected: Auto-match finds subtitle
- Actual: "Same folder" algorithm fails. Subtitle in subfolder (line 431 says "scan 1 level deep" but File System Access API doesn't support recursive scan without explicit permission).
- Recovery: User must manually drag-drop subtitle file.

**Scenario 3: User has `Movie.en.srt` and `Movie.eng.srt`**
- Expected: Auto-match picks one
- Actual: Ambiguous match. Spec line 419 says "Multiple matches same lang → list pick, default = first" but doesn't define sorting order. Which is "first"? Alphabetical? Random?
- Recovery: User sees TrackSelector but default may be wrong file.

**Scenario 4: User condenses audio from 2-hour movie**
- Expected: MP3 + re-timed SRT in <60s
- Actual: Processing takes 5+ minutes. Browser shows "Page unresponsive" dialog. User kills tab.
- Root cause: Spec line 367 claims "10min video → <60s processing" but this is unrealistic for 2-hour file. No progress indicator spec (line 589 asks "real-time progress bar hay spinner?" - unanswered).
- Recovery: User loses work, no resume capability.

**Scenario 5: User moves video file after condensing**
- Expected: Library still shows video
- Actual: IndexedDB stores file path, not file handle. Path is stale. Clicking library entry shows "File not found".
- Root cause: Spec stores `filename` (line 525) but not FileSystemFileHandle. File System Access API handles can persist across moves, but spec doesn't use them.
- Recovery: User must manually re-import.

### Destructive UX outcomes

**Overwriting exports without confirmation**
- Line 24: "save file" - no mention of overwrite check
- Scenario: User condenses `Movie.mp4` → `Movie.condensed.mp3`. Runs again, overwrites previous file without warning.
- Impact: Lost work, no undo.

**Wrong subtitle selected automatically**
- Scenario: Profile target=en, native=vi. Folder has `Movie.en.srt` (signs/songs only) and `Movie.en.forced.srt` (dialogue). Auto-match picks `Movie.en.srt` (alphabetically first). User watches 30 minutes before realizing subtitles are wrong.
- Impact: Wasted time, no way to detect "forced" vs "full" subtitle tracks.

**Stale file handles after browser restart**
- Scenario: User picks folder via File System Access API. Browser restarts. Handle is revoked (security feature). Library shows folder but clicking "scan" fails silently.
- Root cause: Spec line 529 stores `folderHandleId` but File System Access API handles are not persistent across sessions. Must re-request permission.
- Impact: Confusing error, no clear recovery path.

**Privacy implications of folder watch**
- Scenario: User picks `/Users/username/Documents/` for folder watch. Extension scans all files, including personal documents not related to video.
- Root cause: Spec line 141 says "scan tất cả video" but doesn't filter by extension before scanning. File System Access API grants read access to entire folder.
- Impact: User privacy violated, no clear disclosure of what's being scanned.

### Edge cases for multi-language/profile

**Hearing-impaired subtitle tracks**
- Scenario: MKV has 3 English tracks: `eng` (dialogue), `eng:cc` (closed captions), `eng:sdh` (SDH - hearing impaired). Profile target=en. Which one is selected?
- Spec gap: No priority for track types. Default may pick SDH (includes [MUSIC], [APPLAUSE] tags) which is wrong for language learning.

**Commentary/signs subtitle tracks**
- Scenario: Anime MKV has `jpn` (dialogue), `jpn:commentary` (director commentary), `eng:signs` (on-screen text only). User wants dialogue + signs.
- Spec gap: No way to combine multiple tracks. TrackSelector only allows single track selection.

**Multiple editions/cuts**
- Scenario: Folder has `Movie_1080p_Theatrical.mp4` and `Movie_1080p_DirectorsCut.mp4`. Both have `Movie.srt`. Auto-match loads same subtitle for both.
- Spec gap: Resolution stripping (line 403) doesn't account for edition suffixes. Subtitle may be out of sync for Director's Cut.

**Resolution/tag stripping ambiguity**
- Scenario: `Movie.4K.HDR.DV.mp4` - resolution suffix regex (line 403) doesn't match `4K` or `HDR`. Base name becomes `Movie.4K.HDR.DV`. Subtitle `Movie.srt` doesn't match.
- Spec gap: Regex only covers numeric resolutions (4320/2160/1440/1080/720/etc.). Doesn't handle `4K`, `HDR`, `DV`, `REMUX`.

**Nested folders**
- Scenario: User has `/Movies/Action/2024/Movie.mp4` and `/Movies/Subs/Action/Movie.srt`. Auto-match fails.
- Spec gap: Line 431 says "scan 1 level deep" but File System Access API doesn't support parent directory traversal without explicit permission.

## Product decisions the spec must lock

### 1. File System Access API vs file:// permission
**Decision needed**: Can we require users to manually enable "Allow access to file URLs"? If yes, document onboarding flow. If no, remove file:// redirect entirely.

**Recommendation**: Remove file:// redirect. Use File System Access API for all file access. Require user to open player page first, then pick file/folder.

### 2. Subtitle match priority order
**Spec gap**: Line 419 lists 6 priority levels but doesn't define:
- What if `.en.srt` and `.eng.srt` both exist? Which is "first"?
- What if `.en.srt` and `.en-US.srt` both exist?
- What if profile target=en but only `.eng.srt` exists? Is `eng` mapped to `en`?

**Decision needed**: Define exact priority table with fallback rules.

### 3. Condense audio non-dialogue filter patterns
**Spec gap**: Line 351 mentions "skip (sound effects)" but no regex patterns. subs2cia has built-in heuristics:
- Lines matching `^\[.*\]$` (e.g., [MUSIC], [APPLAUSE])
- Lines with parentheses `(singing)`, `(laughs)`
- Lines with common non-dialogue markers

**Decision needed**: Either use subs2cia's built-in heuristics (document them) or define custom regex patterns.

### 4. OP/ED chapter detection
**Open Question #3 (line 587)**: "MKV có chapter metadata (web-demuxer getMediaInfo). MP4 không có chapter chuẩn. Skip OP/ED chỉ khi chapter metadata available, otherwise skip filter này?"

**Decision needed**: 
- Option A: Only skip OP/ED when chapter metadata exists (inconsistent behavior)
- Option B: Skip OP/ED filter entirely for all formats (simpler)
- Option C: Use time-based heuristic (skip first 90s and last 90s) - risky

**Recommendation**: Option B (skip filter entirely) for Phase 1. Add chapter-based filter in Phase 2.

### 5. Thumbnail generation
**Open Question #2 (line 582)**: "Dùng gì? Option A: <video> element + seek to 10% + canvas capture... Option B: ffmpeg.wasm screenshot..."

**Decision needed**: Option A is correct (lazy, no dependency). But spec doesn't define:
- When to generate thumbnails? (on scroll into view? on library load?)
- Where to store thumbnails? (IndexedDB? OPFS? chrome.storage?)
- What if video is corrupted? (fallback image?)

**Recommendation**: Defer thumbnails to Phase 2. Phase 1 uses generic video icon.

### 6. Export overwrite behavior
**Spec gap**: No mention of overwrite confirmation.

**Decision needed**: 
- Option A: Always overwrite (destructive, simple)
- Option B: Prompt before overwrite (safe, requires UI)
- Option C: Auto-rename (Movie.condensed.mp3 → Movie.condensed.1.mp3)

**Recommendation**: Option B (prompt before overwrite).

### 7. Folder watch persistence
**Spec gap**: Line 529 stores `folderHandleId` but File System Access API handles are not persistent across browser restarts.

**Decision needed**:
- Option A: Re-request permission on each session (annoying but secure)
- Option B: Use File System Access API's `id` parameter to remember directory (Chrome may persist handle)
- Option C: Store file paths instead of handles (breaks on move/rename)

**Recommendation**: Option B (use `id` parameter). Test if Chrome persists handles across restarts. If not, fall back to Option A.

## Acceptance criteria to add/remove/change

### Remove (unrealistic or undefined)

**Line 303**: "Open video file via file:// redirect → player page loads within 3s"
- **Reason**: File:// redirect is impossible without user toggle. Remove this AC.

**Line 307**: "Subtitle auto-match: video `Adele-Hello-Official-Music-Video_1080p.mp4` → loads `Adele-Hello-Official-Music-Video.srt` automatically"
- **Reason**: Too specific. Should be: "Subtitle auto-match loads subtitle with same base name in same folder (via File System Access API picker)."

**Line 321**: "AVI/FLV/WMV plays via ffmpeg.wasm fallback (with warning + RAM check)"
- **Reason**: No AC for what happens if RAM check fails. Add: "If RAM < 4GB, show error 'Format not supported on this device' and disable play."

**Line 351**: "Filter: skip `(sound effects)` lines"
- **Reason**: Vague. Change to: "Filter: skip lines matching regex `^\[.*\]$` (e.g., [MUSIC], [APPLAUSE]) and lines with parentheses `(singing)`, `(laughs)`."

**Line 367**: "Condense audio: 10min video → < 60s processing (offscreen worker)"
- **Reason**: Unrealistic. Change to: "Condense audio: 10min video → progress indicator updates every 1s. Processing completes without browser freeze."

### Add (missing critical paths)

**Add AC for file:// permission toggle**:
- "If 'Allow access to file URLs' is off, show banner 'Enable file access in Chrome extension settings to use local player' with link to chrome://extensions."

**Add AC for File System Access API picker**:
- "First time user opens file/folder, show system picker dialog. Subsequent opens remember last directory via File System Access API `id` parameter."

**Add AC for subtitle match failure**:
- "If no subtitle found in same folder, show 'No subtitle found' message with 'Open subtitle file' button."

**Add AC for condense audio progress**:
- "During condense processing, show progress bar with percentage complete and estimated time remaining. Allow user to cancel."

**Add AC for export overwrite**:
- "Before saving condensed audio/subtitle, if file exists, show confirmation dialog 'Overwrite existing file?' with Cancel/Overwrite buttons."

**Add AC for mobile format support**:
- "On mobile (navigator.deviceMemory < 4), disable AVI/FLV/WMV playback and show 'Format not supported on mobile' message."

### Change (clarify or fix)

**Line 313**: "Response time < 3s for all player actions"
- **Change to**: "Player page initial load < 3s (excluding video file load). Subtitle auto-match < 500ms. Track switch < 1s."

**Line 425**: "Multi-resolution suffix: `_1080p`, `_720p`, `_480p`..."
- **Change to**: "Multi-resolution suffix: `_1080p`, `_720p`, `_480p`, `_360p`, `_240p`, `_144p`, `_4K`, `_HDR`. Ponytail: regex may not cover all non-standard suffixes."

**Line 47**: Size claim for web-demuxer
- **Change to**: "web-demuxer (bilibili) | ~1.1MB wasm (full), ~493KB (mini) | MKV/TS/FLV/AVI demux + WebCodecs | Dynamic import on first MKV/TS file"

## Suggested phased scope

### Phase 1: Core Player (MVP)
**Goal**: Play local video + auto-match subtitle

**Features**:
- Play MP4/WebM/OGG via native HTML5
- Play MKV/TS via web-demuxer + WebCodecs (mini build 493KB)
- Subtitle auto-match via File System Access API (same folder only)
- Bilingual subtitle rendering (reuse existing SubtitleBlock)
- Basic player controls (play/pause/seek/volume/fullscreen/speed)
- Keyboard shortcuts (space, arrows, m, f, 0-9)
- Resume position (IndexedDB)
- History list (IndexedDB)

**Non-goals**:
- File:// redirect (remove entirely)
- Folder watch (defer to Phase 2)
- Track extraction (defer to Phase 2)
- Condense audio (defer to Phase 3)
- Legacy codec support (AVI/FLV/WMV - defer to Phase 3)
- Thumbnails (defer to Phase 2)
- Bookmarks (defer to Phase 2)

**Success criteria**:
- User opens player page → picks video file → plays within 3s
- User picks video → auto-matches subtitle in same folder → renders bilingual
- User closes player → reopens → resumes from last position
- User opens history → clicks video → reopens

### Phase 2: Library + Track Extraction
**Goal**: Media library + MKV track manipulation

**Features**:
- Bookmarks (add/delete/seek)
- Folder watch (File System Access API with persistent `id`)
- MKV audio track switch (real-time)
- MKV subtitle track switch (real-time)
- Extract audio to MP3/AAC
- Extract subtitle to SRT/keep format
- Thumbnail generation (lazy on scroll)

**Non-goals**:
- Condense audio (defer to Phase 3)
- Legacy codec support (defer to Phase 3)
- Bitmap track extraction (out of scope)

**Success criteria**:
- User picks folder → library scans videos → click → play
- User switches audio track → audio changes within 1s
- User extracts audio → MP3 downloads with correct bitrate
- User extracts subtitle → SRT downloads with correct timing

### Phase 3: Condense Audio + Legacy Codec
**Goal**: Advanced audio processing + full format support

**Features**:
- Condense audio (merge gaps, pad, filter, re-time)
- ffmpeg.wasm fallback for AVI/FLV/WMV
- WORKERFS for large files (>128MB)
- OP/ED chapter detection (if metadata available)
- Mobile support (if feasible, else mark as desktop-only)

**Non-goals**:
- Bitmap track extraction (out of scope - requires OCR)
- Real-time transcription (out of scope per intent)

**Success criteria**:
- User condenses 10min video → MP3 + re-timed SRT downloads in <60s
- User opens AVI file → ffmpeg.wasm loads → plays (desktop only)
- User condenses 2-hour movie → progress indicator updates → completes without freeze

## What should remain exactly as written

### Tech Stack (lines 31-42)
- Framework: React 19 + TypeScript 6 (existing) ✓
- Build: Vite 8 + @crxjs/vite-plugin (existing) ✓
- State: Zustand 5 (existing) ✓
- Storage: IndexedDB + chrome.storage.local + OPFS (existing) ✓
- Subtitle parse: existing parsers + new SBV/SMI (correct) ✓
- Video decode: native HTML5 + WebCodecs + web-demuxer + ffmpeg.wasm (correct) ✓
- Audio encode: lamejs + WebCodecs AudioEncoder (correct) ✓
- Design system: existing tokens.css + shared/ui (correct) ✓

### Code Style (lines 192-230)
- Named export, no default export ✓
- Function component + hooks ✓
- MUST NOT use `any` ✓
- Pure logic tách hàm ✓
- CSS module per component ✓
- Icon from ICON_CATALOG ✓
- UI atoms from @/shared/ui ✓

### Testing Strategy (lines 232-264)
- Unit tests for pure logic (subtitleMatch, condenseAudio, etc.) ✓
- E2E tests for critical paths ✓
- Test data from existing sample ✓

### Boundaries (lines 265-298)
- Always run typecheck + test + build ✓
- Follow naming conventions ✓
- Validate input at trust boundaries ✓
- Use tokens from tokens.css ✓
- Import icons from ICON_CATALOG ✓
- Import UI atoms from @/shared/ui ✓
- Pure logic in features/, side effects in services/ ✓
- Update architecture docs ✓
- Ask before adding dependencies ✓
- Never commit secrets ✓
- Never use any ✓
- Never default export ✓
- Never class component (except ErrorBoundary) ✓
- Never inline SVG ✓
- Never add ffmpeg.wasm to main bundle ✓
- Never run ffmpeg.wasm on mobile ✓

### Reuse Summary (lines 591-634)
- All listed reusable components are correctly identified ✓
- All new components are correctly scoped ✓

---

**Summary**: The spec is over-scoped for a single release. It combines 5+ products (player, library, transcoder, extractor, condenser) with critical technical gaps (file:// redirect impossible, File System Access API not transparent, condense algorithm underspecified). Recommend slicing into 3 phases starting with core player only. Remove file:// redirect entirely, require File System Access API for all file access. Lock product decisions for subtitle match priority, non-dialogue filter patterns, and export overwrite behavior before implementation.