# Player Support — Subtitle List Detection Research

> Painpoint: extension chỉ auto-detect 1 subtitle (cái player load sẵn). Muốn subtitle khác phải
> vào player chính chọn → player fetch → extension mới thấy → overlay mới hiển thị. Quá nhiều bước.
> Mong muốn: extension phát hiện **list** subtitle có sẵn trong player.
>
> File này ghi root cause + giải pháp từ điều tra trang thật (debugging-and-error-recovery skill,
> evidence-first). Không đoán — mọi claim có evidence từ DevTools MCP.

## Trang test

| Site | URL | Player | Trạng thái điều tra |
|---|---|---|---|
| shuttletv.su | `https://shuttletv.su/watch/1275779` | cinesrc.st embed (iframe cross-origin) | ⚠️ Player-side verified: **100 API entries**; extension resolver chưa implement |
| kisskh.co | `https://kisskh.co/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851` | Angular SPA + HLS (same-origin) | ⚠️ Player-side verified: **6 direct SRT**; extension resolver/token replay chưa implement |
| moviepire.ru | `https://moviepire.ru/watch/125988?s=1&e=1` | videasy.to embed (iframe cross-origin) | ✅ Decoder implemented and unit-tested; provider-specific mapping verified in `cell-profile` (S1E2); all `sources-with-title` providers handled |
| lookmovie2.to | `https://www.lookmovie2.to/shows/play/1704445437-silo-2023#S1-E1-224948` | video.js + plyr (same-origin) | ⚠️ API verified: **111 entries = 87 direct VTT + 24 OpenSubtitles metadata arrays**; extension delivery chưa implement |
| lunastream.com.cv | `https://lunastream.com.cv/play/tv/113962` | moviesapi.to → ww2.moviesapi.to → flixcdn.cyou (JWPlayer 8, iframe cross-origin) | ⚠️ Player-side verified: iframe hash có **33 direct URLs**; extension cross-frame delivery chưa implement |
| broodingmovies.com | `https://broodingmovies.com/tv/7essw-lucky/season/1/episode/1` | nextgencloudfabric.com embed (iframe cross-origin, HLS.js custom player) | ⚠️ API verified: **42 direct URLs**; page CORS block, background Referer/Origin replay chưa verify |
| noxx.to | `https://noxx.to/tv/silo/3/5` | player.unlimitedfiles.xyz → cloudorchestranova.com → `/prorcp` (deep cross-origin) | ⚠️ Player-side verified: `window.the_subtitles` có **43 direct VTT**, HEAD 43/43 OK; extension bridge chưa implement |
| myasiantv.es | `https://ww19.myasiantv.es/ep/the-hidden-shadow-2026-episode-12-english-subbed/` | kisscloud.online embed (iframe cross-origin) | ⚠️ Player HTML verified: **4 direct WebVTT**; cần Referer replay + các server khác chưa audit |
| onflix.lat | `https://onflix.lat/xem-phim/chuyen-tinh-ma-quai/vietsub-sn/vietsub/1` | playembed.vip embed | ⚠️ Browser/network verified: **2 direct VTT** (Việt + Anh); HLS subtitle tags + server khác chưa audit |

---

## Live re-audit 2026-08-03 — authoritative status

> **Important:** Các section lịch sử bên dưới ghi lại những lần điều tra trước. Bảng này là kết quả
> re-audit mới nhất và phân biệt rõ `player-side verified` với `extension-delivery verified`.
> “Nhìn thấy list trong DevTools/PowerShell” **không có nghĩa** extension hiện tại đã tự động đưa list
> vào `NetworkInterceptor`.

### Tiêu chí kiểm chứng

Một site chỉ được gọi là **extension solution verified** khi đủ cả 4 điều kiện:

1. **Discover**: extension tự tìm được list mà không cần user click từng subtitle.
2. **Normalize**: mỗi entry được đổi thành URL trực tiếp + language + format hợp lệ.
3. **Replay**: URL fetch lại được trong context của extension với Referer/Origin/token/cookie cần thiết.
4. **Deliver**: tất cả entry đi qua background pipeline và xuất hiện trong subtitle inventory/panel.

Audit hiện tại mới verify chắc chắn phần (1)/(2) ở nhiều site; (3)/(4) chưa được implement/test end-to-end.

### Kết quả player-side hiện tại

| Site | Nguồn list đã verify | Kết quả hiện tại | Trạng thái extension |
|---|---|---|---|
| shuttletv/cinesrc | `GET subs.bright67.online/search?id=1275779` | JSON bare array **100 entries**, 98 SRT + 2 SSA; tất cả có URL. UI còn có built-in/auto tracks, badge total lệch API và cần reconcile. | ❌ Chưa có listing resolver/response-body capture |
| kisskh | `GET kisskh.co/api/Sub/207851?kkey=...` | JSON array **6 entries**, tất cả direct SRT: English, Arabic, Khmer, Indonesia, Malay, Vietnamese. | ❌ Chưa replay `kkey` trong background/listing resolver |
| lookmovie2 | `GET /api/v1/security/episode-access?...` | **111 entries**: 87 direct relative VTT; 24 `file` là array metadata OpenSubtitles, chưa phải URL tải trực tiếp. | ❌ 87 có thể normalize; 24 cần resolver riêng |
| lunastream | `ww2.moviesapi.to` iframe `flixcdn.cyou#...&subs=[JSON]` | **33 entries**, tất cả URL trực tiếp; 31 language entries + English Hi + Greek Hi. Parent có thể đọc thuộc tính `iframe.src`; không cần đọc `contentDocument`. | ❌ Chưa parse/re-inject |
| broodingmovies | `streamdata.vaplayer.ru/api.php?...` | HTTP 200 JSON `default_subs` **42 entries**, tất cả có URL. Page fetch bị CORS; request cần context header. | ❌ Background Referer/Origin replay chưa verify |
| moviepire/videasy | encrypted `/<provider>/sources-with-title?...&enc=2&seed=...` | Provider-specific mapping verified (e.g. `cdn` 67 direct VTT, `m4uhd` 1 SRT, `downloader2` 2, `meine`/`lamovie` 0). Decoder dùng chung cho mọi provider path. | ✅ Decoded by extension using seed + tmdbId from captured response URL; provider extracted from path |
| noxx | deep `cloudorchestranova.com/prorcp/<token>` | `window.the_subtitles` có **43 `[label]/relative .vtt`**; parse được và HEAD 43/43 OK (`text/vtt`). | ❌ Chưa bridge player state từ deep iframe |
| myasiantv/kisscloud | HTML `var playerjsSubtitle` | **4 direct WebVTT**: English, Thai 1–3; URL fetch 4/4 HTTP 200 khi có Referer. | ❌ Chưa parse HTML variable + replay Referer |
| onflix/playembed | iframe m3u8 + VTT requests | Browser phát sinh **2 direct VTT**; nội dung xác nhận một Việt, một Anh. Master HLS trả 1080p playlist; `EXT-X-MEDIA` chưa được kiểm tra. | ⚠️ 2 VTT đã verified; full server/HLS list chưa đủ evidence |

### Những gì current codebase chưa làm được

- `NetworkInterceptor` chỉ bắt URL qua `webRequest.onBeforeRequest`; không có generic response-body capture.
- `isStremioSubtitleListing` chỉ match shape Stremio; không match cinesrc, kisskh, lookmovie,
  vaplayer hoặc HTML/player-state sources.
- `pageScanner` scan native `<track>`; không đọc video.js `remoteTextTracks()`, JWPlayer playlist,
  `window.the_subtitles`, React player state hoặc encrypted response.
- `offscreenFetch` có thể fetch text, nhưng parser hiện tại chỉ có Stremio JSON shape; chưa có registry
  cho bare-array JSON, HTML JavaScript variable, iframe hash, encrypted JSON hay player state.
