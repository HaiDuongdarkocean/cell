# Project Knowledge

## Auto-download subtitle catch-up (incremental media detection)

### Problem
Auto-download downloaded the video but NOT subtitles. Root cause: `NetworkInterceptor.onMediaDetected` fires incrementally — the m3u8 is captured first, subtitles arrive later. The first fire (video only) ran `tryAutoDownload`, enqueued the video, and set a per-tab URL guard (`autoDownloadedTabs: Map<tabId, url>`). When subtitles arrived in the second fire, `maybeAutoDownload` saw the guard matched the URL and returned early, so subtitles were never enqueued.

### Fix
- `tryAutoDownload` now takes an optional `alreadyEnqueuedIds: ReadonlySet<string>` and returns `Promise<string[]>` (the media ids it enqueued this call; empty = silent no-op). Selected media whose id is in the set is skipped, so a follow-up call enqueues only newly discovered subtitles without re-downloading the video.
- `BackgroundService.autoDownloadedTabs` changed from `Map<tabId, url>` to `Map<tabId, { url, enqueuedIds: Set<string> }>`.
- `maybeAutoDownload` two branches:
  1. **Same page load** (state.url === tabUrl): call `tryAutoDownload` with `state.enqueuedIds`, add returned ids to the set (subtitle catch-up).
  2. **Fresh page load** (no state or URL changed): call `tryAutoDownload` fresh, store `{ url, enqueuedIds: new Set(newIds) }`.
- Guard is still cleared on `tabs.onUpdated` loading and `tabs.onRemoved`, so navigation to a different episode under the same whitelisted category still auto-downloads fresh.

### Key insight
The URL guard was too coarse — it prevented ALL re-runs for the same page, including the legitimate subtitle catch-up. The fix separates "don't re-download the video" (id-level dedup) from "allow new subtitles to be caught up" (re-run with skip set). `selectBestMedia` is pure and cheap, so re-running it each incremental fire and diffing against enqueued ids is safe.

## Tab-Scoping (learned while fixing popup media leak)

### Problem
Popup opened for tab A showed media from background tab B. Root cause: `handleGetDetectedMedia` and `handleDownloadAll` fell back to all-tab media when the active tab was empty, and `DETECTED_MEDIA_UPDATE` broadcasts were not tab-scoped.

### Fix
- `DetectedMediaUpdatePayload` now carries a required `tabId: number`.
- `handleGetDetectedMedia` returns empty when the requested tab has no media — NO all-tab fallback.
- `handleDownloadAll` returns `{ success: false, error: 'No media found for this tab' }` when the tab is empty — NO all-tab fallback.
- `useDetectedMedia` hook resolves the active content tab on mount via `getActiveContentTab()` (see "Edge app-window leak" below), stores `tabId` in a ref, sends `GET_DETECTED_MEDIA { tabId }`, and filters `DETECTED_MEDIA_UPDATE` broadcasts by `payload.tabId === tabIdRef.current`.
- `NetworkInterceptor` capture stays global (correct — per-tab storage already works). Only the message-passing + popup layer needed scoping.

### Key insight
Chrome MV3 `chrome.runtime.sendMessage` cannot target a specific tab — broadcasts fan out to every listener. Since only one popup is active at a time, the popup filters by `tabId` in the payload rather than the background trying to target a tab.

## Edge app-window leak (popup renders empty on Edge)

### Problem
On Edge, the Media + Downloads sections rendered completely empty (no console error). On Chrome the same extension + same page worked fine. Root cause: Edge ships built-in app-windows (e.g. the dictionary sidebar at `chrome-extension://<id>/pages/app-window/index.html#/app/dictionary`) that are themselves `active: true` and live in their own window. The popup hooks previously used `chrome.tabs.query({ active: true, currentWindow: false })` then `tabs[0]?.id` to grab "the active tab in a browser window, not the popup window". On Edge that query returns the app-window tab (a `chrome-extension://` URL), not the content tab. The background then looked up media/downloads for the extension tab id, found nothing, and the popup rendered empty with no error. The `lastFocusedWindow: true` fallback returned `null` on Edge, so it did not save the case.

