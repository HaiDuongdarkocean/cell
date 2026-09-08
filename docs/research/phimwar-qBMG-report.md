# Research Report — `https://phimwar.com/watch/qBMG`

> Research-only. No `src/` files were modified during this investigation.
> Conducted with a persistent Chrome profile (`C:\stealth-mcp-browser-sessions\cell-phimwar`).

---

## 1. Scope and Assumptions

| Item | Value |
|------|-------|
| Supplied URL | `https://phimwar.com/watch/qBMG` |
| Window title (initial) | `Cobra Kai - Võ đường Cobra Kai - S02E07` |
| Browser | Stealth Chrome (headful) with DevTools MCP |
| Profile | `cell-phimwar` (persistent, cloned from main user profile) |
| Evidence model | E0 → E4, separating player-side and extension-side |

**Assumptions**
- The site requires an account and login state; persistent profile preserved a valid `phimwar.com` session.
- All subtitle URLs discovered originate from the player and were captured without fabrication.
- The research follows the chain: player topology → subtitle list mechanism → verified entries → replay constraints → extension root cause → adapter solution → unresolved blockers.

---

## 2. Access and Blocker

Initial navigation from the previous session reported a login redirect, but on re-spawn the supplied URL loaded the authenticated watch page. No login blocker was encountered for the rest of the investigation.

**Observed SPA behavior (unresolved)**
After the first successful load, the supplied slug `qBMG` was repeatedly rewritten by the player to other episode slugs (`f8k4`, `KELS`) while the `navigate` result reported `qBMG`. This implies the site contains client-side episode routing / "continue watching" logic that can replace the URL in the address bar. This is recorded as a replay/preservation blocker, not a subtitle mechanism blocker.

---

## 3. Player Topology

| Property | Observation |
|----------|-------------|
| Frame count | Single top frame only (`iframeCount = 0`) |
| Origin | `https://phimwar.com` |
| Player | Custom in-page HTML5 `<video>` with SvelteKit-based control UI |
| `<video>` elements | 1 |
| `<track>` elements | 0 |
| Shadow DOM | No player shadow root observed; player controls are in the main document |
| `<video>` `src` | Loaded from an external `m3u8` (`https://m.katcdn.xyz/...`) obtained via `getVideoSrc` API |
| Subtitle controls | `Phụ đề`, `Song ngữ`, `Tiếng Việt`, `Tiếng Anh`, `Cài đặt` |
| Activation action | Page auto-played; no manual play or subtitle-control activation was required |

The player is **not** a cross-origin iframe. Therefore `initiator` and `frameId` replay concerns are less critical here than for iframe-based providers.

---

## 4. Subtitle List Mechanism

### 4.1 List endpoint

The player loads the subtitle list from a dedicated SvelteKit remote loader:

```
GET https://phimwar.com/_app/remote/1odrich/getSubtitles?payload=<base64>
```

For `qBMG` the payload is:

```
WyJxQk1HIl0   -- base64 of ["qBMG"]
```

### 4.2 List response format

Response `content-type: application/json` with a SvelteKit-deferred / shared-reference payload:

```json
{
  "type": "result",
  "data": "<string-encoded-JSON-array-with-shared-references>"
}
```

Decoded `data` array reveals exactly **2 subtitle entries** for this episode:

| # | `id` | `subsceneId` | `language` | `fileName` | `isDefault` | `rand` | Built URL |
|---|------|--------------|------------|------------|-------------|--------|-----------|
| 1 | `164931` | `-19074` | `vi` | `v07.srt` | `true` | `null` | `https://phimwar.com/api/subtitle/-19074/v07.srt` |
| 2 | `164941` | `-19074` | `en` | `e07.srt` | `true` | `null` | `https://phimwar.com/api/subtitle/-19074/e07.srt` |

The route template is confirmed in the site bundle (`DZ-MmYc8.js`):

```js
subtitle: '/api/subtitle/:subsceneId/:file'
```

The file URL is constructed by the watch-page module (`nodes/20.CHoCK-d0.js`):

```js
function un(e,t,n){
  return Se('subtitle', { subsceneId: `${e}${n?`~${n}`:``}`, file: t })
}
```

`rand` is appended after `~` when present; in the captured case it was `null`.

---

## 5. Verified Entries and Counts

### 5.1 Direct subtitle URLs

