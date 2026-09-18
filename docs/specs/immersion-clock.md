# Spec — `immersion-clock`

> Status: r1 (spec-review round 1 applied — 1 Blocker + 5 Majors resolved) · Backlog #7 · Cost M · Intent: `docs/intent/immersion-clock.md`
> Pain: "Không biết đã nạp bao nhiêu giờ input — không có roadmap level→fluency"

## 1. Summary

Cell gains an **immersion clock**: real watch time is recorded on both surfaces — local player, and streaming sites **while Cell has cues for that tab** (comprehensible-input session) — persisted in the existing `history` IDB store, and surfaced as a stats card at the top of the local-player `LibraryView`: total input hours, last-7-days hours, day streak, and progress along the Dreaming-Spanish-style level ladder (0/50/150/300/600/1000/1500 h → Level 1–7).

## 2. Data model

Reuse `HistoryRecord` in `orca-local-player` (`history` store, DB version **2 — no bump**):

```ts
{ id, videoId, watchedAt, watchDurationMs, positionMs }
```

- **Local sessions**: one record per video-open session.
  `id = watch-<videoId>-<sessionStartMs>`, `videoId` = real video id.
- **Streaming sessions**: one record per tab-session.
  `id = stream-<tabId>-<sessionStartMs>`, `videoId = 'stream:<hostname>'`.
- `watchedAt` = segment start ISO · `positionMs` = last `currentTime` · `watchDurationMs` = accumulated wall-clock ms, growing via `addHistoryEntry` upsert (same `id` → `put` overwrite, never duplicates).
- **Source discrimination uses the record-id prefix** (`stream-` vs `watch-`), NOT `videoId` — a local file can legitimately be named `stream:*`. `videoId='stream:<host>'` remains for future per-site display only.
- Zero-duration open events (`addWatchHistoryEntry`, `LOCAL_PLAYER_VIDEO_OPENED`) keep `watchDurationMs: 0` — contribute nothing, need no change.

## 3. Counting semantics (shared)

- **Wall-clock, not video-time** (DS semantics). Playback rate does not inflate the clock.
- `accumulateDelta(acc, lastEventAt, now)` → `acc + clamp(now − lastEventAt, 0, MAX_SESSION_GAP_MS)` where `MAX_SESSION_GAP_MS = 2000` — normal ~250 ms cadence passes; delivery gaps/SW-wake can't inject phantom time; backwards clock jumps clamp to 0.
- **First event of a segment sets `lastEventAt = now`, delta = 0** — a segment starts accruing from its second event onward (~250 ms quantization loss, negligible).
- **Only events while playing count.** `timeupdate` *does* fire on seek-while-paused on both surfaces — suppression is explicit:
  - Local: drop accumulation when `video.paused` at event time.
  - Streaming: `VIDEO_TIME_UPDATE` carries `isPlaying: !video.paused` (ground truth at emit time). `isPlaying: false` → drop + close segment. `isPlaying: true` → count even with no prior `play` event — required because the controller only wires `play`/`pause` *event* listeners (no initial-state sync), so autoplay-before-attach tabs never emit `play`. Payloads without the field fall back to the explicit play-state map (absent = assume playing; explicit pause drops updates).
- Pauses cost nothing: no events arrive → no accumulation.

## 4. Pure core — `features/local-player/logic/immersionClock.ts`

```ts
export const IMMERSION_MILESTONES_H = [0, 50, 150, 300, 600, 1000, 1500] as const;
export const MAX_SESSION_GAP_MS = 2000;
export const FLUSH_INTERVAL_MS = 15_000;
export const SESSION_IDLE_MS = 30_000;

export function accumulateDelta(acc: number, lastEventAt: number, now: number): number;

export function levelForHours(hours: number): {
  level: number; floorH: number; nextH: number | null; progress: number; // progress 0..1 within band
};

export type ImmersionSummary = {
  totalMs: number;
  last7dMs: number;        // rolling last 7×24h
  todayMs: number;
  streakDays: number;
  bySource: { localMs: number; streamMs: number };
};

export function aggregateHistory(records: HistoryRecord[], now: Date): ImmersionSummary;
```

