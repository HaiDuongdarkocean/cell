# Spec: Quản lý Đồng bộ trạng thái Anki ↔ Tihoka (anki-known-seed)

> Intent: `docs/intent/anki-known-seed.md` · ui_surface: yes · Mode: all

## Objective

Merge three divergent truths about "which words the learner knows" — Anki card state, Tihoka `wordStatus`, and Tihoka SRS card state — into one consistent status surface. A rules engine maps external card states into `wordStatus` (including a new `learning` status), an opt-in write-back marks Anki cards mature when the user marks `known` in Tihoka, and a companion Anki addon exposes a local event feed so changes propagate near-realtime (with poll/manual/post-import fallback). Conflict resolution is last-write-wins with provenance and echo suppression.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| User | marks word status; enables/disables sync settings; installs addon; clicks manual sync | status choice, settings toggles | token colors, vocabulary list, sync status panel, error notices |
| Anki desktop (via AnkiConnect) | responds to polls/queries/write-backs | card states, `setSpecificValueOfCard`/`suspend` calls | — |
| Anki bridge addon | emits review/edit/add events on localhost feed | — | — (consumed by extension poller) |
| Tihoka SRS engine | review completes → card state change | card maturity transitions | — |
| Drive sync | merges wordStatus records cross-device | `{term,status,updatedAt,source?}` records | merged status |

System-internal processing never includes human behavior. "User marks known" is actor input; the write-back is a system flow.

## Requirements

### Functional

REQ-1: `learning` word status
- Actor: system (internal vocabulary change)
- Goal: represent "currently being learned" as distinct from `tracking` (intent to learn) and `known`
- Preconditions: existing statuses `unknown|tracking|known|ignore`
- Basic flow:
  1. system extends `WordStatus` union + `STATUS_CYCLE` in `entities/dictionary/popupTypes.ts` → cycle order `unknown → tracking → learning → known → ignore`
  2. system adds `--color-token-status-learning` (+ `-bg`) tokens in `tokens.json` (both light + dark sections) and `chip-status.learning-*` entries
  3. system accepts `learning` in `WORD_STATUSES` validation set, IDB writes, Drive sync value shape, vocabulary browser filters/chips, status keymap (`'5'` → `learning`; existing 1–4 mappings unchanged)
- Alt flow: legacy data — no stored rows need migration (`learning` is additive; existing rows unchanged)
- Exception: older extension version receiving a `learning` record via Drive sync → `putMaterializable` rejects it (`WORD_STATUSES` guard, `dictLocalSource.ts`) — record is dropped on apply, no corruption, possibly re-pulled each cycle until the old client updates. Accepted degradation; documented for support. Surfaces to extend include the `WordStatus` zod enum in `entities/message/dictionarySchemas.ts`, `WORD_STATUSES` in `dictLocalSource.ts`, and every `setWordStatus` caller surface stamping provenance (popup status keys, vocabulary browser, subtitle block actions, Quick Add)
- Rules: `unknown` still normalizes to row delete; `learning` is a persisted real status; cycle position `tracking → learning → known` means popup footer click passes through `learning` en route to `known` — accepted UX (all-mode decision, reversible)
- Postcondition: `learning` renders, cycles, syncs, and persists like existing statuses
- NFR refs: NFR-1, NFR-4

REQ-2: Card-state → status rules engine (pure function)
- Actor: system
- Goal: one deterministic mapping consumed by all three sync legs
- Preconditions: `NormalizedAnkiCard`-like input `{queue, ivl}` (`queue=-1` encodes suspended — no separate field) and Tihoka `{fsrsState.state, fsrsState.stability, scheduledDays}`
- Basic flow:
  1. system evaluates input → outcome ∈ `{known, learning, skip}` per mapping table below
  2. system returns outcome + reason for logging
- Rules (mapping):
  - Anki `queue ∈ {0 new, 1 learn, 3 day-learn, -2/-3 buried}` → `learning`
  - Anki `queue=2 review` ∧ `ivl < 21` → `learning`
  - Anki `queue=2 review` ∧ `ivl ≥ 21` → `known`
  - Anki `queue=-1 suspended` → `skip` (never touched)
  - Tihoka SRS card exists ∧ max component `scheduledDays < 21` → `learning`
  - Tihoka SRS max component `scheduledDays ≥ 21` → `known`
  - Both sources present → the *stronger* outcome wins (`known` > `learning` > `skip`)