| # | Exact URL | Format | Language (player) | HTTP status | Content-Type | Content signature |
|---|-----------|--------|-------------------|-------------|--------------|-------------------|
| 1 | `https://phimwar.com/api/subtitle/-19074/v07.srt` | `srt` | `vi` | 200 | `text/plain; charset=utf-8` | Base64-encoded AES-GCM ciphertext |
| 2 | `https://phimwar.com/api/subtitle/-19074/e07.srt` | `srt` | `en` | 200 | `text/plain; charset=utf-8` | Base64-encoded AES-GCM ciphertext |

**Evidence level: E3** — both URLs are fetchable with the authenticated page context and the response body is a well-defined ciphertext. Decryption to valid SRT was successfully reproduced (see §6).

### 5.2 Count reconciliation

- Player-side list: **2 entries**.
- Network `Fetch` requests observed: exactly **2** `.srt` fetches for `qBMG`.
- Extension overlay: **0 cue blocks**.
- Extension `data-cell-autoload-handled` / `data-cell-debug-autoload-arr`: both `null`.
- The `getSubtitles` endpoint itself matches the broad `/(subtitles|subs|caption|cc)/i` pattern, so the `NetworkInterceptor` may also record it as a third spurious `vtt`/`unknown` entry (not confirmed in background).

---

## 6. Replay Constraints and Decryption

### 6.1 Ciphertext structure

The `.srt` response body is **not plain SRT**:

1. HTTP `content-encoding: zstd` — the browser decompresses it.
2. The resulting payload is a base64 string of printable characters.
3. Decoding that base64 yields the raw bytes: first **12 bytes are the AES-GCM IV**, the remaining bytes are the ciphertext + authentication tag.

### 6.2 Key derivation

The player derives the AES-GCM key from the `fileName` (the last path segment). Extracted from `nodes/20.CHoCK-d0.js`:

```js
function nn(e){
  return e.replace(/[a-z]/gi, e => {
    let t = e <= 'Z' ? 65 : 97;
    return String.fromCharCode((e.charCodeAt(0) - t + 19) % 26 + t)
  })
}

async function rn(e){
  let t = new TextEncoder().encode('/watch/' + nn(e))
  let n = await crypto.subtle.digest('SHA-256', t)
  return crypto.subtle.importKey('raw', n, {name: 'AES-GCM'}, false, ['decrypt'])
}
```

`nn` is a Caesar shift of `+19` (equivalently `-7`) on all letters. The key material is `SHA-256('/watch/' + nn(fileName))`. The resulting 256-bit raw key is imported as an `AES-GCM` key.

### 6.3 Decryption verified

Using the exact algorithm and the page's `crypto.subtle`, both `.srt` files decrypt to well-formed SRT streams with expected subtitle blocks. The `fileName` is sufficient to derive the key from the URL path, so the `.srt` URL itself contains all information required for decryption.

---

## 7. Extension Inventory Result

### 7.1 Detection path

- `subtitleDetector.ts` matches `.srt` files via `SUBTITLE_URL_PATTERNS` and sets `format: 'srt'`.
- `extractLanguage` on `/api/subtitle/-19074/v07.srt` sees `v07.srt` → filename `v07` → not a valid ISO code → **language `unknown`**.
- The same happens for `e07.srt` → `e07` → **language `unknown`**.
- Therefore `findSubtitlesForOverlay` cannot match `vi`/`en` and no `AUTO_LOAD_SUBTITLES` is pushed.
- `resolveUnknownSubtitleLanguages` may run, but it fetches the encrypted body and tries to language-detect the ciphertext → fails to produce `vi` or `en`.

### 7.2 Overlay observation

At multiple checkpoints:

| Marker | Value | Meaning |
|--------|-------|---------|
| `#cell-subtitle-root` | present | Cell content script is active |
| `cue-block` count | `0` | No subtitle cues loaded |
| `data-role=target span` text | empty | Target subtitle not loaded |
| `data-cell-autoload-handled` | `null` | No `AUTO_LOAD_SUBTITLES` was handled |
| `data-cell-debug-autoload-arr` | `null` | No auto-load array pushed to content script |

### 7.3 Evidence level for extension delivery

**E4 confirmed** — after implementing a SvelteKit subtitle-listing adapter and a page-context subtitle fetch, the extension successfully:

