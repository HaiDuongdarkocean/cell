# Spec: Subtitle Search

> Status: **Ready for implementation plan** — đã qua adversarial review.
> Review log: xem cuối file (§ Review findings → resolutions).

## Objective

User có thể search subtitle từ nguồn bên ngoài (SubDL primary, OpenSubtitles fallback) ngay trong `SubtitleManagerPanel` — gõ tên phim + chọn ngôn ngữ + (optional) season/episode → nhận danh sách → chọn role (Target / Native) → click → subtitle load vào overlay như track thường. Nút search **luôn hiển thị** (kể cả khi đã có subtitle) vì user có thể muốn thay subtitle khác.

### User stories

1. **No subtitle:** Video không có subtitle → user mở Manager → gõ tên phim → chọn ngôn ngữ → nhận list → chọn role → click → subtitle load vào role đó.
2. **Replace subtitle:** Video có subtitle nhưng user muốn subtitle khác (bản dịch tốt hơn, ngôn ngữ khác) → user mở Manager → gõ tên → chọn → chọn role (Target hoặc Native) → load thay thế track hiện tại của role đó.
3. **Multi-key free tier:** User đăng ký nhiều free account (SubDL + OpenSubtitles) → nhập nhiều key vào Settings → Cell round-robin key **lúc download** (không phải lúc search) để max quota download free (SubDL: cần verify exact free quota × N keys + OpenSubtitles **100/key/ngày** × M keys, verified 2026-08-13).
4. **Key management:** User thêm/sửa/xóa API key trong Settings, xem danh sách key chia theo provider (SubDL / OpenSubtitles), xem trạng thái mỗi key (active / rate-limited / invalid / unverified) + remaining downloads hôm nay.
5. **TV/series:** User xem drama/series → gõ tên + season + episode → nhận subtitle đúng tập, không phải season zip.

## Architecture

### Network layer — background owns all outbound API calls

Content-script **không** gọi SubDL/OpenSubtitles trực tiếp (CORS fail + lộ key). Toàn bộ network sống ở background SW + offscreen fetch (pattern đã có: `FETCH_SUBTITLE_CONTENT` qua `offscreenFetch`).

**2 message type mới:**

| Type | Direction | Payload | Response |
|------|-----------|---------|----------|
| `SEARCH_SUBTITLES` | content → bg | `{ query, languages, season?, episode?, providerHint? }` | `{ results: SubtitleSearchResult[] } \| { error: SearchError }` |
| `RESOLVE_SUBTITLE_DOWNLOAD` | content → bg | `{ result: SubtitleSearchResult, role: 'target'\|'native' }` | `{ content: string, format: SubtitleFormat } \| { error: SearchError }` |

Background là **single owner** của key ledger + cursor — mutate tuần tự, không read-modify-write từ content-script (tránh concurrent tab clobber). Content-script chỉ gửi query + nhận parsed text.

### Provider interface (extensibility)

```typescript
// src/features/subtitle/logic/subtitleSearch.ts

export interface SubtitleSearchProvider {
  readonly id: 'subdl' | 'opensubtitles';
  /** Pure: normalize raw API JSON → SubtitleSearchResult[]. Không fetch. */
  normalizeSearch(raw: unknown, query: SearchQuery): SubtitleSearchResult[];
  /** Pure: build fetch params (method/url/headers/body) cho background. */
  buildSearchRequest(query: SearchQuery, apiKey: string): FetchPlan;
  /** Pure: build fetch params cho download handshake (nếu cần). */
  buildDownloadRequest(result: SubtitleSearchResult, apiKey: string): FetchPlan;
  /** Pure: trích text + format từ response bytes (decode/gunzip/unzip). */
  decodeDownload(bytes: ArrayBuffer, result: SubtitleSearchResult): { content: string; format: SubtitleFormat };
}
```

`logic/` stays pure — nhận `FetchPlan`, trả `FetchPlan`. Background thực thi `FetchPlan` qua `offscreenFetch`. Thêm provider = thêm 1 object vào registry, không đục `searchSubtitles`.

### Data flow

```
[User gõ query + lang + optional S/E]
        ↓ debounce 300ms + AbortController
[SubtitleSearchPanel] ──SEARCH_SUBTITLES──► [Background SW]
                                                ├ pick provider (SubDL → OS)
                                                ├ pick search key (round-robin, search quota riêng)
                                                ├ offscreenFetch(FetchPlan)
                                                ├ provider.normalizeSearch(raw)
                                                └ return SubtitleSearchResult[]
        ↓ results render
[User click result → chọn role Target|Native]
        ↓
[SubtitleSearchPanel] ──RESOLVE_SUBTITLE_DOWNLOAD──► [Background SW]
                                                ├ pick download key (round-robin, download quota)
                                                ├ if handshake: POST /download → temp link
                                                ├ offscreenFetch(temp link | direct url) → bytes
                                                ├ provider.decodeDownload(bytes) → text + format
                                                ├ update key ledger (remaining--, lastUsed)
                                                └ return { content, format }
        ↓
[Content script] parseSubtitle(content, format) → cues
        ↓
[imported/searched items for chosen role] → loadBilingualCues → overlay + nav + reset offset
```

**Dữ liệu vào:** query, languages, season/episode, `Settings.subtitleApiKeys`
**Dữ liệu ra:** parsed cues vào đúng role, item mới `source: 'searched'`, key ledger update trong background

### What we reuse vs what we don't

| Reuse | Don't reuse |
|-------|-------------|
| `parseSubtitle(content, format)` — parse text → cues | `fetchAndParseSubtitle(url)` — cache theo URL, OS link tạm single-use → cache miss mỗi lần, đốt quota |
| `loadBilingualCues` — load cues vào overlay + nav + reset offset | `parseAndDetectFiles(File[])` — nhận File, không nhận downloaded text |
| `assignImportRole` pattern — gán role cho item | `subtitleDiscovery` pipeline — đó là inbound từ trang, không phải outbound search |
| `offscreenFetch` + DNR referer rule pattern | `FETCH_SUBTITLE_CONTENT` — GET-only, không POST/headers/body |

