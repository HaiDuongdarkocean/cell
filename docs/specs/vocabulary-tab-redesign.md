# Spec: Vocabulary tab redesign — responsive IA, view/edit modes, 24h trash

> Intent: `docs/intent/vocabulary-tab-redesign.md` · ui_surface: yes · Mode: interactive

## Objective

Rebuild the vocabulary tab's information architecture so it is usable at every Universal Panel width, and give word removal a 24-hour soft-delete window: the tab's Remove action moves a word into a dedicated trash store/view (restorable), while `unknown` stops being a persisted status altogether — only `tracking | known | ignore` rows exist.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | opens tab, picks a filter segment, types a query, picks a sort, taps Edit/Done, taps row, taps status badge, taps Remove, confirms dialog, taps Restore, taps delete-forever | query text, sort choice, filter choice, mode toggles, per-row actions, dialog confirm/cancel | filtered/sorted list, trash view w/ retention info, status badges, dialogs, empty states |
| Content-script surfaces (status keys, popup footer, tokenize) | `WORD_STATUS_SET/CYCLE` messages incl. transitions to `unknown` | langCode, term, status | broadcasts `WORD_STATUS_CHANGED/DELETED` |
| Other tabs' surfaces | `WORD_STATUS_CHANGED/DELETED` broadcasts | langCode, term, status | live status updates |

System-internal processing never includes human behavior. Decisions ("learner chooses edit") are actor inputs, not system steps.

## Requirements

### Functional

REQ-1: Browse and filter the vocabulary list
- Actor: Learner
- Goal: see marked words narrowed to one status or all
- Preconditions: panel open on Vocabulary tab; statuses loaded for active langCode
- Basic flow:
  1. actor picks a view segment (All / Tracking / Known / Ignored / Trash)
  2. system resolves the segment: status segments filter `entries.status`; Trash swaps the list to trash entries
  3. system renders counts per segment and the matching list
- Alt flow: query/sort state composes with the segment (search applies to both list and trash); changing langCode resets view to All
- Exception: empty result → localized empty state (distinct copy for empty list vs empty filter vs empty trash)
- Rules: single-select segment model implemented as a `tablist`-role segmented control (InkTabs/Dictionary-toolbar pattern — replaces the old multi-select chip Set); Trash is a view, not a status filter; segment counts derive from current entries + the trash-list read (post-purge survivors only)
- Postcondition: list reflects segment + query + sort
- NFR refs: NFR-1, NFR-3, NFR-4

REQ-2: Search within vocabulary
- Actor: Learner
- Goal: find a word by substring
- Preconditions: list or trash view active
- Basic flow:
  1. actor types into the search field
  2. system filters current view case-insensitively on `term`
  3. system renders filtered result and resets pagination
- Alt flow: clearing query restores the unfiltered view
- Exception: none beyond empty-state rendering
- Rules: the search field occupies its own full-width row — it never shares a horizontal row with the sort control at any width
- Postcondition: view filtered by query
- NFR refs: NFR-1, NFR-4

REQ-3: Sort the vocabulary list
- Actor: Learner
- Goal: order words by recency, alphabet, or status group
- Preconditions: a status segment active (not Trash)
- Basic flow:
  1. actor picks a sort option
  2. system orders filtered entries (`recent` = updatedAt desc; `alpha` = localeCompare base; `grouped` = STATUS order then updatedAt desc)
  3. system renders the reordered list
- Alt flow: in Trash view the sort control is hidden — trash is always ordered `trashedAt` desc
- Exception: none
- Rules: `grouped` ordering uses the three persisted statuses only
- Postcondition: list ordered per selection
- NFR refs: NFR-1, NFR-4

REQ-4: Look up a word
- Actor: Learner
- Goal: open dictionary detail for a listed term
- Preconditions: list rendered
- Basic flow:
  1. actor taps a term
  2. system delegates to the parent `onLookup(term)`
  3. parent switches to the Dictionary tab
- Alt flow: same behavior for terms inside the trash view
- Exception: none
- Rules: unchanged contract with `mountUniversalPanel` (preserved behavior)
- Postcondition: dictionary lookup opened
- NFR refs: none

REQ-5: Cycle a word's status
- Actor: Learner
- Goal: advance a word through the status cycle
- Preconditions: row rendered in a status segment
- Basic flow:
  1. actor taps the status badge on a row
  2. system cycles tracking→known→ignore→(unmark); landing on `unknown` deletes the status row (REQ-8)
  3. system broadcasts the change and updates all listening surfaces
