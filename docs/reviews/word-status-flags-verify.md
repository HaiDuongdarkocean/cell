# Verification report: word-status-flags

`verify` pass — adversarial review of the shipped implementation against
`docs/specs/word-status-flags.md` (REQ-1..8, AC-1..12, NFR-1..4, DoD).

**Commits under review:** `82417db5` (feature), `e6381ea4` (test seeding fix), `1608e951` (sentence-wash overlay fix).
**Method:** full spec + intent + design brief read; every write-path inventoried and traced end-to-end; all touched suites re-run; targeted edge cases exercised at unit level.

**Gates re-verified on the committed state:**
- `npm run typecheck` — clean.
- Focused re-run of the 13 spec-critical suites — **230 tests pass**: `wordStatusSemantics`, `wordStatusStore`, `wordStatusArbitration`, `reconcileLearningFlags`, `addNoteFromMessage`, `StatusRow`, `CandidateView`, `useCandidate`, `comprehensionScore`, `tokenSpanCss`, `handlers/wordStatus`, `handlers/ankiStatusSync`, `subtitleTokenizeController`.
- Full lint/unit/build/browser evidence reported green upstream (717 suites / 8462 tests, pixel-scan artifacts in `tmp/word-status-flags-gate/`).

## Architecture confirmed

The stored enum stays 5-valued (`popupTypes.ts:18`); `STATUS_CYCLE` shrinks to the 3 bases (`popupTypes.ts:19`). Semantics live in one pure layer — `wordStatusSemantics.ts:7-33` (`baseStatus`, `statusFlag`, `isNotKnown`, `nextBaseStatus`, `toggleTrackingFlag`). Public writes flow through `wordStatusClient` → `WORD_STATUS_SET(_MANY)` → background handler → `wordStatusStore`, with a `'learning'` rejection at both the handler (`wordStatus.ts:102,242`) and the store (`wordStatusStore.ts:174,269,570`). System writes flow through `setWordStatusFromSync`/`setWordStatusesFromSync` (`wordStatusStore.ts:216-256,323+`) under LWW arbitration (`wordStatusArbitration.ts:37-68`), plus conditional `clearLearningFlag` (`wordStatusStore.ts:412-433`).

## Per-REQ / AC verdicts