- Exception: malformed card row → `skip` + warn-log
- Postcondition: pure, unit-tested function; no IO
- NFR refs: NFR-3

REQ-3: Anki → wordStatus inbound sync
- Actor: system (timer/manual/import trigger); AnkiConnect
- Goal: write mapped statuses for terms that have Anki cards
- Preconditions: AnkiConnect URL configured (`settings.cardCreator.ankiConnectUrl`); profile langCode known
- Basic flow:
  1. trigger fires (alarm tick, manual button, post-import, addon event batch)
  2. system queries `findCards` (query `edited:<days>` day-granularity — Anki search has no timestamp syntax) → `cardsInfo` → client-side filter on each card's `mod` field vs `lastSyncAt` → builds term→card map for target-field terms
  3. system applies REQ-2 rules per term → candidate status
  4. system writes via status-sync writer (REQ-7) only when outcome differs and wins LWW
  5. system records `{lastSyncAt, cardsSeen, changed, errors}` to sync-state record
- Alt flow: incremental sync — addon feed supplies changed card ids; only those terms re-mapped
- Exception: AnkiConnect unreachable → poll skips silently, sync-state records `offline`; manual sync surfaces localized error toast
- Rules: only terms present in the language profile's term normalization form; suspended cards never write
- Postcondition: wordStatus reflects Anki truth where Anki is newer
- NFR refs: NFR-2, NFR-5

REQ-4: Tihoka SRS → wordStatus sync
- Actor: Tihoka SRS engine (review completion); system
- Goal: card maturity transitions update wordStatus
- Preconditions: SRS card exists for a term
- Basic flow:
  1. SRS review write completes → system emits internal event (hook on the existing review-persist path, not a timer)
  2. system maps via REQ-2 → writes via REQ-7 writer
- Alt flow: Anki-imported SRS cards (`importSource`) already carry maturity → post-import batch pass seeds statuses (same writer)
- Exception: write fails (quota) → warn-log, no crash; retry on next review
- Rules: same stronger-outcome merge as REQ-2
- Postcondition: studying in Tihoka updates status without touching Anki
- NFR refs: NFR-3

REQ-5: wordStatus `known` → Anki write-back (opt-in)
- Actor: user (marks `known`); system
- Goal: mature the corresponding Anki card
- Preconditions: `settings.ankiStatusSync.enabled = true` ∧ `settings.ankiStatusSync.writeBackEnabled = true` (write-back toggle is gated on enabled — disabled in UI while sync off; default OFF); term has ≥1 non-suspended Anki card
- Basic flow:
  1. user marks term `known` (popup key, vocabulary, subtitle)
  2. system's status-write path detects `status='known'` ∧ provenance `source='user'` → enqueues write-back task
  3. system calls AnkiConnect `setSpecificValueOfCard` (params `{card: <id>, keys: ['ivl','queue','type','due'], values: [...]}`) setting `ivl=max(21, current)`, `queue=2`, `type=2`, `due=<relative day offset ≥ today+1>` — `due` is mandatory: cards leaving new/learn/day-learn queues carry epoch/position `due` values that would be unschedulable as review dues. For filtered-deck cards (`odid≠0`) the system also writes `odue=due` and leaves `odid` untouched
  4. system records write-back result `{cardId, ok, at}` in sync-state log (bounded ring, ~200 entries)
- Alt flow: `setSpecificValueOfCard` unsupported → fallback `setDueDate`+`reschedule` is NOT attempted (too risky); instead mark card `suspend` is not a substitute → system logs `unsupported`, surfaces one-time notice
- Exception: AnkiConnect down → task queued with retry (flushed on next successful sync tick or manual "Sync now", max 24h TTL); disabling sync leaves queued tasks dormant until re-enabled or TTL expiry; mark-status itself never blocks
- Rules: write-back never creates cards; never touches suspended cards; only `user`-sourced `known` triggers it (sync-derived `known` does NOT write back — echo suppression)
- Postcondition: Anki card mature or logged failure; user-facing status write unaffected
- NFR refs: NFR-5, NFR-6

