# Plan — `word-status-flags`

> Spec: `docs/specs/word-status-flags.md` · Design: `docs/intent/word-status-flags-design-brief.md` (approved: **B segmented control + A smooth gradient**) · Mapping: `docs/intent/word-status-flags-component-mapping.md`
> Strategy: semantics layer → store guard → keys/controllers → token CSS → SRS lifecycle → popup UI → consumers/i18n → gates+verify+ship

## T1 — Semantics layer (pure)

- [ ] `entities/dictionary/popupTypes.ts`: `STATUS_CYCLE` → `['unknown','known','ignore']` (base knowledge cycle).
- [ ] `features/dictionary/services/wordStatusSemantics.ts` (new): `baseStatus(s)`, `statusFlag(s)`, `isNotKnown(s)`, `nextBaseStatus(s)` (3-cycle), `toggleTrackingFlag(s)` (`unknown↔tracking`, `learning`→`learning` no-op, `known|ignore` unchanged).
- [ ] Export via `features/dictionary/index.ts`.
- [ ] Test: `wordStatusSemantics.test.ts` — all 5 enum values through every helper.
- Verify: `npx jest wordStatusSemantics`
- AC: AC-1, AC-11

## T2 — Store guard + arbitration

- [ ] `wordStatusStore.ts`: `setWordStatus`/`setWordStatuses`/`setWordStatusPos` early-return on `'learning'` (public writers cannot fabricate the flag). Add `clearLearningFlag(langCode, term)` — single-tx conditional row delete, only when stored status === `'learning'` (captures sync op, clears trash).
- [ ] `wordStatusArbitration.ts`: non-user flag candidates (`learning`|`tracking`) writing onto stored `known` **or** `ignore` → `skip` (extends the existing known-protection to flags on ignore).
- [ ] Tests: public write 'learning' no-op; sync write 'learning' works; ignore never gains flag via sync; `clearLearningFlag` only fires on 'learning'.
- Verify: `npx jest wordStatusStore wordStatusArbitration`
- AC: AC-4b, AC-7 (store side), AC-12

## T3 — Keys + controllers

- [ ] `statusKeyControls.ts`: keys `1→unknown`, `2→known`, `3→ignore` (direct writes); `4` → tracking toggle via new `toggleTrackingToTerms(terms)` option + `popupTarget.toggleTracking()`; `5` unbound. `PopupStatusTarget` += `toggleTracking`.
- [ ] `webTokenizeController.ts` + `subtitleTokenizeController.ts`: implement `toggleTrackingToTerms` = per-term `getStatusForTerm` → `toggleTrackingFlag` → `applyStatusToTerms` (skip unchanged).
- [ ] Find + update `getPopupStatusTarget` wiring to pass `toggleTracking` from the popup.
- [ ] Tests: key map, key-4 toggle both directions, no-op on learning/known/ignore, key-5 dead.
- AC: AC-4

## T4 — Token gradient CSS

- [ ] `tokenSpanCss.ts` + `buildTokenSpanCssForShadow`: `--status-tracking` capsule → `linear-gradient(90deg, var(--Tihoka-token-status-tracking), var(--Tihoka-token-status-unknown))`; same for learning. Keep `html body … !important` specificity.
- [ ] Test: assert both builders emit the gradient rules.
- AC: AC-2

## T5 — Popup segmented control + SRS button

