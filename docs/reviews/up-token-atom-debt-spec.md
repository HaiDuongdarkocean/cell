# Spec Review — up-token-atom-debt (re-review, r2)

Reviewer: spec-reviewer (adversarial re-verify of revision) · Spec: `docs/specs/up-token-atom-debt.md` · Intent: `docs/intent/up-token-atom-debt.md` · Mode: all

All 5 prior action items re-verified against source.

**Prior findings — resolution check:**
- REQ-5 enumeration (was Blocker): **resolved**. Every row verified: `Dialog.tsx:68-75` + `:91`, `BottomSheet.tsx:59-66`, `Drawer.tsx:40-47` (verified unused in-panel — only tests/showcase), `ResourceCard.tsx:293-296`, `DictLinksManager.tsx:170-173`, `MultiSelect.tsx:100-105` (`focused` state :55 exists), `useSectionDrag.ts:180-181,197` (window bubble), `popupLifecycle.ts:815-836` + `onStackPointerDown` `:826-834` composedPath precedent, `Dictionary.tsx:108-113` → `onClose → closeFromLevel(indexOf(level))` `:276`, `regionSelector.ts:307-310` (window bubble), `PlayerModeOverlay.tsx:500-531` (bubble `:529`, already preventDefault+stopPropagation), `statusKeyControls.ts:65-77` (window capture `:77`, unconditional clear `:68-69`). Stack mechanics confirmed: document capture `:51`, `defaultPrevented` skip `:44`, `stopPropagation` `:47`; window-capture consumers fire before document-capture. Ref-pin fixes prior Minor 4. `useSheet.ts:83` ref pattern confirmed. Pass-through rows verified (Surface `:67-72`, ManagerLayer `:94-104`, mountReactShadow `:94-107`, ShortcutInput `:87`, contentScriptKeyboard `:153-168`, SubtitlePractice `:163-167`). Gap audit: all other Escape listeners (`Sheet:87`, `Select:190`, `ProfileMenu:80`, `PlaybackSpeedControl:60`, `SearchableSelect:140`, `CardCreatorSidePanel:78`) are already on-stack — enumeration is complete. Named test updates verified (`UniversalPanel.test.tsx:218/237/297`, `ResourceCard.test.tsx:197`, `ResourcesPanel.test.tsx:929`, `Dictionary.test.tsx:111-124`).
- REQ-6 `will-change` (was Major): **resolved** — deleted outright, `panelClass` (`:180`) always open|close verified, first-frame verify + escalate-not-restore clause is honest.
- REQ-2 (was Major): **resolved** — converged 7-file set verified against grep; Out enumeration is exactly the remaining in-scope sites.
- REQ-6 recap gating (was Major): **resolved** — `{activeTab === 'recap' && recapPanel}` (`:287`) verified deliberate, kept verbatim, rationale recorded.
- REQ-4 unwrapped-children (was Minor): **resolved** — verified vs `Button.tsx:137` (`data-tihoka-ripple-self`), `:143` (`.label` span), `.defLineReveal > span` (`CandidateView.module.css:341`).
- REQ-7 (was Minor): **resolved** — `parse-error` exempt + non-zero (`:401`/`:470`), exit-2-on-empty, `--rules` semantics now explicit; measured baseline "exactly 13" verified by grep (StudyModes 5 + RecapTab 4 + PlaylistTab 4 = 13 undefined sites; `condensedAudio` typos out of scope as claimed).
- REQ-1 `PlaylistTab:10` `--border-width-thick, 2px` fallback (was Minor): **resolved** — dropped in the new table row.
- D2 magnitude 13.3px correction (was Minor): **resolved**.

## Blockers

None.

## Major

1. [REQ-5 / popupLifecycle row + D5] [TL]: Two defects in the same row. (a) `popupStack.findIndex` returns **-1**, not undefined — `idx ?? popupStack.length - 1` yields `closeFromLevel(-1)`, which early-returns (`:212`) → focus-outside Escape becomes a no-op while the stack's `stopPropagation` also blocks the panel: dead Escape. Literal implementation = regression; the prose intent ("top level when focus is outside") is correct. (b) **D5 contradicts the row**: composedPath resolution pops the focused level + descendants — identical to today's `onClose → closeFromLevel(indexOf(level))` (`:276`); D5 claims it "now pops the top level". Either the handler or the delta log is wrong. Fix: `closeFromLevel(isSheetMode() ? 0 : idx >= 0 ? idx : popupStack.length - 1)`, state the register/unregister site (push on first level / pop on empty + `dispose`), and correct D5 to say the focused-level path is preserved (real delta: the two paths merge into one layer).