## Tech Stack

- React + TypeScript (existing Cell stack)
- **SubDL REST API** — base URL `https://api.subdl.com`. **Verified với real key 2026-08-13.**
  - Auth: `Authorization: Bearer $KEY` header (or `X-API-Key`; legacy `?api_key=` accepted cho download URL).
  - Search: `GET /api/v2/subtitles/search` — params: `film_name|sd_id|imdb_id|tmdb_id`, `type` (movie/tv, required khi dùng tmdb_id), `languages` (comma-separated), `season`, `episode`, `full_season=1`, `unpack=1` (expand archive → single-file URLs).
  - Response shape (verified): `{status: true, results: [{sd_id, type, name, imdb_id, tmdb_id, slug}], subtitles: [{release_name, name, lang, author, url, language, season, episode, hi, full_season, unpack_files[]}], totalPages, currentPage}`
  - `unpack_files[]`: `{file_n_id, name, release_name, season, episode, language, hi, format, size, md5, url}` — **url là relative path** (`/subtitle/{slug}/{file_n_id}?api_key=...`), cần prepend `https://api.subdl.com`.
  - `lang` field inconsistent: `"English"` hoặc `"english"` (case varies). `language` field = uppercase 2-letter (`"EN"`).
  - `file_n_id` có thể là empty string cho một số entry → skip những entry này.
  - Download: `GET https://api.subdl.com/subtitle/{slug}/{file_n_id}?api_key=...` — **trả SRT content trực tiếp** (verified, không handshake). Hoặc `GET /api/v2/subtitles/{nId}/download?format=file`.
  - TV search: `season` + `episode` params hoạt động. Trả season packs với `unpack_files[]` chứa individual episodes (`episode` field cho biết tập).
  - Free quota: chưa verify exact (docs nói "anonymous daily IP limiter" cho no-key; Pro = 1.000-2.000/day). Cần test thêm.
  - Source: https://subdl.com/developers (official docs)
- **OpenSubtitles REST API** — base URL `https://api.opensubtitles.com/api/v1`. **Verified với real key 2026-08-13.**
  - Auth: `Api-Key` header (required, sufficient — **không cần JWT/login** cho search + download).
  - **Required header: `User-Agent: Cell v<version>`** — ToS yêu cầu per-app UA. `fetch()` không set được UA (forbidden header) → DNR `modifyHeaders` rule.
  - Search: `GET /subtitles` — params: `query`, `imdb_id`, `tmdb_id`, `languages` (comma-separated, code từ `/infos/languages`: `en`, `vi`, `zh-cn`, `pt-br`, `pt-pt`…), `type` (movie/episode), `season_number`, `episode_number`, `hearing_impaired`, `order_by`, `moviehash`. **Cần `-L` (follow redirect) — API 301 redirect.**
  - Response shape (verified): `{total_pages, total_count, per_page, page, data: [{id, type: "subtitle", attributes: {language, download_count, hearing_impaired, hd, fps, ratings, release, files: [{file_id, file_name}], feature_details: {title, imdb_id, tmdb_id, feature_type}}}]}`
  - Download: **2-step handshake** (verified):
    1. `POST /download?file_id={id}` — **query params, NOT JSON body** (JSON body trả 400!). Headers: `Api-Key`, `User-Agent`, `Accept: application/json`.
    2. Response: `{link, file_name, requests, remaining, message, reset_time, reset_time_utc}` — link tạm, single-use.
    3. `GET {link}` → file bytes (SRT content).
  - **Free quota: 100 downloads/ngày** (verified: `remaining: 99` sau 1 download). Reset tại **midnight UTC** (`reset_time_utc: "2026-08-13T23:59:59.999Z"`).
  - Rate limit: **5 requests/second** (headers `X-RateLimit-Limit-Second: 5`, `RateLimit-Remaining`, `RateLimit-Reset: 1`). Không phải daily quota.
  - Language codes: từ `/infos/languages` endpoint (verified): mostly ISO 639-1 (`en`, `vi`, `fr`, `ja`, `ko`) + extended (`zh-cn`, `zh-tw`, `zh-ca`, `pt-br`, `pt-pt`, `ze`, `az-az`, `tm-td`).
  - Source: https://ai.opensubtitles.com/docs (official), real API test 2026-08-13
- `offscreenFetch` (existing) — fetch cross-origin via offscreen document (SW idle eviction safe)
- `setRefererRule` / DNR `modifyHeaders` (existing pattern) — set `User-Agent` cho OpenSubtitles (forbidden header trong `fetch()`)
- `parseSubtitle` (existing) — parse SRT/VTT/ASS text → cues
- `loadBilingualCues` (existing) — load cues vào overlay
- `SubtitlePanelItem` model (existing, **MODIFY** — thêm `source: 'searched'`)

## Commands

```bash
Build:       npm run build
Dev build:   npx vite build --mode development
Typecheck:   npm run typecheck
Unit test:   npx jest --selectProjects unit --testPathPatterns="<pattern>"
Lint:        npm run lint
```

## Project Structure

