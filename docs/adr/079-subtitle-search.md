# ADR: Subtitle Search (SubDL + OpenSubtitles)

**Date:** 2026-08-13
**Status:** Accepted
**Spec:** `docs/specs/subtitle-search.md`

## Context

Cell detects and loads subtitles from the current page (inbound discovery). Users watching content without subtitles — or wanting a better translation — have no outbound path. We need search + download from external subtitle providers (SubDL, OpenSubtitles) inside the Subtitle Manager Panel, with multi-key free-tier quota management.

Both providers offer free tiers with per-key daily download quotas. Users who register multiple free accounts can multiply their quota — but only if the extension rotates keys correctly and tracks remaining downloads per key.

## Decisions

### 1. Client-only API keys — no bundled key

The extension ships **without** any API key. Users add their own keys in Settings.

**Why:** A bundled key is a shared resource — one user's heavy usage exhausts quota for everyone, and a single abuse report revokes it for all users. Client-owned keys make each user responsible for their own quota. This also avoids the extension author becoming a quota gatekeeper or having to rotate/monitor a shared key. Free-tier registration on both providers is open and takes minutes.

### 2. SubDL-first, OpenSubtitles fallback

Provider order is SubDL → OpenSubtitles. OpenSubtitles is tried only when SubDL returns zero results or all SubDL keys are exhausted.

**Why:** SubDL is free with a larger catalog for Asian content (drama, anime, series) which is the primary persona (10–25 age, learning foreign languages). SubDL download is a direct GET — no handshake, no temp link — so the download path is simpler and less failure-prone. OpenSubtitles has a 2-step POST handshake with single-use temp links and a strict 5 req/s rate limit, making it a heavier fallback. SubDL-first minimizes handshake complexity on the happy path.

### 3. Background owns all network — content-script never fetches

All SubDL/OpenSubtitles API calls live in the background service worker via `offscreenFetch`. Content-script sends `SEARCH_SUBTITLES` / `RESOLVE_SUBTITLE_DOWNLOAD` messages and receives parsed text.

**Why:** Content-script `fetch()` to these APIs fails CORS (no `Access-Control-Allow-Origin` for extension origins). Even if it didn't, fetching from content-script exposes API keys to page scripts via DevTools Network tab and prototype-polluted `fetch`. Background SW fetch keeps keys in the extension process. MV3 SW idle eviction is handled by the existing `offscreenFetch` pattern (offscreen document persists for fetch duration). This also centralizes key-ledger mutations in a single-threaded event loop — concurrent tabs can't clobber each other's quota updates.

### 4. Quota ledger in `chrome.storage.session` — not in Settings

Per-key quota state (`remainingDownloads`, `resetAt`, `lastDownloadAt`) lives in `chrome.storage.session`, mutated only by the background SW. Settings stores only the key list (`subtitleApiKeys` with `status` + `rateLimitedUntil`).

**Why:** `chrome.storage.local` (where Settings live) syncs across profiles via the extension's storage — quota state is per-session and must not leak across profiles or persist across browser restarts (quotas reset daily). `chrome.storage.session` is per-profile, in-memory, not synced. Concurrent tabs issuing downloads would race on read-modify-write if the ledger lived in content-script-accessible storage; the background SW's single-threaded event loop serializes mutations, so session storage + SW ownership is the correct concurrency model.

### 5. Rotate keys at download, not at search

Round-robin key selection increments the cursor only when a download is resolved, not when a search is performed.

**Why:** Download is the quota-binding action — both providers count downloads (OpenSubtitles: 100/day verified; SubDL: per-key daily limit). Search is cheap or free on both providers. Rotating at search would burn through the cursor without consuming quota, causing the download path to pick a key that was "rotated to" by an unrelated search. Rotating at download ensures the cursor always points to the key with the oldest `lastDownloadAt`, maximizing even distribution of download load across keys.

### 6. No validate-on-add — mark `unverified` → `active` on first 200

When a user adds a key, it is stored with status `unverified`. No test search or download is performed. On the first successful (HTTP 200) API response using that key, status transitions to `active`.

**Why:** Validating on add by issuing a test search/download consumes quota — and if the provider returns 429 (rate-limited) during validation, the key is bricked before the user ever uses it. The `unverified` state is visually distinct (gray badge) but functionally identical to `active` for key selection — the first real user-initiated request serves as validation. This avoids wasting quota on synthetic checks and avoids bricking keys on transient rate limits.

### 7. Discriminated union for download — `direct` vs `handshake`

`SubtitleDownloadKind` is a discriminated union: `{ kind: 'direct'; url: string }` (SubDL) or `{ kind: 'handshake'; fileId: string }` (OpenSubtitles), not a flat `downloadUrl: string`.

**Why:** SubDL download is a single GET to a direct URL. OpenSubtitles download is a 2-step POST handshake that returns a single-use temp link, then a GET to that link. These are fundamentally different network flows — different methods, different auth, different retry semantics, different quota-counting points (SubDL counts on GET; OpenSubtitles counts on POST). A flat `downloadUrl` would force the download handler to branch on `source` with string checks, hiding the structural difference behind a lie. The discriminated union makes the type system enforce that each provider provides the right download shape, and the background handler switches on `kind` with exhaustiveness checking.

### 8. Provider registry interface — not hardcoded `if`

Providers implement a `SubtitleSearchProvider` interface (`normalizeSearch`, `buildSearchRequest`, `buildDownloadRequest`, `decodeDownload`). A `PROVIDERS` registry maps provider id → implementation. `searchSubtitles` and the background handler iterate the registry, not hardcoded `if (source === 'subdl')` branches.

**Why:** Adding a future provider (e.g. Addic7ed, Podnapisi) should require adding one object to the registry — not modifying `searchSubtitles`, the download handler, the key picker, or the UI result renderer. The registry interface also makes each provider independently testable: unit tests call `normalizeSearch(rawJson, query)` with fixture JSON and assert on the output, without any network or Chrome API. Hardcoded `if` branches would couple every provider to every call site, making the code progressively harder to change as providers are added.

## Consequences

- Users must register their own free API keys — no zero-config search. The Manager Panel shows a collapsed hint + Settings link when no key is present.
- Background SW is the single owner of key state; content-script is thin (send query, receive text). This adds 2 new message types but keeps the existing `offscreenFetch` + DNR patterns.
- `chrome.storage.session` ledger means quota state resets on browser restart — acceptable since provider quotas also reset daily at midnight UTC.
- Schema migration v20 → v21 adds `subtitleApiKeys: []` to Settings.
- New providers can be added without touching `searchSubtitles` or the download handler — only the registry and (optionally) the UI status-badge set.