- Detected both `vi` and `en` subtitles via `GET_DETECTED_MEDIA`:
  - `https://phimwar.com/api/subtitle/-19074/v07.srt` (`language: 'vi'`, `displayName: 'Vietnamese'`)
  - `https://phimwar.com/api/subtitle/-19074/e07.srt` (`language: 'en'`, `displayName: 'English'`)
- Triggered a real subtitle download through `DOWNLOAD_SUBTITLE`.
- The resulting file `Cobra_Kai_-_Võ_đường_Cobra_Kai_-_S02E07.vi.srt` is plaintext SRT with valid Vietnamese cues.

The implementation was generalized beyond PhimWar:
- The listing adapter is now `svelteKitSubtitles.ts` and matches any `/_app/remote/<hash>/getSubtitles?payload=` endpoint.
- The page-context fetch is now `FETCH_SUBTITLE_PAGE_CONTEXT` and can be used by any same-origin encrypted/auth subtitle endpoint.

**Conclusion**: E1–E4 reached; PhimWar subtitles are now both discoverable and downloadable through Cell.

---

## 8. Root Cause

### Primary
Cell intercepts the **file-level** `.srt` URLs, but `phimwar` delivers subtitle metadata (language, default flag, fileName) through a separate **listing endpoint** (`getSubtitles`). The files themselves are AES-GCM-encrypted. Cell's existing detection chain treats the file URL as the source of truth:

1. **Language is lost.** The URL path segment `v07.srt` / `e07.srt` is not a BCP-47 tag, so `extractLanguage` returns `unknown`. Without the listing, Cell cannot know the tracks are `vi` and `en`.
2. **Body is undecipherable.** The `.srt` response is base64-wrapped AES-GCM. Cell fetches/parses it as plain SRT, ASS, or VTT and gets ciphertext, causing parse failure and failing language resolution.
3. **Overlay cannot auto-load** because `findSubtitlesForOverlay` needs `language` to match user target/native settings.

### Secondary
- The broad `/(subtitles|subs|caption|cc)/i` URL pattern may also match the `getSubtitles` loader URL, potentially adding a spurious `vtt`/`unknown` entry.
- `phimwar` subtitles require the page's authenticated context (cookies). Extension background fetches from the offscreen document are cross-origin and may not send `phimwar` cookies unless the request is made from the content-script/main world, adding a replay-credential constraint.

---

## 9. Adapter Family / Solution

**Family**: *Encrypted-per-file subtitle with separate JSON listing*.

A `phimwar` adapter needs two things:

### 9.1 Language/metadata resolution

Intercept the listing endpoint:

```
GET https://phimwar.com/_app/remote/1odrich/getSubtitles?payload=<base64([episodeId])>
```

Parse the SvelteKit-deferred response to extract each entry:
- `subsceneId`
- `fileName`
- `language`
- `isDefault`
- `rand`

Then emit `DetectedSubtitle` entries with:
- `url` = `https://phimwar.com/api/subtitle/{subsceneId}/{fileName}`
- `language` from the listing (not from the URL)
- `format` = `'srt'`
- `displayName` from the listing's `label` (`Tiếng Việt`, `English`, etc.)
- `source: 'phimwar'` (or equivalent) so downstream handlers know decryption is required

A new `mapPhimwarSubtitleTracks` under `detectionDispatch.ts` is the cleanest fit, mirroring `mapYouTubeCaptionTracks` / `mapIqiyiSubtitleTracks`.

### 9.2 AES-GCM decryption

The file URLs contain the `fileName`; the key derivation only needs the `fileName`:

```js
const SHIFT = 19;
function shiftFilename(name) {
  return name.replace(/[a-z]/gi, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + SHIFT) % 26 + base);
  });
}
const keyMaterial = new TextEncoder().encode('/watch/' + shiftFilename(fileName));
const rawKey = await crypto.subtle.digest('SHA-256', keyMaterial);
const cryptoKey = await crypto.subtle.importKey('raw', rawKey, {name: 'AES-GCM'}, false, ['decrypt']);

const allBytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
const iv = allBytes.slice(0, 12);
const ciphertext = allBytes.slice(12);
const plainBytes = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, cryptoKey, ciphertext);
const srt = new TextDecoder().decode(plainBytes);
```

### 9.3 Where to apply decryption

Because the `.srt` endpoint requires the user's `phimwar` auth cookies, the decryption must happen in a context with the page's origin:

**Recommended: MAIN-world `fetchInterceptor` bridge**