```
src/
  features/
    subtitle/
      logic/
        subtitleSearch.ts              # NEW — pure: provider registry, normalize, build FetchPlan, key rotation logic
        subtitleSearch.test.ts         # NEW — unit tests (co-located, theo convention repo)
        subtitleSearchTypes.ts         # NEW — SubtitleSearchResult, SearchQuery, FetchPlan, SearchError, KeyLedger
      ui/
        SubtitleManagerPanel.tsx       # MODIFY — add SearchSection above Target/Native
        SubtitleManagerPanel.module.css# MODIFY — search section styles
        SubtitleManagerPanel.test.tsx  # MODIFY — search section tests
        SubtitleSearchPanel.tsx        # NEW — search UI (input + lang select + S/E + results + role picker)
        SubtitleSearchPanel.module.css # NEW
        SubtitleSearchPanel.test.tsx   # NEW
        subtitlePanelModel.ts          # MODIFY — add 'searched' to source union
        subtitleNaming.ts              # MODIFY — formatSubtitleName accept 'searched'
        reactSubtitleController.ts     # MODIFY — wire onSearch + onResolveDownload
        contentScriptController.ts     # MODIFY — handle searched items per role, persist parsed text
        SubtitlePanels.tsx             # MODIFY — render searched items in role section
        mountSubtitle.tsx              # MODIFY — if needed, pass search callbacks
    settings/
      ui/
        ApiKeyManager.tsx              # NEW — key CRUD UI (add/edit/delete + list by provider + status)
        ApiKeyManager.module.css       # NEW
        ApiKeyManager.test.tsx         # NEW
        SettingsDialogContent.tsx      # MODIFY — add "Subtitle search keys" section
        mountSettingsDialog.ts         # MODIFY — add ApiKeyManager.module.css to SHADOW_CSS
  entrypoints/
    background/
      handlers/
        subtitleSearch.ts              # NEW — SEARCH_SUBTITLES + RESOLVE_SUBTITLE_DOWNLOAD handlers
        subtitle.ts                    # MODIFY (if needed) — register new handlers
      helpers/
        subtitleKeyLedger.ts           # NEW — per-key quota ledger, serialized mutations, cursor
  entities/
    message/
      types.ts                         # MODIFY — add SEARCH_SUBTITLES, RESOLVE_SUBTITLE_DOWNLOAD
      schema.ts                        # MODIFY — add zod schemas for new messages
    settings/
      types.ts                         # MODIFY — add SubtitleApiKey + subtitleApiKeys field
  shared/
    config/
      config.ts                        # MODIFY — DEFAULT_SETTINGS.subtitleApiKeys = []
      messages.ts                      # MODIFY — add new MESSAGE_TYPES
    lib/
      storage/
        settingsStore.ts               # MODIFY — CURRENT_SCHEMA_VERSION 20→21 + MIGRATIONS[20]
docs/
  specs/
    subtitle-search.md                 # THIS
  adr/
    NNN-subtitle-search.md             # NEW — WHY: client-only keys, SubDL-first, no bundled key, background-owns-network
```

## Code Style

Follow existing Cell conventions:
- Named exports, no default export
- Function components + hooks, no class components
- **Pure logic functions in `logic/`** — nhận input, trả output, không `fetch`, không `chrome.storage`. Side effects (network, storage) sống ở background handlers.
- `data-cell-id` attributes for test selectors
- Design tokens from `tokens.css` via CSS modules — đọc `src/shared/styles/README.md` trước
- `import { Button, Icon, IconButton } from '@/shared/ui'`
- No `any` — strict TypeScript
- Algorithm complexity: O(1) → O(log n) lý tưởng; O(n) nếu không còn cách khác; **cấm O(n log n) trở lên** (AGENTS.md)
- Co-located tests (repo convention — `*.test.tsx` cạnh `*.tsx`)

### Example — search result model (discriminated union, không phải `downloadUrl: string`)

```typescript
// src/features/subtitle/logic/subtitleSearchTypes.ts

export type SubtitleDownloadKind =
  | { readonly kind: 'direct'; readonly url: string }           // SubDL: link tải trực tiếp
  | { readonly kind: 'handshake'; readonly fileId: string };    // OpenSubtitles: POST /download → temp link

export interface SubtitleSearchResult {
  /** Provider-namespaced id (e.g. 'subdl:2506211', 'os:5274788'). */
  readonly id: string;
  readonly name: string;
  /** Provider-native language code (SubDL: 'english'; OpenSubtitles: 'en', 'zh-cn', 'pt-br'). */
  readonly providerLanguage: string;
  /** ISO 639-1 mapped (e.g. 'en', 'pt', 'zh'). */
  readonly isoLanguage: string;
  readonly format: 'srt' | 'vtt' | 'ass';
  readonly download: SubtitleDownloadKind;
  readonly source: 'subdl' | 'opensubtitles';
  readonly rating?: number;
  readonly downloads?: number;
  readonly sdh?: boolean;
  readonly forced?: boolean;
  /** Archive (zip) — true khi SubDL format=zip và không dùng unpack=1. */
  readonly isArchive?: boolean;
}

export interface SearchQuery {
  readonly query: string;
  readonly languages: readonly string[];   // ISO 639-1
  readonly season?: number;
  readonly episode?: number;
}

export interface FetchPlan {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly responseType?: 'text' | 'arraybuffer';
}

export type SearchError =
  | { readonly type: 'no-key'; readonly provider: string }
  | { readonly type: 'quota-exhausted'; readonly provider: string }
  | { readonly type: 'rate-limited'; readonly provider: string; readonly retryAfterMs: number }
  | { readonly type: 'auth-invalid'; readonly provider: string }
  | { readonly type: 'network'; readonly message: string }
  | { readonly type: 'parse'; readonly message: string };
```

### Example — API key model (with quota ledger, không phải `lastUsed` round-robin)

```typescript
// src/entities/settings/types.ts

export type SubtitleApiKeyProvider = 'subdl' | 'opensubtitles';
export type SubtitleApiKeyStatus = 'unverified' | 'active' | 'rate-limited' | 'invalid';

export interface SubtitleApiKey {
  readonly id: string;           // uuid
  readonly provider: SubtitleApiKeyProvider;
  readonly key: string;
  readonly label?: string;       // user-given name (e.g. "SubDL free #1")
  readonly status: SubtitleApiKeyStatus;
  readonly addedAt: number;      // timestamp ms
  /** Set by background khi 429. Key không được pick cho đến khi hết hạn. */
  readonly rateLimitedUntil?: number;
}

// Settings interface thêm:
// readonly subtitleApiKeys: SubtitleApiKey[];
```

**Quota ledger sống ở background, không trong Settings** (concurrent tabs không clobber):

