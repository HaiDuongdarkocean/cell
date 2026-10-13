# Analyze Review — subtitle-bulk-status

Interactive mode — user approval record.

## Hypothesis presented

- Need: bulk status change (select → 1–4, ctrl+click) missing in subtitle block + subtitle panel; worst in local player (no status keys at all, overlay untokenized).
- Gap matrix verified against code: streaming overlay + split-view/Player Mode panel already support drag-select→1–4 (2026-09-16); missing = CueList ctrl+click, visible selected state, entire local-player path.
- User confirmed (2026-09-18, clarifying questions):
  - "ở ngoài text" = web page text (streaming tokenize-on-web).
  - Desired surfaces = subtitle block + subtitle panel, **both** streaming and local player.
  - Mechanism = same as current (select text → 1–4; ctrl+click where applicable).
  - Approved intent doc → proceed to specify ("OK — sang specify").

## Review notes

- Needs are evidence-cited (`useSubtitleActions.ts:77-94`, `CueList.tsx:113`, `statusKeyControls.ts`, grep-verified absence of `js-Tihoka-token--selected` and of status-key wiring in `src/entrypoints/local-player/`).
- Scope excludes `setWordStatus` semantics — owned by concurrent `vocabulary-tab-redesign` item.
- Journey AS-IS/TO-BE complete; Decision=go.

VERDICT: APPROVE