| # | Requirement | Evidence | Verdict |
|---|---|---|---|
| REQ-1 | Base+flag model; helpers; storage enum unchanged; learning writable only by system writers | Helpers `wordStatusSemantics.ts:7-33`; enum unchanged `popupTypes.ts:18`; public guards `wordStatusStore.ts:174,269,570` + handler `wordStatus.ts:102,242`; sync writers `wordStatusStore.ts:216-256,323-365`; no IDB schema/version change in diff | **PARTIAL** — see AC-1 defect |
| REQ-2 | Popup: base 3-cycle, segmented `[base\|flag]`, tracking toggles, learning read-only, SRS icon state-aware → `openSrsStudyPage` | `StatusRow.tsx:36-88` (`StatusPill` shows `baseStatus` only, learning segment `disabled`); `CandidateView.tsx:171-172,200-212,270-277` (ghost→`addToSrs`, fill→`openSrsStudyPage`, disabled when base≠unknown); `useCandidate.ts:333-341` | PASS |
| REQ-3 | Keys 1/2/3→bases, 4→tracking toggle, 5 unbound, no key writes learning, key4 on learning no-op | `statusKeyControls.ts:7-13` (no `5`), `:62-78` (popup > selected > hovered priority); toggle no-ops via `toggleTrackingFlag` + `next!==current` guards in `webTokenizeController.ts:993-1000`, `subtitleTokenizeController.ts:240-246`, `popupLifecycle.ts:346-354` | PASS |
| REQ-4 | Learning lifecycle; clear only when 0 cards in both sources and stored='learning'; mature→known; known/ignore never gain flag | `statusSyncService.ts:308-321` (`reconcileTermAfterCardLoss` checks `termHasSrsCard` + `getLinksByTerm`); `clearLearningFlag` conditional delete `wordStatusStore.ts:412-433`; `statusRules.ts:29-41` mature≥21→known; arbitration blocks flags onto known/ignore `wordStatusArbitration.ts:51-57` | PASS |
| REQ-4b | Reconcile: live card + unknown-family → restore learning; learning + 0 cards → unknown; known/ignore never rewritten | `statusSyncService.ts:343-366` (`reconcileLearningFlags`); wired after sync `:694`, after SRS seed `:732`, after deck/note deletes (`SrsDeckDetail.tsx:141,161`, `SrsHome.tsx:233`), per-card delete via `ANKI_STATUS_SRS_CARD_DELETED` (`SrsStudyProvider.tsx:399-413` → `handlers/ankiStatusSync.ts:107-123` → `reconcileSrsCardLoss` `:323-335`) | PASS |
| REQ-5 | i+1: exactly 1 not-known scorable gap → capsule + freq pill; 0/≥2 unmarked; tracking/learning keep half-credit | `comprehensionScore.ts:23-45` (`isNew` covers all 3 branches); i1 gating applied `tokenSpanRenderer.ts:84-98` (`IPLUS1_OFF_CLASS`) + calls `:208,245`; freq pill = `token.frequencyBand` ← `entriesToBand(freqEntries)` (best `FrequencyEntry.rank`) `tokenListMetadata.ts:49-72`; `TRACKING_WEIGHT` unchanged `:5,56,107` | PASS |
| REQ-6 | Gradient underline: unknown solid; +tracking/+learning smooth `flag→unknown` gradient; identical on overlay, cue list, web | Host builder `tokenSpanCss.ts:300-308`, shadow builder `:574-582` — identical rules; shared classes emitted by cue list `CueList.tsx:177-207`; shadow CSS injected into every surface (`mountSubtitle.tsx:194,205`, `subtitleSplitView.ts:318`, `mountUniversalPanel.ts:70`, `mountCardCreatorDialog.ts:50`, `mountCondensedAudioPill.ts:34`); asserted both builders `tokenSpanCss.test.ts:101-118` | PASS |
| REQ-7 | Auto-tracking on lookup/save preserved; auto-mark never demotes learning | `vocabularySource.ts:155-159` — unlisted entry → `'tracking'`; `nextMarkedStatus('learning')→'learning'` `vocabularyList.ts:18` → public writer guard no-ops → learning preserved | PASS |
| REQ-8 | `aggregatePosStatus` rank `unknown<tracking<learning<known`; all-ignored→ignore; consumers map flags to not-known bucket | `LEARNED_RANK` + logic unchanged `wordStatusStore.ts:87-108`; session stream drops non-writable `learning` events `sessionEventsTap.ts:64`; vocabulary keeps `learning` segment `vocabularyList.ts:11` | PASS |
| AC-1 | Helpers exist, **all status consumers route through them**, tests cover 5 enum values | Helpers + tests `wordStatusSemantics.test.ts:10-66` (all 5 values, round-trip). **BUT** raw enum comparisons remain: `comprehensionScore.ts:23-25` (`isNew` duplicates `isNotKnown`), `:55-57,106-108,135-140`; `cueDifficulty.ts:30`; `unknownCueMap.ts:58`; `vocabularyList.ts:18` | **FAIL** |
| AC-2 | Token underline: unknown solid; tracking/learning `flag→unknown` gradient; identical across surfaces | See REQ-6; gradient asserted in both builders `tokenSpanCss.test.ts:101-118`; browser pixel-scan reported (tracking `255,131,6→255,18,45`; learning `84,122,229→232,17,75`) | PASS |
| AC-3 | Pill 3-cycles only; flags as separate badge (click toggles tracking, no-op on learning); SRS icon → `openSrsStudyPage`/deck | `StatusRow.test.tsx:24-75` (flag click → `onToggleTracking` only; learning disabled); `CandidateView.test.tsx:725-787` (disabled on known, creates card on unknown-family, `openSrsStudyPage` on learning); `useCandidate.test.ts:159-195` | PASS |
| AC-4 | 1/2/3/4 mapped; 5 unbound; no key writes learning; key4 on learning no-op | `statusKeyControls.ts:7-13,62-78`; `toggleTrackingFlag` no-ops on learning `wordStatusSemantics.ts:29-33` + `wordStatusSemantics.test.ts:53-57`; subtitle path `subtitleTokenizeController.test.ts:389-408` | PASS |
| AC-4b | Public writers reject learning; only sync/internal-SRS writers set it | `wordStatusStore.ts:174,269,570` (store) + `wordStatus.ts:102,242` (handler); system writer writes learning `wordStatusStore.test.ts:138-145`; rejections tested `:115-136`, `wordStatus.test.ts:348-362` | PASS |
| AC-5 | Internal SRS card creation sets learning; unit-tested on cardCreation path | `addNoteFromMessage.ts:60-73` — `setWordStatusFromSync(...,'learning',{source:'srs'})` after `addNoteAndCard`; tests `addNoteFromMessage.test.ts:104-131` (flag on success, no write on failure, known/ignore untouched) | PASS |
| AC-6 | Anki: non-mature→learning (unknown family only); mature→known; no card→flag cleared; known/ignore untouched | `statusRules.ts:29-41`; merged with SRS map `statusSyncService.ts:653-665`; stale-link sweep + card-loss reconcile `:624-649`; arbitration blocks flags on known/ignore `wordStatusArbitration.ts:51-57` + tests | PASS |
| AC-7 | Card loss → unknown only when no card in either source and stored='learning' | `reconcileTermAfterCardLoss` `statusSyncService.ts:308-321`; tested `reconcileLearningFlags.test.ts:140-180` (clears on zero cards, keeps on surviving Anki link / SRS card, leaves tracking/known/ignore) | PASS |
| AC-7b | Reconcile restores flag on unknown-family with live card; clears learning with 0 cards; never rewrites known/ignore | `statusSyncService.ts:343-366`; tested `reconcileLearningFlags.test.ts:182-250` (incl. cross-language isolation `:221-228`) | PASS |
| AC-8 | Exactly-1-gap marks iPlus1 → capsule + freq pill (`FrequencyEntry.rank` resolved); 0/≥2 unmarked; `comprehensionScore.test` covers | `comprehensionScore.ts:35-45`; tests `:25-45` (exactly-one, tracking/learning count as gaps, separators/numbers excluded); pill band resolved from `getFrequencyEntries` `tokenListMetadata.ts:49-72` | PASS |
| AC-9 | Lookup/save auto-marks tracking; auto-mark never demotes learning | `vocabularySource.ts:155-159` + `vocabularyList.ts:17-22` (`nextMarkedStatus('learning')` returns `'learning'` → rejected by guard → no-op) | PASS |
| AC-10 | `aggregatePosStatus` rank order; all-ignored → ignore | `wordStatusStore.ts:87-108` (unchanged) | PASS |
| AC-11 | Old rows load unchanged; no migration; legacy tracking/learning read as unknown+flag | Enum + IDB stores unchanged (no `baseRepository` schema diff); `getWordStatus` returns stored enum `wordStatusStore.ts:111-123`; reinterpretation is read-time `wordStatusSemantics.ts:7-17`; round-trip tested `wordStatusSemantics.test.ts:59-65`; spec's accepted-risk notes stale flags self-heal via reconcile | PASS |
| AC-12 | known/ignore never gain a flag from any card event | Arbitration blocks non-user flag writes onto known/ignore `wordStatusArbitration.ts:51-57` + test `wordStatusArbitration.test.ts` (`non-user flags never write onto known or ignore`); SRS-create path tested `addNoteFromMessage.test.ts:121-130`; reconcile skips known/ignore `statusSyncService.ts:354-360` + test `:209-219` | PASS |
| NFR-1 | i18n en+vi for new labels/tooltips | `en.json:147-149,163-164`, `vi.json:147-149,163-164`; keys used `StatusRow.tsx:43,67-68,79-80`, `CandidateView.tsx:205-206` | PASS |
| NFR-2 | No IDB migration, zero data loss | Enum/stores unchanged; no version bump in diff; trashed/legacy rows preserved | PASS |
| NFR-3 | O(1) status resolution; pure helpers | Helpers are pure sync functions `wordStatusSemantics.ts:7-33`; no new async on tokenize path | PASS |
| NFR-4 | Gradient readable on light host pages; tokens pinned | Light-palette pinning kept (`--cell-token-status-*` → `--color-token-status-*` `tokenSpanCss.ts:26-27`); `!important` + `html body` specificity retained `:300-308` | PASS |
| DoD | typecheck/lint/unit/build green; design-system check; browser verify; docs updated; i18n | Gates green (see header); i18n done; `2-architechture-system.md` updated (StatusRow entry added); **`0-wiki.md` not updated** — defect D3 | **PARTIAL** |