```typescript
// src/entrypoints/background/helpers/subtitleKeyLedger.ts

interface KeyLedgerEntry {
  readonly keyId: string;
  readonly provider: string;
  /** Số download còn lại trong window hiện tại. */
  remainingDownloads: number;
  /** Timestamp khi window reset (quota refill). */
  resetAt: number;
  /** Cursor index cho round-robin (chỉ tăng lúc download, không lúc search). */
  lastDownloadAt: number;
}

// All mutations serialized trong background SW — single-threaded event loop.
// Persist vào chrome.storage.session (không sync, không leak across profiles).
// Pick download key: filter active + remaining > 0 + not rate-limited → oldest lastDownloadAt.
// Pick search key: search quota riêng (SubDL 2000/ngày) — ít khi hết, pick oldest lastDownloadAt.
```

### Example — provider registry (extensibility, không hardcode if)

```typescript
// src/features/subtitle/logic/subtitleSearch.ts

const PROVIDERS: Record<string, SubtitleSearchProvider> = {
  subdl: subdlProvider,
  opensubtitles: openSubtitlesProvider,
};

export function pickProviderOrder(): string[] {
  return ['subdl', 'opensubtitles'];  // SubDL-first, OS fallback
}

export function normalizeSearch(providerId: string, raw: unknown, query: SearchQuery): SubtitleSearchResult[] {
  return PROVIDERS[providerId].normalizeSearch(raw, query);
}

export function buildSearchRequest(providerId: string, query: SearchQuery, apiKey: string): FetchPlan {
  return PROVIDERS[providerId].buildSearchRequest(query, apiKey);
}
// ... buildDownloadRequest, decodeDownload tương tự
```

## API Reference (verified với real API calls 2026-08-13)

### SubDL — `https://api.subdl.com`

Source: https://subdl.com/developers + real API test 2026-08-13

#### Search: `GET /api/v2/subtitles/search`

| Param | Required | Description |
|-------|----------|-------------|
| `sd_id\|imdb_id\|tmdb_id\|film_name\|file_name` | yes (1 trong các) | Title key |
| `type` | khi dùng `tmdb_id` | `movie` hoặc `tv` |
| `languages` | no | Comma-separated language codes (e.g. `en,vi`) |
| `season` | no | TV season number |
| `episode` | no | TV episode number |
| `full_season` | no | `1` = season pack |
| `unpack` | no | `1` = expand archives → single-file download URLs (tránh zip handling) |

Auth: `Authorization: Bearer $KEY`

Response shape (verified):
```json
{
  "status": true,
  "results": [
    { "sd_id": 2922, "type": "movie", "name": "Inception", "imdb_id": "tt1375666", "tmdb_id": 27205, "slug": "inception" }
  ],
  "subtitles": [
    {
      "release_name": "Inception.2010.1080p.BluRay.x265-YAWNTiC_eng",
      "name": "Inception.2010.1080p.BluRay.x265-YAWNTiC_eng.zip",
      "lang": "English",
      "author": "YTSDD",
      "url": "/subtitle/3467330-8390389.zip?api_key=...",
      "subtitlePage": "/s/info/aUEepyPYhXB",
      "season": 0,
      "episode": null,
      "language": "EN",
      "hi": false,
      "full_season": false,
      "unpack_files": [
        {
          "file_n_id": "9Z7h1Yr0CI",
          "name": "Inception.2010.1080p.BluRay.x265-YAWNTiC_eng SDH.srt",
          "release_name": "Inception.2010.1080p.BluRay.x265-YAWNTiC_eng SDH",
          "season": 0,
          "episode": 0,
          "language": "EN",
          "hi": true,
          "format": "srt",
          "size": 135733,
          "md5": "723b23daba3b9453307d304ab2dbbd3b",
          "url": "/subtitle/aUEepyPYhXB/9Z7h1Yr0CI?api_key=..."
        }
      ]
    }
  ],
  "totalPages": 15,
  "currentPage": 1
}
```

**Key findings (verified):**
- `url` là relative path → prepend `https://api.subdl.com`
- `lang` field inconsistent: `"English"` hoặc `"english"` (case varies). `language` field = uppercase 2-letter (`"EN"`).
- `file_n_id` có thể là empty string → skip những entry này.
- `unpack=1` trả `unpack_files[]` với single-file URLs (tránh zip). **Luôn dùng `unpack=1`.**
- TV search: `season` + `episode` params hoạt động. `unpack_files[].episode` cho biết tập nào.

#### Download: `GET https://api.subdl.com/subtitle/{slug}/{file_n_id}?api_key=...`

**Trả SRT content trực tiếp** (verified — first lines là SRT format). Không handshake.

Hoặc dùng endpoint docs: `GET /api/v2/subtitles/{nId}/download?format=file`

→ SubDL download = `kind: 'direct'` trong `SubtitleDownloadKind`. URL = `https://api.subdl.com` + `unpack_files[].url`.

### OpenSubtitles — `https://api.opensubtitles.com/api/v1`

Source: https://ai.opensubtitles.com/docs + real API test 2026-08-13

#### Search: `GET /subtitles` (follow redirects — 301)

| Param | Required | Description |
|-------|----------|-------------|
| `query` | yes (or imdb_id/tmdb_id) | Search by title |
| `imdb_id` | alt | `tt1375666` |
| `tmdb_id` | alt | `27205` |
| `languages` | no | Comma-separated, codes từ `/infos/languages` (`en`, `vi`, `zh-cn`, `pt-br`…) |
| `type` | no | `movie` hoặc `episode` |
| `season_number` | no | TV season |
| `episode_number` | no | TV episode |
| `hearing_impaired` | no | `only` hoặc `exclude` |
| `order_by` | no | e.g. `download_count` |
| `moviehash` | no | Video file hash (highest accuracy) |

Auth: `Api-Key: $KEY` header. **Required: `User-Agent: Cell v<version>`** (ToS). **Không cần JWT/login** — API key alone sufficient.

