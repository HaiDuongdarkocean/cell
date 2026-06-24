# HLS Edge Cases — P1 to P4 (Parser-First Hybrid)

## Problem Statement

**HMW:** Làm sao để extension tải được HLS streams trong mọi trường hợp thực tế (AES-128 encrypted, fMP4/CMAF, byte-range, ad insertion, token expiry) mà không phải viết lại architecture?

## Recommended Direction

**Parser-First Hybrid + Auto-Detect:** Mở rộng `m3u8Parser.ts` để parse tất cả HLS tags quan trọng thành structured data. Downloader auto-detect segment type + encryption + format → route vào pipeline tương ứng. Không có feature flags — "just works" với silent fallback to `.ts`.

### Architecture

```
m3u8Parser.ts (extended)
  → parse: #EXT-X-KEY, #EXT-X-MAP, #EXT-X-BYTERANGE, #EXT-X-DISCONTINUITY
  → output: rich M3u8Playlist { encryption, initSegment, segments[], discontinuities[] }

downloader.ts (auto-route)
  ├── .ts + no encryption  → transmux (existing mux.js pipeline)
  ├── .ts + AES-128        → decrypt (WebCrypto) → transmux
  ├── .m4s + no encryption → concat init + segments → .mp4 (NO transmux needed)
  ├── .m4s + AES-128       → decrypt → concat
  ├── byteRange            → Range header on fetch
  ├── discontinuity        → skip ad segments (mark + skip)
  └── 403 on segment       → re-fetch playlist → refresh tokens → retry
```

### Why this direction

1. **Parser là single source of truth** — tất cả HLS complexity tập trung 1 chỗ, downloader chỉ consume structured data
2. **fMP4 concat path** — .m4s segments đã là MP4 fragments, chỉ cần prepend init segment + concat. **Không cần transmux** → faster + simpler
3. **Auto-detect** — user không cần biết gì. Parser detect → downloader handle. Silent fallback to .ts nếu anything fails
4. **Decrypt as middleware** — WebCrypto layer giữa fetch và write, không lẫn vào pipeline logic

## Key Assumptions to Validate

- [ ] **mux.js transmux decrypted .ts** — decrypt output = raw MPEG-TS, mux.js xử lý bình thường (test với 1 encrypted stream)
- [ ] **fMP4 concat không cần remux** — true khi same codec across segments (test với 1 CMAF stream)
- [ ] **AES-128 key URI public** — user chọn "basic", key fetch không cần auth (verify trên 3-5 sites thực tế)
- [ ] **#EXT-X-DISCONTINUITY = ad boundary** — không phải tất cả ads dùng discontinuity (accept false negatives)
- [ ] **Token refresh trên 403** — re-fetch playlist cho token mới (không hoạt động nếu IP-bound)
- [ ] **WebCrypto available in service worker** — `crypto.subtle` trong MV3 SW context (verify)

## MVP Scope

### Phase 1: Parser Extension (foundation)
**Files:** `m3u8Parser.ts`, `types/media.ts`, `m3u8Parser.test.ts`

- Parse `#EXT-X-KEY` → `{ method, keyUri, iv }`
- Parse `#EXT-X-MAP` → `{ uri, byteRange? }`
- Parse `#EXT-X-BYTERANGE` → `{ length, offset? }` (attach to next segment)
- Parse `#EXT-X-DISCONTINUITY` → mark next segment `discontinuity: true`
- Parse `#EXT-X-ENDLIST` → `isLive: boolean` (for future, not implementing LIVE)
- Update `TsSegment` interface: add `byteRange?`, `discontinuity?`, `encryption?`
- Update `M3u8Playlist` interface: add `encryption?`, `initSegment?`, `hasEndlist`

### Phase 2: AES-128 Decryption (P1)
**Files:** `downloader.ts` (new `decryptSegment`), `types/media.ts`

- Fetch key từ `encryption.keyUri` (with same headers as playlist)
- Cache key per download (avoid re-fetch)
- IV: từ `encryption.iv` hoặc derive từ segment sequence (`sequence` as 16-byte big-endian)
- WebCrypto `crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, data)`
- Insert decrypt step between fetch and OPFS write
- Fallback: if decrypt fails → save encrypted .ts + warn user

### Phase 3: fMP4 / CMAF Support (P1)
**Files:** `downloader.ts` (new `downloadFmp4` path), `transmuxWorker.ts`

- Detect fMP4: `playlist.initSegment` exists OR segment URL ends with `.m4s`
- Fetch init segment (`#EXT-X-MAP:URI=...`) → write to OPFS first
- Fetch .m4s segments → write after init segment
- Output = `.mp4` directly (fMP4 = fragmented MP4, concat = valid MP4)
- **Skip transmux entirely** for fMP4 path
- Fallback: if concat produces invalid MP4 → try transmux → save .ts

### Phase 4: Byte-Range + Ad Skip + Token Refresh (P2-P4)
**Files:** `downloader.ts`, `fetchSegment`

- **Byte-range:** If segment has `byteRange`, add `Range: bytes=start-end` header
- **Ad skip:** If segment has `discontinuity: true`, skip fetch (or fetch but mark as ad)
- **Token refresh:** On 403, re-fetch playlist → re-resolve segment URL with new query params → retry once
- **Nested master:** If variant playlist is also master, recurse (max depth 3)

## Not Doing (and Why)

- **LIVE stream polling** — user confirmed không cần. Architecture mở (isLive field) nhưng không implement polling loop
- **Commercial DRM (Widevine/PlayReady/FairPlay)** — impossible without device key + license server
- **AES key behind auth** — user chọn "basic". Key URI public. Signed key URLs = future work
- **SCTE-35 ad markers** — too complex, `#EXT-X-DISCONTINUITY` is sufficient for 90% cases
- **Multi-audio track selection UI** — P2 but deferred. Parse `#EXT-X-MEDIA` in parser, but no UI for selection yet
- **Subtitle tracks in HLS** — separate from current subtitle detection (which scans webRequest). HLS subtitle tracks = future
- **Feature flags / settings** — auto-detect only. No user-facing toggles. Silent fallback instead
- **Server-side ad insertion** — no `#EXT-X-DISCONTINUITY` marker → cannot detect. Accept false negatives
- **IP-bound token refresh** — re-fetch playlist won't help if token tied to different IP. Accept failure

## Open Questions

- WebCrypto `crypto.subtle` available in MV3 service worker? (verify with test)
- fMP4 concat: does `#EXT-X-MAP` init segment + raw .m4s segments produce valid MP4 without remux? (test with real CMAF stream)
- Should ad segments be skipped (smaller file) or kept (complete stream)? — default skip, but maybe keep with metadata?
- Token refresh: re-fetch master or just variant playlist? — probably variant (lighter)
- Nested master: max recursion depth? — 3 seems safe, but verify no real-world cases go deeper

## Implementation Order

```
Phase 1 (Parser)    → 2-3h  → foundation, no behavior change
Phase 2 (AES-128)   → 3-4h  → unlock encrypted sites
Phase 3 (fMP4)      → 2-3h  → unlock CMAF sites, faster downloads
Phase 4 (Byte+Ad+Token) → 2-3h → polish, edge case coverage
```

Each phase independently shippable. Tests after each phase.
