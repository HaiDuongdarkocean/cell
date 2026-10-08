# Intent: Daily SRS study reminder — adaptive scheduling

> Slug: `srs-daily-reminder` · Mode: all · Source: backlog row #37 + user statement "tôi muốn phát triển tính năng thông báo học srs mỗi ngày nhằm duy trì tính kỷ luật" + user answers (goal = ≥1 review; timing = "giờ cố định lý tưởng, sau đó hệ thống tự điều chỉnh thích nghi theo lịch sử user hay học")
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | SRS study only happens when the user self-initiates — a forgotten day silently breaks the streak and the daily-review habit; nothing nudges them | User statement "duy trì tính kỷ luật"; zero `chrome.notifications` usage in codebase (grep: no hits outside docs); streak is a first-class surface `SrsStreaksView.tsx` | 90% |
| Change | Passive (user must remember to open srs-study) → system-initiated daily nudge that self-silences once ≥1 review is done that day, and whose fire time converges from a user-chosen hour toward the user's observed study-time pattern | User answers 2026-10-08 | 90% |
| Solution | MV3 `chrome.alarms` self-rescheduling one-shot in the background SW → check `reviewEvents` for today → `chrome.notifications` (optional permission) → click deep-links into srs-study page | alarm pattern precedent `handlers/ankiStatusSync.ts:107-120`; `handlers/srs.ts:79-103` | 85% |
| Value | Streak preservation → daily habit retention → more reviews actually done; zero-friction return path (one click lands in study) | Streak UI investment `getSrsHomeStats.ts:148-190`; user picked this over badge-only | 85% |
| Stakeholder | Daily language learner (persona 5–80, low-end devices) who wants an external scaffold for discipline | AGENTS.md persona; user statement | 90% |
| Context | MV3 service worker: event-driven wake, no `localStorage` (srsUiPrefs unreadable in SW), alarms persist across restarts, `notifications` permission carries a "Display notifications" install warning | `srsUiPrefs.ts:40` defensive `globalThis.localStorage?.`; Chrome docs: permissions-list + web-push.md ("disable the extension for any existing installs until the user approves") | 95% |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Solo maintainer + agents | Build without new infra; all primitives exist (alarms, IDB access in SW, deep-link handler) | `ankiStatusSync` alarm + `getCard`/`getNote` calls already run in SW context — `handlers/ankiStatusSync.ts:97` |
| Customer | Language learner persona | A nudge that respects them: quiet once they've studied, not spammy, controllable | Notification permission can be denied at OS/browser level |
| Supplier/Dependency | Chrome MV3 platform | alarms ≥30s granularity, missed `when` alarms fire on browser launch; `notifications` via `optional_permissions` so existing users' extension is not disabled on update | Chrome docs permissions-list: `"notifications"` → warning "Display notifications." |
| Organization | Future contributors | Config in `chrome.storage` (SW-visible), not `localStorage`; follow `wire*Scheduling()` convention | `srsUiPrefs.ts:20` localStorage precedent is the anti-pattern here |
| Regulator | none — extension ships via CRX/Drive update, not Web Store review | — | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | When enabled, a reminder fires once per day at the configured time **iff** the user has completed 0 reviews since day start (`dayStartHour` boundary) — "done for the day" = ≥1 review, matching streak semantics | F | User answer "≥1 review (giữ streak)"; `getReviewEventsByTimestampRange` `reviewEventRepository.ts:79-88` | 95% |
| N2 | Reminder time starts at a user-chosen "ideal hour", then self-adjusts toward the hour the user actually studies — learned from `reviewEvents.answeredAt` histogram over a recent window | F | User answer "theo dõi lịch sử user thường học vào ngày nào để có thể nhắc user vào lúc đó. cơ chế tự điều chỉnh thích nghi"; `answeredAt` retained ≤365d `config.ts:233` | 90% |
| N3 | One click on the notification opens the srs-study page (existing deep-link mechanism) | F/U | `SRS_OPEN_STUDY_PAGE` handler `handlers/srs.ts:79-103` | 95% |
| N4 | User controls the feature: enable toggle + preferred hour in SRS study settings; `notifications` requested via `chrome.permissions.request` at enable time (user gesture), graceful state when denied | U | `SrsStudySettings.tsx` Toggle/Select precedent; optional_permissions avoids update-disable | 90% |
| N5 | No spam, no dupes: ≤1 notification/day, none when goal met, none duplicated across SW restarts/browser relaunches (dedupe keyed on study-day) | R | discipline UX [assumption] + MV3 SW volatile-lifecycle requirement | 90% |
| N6 | A reminder missed while the browser was closed still reaches the user on next launch (if the day is still unstudied) — the scheduling code must re-assert the next fire at every SW init, because alarm persistence across browser restarts is not contractually guaranteed pre-Chrome 150 | R | Chrome alarms docs: "make sure important alarms exist each time your service worker starts up"; `init()` already runs on every SW start + `onStartup`/`onInstalled` `index.ts:195-218,426` | 85% |
| N7 | Shipping the feature must not disable the extension for existing users on update | +infra | Chrome docs web-push.md: adding `notifications` to `permissions` "will also disable the extension for any existing installs until the user approves the new permission request" → constraint: `optional_permissions` only | 95% |
| N8 | The SW must be able to read all reminder config/state (enabled, preferred/learned hour, last-fired day-key, snooze-until) — i.e. nothing it needs may live in `localStorage` | +infra | `srsUiPrefs.ts:38-46` reads `globalThis.localStorage` — undefined in SW → defaults → constraint: `chrome.storage.local` (settingsStore precedent, SW-readable via `loadSettings()` `index.ts:204`); `dayStartHour` must be mirrored | 95% |
| N9 | Snooze action on the notification ("nhắc lại sau ~1h") re-fires within the same day, still gated on unstudied | F | [assumption] — standard reminder UX, low cost via one extra one-shot alarm | 60% |
| N10 | Notification content shows what matters for discipline: due-card count + current streak at stake | U | `getSrsHomeStats` exposes `dueNow`/`streakDays` `getSrsHomeStats.ts:77-146` | 80% |

