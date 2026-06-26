# Subtitle filename matches video filename + language suffix

> **Principle**: [Dead field → link by co-occurrence, not by dead reference](learned-bugfixes.md#dead-field--link-by-co-occurrence-not-by-dead-reference)

## Problem
Subtitle downloads had ugly filenames like `subtitle_-_52c5b9e164ce167d5f0828b55f4ec57f.srt` (URL hash-based), while video downloads had clean filenames like `See_You_at_Work_Tomorrow!.mp4` (from video title). Subtitles should use the same base name as the video, with a language suffix (VLC/community convention: `Movie Title.en.srt`).

## Root causes
1. **`downloadSubtitle` ignored video context**: It called `resolveFilenameBase(this.filenameSource, undefined, subtitle.url)` — always passing `undefined` as title, so it always used the subtitle's own URL base name (typically a hash).
2. **`subtitle.videoId` is never set**: `detectSubtitle` in `subtitleDetector.ts` does not link subtitles to videos. The `DetectedSubtitle.videoId` field exists but is always `undefined` in practice.
3. **Language was `'unknown'` in background**: `detectSubtitle` → `extractLanguage(url)` returns `'unknown'` when the URL has no language indicator. The popup's `useSubtitleLanguage` hook detects the language from subtitle content (frequency-based) and updates the **popup store**, but never pushed the result to the background. So `mediaMap` still had `language: 'unknown'` when the download was triggered.

## Fix (3 parts)

**Part 1: `buildSubtitleFileName` helper** (`src/lib/utils/fileUtils.ts`)
- New function: `buildSubtitleFileName(base, language, ext)` → `<base>.<lang>.<ext>` (e.g. `Movie.en.srt`). Sanitizes + lowercases the language tag. Skips suffix when language is empty/whitespace/all-invalid-chars.

**Part 2: Video context passthrough** (`src/background/downloader.ts` + `src/background/index.ts`)
- `downloadSubtitle` now accepts optional `videoContext?: { videoTitle?, videoTabUrl? }`. When provided, it uses `resolveFilenameBase(this.filenameSource, videoTitle, videoTabUrl)` — the same mechanism as video downloads. Falls back to the subtitle's URL base when no video context.
- The background executor looks up videos on the same tab via `this.networkInterceptor.getVideos(subtitle.tabId)` and passes the first video's title + tabUrl as context.

**Part 3: Language push from popup to background** (`src/types/message.ts` + `src/constants/messages.ts` + `src/background/index.ts` + `src/popup/hooks/useSubtitleLanguage.ts`)
- New message type `UPDATE_SUBTITLE_LANGUAGE` with payload `{ subtitleId, language }`.
- Background handler `handleUpdateSubtitleLanguage`: updates both `networkInterceptor` (via `updateSubtitle`) and `mediaMap` with the detected ISO 639-1 code.
- `useSubtitleLanguage` hook: after content-based detection resolves, sends `UPDATE_SUBTITLE_LANGUAGE` for each updated subtitle via `chrome.runtime.sendMessage`.

## Key insights
- `subtitle.videoId` is a dead field — never set by the detector. Linking by `tabId` is the robust strategy (all subtitles on a video page belong to that page's video).
- The popup ↔ background language sync is necessary because the popup does content-based detection (fetch + frequency analysis) which the background doesn't do. Without the push, the background's `mediaMap` has stale `'unknown'` language codes.
- The `buildSubtitleFileName` function lowercases the language tag for VLC convention compatibility (`movie.en.srt`, not `movie.EN.srt`).

## Verification (live debug via edge-devtools MCP)
- Downloaded English subtitle on `themoviebox.org`:
  - Before fix: `subtitle_-_52c5b9e164ce167d5f0828b55f4ec57f.srt`
  - After fix: `See_You_at_Work_Tomorrow!.en.srt` ✓
- Popup subtitle cards now display the filename format (not hash):
  - `See_You_at_Work_Tomorrow!.en.srt`, `See_You_at_Work_Tomorrow!.ar.srt`, `See_You_at_Work_Tomorrow!.bn.srt`, etc.
- 11 subtitles detected with correct language labels (english, arabic, bengali, spanish, tagalog, french, indonesian, khmer, portuguese).

## Popup display title (Part 4)
- `resolveMediaDisplayTitle` in `useMediaDisplayTitle.ts` now accepts optional `videoContext: { videoTitle?, videoTabUrl? }`.
- When provided, subtitle display title = `buildSubtitleFileName(resolveFilenameBase(filenameSource, videoTitle, videoTabUrl), language, format)` — matches download filename exactly.
- `useMediaDisplayTitle` hook reads `videos` from popup store and auto-finds the first video on the same `tabId` for each subtitle. No manual wiring needed in `App.redesigned.tsx`.
- When no video is detected on the same tab, falls back to the subtitle's URL base name (legacy behavior).
- `buildSubtitleFileName` treats `'unknown'` as "no language" (skips suffix) — matches the sentinel from `extractLanguage()`.
