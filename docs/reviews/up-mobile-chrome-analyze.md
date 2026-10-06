# Analyze-gate review — `up-mobile-chrome` (mode: all)

> Reviewer: fresh-context `all`-mode audit subagent. Scope: `docs/intent/up-mobile-chrome.md` (backlog row 31). Contract: `pipeline-analyze` review gate + `references/intent-template.md` gate checklist.

## 1. Evidence audit — file:line spot-checks against live source

### Verified exact (live source)

| Cited | Verified | Result |
|---|---|---|
| `UniversalPanelBottomNav.tsx:29-36` | 6-tab TABS registry | ✓ exact |
| `UniversalPanelBottomNav.tsx:72-85` | Tools button (7th item) | ✓ exact |
| `UniversalPanelBottomNav.tsx:88-116` | Tools `BottomSheet` rows | ✓ exact |
| `UniversalPanelBottomNav.module.css:34-50` | ≤359px shrink to `--font-size-2xs` w/ ellipsis | ✓ exact |
| `UniversalPanelBottomNav.module.css:55-65` | active = color-only, `background:transparent` (comment: "color-only indicator, no fill") | ✓ exact — durably proves M-4 |
| `TokenizeControls.module.css:2` + `.tsx:38` | `.capsule{flex:1}` + `fullWidth` halves, no media query | ✓ exact |
| `mountOrbitalBadge.ts:42,98,130-169,187-192` | z-index const+assignment, fullscreen reparent, `hide()`/`show()`; `onFullscreenChange` unconditionally restores `display` (:160) — risk-row claim accurate | ✓ exact; `hide()`/`show()` confirmed never invoked outside tests |
| `BottomSheet.tsx:28,97,108-115` | `hideDragHandle` prop; `.dragHandle` `aria-hidden` no handlers; close `size="sm"` | ✓ exact |
| `BottomSheet.module.css:1-4` | SSOT comment naming CardCreator/SubtitleManager/dictionary popup | ✓ exact |
| `MobileSheet.tsx:82-85` + `.module.css:88-95` | `header` prop + 24px peek slot (`HEADER_ROW_HEIGHT_PX` :18) | ✓ exact |
| `NavItem.module.css:95-103` | `.horizontal .pill` bottom indicator | ✓ exact |
| `CardCreatorPanel.tsx:199-207,235` | MobileSheet mounted with no `header`; `useIsMobile(BREAKPOINTS.expanded)` | ✓ exact |
| `mountUniversalPanel.ts:58,93-96` | `--z-overlay-secondary`, host `position:fixed;inset:0` | ✓ exact |
| `UniversalPanel.module.css:1-8,80-84,106-116` | overlay `absolute;inset:0`; ≤839px column-reverse keeps `border-radius`+94%; 100%/radius-0 only ≤599px | ✓ exact — durably proves M-13 |
| `UniversalPanel.tsx:52-59` | diverging second TABS registry (`vocabulary` vs `vocabularyShort` labels — F-20 real) | ✓ exact |
| `UniversalPanelHeader.tsx:46-79` | profile flag + capsule + close, no title | ✓ exact |
| `VocabularyTab.tsx:211-256` + `VocabularyTab.module.css:15-29` | flex toolbar, no overflow/wrap handling | ✓ |
| `tokens.ts:116-122`; `STANDARD.md:279-285`; `DESIGN.md:118`; `en.json:1035-1044`; `vi.json:1035-1044`; `product-backlog.md:66`; `audit.md:75` | breakpoints; WCAG §10 + 44px coarse floor (:313); "320px, then 768px"; tab labels (vi longer: "Tổng kết"/"Từ vựng"); row 31; deps `31 ← {28, 30}` | ✓ all exact |

### Defects — citations not re-verifiable