REQ-6: Anki bridge addon (`extras/anki-bridge/`)
- Actor: Anki desktop with addon installed
- Goal: near-realtime event feed without AnkiConnect polling lag
- Preconditions: addon copied into Anki addons dir (manual install, documented)
- Basic flow:
  1. addon hooks Anki reviewer/state-change events (review answered, card added/edited, suspend toggle)
  2. addon appends `{cardId, kind, ts}` to an in-memory + JSONL cursor buffer
  3. addon serves `GET /events?since=<cursor>` on `127.0.0.1:<port>` (default 8766, configurable via `settings.ankiStatusSync.addonPort`; localhost only — existing `<all_urls>` host permissions + `connect-src http:` CSP already cover it)
  4. extension polls the feed on the 5-min `chrome.alarms` tick (30s floor respected — alarms ≥30s; alarm is 5min like the existing SYNC_TICK pattern) + on tab-focus/on-demand triggers; card ids → `cardsInfo` lookup → REQ-2
- Alt flow: addon absent → connection refused → system uses plain poll path (REQ-3 `edited:N` + `mod` client filter)
- Exception: feed returns malformed rows → skip + log; cursor only advances past parsed rows
- Rules: addon is push-shaped but pull-implemented (extensions cannot listen on sockets); feed keeps ≥7 days of events or 10k rows; shipped as `extras/anki-bridge/` with install README, distributed as a zip in release assets (AnkiWeb publishing is a separate decision owned by release — recorded)
- Postcondition: near-realtime propagation when addon installed (bounded by poll cadence); graceful degradation when not
- NFR refs: NFR-2, NFR-5

REQ-7: Conflict resolution — LWW + provenance + echo suppression
- Actor: system
- Goal: newest write wins; sync writes never retrigger sync
- Preconditions: `WordStatusEntry` gains optional `source?: 'user'|'anki'|'srs'|'import'` and `sourceAt?: number`; the Drive `wordStatus` wire shape extends to `{term, status, updatedAt, source?, sourceAt?}` so provenance survives cross-device — a second device without Anki inherits Anki-derived statuses (product consequence stated: statuses replicate; write-back does NOT retrigger on remote-applied writes)
- Basic flow:
  1. every status write carries `{source, sourceAt}`; user writes stamp `source='user', sourceAt=now`; all existing `setWordStatus` caller surfaces (popup status keys, vocabulary browser, subtitle block, Quick Add) pass `source='user'`
  2. sync writer compares candidate `sourceAt` vs stored `updatedAt` → writes only if `sourceAt > updatedAt` (strict)
  3. tie (`sourceAt === updatedAt`) → source priority `user > anki > srs > import`
  4. remote-applied writes (arriving via `writeRemote`) carry their `source` through and are exempt from REQ-5 write-back — write-back triggers only on local `source='user'` writes, so remote echo is impossible
- Alt flow: Anki `mod` is seconds-precision → system multiplies ×1000 and subtracts 1 (conservative: prefer existing entry on boundary)
- Exception: clock skew > 5min detected (candidate `sourceAt` in future beyond skew) → clamp to `now`, log once
- Rules: `known` never downgrades to `learning`/`tracking` via sync writes unless the newer write is `user`-sourced; `tracking → known` upgrade always allowed; remote merge participates in the same arbitration (already LWW on `updatedAt` in `dictLocalSource.ts` — extended fields ride along)
- Postcondition: no A→B→A loops locally or across devices; deterministic winner; provenance visible in the synced record
- NFR refs: NFR-3, NFR-5

REQ-8: Sync status surface + settings
- Actor: user
- Goal: see sync state and control it
- Preconditions: settings slice `ankiStatusSync` added (schema v34)
- Basic flow:
  1. user opens Settings → new "Anki status sync" section (in `media`/new group per settings convention)
  2. system renders: enabled toggle (default ON), write-back toggle (default OFF, gated on enabled — disabled with explanatory hint while sync is off, with risk copy), addon port field (default 8766), manual "Sync now" button (also flushes queued write-back tasks), last-sync line `{time, +changed, errors}`, addon connected indicator
- Alt flow: addon absent → inline hint with install instructions link + "still syncing via poll" copy
- Exception: consecutive failures (≥3) → surface warning state
- Postcondition: user can audit and control the feature
- NFR refs: NFR-1, NFR-4

REQ-9: Status surface parity for `learning`
- Actor: user
- Goal: `learning` visible everywhere statuses appear
- Basic flow:
  1. tokenize layer colors `learning` tokens (new token color)
  2. vocabulary browser: filter option + chip + counts include `learning`
  3. dictionary popup status footer + status-key hints show 5 states
  4. Drive sync round-trips `learning`
