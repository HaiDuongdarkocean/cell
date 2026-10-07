# Analyze review — `mining-queue`

Fresh-context audit (subagent_explore) of `docs/intent/mining-queue.md`, 2026-10-07.

## Verified citations

- `cardCreatorBridge.ts:682` `handlePopupQuickAdd` — routes through Dictionary/queue flow; `getSrsDestination()` fork confirmed.
- `popupTypes.ts:399` `PopupCardCreatorPrefill` — self-contained snapshot incl. `lookupResult`, media items, selection snapshot.
- `sessionEventsTap.ts:96` passive tap → `addSessionEvent` → `STORES.SESSION_EVENTS` IDB.
- `useCandidate.ts:418` — actions today are quick-add / send-to-card only; no "save for later".
- `mediaLibraryRepository.ts` IDB repo precedent; `importWriter.ts:198-205` dedupe precedent.
- universalPanel: `PANEL_TABS` registry — new tab slots cleanly; per-tab count badge is a new pattern (minor).

## Feasibility

- IDB persistence for queue: feasible; NOTE — `addSessionEvent` is fire-and-forget/fail-closed, queue spec needs stronger durability (awaited write + error surface).
- Prefill replay complete for reopening card creator; `MediaFile` blobs and live video/cue refs are non-serializable — handled by N6 (no media copy at capture) + re-resolve risk note.
- Journey complete (AS-IS 5 / TO-BE 6 steps); Decision `go` grounded; scope explicit; stories business-level; risks honest.

## Findings

- Minor: `popupTypes.ts:399-451` line range imprecise (ends ~439) — fixed in doc.
- Minor: per-tab count badge precedent overstated — new pattern, resolved in design.
- Spec-stage carry-overs: (a) queue durability must exceed sessionRecap's drop-on-error; (b) dedupe identity for term-less cue captures needs a rule (N5 assumes term+sentence).

No Blockers/Majors.

VERDICT: APPROVE