Response shape (verified):
```json
{
  "total_pages": 2,
  "total_count": 56,
  "per_page": 50,
  "page": 1,
  "data": [
    {
      "id": "4859512",
      "type": "subtitle",
      "attributes": {
        "subtitle_id": "4859512",
        "language": "en",
        "download_count": 7617,
        "hearing_impaired": false,
        "hd": false,
        "fps": 23.976,
        "ratings": 5.0,
        "release": "Inception",
        "ai_translated": false,
        "machine_translated": false,
        "foreign_parts_only": false,
        "upload_date": "2019-06-15T21:59:52Z",
        "uploader": { "uploader_id": 61795, "name": "coolgit", "rank": "Admin Warning" },
        "feature_details": {
          "feature_id": 554572,
          "feature_type": "Movie",
          "year": 2010,
          "title": "Inception",
          "imdb_id": 1375666,
          "tmdb_id": 27205
        },
        "files": [
          { "file_id": 4982777, "cd_number": 1, "file_name": "Inception" }
        ]
      }
    }
  ]
}
```

**Key:** `attributes.files[0].file_id` cần cho download. `attributes.language` là language code.

#### Download: 2-step handshake (verified)

**Step 1:** `POST /download?file_id={id}` — **query params, NOT JSON body** (JSON body trả 400!)

Headers: `Api-Key`, `User-Agent: Cell v<version>`, `Accept: application/json`

```bash
curl -X POST "https://api.opensubtitles.com/api/v1/download?file_id=10813639" \
  -H "Api-Key: $KEY" -H "User-Agent: Cell v0.1-test" -H "Accept: application/json"
```

Response (verified):
```json
{
  "link": "https://www.opensubtitles.com/download/C9343D21B487.../subfile/tt1375666-en.srt",
  "file_name": "tt1375666-en.srt",
  "requests": 1,
  "remaining": 99,
  "message": "Your quota will be renewed in 15 hours and 46 minutes (2026-08-13 23:59:59 UTC)",
  "reset_time": "15 hours and 46 minutes",
  "reset_time_utc": "2026-08-13T23:59:59.999Z"
}
```

**Quota counted ở bước này.** `remaining` + `reset_time_utc` → update key ledger.

**Step 2:** `GET {link}` → file bytes (SRT content, verified).

→ OpenSubtitles download = `kind: 'handshake'` với `fileId` trong `SubtitleDownloadKind`.

#### Quota & rate limits (verified)

| Metric | Value | Source |
|--------|-------|--------|
| **Free daily downloads** | **100/day** | `remaining: 99` sau 1 download |
| **Reset time** | **Midnight UTC** | `reset_time_utc: "2026-08-13T23:59:59.999Z"` |
| **Rate limit** | **5 req/second** | Headers `X-RateLimit-Limit-Second: 5` |
| Rate limit headers | `RateLimit-Remaining`, `RateLimit-Reset`, `X-RateLimit-Remaining-Second` | Response headers |

→ Key ledger đọc `remaining` + `reset_time_utc` từ POST /download response (không phải headers).

#### Language code mapping (verified từ `/infos/languages`)

| Cell (ISO 639-1) | OpenSubtitles | SubDL (`language` field) |
|-------------------|---------------|-------|
| `en` | `en` | `EN` |
| `vi` | `vi` | (chưa test) |
| `zh` | `zh-cn` (simplified), `zh-tw` (traditional), `zh-ca` (Cantonese), `ze` (bilingual) | (chưa test) |
| `pt` | `pt-pt` (Portugal), `pt-br` (Brazil) | (chưa test) |
| `ja` | `ja` | (chưa test) |
| `ko` | `ko` | (chưa test) |

OpenSubtitles dùng codes từ `/infos/languages` endpoint (verified full list: 95 languages). SubDL `language` field = uppercase 2-letter. SubDL `lang` field = tên language (inconsistent case). **Map qua `languageRegistry` trong Cell.**

### Example — failure taxonomy (fallback chain)

```
Search:
  SubDL search → 200 + results → return
  SubDL search → 200 + 0 results → try OpenSubtitles
  SubDL search → 429 → mark key rate-limited, pick next SubDL key, retry
  SubDL search → all SubDL keys exhausted → try OpenSubtitles
  OpenSubtitles → 200 + results → return
  OpenSubtitles → 0 results → return empty (không phải error)
  OpenSubtitles → all keys exhausted → return { error: quota-exhausted }

Download:
  Pick download-capable key (active + remaining > 0)
  → handshake if needed (OS POST /download)
  → fetch bytes → decode → return text
  → on 429: mark rate-limited, pick next key, retry
  → on 401/403: mark invalid, pick next key, retry
  → all keys exhausted → return { error: quota-exhausted }
```

## UI Design

### SubtitleManagerPanel — Search section ở trên cùng

```
┌ Search subtitles ──────────────────────────┐
│ [query input..........] [lang ▾] [S][E]    │
│ [Search]                                   │
│                                            │
│ results (name · lang · source · rating)    │
│ ┌────────────────────────────────────────┐ │
│ │ MovieTitle.en.srt · English · SubDL    │ │
│ │ MovieTitle.vi.srt · Vietnamese · SubDL │ │
│ └────────────────────────────────────────┘ │
│ click result → [Load as Target] [Native]   │
└────────────────────────────────────────────┘
┌ Target … Import                            ┐
│ Off / tracks / Latency                     │
├ Native … Import                            ┤
└ Generate native / Appearance               ┘
```

**No key state:** Search section collapsed, 1 dòng "Add API key in Settings to search subtitles" + link mở Settings. Không chiếm không gian overlay khi chưa setup.

**Has key state:** Search section expanded, input + lang + S/E + Search button.

**Loading:** Spinner trong Search button, results area skeleton. Không block UI. AbortController cancel khi user gõ thêm.

**Result click:** Hiện 2 nút "Load as Target" / "Load as Native" — user chọn role. Không auto-load.