- **D1 (required): ephemeral citations.** `computed-styles.json`, `03-visual-mobile.md` (~13 line cites), `03-visual-desktop.md:50`, `390x844.tools-sheet.png` live under gitignored `loop/universal-panel-ux/` (`audit.md:5` declares the dir ephemeral). Every cited *finding* has a durable row in `docs/audits/20261006-universal-panel-ux-audit.md` (M-1/F-7 :36, M-2 :45, F-12/M-5 :44, M-11 :46, M-13 :47, M-12/M-15 :57-58, V-6 :56), but the pixel-precise numbers (51px items, panel.rect 380×834, chevron ~x=215, 180px pill, ~330/1000px capsule) exist nowhere durable. Re-anchor each cite to the audit finding row; tag pixel numbers as captured-audit measurements or `[assumption]`.
- **D2 (required): `tokens.css` does not exist** in the working tree (generated artifact). `tokens.css:14-15` / `:141-143` unverifiable as written. Values confirmed correct in `tokens.json:390-391` (`2xs`=10px, `xs`=12px) and `tokens.json:544-546` (`overlay-secondary`=10002 < `overlay-orbital`=10004). Re-anchor to tokens.json.
- **D3 (required): `audit.md:36-47` mislabels "M-1..M-15 rows".** M-12/M-15 are at `:57-58` (P2 batch); **M-4 and M-6 have no durable finding description** — they exist only in coverage row `:71` (M-6's substance partially in root-cause #5 `:16`). Anchor M-4 to `UniversalPanelBottomNav.module.css:52-59` + computed colors, M-6 to audit `:16` + `UniversalPanelHeader.tsx:46-79`.
- **D4 (required): N7 mechanism wrong.** "no bottom padding" contradicts `BottomSheet.module.css:18` (`padding: … var(--space-4)` bottom). M-12's "clipped last row" stands; actual mechanism is mid-row slicing inside a `max-height:75vh`+`overflow:auto` scroll region. Correct the clause; the fix direction may stay.
- **D5 (trivial):** `BottomSheet.tsx:38` → the Kiwi/Edge doc line is `:37`.

## 2. Journey check
AS-IS 6 steps, TO-BE 6 steps (≥3 each), narrative prose. TO-BE lands the promised value. ✓

## 3. `## Decision`
`go` — justified by measured evidence, reuse-not-rebuild, P1 persona failure, declared sequencing after items 28/30. ✓

## 4. Scope boundary vs siblings (28/29/30/32/33)
Cleanly carved. Watch (non-blocking): N2's positional indicator borders item 33's selected-state convergence — DESIGN must not invent a 6th recipe. ✓

## 5. `ui_surface: yes`
Correct — chrome metrics/structure change on every mobile viewport. ✓

## 6. Stories
S1–S8 business-level. ✓

## 7. Template completeness
All sections present; needs carry prescriptive clauses — acceptable as audit-derived constraints. ✓

## Required changes
1. Re-anchor all `loop/universal-panel-ux/` citations to durable rows in `docs/audits/20261006-universal-panel-ux-audit.md`; pixel-precise numbers → "audit-captured measurement" or `[assumption]` (D1).
2. Replace `tokens.css:14-15` / `tokens.css:141-143` with `tokens.json:390-391` / `tokens.json:544-546` (D2).
3. Fix `audit.md:36-47` → `:36-58`; add durable anchors for M-4 and M-6 (D3).
4. Correct N7's "no bottom padding" mechanism claim (D4).
5. `BottomSheet.tsx:38` → `:37` (D5).

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. Re-anchored every `loop/universal-panel-ux/` citation (`computed-styles.json`, `03-visual-mobile.md:*`, `03-visual-desktop.md:*`, `390x844.tools-sheet.png`) to durable rows in `docs/audits/20261006-universal-panel-ux-audit.md` (M-1/F-7:36, M-2:45, F-12/M-5:44, M-11:46, M-13:47, M-12/M-15:57-58, V-6:56); pixel-precise numbers (51px items, panel.rect 380×834, chevron ~x=215) tagged "audit-captured measurement" or `[assumption]`, ephemeral filenames kept only in parentheses marked ephemeral (D1).
2. Replaced `tokens.css:14-15` → `tokens.json:390-391` (2xs=10px, xs=12px) and `tokens.css:141-143` → `tokens.json:544-546` (overlay-secondary=10002 < overlay-orbital=10004) (D2).
3. Fixed the `audit.md:36-47` blanket range → per-finding rows spanning `:36-58`; added durable anchors for M-4 (`UniversalPanelBottomNav.module.css:52-59` — the "color-only indicator" comment) and M-6 (`audit.md:16` root cause #5 + `UniversalPanelHeader.tsx:46-79`) (D3).
4. Corrected N7's mechanism: `BottomSheet.module.css:18` does set bottom padding (`var(--space-4)`); defect reworded to the last row being sliced mid-height inside the `max-height:75vh` + `overflow:auto` scroll region with no extra inset/scroll-fade guarding the cutoff; fix direction unchanged (D4).
5. `BottomSheet.tsx:38` → `:37` for the Kiwi/Edge doc line in Context (D5).
