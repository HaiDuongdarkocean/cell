# Intent: Sync on use — push on write, check-a-bell on user action

> Slug: `sync-on-use` · Mode: interactive · Source: user statement (session 2026-09-29: "tốc độ sync phải gần như realtime ≤3s … mà vẫn đảm bảo hiệu năng và giảm tải", "pay as you go", "xoáy sâu vào giảm số request") + `docs/audits/20260928_sync-drive-efficiency.md` F1/F3
> ui_surface: no
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | A word-status change made on one browser (Brave/Chrome/Firefox) is not visible on the user's other browsers for up to ~10 minutes, and an already-open vocabulary/tokenize surface on a web page never refreshes after sync applies — the user sees contradicting states across devices and cannot trust sync | IDB writes only append to `syncOutbox` (`capture.ts:160-184`), no scheduler trigger — only chrome.storage KV keys are debounced (`handlers/sync.ts:279-280`, `settingsRegistry.ts:128-136`); push+pull only on the 5-min alarm (`handlers/sync.ts:38,274`); `SYNC_DATA_APPLIED` is sent with `runtime.sendMessage` (`messageBus.ts:117-119`) which never reaches content scripts, where the relay listens (`wordStatusCrossTab.ts:17-25`, `content-script.ts:34`) | high |
| Change | Timer-driven heavy full cycles (~20 Drive list calls each, ≤10 min end-to-end, UI never refreshed) → local writes pushed within ~1.5s; remote changes detected by one cheap bell probe triggered by the user's own word-status actions; open surfaces refresh when data lands | per-list quota 100 units vs `files.get` 5 units (Drive usage limits page); request shapes `googleDriveStorageProvider.ts:288-326,644-657,767-823` | medium |
| Solution | Event-driven sync: push-on-write fast path, a shared "bell" file whose version bumps on every push, a throttled bell probe fired by qualifying user actions, a pull fast path limited to local scopes, fan-out of applied data to tabs; heavy full cycle kept as a slower safety net | user decisions in session (option 1: every qualifying action probes, throttled; idle machine does nothing) | medium |
| Value | Anh (and every multi-browser learner) sees the same word states everywhere within seconds of acting, while Drive quota and battery use drop because an idle machine makes zero requests and detection costs 5 units instead of a full cycle | user statement; Drive daily billing threshold 400M units/project | medium |
| Stakeholder | Multi-device/multi-browser learners (Chrome, Brave, Firefox desktop + Android) | user runs Brave + Chrome side by side (screenshot GXtS541MRb.png) and Firefox | high |
| Context | MV3 extension, no own server; Drive `drive.file` scope; Chrome SW idles after 30s, Firefox event page never unloads while a port is open; OAuth implicit flow, 1h tokens renewed silently (`googleDriveStorageProvider.ts:420-435`, margin 5 min `:100`) | Chrome SW lifecycle doc; MDN Background scripts | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Em (agent) + Anh | Change the scheduler, engine run modes, provider without regressing sync correctness (cursors, self-heal, GC, rebind) | full sync suite + fakeDrive request log exist (`fakeDrive.ts:65,588`) |
| Customer | Learners on several browsers | Consistent word states quickly; no battery/data drain | persona: RAM ≥1GB, weak networks, Firefox Android |
| Supplier/Dependency | Google Drive API, Chrome/Firefox extension runtimes | no push channel to browsers; per-method quota units; list results via search index | `changes.watch` needs an HTTPS server — unavailable |
| Organization | Future maintainers | Engine stays one lock/one state machine; full cycle remains the correctness backstop | SyncEngine coalescing precedent (`SyncEngine.ts:154-181`) |
| Regulator | none — same data, same scope, same account | — | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | A local change of any synced IDB data must leave the device within ~1.5s without waiting for a timer | P/R | `capture.ts:160-184` writes outbox only; audit F1 | high |
| N2 | Another device must detect remote changes when its user performs a word-status-related action, at most once per ~3s, and must spend nothing when nobody acts | P/+financial | user decision (option 1 + "máy để yên không sync"); quota table | high |
| N3 | Detection must cost one cheap request when nothing changed; pulling a change must touch only the scopes this device holds, not blobs/meta/tree listings | P/+financial | full cycle shape `SyncEngine.ts:219-570`, `pullCycle.ts:107-186` | medium |
| N4 | A push must not pay repeated remote listings that cannot find anything (existence lookup for a fresh journal, chain re-listing every push) | P | `pushCycle.ts:244-255,317-341`, `chainHealth.ts:31-34`, provider `write` `:339-341` | medium |
| N5 | Every open Tihoka surface (web-page panels, subtitle/web tokenize colors, extension pages) must refresh when synced word data is applied | U/R | `messageBus.ts:117-119` vs `wordStatusCrossTab.ts:17-25` | high |
| N6 | Correctness guarantees stay: cursor contiguity, self-heal, compaction, GC, rebind/disconnect handling — the full cycle remains the backstop | R | `sync-drive-folders` spec REQ-4..8 | high |
| N7 | Works identically on Chrome, Brave, Firefox (desktop + Android) with no keep-alive tricks | S/R | Firefox event page + port semantics (MDN) | medium |

