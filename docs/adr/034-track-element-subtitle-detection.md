# ADR-034: Trust `<track>` element semantics for subtitle detection

## Status
Accepted (2026-07-13)

## Context
`SUBTITLE_URL_PATTERNS` (file `src/shared/config/urls.ts`) detect subtitle qua URL shape:
- extension `.ass`/`.vtt`/`.srt`
- query param `format|type|subtype=vtt|srt|ass`
- path segment `/subtitles|subs|caption|cc/`

### Bug
anikage.cc serve subtitle qua `<track kind="subtitles">` element:
```html
<track kind="subtitles" label="English" srclang="English"
  src="https://prox.anicore.tv/stream/CQQGHwtDHR9...<base64-hash>">
```

URL `prox.anicore.tv/stream/<base64-hash>`:
- **Không có extension** (hash-only path)
- **Không có** `/subtitles|subs|caption|cc/` segment
- **Không có** format query param
- Body response là `WEBVTT\n...` (soft subtitle thật, content-type `application/octet-stream`)

→ `SUBTITLE_URL_PATTERNS` không match (verified: 5/5 pattern = false).

### Hai lớp filter đều reject
1. **pageScanner.ts** line 105: `subtitleUrls.filter(isSubtitleUrl)` — `<track>` URL collect rồi filter bằng pattern → bị discard.
2. **mediaDetection.ts** PAGE_SCAN_RESULT handler: `if (detectSubtitle(networkRequest))` — re-check pattern → trả `null` → không store.

`<track kind="subtitles">` là signal ngữ nghĩa HTML spec (element CHÍNH LÀ classifier), nhưng cả 2 lớp đều ignore nó, chỉ tin URL pattern.

## Decision
Trust `<track>` element semantics, bypass URL pattern cho URL đến từ `<track>`:

1. **`subtitleDetector.ts`**: thêm opts `{ trustAsSubtitle?: boolean }` cho `detectSubtitle`. Khi `true`, skip `SUBTITLE_URL_PATTERNS` check. Giữ `NON_SUBTITLE_KEYWORDS` check (reject thumbnail/chapter VTT preview).

2. **`pageScanner.ts`**: tách `<track>` URL riêng (`trackSubtitleUrls`), chỉ dedupe không pattern-filter. `<a>` URL vẫn filter bằng pattern (chỉ `<track>` mang semantic subtitle intent).

3. **`mediaDetection.ts`** PAGE_SCAN_RESULT: gọi `detectSubtitle(req, { trustAsSubtitle: true })` + `handleRequest(details, { trustAsSubtitle: true })` cho scanner subtitle URLs.

4. **`networkInterceptor.ts`** `handleRequest`: thêm opts param, pass-through cho `detectSubtitle`.

### Why trust `<track>` but not `<a>`
- `<track kind="subtitles">` là HTML spec element — author đặt element này VÌ đó là subtitle. Element IS the classifier.
- `<a href>` là link generic — có thể là download link, navigation, hoặc resource. Cần URL pattern để classify.

### Why keep NON_SUBTITLE_KEYWORDS guard
Site (anime.nexus) serve `thumbnails.vtt`/`cues.vtt` qua `<track>` cho seek-preview/chapter marker. Keyword guard reject những case này dù trustAsSubtitle=true.

## Consequences
- anikage.cc + sites tương tự (extension-less subtitle URL qua `<track>`) detect được.
- Language resolve qua flow `resolveUnknownSubtitleLanguages` hiện có (fetch content + detect) — `language: 'unknown'` → fetch body → detect English.
- `<a>` URL behavior không đổi — vẫn pattern-filter.
- Thumbnail/chapter VTT preview vẫn reject.

## Test
- `subtitleDetector.test.ts`: 3 test cho `trustAsSubtitle` opts (anikage URL, keyword guard vẫn reject, pattern-match URL không đổi behavior).
- `pageScanner.test.ts`: 2 test cho `<track>` URL không match pattern + `<a>` URL vẫn filter.
- `integration.test.ts`: 1 test PAGE_SCAN_RESULT store `<track>`-origin URL không match pattern.
- Unit tests: 2309 passed, 0 failed.