- Referer/Origin DNR helper đã tồn tại nhưng chỉ được dùng trong các flow subtitle hiện có; chưa verify
  end-to-end cho từng listing. Rule match exact URL + `xmlhttprequest`, nên tokenized/expiring URL phải
  giữ nguyên captured URL hoặc có replay strategy.
- `DetectedSubtitle` hiện chỉ biểu diễn URL trực tiếp; không biểu diễn `unresolved metadata`,
  `source handle`, `auth context`, `confidence` hoặc `resolution status`.

### Phân loại không được trộn lẫn

- `PlayerListObserved`: DevTools/MAIN-world nhìn thấy list.
- `EntryNormalized`: entry đã có URL + language + format.
- `EntryReplayable`: fetch lại được với auth context của extension.
- `DetectedSubtitleDelivered`: đã qua `handleRequest` và có trong background inventory.

Tính đến audit này, **chưa site nào đạt trạng thái cuối cùng `DetectedSubtitleDelivered` cho toàn bộ
list**, vì generic resolver/bridge chưa được implement. Đây là giới hạn của implementation hiện tại,
không phải bằng chứng rằng player không có subtitle list.

---

## Site 1: shuttletv.su — Root cause (verified)

### Cấu trúc player

1. `shuttletv.su/watch/<tmdbId>` nhúng **iframe cross-origin**:
   `https://cinesrc.st/embed/movie/<tmdbId>?subtitles=auto&subtitlelang=English&color=...`
2. Player `cinesrc.st` = custom **"notflix"** (media-chrome web components: `MEDIA-CONTROLLER`,
   `MEDIA-PLAY-BUTTON`...). `<video>` nằm trong **shadow DOM**, `src` = `blob:https://cinesrc.st/...`
   (MSE/HLS, không phải file mp4 trực tiếp).
3. **Không có `<track>` element**, `video.textTracks.length === 0`. Subtitle KHÔNG dùng native
   HTML track — player render overlay bằng JS riêng.

### Cơ chế subtitle của player (evidence từ network capture)

Player gọi 2 loại request:

1. **Subtitle LISTING API** (JSON array — list tất cả subtitle):
   ```
   GET https://subs.bright67.online/search?id=1275779
   ```
   Response = JSON array, mỗi entry:
   ```json
   {
     "id": "1962484924",
     "url": "https://subs.bright67.online/c/19cf0c5a/id/1962484924?format=srt&encoding=CP1252&m=...",
     "r2Url": "https://subs.bright67.online/r2/get/subtitles/tt15047880/pb/cl82en.srt",
     "format": "srt",
     "encoding": "CP1252",
     "display": "Portuguese (BR)",
     "language": "pb",
     "isHearingImpaired": false,
     "isForced": false,
     "fps": 23.976,
     "uploader": "LosChulosTeam",
     "rating": 10,
     "release": "Disclosure.Day.2026.1080p.WEBRip.x264.AAC5.1-[YTS.GG - YTS.BZ]",
     "source": "opensubtitles",
     ...
   }
   ```
   Player build menu settings từ array này: 36 ngôn ngữ × N variants
   (English=18, Spanish=8, French=7, ...). Số suffix = số variant của ngôn ngữ đó.

2. **Subtitle FILE** (chỉ fetch khi user chọn 1 variant):
   ```
   GET https://nebula.bright67.online/hls/<session-uuid>/subtitles/sub_eng_2.vtt
   ```
   (URL pattern: `/subtitles/sub_<lang>_<index>.vtt`)

### Tại sao extension chỉ thấy 1 subtitle

Detection generic của extension có 2 nguồn (`src/features/detection/logic/subtitleDetector.ts` +
`src/entrypoints/content/pageScanner.ts`):

- **Network-based** (`detectSubtitle(NetworkRequest)` match `SUBTITLE_URL_PATTERNS` trong
  `src/shared/config/urls.ts`):
  - `subs.bright67.online/search?id=` → path `/search` **KHÔNG match** pattern
    `/\/(subtitles|subs|caption|cc)\//i` (pattern match path segment, không match host) →
    **listing API bị bỏ qua hoàn toàn**.
  - `nebula.bright67.online/.../subtitles/sub_eng_2.vtt` → match `/subtitles/` + `\.vtt` →
    **bắt được** → đúng 1 subtitle (cái auto-load qua `subtitles=auto&subtitlelang=English`).
- **DOM `<track>` scan** (`pageScanner.ts`): không có `<track>` → 0 kết quả.

→ Extension chỉ thấy 1 subtitle auto-load. List 36 ngôn ngữ nằm trong response JSON của listing
API mà extension không đọc. **Đúng painpoint.**

### Precedent giải pháp đã có trong codebase (Stremio)

`src/entrypoints/background/networkInterceptor.ts` đã giải quyết **chính xác pattern này** cho
Stremio addon listing:

- `isStremioSubtitleListing(url)` (`subtitleDetector.ts:152`) — nhận diện URL listing
  (`/api/v<N>/<type>/subtitles/`), `detectSubtitle` reject (JSON, không phải file subtitle).
- `networkInterceptor.handleRequest` (dòng 121) — khi thấy listing URL, fire
  `listingListener(url, tabId, initiator)`.
- `resolveStremioSubtitleListing` (`helpers.ts`) — fetch JSON, extract `subtitles[].url`,
  re-inject từng URL thật qua `handleRequest({trustAsSubtitle:true})`.

Cinesrc/shuttletv là **cùng pattern** (listing API trả JSON array subtitle URLs), chỉ khác:

| | Stremio | Cinesrc/shuttletv |
|---|---|---|
| URL shape | `/api/v<N>/<type>/subtitles/<id>` | `subs.<host>/search?id=<id>` (host rotate) |
| Response shape | `{"subtitles":[{url,lang}]}` | `[{url,language,display,format,...}]` (bare array) |
| Entry metadata | `url`, `lang` | giàu hơn: `display`, `language`, `format`, `isHearingImpaired`, `uploader`, `rating` |

### Giải pháp đề xuất (chưa implement)

Clone Stremio pattern thành detector mới cho "cinesrc-style subtitle listing":

1. **`isCinesrcSubtitleListing(url)`** — nhận diện listing API. Host rotate (`bright67.online` có
   thể đổi), nên match bằng **shape**: host bắt đầu `subs.` + path `/search` + query `id=`.
   *Ponytail ceiling: site đổi shape (host không bắt đầu `subs.`, hoặc path khác `/search`) thì
   phải update. Upgrade: nhận diện bằng response content shape (JSON array với entry có
   `url`+`language`+`format`) — nhưng `webRequest.onBeforeRequest` không cho response body, phải
   fetch lại như Stremio (replayable).*
2. **`resolveCinesrcSubtitleListing`** — fetch JSON array, map mỗi entry → `DetectedSubtitle`:
   - `displayName` = `entry.display` (vd "Portuguese (BR)", "English")
   - `language` = `toIso6391(entry.language)` (`pb`→`pt-BR`? cần verify map; `language` ở đây là
     opensubtitles lang code, có thể là 2-letter ISO)
   - `format` = `entry.format` (`srt`)
   - `url` = `entry.url` (hoặc `entry.r2Url` fallback)
   - giữ metadata thêm: `isHearingImpaired`, `uploader` (nếu `DetectedSubtitle` có field)
   - Re-inject qua `handleRequest({trustAsSubtitle:true})` hoặc insert trực tiếp vào
     `networkInterceptor.subtitles`.
3. **Wire vào `networkInterceptor.handleRequest`** — clone block Stremio (dòng 121-123).

#### Lưu ý implement

- **Replayable?** Listing URL `subs.bright67.online/search?id=` có cần header/referer không? Cần
  verify khi implement — fetch từ background có thể bị 403 nếu server check Referer
  (`cinesrc.st`). Nếu bị, cần DNR modify Referer (atom `dnr-forbidden-header-rewrite`).
- **Dedup**: listing API có thể gọi lại trên SPA nav → dedup bằng `(tabId, tmdbId)` hoặc URL.
- **Initiator check**: listing request `initiator = https://cinesrc.st` — có thể dùng để giảm
  false-positive khi match shape yếu.