- Alt flow: badge also usable in edit mode (status change is not destructive)
- Exception: persistence failure → error alert in tab, row keeps prior status
- Rules: a word that reaches `unknown` leaves the vocabulary list entirely (no stored unknown row); preserved cycle UX from current build
- Postcondition: new status persisted, or word unmarked
- NFR refs: NFR-2

REQ-6: Toggle edit mode
- Actor: Learner
- Goal: reveal destructive affordances only when managing the list
- Preconditions: a status segment active (not Trash)
- Basic flow:
  1. actor taps the Edit control
  2. system enters edit mode: per-row Remove buttons appear; the control switches to Done
  3. actor taps Done → system returns to view mode, Remove buttons hidden
- Alt flow: switching to the Trash segment exits edit mode; returning to a status segment starts back in view mode (mode does not persist across segment switches); mode also resets on langCode change
- Exception: none
- Rules: view mode is the default; view-mode rows contain zero destructive controls; trash view has no edit mode (its actions are always visible)
- Postcondition: mode state reflects last toggle
- NFR refs: NFR-2, NFR-4

REQ-7: Remove a word (soft-delete to trash)
- Actor: Learner
- Goal: unmark a word with a recovery window
- Preconditions: edit mode active; row rendered
- Basic flow:
  1. actor taps Remove on a row
  2. system shows a confirmation dialog naming the term and the trash retention
  3. actor confirms → system sends `WORD_STATUS_TRASH {langCode, term}` (payload carries no status — see Rules); the background handler runs ONE multi-store IDB transaction over `[langWordStatus, langWordTrash]`: reads the current status row (handler-derived `previousStatus`), writes `{term, previousStatus, trashedAt}`, deletes the status row
  4. system broadcasts `WORD_STATUS_DELETED` and emits the local removed event (broadcast excludes the source tab); the row leaves the list and the word appears in the Trash view
- Alt flow: actor cancels → nothing changes; term has no status row → handler writes nothing and reports success (idempotent remove)
- Exception: transaction failure → error alert; multi-store tx means the word is never left in both stores by a partial write
- Rules: this is the ONLY entry path to trash; it bypasses the `unknown`→delete normalization (REQ-8) so the trash record cannot self-cancel; `previousStatus` is always derived inside the transaction, never client-sent (racy)
- Postcondition: word unmarked everywhere, recoverable for 24h
- NFR refs: NFR-2, NFR-4

REQ-8: Persist only the three statuses
- Actor: content-script surfaces (status keys, popup footer, cycle)
- Goal: marking `unknown` unmarks the word
- Preconditions: a `WORD_STATUS_SET {status:'unknown'}` or cycle landing on `unknown` arrives
- Basic flow:
  1. surface sends set/cycle message
  2. system normalizes `unknown` to a status-row delete inside `setWordStatus` (single normalization point — callers unchanged)
  3. system broadcasts the resulting state (`'unknown'` via CHANGED, identical to today); list surfaces treat an incoming `changed{status:'unknown'}` event as a removal — no in-memory `unknown` entries
- Alt flow: a successful write of `tracking|known|ignore` also deletes any pending trash record for the term (re-marking cancels pending deletion); `unknown` writes do NOT touch trash records (already-unmarked word keeps its recovery window)
- Exception: delete failure → error propagated to caller as today
- Rules: `getWordStatus` still returns `'unknown'` for absent rows — no caller-visible change; `getAllWordStatuses` filters out and physically removes legacy `unknown` rows it encounters (readwrite sweep on list read)
- Postcondition: store holds only tracking/known/ignore rows
- NFR refs: NFR-2

REQ-9: View the trash
- Actor: Learner
- Goal: inspect pending-deletion words with retention info
- Preconditions: panel open on Vocabulary tab; Trash segment selectable
- Basic flow:
  1. actor picks the Trash segment
  2. system sends `WORD_STATUS_TRASH_LIST`; the handler purges expired records (`trashedAt` older than 24h) then reads `langWordTrash`
  3. system renders rows: term, previous status, remaining-time text (i18n pattern like "Xh left" / "<1h left"); search composes; rows paginate with the same `PAGE_SIZE` list mechanism
- Alt flow: empty trash → localized empty state
- Exception: `TRASH_LIST` failure → error alert; current view kept
- Rules: ordering fixed `trashedAt` desc; retention copy explains the 24h rule
- Postcondition: trash view rendered
- NFR refs: NFR-1, NFR-4