- [ ] `StatusRow.tsx`: default `statusControl` → new `StatusSegmented` — `[base pill | flag segment]` (Concept B): left = `StatusPill` cycling via `nextBaseStatus`; right segment renders only when flag ≠ none — tracking → `eye` `Button` (click = toggleTracking, key-4 semantics); learning → `layers` `Button` disabled/read-only.
- [ ] `useCandidate.ts`: add `toggleTracking` (same write path as `cycleStatus` but `toggleTrackingFlag(variantStatus)`); expose `srsState` derived from `statusFlag(status)` (`none|learning`) for the header button.
- [ ] `CandidateView.tsx`: SRS `Button` (icon `layers`, `shape="circle"`) in `TihokaHeaderActions`: flag ≠ learning → ghost/dashed → click runs `panel.addToSrs()` (buildPrefill → `addToOceanSrs` → optimistic `learning`); flag === learning → filled learning class → click `openSrsStudyPage()`; disabled when `baseStatus(status) !== 'unknown'`.
- [ ] CSS: segmented + SRS state classes in `CandidateView.module.css` using `--chip-status-*` tokens.
- [ ] i18n: `dict.status.cycle` wording, new keys flag segment title + `dict.action.srs` (en+vi).
- Verify: `npx jest CandidateView` + mockup-style visual check on real popup.
- AC: AC-3, AC-5 (popup path)

## T6 — SRS ↔ flag lifecycle

- [ ] `addNoteFromMessage.ts` (background): after `addNoteAndCard` succeeds → `setWordStatusFromSync(lang, normalizeTerm(targetWord), 'learning', {source:'srs'})` — best-effort, never fails the add.
- [ ] `statusSyncService.ts`: new `reconcileLearningFlags(langCode)` — `getTermsByStatus('learning')` terms with zero cards (SRS notes scan + Anki links) → `clearLearningFlag`; live card + unknown-family status ≠ learning → sync-write `learning` (never touches known/ignore — arbitration covers). Call at end of `runAnkiStatusSync` + `seedStatusesFromSrs`.
- [ ] Anki disappearance: in `runAnkiStatusSync`, probe stored links via `cardsInfo` — cardIds missing → drop link + `reconcileTermAfterCardLoss(langCode, term)` (flag clears only if no card in either source).
- [ ] Internal card loss: `SrsDeckDetail`/`SrsStudyProvider` delete paths call `reconcileTermAfterCardLoss` after `deleteCardCascade`/`deleteNoteCascade` (resolve term+lang before delete).
- [ ] `ankiStatusSync` keep: mature → known (existing), suspended → skip (existing).
- [ ] Tests: creation → learning; delete last card → unknown; other-source card keeps flag; known/ignore untouched; reconcile both directions.
- AC: AC-5, AC-6, AC-7, AC-7b, AC-12

## T7 — Consumers + i18n sweep

- [ ] `vocabularyList.ts`: `MARKED_STATUSES` → `['tracking','known','ignore']` (vocab click-cycle can't write learning); `VOCABULARY_SEGMENTS` keep 'learning' as a filter segment.
- [ ] `vocabularySource.ts` auto-mark: never demote `learning` (`nextMarkedStatus` on learning → keep learning).
- [ ] `sessionRecap`/`sessionEventsTap` + `useDictionaryLookup` + `VocabularyPanelPage.showcase`: audit STATUS_CYCLE/nextStatus usages → route through helpers where they assume the 5-cycle.
- [ ] Popup key legend / status tooltips: update copy keys en+vi.
- [ ] `comprehensionScore` — verify unchanged semantics + extend tests for flag branches (AC-8).
- AC: AC-8, AC-9, AC-10

## T8 — Gates + verify + ship

- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green.
- [ ] Real-Chrome verify: popup segmented control, tracking toggle, SRS ghost→filled flow, gradient capsules (tracking/learning), i+1 freq pill — light+dark.
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated; mockup dir `src/entrypoints/mockup-word-status-flags/` deleted at ship.
- [ ] Fresh-context verify review → `docs/reviews/word-status-flags-verify.md` PASS → signoff → `transition --to shipped`; backlog row → shipped + commit hash.

Dependencies: T2→T1 (helpers); T3→T1; T4 standalone; T5→T1+T2; T6→T2 (`clearLearningFlag`); T7→T1; T8→all.
Parallel: T4 is standalone; T6 background half independent of T5 popup half.
