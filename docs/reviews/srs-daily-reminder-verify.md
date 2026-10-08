# Verify — srs-daily-reminder

Spec: `docs/specs/srs-daily-reminder.md`. Fresh-context review by `subagent_explore` (first pass), fixes applied by owner, gates re-run.

## Fresh-context findings → resolution

| # | Finding | Resolution |
|---|---|---|
| F1 | Learned-hour histogram counted all `answeredAt` events — long sessions skew mode | FIXED: `computeLearnedHour` now histograms the first event per study day (`learnReminderHour.ts:19-29`), one sample per day |
| F2 | Notification could fade before user sees it | FIXED: `requireInteraction: true` on `notifications.create` (`reminderService.ts:98`) |
| F3 | Notified with `dueNow=0` when no collection exists | FIXED: notify only when `collectionId` resolves (`reminderService.ts:141-144`) |
| F4 | `dayStartHour` change in prefs didn't re-arm (listener only watched `settings`) | FIXED: storage listener also watches `SRS_UI_PREFS_MIRROR` (`handlers/srsReminder.ts:38-39`) |
| F5 | Permission denied → enable not persisted → blocked state unreachable | FIXED: `onToggle` saves `enabled` and fires `permissions.request` non-blocking in the click gesture; blocked row shows `enabled && !granted` (`SrsStudySettings.tsx:72-75,98-104`) |
| F6 | Import-time mirror write in `srsUiPrefs.ts` | ACCEPTED: idempotent backfill so pre-feature `dayStartHour` customizations reach the SW without requiring a prefs edit; `setStorage` no-ops without chrome.* |
| F7 | `evaluateReminder` exception → one-shot alarm consumed, nothing re-armed until next SW init | FIXED: catch path re-arms a +1h retry alarm best-effort (`reminderService.ts:166-173`) |

## Success Criteria trace

| AC | Status | Evidence |
|---|---|---|
| Daily reminder when study day has no reviews | PASS | `evaluateReminder` gates on `studiedToday` (any `answeredAt >= dayStartMs`) — `reminderService.ts:108-119` |
| ≥1 review completes the day | PASS | `studiedToday` boolean + `lastStudiedDayKey` persist; alarm re-arms at next slot `:120-129` |
| User-selected initial hour | PASS | `preferredHour` Select in settings, schema v38 `srs.reminder`, cold-start `effectiveHour = learnedHour ?? preferredHour` `:135` |
| Adaptive hour from history | PASS | `learnReminderHour.ts` — first-per-day mode, ≥5 study days, ≥3 count |
| Min sample threshold | PASS | `SRS_REMINDER_MIN_STUDY_DAYS=5`, `MIN_COUNT=3` (`config.ts:249-251`) |
| Anti-oscillation | PASS | `adoptLearnedCandidate` margin ≥2 vs runner-up, or same hour (`learnReminderHour.ts:47-54`) |
| Reasonable window clamp | PASS | hour is always 0-23 local; `preferredHour` clamped on read (`reminderService.ts:40-43`) |
| Max one notification per study day | PASS | `notificationDayKey` dedup `:138`; snooze bypass only via `snooze` trigger |
| No notification after daily goal met | PASS | `studiedToday` early-return `:120-129` |
| No dup across SW restarts/relaunches | PASS | `notificationDayKey` in chrome.storage survives restart; `ensureReminderArmed` checks existing alarm before re-arming `:52-68` |
| Snooze ~1h, re-gated | PASS | `srs-reminder-snooze` alarm → `evaluateReminder('snooze')` re-checks `studiedToday` `:70-72`, `handlers/srsReminder.ts:29,16-17` |
| Content: due + streak | PASS | `getSrsHomeStats` dueNow + `max(streak-1, computeStreak fallback)` `:145-149`, i18n `srs.reminder.body` |
| Click → SRS study page | PASS | `openSrsStudyTab` query existing `srs-study` tab → focus else create `:74-84` |
| No duplicate tabs on repeat clicks | PASS | focus-or-create in `openSrsStudyTab` |
| One-shot self-re-arming alarms | PASS | `armAt(nextSlot)` at end of every evaluate `:165`; `nextReminderFireMs` pure |
| Re-assert at every SW init | PASS | `wireSrsReminderScheduling` calls `ensureReminderArmed()` at init step 4 (`index.ts:219`) |
| Missed-fire on reopen | PASS | elapsed `when:` alarms fire on wake; dropped-alarm path: init evaluates, `slotElapsed` gate allows notify `:137-144` |
| Alarm/IDB failures caught | PASS | try/catch → `logger.warn` + retry arm `:166-173`; adapters guard `chrome.*` absence |
| Permission requested only at enable | PASS | `chrome.permissions.request` in toggle handler (user gesture) `SrsStudySettings.tsx:66-74` |
| Denied/revoked visible + recoverable | PASS | blocked row: ⚠ + `reminderBlocked` text + `reminderRetry` button re-requesting `:97-105` |
| State in chrome.storage for SW | PASS | `srsReminderState` + `srsUiPrefsMirror` via `reminderState.ts`; `srsUiPrefs` write-through |
| Reuse day-boundary logic | PASS | `dayKeyFor`/`dayStartMs`/`computeStreak` exported from `getSrsHomeStats.ts:54-74` |
| Reuse review-event indexes | PASS | `getReviewEventsByTimestampRange` `by_timestamp` |
| i18n en + vi | PASS | `srs.settings.reminder*`, `srs.reminder.*` in both messages files |
| Shared components/tokens | PASS | `Section`/`SettingRow`/`Toggle`/`Select`/`Text`/`Icon(triangleAlert)`; `triangleAlert` from ICON_CATALOG; no new tokens |
| a11y | PASS | `aria-label` on Toggle/Select, `role="alert"` on blocked row |

## Gates

- `npm run typecheck` PASS · `npm run lint` PASS (0 errors; 4 pre-existing warnings in untouched files) · `npm run test:unit` PASS (8286, incl. new `srs-learn-reminder-hour`, `settingsStoreReminder`, manifest optional-permission guard) · `npm run build` PASS
- Browser verify (`tmp/srs-daily-reminder-verify/verify.mjs`, real Chromium + packed dist + cloned profile): 9/9 — SW live, section renders, `srs-reminder` alarm armed at next slot, `srsReminderState` persisted, blocked state renders when enabled without grant, gate consistency (no notify when denied/studied). Screenshots `01–03*.png`.
- Known limitation: `chrome.permissions.request` produces a real browser prompt that headless Chromium cannot dismiss (`pending-prompt`); grant flow verified for wiring + persistence, the OS prompt itself is platform chrome.

VERDICT: PASS