## Adversarial edge-case matrix

| Edge case | Result |
|---|---|
| Key `4` on `learning` word | `toggleTrackingFlag('learning')→'learning'` + `next!==current` skip → no write (`wordStatusSemantics.ts:29-33`, `subtitleTokenizeController.ts:240-246`, `popupLifecycle.ts:346-354`) ✅ |
| Key `5` | Unbound — `STATUS_BY_KEY['5']` undefined → `handleStatusKey` returns false, key not consumed (`statusKeyControls.ts:7-13,71-72`) ✅ |
| Base transition clears flags | `tracking→known`/`ignore`, `learning→known`/`ignore`/`unknown` write a base enum → flag gone (keys `statusKeyControls.ts:71-77`; pill `useCandidate.ts:333-335`; `nextBaseStatus` always returns base `:22-25`) ✅ |
| Tracking on known/ignore | `toggleTrackingFlag` returns unchanged → no write; vocabulary bulk-mark `tracking` onto known/ignore is a legitimate base-status write (flag lands on unknown only — storing `tracking` IS unknown+flag) ✅ |
| `learning` via key controls / popup / public client / vocabulary UI / deck UI / background message | Key map has no learning (`statusKeyControls.ts:7-13`); popup learning segment `disabled` + `addToSrs` uses `applyStatus('learning', false)` = local paint only (`useCandidate.ts:306-331,442-450`); client relays but handler rejects (`wordStatusClient.ts:52-66` → `wordStatus.ts:102,242`); deck `MARK_STATUSES` excludes learning (`SrsDeckDetail.tsx:30`); store guard is the final backstop ✅ |
| **Manual `learning → tracking`** | **REACHABLE** — vocabulary bulk "Change status → Tracking" writes `tracking` onto `learning` rows (`VocabularyTab.tsx:774` → `vocabularySource.ts:177-180` → `setWordStatuses`). Store accepts `tracking` as a normal user write. ⚠️ See D2 |
| Card deletion clears only when both sources empty | `reconcileTermAfterCardLoss` checks internal SRS (`termHasSrsCard` `:288-301`) then Anki links (`getLinksByTerm` `:314`) before `clearLearningFlag` ✅ tested `:149-165` |
| i+1 exclusivity by sentence | `gapsBySentence.get(sentenceIndex) === 1` (`comprehensionScore.ts:36-44`) ✅ |
| Freq pill only on gap token | `IPLUS1_OFF_CLASS` removed only for `iPlus1` tokens (`tokenSpanRenderer.ts:94-98`) ✅ |
| SRS creation failure does not fabricate learning | `addToOceanSrs` throws → `applyStatus` skipped (`useCandidate.ts:442-450`); server-side write happens inside `addNoteFromMessage` only after `addNoteAndCard` succeeds; failure test `addNoteFromMessage.test.ts:112-119` ✅ |
| Stale non-user events vs mature/known | Non-user can't downgrade `known` (`wordStatusArbitration.ts:44-50`); flags blocked on known/ignore `:51-57` ✅ |
| User `unknown` on `learning` while card lives | Writes `unknown` (base-override wins per REQ-4 exception); next reconcile restores `learning` (`statusSyncService.ts:358-360`) — spec-sanctioned self-heal ✅ |