REQ-10: Restore a trashed word
- Actor: Learner
- Goal: recover a word before expiry
- Preconditions: trash view shows the term
- Basic flow:
  1. actor taps Restore on a trash row
  2. system sends `WORD_STATUS_RESTORE {langCode, term}`; the handler runs ONE multi-store transaction: reads the trash record, writes `{term, status: previousStatus, updatedAt: now}` to `langWordStatus`, deletes the trash record
  3. system broadcasts `WORD_STATUS_CHANGED` and emits the local changed event; the row leaves the trash view and the word reappears in the main list
- Alt flow: `previousStatus` missing/corrupt → restore as `tracking`; trash record missing → report success (idempotent)
- Exception: transaction failure → error alert, word stays trashed
- Rules: single multi-store tx — the word can never exist in both stores after restore; `updatedAt` stamps the restore time so `recent` sort treats it as newly marked
- Postcondition: word marked at previous status; trash record gone
- NFR refs: NFR-2

REQ-11: Delete a trashed word permanently
- Actor: Learner
- Goal: remove a word before its 24h expiry
- Preconditions: trash view shows the term
- Basic flow:
  1. actor taps delete-forever on a trash row
  2. system confirms via dialog, then sends `WORD_STATUS_TRASH_DELETE {langCode, term}`; the handler deletes the trash record
  3. system removes the row from the trash view
- Alt flow: cancel → nothing changes
- Exception: delete failure → error alert, record kept
- Rules: no broadcast needed — the word was already unmarked at trash time
- Postcondition: trash record gone
- NFR refs: NFR-4

REQ-12: Purge expired trash (system-internal)
- Actor: none — triggered by list reads
- Goal: enforce the 24h retention bound
- Preconditions: `trashedAt` older than `now - TRASH_TTL_MS`
- Basic flow:
  1. a trash-list read arrives (`WORD_STATUS_TRASH_LIST`)
  2. system deletes every trash record with `trashedAt < now - TRASH_TTL_MS` in the same read transaction's scope, then serves survivors only
  3. system also runs the purge on `WORD_STATUS_LIST` reads so trash cannot linger unbounded when the trash view is never opened
- Alt flow: reconcile-on-read — if a term somehow exists in both stores (e.g. a crashed client between broadcasts), the status row wins and the trash record is dropped during the sweep
- Exception: purge failure → read still served (expired rows may render once; next read retries)
- Rules: purge never touches `langWordStatus`; `TRASH_TTL_MS = 24 * 60 * 60 * 1000` is a named constant; a `WORD_STATUS_DELETE` (permanent status-row delete) also deletes any pending trash record for the term — no path may leave a restorable record for an intentionally deleted word
- Postcondition: no expired or inconsistent trash records remain
- NFR refs: NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Controls remain usable across panel widths: nothing collapses to zero width; rows/search stay readable at ≤599px; spacing breathes at ≥840px | U | verified at ~360px, ~700px (mid-band 600–839px), and ~1200px viewports |
| NFR-2 | No active-status data loss: purge touches only expired trash records; normalize touches only `unknown` writes; trash/restore run as multi-store transactions; failures surface as alerts, not silent drops | R | unit tests on store + source |
| NFR-3 | Visual/interaction language matches Universal Panel + Dictionary: shared `src/shared/ui` components, tokens, `ICON_CATALOG` icons, segmented-toolbar pattern like `DictionaryToolbar` | U | design-system check |
| NFR-4 | Every new string in `en.json` + `vi.json`; all controls expose accessible names/roles (segmented control uses `tablist` semantics) | U | i18n diff + a11y pass |
| NFR-5 | No complexity regression vs current list code (existing `selectEntries` sort cost preserved); pagination unchanged at 200 | P | existing behavior preserved |
| NFR-6 | No new dependencies; token changes only via `tokens.json`; stable `data-cell-id` hooks kept where listed | +infra | diff review |

## Flows / States

Word lifecycle (state view — term-level):

```
unmarked --mark (key/popup/cycle)--> marked(tracking|known|ignore)
marked --set/cycle to unknown-----> unmarked          (row deleted; no trash)
marked --Remove in tab (confirm)--> trashed           (tx: trash record + row deleted; DELETED broadcast)
trashed --Restore---------------> marked(previousStatus)  (tx; CHANGED broadcast)
trashed --24h TTL / delete-forever> unmarked          (record deleted; silent)
trashed --status write (3 statuses)> marked(new status)  (pending delete cancelled)
trashed --unknown write----------> trashed            (no-op — recovery kept)
```

Tab view state:

```
view(list, segment=All|Tracking|Known|Ignored)
  --segment=Trash--> view(trash list)            (edit mode exits)
  --segment=status--> view(list, segment)        (starts in view mode)
edit mode: off --Edit--> on (delete affordances) --Done--> off
  (edit mode only exists in status segments; resets on langCode change)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Filter vocabulary by status | single-select view segments (All/Tracking/Known/Ignored/Trash) with counts — Dictionary-toolbar language |
| Find a word | full-width SearchField on its own row |
| Order the list | sort Select (recent/alpha/grouped) on the secondary controls row |
| Show word detail | term button → `onLookup` |
| Track learning status | per-row status badge cycling through the 3-status cycle (unmark at wrap) |
| Manage the list | Edit/Done toggle; per-row Remove buttons (edit mode only); confirmation Dialog |
| Recover removals | `langWordTrash` store + Trash view (rows: term, previous status, remaining time, Restore, delete-forever) |
| Enforce retention | lazy purge on list reads (`TRASH_TTL_MS`) |
| Persist statuses | `setWordStatus` normalizing `unknown`→delete; `langWordStatus` store |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `WordStatusEntry` | `term` (key), `status` ∈ {tracking,known,ignore}, `updatedAt` | IDB `langWordStatus` | until unmarked |
| `TrashedWordEntry` | `term` (key), `previousStatus`, `trashedAt` | IDB `langWordTrash` (new store → `DB_SCHEMA_VERSION` 11→12) | ≤24h, lazy purge |
| Messages | `WORD_STATUS_TRASH`, `WORD_STATUS_TRASH_LIST`, `WORD_STATUS_RESTORE`, `WORD_STATUS_TRASH_DELETE` (+ payloads + registry + handlers); `WORD_STATUS_DELETE` stays as permanent status-row delete (also clears pending trash) | MV3 messaging | — |

**Alternatives considered:**
- Optional fields on `WordStatusEntry` (`trashedAt`, `previousStatus` on the same row — intent's lean): rejected — a trash row must still expose `status:'unknown'` to `getWordStatus`, leaking trash semantics into every status consumer (`by_status` index, `getTermsByStatus`, `getAllWordStatuses`); violates "unknown = absence" in practice.
- Separate `langWordTrash` store (CHOSEN): clean isolation — status queries never see trash records, purge is trivially scoped, `getWordStatus` untouched; cost is a mechanical schema bump.
- `chrome.storage` side store: rejected — splits transactional integrity (no multi-store tx), inconsistent with per-lang IDB architecture.

**Plumbing checklist (DELIVER):** `MessageType` union (`entities/message/types.ts`), zod payload schemas (`entities/message/dictionarySchemas.ts`), `registry.ts` entries, `MESSAGE_TYPES` constants, `handlers/wordStatus.ts` handlers, client functions + barrel export (`features/dictionary/index.ts`), local emits in handlers (`broadcastToOtherTabs` excludes the source tab — acting tab needs local `emitWordStatusRemoved/Changed`), `STORES.WORD_TRASH` + `createAllStores` + `DB_SCHEMA_VERSION` bump (sync test assertions per learning atom `schema-version-bump-sync-test-assertions`), `clearAllStores` must include the new store (test cleanup), `dbCache` closes on `versionchange` so the v11→v12 upgrade isn't blocked by a cached connection.

**data-cell-id stability:** keep `vocabulary-tab`, `vocabulary-row-*`, `vocabulary-term-*`, `vocabulary-cycle-*`, `vocabulary-delete-*`, `vocabulary-delete-dialog`, `vocabulary-delete-confirm`, `vocabulary-search`, `vocabulary-sort`. Retire `vocabulary-filter-*` (chips gone → segments). Add `vocabulary-segment-*`, `vocabulary-edit-toggle`, `vocabulary-trash-row-*`, `vocabulary-restore-*`, `vocabulary-trash-delete-*`, `vocabulary-trash-empty`.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (24h trash on Remove) | REQ-7, REQ-12 | AC-1, AC-2 |
| N2 (restore previous) | REQ-10 | AC-3 |
| N3 (trash view) | REQ-9, REQ-11 | AC-1, AC-4 |
| N3b (trash only via tab Remove) | REQ-7, REQ-8 | AC-5 |
| N3c (unknown = absence) | REQ-8 | AC-6 |
| N4 (responsive) | REQ-1, REQ-2, REQ-3 | AC-7 |
| N5 (view/edit modes) | REQ-6, REQ-7 | AC-8 |
| N6 (search/sort not side-by-side) | REQ-2 | AC-7 |
| N7 (filter redesign) | REQ-1 | AC-9 |
| N8 (i18n/a11y) | all REQ | AC-10 |
| N9 (no data loss / consistent events) | REQ-8, REQ-12 | AC-2, AC-6 |
| N10 (reuse DS, no deps) | NFR-3, NFR-6 | AC-11 |
| — (preserved behavior) | REQ-4, REQ-5 | AC-12 |

| Journey step | REQ |
|---|---|
| TO-BE 1 (controls/filters coherent at any width) | REQ-1, REQ-2, REQ-3 |
| TO-BE 2 (view mode clean, edit reveals delete) | REQ-6, REQ-7 |
| TO-BE 3 (word lands in trash; unknown unmarks) | REQ-7, REQ-8 |
| TO-BE 4 (restore / auto-purge) | REQ-10, REQ-11, REQ-12 |
| TO-BE 5 (panel design language) | REQ-1 + NFR-3 |

## Boundaries

- Always: reuse `src/shared/ui` + tokens + `ICON_CATALOG`; i18n for every string; keep listed `data-cell-id`s stable; barrel imports (`@/features/dictionary`) — deep-import gate; unit tests for store + source + tab.
- Ask first: any manifest/permission change (none anticipated); any new dependency (none anticipated).
- Never: edit generated token CSS/TS; hardcode colors/spacing; commit unrelated WIP files; write `unknown` status rows; leave a term in both status and trash stores.

## Success Criteria

- [ ] AC-1: Confirming Remove on a row (edit mode) deletes the status row, creates a trash record with handler-derived `previousStatus` (single multi-store tx), broadcasts `WORD_STATUS_DELETED`, emits locally, and the term appears in the Trash view.
- [ ] AC-2: A trash record with `trashedAt` older than 24h is absent after the next list/trash read (clock-mocked unit test); unexpired records survive; a term in both stores reconciles to status-row-wins.
- [ ] AC-3: Restore writes `previousStatus` back with fresh `updatedAt`, deletes the trash record (single tx), broadcasts `WORD_STATUS_CHANGED`, and the word reappears in the main list (fallback: `tracking` when `previousStatus` missing; idempotent when trash record missing).
- [ ] AC-4: Trash view lists term + previous status + remaining-time text, ordered `trashedAt` desc; delete-forever removes the record after confirmation without touching `langWordStatus`.
- [ ] AC-5: Marking `unknown` via `WORD_STATUS_SET`/cycle creates no trash record and does not delete an existing trash record; only REQ-7 creates them.
- [ ] AC-6: After `setWordStatus(term,'unknown')` or a cycle landing on `unknown`, no status row exists for the term; `getAllWordStatuses` returns zero `unknown` rows even when a legacy one was seeded (sweep verified).
- [ ] AC-7: At ~360px, ~700px, and ~1200px widths the search field renders full-width on its own row and the sort control is fully usable (verified in real browser).
- [ ] AC-8: In view mode no Remove button exists in the DOM; entering edit mode reveals them; Done hides them again; switching to Trash exits edit mode.
- [ ] AC-9: Filter control is a single-select segmented control (All/Tracking/Known/Ignored/Trash, `tablist` role) with counts, built from shared components — no wrapping chip cloud.
- [ ] AC-10: All new strings exist in `en.json` and `vi.json`; Edit/Done, Restore, delete-forever, segments, and dialogs have accessible names.
- [ ] AC-11: `npm run typecheck && npm run lint && npm run test:unit && npm run build` pass; no new dependencies; `DB_SCHEMA_VERSION` bump synced across tests asserting it.
- [ ] AC-12: Preserved behaviors hold: segment filtering + counts (REQ-1), case-insensitive search + pagination reset (REQ-2), three sort orders (REQ-3), `onLookup` delegation (REQ-4), badge cycle → unmark at wrap + failure alert (REQ-5) — covered by updated `vocabularyList`/`VocabularyTab` tests.
- [ ] AC-13: An incoming `changed{status:'unknown'}` event removes the in-memory entry (no ghost rows, empty-state still reachable).

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (tokens, shared components, no hardcoded values)
- [ ] Real-browser verification at ~360px, ~700px, and ~1200px viewports: remove → trash → restore → purge paths
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated; learning atom if a reusable lesson emerges
- [ ] Commit contains only this item's files (working tree has concurrent WIP)

## Open Questions / Accepted Risks

- Trash view does not live-sync across tabs (restore/purge in another tab won't repaint an open trash view until next read) — accepted: trash is a recovery surface, not a live dashboard; main list stays fully synced via existing events.
- Lazy purge means expired rows can exist between reads — accepted bound, records are ~100B each.
- Cycle-badge → `unknown` has no trash recovery (asymmetric with Remove) — consistent with intent N3b; revisit on user reports.
- `WORD_STATUS_DELETE` remains a permanent status-row delete in the protocol; the tab's Remove now calls `WORD_STATUS_TRASH` — spec keeps both paths for reuse.