### Fix
- New helper `src/popup/utils/getActiveContentTab.ts` exports `getActiveContentTab()` and `getActiveContentTabId()`. It runs 3 `chrome.tabs.query` shapes IN PARALLEL via `Promise.all` (currentWindow:true, lastFocusedWindow:true, `{}` all tabs), merges candidates in priority order, and picks the first one whose URL is NOT a `chrome-extension://` page. A tab with no URL (loading / restricted / mocked) is still accepted — chrome-extension tabs always carry a `chrome-extension://` URL, so a missing URL never masks one.
- `useDetectedMedia`, `useDownloadProgress`, and the auto-download whitelist check in `App.redesigned.tsx` all now use this helper instead of inline `currentWindow: false` + `tabs[0]?.id` logic. The inline `getActiveContentTab` previously duplicated in `App.redesigned.tsx` was removed in favor of the shared helper (DRY).

### Key insight
`chrome.tabs.query({ active: true, currentWindow: false })` is a fragile trick for "active tab in a browser window, not the popup window". It assumes the only other active tab is the content tab. Edge's app-windows break that assumption. The robust pattern is: gather candidates from several query shapes, then filter out `chrome-extension://` URLs explicitly. This works on both Chrome (no app-window interference) and Edge. Tests that flush microtasks need ~2 extra `await Promise.resolve()` because `Promise.all` over 3 queries adds overhead vs the old 2-sequential-await path.

### Pre-existing e2e issues (fixed)
- `redesigned-popup.spec.ts` and `m3u8-local.spec.ts` previously failed with strict mode violation: `[data-testid="empty-media"]` resolved to 2 elements (media-section + downloads-section share the same testid). Fixed by scoping the locator: `[data-testid="media-section"] [data-testid="empty-media"]`.

