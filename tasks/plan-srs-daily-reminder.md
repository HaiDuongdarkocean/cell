# Plan — srs-daily-reminder

Spec: `docs/specs/srs-daily-reminder.md` · Design: `docs/intent/srs-daily-reminder-design-brief.md` + `-component-mapping.md`

## Slice order (in-session, incremental)

| # | Slice | Files | AC |
|---|---|---|---|
| 1 | Manifest + settings schema | `public/manifest.json` (optional_permissions), `types.ts` (`SrsReminderConfig`), `config.ts` (defaults + STORAGE_KEYS + alarm name + tuning consts), `settingsStore.ts` (v38 migration) | manifest guard test; settings round-trip |
| 2 | Pure logic | `src/features/srs/logic/learnReminderHour.ts` — `computeLearnedHour`, `adoptLearnedCandidate` (hysteresis), `nextReminderFireMs`; `getSrsHomeStats.ts` export `dayStartMs`/`computeStreak` | unit tests all spec cases |
| 3 | Runtime state | `src/features/srs/services/reminderState.ts` — ReminderState r/w `Tihoka.srs.reminderState` via chrome-apis; dayStartHour mirror read | — |
| 4 | chrome-apis adapters | `chrome-apis/alarms.ts`, `chrome-apis/notifications.ts` | NF3 compliance |
| 5 | Reminder service | `src/features/srs/services/reminderService.ts` — `evaluateReminder(trigger)`, arm/ensure, snooze, openStudyTab focus-or-create, notification content (due + streak) | gates FR-1..17 |
| 6 | Background wiring | `handlers/srsReminder.ts` (alarm + notifications + storage.onChanged listeners), `index.ts` init | re-assert at init |
| 7 | Settings UI | `SrsStudySettings.tsx` + module.css + `srsUiPrefs` mirror write-through | design-brief states: disabled/enabled/learned/blocked |
| 8 | i18n | `en.json`, `vi.json` — `srs.settings.reminder*` + `srs.reminder.*` | both locales |
| 9 | Cleanup + docs | delete `mockup-srs-daily-reminder/`, `docs/2-architechture-system.md`, `docs/0-wiki.md` | — |
| 10 | Gates + verify + browser | typecheck/lint/test:unit/build + Playwright verify evidence + fresh-context review | ship |

## Key decisions

- One-shot `when:` alarm `srs-reminder`; re-arm every evaluation; `ensureArmed` at init covers missed/cleared alarms.
- `notifications` in `optional_permissions` ONLY; requested via `chrome.permissions.request` in settings toggle gesture.
- Runtime state `Tihoka.srs.reminderState` (chrome.storage.local): `{learnedHour, stats{count,runnerUp}, lastStudiedDayKey, notificationDayKey}` — `snoozeUntil` không cần persist vì alarm time chính là SSOT.
- dayStartHour: SW đọc mirror `Tihoka.srs.uiPrefsMirror` (written-through by `setSrsUiPrefs`/`getSrsUiPrefs`).
- studiedToday gate: `getReviewEventsByTimestampRange(todayStart-27d, now)` — 1 fetch dùng cho cả streak + learned stats + studiedToday.
- Content: `t('srs.reminder.body', [dueNow, streakDays])`; fallback `streakDays-1` khi chưa học.
- Re-arm channel settings→SW: `storage.onChanged` watch `settings` key → evaluate('config').