## Scope

- **In:** push-on-write trigger for all IDB capture writers; push fast path (no pull/sweep/markers; fresh journal create; per-lifetime chain-state cache feeding self-heal skip and compaction count); bell signal on the provider port (Google Drive + in-memory + fakeDrive); action-triggered throttled bell probe in background word-status handlers; pull fast path over local scopes with lazy blob index; tabs fan-out of `SYNC_DATA_APPLIED`; full-cycle alarm 5 → 15 min; settings-KV debounce switched to the push fast path.
- **Out:** own push server / FCM / WebSocket; Drive `changes.list` feed; wire-format changes (compact JSON v2); per-term delta payloads (existing per-language reload path is reused); UI changes; SRS/Reader-specific triggers (they sync on push-on-write + safety net).
- **Non-goals:** guaranteed p95 ≤3s (bounded by Drive propagation, unmeasured); realtime on a device where the user does nothing; reducing full-cycle cost (F3/F4) beyond the fast paths.

## Workflow

Brave user marks `tracklisten` as "Đang học". The background writes IDB and the capture layer appends an outbox row; when that transaction commits the capture layer notifies the scheduler. After a 300ms debounce (1.5s cap under bursts) the engine runs a push-only pass: it freezes the pending keys into one journal per scope, creates the journal file directly in its device folder, and bumps the shared bell. Nothing else is listed or read.

On Chrome the user opens the vocabulary tab (or looks up a word, marks a word, opens a new page that tokenizes). The background handler serving that request answers immediately from local data and, in parallel, asks the scheduler for a check. If the last check was under 3s ago the ask is dropped; otherwise the engine reads the bell's version (one request). Unchanged → done. Changed → the engine lists only the device folders of the scopes Chrome holds, downloads the new journals, applies them, and the background fans `SYNC_DATA_APPLIED` out to every tab so the open panel and page colors reload. If the listing shows nothing new (search-index lag) it retries once after 2s. Every 15 minutes, and on startup/connect/online, the existing full cycle still runs and covers markers, blobs, sweeps and self-heal.

## Journey

### AS-IS
1. Anh changes `tracklisten` from "Đã biết" to "Đang học" in the Brave universal panel; IDB and the outbox update, nothing is scheduled.
2. Up to 5 minutes later Brave's alarm fires a full cycle (~20 Drive list calls) and the journal is uploaded.
3. Up to 5 more minutes later Chrome's alarm fires a full cycle and applies the journal to IDB.
4. Chrome's universal panel on the Wikipedia page still shows "Đã biết" because the applied-data broadcast never reaches content scripts.
5. Anh reopens the panel or reloads the page to see the new state — or concludes sync is broken.

