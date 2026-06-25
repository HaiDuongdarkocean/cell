# DNR Header Override — POC-First, Progressive Fallback

## Problem Statement

**HMW:** Làm sao để extension override `Cookie`, `User-Agent` (và có thể `Origin`) trên requests tới CDN — những headers mà `fetch()` không thể set reliably — để tải video từ tối đa free streaming sites?

**Revised target:** ~85-90% coverage (not 95%) — pending POC validation of core assumptions.

## CTO Feedback Incorporated

Tài liệu này đã được revise dựa trên CTO review. Các thay đổi chính:

1. **POC-first approach** — validate 5 critical assumptions TRƯỚC khi implement
2. **Origin override uncertain** — DNR `append` không hỗ trợ Origin; `set` chưa được confirm. POC bắt buộc.
3. **Cookie scope issues** — cookie domain ≠ CDN domain. `chrome.cookies.getAll` có thể return empty.
4. **403 ≠ missing header** — cần error classification trước khi escalate
5. **Level caching là MVP** — không phải future optimization. Tránh 6s retry mỗi download.
6. **UA cut from MVP** — ROI <1%, cost cao. Chỉ làm nếu telemetry chứng minh.
7. **Concurrent download isolation** — dùng `tabIds` (session rules) hoặc `initiatorDomains`
8. **Cleanup on SW restart** — dynamic rules persist, cần orphan cleanup
9. **Coverage estimates revised** — không có data support 95%. POC + telemetry sẽ xác định.

## Research Findings (Chrome Official Docs)

### Confirmed Facts