### Settings — section "Subtitle search keys"

```
Subtitle search keys

SubDL
  • Free #1  ••••a1b2  Active · 47/50 left    [Edit] [Delete]
  • Free #2  ••••9k2x  Rate-limited until 14:00
  [+ Add SubDL key]

OpenSubtitles
  • Main     ••••zz41  Active · 18/20 left    [Edit] [Delete]
  • Backup   ••••xx42  Unverified
  [+ Add OpenSubtitles key]
```

- Mask key (last 4 chars only: `••••1234`)
- Status badge: Active (green) / Rate-limited (amber) / Invalid (red) / Unverified (gray)
- Remaining downloads hôm nay (đọc từ ledger qua message)
- Delete có confirm dialog
- **Không validate-on-add bằng search "test"** — đốt quota + có thể brick key nếu 429. Mark `unverified` → `active` lúc first 200 response.

### Responsive (320px → desktop)

- Search section: input full-width, lang/S/E wrap below, Search button full-width
- Results: 1 column, scroll within section (max-height 40vh, không tràn overlay)
- ApiKeyManager: 1 column, key card stack vertically

### Accessibility

- Search input có `<label>` (visually hidden ok)
- Results list `role="listbox"`, mỗi result `role="option"`, arrow-key nav (chưa có trong trackList hiện tại — thêm mới)
- ApiKeyManager form fields có label, delete có confirm dialog (focus trap)

## Testing Strategy

- **Unit tests** (co-located `*.test.ts`):
  - Pure search logic: `normalizeSearch` cho mỗi provider (SubDL JSON shape, OS JSON shape, empty/malformed)
  - `buildSearchRequest` / `buildDownloadRequest` — đúng method/headers/body
  - `decodeDownload` — UTF-8, CP1251, Big5, gzip, zip (chọn file theo lang)
  - Key rotation: pick oldest `lastDownloadAt`, skip rate-limited/invalid, all exhausted → undefined
  - Failure taxonomy: 429 → rate-limited, 401/403 → invalid, 0 results → fallback, all keys exhausted → quota-exhausted
  - Language mapping: ISO 639-1 ↔ provider-native (`en`↔`eng`, `pt`↔`por`/`pt-br`, `zh`↔`chi`/`zh-cn`)
- **Component tests** (co-located `*.test.tsx`):
  - `SubtitleSearchPanel`: render states (idle, no-key, loading, results, empty, error), search trigger + debounce, result click → role picker, abort on new input
  - `ApiKeyManager`: add key, edit label, delete + confirm, list by provider, status badge, masked key
- **Integration** (mocked providers): `SEARCH_SUBTITLES` → 429 → rotate key → 200; `RESOLVE_SUBTITLE_DOWNLOAD` → OS handshake → temp link → bytes → decode; gzip/zip archive; non-UTF8 encoding
- **Browser test** (manual via `testing-extension-browser` skill): search trên real video page (kisskh drama, moviepire series), verify subtitle loads vào overlay đúng role
- **Coverage**: search logic + key rotation 100% (pure functions), panel components >90%

## Boundaries

### Always do
- Run `npm run build` after code changes (build bắt lỗi Vite/rollup mà tsc không thấy)
- Background owns all network calls (SubDL/OpenSubtitles) — content-script không fetch API trực tiếp
- Reuse `parseSubtitle` + `loadBilingualCues` — không viết parallel parser
- Cache **parsed text** cho searched track (persist trong content-script memory), không cache URL handshake (single-use)
- Use design tokens, no hardcoded colors/sizes
- API keys stored in `Settings.subtitleApiKeys` (`chrome.storage.local`)
- SubDL-first, OpenSubtitles fallback only when SubDL returns 0 results OR all SubDL keys exhausted
- Round-robin key rotation **lúc download** (quota binding), không lúc search
- Auto-mark key status: 429 → `rate-limited` (with `rateLimitedUntil` from `Retry-After`), 401/403 → `invalid`, first 200 → `active`
- Mask key display in UI (last 4 chars only)
- Debounce search input 300ms + AbortController cancel in-flight
- Timeout 3s per request (AGENTS.md <3s response)
- Update `docs/2-architechture-system.md` + `docs/0-wiki.md` sau khi đổi/sửa/xóa file `src/` hoặc `docs/`
- Add `ApiKeyManager.module.css` to `SHADOW_CSS` trong `mountSettingsDialog.ts` (nếu không → style vanish trong shadow DOM)
- **SubDL: luôn dùng `unpack=1`** trong search params để nhận `unpack_files[]` single-file URLs (tránh zip handling)
- **SubDL: skip entries có `file_n_id` rỗng** — không download được
- **SubDL: prepend `https://api.subdl.com`** vào `unpack_files[].url` (relative path)
- **OpenSubtitles: POST /download dùng query params `?file_id={id}`**, NOT JSON body (JSON body trả 400)
- **OpenSubtitles: follow redirects** — search endpoint 301 redirect, fetch cần `redirect: 'follow'`
- **OpenSubtitles: đọc quota từ POST /download response** (`remaining`, `reset_time_utc`), không từ headers

### Ask first
- Adding new npm dependency
- Changing `manifest.json` host permissions (hiện đã `<all_urls>` — không cần thêm, nhưng confirm)
- Adding new DNR rule cho User-Agent (OpenSubtitles ToS — confirm approach)

### Never do
- Bundle API keys in extension code
- Send API keys to third-party servers (only to SubDL/OpenSubtitles directly)
- Block UI while searching (always async with loading state)
- Auto-download without user click (respect user choice — user phải chọn role + click)
- Share keys between users
- Validate key on add bằng search "test" (đốt quota)
- Store key ledger trong `Settings` (concurrent tabs clobber) — ledger sống trong `chrome.storage.session`, mutate ở background

## Schema Migration (v20 → v21)

`CURRENT_SCHEMA_VERSION` hiện = 20. Thêm field `subtitleApiKeys`:

```typescript
// settingsStore.ts
export const CURRENT_SCHEMA_VERSION = 21;

// MIGRATIONS[20]: (s) => {
//   const merged = { ...DEFAULT_SETTINGS, ...s, schemaVersion: 21 } as Record<string, unknown>;
//   merged.subtitleApiKeys = Array.isArray(merged.subtitleApiKeys) ? merged.subtitleApiKeys : [];
//   return merged;
// }
```

`DEFAULT_SETTINGS.subtitleApiKeys = []` trong `config.ts`.

## Success Criteria

1. **Search UI visible:** SubtitleManagerPanel hiển thị search section khi có ≥1 key. Không có key → collapsed + hint "Add API key in Settings" + link mở Settings.
2. **Search by name + language + S/E:** User gõ tên phim + chọn ngôn ngữ + (optional) season/episode → nhận danh sách subtitle từ SubDL. TV series trả về episode đúng, không phải season zip.
3. **Fallback chain:** SubDL 0 results → OpenSubtitles. SubDL 429 → rotate key → retry. All SubDL keys exhausted → OpenSubtitles. All keys exhausted → toast "All keys exhausted, add more in Settings".
4. **Download + load:** Click result → chọn role (Target/Native) → background resolve download → parse → load vào role đó → overlay hiển thị cues, nav cluster update, offset reset. Persist parsed text (reload page không re-download).
5. **Multi-key management:** Settings dialog có ApiKeyManager section: add (provider + key + label), edit (label/key), delete (confirm), list by provider, status badge, remaining downloads, masked key.
6. **Key rotation increases quota:** N key SubDL → N×(free quota) download/ngày. M key OpenSubtitles → M×100 download/ngày (verified). Round-robin oldest `lastDownloadAt`. Rate-limited key skip cho đến khi `rateLimitedUntil` hết hạn. Ledger serialize ở background, concurrent tabs không clobber.
7. **Error handling:** Network error / API error / parse error / encoding error → toast + UI error state, không crash. 3s timeout per request.
8. **Loading state:** Search đang chạy → spinner + skeleton, không block UI. New input abort in-flight.
9. **Responsive:** Search section + ApiKeyManager hoạt động trên mobile (320px) + desktop.
10. **Accessibility:** Search input có label, results list `role="listbox"` + arrow-key nav, ApiKeyManager form fields có label, delete có confirm.
11. **Extensibility:** Thêm provider mới = thêm 1 object vào `PROVIDERS` registry + 1 status badge, không đục `searchSubtitles` hay `pickKey`.
12. **Build pass:** `npm run build` + `npm run typecheck` + `npm run test:unit` pass.

## Open Questions — đã đóng

| Q | Decision |
|---|----------|
| Language selector | Default = target + native từ `selectedSubtitleLanguages`. Toggle "All languages" để search rộng. |
| Result limit | 20 results đầu. Nút "More" nếu API có page 2. Không infinite scroll trong overlay. |
| Validate-on-add | **Không** search "test". Mark `unverified` → `active` lúc first 200. Tránh brick key trên 429. |
| Role assignment | User chọn role (Target/Native) sau khi click result. Không auto-guess. |
| Replace semantics | Load vào role thay thế track hiện tại của role đó (giống import). |
| Persistence | Parsed text cached trong content-script memory (Map by result.id). Reload page → re-download (nhưng key đã active, không brick). |
| OpenSubtitles User-Agent | DNR `modifyHeaders` rule (pattern đã có `setRefererRule`). Verified: API chấp nhận `User-Agent: Cell v0.1-test`. |
| OpenSubtitles JWT login | **Không cần** — API key alone sufficient (verified). Login chỉ cho quota cao hơn nếu có account VIP. |
| OpenSubtitles download format | **POST query params** `?file_id={id}`, NOT JSON body (verified — JSON body trả 400). |
| SubDL download URL | `https://api.subdl.com` + `unpack_files[].url` (relative path, verified). |

## Review findings → resolutions

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| 1 | Network layer sai chỗ (content-script fetch → CORS fail) | Blocker | Background owns search+download via `SEARCH_SUBTITLES` / `RESOLVE_SUBTITLE_DOWNLOAD` + `offscreenFetch` |
| 2 | `downloadUrl` fiction cho OpenSubtitles (cần POST handshake) | Blocker | Discriminated union `SubtitleDownloadKind` (`direct` \| `handshake`) |
| 3 | `fetchAndParseSubtitle` cache theo URL → cache miss + đốt quota | Blocker | Cache parsed text by result.id, reuse chỉ `parseSubtitle` + `loadBilingualCues` |
| 4 | Key rotation không tăng quota (`lastUsed` không ghi, `rateLimitedUntil` không đọc) | Blocker | Quota ledger per-key (`remainingDownloads`, `resetAt`) ở background, serialize mutations, rotate lúc download |
| 5 | Search chung không có role-assignment rule | Blocker | User chọn role sau click result. `source: 'searched'` thêm vào `SubtitlePanelItem` |
| 6 | `parseAndDetectFiles` nhận `File[]`, không nhận text → reuse claim sai | Major | Reuse chỉ `parseSubtitle` + `loadBilingualCues`, không claim reuse import pipeline |
| 7 | Schema v21 bị "Ask first" | Major | Schema migration v20→v21 là phần của spec, không phải câu hỏi |
| 8 | Fallback mơ hồ (chỉ khi 0 results) | Major | Failure taxonomy: 429 → rotate key → retry; all keys exhausted → fallback provider |
| 9 | Language code không map | Major | `providerLanguage` (native) + `isoLanguage` (mapped) trong result; map qua `languageRegistry` |
| 10 | TV/episode không search được | Major | `SearchQuery` thêm `season?` + `episode?` |
| 11 | Timeout/abort thiếu | Major | Debounce 300ms + AbortController + 3s timeout |
| 12 | No key = dead UI trên overlay nhỏ | Major | Collapsed + 1 dòng hint khi chưa có key |
| 13 | Không provider interface | Major | `SubtitleSearchProvider` registry, không hardcode if |
| 14 | Testing Strategy nói `tests/unit/` nhưng repo co-locates | Minor | Sửa thành co-located `*.test.ts` cạnh `*.ts` |
| 15 | `pickKey` sort O(n log n) | Minor | Pick oldest `lastDownloadAt` = O(n) scan, không sort |
| 16 | `ApiKeyManager.module.css` phải thêm vào `SHADOW_CSS` | Minor | List trong Project Structure + Boundaries |
| 17 | "Never store keys in plaintext outside chrome.storage" — `chrome.storage.local` cũng plaintext | Minor | Bỏ false assurance, ghi ADR WHY |
| 18 | Validate-on-add brick key trên 429 | Minor | Mark `unverified` → `active` lúc first 200, không validate-on-add |
| 19 | Success criteria 4 & 6 không measurable | Minor | Sửa với assertion cụ thể (N×50 download, persist parsed text) |
| 20 | Thiếu `docs/0-wiki.md` + `docs/2-architechture-system.md` update | Minor | Thêm vào Boundaries "always do" |

