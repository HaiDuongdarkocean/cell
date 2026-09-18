# Spec Review — vocabulary-tab-redesign

**Artifact:** `docs/specs/vocabulary-tab-redesign.md` · **Intent:** `docs/intent/vocabulary-tab-redesign.md` · **Rubric:** `.agents/skills/pipeline-specify/references/review-lenses.md`
**Method:** 3 independent reviewers (BA/PO lens, traceability/feasibility lens, full-rubric lens), findings merged + deduped, all claims code-verified.

## Feasibility verdict (verified against actual code)

All major architecture claims check out:
- Messaging pattern matches reality: `wordStatusClient` → `MESSAGE_TYPES` → zod schemas → `registry.ts` → `handlers/wordStatus.ts` → `broadcastToOtherTabs` → `wordStatusCrossTab` relay → `vocabularySource`. The 3 new messages (`WORD_STATUS_TRASH/_TRASH_LIST/_RESTORE`) fit this pattern.
- `DB_SCHEMA_VERSION=11` confirmed; `createAllStores` guards with `objectStoreNames.contains` → bump 11→12 creates `langWordTrash` safely on existing DBs.
- `STATUS_CYCLE` includes `'unknown'` (`popupTypes.ts:19`); legacy unknown rows provably exist (`wordStatusStore.ts:101-114` puts all statuses) → the proposed sweep is necessary and correct.
- `broadcast 'unknown'` via CHANGED is "identical to today" — normalize-at-store keeps callers unchanged.
- UI reuse feasible: `InkTabs`/`Tabs`/`SearchField`/`Select`/`Dialog`/`EmptyState`/`Pagination` all exist in `src/shared/ui/`; DictionaryToolbar pattern applicable.
- AS-IS layout claims verified (`VocabularyTab.tsx:124-144`, `.controlsRow` CSS, 839/599 breakpoints, `onLookup` contract).

## Findings

### Blockers
None.

### Major

1. **Missing delete-forever transport [§Data, REQ-11] (TL)** — REQ-11 "deletes the trash record" but §Data lists only TRASH/TRASH_LIST/RESTORE. `WORD_STATUS_DELETE` is permanent *status-row* delete, not trash-record delete. → Add `WORD_STATUS_TRASH_DELETE` (payload + schema + registry + handler) or spec an op flag.
2. **Atomicity / partial-failure gap [§Data, REQ-7 Exception, REQ-10 Rule] (TL)** — "trash write first, then delete" across two stores leaves the word in BOTH stores on mid-failure, violating "never leave the word in both stores" and the atomic lifecycle diagram. Crash-semantics wording is also wrong (crash loses nothing — creates dual state). → Require multi-store IDB tx (`db.transaction([WORD_STATUS, TRASH])` — `baseRepository.ts:115-132` supports it) for trash+delete and restore+trash-delete; add reconcile-on-read rule; fix wording.
3. **`previousStatus` provenance undefined [REQ-7 step 3] (TL)** — Client-sent payload is racy (status may change between list-read and Remove → wrong restore). → Spec: handler reads current status row inside the same tx; payload carries only `{langCode, term}`.
4. **Self-cancel footgun between REQ-7 and REQ-8 alt (TL)** — "any successful status write clears a pending trash record" can clear the record just written if Remove routes through `setWordStatus(term,'unknown')` normalize; also `unknown`-write on trashed word silently destroys recovery; state diagram `trashed → marked` is wrong for unknown writes (→ `unmarked`). → Scope clear-on-write to `tracking|known|ignore` writes only; Remove path deletes row directly (bypasses normalize); fix diagram.
5. **No Alternatives section [whole spec] (TL)** — Rubric requires ≥2 considered+rejected alternatives. Spec chose new store + schema bump, which deviates from intent's explicit guidance ("prefer optional fields on `WordStatusEntry`; bump only if an index is required") without justification. → Add Alternatives: fields-on-row vs separate store (chosen — isolation, safe purge) vs separate DB.
6. **AC coverage gaps [§Success Criteria] (PO)** — AC-7 only tests layout; no AC covers segment filtering + counts (REQ-1), case-insensitive search + pagination reset (REQ-2), 3 sort orders (REQ-3), `onLookup` delegation (REQ-4), badge cycle→unmark + exception alert (REQ-5). → Add ACs or explicitly cite existing `vocabularyList.test.ts` coverage.
7. **Receiver contract for `CHANGED{status:'unknown'}` [REQ-8] (TL)** — `vocabularySource.ts:47-55` upserts on every `changed` event → ghost `unknown` entry: invisible in all segments but inflates `entries` and breaks empty-state branch. → Spec: list surfaces treat incoming `'unknown'` as removal (equivalent to `removed`).

### Minor

