# Spec Review — primer-tab-redesign

Two independent lens reviews (BA/PO, TL) + orchestrator verification against `PrimerTab.tsx`, `PrimerTab.module.css`, `primerList.ts`, `tokenSpanCss.ts`, `lookupTargetDom.ts`, `icons/index.ts`, `PrimerTab.test.tsx`, en/vi locales.

## Blockers
None — spec is implementable; meta visual treatment deferred to DESIGN is a locked decision.

## Major
1. [Traceability L109] [BA]: `N1 → REQ-1, REQ-5` — REQ-5 does not exist (only REQ-1..4). Dangling reference breaks the gate's traceability contract. Fix: map to `REQ-1` (or `REQ-1, NFR-2`).
2. [REQ-3 Rules L56 / SC-6 L137 / Flows L85] [TL]: "disjoint via stopPropagation" is false on the keyboard path. `handleRowKeyDown` (`PrimerTab.tsx:31-39`) fires on Enter/Space bubbling from the inner Button — `stopPropagation` is only on `onClick`. Pressing Enter/Space on the focused play button triggers lookup (and possibly seek). Fix: add rule "keydown originating inside the play button must not reach the row lookup handler" (`event.target === event.currentTarget` guard or button-level stopPropagation) + AC in SC-6/SC-8.
3. [REQ-1 Rules L31 / SC-5 L136 / Boundaries L126] [TL+BA]: term-color mechanism under-specified and ambushed by shared CSS. (a) `.js-Tihoka-token` base rule in `tokenSpanCss.ts:104-137` is all-`!important` (`color:inherit`, `font:inherit`, `box-shadow:var(--shadow-sm)`, `user-select:text`) — new term styles need scoped `!important` overrides (module CSS already fights this at L71-72). (b) `applyTokenStatus` (`lookupTargetDom.ts:107-114`) re-adds `js-Tihoka-token--status-*` to the anchor on every status change → dark underline flashes back until re-render. Fix: state explicitly — keep `js-Tihoka-token` + `js-Tihoka-token--status-*` classes as lookup/status hooks, neutralize visuals via `!important` overrides scoped under the module class only, never touch `tokenSpanCss.ts`; accept or guard the transient re-add.
4. [REQ-1 Exception L30 / SC-3 L134] [TL+PO]: "rank === null (no frequency data)" is factually wrong — `rank` and `band` are independent fields (`primerList.ts:8-9,66`); current UI shows a colored band dot when `rank===null && band!=='none'`. SC-3's "omit freq part" silently drops all frequency signal for those rows while `band` is a declared key field no REQ consumes. Fix: state the rule ("render `freq #<rank>` iff `rank !== null` regardless of `band`; `band`'s visual role is a DESIGN-stage decision") or record the drop as an explicit Accepted Risk.
5. [REQ-4 L66 / Boundaries L126 / NFR-5 L81] [TL]: preserved-attribute contract incomplete. The lookup pipeline also requires `data-cue-start`/`data-cue-end` on the row (`lookupCueRange` L74, `isLookupFromSubtitle` L66 — gates media-recording eligibility) and `data-tihoka-term`/`data-tihoka-start` on the term — none match "data-tihoka-*" / the NFR-5 hook list. A test already asserts this (`PrimerTab.test.tsx:57` "carries cue range attributes"). Fix: enumerate the full contract — term: `js-Tihoka-token`, `data-tihoka-term`, `data-tihoka-start`; row: `data-cue-start`, `data-cue-end` — in REQ-4 rules or Boundaries.

