# Plan — `immersion-clock`

> Spec: `docs/specs/immersion-clock.md` (r1, APPROVE WITH CHANGES applied) · Backlog: #7 · Cost: M
> Strategy: pure core → trackers (local + streaming) → UI → gates+smoke+ship

## T1 — Schema fix + pure core (TDD)

- [x] `entities/message/schema.ts`: `VideoTimeUpdatePayloadSchema` — `.int()` → `z.number()` on `currentTimeMs`/`durationMs`/`offsetMs` (fixes pre-existing dead side-panel relay + feeds tracker).
- [x] `features/local-player/logic/immersionClock.ts`: `IMMERSION_MILESTONES_H`, `MAX_SESSION_GAP_MS`, `FLUSH_INTERVAL_MS`, `SESSION_IDLE_MS`, `accumulateDelta`, `levelForHours`, `aggregateHistory` (cross-midnight span split, local-TZ day keys, streak today-or-yesterday, `stream-`/`watch-` id-prefix source split).
- [x] `immersionClock.test.ts`: per spec §10 (boundaries, cross-midnight, streak, source split, `stream:*`-named local file).
- [x] Schema test: float `currentTimeMs` passes `VideoTimeUpdatePayloadSchema`.
- Verify: `npx jest src/features/local-player/logic/immersionClock.test.ts` + schema suite.

## T2 — Local tracker `useImmersionSession`

- [x] `entrypoints/local-player/hooks/useImmersionSession.ts`: bind `videoRef.current` `timeupdate` (+rebind on element remount, mirror `useLocalVideo` pattern); skip when `video.paused`; `acc` via `accumulateDelta`; flush ≥15 s; `pause`/`ended`/unmount → final upsert iff `acc>0`; record `watch-<videoId>-<start>` (`positionMs`, `watchedAt`); mounted in `main.tsx`/`PlayerView` while `currentVideo` set.
- [x] `useImmersionSession.test.ts`: accumulate-playing-only, final-upsert-on-close, rebind, id/shape.
- Verify: `npx jest src/entrypoints/local-player/hooks/useImmersionSession.test.ts`

## T3 — Streaming tracker + wiring

- [x] `entrypoints/background/helpers/immersionTracker.ts`: `createImmersionTracker({addEntry, getHost, hasSession, now?})` → `{noteTimeUpdate, notePlayState, closeTab}`; gate on `hasSession`; per-tab segments; paused-drop; idle auto-close `SESSION_IDLE_MS`; host memoize + `'web'` fallback; fail-closed `addEntry`.
- [x] `sidePanelRelay.ts`: construct tracker at registration (`hasSession: id => ctx.lastCuesByTab.has(id)`, `getHost` via `getTab`+hostname, `addEntry: addHistoryEntry`); call `noteTimeUpdate`/`notePlayState` **before** `activeTabIdForPanel` early-return when `payload.tabId !== undefined`.
- [x] `wireEvents.ts`: `tabs.onRemoved` → `tracker.closeTab` (share the singleton — export from the wiring module or via ctx).
- [x] `immersionTracker.test.ts`: per spec §10 (gate, same-id upsert, ≥15 s flush, pause close+sub-15s write, resume=new id, paused-scrub drop, idle auto-close, closeTab, host fallback, addEntry rejection).
- [x] `sidePanelRelay` test: tracker calls precede panel early-return (spy).
- Verify: `npx jest src/entrypoints/background`

## T4 — `ImmersionStats` UI

- [x] `entrypoints/local-player/components/ImmersionStats.tsx` + `.module.css`: unconditional first child of `styles.root` (above EmptyState/list ternary); fetch `getHistory()` → `aggregateHistory` → `levelForHours` on mount; clock icon + totals + streak text + level chip + `role="progressbar"` + `VisuallyHidden`; `title` tooltip for bySource; zeroed empty state; narrow-panel vertical layout.
- [x] `LibraryView.tsx`: mount `<ImmersionStats/>`.
- [x] ~~i18n `immersion.*` en + vi~~ — deviation: local-player entrypoint has zero i18n usage (all sibling strings hardcoded English: "No videos yet", "Recently watched"); followed the surface's convention instead of introducing a one-off i18n path.
- [x] `ImmersionStats.test.tsx` + `LibraryView.test.tsx`: renders above EmptyState (empty library still shows card), aria attrs, zeroed state.
- Verify: `npx jest src/entrypoints/local-player`

## T5 — Gates + docs + smoke + ship

- [x] `npm run typecheck && npm run lint && npm run test:unit && npm run build` + deep-import/feature-cycle guards.
- [x] `docs/2-architechture-system.md` (immersionClock/tracker/hook/UI rows, schema `.int()` fix note), `docs/0-wiki.md` (index + changelog).
- [ ] Real-Chrome smoke `tmp/immersion-clock/smoke.mjs`: local play ~20 s → stats card >0 total; mock-streaming play ~20 s → stream source grows; reload → persist; side-panel relay alive.
- [ ] Backlog → `shipped` + commit hash; commits grouped by subsystem.

Dependencies: T2/T3→T1 (constants + accumulateDelta), T4→T1 (aggregate/level), T5→all.
Parallel: T2 and T3 independent surfaces; T4 can scaffold against mocked `getHistory`.
