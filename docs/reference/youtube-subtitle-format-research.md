# YouTube Subtitle Format Research

> **Purpose**: Grounding cho G1 spec YouTube subtitle detection. Source-driven — mọi statement có citation.
> **Date**: 2026-07-05
> **Phase**: Pre-G1 research (sau G0 intent, trước G1 spec)

---

## 1. Bản chất — YouTube subtitle là gì?

YouTube subtitle **không phải file .srt/.vtt tĩnh** như các site streaming khác (kisskh, hoathinh3d). Nó là **dynamic API endpoint** trả về timed text theo request.

| Aspect | Generic site (kisskh) | YouTube |
|---|---|---|
| URL pattern | `episode-1.en.srt` (file tĩnh, có extension) | `youtube.com/api/timedtext?v=XXX&lang=en&fmt=json3` (API endpoint, không extension) |
| Language location | Trong filename/path | Trong query param `lang=` |
| Format | Fixed (.srt/.vtt/.ass file) | Dynamic — chọn qua `fmt=` param (7 formats) |
| Track list | 1 file = 1 track | `ytInitialPlayerResponse` JSON blob chứa tất cả tracks |
| Auth | None | `&pot` (Proof of Origin Token) cho một số client 2024+ |

**Source**: grokipedia.com/page/YouTube_timedtext_endpoint, yt-dlp source code

### Tại sao hệ thống hiện tại không catch được?

`subtitleDetector.ts` match URL pattern `.srt/.vtt/.ass` extension + `/subtitles|subs|caption|cc/` path. YouTube timedtext URL **không có extension** và **không có path pattern đó** → `detectSubtitle()` return null → không bao giờ detect.

`extractLanguage()` parse language từ filename/path segments. YouTube language nằm ở query param `lang=` → return `'unknown'` → auto-load fail.

---

## 2. Cấu trúc — YouTube caption track data

### 2.1 Track list location: `ytInitialPlayerResponse`

YouTube embed player config vào page HTML dưới dạng JSON blob. Có 2 cách truy cập:

**Cách 1 — MAIN world (preferred cho extension)**:
```js
// Content script chạy trong MAIN world có thể truy cập trực tiếp
window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks
```

**Cách 2 — Parse HTML script tag (fallback)**:
```js
// Regex match trong page HTML
const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
const playerResponse = JSON.parse(match[1]);
```

**Source**: blog.nidhin.dev, medium.com/@aqib-2, github.com/nadimtuhin/ytranscript

### 2.2 captionTracks[] structure

Mỗi track trong `captionTracks` array:

```json
{
  "baseUrl": "https://www.youtube.com/api/timedtext?v=VIDEO_ID&lang=en&...",
  "languageCode": "en",
  "kind": "asr",                    // "asr" = auto-generated; ABSENT = manual
  "name": { "simpleText": "English (auto-generated)" },
  "vssId": ".en",                   // alternative language ID (yt-dlp dùng cái này)
  "isTranslatable": true            // có thể translate sang ngôn ngữ khác
}
```

**Key fields**:
- `baseUrl` — URL fetch subtitle content (đã chứa params: `v`, `lang`, `signature`, `expire`, `key`, `pot`...)
- `languageCode` — ISO 639-1 code ("en", "es", "vi", "ja")
- `kind` — `"asr"` = auto-generated speech recognition; **absent** = manual human-uploaded
- `name.simpleText` — display name ("English", "English (auto-generated)", "Spanish")
- `vssId` — variant subtitle ID (yt-dlp ưu tiên dùng cái này: `.en` → strip dot → `en`)
- `isTranslatable` — nếu true, có thể append `&tlang=xx` để get translation

**Source**: github.com/nadimtuhin/ytranscript/HOW_IT_WORKS.md, yt-dlp `_video.py` line 4208-4210, 4266, 4290

### 2.3 translationLanguages (auto-translation)

`playerCaptionsTracklistRenderer` còn có `translationLanguages[]`:
```json
{
  "translationLanguages": [
    { "languageCode": "vi", "languageName": { "simpleText": "Vietnamese" } },
    { "languageCode": "es", "languageName": { "simpleText": "Spanish" } }
  ]
}
```

