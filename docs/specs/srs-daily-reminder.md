# Spec: Daily SRS study reminder — adaptive scheduling

> Intent: `docs/intent/srs-daily-reminder.md` · ui_surface: yes · Mode: all

## Objective

The system reminds the user once per study-day to do SRS review when they haven't yet — "done" = ≥1 review since day start (`dayStartHour` boundary) — via an OS notification that deep-links into the srs-study page. The fire time starts at a user-chosen ideal hour and self-adjusts toward the hour the user actually habitually starts reviewing, learned from `reviewEvents.answeredAt`. The feature is opt-in, silences itself on goal met, survives MV3 service-worker/browser restarts, and ships without disabling the extension for existing users (`notifications` as optional permission only).

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| User (learner) | Toggles reminder, picks ideal hour, clicks/snoozes notification | enabled flag, preferred hour, click/snooze action | OS notification (title, due count, streak), settings row state, srs-study page |
| Chrome alarms | Fires `SRS_REMINDER_ALARM` at scheduled `when` | — | — |
| Chrome notifications | Dispatches `onClicked`/`onButtonClicked` | user gesture on notification | — |
| Chrome storage | Dispatches `onChanged` when `settings.srs.reminder` or `dayStartHour` mirror changes | changed values | — |

System-internal processing never includes human behavior: the gate evaluation, hour learning, arming/re-arming, and notification rendering are all system steps.

## Requirements

### Functional

REQ-1: Configure the daily reminder
- Actor: User
- Goal: Turn the reminder on/off and set an ideal hour; grant notification permission in-context
- Preconditions: srs-study page open, settings overlay on "general" tab
- Basic flow:
  1. actor enables the "daily reminder" toggle
  2. system calls `chrome.permissions.request({permissions: ['notifications']})` inside the gesture
  3. system writes `settings.srs.reminder = {enabled: true, preferredHour}` (schema v38 slice) and surfaces the grant result in the row
  4. system re-arms `SRS_REMINDER_ALARM` to the next occurrence of the effective hour (storage.onChanged listener in SW)
  5. system shows the effective fire hour in the settings row