## Defects

### D1 — Blocking — AC-1 not fully satisfied: raw status comparisons remain in consumers

AC-1 requires "all status consumers route through the helpers"; Boundaries say "Always: statuses resolved through helpers — no raw enum comparisons scattered". These production consumers were not migrated:

- `src/features/tokenize/logic/comprehensionScore.ts:23-25` — `isNew` literally re-implements `isNotKnown` (`status !== 'known' && status !== 'ignore'`); same file `:55-57,106-108,135-140` repeat `status === 'tracking' || status === 'learning'` engagement-bucket checks.
- `src/features/subtitle/logic/unknownCueMap.ts:58` — `status !== 'unknown' && !== 'tracking' && !== 'learning'` duplicates `isNotKnown`.
- `src/features/subtitle/logic/cueDifficulty.ts:30` — `status === 'tracking' || status === 'learning'` engagement bucket.
- `src/features/vocabulary/logic/vocabularyList.ts:18` — `status === 'learning'` sticky check (expressible via `statusFlag`).

Behavior is still correct for all five enum values today (verified against the helper truth table), so this is a spec-boundary/SSOT violation rather than a runtime bug — but AC-1 is written absolutely and is not genuinely satisfied. Any future enum value added to these files would silently diverge from the helpers.

### D2 — Blocking — Manual `learning → tracking` demotion reachable via vocabulary bulk-mark

