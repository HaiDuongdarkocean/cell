# ADR: Session Recap — append-only session-events store + read-time join

**Date:** 2026-10-03
**Status:** Accepted

## Context

The Session Recap feature (`docs/specs/session-recap.md`) shows per-session immersion metrics (lookups, word-status marks, coverage) in a new Universal Panel Recap tab. `HistoryRecord` already records watch segments, but lookups and status marks were never persisted in production (`lookupLogStore` is dev-only), and `HistoryRecord` has no room for per-term events without a schema rewrite that would churn every existing consumer.

## Decision

### 1. Dedicated append-only store, not a HistoryRecord rewrite

IDB `orca-local-player` bumps v3 → v4 with a new `sessionEvents` store (`keyPath: 'id'`, index `by_at`, 90-day retention via lazy prune on recap read). Events carry `{ id, at, tabId, surface: 'stream'|'local-player'|'other', kind: 'lookup'|'status', term, langCode?, status?, pos? }`. `HistoryRecord` stays untouched — sessions are *composed at read time* by joining events into session windows, so the two stores can never diverge on a shared row.

### 2. Capture at the MessageBus dispatch seam, not inside handlers

`ctx.on` handlers see only the Zod-parsed request — `sender` is dropped and `payload.tabId` is stripped when the schema omits it. `MessageBus.addTap()` registers post-dispatch observers that run after the handler resolves with `{request, sender, response}` intact. Tap exceptions are swallowed; event writes are fire-and-forget with one retry — a capture failure can never fail the original lookup/status response.

### 3. `origin: 'immersion'` marker distinguishes real immersion lookups

`LOOKUP_REQUEST` is emitted by card generation, panel dictionary search, vocabulary re-lookups and prefetches — none of which are immersion. The dictionary popup dispatch now sends `origin: 'immersion'` (optional Zod literal); the tap records lookups only when both the marker is present and `response.success`. Recap-triggered re-lookups (`openDictionaryLookup`) deliberately omit the marker, preventing self-attribution.

### 4. Status capture is user-marks only

`WORD_STATUS_SET` and `WORD_STATUS_CYCLE` emit events (cycle resolves the resulting status from `response.data.status`). Trash/restore/delete and sync/Anki writes bypass the user handler and are never captured.

### 5. Read-time join + bounded derivation for legacy data

`GET_SESSION_RECAP` composes recaps per query: `HistoryRecord[]` groups into sessions by same-videoId + ≤15 min gap; events join by tabId (stream records embed `stream-<tabId>-*`) or unique window overlap, dropping multi-overlap attributions. Sessions older than the feature's existence (≤30 days) derive status changes from `getAllWordStatuses(lang)` entries with `source:'user'` + `sourceAt`/`updatedAt` inside the window, flagged `derived: true`; no fabricated lookup counts. Language DBs are enumerated via `indexedDB.databases()` filtered on the `orca-dict-` prefix.

### 6. Version-contention handling

The local-player page can hold a v3 connection while the service worker requests v4. `db.onversionchange` now closes and clears the cached connection so upgrades are never blocked by a stale tab.

## Consequences

- No migration of existing history; recap composes over what already exists.
- Event volume is tiny (a lookup/status per user gesture); 90-day retention bounds growth.
- Offline-first: everything lives in extension-local IDB; nothing is synced or sent off-device.
- Recap reads cost one IDB scan + in-memory join (<500ms p95 target).