## Scope

- **In:** background `srsReminder` scheduling module (one-shot self-rescheduling alarm, re-asserted at every SW init); reminder config + runtime state in `chrome.storage.local` (settingsStore slice if a schema bump is cheap, else a dedicated key — SPECIFY decides); "studied today" gate + day-boundary reuse via exported `dayKeyFor`/`dayStartMs`/`computeStreak`/`getStreakStats` (`getSrsHomeStats.ts:54-190`) over `by_timestamp` — no parallel day-key logic; adaptive hour learning from `answeredAt` (min-sample + stability/clamp rules); `chrome.notifications` create/click/button-click → srs-study deep-link (focus existing tab if already open — `SRS_OPEN_STUDY_PAGE` currently `tabs.create`s unconditionally `srs.ts:98`); settings UI row (toggle + hour select + permission state) in `SrsStudySettings`; `optional_permissions` manifest entry; i18n strings; unit tests for pure logic (hour learning, dedupe, day-key).
- **Out:** FCM/web push; OS-level scheduling beyond `chrome.alarms`; per-deck or per-profile schedules; sound; action-badge due-count (conflicts with media-detect badge semantics — separate decision); email/mobile channels; streak-freeze/repair mechanics.
- **Non-goals:** redesigning streak rules or the streaks view; a daily-goal system beyond ≥1 review (the `COMPLETED_REVIEWS_PER_DAY` ponytail note stays as-is); syncing reminder prefs across devices (device-local is accepted — see Risks).

## Workflow

The user opts in once: opens SRS study settings, toggles "daily reminder", picks an ideal hour — that click also triggers `chrome.permissions.request({permissions:['notifications']})` so the grant happens in context. Thereafter the loop is fully system↔system: each alarm fire wakes the SW, the handler reads reminder state from `chrome.storage.local`, queries `reviewEvents` for the current study-day, and either stays silent (goal met → re-arm next day) or raises a notification carrying due count + streak. A click routes person↔device back into the srs-study tab. Every fire re-arms the next occurrence — with the learned hour substituted once enough history exists, and with a snooze alarm scheduled instead when the user taps "later". Studying elsewhere in the day (any review write) does not need to cancel anything: the gate is evaluated at fire time, so a completed goal is naturally silent.

## Journey

### AS-IS
1. User resolves to review SRS daily; the only trigger is their own memory/mood.
2. On a busy day they never open srs-study — due cards accumulate unseen.
3. Midnight/`dayStartHour` passes; the streak counter silently resets to 0.
4. They discover the broken streak next session — motivation dips; the habit loop weakens.
5. Edge: user studies on a second device — the first device never learns about it except via sync pull.