| Fact | Source | Implication |
|---|---|---|
| DNR `append` only supports: accept, accept-encoding, ..., **cookie**, **user-agent**, ... | [Chrome DNR docs](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) | `append` Origin = ❌. `set` Origin = ⚠️ UNCERTAIN |
| `updateDynamicRules` returns `Promise<void>` | Same | Must `await` before retry fetch — async race condition |
| Dynamic rules: 30,000 limit. Session: 5,000 limit | Same | Sufficient for per-download rules |
| `xmlhttprequest` matches `fetch()` from SW | Same + MDN | DNR rules WILL fire for extension's fetch calls |
| `tabIds` condition (session rules only, Chrome 92+) | Same | Per-tab isolation possible |
| `initiatorDomains` condition (Chrome 101+) | Same | Per-domain isolation, matches subdomains |
| `requestDomains` matches subdomains automatically | Same | Better than `urlFilter` for CDN matching |
| Dynamic rules persist across SW restart | Same | Orphan rules possible — need cleanup |
| `chrome.cookies.getAll` reads ANY domain with host_permissions | [Chrome cookies docs](https://developer.chrome.com/docs/extensions/reference/api/cookies) | Third-party cookie blocking does NOT affect API |
| Extension with host_permissions = same-site for SameSite cookies | [Storage & cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies) | Can read SameSite=Strict cookies for any domain |

### Uncertain (Needs POC)

| Question | Risk if false | POC plan |
|---|---|---|
| Can DNR `set` Origin header? | HIGH — entire Level 1 useless | POC: DNR set Origin → echo server → verify |
| Does `set` Origin actually change outgoing request? | HIGH — browser may force-override | POC: DevTools Network tab inspection |
| Cookie scope: does `getAll({domain: cdn.com})` return cookies set by page domain? | MEDIUM — may return empty | POC: test on real site with auth cookies |
| Does DNR rule fire for SW fetch with `requestDomains`? | HIGH — architecture fails | POC: add rule → SW fetch → `onRuleMatchedDebug` |

## Recommended Direction

**POC-First, then Progressive Fallback with Error Classification:**

```
Phase 0: POC (1-2 days) — validate or kill assumptions
  ↓ (gated: only proceed if POC passes)
Phase 1: Telemetry + Error Classification — know what 403 means
Phase 2: DNR Cookie inject (confirmed possible) — highest ROI
Phase 3: DNR Origin override (if POC passes) — second highest ROI
Phase 4: Level caching + cleanup + isolation — production hardening
Phase 5: UA override (only if telemetry proves >1% gain)
```

### Revised Escalation Flow (post-POC)

```
Level 0: fetch() + buildFetchHeaders (Referer only) — hiện tại
  → 200 OK? Done. (Nhóm 1: ~40% sites)
  → 403? Classify error (see below)
  → If "missing header" type → escalate
  → If "expired token" → token refresh (not header fix)
  → If "geo block" → throw clear error
  → If "cloudflare challenge" → throw clear error

Level 1: DNR rule — set Cookie (chrome.cookies.getAll) cho CDN domain
  → 200 OK? Done. (Nhóm 2+5: +5-8% sites, pending POC)
  → 403? Escalate to Level 2

Level 2: DNR rule — set Origin (IF POC CONFIRMS possible)
  → 200 OK? Done. (Nhóm 4: +0-10% sites, pending POC)
  → 403? Escalate to Level 3

Level 3: DNR rule — set User-Agent (only if telemetry justifies)
  → 200 OK? Done. (Nhóm 6: +<1% sites)
  → 403? Throw error "Cannot bypass CDN protection"
```

### Error Classification (403 ≠ missing header)

Before escalating, classify the 403:

```
403 + response headers:
  - cf-ray: xxx          → Cloudflare challenge → throw "Cloudflare protected"
  - server: akamai       → Akamai bot detection → throw "Bot detection"
  - x-amz-cf-id: xxx     → CloudFront signed URL expired → token refresh
  - www-authenticate:    → Auth required → throw "Authentication required"
  - none of above        → Likely missing header → escalate
```

This avoids 6s retry waste on non-header 403s.

## Key Assumptions to Validate (POC)

### POC 1: DNR `set` Origin — CRITICAL
```typescript
// Test: add DNR rule set Origin, fetch echo server, verify
chrome.declarativeNetRequest.updateSessionRules({
  addRules: [{
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'Origin', operation: 'set', value: 'https://example.com' }],
    },
    condition: { requestDomains: ['httpbin.org'], resourceTypes: ['xmlhttprequest'] },
  }],
});
await fetch('https://httpbin.org/headers'); // echo server
// Check: does response show Origin: https://example.com?
```
**Pass criteria:** Echo server returns `Origin: https://example.com`
**Fail criteria:** Echo server returns `Origin: chrome-extension://...` or empty
**If fail:** Level 2 (Origin override) is DEAD. Max coverage ~85%. Consider tab fetch for small files.

### POC 2: DNR rule fires for SW fetch
```typescript
// Test: add rule with onRuleMatchedDebug listener
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  console.log('Rule matched:', info.rule.ruleId);
});
// Add rule for httpbin.org, fetch from SW
// Check: does listener fire?
```
**Pass criteria:** `onRuleMatchedDebug` fires when SW fetch matches rule
**If fail:** Entire DNR approach is DEAD. Must use tab fetch.

### POC 3: Cookie scope for cross-origin CDN
```typescript
// Test on a real site (e.g., kisskh.co):
// 1. Visit site, let player load
// 2. chrome.cookies.getAll({ domain: 'cdn.kisskh.co' })
// 3. chrome.cookies.getAll({ domain: 'kisskh.co' })
// Compare: which returns auth cookies?
```
**Pass criteria:** At least one getAll call returns non-empty array with auth cookies
**If fail:** Cookie injection less useful. Coverage gain drops from +8% to +2-4%.

### POC 4: DNR async timing
```typescript
// Test: add rule, immediately fetch, check if rule applied
await chrome.declarativeNetRequest.updateSessionRules({ addRules: [...] });
// Is rule active NOW or is there delay?
const response = await fetch('https://httpbin.org/headers');
// Does response show modified headers?
```
**Pass criteria:** Rule is active immediately after `await` resolves
**If fail:** Need retry-with-delay logic (add rule → wait 100ms → fetch)

### POC 5: Concurrent download isolation
```typescript
// Test: 2 rules with different tabIds, same requestDomains
// Rule A: tabIds: [1], set Cookie: A
// Rule B: tabIds: [2], set Cookie: B
// Fetch from tab 1 context → should get Cookie A
// Fetch from tab 2 context → should get Cookie B
```
**Pass criteria:** Each tab's fetch gets its own rule's headers
**If fail:** Cannot support concurrent downloads from same CDN. Must serialize.

## MVP Scope (Revised)

### Phase 0: POC Validation (1-2 days) — GATE
**Files:** `tests/poc/dnr-origin-poc.test.ts` (new, temporary), `tests/poc/dnr-cookie-poc.test.ts`

- POC 1: DNR `set` Origin — verify or kill
- POC 2: DNR rule fires for SW fetch — verify or kill
- POC 3: Cookie scope — measure real coverage
- POC 4: Async timing — verify or add delay
- POC 5: Concurrent isolation — verify or serialize
- **Gate:** Only proceed to Phase 1+ if POC 2 passes (architecture foundation)
- **Gate:** Only implement Origin override (Phase 3) if POC 1 passes

### Phase 1: Telemetry + Error Classification
**Files:** `src/background/errorClassifier.ts` (new), `src/background/downloader.ts`

- Classify 403 by response headers (cf-ray, akamai, cloudfront, etc.)
- Log classification: `console.debug('[downloader] 403 classified as: ${type}')`
- Only escalate if classification = "likely missing header"
- Non-header 403s → throw specific error messages
- Test: mock response headers, verify classification

### Phase 2: DNR Cookie Inject (Level 0→1)
**Files:** `manifest.json`, `src/background/dnrHeaderOverride.ts` (new), `src/background/downloader.ts`

- Add `declarativeNetRequest` + `cookies` permissions to manifest
- `DnrHeaderOverride` class:
  - `addCookieRule(tabId, cdnDomains, cookies)` — session rule with `tabIds` isolation
  - `removeRules(ruleIds)` — cleanup
  - `extractCdnDomains(urls)` — extract unique domains from all URLs (video, segments, keys, init, audio, subtitle)
- Read cookies: `chrome.cookies.getAll({ domain: cdnDomain })` for each CDN domain
  - Also try parent domain (e.g., `cdn.example.com` → also query `example.com`)
- Serialize: `cookies.map(c => `${c.name}=${c.value}`).join('; ')`
- Use `requestDomains` (not `urlFilter`) for CDN matching
- Use `tabIds` for per-tab isolation (session rules)
- On 403 (classified as "missing header") → add cookie rule → `await` → retry first segment only
- On success → keep rule for rest of download → remove on complete/error/cancel
- Test: mock DNR + cookies, verify rule structure, verify retry logic

### Phase 3: DNR Origin Override (Level 1→2) — CONDITIONAL
**Files:** `src/background/dnrHeaderOverride.ts`, `src/background/downloader.ts`

**Only implement if POC 1 passes.**

- `DnrHeaderOverride.addOriginRule(tabId, cdnDomains, pageOrigin)` — add Origin to existing rule
- On Level 1 403 → add Origin to rule → `await` → retry
- Test: verify Origin header in rule, verify retry

### Phase 4: Level Caching + Cleanup + Isolation
**Files:** `src/background/dnrHeaderOverride.ts`, `src/background/downloader.ts`, `src/background/index.ts`

- **Level cache:** `chrome.storage.local` — key: `dnr-level:${cdnDomain}`, value: `{ level, timestamp }`, TTL 24h
  - On download start → check cache → skip to cached level → avoid 6s retry
  - On level change → update cache
- **Cleanup paths:**
  - Download complete/error/cancel → remove rules
  - Tab close (`chrome.tabs.onRemoved`) → remove session rules for that tab
  - SW restart → `getDynamicRules()` on startup → remove orphan rules not in active downloads map
  - Browser restart → dynamic rules persist → cleanup on SW startup
- **Concurrent downloads:** `tabIds` isolation (session rules). Each tab gets own rule.
- **Rule ID management:** counter persisted in `chrome.storage.session`, reset on SW restart
- Test: verify cache hit/miss, verify cleanup on all paths, verify isolation

### Phase 5: UA Override (Level 2→3) — DEFERRED
**Only implement if telemetry from Phase 1-4 shows >1% success gain.**

- `DnrHeaderOverride.addUserAgentRule(tabId, cdnDomains, ua)` — add UA to rule
- Get UA: store `navigator.userAgent` in `chrome.storage.session` when popup opens (not executeScript)
- On Level 2 403 → add UA → retry
- Test: verify UA in rule, verify retry

## Not Doing (and Why)

- **Tab fetch for large files** — 64MB return limit. DNR is correct for M3U8 (thousands of segments).
- **Tab fetch for small MP4** — adds 2nd code path, complexity. DNR Cookie should cover most cases.
- **Static DNR rules file** — auto-discover from URLs. No domain list to maintain.
- **Blocking webRequest** — MV3 doesn't support `blocking` for `onBeforeSendHeaders`.
- **TLS fingerprinting bypass** — impossible at extension level. ~1% sites.
- **Commercial DRM bypass** — impossible. ~2% sites.
- **Server-side ad stitching detection** — no marker. ~1% sites.
- **VPN/proxy for geo-blocking** — out of scope.
- **UA override in MVP** — ROI <1%, cost high (executeScript fragile). Deferred to Phase 5 with telemetry.
- **Coverage estimate 95%** — no data support. POC + telemetry will determine real coverage. Target: 85-90%.

## Open Questions

- **POC 1 result determines architecture** — if DNR can't `set` Origin, max coverage ~85% (Cookie + Referer only). Is 85% acceptable?
- **Cookie domain matching** — should we query `cdn.example.com` AND `example.com` AND page domain? Multiple getAll calls per CDN domain.
- **Session rules vs dynamic rules** — session rules support `tabIds` (isolation) but don't persist across browser restart. Dynamic rules persist but don't support `tabIds`. Use session rules for active downloads, accept cleanup on restart.
- **Escalation retry target** — retry first segment only? Or first 3 segments? First segment is cheapest but may not be representative.
- **CDN domain extraction completeness** — must extract from: video URL, master playlist, variant playlists, segment URLs, AES key URIs, init segment URIs, audio playlist URIs, subtitle playlist URIs. Missing any = missed domain = 403.
- **Level cache invalidation** — TTL 24h? Or invalidate on any 403 even at cached level? (CDN may change protection level.)

## Real-Site POC: themoviebox.org (2026-06-24)

### Site Analysis

- **Page**: themoviebox.org (Nuxt SPA, served by h5-static.aoneroom.com)
- **API**: h5-api.aoneroom.com/wefeed-h5api-bff/
  - `/detail?subjectId=X&category=movie` → metadata
  - `/media-player/get-domain` → returns stream domain (netfilm.world)
  - `/subject/play?subjectId=X&se=Y&ep=Z&detailPath=slug` → signed MP4 URLs
- **CDN**: bcdnxw.hakunaymatata.com (Tengine, Alibaba OSS)
- **Video URL pattern**: `https://bcdnxw.hakunaymatata.com/resource/{hash}.mp4?sign={sig}&t={expiry}`
- **Token**: `sign` = HMAC, `t` = Unix timestamp expiry (~90s TTL)

### 403 Reproduction Tests

| Test | Origin | Referer | sign | t (expiry) | Response |
|---|---|---|---|---|---|
| 1 | themoviebox.org | themoviebox.org | valid | valid | ✅ 200 OK |
| 2 | (none) | themoviebox.org | valid | valid | ✅ 200 OK |
| 3 | themoviebox.org | (none) | valid | valid | ❌ 403 |
| 4 | chrome-extension:// | themoviebox.org | valid | valid | ✅ 200 OK |
| 5 | (none) | google.com | valid | valid | ❌ 403 |
| 6 | (none) | netfilm.world | valid | valid | ✅ 200 OK |
| 7 | (none) | themoviebox.org | valid | **1 (expired)** | ❌ 403 |
| 8 | (none) | themoviebox.org | **none** | none | ❌ 403 |
| 9 | (none) | themoviebox.org | **wrong** | valid | ❌ 403 |

### Key Findings

1. **CDN checks Referer whitelist** — themoviebox.org, netfilm.world accepted; google.com, empty rejected
2. **CDN does NOT check Origin** — chrome-extension:// Origin accepted if Referer is valid
3. **CDN checks signed URL token** — `sign` must be valid HMAC, `t` must be > current time
4. **Token TTL ~90 seconds** — `t` = now + ~90s. If user clicks download after 90s → 403
5. **Referer is necessary, token is the real gate** — both must be valid

### Root Cause of 403 in Extension

**NOT missing Referer** (extension already sets it via `buildFetchHeaders`).

**Root cause: signed URL token expired.**

```
Timeline:
  T+0s:   Page loads → API returns signed URL with t=now+90s
  T+0s:   Extension detects video URL via webRequest
  T+90s:  Token expires
  T+120s: User clicks download → fetch signed URL → 403 (token expired)
```

### Fix for themoviebox.org

This site needs **Token Refresh on 403** (Nhóm 3 fix), NOT DNR header override.

```
On 403:
  1. Re-fetch page → find API call that generated signed URL
  2. OR: Re-call API endpoint (h5-api.aoneroom.com/subject/play) → get fresh signed URL
  3. Re-download with fresh URL
```

**Challenge**: Extension doesn't know which API endpoint generated the URL. Options:
- A) Re-detect video URL from tab (re-trigger webRequest listener) — requires tab still open
- B) Parse API calls from page's network requests — complex
- C) Re-execute page's play function via chrome.scripting — fragile

