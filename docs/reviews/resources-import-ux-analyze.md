# Analyze review — resources-import-ux

Mode: interactive · Artifact under review: `docs/intent/resources-import-ux.md`

## Hypothesis presentation → user decisions

Presented the BACCM hypothesis (per-file progress rows, real entry totals, bounded parallel import, non-blocking panel, per-item outcomes, left drag handle, integrated right-side lookup replacing per-resource "Thử tra từ") plus three genuine gaps. User resolved:

1. **Dirty tree** → "Build trên dirty tree" — the uncommitted tihoka dictionary refactor (renamed strategies, modified `importOrchestrator.ts` / `ResourcesPanel.tsx`) is the accepted base; commits stage only this item's hunks.
2. **Lookup panel** → "Reuse DictionaryPanelView" — full integrated variant (search + history + CandidateView), same fidelity as the video popup.
3. **Entry totals** → "Exact count" — every format pre-counts entries before/at start of insertion; ~1s pre-parse on 90MB JSON accepted.

## Gate checklist

- [x] Journey AS-IS + TO-BE complete, ≥3 steps each, TO-BE lands at the promised value.
- [x] No need is secretly a solution/value — N1–N9 are capabilities; the how stays in Scope.
- [x] `ui_surface: yes` consistent with user-visible journey steps.
- [x] Decision `go` supported by evidence (hardcoded /100 at ResourcesPanel.tsx:317; sequential loop :364-374; unused `total` field in progress channel; jobId-keyed `pendingImports`).
- [x] Confidence tags honest — N8/N9 assumptions resolved or flagged.
- [x] Risks cover SW memory (bounded concurrency), IDB contention, dirty-tree coexistence, settings-context wiring of DictionaryPanelView.

VERDICT: APPROVE