The required edge "manual learning → tracking must be impossible" fails on one surface: `VocabularyTab` bulk "Change status → Tracking" (`VocabularyTab.tsx:774`, `BULK_STATUSES` includes `'tracking'` `:84`) calls `vocabularySource.setStatusMany` (`vocabularySource.ts:177-180`) → `setWordStatuses` writes `'tracking'` as a normal user write — allowed, because only `'learning'` is rejected. A stored `learning` row becomes `tracking` while its card still exists, breaking the "learning = card exists" invariant on screen and in storage until the next `reconcileLearningFlags` pass — which only runs on Anki sync passes and SRS page actions (`statusSyncService.ts:694,732`, `SrsDeckDetail.tsx`, `SrsHome.tsx`). With `ankiStatusSync` disabled and no SRS page opened, the demotion persists indefinitely. The spec state machine has no user edge `learning→tracking` (key 4 explicitly no-ops for the same reason). Fix options: skip `learning` rows in the bulk-mark path, or extend the store guard to reject `tracking` writes onto stored `learning` for `source:'user'`.

### D3 — Minor — `docs/0-wiki.md` not updated

DoD requires `docs/0-wiki.md` + `docs/2-architechture-system.md` updated. Only the latter was touched (`82417db5`); `0-wiki.md` last changed in `05e37940` (unrelated feature). Missing changelog/wiki entry.

## Risks accepted / observations

- **Latent arbitration hole:** a *non-user* `tracking` candidate with a fresher `sourceAt` can demote a stored `learning` (`wordStatusArbitration.ts:60-67`; the test suite documents this as intentional: `learning→tracking is a downgrade — normal arbitration applies`). No current system writer emits `tracking`, so unreachable today — worth guarding if an import/sync path ever emits `tracking`.
- **Sync-written flag changes emit no `WORD_STATUS_CHANGED`** — token surfaces repaint only on the next status resolution (lookup, cue re-render, `SYNC_DATA_APPLIED` relay, or local emit). Matches the pre-existing Anki-sync pattern and REQ-4's accepted staleness; the new SRS card-loss path inherits the same lag.
- **`restoreWordStatus` bypasses the public guard** — restores `previousStatus` verbatim (`wordTrashStore.ts:145-147`), so a `learning` row trashed then restored inside the 24h window restores the flag. It can only restore a previously-legitimate value, never fabricate one; reconcile heals drift. Consistent with the guard's purpose.
- **Cue list does not apply i+1 gating** — `CueList.tsx` renders capsules/freq bands on every not-known token regardless of `iPlus1`. Pre-existing scope decision from the i+1-gate commit (`b4019daa`), unchanged here.
- **Legacy `useDictionaryLookup.cycleStatus` write path** still exists outside the REQ-1 write-path inventory; it is safe (`nextStatus` returns base-only) and consumed only by removed/design mockups.
- **Showcase/dev mock handlers** (`design-system-showcase/mockDictionary.ts:416`, `VocabularyPanelPage.showcase.tsx:152`) accept/seed any status incl. `learning` via the sync writer — dev-only surfaces, correct usage.

## Blocking issues

1. **D1** — AC-1 "all status consumers route through the helpers" is violated by raw enum comparisons in `comprehensionScore.ts`, `unknownCueMap.ts`, `cueDifficulty.ts`, `vocabularyList.ts`.
2. **D2** — Manual `learning → tracking` remains reachable through the vocabulary bulk-mark path, breaking the "learning = card exists" invariant until a reconcile pass runs.

VERDICT: FAIL
