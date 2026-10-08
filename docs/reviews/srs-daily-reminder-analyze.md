# Analyze review — srs-daily-reminder

Mode: `all` — fresh-context audit by `subagent_explore` (read-only, falsification brief).

## Checklist results

1. **Citations — PASS.** All sampled `file:line` claims verified: `reviewEventRepository.ts:79-88` (by_timestamp range query), `srsUiPrefs.ts:20-46` (localStorage, unreadable in SW), `ankiStatusSync.ts:97-120` (IDB access + alarm pattern in SW), `handlers/srs.ts:79-103` (deep-link), `getSrsHomeStats.ts:54-190` (dayKeyFor/dayStartMs/computeStreak/getStreakStats + ponytail note), `manifest.json` (alarms present, notifications absent, no optional_permissions yet), `config.ts:233` (365d retention). Zero existing `chrome.notifications` usage — no mechanism was missed.
2. **Needs vs solutions — FAIL (minor).** N7/N8 were solution-shaped; restated as needs (constraints moved to evidence).
3. **Journey — PASS.** AS-IS 5 steps, TO-BE 7 steps ending on value.
4. **ui_surface — PASS.** Settings toggle + notification are user-visible → `yes`.
5. **Decision go — PASS.** Update-disable risk has verified mitigation (`notifications` is not on Chrome's cannot-be-optional list).
6. **Scope bounded — PASS.** In/Out/Non-goals map 1:1 to N1–N10.
7. **Blind spots — FAIL (4 findings, applied).** Alarm-persistence claim overstated; `dayKeyFor`/`getStreakStats`/`settingsStore` reuse overlooked; wrong API name; duplicate srs-study tabs on repeat clicks.
8. **Confidence tags — PASS.** Honest spread (60–95%), `[assumption]` where appropriate, doc-level `medium`.

## Findings + Applied fixes

| # | Severity | Finding | Fix applied to intent doc |
|---|---|---|---|
| 1 | major | N6 claimed missed `when` alarms fire on browser launch — persistence not contractually guaranteed pre-Chrome 150 | N6 restated: re-assert next fire at every `init()` (already runs on SW start/onStartup/onInstalled); new risk row added |
| 2 | minor | N7/N8 phrased as solutions | Restated as needs; `optional_permissions`/`chrome.storage.local` moved to evidence as constraints |
| 3 | minor | Reuse overlooked: `dayKeyFor`/`dayStartMs`/`computeStreak`/`getStreakStats` already exported; settingsStore is the SW-readable prefs home | Scope In now mandates reuse of exported day-boundary/stats helpers; storage choice deferred to SPECIFY |
| 4 | minor | `chrome.permissions.getPermissionLevel` doesn't exist | Corrected to `chrome.notifications.getPermissionLevel()` |
| 5 | minor | Repeated notification clicks stack duplicate srs-study tabs (`tabs.create` unconditional) | Scope In notes focus-existing-tab behavior for SPECIFY |

## Applied fixes

Findings 1–5 applied to `docs/intent/srs-daily-reminder.md` (N6/N7/N8 restated, risk row added, Scope In updated with reuse + tab-focus note, API name corrected). Doc re-read post-edit: sections intact, Journey/Decision untouched.

VERDICT: APPROVE