- **Day bucketing splits each record's span `[watchedAt, watchedAt + watchDurationMs]` across local-midnight boundaries** (O(span-days) per record, still O(n) total) — a 23:30→00:30 session credits both days; without this, late-night watchers get phantom streak breaks.
- Day keys use local timezone (`toDateString` basis), not UTC — streaks must match user perception.
- `streakDays`: consecutive local-calendar days with `ms > 0`, counting back from today **or** yesterday (a today-not-yet-watched doesn't break the streak).
- Source split: `id.startsWith('stream-')` → stream; else local.

## 5. Streaming tracker — `entrypoints/background/helpers/immersionTracker.ts`

```ts
export function createImmersionTracker(deps: {
  addEntry: (r: HistoryRecord) => Promise<void>;
  getHost: (tabId: number) => Promise<string | null>;
  hasSession: (tabId: number) => boolean;   // wired to ctx.lastCuesByTab.has
  now?: () => number;
}): {
  noteTimeUpdate(tabId: number, currentTimeMs: number, isPlaying?: boolean): void;
  notePlayState(tabId: number, isPlaying: boolean): void;
  closeTab(tabId: number): void;
};
```

- **Session gate**: `noteTimeUpdate`/`notePlayState` no-op unless `hasSession(tabId)` — `ctx.lastCuesByTab` is populated by `SUBTITLE_CUES_LOADED` and cleared on episode change/tab close, so counting = "playing while Cell cues exist for the tab" (CI-session proxy). Accepted hole: SW restart empties the map → undercounts until cues reload — fail-closed, documented.
- **`SUBTITLE_CUES_LOADED` broadcast-on-load fix (required for the gate to work at all)**: previously `broadcastCues` only ran on generate-native, manager-track-switch, and visibility/episode re-sends — the dominant auto-load path (`onCuesUpdated` → `subtitleTokenizeCtrl.setCues`) never broadcast, so `lastCuesByTab` stayed empty on exactly the pages the tracker targets (verified in smoke: panel full of cues, map empty). Fix: `onCuesUpdated` broadcasts `mergeCuesForPanel(target, native)` whenever the cue-list identity changes (`cuesReloaded` gate — active-index changes don't re-send). Empty merged list → background handler `delete`s the tab entry so deselecting tracks ends the session. Bonus: the side panel's initial cue sync now works without the pull fallback.
- `noteTimeUpdate(tabId, currentTimeMs, isPlaying?)`: a defined `isPlaying` first syncs the tab's play-state map (ground truth at emit time — `false` closes the segment and drops the event; `true` unblocks counting for autoplay-before-attach tabs). Then: dropped when last play-state is paused; first event opens segment `{sessionStartMs, lastEventAt=now, acc=0, hostPromise}`; subsequent events `acc += accumulateDelta`.
- **Flush**: when `acc − flushedAcc ≥ FLUSH_INTERVAL_MS` → upsert segment record (`id = stream-<tabId>-<sessionStartMs>`), `flushedAcc = acc`.
- **Lifecycle**: `notePlayState(false)` or `closeTab` → **close segment**: final upsert iff `acc > 0` (any real watch time is honest data — sub-15 s segments still write, once), then delete. `notePlayState(true)` after a close → **new segment id** (no resume path — eliminates phantom-gap bookkeeping). Quantified bound: never undercounts beyond the ≤250 ms first-event quantization.
- **Idle auto-close**: an event arriving `> SESSION_IDLE_MS` after `lastEventAt` closes the prior segment first (final upsert), then opens a new one — covers video-end without pause event.
- Host: resolved once per segment via `getHost(tabId)` (memoized `Map<tabId, host>`, cleared on close); failure → `'web'`. Bound: top-frame host — iframe-embedded players record the embed page (upgrade path: inject `sender.url` at bus level; deferred).
- **Fail-closed**: `addEntry` rejection → keep accumulating (next flush retries). SW suspend loses ≤ `FLUSH_INTERVAL_MS` — `chrome.runtime.onSuspend` is unreliable in MV3 and is not relied on; this is the real bound.
- Multi-frame tabs: state is per-tabId, and `lastEventAt` naturally dedupes interleaved frames — the last writer's clock wins each gap; cannot double-count.

### Wiring — inside `sidePanelRelay.ts` (message handlers are 1-per-type via `ctx.on` Map)

In the existing `VIDEO_TIME_UPDATE` / `VIDEO_PLAY_STATE` handlers, after zod parse and **before** the `activeTabIdForPanel` early-return (immersion counts every cued tab, not just the panel tab):

```ts
if (payload.tabId !== undefined) tracker.noteTimeUpdate(payload.tabId, payload.currentTimeMs, payload.isPlaying);
if (payload.tabId !== undefined) tracker.notePlayState(payload.tabId, payload.isPlaying);
```

`payload.tabId` is sender-resolved by `messageBus` (sender wins over caller-supplied). Tracker singleton constructed at handler-registration site with `hasSession: (id) => ctx.lastCuesByTab.has(id)`, `getHost` via existing `getTab` → `new URL(tab.url).hostname`, `addEntry: addHistoryEntry`. `closeTab` wired to the existing `tabs.onRemoved` listener in `wireEvents.ts` (which already clears `lastCuesByTab`).

## 6. Local-player tracking — `entrypoints/local-player/hooks/useImmersionSession.ts`

Mounted while a video is loaded (`currentVideo` + `videoRef`):

- Attaches to `videoRef.current` `timeupdate` (native ~4 fps while playing — no new timers); re-binds when the element remounts (video element is conditionally rendered — mirror `useLocalVideo`'s rebind-on-identity-change pattern).
- Drop accumulation when `video.paused` (seek events); `acc += accumulateDelta` otherwise.
- Segment `id = watch-<videoId>-<sessionStartMs>`; flush at `acc − flushedAcc ≥ FLUSH_INTERVAL_MS`; `pause`/`ended`/unmount → final upsert iff `acc > 0`, close.
- `positionMs = video.currentTime * 1000`; `watchedAt` = segment start.
- Shares `accumulateDelta` + constants with the streaming tracker — single semantics.

## 7. UI — `ImmersionStats` card in `LibraryView`

`entrypoints/local-player/components/ImmersionStats.tsx` + `.module.css`.

**Mount**: rendered unconditionally as the first child of `styles.root` — *above* the `videos.length === 0 ? EmptyState : list` ternary (new/streaming-only users with an empty library must still see the clock). `LibraryView` renders inside a narrow Split View panel — layout is a compact vertical card, not a wide strip.

**Freshness**: `getHistory()` → `aggregateHistory` → `levelForHours`, fetched on mount only — `Tabs.Content` unmounts inactive tabs, so every playlist open remounts with fresh data. No polling.

```
┌──────────────────────────────┐
│ ⏱ 142.5 h input · 6.2 h last 7 days · 9-day streak │
│ Level 3  ▓▓▓▓▓▓░░░░░  7.5 h to Level 4             │
└──────────────────────────────┘
```

- `role="progressbar"` with `aria-valuenow`=hours, `aria-valuemin`=floorH, `aria-valuemax`=nextH + `VisuallyHidden` text; top level renders "Level 7 · max" with a full bar.
- `bySource` split as `title` tooltip on the total ("local 40.2 h · streaming 102.3 h").
- Empty (0 h): card renders zeroed values — the clock starts at zero, it does not hide.
- Icons: `clock` exists in `ICON_CATALOG`; no `flame` → streak is text ("9-day streak"), no icon.
- i18n keys `immersion.*` (en + vi): `total`, `last7d`, `streakDays`, `level`, `hoursToNext`, `maxLevel`, `sources`.
- `tokens.css` vars + shared `Card`; no hardcoded colors.

## 8. Contracts

- **`VideoTimeUpdatePayloadSchema` loses `.int()`** on `currentTimeMs`/`durationMs`/`offsetMs` → `z.number()`. The only sender emits `video.currentTime * 1000` (float); `.int()` makes `safeParse` fail → handler never runs. This is also a **pre-existing production bug fix**: the side-panel time relay has been silently dead since the schema landed. Sender stays unchanged (sub-ms noise is fine).
- **`VideoTimeUpdatePayloadSchema` gains `isPlaying: z.boolean().optional()`** and the sender emits `isPlaying: !video.paused`. Ground truth at emit time kills two edge cases at once: paused-scrub timeupdates are dropped, and autoplay-before-attach tabs (which never emit a `play` event) still count. Older senders fall back to the play-state map.
- `HistoryRecord`/`history` store unchanged — no IDB bump, no manifest change, no new message types.
- `GET_HISTORY` has no in-repo consumers today; `stream-`/`watch-` ids and `stream:<host>` videoIds are documented so a future join knows the sentinel.
- Existing zero-duration entries untouched; scoring/comprehension features untouched.

## 9. Edge cases

- Seek/replay while playing: wall-time keeps counting — correct.
- Seek while paused: suppressed by explicit paused check (see §3).
- 2×+ playback: still wall-time — documented semantics.
- SPA episode switch: cues map cleared → tracking pauses; new cues → resumes. Same-tab segment may span an episode — host unchanged, acceptable.
- SW suspend mid-session: ≤15 s unflushed lost (real bound, not `onSuspend`-dependent).
- Tab close mid-session: `tabs.onRemoved` → `closeTab` → final upsert.
- Clock skew: negative deltas clamp to 0.
- Two records same-ms start: impossible — id contains tabId/videoId + startMs.

## 10. Testing

`immersionClock.test.ts` (pure): delta capping (first-event=0, negative, >2 s gap), level boundaries (0→L1, 49.9→L1, 50→L2, 1500→L7 `nextH:null`), aggregation (local-TZ buckets, **cross-midnight span split**, rolling-7d window, streak from today-empty vs yesterday-start, `stream-` id-prefix source split, `stream:*`-named local file stays local).

`immersionTracker.test.ts` (fake timers + injected deps): gated-out tab records nothing; segment open/upsert same id; flush at ≥15 s; pause closes + writes sub-15 s acc; resume = new segment id; paused-scrub timeupdate ignored; idle auto-close; `closeTab` finalizes; host fallback `'web'`; `addEntry` rejection keeps accumulating.

`useImmersionSession.test.ts`: timeupdate accumulates only while playing; pause/ended/unmount final-upsert iff acc>0; rebind on element remount; record id/shape.

Schema test: float `currentTimeMs` passes `VideoTimeUpdatePayloadSchema` (regression for the dead-relay fix).

`sidePanelRelay` tests: tracker observe calls fire before the `activeTabIdForPanel` early-return (spy).

`ImmersionStats.test.tsx` + `LibraryView.test.tsx`: renders on empty library (above EmptyState), hours/streak/level, progressbar aria attrs, zeroed state, i18n keys.

Real-Chrome smoke (`tmp/immersion-clock/smoke.mjs`): local-player drop video+srt → real playback ~20 s → stats card shows >0 total + level; mock streaming page with Cell subtitles → play ~20 s → `stream` source grows; reload → totals persist; side-panel time relay verified alive (schema fix).

## 11. Non-goals

- Counting tabs where Cell has no cues (raw playback ≠ CI session) — gate is deliberate.
- Calendar heatmap, per-video totals UI, manual time entry, cross-device sync.
- Comprehension-weighted hours — future item.
- Pill/overlay surface on streaming sites; per-site breakdown UI (`stream:<host>` is stored, not yet rendered).

## 12. Alternatives considered

- **New `IMMERSION_*` message type from content script** — rejected: `ctx.on` is one-handler-per-type so we'd need new emit points in `contentScriptController` for zero new information; `VIDEO_TIME_UPDATE`/`PLAY_STATE` already carry everything.
- **Separate `immersion` IDB store** — rejected: `history` is already a session ledger with the right shape; prefix discrimination is enough; avoids a version bump.
- **Count any playing video (no cues gate)** — rejected: contradicts the CI-session definition and inflates with ads/random video.
- **`chrome.runtime.onSuspend` keepalive/flush** — rejected: unreliable in MV3; the ≤15 s flush bound is honest and cheap.
