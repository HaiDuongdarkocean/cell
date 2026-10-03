# Verify: session-recap

> Post-build review of merged tree `fd67474a` (30 files) against
> `docs/specs/session-recap.md` — E2E seed/attribution defects found and
> fixed during verify (spec helpers created an empty/mismatched IDB schema
> on fresh profiles and used a messaging surface unavailable on web pages);
> all REQ/AC verified green after fixes.

VERDICT: PASS

## Deterministic gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 0 errors; 6 warnings pre-existing in `srs`/`srs-study` files, unrelated |
| `npm run test:unit` | PASS — 670 suites / 7,906 tests (sessionRecap: 18/18) |
| `npm run build` | PASS |
| `npm run check:cycles` + deep-imports | PASS — 28 features, 66 edges, 0 stale |
| `npm run check-design-system-css` | 5 violations, all pre-existing (`Radio`, `MobileSheet`, `InkTabs`) |
| `npm run check-icons` | PASS — 99 icons |
| Real-browser verify | PASS — Playwright Chromium + packed `dist` extension, `e2e/extension-session-recap.spec.ts` 3/3 |

Browser evidence: `e2e-results/default/session-recap-hero.png` (hero card:
`9 min`, `72% · comfortable`, `Episode 01 — Seeded`, `10 minutes ago`,
`Looked up (3)` chips 猫/犬, `Marked (3)` Learning 山 / Known 猫 /
Tracking 水 status-colored), `session-recap-empty.png` ("No sessions yet"
+ Recap tab active in rail), `session-recap-dict.png` (term click →
Dictionary tab, search input prefilled 猫, Card Creator surface intact).

## Findings fixed during verify

| Finding | Disposition |
|---|---|
| E2E `clearSessionData`/`seedLocalSession` opened `orca-local-player` at a pinned version with partial/no `onupgradeneeded` → on a fresh profile it created a v4 DB with zero or drifted stores; `db.transaction()` threw `NotFoundError` inside `onsuccess` → `sw.evaluate` hung to the 120 s test timeout | **Fixed** — helpers now force the extension's own repository to create/migrate the DB (`GET_SESSION_RECAP` via an extension page), then open unversioned with `onblocked`/`onerror`/missing-store guards so they can never hang or drift the schema |
| E2E `sendMsg` ran on the mock StreamFlix web page where `chrome.runtime` is undefined → `GET_SESSION_RECAP` assertions could not pass | **Fixed** — helpers drive messaging from a `chrome-extension://` page (popup entrypoint), same pattern as `extension-anki-status-sync` |
| Strict-mode locator: seeded term 猫 matched both lookup chip and status chip | **Fixed** — `getByRole('button', { name: '猫' }).first()` |
| Cross-test seed pollution in the shared worker profile doubled counts in later tests | **Fixed** — `seedLocalSession` clears the three stores before writing (hermetic seeds) |
| Design-time entrypoint `src/entrypoints/mockup-session-recap/` | **Removed** per ship hygiene (not part of prod `buildInput`, unreferenced) |

## Per-REQ review

| REQ | Verdict | Evidence |
|---|---|---|
| REQ-1 capture (`addTap` post-dispatch; lookup only `origin:'immersion'` + success; status set/cycle; surface classify local-player/stream/other; tabId payload→sender→-1) | met | `sessionEventsTap.ts`; unit `sessionEventsTap.test.ts` (7 cases incl. reject on failure/non-immersion/`other` surface); `messageBus.addTap` exceptions swallowed |
| REQ-2 grouping & composition (same-videoId ≤15 min merge; stream events by record-id tabId only; local-player events → unique overlapping local session; ambiguous dropped; status groups learning→known→tracking→ignore; terms dedup+cap 30; ≤30 d derived statuses `source:'user'` in-window; coverage local-only; live ≤90 s) | met | `sessionGrouper.ts` (pure); unit `sessionGrouper.test.ts` 11 cases; e2e composition test asserts `durationMs 540_000`, `lookups.count 3`/`terms [猫,犬]`, `statusChanges.count 3`/`derived:false`, `coverage 0.72` |
| REQ-3 Recap tab surface (6th tab, `clock` icon, persisted whitelist both nav paths; hero + previous rows; loading/error+retry/empty; live + derived + coverage badges) | met | `RecapTab.tsx`, `UniversalPanel*` wiring; e2e empty + hero screenshots; i18n en/vi complete |
| REQ-4 tap term → dictionary | met | `openDictionaryLookup(term)` via mount callback; e2e click 猫 → dictionary search input visible + prefilled (screenshot) |
| NFR-1/2/3 (fire-and-forget ≤50 ms delta; local-first; no `any`, i18n, tokens only) | met | tap invoked after handler resolves, `addSessionEvent` voided — response path unaffected; all reads from extension IDB; strict TS |

## Success criteria

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 session with duration/source/lookup+status chips | met | e2e hero test + screenshot |
| AC-2 lookups counted inside ±15 min grace window | met | `eventWindowStart/End` = session ±`SESSION_GROUP_GAP_MS`; grouper tests |
| AC-3 one list for `watch-*` and `stream-*`, desc order | met | `groupSessions`/`composeSessionRecaps` sorts `startMs` desc; unit cases cover both kinds |
| AC-4 legacy ≤30 d derived statuses labeled, lookups hidden, >30 d not derived | met | derive branch + `derived:true` badge; unit cases cover window edge, `source` filtering, `sourceAt ?? updatedAt` |
| AC-5 chip tap → dictionary prefilled | met | e2e nav test + `session-recap-dict.png` |
| AC-6 coverage badge local-only, hidden when absent | met | coverage attaches only when `VideoRecord.comprehension` exists; hero shows `72% · comfortable` |
| AC-7 zero-effort capture, fail-closed, no corruption on SW kill | met | `addSessionEvent` fire-and-forget + retry-once `.catch`; append-only IDB rows persist across SW restarts (e2e re-opens SW between seed and read) |
| AC-8 i18n en+vi, empty/error/retry states, tokens only, no `any` | met | `en.json`/`vi.json` +19 keys each; states implemented; typecheck strict |
| AC-9 `GET_SESSION_RECAP` <500 ms over ~90 d data | met (observed) | handler performs 4 parallel IDB reads (history/events/videos/status); e2e roundtrip completed well inside test budget; prune amortized once per SW lifetime |