→ Có thể fetch translation bằng `baseUrl + &tlang=vi`. **Nhưng**: chất lượng auto-translation thấp (machine translation), và `xosf=1` gây "damaged subtitles" (yt-dlp issue #13654).

**Source**: yt-dlp `_video.py` line 4298-4318

---

## 3. Format — 7 output formats qua `fmt=` param

YouTube hỗ trợ 7 formats, chọn bằng query param `fmt=`:

| `fmt=` | Format | Description | Use case |
|---|---|---|---|
| `json3` | JSON3 | `{events: [{tStartMs, dDurationMs, segs: [{utf8}]}]}` — internal Google format, có `wireMagic: "pb3"` | Richest metadata, yt-dlp default |
| `vtt` | WebVTT | Web standard — `WEBVTT\n\n00:00.000 --> 00:05.000\nHello` | **Reuse existing `parseVtt`** |
| `srt` | SubRip | `1\n00:00:00,000 --> 00:00:05,000\nHello` | **Reuse existing `parseSrt`** |
| `srv1` | XML | `<text start="0" dur="5">Hello</text>` | Legacy |
| `srv2` | XML variant | Modified srv1 | Legacy |
| `srv3` | TTML-based | Proprietary YouTube format based on TTML | ANDROID client default |
| `ttml` | TTML | Standard TTML | Netflix/iQIYI cũng dùng |

**yt-dlp `_SUBTITLE_FORMATS`**: `('json3', 'srv1', 'srv2', 'srv3', 'ttml', 'srt', 'vtt')` — line 199 của `_video.py`

**Source**: yt-dlp `_video.py` line 199, grokipedia, github.com/FyraLabs/yttml (SRV3 = TTML-based proprietary)

### 3.1 JSON3 structure (richest)

```json
{
  "wireMagic": "pb3",
  "events": [
    {
      "tStartMs": 0,
      "dDurationMs": 5000,
      "segs": [{ "utf8": "Hello " }, { "utf8": "world" }]
    },
    {
      "tStartMs": 5000,
      "dDurationMs": 3000,
      "segs": [{ "utf8": "Welcome to the video" }]
    }
  ]
}
```

**Parse logic** (từ ytranscript):
- `tStartMs` / `dDurationMs` = milliseconds → chia 1000 ra seconds
- `segs[].utf8` join → text
- Filter events không có `segs` (timing markers, style events)
- Newline characters trong segments preserved

**Source**: github.com/nadimtuhin/ytranscript/HOW_IT_WORKS.md, gist.github.com/Snarp, Stack Overflow #77560390

### 3.2 WebVTT format (reuse existing parser)

```
WEBVTT

00:00.000 --> 00:05.000
Hello world

00:05.000 --> 00:08.000
Welcome to the video
```

→ **Reuse `parseVtt` trong `src/features/subtitle/logic/subtitleParser.ts`** — ponytail ladder rung 2 (reuse codebase).

**Source**: MDN WebVTT API, developer.mozilla.org/en-US/docs/Web/API/WebVTT_API

### 3.3 `xosf` param gotcha

yt-dlp comment line 4215-4216:
> `xosf=1` results in undesirable text position data for vtt, json3 & srv* subtitles
> See: https://github.com/yt-dlp/yt-dlp/issues/13654

→ Khi fetch, **strip `xosf` param** khỏi baseUrl trước khi append `fmt=`. yt-dlp code: `query = {**query, 'fmt': fmt, 'xosf': []}` (set xosf thành empty array = remove).

---

## 4. Làm sao để bắt được — 3-layer strategy

### Layer 1: Proactive parse `ytInitialPlayerResponse` (D1 — confirmed)

```
Page load
  │
  ├── Content script MAIN world chạy
  ├── Đọc window.ytInitialPlayerResponse
  │   └── captions.playerCaptionsTracklistRenderer.captionTracks[]
  ├── Map mỗi track → DetectedSubtitle entity:
  │   {
  │     id: crypto.randomUUID(),
  │     url: baseUrl + '&fmt=vtt',     // append format
  │     format: 'vtt',                  // reuse parseVtt
  │     language: languageCode,         // 'en', 'vi'
  │     tabId: <current tab>,
  │     detectedAt: Date.now()
  │   }
  └── Broadcast DETECTED_SUBTITLES → background → auto-load flow hiện tại
```

**MV3 requirement**: content script cần `world: 'MAIN'` trong manifest để truy cập `window.ytInitialPlayerResponse`. ISOLATED world không thấy biến này.

**Source**: blog.nidhin.dev (dùng `window.ytInitialPlayerResponse`), Chrome MV3 docs `content_scripts.world`

### Layer 2: SPA navigation re-detect

YouTube là SPA — switch video không reload page. Cần re-detect khi:

| Trigger | Detection | Source |
|---|---|---|
| `yt-navigate-finish` event | YouTube custom event fire sau SPA nav | YouTube SPA internal |
| URL change observer | `MutationObserver` trên `document.title` hoặc `history.pushState` | Generic fallback |
| Video element replacement | Đã có pattern ADR-010 episode-switch | Codebase hiện tại |

**Codebase precedent**: `contentScriptController.ts` đã có `reportEpisodeChangedIfReplacement` cho SPA episode-switch (ADR-010). Reuse pattern này.

### Layer 3: Fallback — InnerTube API (khi DOM parse fail)

Nếu `window.ytInitialPlayerResponse` undefined (YouTube đổi structure, race condition):

```js
// 1. Extract INNERTUBE_API_KEY từ page HTML
const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)[1];

// 2. POST /youtubei/v1/player
const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en', gl: 'US' } },
    videoId: videoId
  })
});
const data = await response.json();
// data.captions.playerCaptionsTracklistRenderer.captionTracks[]
```

**ANDROID client** ưu tiên hơn WEB client vì WEB client yêu cầu PO Token (BotGuard) từ 2024. ANDROID client baseUrl đã chứa `&fmt=srv3` — cần strip trước khi append `&fmt=vtt`.

**Source**: github.com/nadimtuhin/ytranscript (v1.3.0 switch sang ANDROID client), yt-dlp `_DEFAULT_CLIENTS = ('android_vr', 'web_safari')`

---

## 5. Risk — PO Token (Proof of Origin Token) 2024+

### Vấn đề

YouTube thêm `&pot` parameter validation (2024+) để chống scraping. baseUrl có thể return empty (200 OK, no content) nếu thiếu pot token.

**Source**: Stack Overflow #79668836, yt-dlp `_report_pot_subtitles_skipped` line 3217-3234, yt-dlp PO Token Guide

### yt-dlp handling (line 4269-4286)

```python
requires_pot = any(e in traverse_obj(qs, ('exp', ...)) for e in ('xpe', 'xpv'))
if not pot_params and requires_pot:
    skipped_subs_clients.add(client_name)
    self._report_pot_subtitles_skipped(video_id, client_name)
    break
```

→ yt-dlp detect `exp=xpe|xpv` trong baseUrl query → biết track require PO Token → skip nếu không có.

### Mitigation cho extension

| Strategy | Reliability | Complexity |
|---|---|---|
| baseUrl từ `ytInitialPlayerResponse` WEB client | Thường đủ (YouTube embed pot token đầy đủ) | Low |
| baseUrl từ ANDROID client (InnerTube fallback) | Higher (ANDROID ít require pot hơn) | Medium |
| Detect `exp=xpe|xpv` → skip track + log warning | Graceful degradation | Low |

**Verdict**: Layer 1 (DOM parse) thường đủ cho extension context (user đang xem video = đã có session). Fallback InnerTube ANDROID client nếu fail. Verify trên real browser G4.

---

## 6. Mapping sang codebase hiện tại

### 6.1 DetectedSubtitle entity (đã có, compatible)

```ts
// src/entities/media/ — hiện tại
interface DetectedSubtitle {
  id: string;
  url: string;          // YouTube: baseUrl + '&fmt=vtt'
  format: SubtitleFormat; // YouTube: 'vtt' (reuse parseVtt)
  language: string;     // YouTube: languageCode ('en', 'vi')
  tabId: number;
  detectedAt: number;
}
```

→ **Không cần thay đổi entity**. YouTube adapter chỉ map `captionTracks[] → DetectedSubtitle[]`.

### 6.2 subtitleDetector.ts refactor — site adapter pattern

```
Hiện tại:
  detectSubtitle(request: NetworkRequest): DetectedSubtitle | null
    └── match URL pattern (.srt/.vtt/.ass) → extract language từ filename

Target:
  detectSubtitle(request, context): DetectedSubtitle | null
    ├── YouTube adapter (if context.origin matches youtube.com)
    │   └── (proactive — không dùng network request, dùng DOM parse)
    └── Generic adapter (fallback — URL pattern matching hiện tại)
```

**Note**: YouTube adapter **không** dùng network interception (Layer 1 proactive DOM parse). Generic adapter vẫn dùng network interception cho kisskh/hoathinh3d. Adapter registry dispatch dựa trên origin.

### 6.3 Reuse flow hiện tại

```
YouTube adapter detect → DetectedSubtitle[]
  → broadcast DETECTED_SUBTITLES (message hiện tại)
  → background subtitleService.findSubtitlesForOverlay
  → auto-load flow (handleAutoLoadSubtitles)
  → fetchAndParseSubtitle(url, 'vtt') → parseVtt (reuse)
  → overlay controller loadBilingualCues
```

→ **Toàn bộ downstream flow reuse** — chỉ cần adapter mới cho detection layer.

---

## 7. Open questions cho G1 spec

| # | Question | Lean toward | Defer to |
|---|---|---|---|
| Q1 | Format: `&fmt=vtt` (reuse parser) vs `&fmt=json3` (richer, cần adapter)? | VTT — ponytail rung 2 reuse | G1 spec F-criteria |
| Q2 | MAIN world: manifest `world: 'MAIN'` vs inject `<script>` tag? | Manifest `world: 'MAIN'` — MV3 native | G3 ADR (source-driven verify) |
| Q3 | SPA nav: `yt-navigate-finish` event vs URL observer vs ADR-010 pattern? | ADR-010 reuse + `yt-navigate-finish` | G1 spec + G3 ADR |
| Q4 | ASR badge UI: track list hiển thị "auto" badge cho ASR? | Yes — user cần biết chất lượng | G0.5 mockup (if UI) |
| Q5 | Track name: `name.simpleText` ("English (auto-generated)") vs `languageCode` ("en")? | `languageCode` cho matching, `simpleText` cho display | G1 spec |
| Q6 | Translation tracks (`tlang`): include auto-translation? | No — chất lượng thấp, `xosf` damaged | G1 spec (out of scope) |
| Q7 | PO Token: detect `exp=xpe|xpv` + skip + warn? | Yes — graceful degradation | G1 spec NF-criteria |

---

## Sources

| # | Source | URL | Authority |
|---|---|---|---|
| 1 | yt-dlp source code | github.com/yt-dlp/yt-dlp/yt_dlp/extractor/youtube/_video.py | Official OSS (175k stars) |
| 2 | ytranscript HOW_IT_WORKS | github.com/nadimtuhin/ytranscript/HOW_IT_WORKS.md | OSS reference |
| 3 | Grokipedia timedtext | grokipedia.com/page/YouTube_timedtext_endpoint | Encyclopedia |
| 4 | MDN WebVTT API | developer.mozilla.org/en-US/docs/Web/API/WebVTT_API | Web standard |
| 5 | Innertube API guide 2025 | medium.com/@aqib-2/extract-youtube-transcripts-using-innertube-api-2025 | Tutorial |
| 6 | blog.nidhin.dev | blog.nidhin.dev/extracting-youtube-transcripts-with-javascript | Tutorial |
| 7 | Stack Overflow json3 schema | stackoverflow.com/questions/77560390 | Community |
| 8 | Stack Overflow pot parameter | stackoverflow.com/questions/79668836 | Community (2024+) |
| 9 | FyraLabs/yttml (SRV3) | github.com/FyraLabs/yttml | OSS reference |
| 10 | gist Snarp (json3 parse) | gist.github.com/Snarp/ce3e86ab9349f9cd2bb8b02d6d6116a5 | Code sample |