- **Cross-origin iframe**: listing request phát sinh trong iframe `cinesrc.st`, `tabId` là tab
  chứa iframe (shuttletv.su). Extension content-script chạy trong iframe nếu manifest
  `all_frames:true` — cần verify detection vẫn hoạt động qua iframe (network request thì
  `webRequest` bắt tất cả frame trong tab, OK).

---

## Site 2: onflix.lat — Player-side partial verified (Cloudflare direct limitation)

### Cấu trúc player

1. `onflix.lat/xem-phim/.../vietsub-sn/vietsub/1` nhúng iframe cross-origin:
   `https://playembed.vip/player?m3u8=https%3A%2F%2Fgota.edgecontent.site%2Fm3u8%2F...`.
   Page HTML chứa nhiều embed URL tương ứng nhiều server/episode:
   - `gota.edgecontent.site` (SN)
   - `player.phimapi.com` / `v7.kkphimplayer7.com` (NC/PA/OP?)
   - `vip.opstream10.com` (OP?)
2. Master HLS `gota.edgecontent.site/...m3u8` trả 200 khi request có Referer/token đúng và trỏ tới
   1080p media playlist.
3. **Update audit 2026-08-03 (stealth Chrome)**: master `gota` và 1080p media playlist đều **không** chứa
   `#EXT-X-MEDIA:TYPE=SUBTITLES`. Tương tự `v7.kkphimplayer7.com` master và `3500kb/hls/index.m3u8` cũng không có
   EXT-X-MEDIA. `vip.opstream10.com` chưa fetch được do CORS/referer.
4. Browser network của iframe ghi nhận 2 file subtitle:
   `m-center.onflixcdn.com/content/18072026/<uuid>.vtt`.
   - File 1: nội dung tiếng Việt.
   - File 2: nội dung tiếng Anh.
   - Cả hai fetch trực tiếp đều trả 200 trong audit.

### Giới hạn còn lại

- Direct navigation tới `playembed.vip` có thể gặp Cloudflare, nhưng iframe context vẫn phát sinh VTT.
- Onflix không dùng HLS `EXT-X-MEDIA` cho server SN và v7; subtitle là các VTT file riêng lẻ.
- Chưa audit `vip.opstream10.com` (có thể dùng HLS subtitle) và ba server còn lại (`NC`, `PA`, `OP`).
- Chưa verify extension background replay với token/Referer.

### Solution candidate

- Adapter `onflix` nên kết hợp:
  - Bắt `.vtt` network requests từ `m-center.onflixcdn.com` hoặc các CDN tương tự.
  - Parse HLS master/media playlist nếu server nào có `EXT-X-MEDIA` subtitle entries (dự phòng).
  - Phân giải danh sách VTT từ query/config của `playembed.vip` nếu có thể.
- Giữ `initiator` của iframe làm auth context.
- Không coi số 2 là full-site contract cho tới khi audit các server còn lại.

---

## Site 2: kisskh.co — Root cause (verified)

### Cấu trúc player

1. `kisskh.co/Drama/<title>/Episode-<N>?id=<dramaId>&ep=<epId>` = **Angular SPA** (same-origin,
   không iframe). Player render trực tiếp trong page.
2. `<video>` với `src = blob:https://kisskh.co/...` (MSE/HLS). `readyState = 4` (HAVE_ENOUGH_DATA).
3. **1 `<track kind="subtitles" srclang="en" label="English" src="blob:...">`** — player chỉ
   inject track cho subtitle được chọn (default = English).

### Cơ chế subtitle của player (evidence từ network capture)

Player gọi 2 loại request:

1. **Subtitle LISTING API** (JSON array — list tất cả subtitle cho episode):
   ```
   GET https://kisskh.co/api/Sub/<epId>?kkey=<token>
   ```
   Response = JSON array, mỗi entry:
   ```json
   {
     "src": "https://sub.cdnvideo11.shop/auto-upload/11923/1/<hash>.en.srt?v=<uuid>",
     "label": "English",
     "land": "en",
     "default": true
   }
   ```
   Episode này có **6 subtitle**: English (default), Arabic, Khmer, Indonesia, Malay, Vietnamese.
   `kkey` = token từ `/api/DramaList/Episode/<epId>.png?kkey=...` (anti-hotlink, per-session).

2. **Subtitle FILE** (chỉ fetch cái default):
   ```
   GET https://sub.cdnvideo11.shop/auto-upload/11923/1/<hash>.en.srt?v=<uuid>
   ```
   Player fetch SRT → convert → inject `<track src="blob:...">` vào `<video>`.

### Verify extension behavior (live test với extension loaded)

Extension Subtitle Manager panel (mở qua nút "Open subtitle manager" trong overlay):
- **Target: "1 subtitle"** — chỉ "English #1" (SRT) ← cái auto-load
- **Native: "0 subtitles"** — "No subtitles available."

→ **Extension chỉ thấy 1/6 subtitle.** List 6 subtitle nằm trong response JSON của
`/api/Sub/<epId>` mà extension không đọc. **Đúng painpoint.**

### Tại sao extension chỉ thấy 1

- **Network-based** (`detectSubtitle` match `SUBTITLE_URL_PATTERNS`):
  - `kisskh.co/api/Sub/207851?kkey=...` → path `/api/Sub/` **KHÔNG match** pattern
    `/\/(subtitles|subs|caption|cc)\//i` (pattern match `subs` nhưng `/Sub/` viết hoa + không
    có `s` cuối) → **listing API bị bỏ qua**.
    - *Lưu ý*: pattern `[?&](format|type|subtype)=(vtt|srt|ass)` cũng không match vì URL không
      có query param format.
  - `sub.cdnvideo11.shop/.../<hash>.en.srt?v=...` → match `\.srt` → **bắt được** → đúng 1
    subtitle (English auto-load).
- **DOM `<track>` scan** (`pageScanner.ts`): bắt được 1 `<track src="blob:...">` (English) —
  nhưng `blob:` URL không download được, chỉ dùng cho overlay display.

### Giải pháp đề xuất (cùng pattern Stremio/cinesrc)

Clone listing-API pattern thành detector cho kisskh:

1. **`isKisskhSubtitleListing(url)`** — match `kisskh.co/api/Sub/<id>?kkey=...`.
   *Ponytail ceiling: chỉ match host `kisskh.co` + path `/api/Sub/`. Nếu kisskh đổi domain
   mirror (kisskh.buzz, kisskh.me...) phải update. Upgrade: match bằng response content shape
   (JSON array với entry có `src`+`label`+`land`).*
2. **`resolveKisskhSubtitleListing`** — fetch JSON array, map mỗi entry → `DetectedSubtitle`:
   - `displayName` = `entry.label` (vd "English", "Vietnamese")
   - `language` = `toIso6391(entry.land)` (`en`, `ar`, `km`, `id`, `ms`, `vi` — đều ISO 639-1)
   - `format` = detect từ `entry.src` (`.srt` → `'srt'`)
   - `url` = `entry.src` (URL thật, download được — không phải blob)
   - Re-inject qua `handleRequest({trustAsSubtitle:true})` hoặc insert trực tiếp.
3. **Wire vào `networkInterceptor.handleRequest`** — clone block Stremio (dòng 121-123).

#### Lưu ý implement (kisskh-specific)

- **`kkey` token**: listing URL cần `kkey` param. Token lấy từ
  `/api/DramaList/Episode/<epId>.png?kkey=<token>`. Extension chỉ re-fetch listing URL đã capture
  (có sẵn kkey trong URL) → không cần tự generate token. Nhưng nếu listing URL expire (token
  per-session) thì re-fetch có thể fail → cần fallback: dùng URL đã capture làm source-of-truth
  (không re-fetch, parse response body lúc capture — nhưng `webRequest.onBeforeRequest` không
  cho body, phải fetch lại).