- Rules: i18n en+vi keys for label `learning` everywhere status labels exist
- NFR refs: NFR-1, NFR-4

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | UX consistency | U | `learning` visually distinct; ≥4.5:1 contrast on token bg per existing token pattern |
| NFR-2 | Latency | P | addon path <60s propagation; poll path ≤5min; status write path adds <5ms |
| NFR-3 | Correctness | R | rules engine 100% unit-covered incl. boundary ivl=21, suspended, both-sources |
| NFR-4 | i18n/a11y | U/S | all new copy en+vi; new controls keyboard+screen-reader reachable |
| NFR-5 | Fail-safe | R | Anki unreachable / addon absent / write-back unsupported never crash primary flows; write-back opt-in + retry TTL |
| NFR-6 | Data safety | S | write-back modifies only `ivl/queue/type` of existing cards; bounded write-back log; never suspends/deletes |

## Flows / States

### Inbound sync tick (REQ-3/6)

```
tick/manual/event ──► addon feed? ──yes──► changed cardIds ──► cardsInfo ──┐
                     │no                                             │
                     └──► findCards(mod>lastSync) ───────────────────► rules engine
                                                                           │
                          per term: outcome ≠ stored ∧ LWW wins ──► write wordStatus
                                                                           │
                                                              sync-state record update
Anki unreachable ──► status=offline, exit silently (poll) / toast (manual)
```

### Write-back (REQ-5)

```
user mark 'known' (source='user')
  → write wordStatus (always)
  → writeBackEnabled? → lookup term→cardIds
      → no card: done        → cards: setSpecificValueOfCard(ivl≥21, queue=2, type=2)
      → success: log         → fail/unsupported: queue retry ≤24h + notice
```

### Status write arbitration (REQ-7)