### Revised Site Classification

themoviebox.org is **NOT Nhóm 1 (Referer only)**. It is **Nhóm 3 (Signed URL) + Nhóm 1 (Referer)**:
- Referer: necessary (extension already handles)
- Signed URL token: the real 403 cause — needs token refresh

### Impact on DNR Plan

themoviebox.org does NOT need DNR at all. It needs:
1. ✅ Referer header (already have via `buildFetchHeaders`)
2. ❌ Token refresh on 403 (NOT implemented yet)

**This validates the CTO's concern: "403 ≠ missing header."** The 403 here is token expiry, not header missing. DNR header override would NOT fix this site.

## Real-Site POC: kisskh.co (2026-06-24)

### Site Analysis

- **Page**: kisskh.co (Angular SPA, Cloudflare-protected)
- **API**: `kisskh.co/api/DramaList/Drama/{id}` → episode list
- **Video URL**: `https://hls03.videodelivery2.site/{id}/{title}.mp4?ip={ip}&verify={token}`
- **CDN**: hls03.videodelivery2.site (Cloudflare, no CORS headers)
- **Subtitle CDN**: sub.cdnvideo11.shop

### 403 Reproduction Tests

| Test | Context | Referer | credentials | Response |
|---|---|---|---|---|
| 1 | Page fetch | (auto) | default | ❌ CORS block (no ACAO header) |
| 2 | Page fetch | (auto) | include | ❌ CORS block |
| 3 | Page fetch | (auto) | same-origin | ❌ CORS block |
| 4 | Page fetch | no-referrer | default | ❌ CORS block |
| 5 | curl, no Referer | (none) | n/a | ✅ 200 OK |
| 6 | curl, kisskh Referer | kisskh.co | n/a | ✅ 200 OK |
| 7 | curl, google Referer | google.com | n/a | ❌ 403 |
| 8 | curl, ext Origin + kisskh Referer | kisskh.co | n/a | ✅ 200 OK |