## Minor

1. [REQ-2 Out list] [PO]: enumeration lists **23 sites in 11 files**, not "24 sites in 9 files" — the list itself is complete/correct (verified by grep); fix the count line.
2. [REQ-4 checkbox row] [TL]: `<label>`→`<span>` must also drop the label's `onClick={e.stopPropagation()}` (`CandidateView.tsx:604,706`) — with it kept, "marker clicks bubble to the row's onClick" is false and the toggle is dead. State it explicitly.
3. [REQ-5 deltas] [TL]: migrating `Dialog`/`BottomSheet`/`Drawer` makes their Escape document-global too (was element-scoped) — same class as D4, unrecorded. Near-equivalent in practice (focus trap keeps focus inside), but log it.
4. [REQ-5 test list] [PO]: asymmetric completeness — `UniversalPanel.test.tsx:262` (Select listbox Escape) and `SearchableSelect.test.tsx` Escape cases are unchanged-but-unnamed while `:218` is named. One line suffices.
5. [Scope note] [BA]: REQ-5 file span now covers `features/{ocr,tokenize,subtitle,dictionary,dictionaryPopup,settings}` + `shared/{ui,lib}` — beyond the intent's named surface files. This is honest, mechanically forced growth (a document-capture stack starves off-stack consumers regardless of directory); it is recorded in Open Questions and bounded by NFR-4. No escalation needed — noting for traceability only.

## Nhận xét theo role

- BA: Traceability intact; every behavioral delta is now surfaced — scope widening is forced by the shared-stack mechanics and disclosed honestly.
- PO: ACs remain grep/Chromium-testable; the Out-count slip and D5 contradiction are record-keeping errors in an otherwise verifiable spec.
- TL: Enumeration is complete and mechanics are accurate except the `findIndex`/`-1` formula — the one spot where specced pseudocode compiles to a regression.

## Action items

1. Fix `idx ??` formula → `idx >= 0 ? idx : popupStack.length - 1`; name the push/unregister site; correct D5 — REQ-5 table + Deltas + AC-7.
2. Correct Out count to 23 sites / 11 files — REQ-2.
3. Add "drop label `stopPropagation`" to the checkbox-deletion row — REQ-4.
4. Record atom-level document-global delta (Dialog/BottomSheet/Drawer) + name unchanged tests `:262`/`SearchableSelect.test.tsx` — REQ-5 deltas/test list.

## Risks chấp nhận

- `unstyled` variant = the one API addition — revisit if a third consumer needs partial chrome.
- Repo-wide `undefined-token` gating deferred (`--sb-y`/`--pm-*` runtime props) — revisit when they get a convention.
- REQ-5 breadth beyond original named files — accepted; forced by the global capture listener, bounded by NFR-4 and the enumeration table.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes (r2)

1. REQ-5 popupLifecycle row: formula fixed to `idx >= 0 ? idx : popupStack.length - 1` with the `-1` early-return rationale inlined; register/unregister sites named (`popupStack.push` `:487` on 0→1, `closeFromLevel` empty `:217`, `dispose` `:839`).
2. D5 corrected — composedPath handler preserves the focused-level pop; delta is structural (two paths → one layer); propagated to AC-7's popup clause and the Open Questions delta list.
3. REQ-2 Out count corrected to 23 sites / 11 files.
4. REQ-4 checkbox row now drops the label's `onClick={e.stopPropagation()}` — cited `:604,706,789` (three sites; the review named two).
5. New delta D8 records `Dialog`/`BottomSheet`/`Drawer` Escape going document-global; test list now names `UniversalPanel.test.tsx:262` and `SearchableSelect.test.tsx:90` as unchanged-but-relevant.
