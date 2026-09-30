# Spec-gate review: anki-import

> Artifact: `docs/specs/anki-import.md` · Reviewer: `spec-reviewer` subagent
> (BA/PO/TL lenses, fresh context) · Date: 2026-09-30

VERDICT: APPROVE_WITH_CHANGES

## Blockers (all applied)

1. **B1 — sibling-clone write mechanism contradicted code.** `putNote` throws
   `DUPLICATE` on (targetWord+notetypeId), `putCard` on (noteId+deckId).
   → Spec now defines a dedicated `importWriter.putBundle` low-level write
   path: Zod-validated, uniqueness guards skipped (sibling clones violate
   them intentionally).
2. **B2 — destination-collection semantics.** A new unbound/second collection
   never surfaces on Home (`getCollectionByLanguageProfileId`,
   `firstRunService.ts:32`). → REQ-5 rewritten: resolve language → profile;
   profile has a collection → **merge decks into it**; none → create bound
   collection; no active profile → `ensureFirstRun` first.

## Majors (all applied)

- **M1** Full write contracts enumerated: per-deck `SrsStudyConfig`
  (`parallel` + defaults + DR-derived threshold), collection default-* ids,
  and all 12 `SrsReviewRecord` fields incl. deterministic
  `id='import-anki-<revlogId>'` for resume-dedup.
- **M2** `importSource` = optional Zod field (no IDB bump); dedup via a
  per-run in-memory `Map` scan — no new index.
- **M3** `queue=3` on Connect (no `crt`) → `due=now`, flagged estimated.
- **M4** Mixed text+media fields: keep text + synthesized `<name>__media`
  field (audit rule adopted).
- **M5** AC-8 baseline = raw eligible DB count (not Anki's capped display).
- **M6** Atomic unit = per-card bundle (note+card+records+assets).
- **M7** REQ-9b quota pre-flight via `quotaManager` added.

## Minors (applied)

- Preview prefetches media for ≤5 sample notes (REQ-6 note).
- `--close→` edges added to the state machine.
- Filtered-deck fallback (`odid=0`→nearest non-filtered ancestor) restored;
  `cardsInfo` `odid`/`ord` exposure flagged as verify-at-build.
- `learningSteps=floor(left/1000)` corrected; new-card position loss noted.
- `meaning` gets a `target`-prompt fallback like sound/spelling.
- `ensureFirstRun` fallback in REQ-5; sync-capture note added to Open
  Questions; one-shot non-goal restated.

VERDICT: APPROVE_WITH_CHANGES