### TO-BE
1. Anh changes `tracklisten` in Brave; within ~1.5s Brave pushes one journal and bumps the bell (≈3 requests).
2. Anh switches to Chrome and opens the vocabulary tab (or looks up any word); the panel shows local data instantly while Chrome probes the bell (1 request).
3. The bell changed, so Chrome lists only its scopes' device folders, downloads the new journal and applies it.
4. Chrome fans the applied event out to its tabs; the open panel reloads and `tracklisten` shows "Đang học" — ~2–3s after the action on Chrome.
5. When nobody acts, neither browser probes Drive; the only remaining idle traffic is the scheduled 15-minute safety-net full cycle (3× rarer than today's 5-minute cycle), which keeps markers, blobs and GC correct.

## Stories

- S1: As a multi-browser learner, I want a word-status change to leave my device right away so that my other browsers can pick it up — done when the change is on Drive within ~1.5s without any timer.
- S2: As a multi-browser learner, I want my other browser to catch up the moment I use a vocabulary feature there so that I never act on stale word states — done when a qualifying action on the other browser shows the new state within ~3s.
- S3: As a learner on a weak or metered device, I want sync to cost almost nothing when I'm not using it so that battery, data and quota are preserved — done when an idle browser makes no probe requests (only the 15-minute backstop runs) and an unchanged check costs one cheap request.
- S4: As a learner with a panel already open, I want it to refresh on its own when synced data lands so that I don't reload pages — done when applied word data refreshes every open Tihoka surface.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Drive search index lags a freshly created journal → bell says changed, listing shows nothing | external | change delayed until next action/safety net | one delayed retry (2s); safety-net full cycle 15 min |
| Bell race: another device bumps between our pre-ring probe and our ring → our own-ring bookkeeping absorbs their bump | internal | their change delayed until the next bump or safety net (≤15 min); no data loss | documented bound; full cycle catches |
| Push fast path skips disconnect/route-marker observation | internal | a journal may land in an account disconnected seconds ago, or before a remote rebind is observed | next full cycle sweeps (REQ-6) / observes markers; same class as today's 5-min window |
| Per-lifetime chain cache hides a manual remote deletion until the SW/event page restarts | internal | self-heal delayed to next lifetime or next full cycle (full cycle bypasses the cache) | full cycle always re-verifies |
| Fresh journal create after a failed counter-reset heal creates a same-name twin | internal | equivalent to today's overwrite outcome (pre-existing wedge) | list dedupe newest-wins; compaction removes all copies |
| Silent token renewal blocked (Brave Shields / Firefox ETP) | external | checks fail → `needs-reauth` hourly | UI never awaits sync; surfaced status; real-device check at sign-off |
| First-page detection keyed on tab navigation misfires in iframes/SPAs | internal | extra or missing probe (throttled to ≥3s) | cheap either way |

## Decision

go — root causes verified in code (no push trigger for IDB writes, timer-only pull, broadcast never reaches content scripts); solution stays inside the existing engine/provider seams, removes idle load, and keeps the full cycle as correctness backstop.

## Draft Acceptance Criteria

- [ ] A committed IDB capture write triggers a push within ≤1.5s (debounce 300ms, cap 1.5s) with no alarm involved
- [ ] A push fast pass with an empty outbox makes zero Drive requests; a steady-state single-journal push on a warm provider instance makes 3 Drive API calls (probe, create, bell bump)
- [ ] A qualifying word-status action triggers at most one bell probe per 3s; an unchanged bell costs exactly one Drive request
- [ ] A changed bell pulls only local scopes' device folders — no blobs/meta/tree listings unless an applied record references a missing blob
- [ ] Applied word data reaches content scripts in every tab; the open vocabulary panel reloads
- [ ] Passive rendering (cue changes, preloading, scrolling in the same page) never probes
- [ ] Full cycle every 15 min + startup/connect/online still runs unchanged; full sync suite green
- [ ] Gates: typecheck, lint, test:unit, build