### Key Findings

1. **CDN returns NO CORS headers** — `Access-Control-Allow-Origin` missing entirely
2. **Page context fetch = CORS block** — browser blocks because no ACAO header
3. **`<video>` tag works** — media elements are exempt from CORS
4. **CDN checks Referer** — kisskh.co ✅, no Referer ✅, google.com ❌
5. **CDN does NOT check IP param** — `ip=1.1.1.1` still 200 OK
6. **CDN does NOT check verify token** — token seems long-lived (or no expiry check)
7. **Extension SW fetch should work** — `host_permissions: <all_urls>` bypasses CORS for extension SW

### Extension SW vs Page Context

```
Page context fetch (kisskh.co → hls03.videodelivery2.site):
  → Browser checks CORS → CDN returns no ACAO → BLOCK

Extension SW fetch (chrome-extension:// → hls03.videodelivery2.site):
  → Extension has host_permissions: <all_urls>
  → Browser BYPASSES CORS for extension SW with host permissions
  → CDN returns 200 OK (Referer set by buildFetchHeaders)
  → ✅ Works
```

### Conclusion for kisskh.co

Extension SW fetch **should work** because:
1. `host_permissions: <all_urls>` → CORS bypass for extension SW
2. `buildFetchHeaders(tabUrl)` → sets Referer = kisskh.co → CDN accepts
3. `credentials: 'same-origin'` (just fixed) → no CORS credentials conflict

**No DNR needed. No token refresh needed. Extension should already work after credentials fix.**

### Cross-Site Comparison

| Site | CDN CORS | CDN Auth | credentials fix needed? | DNR needed? | Token refresh needed? |
|---|---|---|---|---|---|
| themoviebox.org | `ACAO: *` | Referer + signed URL | ✅ Yes (just fixed) | No | Maybe (token TTL ~90s but CDN doesn't check) |
| kisskh.co | No CORS headers | Referer only | No (already same-origin) | No | No |

### Key Insight: Extension SW CORS Bypass

The biggest realization from this POC: **extension SW with `host_permissions` bypasses CORS entirely**. The CORS blocks we see in page context (Playwright) do NOT apply to extension SW fetch. This means:

1. Sites that fail in page context fetch (CORS block) **may work fine in extension SW**
2. Testing with Playwright (page context) gives **false negatives** for extension capability
3. The real test is: does the extension actually work when installed?

### Revised Testing Strategy

- Playwright MCP: good for discovering API endpoints, video URLs, auth patterns
- Playwright MCP: **NOT reliable** for testing extension fetch behavior (different CORS context)
- curl: good for testing CDN auth (Referer, Origin, token) without CORS interference
- Real extension test: only reliable way to verify extension SW fetch works
