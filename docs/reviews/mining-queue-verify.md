# Verify — mining-queue

Fresh-context review of the mining-queue implementation against `docs/specs/mining-queue.md` (plan: `tasks/plan-mining-queue.md`). Two rounds: round 1 found 5 defects; round 2 re-verified after fixes.

## Round 1 — findings (fresh-context subagent, code-read)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| M1 | `videoId` never populated by any cue-save caller — dedupe key falls back to `''` for every source | Major | Fixed |
| M2 | `sourceLabel` = extension `document.title` on sidepanel/local-player surfaces ("Subtitles" instead of the video/page name); `filename` prop unused | Major | Fixed |
| M3 | Stale `queueItemId`: mount-level `pendingCardCreatorContext` + `DictionaryTab` merges keep a replayed row's id alive → a *different* card's successful submit silently removes the queue row | Blocker | Fixed |
| M4 | Save affordances below `--touch-target` floor: `.saveCue` 24/28px, popup circle `sm` 32px vs 40/44px floor | Major | Fixed |
| M5 | Queue quick-add duplicated a minimal Anki pipeline instead of the spec-named `initialAction:'quick-add'` path — weaker `definitions` field (no `formatDefFromLookup`/frequency), no media fallback machinery | Major | Fixed |

## Round 2 — fix verification

- **M1/M2** `SubtitlePanels.handleSaveCue` now passes `sourceLabel: filename ?? document.title` and `videoId: filename ?? canonicalNavUrl(location.href)` (`SubtitlePanels.tsx:173-185`); sidepanel `App.tsx` resolves the active content tab via `getTab(activeTabId)` → `sourceLabel: tab.title`, `videoId: canonicalNavUrl(tab.url)` (`App.tsx:43-58, 335-342`). `webTextDictionaryController` already passes the host page title.
- **M3** `onAfterSubmit` now carries the *submitted* context's `queueItemId`: `DictionaryTab` clears `queueItemId` in both `handlePanelSendToCard`/`handlePanelQuickAdd` merges and forwards `cardCreatorContext?.queueItemId` to `onAfterSubmit` (`DictionaryTab.tsx:54-71,105`); `mountUniversalPanel.ts:211` removes only that id. A replaced/different card can no longer delete the wrong row.
- **M4** `.saveCue` min-box = `var(--touch-target)` (`CueList.module.css:66-82`, mobile override removed); popup save button keeps `sm` circle paint but `styles.saveToQueue` enforces `min-width/min-height: var(--touch-target)` (`CandidateView.module.css:14-19`). QueueTab row actions sit inside `.panel .body` → covered by the existing panel floor (`UniversalPanel.module.css:73-76`).
- **M5** `queueActions.ts` no longer runs a parallel Anki pipeline: `quickAddQueueItem` + `quickAddToAnki` deleted. `mountUniversalPanel.onQuickAdd` routes `ocean-srs` → injected `addToOceanSrs` port (silent, toast "Added to Ocean SRS") and `anki` → `sendToCard({...queueItemToPrefill(item), initialAction:'quick-add'})` — the same path `handlePopupQuickAdd` uses; `CardCreatorPanel` auto-submits after field load and removal reuses the `queueItemId` wiring. Card Creator stack no longer imported by `queueActions` at all.

## Spec checklist (final state)

- SC-1 popup save, one activation, transient confirm: `CandidateView` layers button + `useCandidate.saveToQueue` + 2s `queuedAt` check — PASS
- SC-2 cue save carries sentence + source ref (sourceLabel/cueIndex/cueStart/videoId): `queueItemFromCue` + wired callers — PASS
- SC-3 persistence across SW/restart: background-owned `orca-mining-queue` IDB + repository tests — PASS
- SC-4 QueueTab list newest-first, kind/source/age/count, empty state — PASS (`QueueTab.test.tsx`, visual evidence `tmp/mining-queue-deliver/`)
- SC-5 dedupe upsert — PASS (`queueLogic`/`miningQueueRepository` tests)
- SC-6 cap 500 oldest-first eviction — PASS (repository tests)
- SC-7 cardify replays snapshot, row removed only after submit — PASS
- SC-8 discard removes without card — PASS
- SC-9 i18n en+vi + `--touch-target` floor on save affordances — PASS after M4 fix
- SC-10 quick-add routes to configured sink, no standalone dialog, success removes row, failure keeps it with error toast — PASS after M5 fix
- Architecture: no `dictionaryPopup` import from miningQueue; Ocean SRS via injected port; `check-feature-cycles` clean (29 features, 73 edges); `check-deep-imports` clean — PASS
- Gates: `npx tsc --noEmit` clean; eslint on touched files 0 errors; focused suites 117 + 992 tests pass; full suite 8129 pass; `npm run build` pass — PASS

## Residual notes (non-blocking)

- `browser` runtime smoke on real Chrome is evidenced at component level via production-component screenshots (`tmp/mining-queue-deliver/*.png`); full extension-load E2E of the queue round-trip is delegated to manual QA — message handler + client are unit-tested at the zod boundary.
- `pendingCardCreatorContext` still holds the last replayed context after submit until reset — harmless now that removal keys off the submitted context's own `queueItemId`.

VERDICT: PASS