## Minor
1. [Traceability] [BA]: N6 maps to REQ-1 but spacing lives in NFR-4; SC-9 (i18n→NFR-3) and SC-10 (status→N7) absent from AC column. Fix: correct mappings.
2. [REQ-1/SC-2] [PO]: meta sub-line has no overflow rule — term gets ellipsis, meta (longer in vi) doesn't. Fix: "meta stays one line, ellipsizes" at ≥280px.
3. [REQ-2 Rules L43 / NFR-3] [TL]: "2 spans → 1" needs a new joined i18n key; spec names no new keys (e.g. `primer.meta`, `primer.freqRank`) — risk of hardcoded `·` separator. Fix: list expected keys under NFR-3/SC-9; reuse `vocabulary.status.*` for the status word.
4. [REQ-3 Rules L56] [PO]: "`navPlay` / circle-play" ambiguous naming. Fix: specify `Icon name="navPlay"`.
5. [REQ-4] [PO]: missing exception `termEl === null` → no-op (code already guards); missing fate of `VisuallyHidden` status (`PrimerTab.tsx:93`) and meta screen-reader parity vs today's `aria-label={t('primer.occurrences')}`.
6. [NFR-4/SC-7] [PO]: "reduced vs current" is comparative only; add a measurable proxy (padding ≥1 token step down, or rows-per-600px-viewport). Also clarify whether `--touch-target` floor applies to the play button hit area (`size="sm"` may be <32px).
7. [SC-8] [PO]: "etc hooks intact" — cite the NFR-5 list instead.
8. [DoD] [TL]: rework orphans code — `FrequencyBadge` (PrimerTab is sole consumer), `.band`/`.bandDot_*`/`.occurrences` CSS, and `PrimerTab.test.tsx` assertions (`'×4'`, `'321'`, `'Tracking'`) all break. Fix: DoD line "update tests; decide FrequencyBadge keep/remove; delete dead CSS".
9. [TL rubric §3] [TL]: no alternatives recorded even though direction is user-locked. Fix: 2-3 lines noting "restyle FrequencyBadge" / "keep band dot" as rejected/deferred.
10. [Open Questions] [TL]: `computeLineRect` uses `target.parentElement` (`lookupTargetDom.ts:26`) — new info-block parent shrinks the popup avoidance band; likely harmless, worth one line. Nested-interactive row (`role="button"` wrapping a real `<button>`) preserved silently — note as known debt.

## Lens summaries
- BA: Problem-led objective, clean actor boundary, intent traceable — modulo the REQ-5 phantom and the status-class ambiguity that hits the exact shared-CSS risk intent flagged.
- PO: SCs are testable with numeric width targets, but the keyboard failure path and meta-overflow edge leave the changed surface happy-path-only.
- TL: Data model untouched and mostly correct on facts, but the DOM/CSS contract the spec claims to preserve is under-specified (`data-cue-*`, `!important` base, `applyTokenStatus`, band-vs-rank).

## Action items
1. Fix traceability: REQ-5→REQ-1; N6→NFR-4; add SC-9/SC-10 mappings — spec author — L109-115.
2. Add keyboard-disjointness rule + AC for play button — spec author — REQ-3/SC-6/SC-8.
3. Clarify SC-5/REQ-1/Boundaries: keep token classes as hooks, scoped `!important` overrides only, transient re-add accepted-or-guarded — spec author.
4. State band-vs-rank rule in REQ-1 exception/SC-3, or record accepted risk — spec author.
5. Enumerate full preserved-attr contract (`data-tihoka-term`, `data-tihoka-start`, `data-cue-start/end`) — spec author — REQ-4/Boundaries/NFR-5.
6. Add meta-ellipsis rule; name new i18n keys; `Icon name="navPlay"`; termEl-null exception; VisuallyHidden/SR parity note; SC-8 cite NFR-5; SC-7 measurable proxy; DoD test-update + FrequencyBadge decision + dead-CSS cleanup; 2-3 rejected-alternatives lines — spec author — scattered.

## Risks accepted
- Meta visual treatment deferred to DESIGN (3 mockups) — revisit when user picks a variant.
- Transient status-underline flash via `applyTokenStatus` — revisit if screenshots catch it.
- Nested-interactive row semantics — revisit at next a11y audit.

## Applied fixes

1. Traceability: `REQ-5` phantom → `REQ-1`; `N6` → `NFR-4`; added SC-9/SC-10 to N7 mapping.
2. REQ-3 rules + SC-6 + Flows: keyboard events inside the play button must not reach the row keydown lookup handler (existing `handleRowKeyDown` bubble bug neutralized by spec rule + AC).
3. REQ-1 rules + SC-5 + Boundaries: keep `js-Tihoka-token`/`--status-*` as hooks, neutralize visuals via module-scoped `!important` only, `tokenSpanCss.ts` never edited, transient `applyTokenStatus` re-add accepted.
4. REQ-1 exception + SC-3: `rank === null` omits only the `freq #N` segment; `band` visual role deferred to DESIGN (accepted risk recorded).
5. REQ-4 + NFR-5 + Boundaries: full preserved-attribute contract enumerated (`js-Tihoka-token`, `data-tihoka-term`, `data-tihoka-start`, `data-cue-start`, `data-cue-end`).
6. Minors folded in: meta ellipsis rule; named i18n keys (`primer.header`, `primer.meta`, `primer.freqRank`, `primer.repeatCount`, reuse `vocabulary.status.*`); `Icon name="navPlay"`; `termEl === null` exception; VisuallyHidden/SR parity note; SC-8 cites NFR-5; SC-7 measurable proxy (≥1 token step + play hit area floor); DoD adds test-update + FrequencyBadge decision + dead-CSS cleanup; rejected-alternatives section; `computeLineRect` parent-note; nested-interactive debt noted.

VERDICT: APPROVE_WITH_CHANGES