- **Dedup**: listing API gọi lại trên SPA episode switch → dedup bằng `(tabId, epId)` hoặc URL.
- **Same-origin**: listing request `initiator = https://kisskh.co` (không có iframe cross-origin
  như shuttletv) → đơn giản hơn.

---

## Site 3: myasiantv.es — Player-side verified; extension replay pending

### Cấu trúc player

1. `ww19.myasiantv.es/ep/<slug>` = WordPress + dooplayer. Iframe `kisscloud.online/video/<hash>`
   được lazy-loaded từ server selection.
2. `kisscloud.online/video/<hash>` là player cross-origin và yêu cầu Referer từ MyAsianTV khi
   mở trực tiếp. Không có Referer → 404; có Referer → HTML player trả 200.
3. Với episode test, HTML player chứa:

```js
var playerjsSubtitle = "[English]https://...,[Thai 1]https://...,[Thai 2]https://...,[Thai 3]https://...";
```

### Cơ chế subtitle đã verify

- `playerjsSubtitle` có **4 direct URL**: English, Thai 1, Thai 2, Thai 3.
- Cả 4 URL trả HTTP 200 và nội dung bắt đầu bằng `WEBVTT` khi request có Referer
  `https://kisscloud.online/video/<hash>`.
- Player dùng JWPlayer/custom subtitle manager; URL không nằm trong JSON listing API.
- Direct navigation không có Referer bị 404; đây là auth context bắt buộc.

### Extension gap

- Current code chưa parse biến JavaScript `playerjsSubtitle` từ HTML.
- `offscreenFetch` có thể lấy HTML nếu DNR đặt đúng Referer, nhưng chưa có resolver HTML/JS-variable
  và chưa verify DNR + `xmlhttprequest` cho flow này.
- Các server khác trên trang chưa được audit; 4 entry chỉ là server/player test hiện tại.

### Solution candidate

1. Capture/replay `kisscloud.online/video/<hash>` với initiator/referrer của parent.
2. Parse đúng một biến được allow-list: `playerjsSubtitle` → tách `[label]url`.
3. Resolve URL + format WebVTT + language từ label; giữ `initiator=https://kisscloud.online/`.
4. Re-inject từng entry qua unified subtitle listing resolver; không coi HTML player là subtitle file.

---

---

## Site 4: moviepire.ru — Root cause (verified)

### Cấu trúc player

1. `moviepire.ru/watch/<tmdbId>?s=<season>&e=<episode>` = SPA (Vite). Nhúng **iframe
   cross-origin**: `https://player.videasy.to/tv/<tmdbId>/<season>/<episode>?...`
   (redirect qua `player.videasy.net/movie/<tmdbId>` → `player.videasy.to/tv/...`).
2. Player `videasy.to` = **Next.js** SPA. `<video src="blob:...">` (MSE/HLS), readyState=4.
3. **0 `<track>` element**, textTracks=0 — player **không dùng HTML track**, render subtitle
   bằng custom JS overlay (parse VTT client-side).

### Cơ chế subtitle của player (evidence từ network capture + click test)

Player gọi 3 loại request:

1. **TMDB metadata** (qua proxy `db.speedracelight.com`):
   ```
   GET https://db.speedracelight.com/3/tv/125988/season/1/episode/1?append_to_response=external_ids&language=en
   ```
   → lấy title, year, imdbId, tmdbId cho query API sources.

2. **Sources API** (encrypted response — **KHÔNG phải JSON**):
   ```
   GET https://api.speedracelight.com/cdn/sources-with-title?title=Silo&mediaType=tv&year=2023
       &episodeId=1&seasonId=1&tmdbId=125988&imdbId=tt14688458&enc=2&seed=<token>
   ```
   Response = **encrypted binary string** (base64url-like, khoảng 20–25KB). Player decode client-side
   bằng custom XOR/PRNG JS trong chunk `8351-*.js` (không phải AES). Re-audit đã reproduce được
   decrypt và parse JSON chứa video sources + **85 direct subtitle VTT URLs**.
   - Decrypt algorithm đã được reverse-engineer ở mức player-side, nhưng **chưa implement trong
     extension** và chưa có key/seed replay contract trong background.

3. **Subtitle FILE** (mỗi language = 1 file `.vtt` riêng, tên obfuscated):
   ```
   https://moon.ironwallnet.net/r2/cdn2/<encoded-path>/<xx>.vtt
   ```
   - `<encoded-path>` = base64-like string (mã hóa, chứa auth token).
   - `<xx>` = tên file 1-2 ký tự, **không theo pattern language** (obfuscated).

### Provider → endpoint mapping (cell-profile click audit)

Click từng server trong UI `aria-label="Select video source"` trên `player.videasy.to/tv/125988/1/2`:

| Server group (UI) | Provider path `/<provider>/sources-with-title` | Audio | Subtitles (S1E2) | Notes |
|---|---|---|---|---|
| Yoru | `cdn` | Original | **67 VTT** | Default; 4 sources |
| Cypher | `downloader2` | Original | 2 SRT/VTT | 2 sources |
| Breach | `m4uhd` | Original | 1 SRT | 2 sources |
| Neon | `vsrc` | Original | 0 | HTTP 500 `master_urls not found` |
| Vyse | `hdmovie` | Original | 0 | HTTP 500 proxy 404 |
| Killjoy | `meine` | German | 0 | 1 source; query thêm `language=german` |
| Fade | `hdmovie` | Hindi | 0 | HTTP 500 proxy 404 |
| Omen | `hdmovie` → fallback `lamovie` | Spanish | 0 | `hdmovie` 500, `lamovie` 200 nhưng 0 subtitle |
| Raze | `superflix` | Portuguese | 0 | HTTP 500 `Failed to load sources` |

→ Player dùng **9 server group** làm facade; mỗi group gọi 1 provider `api.speedracelight.com/<provider>`. Tất cả đều dùng chung thuật toán XOR/PRNG `enc=2`. Adapter `encrypted.ts` extract provider từ path URL, không cần hardcode mapping.

### Evidence: click test 5 language → 5 file VTT khác nhau

| Language click | File fetch | Tên file |
|---|---|---|
| English (auto-load) | `.../a.vtt` | `a` |
| Spanish | `.../i.vtt` | `i` |
| French | `.../l.vtt` | `l` |
| Japanese | `.../p.vtt` | `p` |
| Korean | `.../q.vtt` | `q` |
| Vietnamese (test trước) | `.../ag.vtt` | `ag` |

→ **85 subtitle entries hiện tại** (nhiều language/variant, mỗi entry là một VTT URL; tên file
obfuscated như `a.vtt`, `b.vtt`, `ag.vtt`). Player còn có luồng Search OpenSubtitles riêng.
Con số 15 trong snapshot cũ đã lỗi thời; không dùng làm contract.

### Verify extension behavior (live test)

Extension Subtitle Manager panel:
- **Target: "1 subtitle"** — chỉ "English #1" (VTT) ← cái auto-load (`a.vtt`)
- **Native: "0 subtitles"** — "No subtitles available."

→ **Extension chỉ thấy 1/85 subtitle trong lần test hiện tại.** List 85 subtitle nằm trong encrypted API
response mà extension chưa decode/re-inject trong background. **Đúng painpoint.**

### Tại sao extension chỉ thấy 1

- **Network-based** (`detectSubtitle` match `SUBTITLE_URL_PATTERNS`):
  - `a.vtt` (English auto-load) → match `\.vtt` → **bắt được** → đúng 1 subtitle.
  - Các file khác (`i.vtt`, `l.vtt`, `p.vtt`...) chỉ fetch khi user click → extension không
    biết trước.
  - API `sources-with-title` → response encrypted, **không phải JSON** → current extension chưa parse được
    listing. Player-side decrypt đã reproduce được, nhưng chưa có implementation/replay contract trong
    background.
- **DOM `<track>` scan**: 0 `<track>` (player dùng custom JS overlay) → không catch được gì.
- **HLS m3u8**: m3u8 là VOD playlist với segments disguised (.jpg/.css/.txt), **không có
  `#EXT-X-MEDIA:TYPE=SUBTITLES`** → subtitle không nằm trong HLS.