## Source-driven verification (real API test 2026-08-13)

Verified spec assumptions against official API docs + **real API calls với provided keys**.

### Test results — all passed

| Test | Endpoint | Result |
|------|----------|--------|
| SubDL search (movie) | `GET /api/v2/subtitles/search?film_name=Inception&languages=en&unpack=1` | 200, 10+ results with `unpack_files[]` |
| SubDL search (TV S1E1) | `GET /api/v2/subtitles/search?film_name=Game of Thrones&languages=en&season=1&episode=1&unpack=1` | 200, season packs + individual episodes |
| SubDL download | `GET /subtitle/{slug}/{file_n_id}?api_key=...` | 200, SRT content trực tiếp (no handshake) |
| OpenSubtitles search | `GET /subtitles?query=Inception&languages=en` | 200 (after 301 redirect), 56 results |
| OpenSubtitles search (vi) | `GET /subtitles?query=Inception&languages=vi` | 200, 10 Vietnamese subtitles |
| OpenSubtitles languages | `GET /infos/languages` | 200, 95 language codes |
| OpenSubtitles download step 1 | `POST /download?file_id=10813639` | 200, `{link, remaining: 99, reset_time_utc}` |
| OpenSubtitles download step 2 | `GET {link}` | 200, SRT content |

### Confirmed correct (real test)

| Assumption | Verified |
|------------|----------|
| SubDL download = direct GET, returns SRT bytes | ✅ First lines: `1\n00:02:09,796 --> 00:02:12,549\nAre you here to kill me?` |
| SubDL `unpack=1` returns `unpack_files[]` with single-file URLs | ✅ Each file has `url`, `file_n_id`, `format`, `size`, `md5` |
| SubDL TV search with season/episode works | ✅ `season=1&episode=1` returns season packs + individual episodes |
| OpenSubtitles download = 2-step handshake | ✅ POST returns `link`, GET returns SRT bytes |
| OpenSubtitles requires `User-Agent` header | ✅ (header sent, accepted) |
| OpenSubtitles API key alone sufficient (no JWT) | ✅ Search + download worked without `/login` |
| OpenSubtitles quota = 100/day, reset midnight UTC | ✅ `remaining: 99`, `reset_time_utc: "2026-08-13T23:59:59.999Z"` |
| OpenSubtitles rate limit = 5 req/second | ✅ Headers `X-RateLimit-Limit-Second: 5` |

### Discrepancies found & fixed (real test)

| # | Spec said | Reality (verified) | Fix |
|---|-----------|---------|-----|
| S1 | SubDL base URL `https://subdl.com/api/v2/` | `https://api.subdl.com` | Sửa Tech Stack + API Reference |
| S2 | OpenSubtitles languages = ISO 639-2B | ISO 639-1 + extended (`zh-cn`, `pt-br`, `ze`…) — verified 95 codes | Sửa language mapping table |
| S3 | SubDL download cần handshake | Direct GET returns SRT bytes | `kind: 'direct'` confirmed |
| S4 | SubDL `unpack` không mention | `unpack=1` returns `unpack_files[]` — **luôn dùng** | Thêm vào Boundaries |
| S5 | OpenSubtitles search params `season`/`episode` | `season_number`/`episode_number` | Sửa API Reference |
| S6 | Quota ledger tự tính | OS trả `remaining` + `reset_time_utc` trong POST /download response | Ledger đọc từ API response |
| S7 | SubDL auth không rõ | `Authorization: Bearer $KEY` hoặc `?api_key=` | Sửa Tech Stack |
| S8 | OpenSubtitles JWT login required | **Không cần** — API key alone works | Note trong API Reference |
| S9 | OpenSubtitles download = POST JSON body | **POST query params** `?file_id={id}` — JSON body trả 400! | Sửa API Reference (critical) |
| S10 | OpenSubtitles free quota = 5-20/day | **100/day** (verified `remaining: 99`) | Sửa User stories + Success criteria |
| S11 | SubDL `nId` field name | Response không có `nId` field — dùng `unpack_files[].file_n_id` + `url` | Sửa API Reference |
| S12 | SubDL `lang` field consistent | Inconsistent: `"English"` hoặc `"english"`. `language` field = `"EN"` (uppercase) | Sửa API Reference |
| S13 | SubDL `file_n_id` luôn có | Có thể empty string → skip entry | Sửa API Reference |
| S14 | OpenSubtitles search no redirect | 301 redirect → cần follow (`-L` / `redirect: 'follow'` in fetch) | Sửa API Reference |

### Still UNVERIFIED

- SubDL free tier exact download quota — docs nói "anonymous daily IP limiter" cho no-key; Pro = 1.000-2.000/day. Free key quota chưa có header rõ ràng. Cần test đến khi hết quota.
- SubDL search quota — không có rate limit header rõ ràng trong response.
