# Intent: tokenize-controller-dedup

> Slug: `tokenize-controller-dedup` · Mode: all · Source: backlog row #16 (internal-audit, `docs/audits/20260916_src-features-entrypoints-shared.md`)
> ui_surface: no
> confidence: high

## Analysis

**The near-verbatim status-key logic the row cites is already extracted.** `src/features/tokenize/logic/statusKeyControls.ts` — `createStatusKeyControls({stateStore, getShadowRoots, applyStatusToTerms, getPopupTarget})` — is the single implementation of:

- `STATUS_BY_KEY` mapping (1→unknown, 2→tracking, 3→known, 4→ignore) :6-11
- popup-target priority over selection/hover :41-45
- `selectedTerms` → `extractTermsFromSelection` → `hoveredTerm` fallback chain :46-56
- `clearSelection`/`removeAllRanges` post-apply :58-59
- `Escape` handling + `isEditableEvent` guard + capture-phase keydown listener :63-79

Both consumers delegate verbatim:

- `webTokenizeController.ts:825-830` → `handleStatusKey: statusKeyControls.handleStatusKey` (:868), `destroy` in teardown (:886)
- `subtitleTokenizeController.ts:188-193` → same (:228, :264)

The only per-controller difference is `getShadowRoots` (web: popup root; subtitle: target+native line elements + extra roots) — surface config, not duplicated logic. The 896-vs-273 line gap the audit measured is domain logic that legitimately differs (DOM block scanning vs cue-line binding), not the dedup target. History: `22632806` created the shared factory; `dd2e81fe` extended it to split-view.

## Residual follow-ups (recorded, not implemented)

- None.

## Decision

**no-go** — the dedup the row asks for already landed (`statusKeyControls.ts` shared factory consumed by both controllers); no remaining verbatim status-key logic to extract.

## Acceptance criteria

- n/a — dropped at analyze (dedup already done in 22632806/dd2e81fe).
