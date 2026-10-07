# Spec Review — up-visual-system-convergence

Spot-checks (all PASS): `.secondary` gap real (`Button.tsx:6,109` `styles[variant]` vs `Button.module.css` — no `.secondary`; base `.button` = `solid-surface`/`solid-border: transparent` is the "disabled costume" mechanism) · `Menu.module.css:35-37` checked = accent-text-only ✓ · `panel.*` tokens :690-697 `shadow-sm`+`transparent`, single consumer `UniversalPanel.tsx:193`, hairline already painted `Surface.module.css:9` ✓ · `tool-row-*` sole consumer `UniversalPanelBottomNav.module.css:92-100` (showcase `.tool-row` classes don't read the vars) ✓ · `LanguageProfilePanel.module.css:272-321` portaled `border:none`+`shadow-floating`+`overlay-hover` menu ✓ · `--chip-status-*` live at `tokens.json:565`, consumed by CandidateView/Vocabulary/Recap ✓ · Chip hover contract :70-104 solid-pair swap ✓ · `Card .selected`, `SearchableSelect .optionSelected`, `NavItem` pill/`aria-current`, `SegmentedControl` filled/chips solid vs `accent` subtle, `HintIcon`, `Slider`/`--color-track` (:88,264 = text@15%), `Menu.tsx:28-34` contract, `EmptyState` compact/action/`role=status`, seam pair `DictionaryTab:18`/`CardCreatorPanel:10` (mobile zeroes :22), `ModeCards` overrides :14-16, playlist `:9-14` stripe w/ dead fallbacks, vocab chip trio + opposite `brightness()` hovers (:129-130 up / :135-136 down), SyncPanel :257-262, footer :292-317, banner :208-217, status row :408-418, uppercase sites all within cited ranges, `slidersHorizontal` collision exact. Recipe registry is grounded — R-SEL-LIST/R-SEL-CARD/R-NAV-CURRENT name existing code (SearchableSelect/Card/NavItem), not a new dialect; AC-15 correctly scopes V-13 height as visual-consistency, not target-size.

## Major

1. [REQ-5 / Boundaries / DoD] [TL]: `.secondary` fix's blast radius under-scoped. Actual `variant="secondary"` consumers ≈40 sites (not "~15+") incl. `Select.tsx:440`, `SearchableSelect.tsx:158`, `CopyButton`, `CollapseButton`, `PronunciationButton`, `SrsDeckDetail` ×9, local-player, popup — and **subtitle split-view surfaces** (`SubtitlePanel.tsx:389`, `SubtitleSearchPanel.tsx:94`, `ApiKeyManager.tsx:218`, `SubtitleManagerPanel.tsx:318`) that Boundaries lists as "Never touch". Worse, `SubtitleManagerPanel.module.css:344-356` `.offRow.offRow` explicitly compensates for the missing class ("falls back to base `.button`, row chrome owned here") — it resets `background`/`box-shadow` but NOT `border`, so a `.secondary` rule adding a border regresses that surface. Fix: REQ-5 adds a `variant="secondary"` consumer sweep step (find compensating overrides, not just call sites); Boundaries reword to "no subtitle *files* edited — atom-level visual change acknowledged + `subtitle-split-view-ac.md` re-verify added to DoD".
2. [REQ-12 vs AC-15 / Traceability] [PO/BA]: AC-15 asserts "V-13 dashed add-boxes share one radius + height family" but no REQ flow enumerates the add-box sites or mechanism — sites exist (`LanguageProfilePanel.module.css:31`, `EmptyState.bordered` :105-109, `MediaList.module.css:33,86`, `DictLinksManager.module.css:36`) yet appear nowhere in REQ-1–12. Intent scope item V-13 is untraced at requirement level. Fix: add an add-box site row/step under REQ-12 (or REQ-9's sizing step).

## Minor

1. [REQ-2] [TL]: `panel.border → border-subtle` pre-decides the weakest hairline against V-9's bright-page risk; registry allows `border`. Gated by AC-4, but let DESIGN pick between `border`/`border-subtle` with the capture as evidence.
2. [REQ-3 vs NFR-3] [PO]: NFR-3 says `aria-*` roles "unchanged" while REQ-3 sanctions radio→menuitemradio / dialog→menu semantics. "Ask first" carves the exception but NFR-3 should say "unchanged except sanctioned Menu migrations".
3. [REQ-7] [PO]: vocabulary EmptyState "gains description" — no `vocabulary.empty*` hint key exists today; new i18n key needed (vs NFR-3 "i18n keys unchanged"). Say "keys added where anatomy requires, existing keys unchanged".
4. [REQ-1] [TL]: MenuItem checked `primary-subtle` bg + hover composition deferred to DESIGN — fine, but `aria-checked` Menu consumers outside the panel (dictionary popup, showcase) inherit the new bg; AC-17 covers, cite it in the REQ row.
5. [R-TRIGGER] [BA]: weakest-grounded recipe — cites defect V-5 not a DESIGN.md recipe; acceptable since it constrains DESIGN to existing Button variants.
6. [REQ-8/9, AC-3] [PO]: V-19 tile sites + residual-surface list deferred to DELIVER sweeps (honest, `loop/` evidence deleted) — AC-3/AC-12 partially unplannable; flagged in Open Questions, keep.
7. Nit: `Chip.module.css:70-100` → actual :70-104.

## Nhận xét theo role

- BA: Problem-led, persona + dep owners named, non-goals strong; every REQ traces N1–N12 except the V-13 clause noted above.
- PO: 17 ACs largely grep/computed-style/capture-testable; two judgment ACs (AC-6, AC-12) bound to capture evidence — acceptable for a visual spec; AC-15 needs its REQ.
- TL: Execution-sheet structure with verified site tables + enumerated audit sweeps is implementable; the one underestimated blast radius is `.secondary` (~40 sites, compensation styles, never-touch surfaces).

## Action items

1. REQ-5: add secondary-consumer sweep + subtitle-AC re-verify + fix Boundary wording — REQ-5/Boundaries/DoD.
2. Add V-13 dashed add-box sites/mechanism — REQ-12 or REQ-9.
3. Reword NFR-3 aria clause; REQ-7 i18n clause — NFR-3/REQ-7.
4. Loosen `panel.border` to DESIGN-picked `border`/`border-subtle` — REQ-2.

## Risks chấp nhận

- SegmentedControl solid-fill may survive as documented variant — revisit at DESIGN contrast gate.
- Sweep-pinned site lists (V-19 tiles, residual floats) — revisit at DELIVER sweep output.
- R-TRIGGER skin undefined — revisit at DESIGN variant pick.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. REQ-5 preconditions corrected to ~60 call sites / ~40 files (incl. subtitle surfaces + `Chip`/`Tabs`/`Accordion` internal routers); new basic-flow step 2 adds the compensating-override sweep with `.offRow.offRow` as the verified leak; Boundaries moved subtitle surfaces from "Ask first" to a clarified "Never" (no `src/features/subtitle/` *files* edited; atom-level change acknowledged) and DoD gained a `subtitle-split-view-ac.md` re-verify line — `docs/specs/up-visual-system-convergence.md:135-141,342-343,373-374`.
2. REQ-12 gained step 5: verified V-13 dashed add-box site table (`LanguageProfilePanel` `.banner`, `EmptyState.bordered`, `MediaList` `.cc-media__empty`/`.cc-media__dropzone`, `DictLinksManager` `.dropPlaceholder`) + DESIGN-picked radius/border/height floor mechanism + sweep for residual `dashed` surfaces — `:251-261`.
3. NFR-3 reworded (`aria-*`/`role` unchanged except REQ-3's sanctioned `Menu` migrations; existing i18n keys unchanged, additions only where anatomy requires) and REQ-7 step 2 notes the new `vocabulary.empty*` hint keys — `:167,274`.
4. REQ-2 `panel.border` loosened to a DESIGN pick between `--color-border`/`--color-border-subtle`, evidence-gated by AC-4's bright-page capture; Rules line aligned — `:78,94`.