```
incoming {status, source, sourceAt}
  → sourceAt > entry.updatedAt → write
  → sourceAt = entry.updatedAt → higher source priority writes
  → sourceAt < entry.updatedAt → drop (+conflict log)
  → status='known' ∧ stored='known' → no-op
  → sync-write ∧ status weaker than stored 'known' → drop (no downgrade)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Represent "learning" as a first-class status | `learning` in `WordStatus`/`STATUS_CYCLE`; token + chip colors; keymap `5`; vocabulary filter |
| Decide word status from card states | `ankiStatusSync/lib/statusRules.ts` pure mapper |
| Pull Anki state into wordStatus | `ankiStatusSync` service (alarms tick + manual + post-import); card→term link cache (`ankiTermLinks` IDB store) |
| Push Tihoka SRS state into wordStatus | review-write hook; post-import seed pass |
| Reflect `known` back to Anki | write-back task queue; `setSpecificValueOfCard` caller; bounded result log |
| Near-realtime Anki events | `extras/anki-bridge/` Python addon + localhost feed poller |
| Resolve concurrent writes safely | provenance fields on `WordStatusEntry`; LWW arbitration in the status-write path |
| Show/control sync | settings section + sync-state store + manual sync button + addon indicator |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `WordStatusEntry` (extended) | `term, status, updatedAt, source?, sourceAt?` | `langWordStatus` IDB store + Drive domain `wordStatus` (wire shape `{term,status,updatedAt,source?,sourceAt?}`) | until user deletes / `unknown` |
| Anki card link row | `cardId, term, deck, queue, ivl, mod, lastSeenAt` | new `ankiTermLinks` store (sync DB or dedicated — decide at build; recommend `cell-sync` adjacent DB) | refreshed per sync; orphaned rows pruned when card gone |
| Sync state record | `lastSyncAt, cursor, cardsSeen, changed, failures, addonConnected` | `chrome.storage.local` key `ankiStatusSync.state` | singleton |
| Write-back log entry | `cardId, term, ok, error?, at` | `chrome.storage.local` `ankiStatusSync.writeBackLog` | ring buffer, 200 |
| Settings slice | `enabled, writeBackEnabled, addonPort` | `settings.ankiStatusSync` (schema v34) | persistent |
| Addon event | `{cardId, kind, ts, cursor}` | addon-side JSONL + in-memory | ≥7d / 10k rows |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 Anki card → wordStatus rules | REQ-2, REQ-3 | SC-1, SC-2 |
| N2 `learning` status | REQ-1, REQ-9 | SC-3, SC-8 |
| N3 SRS state → wordStatus | REQ-2, REQ-4 | SC-4 |
| N4 known → Anki mark mature | REQ-5 | SC-5 |
| N5 realtime addon + fallback | REQ-6, REQ-3 | SC-6 |
| N5 offline/failure resilience (edge) | REQ-3, REQ-5 | SC-10 |
| N6 LWW + provenance | REQ-7 | SC-7 |
| N7 upgrade tracking→known, no downgrade | REQ-7 | SC-7 |
| N8 sync status visibility | REQ-8 | SC-9 |

| Journey step | REQ |
|---|---|
| TO-BE 1 sync seeds learning/known | REQ-2, REQ-3, REQ-6 |
| TO-BE 2 coverage correct, learning color | REQ-1, REQ-9 |
| TO-BE 3 mark known → Anki mature; Anki review → Tihoka status | REQ-5, REQ-6, REQ-3 |
| TO-BE 4 offline/resume/race/failure handling | REQ-3, REQ-5, REQ-7 |

## Boundaries

- Always: run `typecheck && test:unit && build` before commit; rules engine pure + unit-tested; write-back opt-in default OFF; i18n en+vi for all copy; provenance stamped on every status write
- Ask first: manifest permission changes (verified unnecessary — `<all_urls>` + `connect-src http:` already cover `127.0.0.1:8766`); new npm dependencies (none anticipated — addon is Python, no dep)
- Never: auto-create Anki cards; suspend/delete Anki cards; downgrade `known` via sync writes; modify `sync-on-use` files; regenerate manifest key

## Success Criteria

- [ ] SC-1: Given Anki cards across all queue/ivl classes, a sync run writes `known` for review+ivl≥21, `learning` for new/learn/day-learn/buried/review<21, and leaves suspended untouched (unit + integration test)
- [ ] SC-2: `ankiTermLinks` cache drives incremental sync — a second tick with no changes performs no status writes (log assertion)
- [ ] SC-3: `learning` renders with its own color in tokenized text and appears in STATUS_CYCLE at position `tracking → learning → known`; key `5` applies it
- [ ] SC-4: Completing a Tihoka SRS review that crosses the maturity threshold updates wordStatus without manual action
- [ ] SC-5: With write-back enabled, marking `known` results in `setSpecificValueOfCard` call (mocked AnkiConnect); with it disabled or `source≠user`, no call is made
- [ ] SC-6: With addon feed running (fixture server), a card event propagates to a status change on the next poll; without it, the standard poll path still syncs
- [ ] SC-7: LWW test: newer `user` write beats older `anki` write; sync-write to `known` never downgrades; an `anki`-sourced `known` write does NOT trigger write-back (no echo loop)
- [ ] SC-8: Vocabulary browser filters/lists `learning`; Drive sync round-trips a `learning` entry through merge
- [ ] SC-9: Settings section shows enabled/write-back toggles, last-sync summary, addon indicator; manual sync button triggers a sync run and reports result
- [ ] SC-10: AnkiConnect unreachable → poll tick exits cleanly, manual sync shows localized error, status writes still work locally

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run test:unit && npm run build` green
- [ ] `learning` status passes design-system check (tokens, chip styles)
- [ ] Real-Chrome verification: mock AnkiConnect HTTP server + fixture addon feed; settings panel screenshot evidence
- [ ] Addon ships under `extras/anki-bridge/` with install README
- [ ] Canon docs updated: `docs/2-architechture-system.md` (sync architecture), `docs/0-wiki.md` changelog; ADR for write-back safety decision

## Open Questions / Accepted Risks

- `setSpecificValueOfCard` availability varies across AnkiConnect versions — accepted risk: capability-detect, degrade to `unsupported` notice; never silently corrupt
- Addon install is manual friction — accepted risk: feature is fully functional via poll; addon only reduces latency
- Clock skew between Anki `mod` (s) and Tihoka (ms) — conservative boundary handling (×1000−1) may drop boundary-tie sync writes; logged
- `learning` key=`5` and cycle position `tracking→learning→known` (popup click passes through `learning` en route to `known`) chosen without user input (all mode) — recorded decision, reversible
- Addon distribution: zip in release assets (AnkiWeb publish is a separate release-owner decision); install is manual — documented in `extras/anki-bridge/README`
- Term extraction from Anki notes reuses the import-time `targetWordOf` logic; notes whose target field mapping changed post-import link by stored term→cardId cache, not re-parse
- Rejected alternatives: AnkiConnect-only realtime (impossible — no push API); native messaging addon→extension (too heavy vs localhost feed); `setDueDate`/`reschedule` write-back fallback (rejected — scheduling semantics too risky); suspending cards as maturity proxy (rejected — not equivalent)