### Giải pháp đề xuất (pattern mới — harder hơn cinesrc/kisskh)

Khác cinesrc/kisskh (API trả JSON array rõ ràng), videasy **encrypt API response** → không
thể clone listing-API pattern trực tiếp. 2 approach:

#### Approach A: Reverse-engineer decode function (khó, fragile)

1. Tìm decode function trong player JS chunk (`_next/static/chunks/9230.*.js`).
2. Replicate decode trong extension → parse list subtitle URLs.
3. **Ponytail ceiling**: player update JS → decode function đổi → break. Không bền.

#### Approach B: Intercept VTT requests + accumulate (đơn giản, bền)

1. Extension đã catch `\.vtt` match → mỗi lần user click language mới, extension catch file
   mới → **accumulate vào subtitle list** (không overwrite).
2. **Problem**: user phải click từng language để extension thấy — **vẫn painpoint**.
3. **Mitigation**: extension có thể **auto-fetch tất cả file `.vtt`** trong cùng thư mục
   nếu biết pattern tên file — nhưng tên obfuscated (a, i, l, p, q, ag...) → không có pattern
   → phải brute-force (không khả thi).

#### Approach C: Hook player JS state (MAIN-world bridge)

1. Inject MAIN-world script vào `player.videasy.to` → hook vào player React state / global
   var chứa list subtitle (sau khi player decode API).
2. Clone pattern `*-main-world.iife.ts` (như YouTube/iQIYI/Netflix).
3. **Ponytail ceiling**: cần biết player store list ở đâu (React state, Redux store, global
   var). Phần điều tra tiếp: inspect `window` + React fiber trên videasy.to.

### Lưu ý implement (videasy-specific)

- **Cross-origin iframe**: player trong `player.videasy.to`, parent `moviepire.ru`. Extension
  content-script inject vào iframe (all_frames:true) → MAIN-world bridge chạy trong iframe
  context. Nhưng extension overlay panel mount ở parent → cần bridge qua `postMessage`.
- **OpenSubtitles integration**: player có "Search OpenSubtitles" → có thể có API endpoint
  OpenSubtitles riêng (cần điều tra thêm nếu approach C).
- **Anti-hotlink**: file `.vtt` trên `moon.ironwallnet.net` cần auth token trong path
  (encoded) → re-fetch từ extension có thể fail nếu token expire.

---

## Site 5: lookmovie2.to — Root cause (verified)

### Cấu trúc player

1. `lookmovie2.to/shows/play/<id>-<slug>#S<season>-E<episode>-<id>` = server-rendered page
   (Laravel). Player **same-origin** (không iframe).
2. Player = **video.js v7** + **plyr skin** (`vjs-lookmovie` class). `<video src="blob:...">`
   (MSE/HLS), readyState=4.
3. **0 `<track>` element trong DOM** — video.js dùng `remoteTextTracks()` API (JS-managed,
   không inject DOM `<track>`).
4. Extension `#cell-subtitle-root` **không mount** trên trang này (extension content-script
   không detect video.js player — có thể vì video element render sau delay hoặc extension
   không match `lookmovie2.to` host).

### Cơ chế subtitle của player (evidence từ network capture + video.js API inspect)

Player gọi 2 API quan trọng:

1. **Episode access API** (JSON response — **DECODED rõ ràng**, không encrypt):
   ```
   GET https://www.lookmovie2.to/api/v1/security/episode-access?id_episode=224948
       &hash=w_G3vml6j0N4dCL-AaBtdw&expires=1785711345
   ```
   Response JSON:
   ```json
   {
     "success": true,
     "id_episode": 224948,
     "subtitles": [
       {"language": "English", "file": "/storage3/shows/14688458-silo-2023/14688458-s1-e1-1764454507/subtitles/en.vtt"},
       {"language": "Arabic", "file": "/storage3/shows/14688458-silo-2023/14688458-s1-e1-1764454507/subtitles/ar.vtt"},
       {"language": "Vietnamese", "file": "/storage3/shows/14688458-silo-2023/14688458-s1-e1-1764454507/subtitles/vi.vtt"},
       ... (111 entries)
     ]
   }
   ```
   - **111 subtitle** (nhiều bản cho cùng language — từ nhiều nguồn OpenSubtitles).
   - `file` = path tương đối, pattern: `/storage3/shows/<imdbId>-<slug>/<imdbId>-s<season>-e<episode>-<ts>/subtitles/<lang>.vtt`
   - `language` = tên language (English, Arabic, Vietnamese, "Protuguese (BR)" [sic], zh-cn, zh-tw, ea, ze...)
   - **Lang code ISO 639-1** trong tên file (`en.vtt`, `ar.vtt`, `zh.vtt`...) — pattern đẹp nhất.

2. **Download manifest API** (JSON response):
   ```
   GET https://www.lookmovie2.to/api/v2/download/episode/manifest?id=447385
   ```
   → list download URLs (có thể chứa subtitle download links).

3. **Subtitle FILE** (mỗi language = 1 file `.vtt`):
   ```
   https://www.lookmovie2.to/storage3/shows/<imdbId>-<slug>/<imdbId>-s<season>-e<episode>-<ts>/subtitles/<lang>.vtt
   ```
   - Player **chỉ auto-fetch `en.vtt`** (English, mode="showing"). Các file khác fetch
     on-demand khi user click language trong subtitle menu.

### Evidence: video.js remoteTextTracks() API

Player inject 112 textTracks qua `video.js remoteTextTracks()` API (KHÔNG phải DOM `<track>`):

```js
vjsPlayer.textTracks() → TextTrackList {
  length: 112,
  [0]: {kind: "subtitles", label: "English", language: "", mode: "showing"},
  [1]: {kind: "subtitles", label: "Arabic", language: "", mode: "disabled"},
  [2]: {kind: "subtitles", label: "Bulgarian", language: "", mode: "disabled"},
  ...
  [111]: {kind: "subtitles", label: "zh-tw", language: "", mode: "disabled"}
}
```

- **Tất cả `language: ""`** (empty) — player không set `srclang`, chỉ set `label`.
- **0 `<track>` trong DOM** — `pageScanner.ts` scan `<track>` → không thấy gì.
- English `mode: "showing"` (active), còn lại `mode: "disabled"`.

### Verify extension behavior (live test)

- **`#cell-subtitle-root` KHÔNG mount** — extension subtitle overlay không xuất hiện trên
  trang này. `#cell-universal-panel-host` có (extension content-script chạy), nhưng subtitle
  root không init.
- → **Extension thấy 0/111 subtitle.** Đúng painpoint, thậm chí tệ hơn các site khác.

### Tại sao extension không thấy subtitle

- **DOM `<track>` scan** (`pageScanner.ts`): 0 `<track>` → không catch.
- **Network URL match** (`detectSubtitle` + `SUBTITLE_URL_PATTERNS`): chỉ `en.vtt` auto-fetch
  → match `\.vtt` → bắt được 1. Nhưng extension subtitle root không mount → không hiển thị.
- **video.js `remoteTextTracks()` API**: extension không đọc API này → không thấy 112 tracks.
- **Episode-access API**: response JSON rõ ràng với `subtitles` array → extension không
  intercept API này → không biết list 111 subtitle.

### Giải pháp đề xuất (pattern đẹp nhất — dễ implement nhất)

#### Approach A: Intercept episode-access API (clone cinesrc/kisskh pattern)

1. Extension intercept `lookmovie2.to/api/v1/security/episode-access?*` response.
2. Parse JSON `subtitles` array → list `{language, file}`.
3. Re-inject tất cả 111 subtitle URL vào subtitle manager (clone Stremio listing pattern).
4. **Dễ nhất** — JSON rõ ràng, không encrypt, không obfuscate, lang code ISO 639-1.

#### Approach B: Read video.js remoteTextTracks() (MAIN-world bridge)