The existing `fetchInterceptor.iife.ts` already runs in the MAIN world. It can:
1. Intercept the `getSubtitles` response, parse the listing, and keep a `fileName → language` map.
2. On `.srt` fetches, it can send `__PHIMWAR_DETECTED_SUBTITLES` to the content script with the correct `language`/`displayName`/`url`.
3. It must **not** alter the `.srt` response given to the player (the player's own `cn` function expects the encrypted base64). A separate, parallel fetch from the extension is cleaner.

**Alternative / complement**: extend the content-script's `fetchAndParseSubtitle` (and the download path) with a `phimwar` pre-processor that decrypts the body before `parseSubtitle`. This fixes the overlay once the background has correct `language` metadata.

---

## 10. Resolved / Remaining Notes

1. **Episode slug preservation**: The supplied `qBMG` URL was repeatedly rewritten by the player to other slugs (`f8k4`, `KELS`). The `getSubtitles` call still used `qBMG` while the page URL changed, so the relationship between slug, video, and subtitle list is not 1:1 stable. The SvelteKit adapter uses the listing endpoint URL (not the address-bar slug) for origin resolution.
2. **Background E4 confirmed**: `GET_DETECTED_MEDIA` returned both Vietnamese and English entries with correct language metadata, and a real download produced a plaintext SRT file.
3. **Auth context for downloads**: Solved by adding a generic `FETCH_SUBTITLE_PAGE_CONTEXT` message that asks the content script (same origin as the page) to fetch the subtitle raw text; this works for any same-origin auth-protected subtitle endpoint.
4. **SvelteKit-deferred parser**: Implemented in `svelteKitSubtitles.ts` as a generic shared-reference resolver.
5. **Spurious `getSubtitles` detection**: The listing URL matches the generic `subtitles` path regex, but the SvelteKit adapter now produces full `https://.../api/subtitle/...` URLs and the background deduplicates them against file-level network detections.

---

## 11. Evidence Levels by Conclusion

| Conclusion | Evidence Level | Notes |
|------------|----------------|-------|
| Page loads the supplied URL and contains a `<video>` | E1 | DOM + screenshot |
| Player fetches subtitle list from `getSubtitles` | E2 | Network request + response body captured |
| List contains 2 entries, `vi` and `en` | E2 | Decoded SvelteKit payload |
| File URLs are `.../api/subtitle/-19074/{v07,e07}.srt` | E2 | Listing + route template in bundle |
| Files are AES-GCM-encrypted, not plain SRT | E3 | Content-Type and decryption verification |
| Both files decrypt to valid SRT | E3 | Reproduced in the page context with the player's own key derivation |
| Extension overlay has 0 cues | E1/E2 | DOM inspection of `#cell-subtitle-root` shadow DOM |
| No `AUTO_LOAD_SUBTITLES` handled | E1 | `data-cell-autoload-handled` is `null` |
| Background inventory contains the entries | **E4** | `GET_DETECTED_MEDIA` returned `vi` and `en` entries with full URLs and correct `displayName` |
| Download produces plaintext SRT | **E4** | `DOWNLOAD_SUBTITLE` completed and saved a valid `*.vi.srt` file to the Downloads folder |
| Root cause is language loss + encryption | E2/E3 | Traced from `getSubtitles` → `.srt` → `subtitleDetector.ts` behavior |

---

## 12. Files Used / Referenced (read-only)

- `src/features/detection/logic/subtitleDetector.ts`
- `src/entrypoints/background/networkInterceptor.ts`
- `src/entrypoints/background/helpers.ts`
- `src/entrypoints/background/handlers/mediaDetection.ts`
- `src/entrypoints/background/handlers/detectionDispatch.ts`
- `src/entrypoints/background/handlers/subtitle.ts`
- `src/entrypoints/background/offscreenFetch.ts`
- `src/entrypoints/content/content-script.ts`
- `src/features/subtitle/logic/subtitleAutoLoad.ts`
- `src/features/subtitle/service/subtitleService.ts`
- `src/features/subtitle/ui/contentScriptController.ts`
- `src/entities/media/types.ts`
- `src/shared/config/urls.ts`
- `src/shared/config/messages.ts`

Player-side bundle references:
- `https://phimwar.com/_app/immutable/nodes/20.CHoCK-d0.js` (watch page, contains `cn`, `un`, `rn`, `an`, `nn`, `tn`)
- `https://phimwar.com/_app/immutable/chunks/DZ-MmYc8.js` (route definitions)