- Alt flow: actor picks a different ideal hour (Select, 24 options) → system saves → re-arm. Actor disables toggle → system saves `enabled: false` → clears `SRS_REMINDER_ALARM` (no notification at next wake).
- Exception: permission denied → `enabled` still saved, row shows blocked state ("browser notifications are off") and the scheduling path no-ops on every evaluation; no crash, no retry prompt (re-request via the row's action affordance).
- Rules: `chrome.permissions.request` only inside a user gesture; never auto-enable.
- Postcondition: alarm armed iff `enabled && permission granted`; settings row reflects effective state.
- NFR refs: NFR-3, NFR-5

REQ-2: Scheduled daily evaluation
- Actor: Chrome alarms
- Goal: Deliver at most one discipline reminder per study-day, only when the goal is unmet
- Preconditions: `SRS_REMINDER_ALARM` armed at effective hour
- Basic flow:
  1. actor fires the alarm
  2. system reads `settings.srs.reminder`, permission state, `dayStartHour` mirror, and `reviewEvents` in `[todayStart - 28d, now]` via `by_timestamp` — ONE range read serving both the gate and REQ-5 learning
  3. system evaluates the gate: `enabled && permitted && studiedToday == 0`, plus `lastNotifiedDayKey != today` **only when `trigger` is `scheduled` or `missed`** — snooze-triggered evaluations skip the dedupe term (REQ-3)
  4. system resolves `collectionId` (`settings.srs.activeCollectionId` → fallback `ensureFirstRun().collectionId` per `handlers/srs.ts:50`; no collection/decks → silent, re-arm anyway) and computes `dueNow` + `streakDays` by calling `getSrsHomeStats(collectionId, dayStartHour)` once — ONLY when the gate has passed, so the heavier all-cards scan never runs on silent days
  5. system raises a notification (fixed id `srs-daily-reminder`, `type: 'basic'`, `requireInteraction: true`, `priority: 2`) titled per i18n with due count + streak, buttons [Study now | Remind me in 1h]
  6. system records `lastNotifiedDayKey = today`, `lastFireAt = now`, re-arms the alarm for the next study-day's effective hour
- Alt flow: gate fails at step 3 → system skips notification entirely and still re-arms for the next study-day.
- Exception: any failure in evaluation (IDB error, storage error) → log via `logger.warn`, re-arm next day anyway (self-healing), no notification.
- Rules: `studiedToday` counts events with `answeredAt >= todayStart`; "today" = `dayKeyFor(now, dayStartHour)`; day-boundary/streak math reuses `getSrsHomeStats.ts` — DELIVER exports `dayStartMs`/`computeStreak` if needed by the reminder module (they are currently module-local); no parallel day-boundary logic.
- Postcondition: ≤1 notification per study-day; alarm armed for next occurrence.
- NFR refs: NFR-1, NFR-2, NFR-4, NFR-7

REQ-3: Notification interaction
- Actor: Chrome notifications (dispatches user gesture)
- Goal: One click returns the user to study; "later" defers without losing the day
- Preconditions: notification visible
- Basic flow (click):
  1. actor clicks the notification body
  2. system queries tabs for `chrome.runtime.getURL(SRS_STUDY_PATH)`; if found → `tabs.update(active)` + `windows.update(focused)`; else `tabs.create(url)`
  3. system clears the notification
- Basic flow (snooze button):
  1. actor clicks "Remind me in 1h"
  2. system schedules `SRS_REMINDER_ALARM` at `now + 60min` (one-shot) and clears the notification
  3. on that fire, the REQ-2 evaluation runs with `trigger: 'snooze'` — dedupe term skipped, so still-unstudied → notify again (same fixed id replaces the old one); studied → silent
- Alt flow: repeated snoozes allowed while the study-day continues unstudied; a snooze firing after the day boundary rolls over simply runs that (new) day's evaluation.
- Exception: tab focus fails (window closed) → `tabs.create` fallback.
- Rules: notification id is fixed so re-fires replace, never stack; snooze is not counted against the ≤1/day initial-notification budget.
- Postcondition: exactly one srs-study tab focused/created, or alarm armed at snooze time.
- NFR refs: NFR-1

REQ-4: Missed-fire recovery at service-worker init
- Actor: Chrome runtime (SW wake / `onStartup` / `onInstalled`)
- Goal: Guarantee the daily reminder exists even if the persisted alarm was lost or its time elapsed while the browser was closed
- Preconditions: SW initializes (`init()` step 4 wiring)
- Basic flow:
  1. `wireSrsReminderScheduling()` runs: registers `onAlarm`, `notifications.onClicked`/`onButtonClicked`, `storage.onChanged` listeners
  2. system reads state and computes `nextFire = nextOccurrence(effectiveHour, dayStartHour)`
  3. if an armed `SRS_REMINDER_ALARM` exists with the correct `when` → keep it
  4. else → create the one-shot alarm at `nextFire`
  5. if `nextFire` has already elapsed this study-day AND `lastNotifiedDayKey != today` → run the REQ-2 evaluation immediately (missed-fire path)
- Alt flow: `enabled` false or permission absent → clear the alarm and skip evaluation.
- Exception: state read fails → log + leave any existing alarm untouched.
- Rules: re-assert is idempotent — safe on every SW wake; evaluation shared with REQ-2 (same function, `trigger: 'scheduled' | 'snooze' | 'missed'`).
- Postcondition: exactly one correct armed alarm (or none when disabled); missed reminders still delivered same-day.
- NFR refs: NFR-1, NFR-6

REQ-5: Adaptive reminder hour
- Actor: (system-internal; triggered inside every arm step of REQ-1/2/3/4)
- Goal: Fire at the hour the user habitually begins studying, once evidence exists
- Preconditions: reminder config read; `reviewEvents` accessible
- Basic flow:
  1. system reads `reviewEvents.answeredAt` for the last 28 days via `by_timestamp` range
  2. system groups events into study-days (`dayKeyFor(ts, dayStartHour)`) and takes the local hour of each day's FIRST `answeredAt` (sit-down time)
  3. system builds a 24-bucket histogram; `candidateHour` = argmax bucket (tie → bucket containing the most recent first-review)
  4. eligible when studyDays ≥ 5 AND candidate bucket count ≥ 3; adoption additionally requires hysteresis: `candidate count - runner-up count ≥ 2` OR `candidate == current learnedHour` — otherwise keep the previous `learnedHour` (prevents daily oscillation between near-tied buckets)
  5. `effectiveHour = adopted learnedHour` when eligible+adopted, else `preferredHour`; system stores `learnedHour` in reminder state for the settings row display and next-arm comparison
- Alt flow: no review history at all → `effectiveHour = preferredHour`.
- Exception: histogram computation fails → `effectiveHour = preferredHour`, log, continue.
- Rules: `learnedHour` is recomputed at every arm, never edited by the user, never adopted from a single session; no clamping (any hour is valid); changing `preferredHour` needs no learning reset because learning is recomputed from history, not stored as truth.
- Postcondition: `nextFire` uses `effectiveHour`.
- NFR refs: NFR-7

REQ-6: Surface permission/reminder state in settings
- Actor: User
- Goal: Understand whether reminders will actually fire
- Preconditions: settings general tab open
- Basic flow:
  1. system renders the reminder row: Toggle (enabled), hour Select (preferred), and a status line
  2. status line resolves: disabled → hint copy; enabled + granted → "fires ~HH:00 (learned)" or "fires HH:00"; enabled + denied → blocked state with a re-request affordance
- Alt flow: denied + actor clicks re-request → `chrome.permissions.request` again (gesture) → row updates; if the request returns false (Chrome may auto-deny repeat requests without showing UI), the row switches to fallback copy pointing to browser/extension notification settings.
- Exception: `getPermissionLevel`/`contains` unavailable → treat as granted if `chrome.notifications` exists.
- Rules: state read live on open (`chrome.permissions.contains` + reminder state), not cached from last session.
- Postcondition: row always reflects real capability.
- NFR refs: NFR-5

REQ-7: `dayStartHour` mirror for the service worker
- Actor: (system-internal; triggered by `setSrsUiPrefs`/prefs load)
- Goal: SW evaluates "today" on the same boundary as the UI streak logic
- Preconditions: `srsUiPrefs` loaded or mutated in an extension page
- Basic flow:
  1. system writes `prefs.dayStartHour` into `chrome.storage.local` under `Tihoka.srs.uiPrefsMirror` on `setSrsUiPrefs`, and once when the reminder settings row first mounts (not on module import — no import-time side effects)
  2. SW-side reminder reads the mirror key; absent → default 4 (same as `SRS_UI_PREF_DEFAULTS.dayStartHour`)
- Alt flow: none.
- Exception: `chrome`/`chrome.storage` unavailable → skip silently (content/test contexts).
- Rules: localStorage remains the UI SSOT; the chrome.storage key is a write-through mirror — never written by the SW, never read by UI.
- Postcondition: SW day boundary equals UI day boundary.
- NFR refs: NFR-4

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | ≤1 initial notification per study-day; re-fires replace via fixed notificationId — never stacked dupes across SW restarts | R | 1/day |
| NFR-2 | Gate evaluation (state read + event-range query + due count) completes within persona budget | P | ≤2s on low-end hardware |
| NFR-3 | `notifications` declared only under `optional_permissions`; unit test guards the manifest | +security/infra | guard test green |
| NFR-4 | All SW-consumed reminder config/state in `chrome.storage.local`; zero `localStorage` reads in SW path | +infra | code review + test |
| NFR-5 | All user-facing strings i18n'd (en + vi) via existing `t()`/messages system | U | both locales render |
| NFR-6 | Alarm re-assert idempotent on every `init()`; elapsed fire → missed-fire evaluation | R | unit test |
| NFR-7 | Evaluation cost O(events-in-window + cards) via indexes — no full-store scans beyond existing `getSrsHomeStats`-equivalent queries | P/resource | code review |
| NFR-8 | Notification buttons: [Study now | Remind me in 1h]; `requireInteraction: true`, `priority: 2` | U | notification spec |

## Flows / States

Reminder lifecycle (per study-day):

```
armed --fire→ evaluating
evaluating --(disabled | no permission | studied | already-notified)→ armed(next day)
evaluating --gate pass→ notified
notified --click→ [open srs-study tab] --→ armed(next day)
notified --snooze→ armed(+60min) --fire→ evaluating(trigger=snooze)
init --alarm missing/stale→ re-assert --elapsed-today→ evaluating(trigger=missed)
init --disabled→ cleared
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Decide whether to remind | `SRS_REMINDER_ALARM` one-shot + `evaluateReminder()` gate + `lastNotifiedDayKey` dedupe + fixed notificationId |
| Reach the user outside the app | `chrome.notifications` create + `optional_permissions` grant flow + i18n title/body (due + streak) |
| Route back into study | `onClicked` → focus-or-create srs-study tab; `onButtonClicked` → snooze re-arm |
| Let the user control it | `SrsStudySettings` reminder row (Toggle + hour Select + status line) + `settings.srs.reminder` slice (schema v38) |
| Pick the right fire hour | `preferredHour` + `learnReminderHour(events)` histogram + `effectiveHour` used at every arm |
| Survive platform volatility | `wireSrsReminderScheduling()` re-assert at init + missed-fire path + try/catch self-healing re-arm |
| Keep day boundary consistent | `dayStartHour` write-through mirror to `chrome.storage.local` |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| ReminderConfig | `enabled: boolean`, `preferredHour: 0-23` | `settings.srs.reminder` (chrome.storage.local, schema v38) | user lifetime; **deliberately synced** via `['srs']` path — deviation from intent Non-goal ("device-local accepted"), chosen so the discipline scaffold travels with the user's profiles; false-positive consequence documented in Open Questions |
| ReminderState | `learnedHour: number|null`, `lastNotifiedDayKey: string|null`, `lastFireAt: number` | `chrome.storage.local['Tihoka.srs.reminderState']` | device-local, overwritten each arm/fire; not synced |
| UiPrefsMirror | `dayStartHour` | `chrome.storage.local['Tihoka.srs.uiPrefsMirror']` | device-local mirror of localStorage SSOT |
| Review events (existing) | `answeredAt`, `cardId` | IDB `reviewEvents`, `by_timestamp` index | ≤365d (`reviewEventMaxAgeDays`) |
| SrsCard (existing) | `nextDue`, `deckId` | IDB `cards`, `by_deck_due` index | — |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (daily remind iff 0 reviews) | REQ-2 | AC-1, AC-2 |
| N2 (adaptive hour) | REQ-5 | AC-9 |
| N3 (click → study page) | REQ-3 | AC-3 |
| N4 (user control + permission) | REQ-1, REQ-6 | AC-7, AC-8 |
| N5 (no spam/dupes) | REQ-2, REQ-3, REQ-4 | AC-4 |
| N6 (missed → fires on launch) | REQ-4 | AC-5 |
| N7 (no update-disable) | REQ-1 | AC-10 |
| N8 (SW-readable config) | REQ-7, Data | AC-11 |
| N9 (snooze) | REQ-3 | AC-6 |
| N10 (due + streak content) | REQ-2 | AC-1 |

| Journey step | REQ |
|---|---|
| TO-BE 1 (enable + pick hour + grant) | REQ-1, REQ-6 |
| TO-BE 2 (fire-time gate, goal met → silent) | REQ-2 |
| TO-BE 3 (notification w/ due + streak, missed → next launch) | REQ-2, REQ-4 |
| TO-BE 4 (click → tab → ≥1 review) | REQ-3 |
| TO-BE 5 (time converges to habit) | REQ-5 |
| TO-BE 6 (other-device study → silent after sync) | REQ-2 (gate reads synced events) |
| TO-BE 7 (discipline externalized) | all |

## Boundaries

- Scope In/Out/Non-goals: as defined in `docs/intent/srs-daily-reminder.md` — this spec adds no scope beyond it (one deliberate deviation: `srs.reminder` stays synced, see Data table).
- Always: reuse `dayKeyFor`/`dayStartMs`/`computeStreak`/`getStreakStats`/`getSrsHomeStats` (exporting module-local helpers if needed — no parallel logic); alarm pattern like `wireAnkiStatusSyncScheduling`; fixed notification id; i18n keys for every string; gates `typecheck + lint + test:unit + build` before commit.
- Ask first: manifest changes beyond `optional_permissions`; any new message type beyond what's specced (storage.onChanged is the re-arm channel — no new message type expected); syncing `srs.reminder` is accepted by default — flag if a reason emerges to add it to `excludedPaths`.
- Never: `notifications` under `permissions`; `localStorage` reads in SW code; new day-boundary logic duplicating `getSrsHomeStats.ts`; writes to `Tihoka.srs.uiPrefsMirror` from the SW.

## Success Criteria

- [ ] AC-1: With reminder enabled, permission granted, 0 reviews today and `lastNotifiedDayKey != today`, alarm fire produces a notification whose body contains the due-card count and current streak (i18n'd).
- [ ] AC-2: Same setup but ≥1 review exists since `dayStart(now)` → no notification; alarm re-arms for next day.
- [ ] AC-3: Clicking the notification opens srs-study — focusing the existing tab when one is already open, creating exactly one tab otherwise.
- [ ] AC-4: ≤1 notification per study-day across SW restarts/relaunches (`lastNotifiedDayKey` dedupe); re-fires replace via fixed id — never stacked.
- [ ] AC-5: Browser closed at scheduled fire → on next launch `wireSrsReminderScheduling` re-asserts and the elapsed fire runs evaluation → notification appears iff still unstudied.
- [ ] AC-6: "Remind me in 1h" arms a one-shot ~+60min alarm; on fire it notifies again iff still unstudied; repeat snoozes allowed.
- [ ] AC-7: Toggle off persists `enabled:false` and clears the alarm — no notification at subsequent wakes; toggle on requests permission in-gesture and arms.
- [ ] AC-8: Permission denied/revoked → no crash, no notification, settings row shows blocked state with re-request affordance.
- [ ] AC-9: With ≥5 study-days and ≥3 first-reviews in the modal hour bucket (28-day window), `effectiveHour = learnedHour`; below min-sample → `preferredHour` (unit-tested pure function).
- [ ] AC-10: `manifest.json` contains `notifications` under `optional_permissions` only — enforced by a unit test.
- [ ] AC-11: Changing `dayStartHour` via `setSrsUiPrefs` writes the mirror to `chrome.storage.local`; SW reads mirror/default — never `localStorage`.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (SrsStudySettings row uses shared atoms)
- [ ] Real-Chrome verify: enable → alarm scheduled → forced fire → notification → click lands in srs-study (testing-extension-browser)
- [ ] Canon docs updated: `docs/2-architechture-system.md` (background scheduling section), `docs/0-wiki.md` changelog

## Open Questions / Accepted Risks

- Firefox port: `build-firefox.mjs` strips manifest `key`; `optional_permissions` support on Firefox MV3 is version-dependent — reminder degrades to disabled if `chrome.permissions`/`notifications` unsupported (guarded checks); accepted, revisit on next Firefox ship.
- Synced `srs.reminder` means two devices may both notify until a sync pull lands the review — accepted false-positive, documented in intent risks.
- `learnedHour` uses first-review-of-day as "sit-down time" — a proxy; a user who does a 2-card micro-session at 9h then the real session at 21h teaches the 9h bucket. Accepted: 28-day window smooths this; revisit if complaints.
- `settings.srs.reminder` syncing an `enabled` flag to a fresh device where the user never granted the permission → gate blocks until granted (REQ-2 evaluates `permitted` each fire); settings row shows blocked state. Accepted.