## Commands
```
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test                  # unit + integration (~29s)
Test unit only:   npm run test:unit         # ~3s, day-to-day (alias: test:fast)
Test integration: npm run test:integration  # real m3u8 download + transmux
Test watch:       npm run test:watch        # unit only (watching integration is slow)
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

Note: `npm test -- --testPathPattern=` is deprecated in jest 30; use `--testPathPatterns=`.

## Jest projects (unit + integration split)

`jest.config.ts` uses `projects` to separate fast unit tests from slow network integration tests:
- **unit** project: `tests/unit/**`, `tests/components/**`, `tests/utils/**`, `src/**` — `*.test.ts(x)`. ~3s, no network.
- **integration** project: `tests/integration/**` — `*.integration.test.ts` only. Uses `globalSetup` (`tests/integration/setup/globalSetup.ts`) to download the m3u8 playlist + first 12 TS segments ONCE via curl.exe and cache them to `tests/integration/.cache/` (gitignored). The 3 split test files (sequential, parallel, compare) read from disk instead of each re-downloading, and run in 3 parallel jest workers.

Run a single project: `npm run test:unit` / `npm run test:integration`, or `npx jest --selectProjects unit`.
Force re-download of segments: `FORCE_DOWNLOAD=1 npm run test:integration` (PowerShell: `$env:FORCE_DOWNLOAD=1; npm run test:integration`).

## Subtitle Language Detection (hybrid script + frequency)

### Architecture
- `subtitleDetector.extractLanguage()` parses BCP 47 tags from URL (e.g. `en-US` → `en`, `zh-Hans` → `zh`), extracts primary subtag only.
- `languageDetector.detectLanguage()` uses a **hybrid two-stage** approach:
  1. **Script detection** (`scriptDetector.ts`): identifies dominant Unicode script (26 scripts from Unicode Scripts.txt). Single-candidate scripts (Hangul→Korean, Hiragana→Japanese, Thai, Greek, etc.) resolve immediately.
  2. **Frequency disambiguation**: for multi-candidate scripts (Latin, Cyrillic, Arabic, Devanagari, Han), runs frequency profiles filtered by script. 38 profiles total.
  3. **Fallback**: if no frequency profile meets threshold, returns first candidate for the detected script.
- `isoCodeToLabel()` maps ISO 639-1 (183 codes) + ISO 639-2 (182 codes) → 183 unique language labels.

### Known limitations
- All frequency profiles use **top-10 words with 3+ characters**, ranked by corpus frequency. Short words (1-2 chars) are excluded to avoid cross-language false positives (e.g. "a" in English/Spanish/French, "я"/"с" in Russian/Ukrainian). CJK scripts (Han, Hangul, Hiragana) are exempt because CJK characters count as 1 char each and common words are often 2 chars — these scripts resolve via single-candidate script detection anyway.
- Bulgarian/Serbian/Macedonian share many common Slavic words; frequency alone cannot reliably distinguish them. Serbian is checked first (uses ј U+0458).
- Languages without frequency profiles (Marathi, Nepali, Malay, African languages, etc.) fall back to the first candidate of their script (e.g. Marathi → Hindi via Devanagari, Malay → English via Latin).
- `substringMatch: true` is only for scripts without word boundaries (Han, Hiragana, Katakana). Using it for Cyrillic/Arabic causes false positives (e.g. "а" matching inside "за").

## Subtitle filename matches video filename + language suffix

### Problem
Subtitle downloads had ugly filenames like `subtitle_-_52c5b9e164ce167d5f0828b55f4ec57f.srt` (URL hash-based), while video downloads had clean filenames like `See_You_at_Work_Tomorrow!.mp4` (from video title). Subtitles should use the same base name as the video, with a language suffix (VLC/community convention: `Movie Title.en.srt`).

### Root causes
1. **`downloadSubtitle` ignored video context**: It called `resolveFilenameBase(this.filenameSource, undefined, subtitle.url)` — always passing `undefined` as title, so it always used the subtitle's own URL base name (typically a hash).
2. **`subtitle.videoId` is never set**: `detectSubtitle` in `subtitleDetector.ts` does not link subtitles to videos. The `DetectedSubtitle.videoId` field exists but is always `undefined` in practice.
3. **Language was `'unknown'` in background**: `detectSubtitle` → `extractLanguage(url)` returns `'unknown'` when the URL has no language indicator. The popup's `useSubtitleLanguage` hook detects the language from subtitle content (frequency-based) and updates the **popup store**, but never pushed the result to the background. So `mediaMap` still had `language: 'unknown'` when the download was triggered.

### Fix (3 parts)

**Part 1: `buildSubtitleFileName` helper** (`src/lib/utils/fileUtils.ts`)
- New function: `buildSubtitleFileName(base, language, ext)` → `<base>.<lang>.<ext>` (e.g. `Movie.en.srt`). Sanitizes + lowercases the language tag. Skips suffix when language is empty/whitespace/all-invalid-chars.

**Part 2: Video context passthrough** (`src/background/downloader.ts` + `src/background/index.ts`)
- `downloadSubtitle` now accepts optional `videoContext?: { videoTitle?, videoTabUrl? }`. When provided, it uses `resolveFilenameBase(this.filenameSource, videoTitle, videoTabUrl)` — the same mechanism as video downloads. Falls back to the subtitle's URL base when no video context.
- The background executor looks up videos on the same tab via `this.networkInterceptor.getVideos(subtitle.tabId)` and passes the first video's title + tabUrl as context.

**Part 3: Language push from popup to background** (`src/types/message.ts` + `src/constants/messages.ts` + `src/background/index.ts` + `src/popup/hooks/useSubtitleLanguage.ts`)
- New message type `UPDATE_SUBTITLE_LANGUAGE` with payload `{ subtitleId, language }`.
- Background handler `handleUpdateSubtitleLanguage`: updates both `networkInterceptor` (via `updateSubtitle`) and `mediaMap` with the detected ISO 639-1 code.
- `useSubtitleLanguage` hook: after content-based detection resolves, sends `UPDATE_SUBTITLE_LANGUAGE` for each updated subtitle via `chrome.runtime.sendMessage`.

### Key insights
- `subtitle.videoId` is a dead field — never set by the detector. Linking by `tabId` is the robust strategy (all subtitles on a video page belong to that page's video).
- The popup ↔ background language sync is necessary because the popup does content-based detection (fetch + frequency analysis) which the background doesn't do. Without the push, the background's `mediaMap` has stale `'unknown'` language codes.
- The `buildSubtitleFileName` function lowercases the language tag for VLC convention compatibility (`movie.en.srt`, not `movie.EN.srt`).

### Verification (live debug via edge-devtools MCP)
- Downloaded English subtitle on `themoviebox.org`:
  - Before fix: `subtitle_-_52c5b9e164ce167d5f0828b55f4ec57f.srt`
  - After fix: `See_You_at_Work_Tomorrow!.en.srt` ✓
- Popup subtitle cards now display the filename format (not hash):
  - `See_You_at_Work_Tomorrow!.en.srt`, `See_You_at_Work_Tomorrow!.ar.srt`, `See_You_at_Work_Tomorrow!.bn.srt`, etc.
- 11 subtitles detected with correct language labels (english, arabic, bengali, spanish, tagalog, french, indonesian, khmer, portuguese).

### Popup display title (Part 4)
- `resolveMediaDisplayTitle` in `useMediaDisplayTitle.ts` now accepts optional `videoContext: { videoTitle?, videoTabUrl? }`.
- When provided, subtitle display title = `buildSubtitleFileName(resolveFilenameBase(filenameSource, videoTitle, videoTabUrl), language, format)` — matches download filename exactly.
- `useMediaDisplayTitle` hook reads `videos` from popup store and auto-finds the first video on the same `tabId` for each subtitle. No manual wiring needed in `App.redesigned.tsx`.
- When no video is detected on the same tab, falls back to the subtitle's URL base name (legacy behavior).
- `buildSubtitleFileName` treats `'unknown'` as "no language" (skips suffix) — matches the sentinel from `extractLanguage()`.

## PowerShell note
PowerShell does not support bash heredoc (`<<'EOF'`). For multi-line git commit messages, write to a temp file and use `git commit -F <file>`.

## Parallel fMP4 Merge (ftyp+moov stripping + tfdt offset)

### Problem
When parallel transmuxing splits a TS file into N groups, each group creates its own `Transmuxer` instance. This causes two bugs:

1. **Multiple ftyp+moov**: Each instance emits `initSegment` (ftyp+moov) + `data` (moof+mdat). Naive concatenation produces an invalid fMP4 with N ftyp+moov pairs — players only read the first one, so the video appears incomplete (only part 0 plays).

2. **tfdt overlap**: mux.js rebases PTS to 0 for each Transmuxer instance. So parts 1+ have tfdt values starting from ~0 instead of their absolute position in the timeline. When merged, fragments from different parts overlap → player only plays part 0 → duration shows as ~1/N of actual.

### Fix
`mergePartFiles()` in `parallelTransmuxer.ts` applies three fixes:

1. **ftyp+moov stripping**: `findFirstMoofOffset()` parses the MP4 box structure of parts 1+ and skips their ftyp+moov boxes. Only part 0 keeps its ftyp+moov.

2. **tfdt offset**: After transmuxing all groups, the function:
   - Reads timescales from part 0's moov (moov → trak → mdia → mdhd)
   - Extracts per-track tfdt + trun total duration from each part's moof boxes
   - Computes cumulative offsets per track (sum of previous parts' durations)
   - Patches tfdt values in parts 1+ by adding the cumulative offset (in-place via `offsetTfdtInPlace()`)

3. **mvhd duration update**: The moov's mvhd duration is updated from part 0's duration to the total duration across all parts (via `updateMvhdDuration()`).

### Verification
Tested with real m3u8 (295 segments, 120s duration):
- Sequential: 120.48s ✓
- OLD parallel (naive merge): 43.28s ❌ (only part 0 played)
- NEW parallel (tfdt fix): 120.48s ✓ (matches sequential)

### Why this works
- All groups come from the same TS stream → same codec configuration → moov from part 0 is compatible with moof from all parts.
- HLS TS segments start with PAT/PMT (required for random access), so each group's Transmuxer can independently initialize and produce correct fMP4 fragments.
- The tfdt offset is computed from the trun sample durations (which mux.js sets correctly from PES headers), so the cumulative offset is accurate.

## Auto-Select & Auto-Download Feature

### Architecture
- **Auto Download** (Header AD toggle): whitelists the current URL's **first pathname segment** (origin + first path segment) via `src/lib/utils/whitelist.ts`. Query strings, hash fragments, and the rest of the path are stripped. This means enabling AD for one episode of a show (e.g. `https://kisskh.co/Drama/.../Episode-1`) whitelists the whole category (`https://kisskh.co/Drama`), so navigating to `Episode-2` under the same category automatically triggers a download. Different domains (e.g. `https://anime.uniquestream.net/...`) never share a whitelist entry. Two trigger paths:
  1. **Toggle ON in popup** (`handleToggleAutoDownload` in `App.redesigned.tsx`): immediately runs `selectBestMedia` against currently detected media and triggers download of the best video + matching subtitles for the current tab — in addition to whitelisting for future revisits. AD implies auto-select for download, so this runs regardless of `autoSelectEnabled`.
  2. **Revisit whitelisted page**: `tryAutoDownload` in `src/background/autoDownload.ts` is triggered from `NetworkInterceptor.onMediaDetected` (NOT `tabs.onUpdated` complete — that fires before network interception captures m3u8/subtitle requests, so media is always empty there). A per-tab guard map (`autoDownloadedTabs` on `BackgroundService`) prevents duplicate downloads when `onMediaDetected` fires multiple times incrementally for the same exact page (m3u8 → subtitles → enriched variants). The guard stores the exact tab URL, so navigating to a different episode under the same whitelisted category still auto-downloads. The guard is cleared on `tabs.onUpdated` loading and `tabs.onRemoved`.
- `tryAutoDownload` returns `boolean` (true if items enqueued) so the caller knows whether to mark the tab as auto-downloaded.
- **Auto Select** (Settings AS toggle): when `settings.autoSelectEnabled` is ON, popup auto-checks best media via `selectBestMedia` on open. User still clicks Download manually.
- **selectBestMedia** (`src/lib/selectors/selectBestMedia.ts`): pure function. Fallback order: Preferred Format → Default Quality → Subtitle availability. Returns `AutoSelectResult | null`.
- **MultiSelect** (`src/popup/components/settings/MultiSelect.tsx`): reusable component with search + checkbox list. Used for subtitle language selection (replaces single dropdown).

### Settings migration
- `defaultSubtitleLanguage: string` → `selectedSubtitleLanguages: string[]` (multi-select). Migration in `popupStore.loadPersistedSettings`.
- New fields: `preferredVideoFormat: 'mp4' | 'm3u8'` (default 'm3u8'), `autoSelectEnabled: boolean` (default false).
- `STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST` stores `WhitelistEntry[]` in `chrome.storage.local`.

### Learned: integration.test.ts describe block merge
- The file had duplicate `describe('OffscreenManager')` blocks with a premature `});` closing the first one. Merged into single `describe('Background integration')` block. OffscreenManager tests now use `let manager: OffscreenManager` initialized per-test (no separate beforeEach) since they share the outer describe's mock setup.
- Mock Chrome needed `storage.session` added (BackgroundService uses `chrome.storage.session` for session media/downloads).

### Learned: Auto Download tab detection in popup
- `chrome.tabs.query({ active: true, currentWindow: true })` in a real Chrome popup returns the active content tab (the popup itself is not a tab). In Playwright E2E tests that open the popup URL as a regular tab, the active tab is the popup's chrome-extension URL, so the code must fall back through `lastFocusedWindow` and ultimately scan all tabs, ignoring any `chrome-extension://` URLs.
- Implemented `getActiveContentTab()` in `App.redesigned.tsx` that queries `currentWindow` → `lastFocusedWindow` → all active tabs → all tabs, and picks the first non-extension URL.

### Learned: MultiSelect footer + E2E click
- The MultiSelect component originally rendered `<li>` rows with a checkmark SVG and no footer. The E2E test expected checkbox inputs and a "Selected: ..." footer, so both were added:
  - Footer: `selectedSummary` derived from selected values + option labels; rendered as `data-testid="{testId}-footer"`.
  - E2E: click the `<li>` option row directly (the component toggles on `li` click); no checkbox input exists.

### PowerShell regex gotcha
- `(Get-Content -Raw) -replace` with `\n` in replacement string inserts literal `\n` text, not newline. Use backtick-n `` `n `` in PowerShell or use the `edit` tool instead.

## E2E Debugging with Chrome DevTools MCP

### Overview
Chrome DevTools MCP provides real-time browser inspection and debugging capabilities for Chrome extensions. It's useful for:
- Inspecting popup UI and DOM state
- Checking console logs and errors
- Verifying extension state (active/inactive, whitelist, settings)
- Testing media detection in real-time
- Debugging auto-download behavior without full E2E test runs

### Available Tools
Key tools for debugging:
- `list_pages` - List all open tabs and extension pages
- `select_page` - Switch to a specific page/tab
- `evaluate_script` - Run JavaScript in the page context
- `get_console_messages` - Retrieve console logs (error/warning/info/debug)
- `navigate_to` - Navigate to URLs (note: not available in chrome-devtools MCP, use browser_navigate in mcp-playwright instead)

### Common Debugging Workflows

#### 1. Inspect Popup State
```javascript
// Check extension state
{
  extensionActive: document.querySelector('[data-testid="toggle-extension-btn"]')?.getAttribute('aria-pressed'),
  autoDownloadActive: document.querySelector('[data-testid="toggle-auto-download-btn"]')?.getAttribute('aria-pressed'),
  videoCards: document.querySelectorAll('[data-testid="video-card"]').length,
  subtitleCards: document.querySelectorAll('[data-testid="subtitle-card"]').length
}
```

#### 2. Check Settings
```javascript
// Verify subtitle language selection
{
  totalOptions: document.querySelectorAll('[role="option"]').length,
  selectedOptionsCount: Array.from(document.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-selected') === 'true').length,
  selectedText: Array.from(document.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-selected') === 'true')
    .map(o => o.textContent?.trim())
}
```

#### 3. Reload Extension
```javascript
// Disable and re-enable extension to reload code
async () => {
  const extensions = await new Promise((resolve) => {
    chrome.management.getAll(resolve);
  });
  const videoDownloader = extensions.find(ext =>
    ext.name.toLowerCase().includes('video') || ext.name.toLowerCase().includes('downloader')
  );
  if (videoDownloader) {
    await chrome.management.setEnabled(videoDownloader.id, false);
    await new Promise(r => setTimeout(r, 500));
    await chrome.management.setEnabled(videoDownloader.id, true);
    return { reloaded: true };
  }
  return { reloaded: false };
}
```

### MCP Server Comparison

#### Chrome DevTools MCP
- **Pros**: Direct access to already-open Chrome instance, real-time inspection
- **Cons**: Cannot navigate to URLs (no `navigate_to` tool), limited to inspecting existing pages
- **Use case**: Quick inspection of running extension, checking console logs, verifying UI state

#### Playwright MCP
- **Pros**: Full browser automation, can navigate to URLs, open/close pages, run E2E workflows
- **Cons**: Creates new browser instance (separate from development Chrome), slower for quick checks
- **Use case**: Full E2E testing, navigating to test pages, automated workflows

### Debugging Process

#### Step 1: List Available Pages
```
mcp_call_tool("chrome-devtools", "list_pages", {})
```
Shows all content tabs, extension pages, and service workers.

#### Step 2: Select Target Page
```
mcp_call_tool("chrome-devtools", "select_page", { pageId: 5 })
```
Switch to the popup or content tab you want to inspect.

#### Step 3: Inspect State
```
mcp_call_tool("chrome-devtools", "evaluate_script", {
  function: "() => { ... }"
})
```
Run JavaScript to check DOM, state, or extract information.

#### Step 4: Check Console
```
mcp_call_tool("chrome-devtools", "get_console_messages", {
  level: "error"
})
```
Check for errors, warnings, or debug logs.

### Known Limitations

1. **No navigate_to in chrome-devtools MCP**: Use mcp-playwright for navigation, or manually navigate in Chrome before inspecting
2. **Extension reload requires chrome://extensions**: Cannot reload directly from chrome-devtools MCP, need to use chrome.management API via evaluate_script
3. **Service worker inspection**: Limited access to service worker console; use chrome://serviceworker-internals for detailed debugging
4. **Background script logs**: Console logs from background service worker may not appear in page console; check service worker console separately

### Best Practices

1. **Use Playwright MCP for full workflows**: When you need to navigate to pages and perform multi-step operations
2. **Use Chrome DevTools MCP for quick inspection**: When you already have Chrome open and want to check state quickly
3. **Add debug logging**: Add console.debug statements in code for better visibility during MCP debugging
4. **Check both page and service worker consoles**: Some logs appear in different contexts
5. **Verify extension is reloaded**: After code changes, always reload the extension before testing
6. **Wait for media detection**: Media detection is asynchronous; add delays (10-15s) after navigation before checking results

### Example: Debug Subtitle Auto-Download

```javascript
// 1. Navigate to content page
// 2. Wait 15s for media detection
await new Promise(resolve => setTimeout(resolve, 15000));

// 3. Check popup
{
  videoCards: document.querySelectorAll('[data-testid="video-card"]').length,
  subtitleCards: document.querySelectorAll('[data-testid="subtitle-card"]').length
}

// 4. Check settings (open settings dialog first)
{
  selectedSubtitleLanguages: Array.from(document.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-selected') === 'true')
    .map(o => o.textContent?.trim())
}

// 5. Check console for debug logs
// Look for [NetworkInterceptor] Detected media messages
```


