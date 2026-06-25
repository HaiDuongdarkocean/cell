# Subtitle Filename Matches Video

## Problem Statement
How might we make subtitle filenames use the same base name as the video (with a language suffix) so users can easily identify and auto-load subtitles with their videos?

## Recommended Direction
**Minimal pass-through + VLC convention.** Add optional `videoTitle` and `videoTabUrl` params to `downloadSubtitle`. The background executor looks up the linked video via `subtitle.videoId` in `mediaMap` and passes its title + tabUrl. `downloadSubtitle` then calls `resolveFilenameBase` with the video's title/URL (same as video downloads), appends a sanitized language suffix, and uses `.srt` extension. Falls back to the current URL-base behavior when no video is linked or the video is no longer in `mediaMap`.

This is the smallest change that achieves consistency without refactoring the filename pipeline. A shared `buildSubtitleFilename` helper can be extracted later if duplication grows.

## Key Assumptions to Validate
- [ ] `subtitle.videoId` reliably links to the detected video on the same page (verify via live debug + unit test)
- [ ] `mediaMap` retains the video long enough for queued subtitle downloads (verify: queue subtitle after video completes)
- [ ] `subtitle.language` is an ISO 2-letter code in practice; label-to-code conversion is rarely needed (verify via live debug on themoviebox.org)
- [ ] Sanitized language suffix never produces an empty string that breaks the filename (unit test edge case)

## MVP Scope
**In:**
- `downloadSubtitle(subtitle, downloadId, videoTitle?, videoTabUrl?)` — optional params
- Background executor: lookup `mediaMap.get(subtitle.videoId)` → pass `video.title`, `video.tabUrl`
- New helper `buildSubtitleFileName(base, lang, ext)` in `fileUtils.ts` — sanitize lang, append `.<lang>` before `.<ext>`, skip suffix if lang empty
- Unit tests: with video, without video, empty language, label language, generic title fallback
- E2E test: download subtitle on a page with video → assert filename matches video base + `.lang.srt`

**Out (see Not Doing):**
- UI preview filename in popup
- Setting toggle for suffix
- Refactor video filename pipeline

## Not Doing (and Why)
- **UI preview filename in popup** — out of scope, separate UX task
- **Setting toggle for language suffix** — always on; suffix is standard convention, no reason to disable
- **Shared `buildSubtitleFilename` helper refactor** — premature; current `generateFileName` + new `buildSubtitleFileName` is enough
- **Season/episode metadata extraction** — out of scope, complex URL parsing
- **Per-site filename templates** — out of scope, over-engineering

## Open Questions
- (Resolved via interview) Suffix format: ISO 2-letter code, lowercase, before extension
- (Resolved via interview) Fallback when no video: URL base of subtitle (current behavior)
- (Resolved via interview) Duplicate languages: rely on Chrome's ` (1)` dedup