8. Corrupt line ~308 — DoD item "real-browser verification at narrow/wide viewports" fused into last Open Questions bullet; restore DoD checkbox. [A]
9. "Sweeps legacy unknown rows" ambiguous — `getAllWordStatuses` uses readonly tx; clarify filter-out vs physical delete (AC-6 implies filter suffices). [A]
10. Edit-mode state crossing Trash segment undefined ("keeps mode state" vs "trash has no edit mode") — specify reset/restore on return. [A,C]
11. REQ-9 gaps: preconditions "none" (needs panel open / Trash selectable), no exception flow for `TRASH_LIST` failure, no remaining-time format, no trash pagination rule. [A,C]
12. Traceability orphans: REQ-4/REQ-5 absent from Need→REQ table (mark "preserved behavior"); N10 maps "—" (acceptable, NFR-covered); S1–S5 unmapped (optional). [B,C]
13. `data-cell-id` stability claim conflicts with redesign — `vocabulary-filter-unknown` must disappear; list which hooks keep vs change (blast radius small: only 2 test files consume). [A,C]
14. `updatedAt` on restore unspecified — affects `recent` sort. [C]
15. NFR-5 "O(n) per read" too strict — `selectEntries` sorts O(n log n); reword. [C]
16. DoD includes `npm run lint`; AC-11 omits it — sync. [C]
17. Trash count source unspecified — per-render `TRASH_LIST` call vs `trashCount` field on `WORD_STATUS_LIST`? Include expired-not-yet-purged? [A,B]
18. Plumbing checklist incomplete — missing: `MessageType` union (`entities/message/types.ts`), client fns + barrel export, and LOCAL emit (`broadcastToOtherTabs` excludes source tab → trash/restore need local `emitWordStatusRemoved/Changed` or the acting tab won't update until reload). [B]
19. `clearAllStores` hardcodes 5 stores → won't clear `langWordTrash` (test pollution); consider `db.onversionchange → close` for `dbCache` on version bump. [B]
20. `WORD_STATUS_DELETE` vs pending trash record unaddressed — permanent delete could leave stale trash record that restores a deleted word. [B]
21. Filter role semantics: `tablist` (InkTabs pattern) vs `radiogroup` — decide deliberately. [B]
22. NFR-1 verifies ~360px and ~1200px only; add mid-band checkpoint ~700px (600–839px untested). [A]

## Accepted risks
- Cycle-badge → `unknown` has no trash recovery (asymmetric with Remove) — consistent with intent N3b; revisit on user reports.
- Trash not live-synced cross-tab; lazy-purge drift (~100B/row) — documented in spec.

## Action items (must fix)
1. Add `WORD_STATUS_TRASH_DELETE` to §Data + REQ-11 — §Data/REQ-11
2. Require multi-store IDB tx for trash/restore ops + reconcile-on-read + fix crash wording — §Data/REQ-7/REQ-10
3. Spec `previousStatus` = handler-derived in same tx — REQ-7
4. Scope clear-on-write rule to persisted statuses; Remove bypasses normalize; fix state diagram — REQ-7/REQ-8/§Flows
5. Add Alternatives section justifying new store vs intent's optional-fields guidance — new section
6. Add ACs (or cite existing tests) for REQ-1/2/3/4/5 — §Success Criteria
7. Spec `'unknown'` incoming event = removal in source — REQ-8
8. Complete plumbing checklist (MessageType union, barrel, local emit, clearAllStores, onversionchange) — §Data
9. Minor edits: line 308/DoD, "sweeps" wording, edit-mode×trash, REQ-9 gaps, traceability REQ-4/5, data-cell-id list, updatedAt, NFR-5, lint/AC-11, trash count source, DELETE-vs-trash, filter role, 700px checkpoint — per §Minor

## Round-1 resolution (author applied, re-review waived by user)

All 9 action items were applied to spec v2:

1. `WORD_STATUS_TRASH_DELETE` added to §Data message list + REQ-11 flow.
2. REQ-7/REQ-10 now require ONE multi-store IDB transaction over `[langWordStatus, langWordTrash]`; REQ-12 alt flow adds reconcile-on-read (status row wins, trash record dropped); crash wording corrected to "never left in both stores by a partial write".
3. `previousStatus` is handler-derived inside the same tx; `WORD_STATUS_TRASH` payload = `{langCode, term}` only.
4. Clear-on-write scoped to `tracking|known|ignore` writes; `unknown` writes do not touch trash records; Remove bypasses the `unknown`→delete normalize; state diagram fixed (`trashed --unknown write--> trashed` no-op; `trashed --status write--> marked`).
5. Alternatives section added: fields-on-row (rejected — leaks trash semantics into every status query), separate store (chosen — isolation, trivially scoped purge, mechanical bump), chrome.storage (rejected — no multi-store tx).
6. AC-12 added covering REQ-1/2/3/4/5 preserved behaviors; AC-13 added for the `changed{unknown}` receiver contract.
7. REQ-8 now specifies incoming `changed{status:'unknown'}` = removal in list surfaces.
8. §Data plumbing checklist completed: MessageType union, zod schemas, registry, handlers, client fns + barrel, local emit (broadcast excludes source tab), `STORES`/`createAllStores`/version bump + test-assertion sync, `clearAllStores`, `dbCache` versionchange close.
9. Minors applied: DoD restored; sweep wording = "filters out and physically removes"; edit-mode×trash defined (exit on Trash, view mode on return); REQ-9 preconditions/exception/time-format/pagination added; REQ-4/5 mapped as preserved; data-cell-id keep/retire/add list added; `updatedAt` on restore = now; NFR-5 reworded to "no complexity regression"; lint added to AC-11; trash count = post-purge survivors from `WORD_STATUS_TRASH_LIST`; `WORD_STATUS_DELETE` clears pending trash; filter role = `tablist`; ~700px checkpoint added to NFR-1/AC-7.

Re-review round waived by user directive (single review round only); fixes verified by author against the action-item list.

VERDICT: APPROVE