1. Inject MAIN-world script → hook `video.js` player object.
2. Read `vjsPlayer.textTracks()` → 112 tracks với label.
3. Bridge qua `postMessage` → extension subtitle manager.
4. **Bonus**: catch subtitle URL từ track `src` (nếu video.js store src).

#### Approach C: Fix extension subtitle root mount (prerequisite)

- Extension `#cell-subtitle-root` không mount trên `lookmovie2.to` → cần debug content-script
  host matching hoặc video detection logic.
- Có thể extension không match `lookmovie2.to` host, hoặc video.js player init sau delay
  khiến extension miss video element.

### Lưu ý implement (lookmovie2-specific)

- **Same-origin** (không iframe) → đơn giản hơn cinesrc/kisskh/videasy (không cần cross-origin
  bridge).
- **111 subtitle** = số lượng lớn → UI subtitle manager cần scroll/virtualize list.
- **Duplicate language** (nhiều "English", "Spanish"...) → cần dedup hoặc hiển thị source
  info (subtitle #1, #2...).
- **Lang code không chuẩn** ("ea", "ze", "Protuguese (BR)", "zh-cn", "zh-tw") → cần normalize
  hoặc hiển thị raw label.
- **Hash + expires token** trong API URL → token expire sau thời gian → re-fetch cần token
  mới (parse từ page HTML hoặc re-call API).

---

## Site 6: lunastream.com.cv — Root cause (verified)

### Cấu trúc player (3 tầng iframe)

1. `lunastream.com.cv/play/tv/<tmdbId>` = SPA (Vite + Tailwind). Gọi API
   `lunastream.com.cv/api/tmdb/tv/<tmdbId>?language=en-US&append_to_response=external_ids`
   → lấy metadata + embed URL.
2. Nhúng **iframe cross-origin**: `moviesapi.to/tv/<tmdbId>-<season>-<episode>`
   (redirect → `ww2.moviesapi.to/tv/<tmdbId>/<season>/<episode>`).
3. `ww2.moviesapi.to` = SPA (Vite). Gọi API `ww2.moviesapi.to/api/tv/<tmdbId>/<season>/<episode>`
   → trả stream info + **subs list** (JSON).
4. `ww2.moviesapi.to` nhúng **iframe cross-origin**: `flixcdn.cyou/#<id>&poster=...&subs=[JSON]&api=all`
   → player JWPlayer 8.

### Cơ chế subtitle (evidence từ iframe URL hash + JWPlayer API)

**Pattern độc đáo nhất**: subs list truyền qua **iframe URL hash** (URL-encoded JSON):

```
https://flixcdn.cyou/#afkh36
  &poster=https://image.tmdb.org/t/p/w1280/...
  &subs=[
    {"language":"unknown","label":"English","url":"https://dl.opensubtitles.org/.../file/1958216511","default":true},
    {"language":"unknown","label":"Vietnamese","url":"https://dl.opensubtitles.org/.../file/1959237781","default":false},
    {"language":"unknown","label":"English Hi","url":"https://cache.vdrk.site/v1/vtt/tv/113962/1/1/English Hi.vtt","default":false},
    ... (33 entries)
  ]
  &api=all
```

**33 subtitle** với 2 loại URL:
- **31 subtitle từ OpenSubtitles**: `dl.opensubtitles.org/en/download/subencoding-utf8/src-api/vrf-<token>/file/<id>`
  (URL download trực tiếp, không cần API key — token `vrf` đã embed).
- **2 subtitle (Hi) từ cache.vdrk.site**: `cache.vdrk.site/v1/vtt/tv/<tmdbId>/<season>/<episode>/<lang>.vtt`
  (VTT file trực tiếp, pattern đẹp: `/v1/vtt/tv/<tmdbId>/<s>/<e>/<label>.vtt`).

Mỗi entry: `{language: "unknown", label: "<lang>", url: "<URL>", default: true/false}`.
- `language` luôn `"unknown"` (không có ISO 639-1 code).
- `label` = tên language (English, Vietnamese, "Portuguese (BR)", "Chinese (simplified)", "English Hi"...).
- `default: true` cho English (auto-load).

### JWPlayer 8 behavior (sau khi play)

JWPlayer `getPlaylist()` chỉ load **2 tracks** (không phải 33):
```js
[
  {kind: "captions", label: "English", file: "https://dl.opensubtitles.org/.../file/1958216511"},
  {kind: "captions", label: "en", file: "/ADtVSJJ8bhec8Omws0QeKg/9a/twzg53xl/t9qu9/en.vtt#en"}
]
```
- Track 1: English (OpenSubtitles) — default, auto-load.
- Track 2: "en" (internal VTT, path obfuscated) — player fetch `flixcdn.cyou/.../en.vtt`.

→ **Player chỉ load 2/33 subtitle.** 31 subtitle còn lại nằm trong iframe URL hash nhưng
JWPlayer không inject vào playlist — user phải chọn qua UI player (nếu có).

### Network subtitle requests (verified)

- `dl.opensubtitles.org/.../file/1958216511` — English OpenSubtitles (auto-load).
- `flixcdn.cyou/ADtVSJJ8bhec8Omws0QeKg/9a/twzg53xl/t9qu9/en.vtt` — English internal VTT.
- HLS: `flixcdn.cyou/hlsmod/.../master.m3u8` + `index-f1-v1-a1.m3u8` (video, không subtitle trong m3u8).

### Verify extension behavior (live test)

- `#cell-subtitle-root` **không mount** trên `flixcdn.cyou` (extension content-script chạy,
  `#cell-universal-panel-host` có, nhưng subtitle root không init).
- → **Extension thấy 0/33 subtitle.** Đúng painpoint.

### Tại sao extension không thấy subtitle

- **DOM `<track>` scan**: 0 `<track>` (JWPlayer dùng JS API) → không catch.
- **Network URL match**:
  - `dl.opensubtitles.org/.../file/...` → không match `SUBTITLE_URL_PATTERNS` (URL không có
    `.vtt`/`.srt` extension — chỉ có `/file/<id>`).
  - `flixcdn.cyou/.../en.vtt` → match `\.vtt` → bắt được 1, nhưng subtitle root không mount.
- **Iframe URL hash**: extension không parse `subs=[JSON]` trong iframe src → không biết list 33.
- **JWPlayer API**: extension không đọc `jwplayer().getPlaylist()` → không thấy 2 tracks.
- **Cross-origin 3 tầng**: `lunastream.com.cv` → `moviesapi.to` → `ww2.moviesapi.to` →
  `flixcdn.cyou` → extension content-script inject vào mỗi iframe (all_frames:true), nhưng
  subtitle root chỉ mount ở top frame hoặc frame có video detect.

### Giải pháp đề xuất (pattern độc đáo — dễ nhất nếu parse iframe src)

#### Approach A: Parse iframe src `subs=[JSON]` (dễ nhất — không cần API intercept)

1. Extension content-script (all_frames:true) scan `iframe.vidframe[src*="subs="]` trong
   `ww2.moviesapi.to` frame.
2. Extract `subs` param từ URL hash → URL-decode → JSON.parse → 33 entries `{label, url}`.
3. Re-inject tất cả 33 subtitle URL vào subtitle manager.
4. **Dễ nhất** — data đã có sẵn trong DOM (iframe src), không cần API intercept, không cần
   decode encrypted response.

#### Approach B: Intercept `ww2.moviesapi.to/api/tv/<id>/<s>/<e>` response

1. Extension intercept API response (JSON) → parse subs list.
2. **Problem**: API trả JSON nhưng em không fetch được từ `flixcdn.cyou` context (CORS) →
   cần intercept từ `ww2.moviesapi.to` frame context.

#### Approach C: Hook JWPlayer API (MAIN-world bridge)

1. Inject MAIN-world script vào `flixcdn.cyou` → hook `jwplayer().getPlaylist()`.
2. Read 2 tracks từ playlist → bridge qua `postMessage`.
3. **Limitation**: chỉ thấy 2/33 tracks (JWPlayer không load hết).

### Lưu ý implement (lunastream/moviesapi/flixcdn-specific)

- **3 tầng iframe cross-origin**: cần extension content-script inject vào đúng frame
  (`ww2.moviesapi.to` cho iframe src parse, `flixcdn.cyou` cho JWPlayer API).
- **OpenSubtitles URL**: `dl.opensubtitles.org/.../file/<id>` không có extension → cần thêm
  pattern match `/opensubtitles\.org.*\/file\/\d+/` vào `SUBTITLE_URL_PATTERNS`.
- **OpenSubtitles download**: URL trả file SRT/ASS (không phải VTT) → extension cần convert
  hoặc handle SRT format.
- **cache.vdrk.site VTT**: URL pattern đẹp `/v1/vtt/tv/<tmdbId>/<s>/<e>/<label>.vtt` → match
  `\.vtt` dễ.
- **Token `vrf`** trong OpenSubtitles URL → token expire → re-fetch cần parse lại iframe src.
- **`language: "unknown"`** cho tất cả → extension cần dùng `label` làm language name.

---

## Site 7: broodingmovies.com — Root cause (verified)

### Cấu trúc player (2 tầng iframe)

1. `broodingmovies.com/tv/<slug>/season/<s>/episode/<e>` = parent page (PHP + Bootstrap 5).
   Click nút `#novaPosterPlayBtn` → set iframe `#novaEpisodePlayer` src =
   `broodingmovies.com/embed/tv/<tmdbId>/<s>/<e>` (same-origin embed).
2. Embed page `broodingmovies.com/embed/tv/<tmdbId>/<s>/<e>` chứa:
   - Script postMessage handler (localStorage bridge cho iframe player).
   - Iframe cross-origin `nextgencloudfabric.com/embed/tv/<tmdbId>/<s>/<e>` (id=`pf`).
3. Player `nextgencloudfabric.com` = custom player (HLS.js 1.5.17 + jQuery 3.7.1 + pako + Chromecast).
   - Player JS: `nextgencloudfabric.com/embed/assets/js/player.min.js`
   - Theme: `nextgencloudfabric.com/embed/assets/css/themes/netflix.min.css` (Netflix-style UI)
   - Anti-devtool: `disable-devtool@latest`

### Cơ chế subtitle (evidence từ network + localStorage + postMessage)

**API subtitle riêng** (pattern mới — không phải listing API JSON trực tiếp):

```
GET https://streamdata.vaplayer.ru/api.php?tmdb=<tmdbId>&type=tv&season=<s>&episode=<e>
```

- API cross-origin (CORS block từ parent context — `get_response_content` trả empty).
- Response body không lấy được từ MCP (live-refetch bị CORS block).
- Player fetch API này khi load → trả subtitle list (giả định JSON, cần verify từ DevTools
  thật trong iframe context).

**Player UI subtitle** (Anh yêu confirm):
- Nút **Captions (CC)** trong player → mở panel có 2 tab:
  - Tab **Default**: list subtitle có sẵn (từ vaplayer.ru API).
  - Tab **Search**: search OpenSubtitles (player tích hợp OpenSubtitles search).
- Player lưu subtitle preference trong localStorage:
  - `subtitleLang: "eng"` (ISO 639-3 code)
  - `lastSubLang: "en"` (ISO 639-1 code)

**HLS stream** (video, không subtitle trong m3u8):

```
GET https://contentmonetizationlab.site/<gzip-compressed-path>/master.m3u8
GET https://nextgencloudfabric.com/embed/segments.php?tmdb=<tmdbId>&season=<s>&episode=<e>
```

- HLS m3u8 từ `contentmonetizationlab.site` (path gzip-compressed, obfuscated).
- Segments từ `nextgencloudfabric.com/embed/segments.php`.
- Không thấy `.vtt`/`.srt` request trong network log (player có thể fetch subtitle qua blob URL,
  hoặc MCP không capture cross-origin iframe requests đầy đủ).

### postMessage bridge (parent ↔ iframe player)

Embed page `broodingmovies.com/embed` có script bridge localStorage:

```js
var pfx=['va_','player','subtitleLang','last_ep_','watch_'];
window.addEventListener('message', function(e) {
  if (e.source !== f.contentWindow) return;
  if (d.type === 'STORAGE_GET_ALL') { /* parent trả localStorage data */ }
  if (d.type === 'STORAGE_SET' && d.key) { localStorage.setItem(d.key, d.value); }
  if (d.type === 'PLAYER_TITLE' && d.title) { document.title = d.title; }
  if (d.type === 'PLAYER_EVENT') { /* player status, progress, quality */ }
  if (d.type === 'CURSOR_HIDE' / 'CURSOR_SHOW') { /* hide/show cursor */ }
  if (window.parent !== window) { window.parent.postMessage(d, '*'); }
});
```

**PLAYER_EVENT** message (verified):
```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "player_info": {"imdb": null, "tmdb": "278624", "mediaType": "tv", "season": 1, "episode": 1},
    "player_status": "playing",
    "player_progress": 346.5,
    "player_duration": 2850.139,
    "percent": 12,
    "quality": {"label": "720p", "width": 1280, "height": 536}
  }
}
```

→ **Không có subtitle info trong PLAYER_EVENT.** Player không gửi subtitle list qua postMessage.

### Verify extension behavior (live test)

- `#cell-universal-panel-host` **có** (extension content-script chạy ở parent).
- `#cell-subtitle-root` **không mount** (extension không detect subtitle ở parent).
- → **Extension thấy 0 subtitle** (đúng painpoint).

### Tại sao extension không thấy subtitle

- **DOM `<track>` scan**: 0 `<track>` ở parent + embed page (player dùng HLS.js JS API) → không catch.
- **Network URL match**:
  - `streamdata.vaplayer.ru/api.php?...` → không match `SUBTITLE_URL_PATTERNS` (URL không có
    `.vtt`/`.srt` extension — chỉ có `api.php`).
  - `contentmonetizationlab.site/.../master.m3u8` → match HLS pattern nhưng subtitle không trong m3u8.
  - Không thấy `.vtt`/`.srt` request nào trong network log.
- **Cross-origin iframe**: `nextgencloudfabric.com` — extension content-script inject vào iframe
  (all_frames:true) nhưng `#cell-subtitle-root` không mount ở iframe context.
- **vaplayer.ru API**: extension không intercept `streamdata.vaplayer.ru/api.php` response.
- **postMessage**: extension không listen `PLAYER_EVENT` message từ iframe player.

### Giải pháp đề xuất

#### Approach A: Intercept `streamdata.vaplayer.ru/api.php` response (dễ nhất — same pattern cinesrc/kisskh)

1. Extension intercept `streamdata.vaplayer.ru/api.php?tmdb=<id>&type=tv&season=<s>&episode=<e>`
   response (JSON subtitle list).
2. Parse JSON → re-inject subtitle URLs vào subtitle manager.
3. **Cùng pattern** như cinesrc/kisskh/lookmovie (listing API JSON) — clone Stremio listing logic.
4. **Problem**: API cross-origin, response body cần intercept từ network (chrome.webRequest
   onCompleted + get response body, hoặc inject script vào iframe context).

#### Approach B: Hook player API (MAIN-world bridge vào nextgencloudfabric iframe)

1. Inject MAIN-world script vào `nextgencloudfabric.com` iframe → hook player subtitle API.
2. Read subtitle list từ player state → bridge qua `postMessage`.
3. **Problem**: player.min.js minified, cần reverse-engineer player API.

#### Approach C: Listen postMessage + parse PLAYER_EVENT

1. Extension content-script listen `window.message` event → bắt `PLAYER_EVENT` từ iframe.
2. **Problem**: PLAYER_EVENT không chứa subtitle info → không đủ data.

### Lưu ý implement (broodingmovies/nextgencloudfabric-specific)

- **2 tầng iframe**: parent `broodingmovies.com` → embed `broodingmovies.com/embed` (same-origin)
  → player `nextgencloudfabric.com` (cross-origin). Extension content-script inject vào mỗi frame.
- **vaplayer.ru API**: domain riêng `streamdata.vaplayer.ru` (không cùng domain player) → cần
  thêm pattern match `vaplayer\.ru/api\.php` vào subtitle listing API patterns.
- **tmdbId**: API dùng `tmdb` param (TMDB ID), không phải IMDb ID. Parent page lấy tmdbId từ
  `data-src="/embed/tv/<tmdbId>/<s>/<e>"` của iframe.
- **subtitleLang localStorage**: player lưu `subtitleLang: "eng"` (ISO 639-3) + `lastSubLang: "en"`
  (ISO 639-1) → 2 format khác nhau, cần handle cả 2.
- **OpenSubtitles search**: player có tab Search tích hợp OpenSubtitles → extension có thể leverage
  OpenSubtitles API trực tiếp (nếu player dùng public API).
- **Anti-devtool**: player dùng `disable-devtool@latest` → có thể block DevTools trong production.

---

## Site 8: noxx.to — Player-side verified; deep-frame bridge pending

### Cấu trúc player

1. `noxx.to/tv/silo/3/5` → `#mainiframe` → `player.unlimitedfiles.xyz/embed/tv?tmdb=125988&season=3&episode=5`.
2. Wrapper `player.unlimitedfiles.xyz` tạo `cloudorchestranova.com/rcp/<token>`; outer `/rcp`
   tiếp tục tạo deep `/prorcp/<token>` player. Token thay đổi theo lần load và direct navigation
   không có đúng referrer/token có thể 404.
3. Deep `/prorcp` player có `<video src="blob:...">`, không có native `<track>`/`textTracks`;
   scripts gồm `subtitles_pjs_24.04.js` và `srt2vtt.js`.

### Cơ chế subtitle đã verify

- Deep player expose `window.the_subtitles` gồm **43 string** dạng:
  `[English - SDH]/subs/<hash>/SDH.eng.vtt`.
- Parse được 43/43 entry; resolve relative path thành `https://cloudorchestranova.com/subs/...`.
- HEAD 43/43 trả 200, content type `text/vtt`.
- DOM có hidden `.subtitles_window` với danh sách ngôn ngữ; player auto-load một track nhưng
  quản lý bằng custom JS/blob, không phải native TextTrack.

### Extension gap và solution candidate

- Parent/wrapper content-script không tự đọc được player state ở deep cross-origin frame bằng isolated
  DOM access; current code cũng chưa có MAIN-world bridge cho `window.the_subtitles`.
- Cần inject MAIN-world adapter trong frame có origin `cloudorchestranova.com`, đọc **chỉ**
  `window.the_subtitles`, gửi `{label,path,frameOrigin}` qua `postMessage`/content-script relay.
- Resolve path bằng `new URL(path, frameOrigin)`, format từ `.vtt`, language từ label, giữ initiator
  `https://cloudorchestranova.com/` để fetch/download.
- Không cần brute-force hay reverse-engineer token nếu adapter chạy trong frame đã được site tạo ra;
  token và relative path đã có trong live DOM/state. Vẫn phải test frame injection trên production.

### Lưu ý

- Cloudflare verify của `noxx.to` và anti-devtool của wrapper có thể làm frame injection không ổn định.
- Các server Cloud 2/Cloud/Doodstream/SeekStreaming chưa được audit thành các contract riêng; 43 entry
  là kết quả của Cloud 3/player test hiện tại.

---

## Tổng quan pattern subtitle-listing gặp tới nay

| Pattern | Ví dụ | Extension hỗ trợ? |
|---|---|---|
| Native `<track>` DOM | anikage.cc | ✅ `pageScanner.ts` (trustAsSubtitle) |
| Network URL match file subtitle | đa số site generic | ✅ `detectSubtitle` + `SUBTITLE_URL_PATTERNS` |
| Site-specific MAIN-world bridge | YouTube, iQIYI, Netflix | ✅ `*-main-world.iife.ts` |
| Listing API JSON → re-inject URLs | Stremio addon | ✅ `isStremioSubtitleListing` |
| Listing API JSON array (cinesrc) | shuttletv.su/cinesrc.st | ❌ **player-side verified (100 direct entries)** — chưa có resolver/response-body capture |
| Listing API JSON array (kisskh) | kisskh.co `/api/Sub/<epId>` | ❌ **player-side verified (6 direct SRT)** — chưa có resolver/token replay |
| Listing API JSON array (lookmovie) | lookmovie2.to `/api/v1/security/episode-access` | ❌ **player-side verified (111; 87 direct + 24 metadata)** — cần split resolver |
| Iframe URL hash `subs=[JSON]` (lunastream) | lunastream.com.cv → flixcdn.cyou | ❌ **player-side verified (33 direct URLs)** — cần parse iframe `src` + re-inject |
| vaplayer.ru API + Captions tab (broodingmovies) | broodingmovies.com → nextgencloudfabric.com | ❌ **player-side verified (42 direct URLs)** — cần response/body + header replay |
| Deep player state + blob URL (noxx.to) | noxx.to → player.unlimitedfiles.xyz → cloudorchestranova.com/prorcp | ❌ **player-side verified (43 direct VTT)** — cần MAIN-world bridge |
| Encrypted API + obfuscated VTT (videasy) | moviepire.ru/player.videasy.to | ✅ **player-side verified (e.g. `cdn` 67 direct VTT, `m4uhd` 1 SRT)** — decoder ported to extension; seed + tmdbId replay from captured response; provider extracted from path |
| video.js `remoteTextTracks()` API (no DOM `<track>`) | lookmovie2.to | ❌ **chưa** — extension chỉ scan DOM `<track>`, không đọc video.js API |
| JWPlayer 8 `getPlaylist()` API (no DOM `<track>`) | lunastream.com.cv/flixcdn.cyou | ❌ **chưa** — extension không đọc JWPlayer API |
| OpenSubtitles download URL (no extension) | lunastream.com.cv, lookmovie2.to | ❌ **chưa** — `SUBTITLE_URL_PATTERNS` không match `/file/<id>` |
| HLS subtitle tracks trong m3u8 | (có thể onflix.lat, myasiantv.es) | ❌ chưa — cần điều tra thêm |

## Cập nhật

- **2026-08-02 historical snapshot**: Tạo file; điều tra shuttletv.su + onflix.lat khi playembed còn bị Cloudflare block.
- **2026-08-02 historical snapshot**: Điều tra kisskh.co (6/1 subtitle observed) + myasiantv.es trước khi có Referer/player HTML evidence.
- **2026-08-02 historical snapshot**: moviepire/videasy ghi nhận 15/1; số hiện tại đã được re-audit thành 85/1.
- **2026-08-02 historical snapshot**: lookmovie2 ghi nhận API 111 + remoteTextTracks 112; re-audit mới phân loại 87 direct VTT + 24 metadata arrays.
- **2026-08-03 historical snapshot**: lunastream ghi nhận 33 hash entries; re-audit giữ nguyên count nhưng chưa có extension delivery.
- **2026-08-03 historical snapshot**: broodingmovies ghi nhận vaplayer API; re-audit xác nhận 42 direct URLs nhưng background header replay chưa verify.
- **2026-08-03**: Điều tra noxx.to (snapshot cũ — chưa vào deep `/prorcp`).
- **2026-08-03 re-audit**: Re-verify toàn bộ 9 site bằng `cell-profile`: cinesrc 100 API entries; kisskh 6 direct SRT; lookmovie 111 entries (87 direct + 24 metadata arrays); lunastream 33 hash URLs; brooding 42 API URLs; videasy 85 decrypted VTT; noxx 43 deep-state VTT (HEAD 43/43); MyAsianTV 4 HTML-player VTT (HTTP 200 với Referer); Onflix 2 VTT (Việt + Anh). Kết luận: player-side list đã có evidence; videasy decoder đã được implement/unit-test trong extension.