### TO-BE
1. User enables "daily reminder" in SRS settings, picks an ideal hour, grants notification permission in the same gesture.
2. At fire time the SW checks today's reviews: goal met → silent, re-arms for tomorrow.
3. Goal unmet → notification "N cards due — streak N days at stake" appears (or on next browser launch if it was closed at fire time).
4. User clicks → srs-study tab opens; ≥1 review marks the day, streak preserved.
5. Over weeks the fire time drifts from the chosen hour toward the user's observed modal study hour (bounded, min-sample gated).
6. Edge: user studied on another device → after the next sync pull this device's gate sees the review and goes silent.
7. Value lands: forgetting is impossible without actively dismissing — discipline externalized, streaks survive busy days.

## Stories

- S1: As a learner, I want a daily nudge when I haven't reviewed, so that I never lose a streak to forgetfulness — done when a notification appears at my configured time iff today's review count is 0, and clicking it lands me in the study page.
- S2: As a learner, I want the nudge to arrive when I actually tend to study, so that it catches me at the right moment — done when the fire time converges to my modal study hour once enough history exists, and stays at my chosen hour before that.
- S3: As a learner, I want control over the nudge, so that it never becomes an annoyance — done when I can disable it and set my ideal hour, and a denied/revoked permission is surfaced in settings rather than failing silently.
- S4: As a learner, I want to defer a nudge once, so that a bad moment doesn't become a missed day — done when a "later" action re-fires the reminder later the same day iff still unstudied.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| `notifications` added to `permissions` (not optional) disables the extension for all existing users on update | external | Extension off until user re-approves — catastrophic for a CRX-distributed build | Fully controllable: `optional_permissions` + runtime request; manifest guard test |
| User denies permission at request time, or revokes later in OS/browser settings | human | Feature silently dead | Detectable via `chrome.permissions.contains` + `chrome.notifications.getPermissionLevel()`; settings row shows blocked state |
| Scheduled alarm lost across browser restart (persistence not guaranteed pre-Chrome 150) + SW never wakes → no reminder that day | external | Missed reminder, silent | `wireSrsReminderScheduling()` re-asserts/re-computes next fire at every `init()`; elapsed fire time → treat as missed-fire path |
| Adaptive hour learns noise (a few odd sessions) or oscillates | internal | Reminders land at wrong times, erode trust | Min-sample threshold + stability rule (shift only after consecutive confirmations) + clamp window — all pure functions, unit-testable |
| Studied on another device → notification fires anyway | operational | Occasional false positive | Accepted risk: review events sync via existing pipeline; document; not worth cross-device realtime for a reminder |
| OS-level notification suppression (Focus Assist, DND) hides the reminder | external | Feature appears broken | Document in settings copy; nothing controllable |
| Alarm handler crashes mid-check (IDB unavailable) | internal | No reminder that day | Wrap in try/catch + logger like `runOnce` precedent `handlers/ankiStatusSync.ts:26-38`; next fire re-arms anyway |
| `dayStartHour` drift: UI pref (localStorage) vs SW copy diverge | internal | "Today" boundary wrong → reminder too early/late | Mirror into `chrome.storage.local` on change (write-through in `setSrsUiPrefs` or settings save); single read path for SW |

## Decision

go — direct user request, every primitive exists in-repo (alarm precedent, IDB-in-SW, deep-link, streak/due stats, settings UI slots), blast radius small (new optional permission + one scheduling module), and the one platform trap (update-disable) has a clean known mitigation.

## Draft Acceptance Criteria

- [ ] With reminder enabled and 0 reviews today, a notification appears at the configured time carrying due count + streak; with ≥1 review, none appears.
- [ ] Clicking the notification opens the srs-study page in a tab.
- [ ] At most one reminder fires per study-day across SW restarts and browser relaunches.
- [ ] A reminder whose fire time passed while the browser was closed fires on next launch iff still unstudied.
- [ ] Disabling the toggle prevents all future notifications; enabling requests `notifications` permission in-context and a denied state is shown in settings.
- [ ] After sufficient history (≥ min-sample sessions), the fire hour moves toward the observed modal study hour; before that it stays at the chosen hour.
- [ ] `manifest.json` keeps `notifications` under `optional_permissions` only.
- [ ] SW reads all reminder config/state from `chrome.storage.local`; no `localStorage` dependency.
