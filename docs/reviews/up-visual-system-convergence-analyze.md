# Analyze-gate review: up-visual-system-convergence

> Artifact: `docs/intent/up-visual-system-convergence.md` · Mode: all · Reviewer: fresh-context adversarial audit · Date: 2026-10-06

## Evidence spot-checks (26)

| Check | Result |
|---|---|
| `tokens.css:524` `--panel-shadow: var(--shadow-sm)` | PASS — exact |
| `UniversalPanel.module.css:10-19` borderless `.panel` | PASS — only `box-shadow`, no border |
| `Select.module.css:169` `--color-field-solid` | PASS — `.menu` also has hairline `border-emphasized` + `shadow-popover` (:170-172); N2's residual-translucency hedge correct |
| `Card.module.css:28-44` | PASS — `.selected` = `primary-subtle` + `text-accent-strong` + `--shadow-inset-selected` |
| `NavItem.module.css:43-52` + `:15` | PASS — `primary-subtle` bg + `.pill` bar; `--font-size-xs` at :15 |
| `SegmentedControl.module.css:103-139` | PASS — `.filled .segmentActive` = solid `--color-primary` + `text-inverse` |
| `Menu.module.css:1-3, 35-37` | PASS with note — checked = accent text only (no `primary-subtle` bg); DESIGN.md §5:130 sanctions `primary-subtle`+primary text → Menu itself is a convergence target |
| `VocabularyTab.tsx:212-241` + `module.css:26-34` | PASS — ghost `.toolBtn` triggers verified |
| Vocab menus already canonical | PASS — `VocabularyTab.tsx:259-316` already uses `Menu`/`MenuItem`/`MenuSeparator` w/ radio selection → draft AC mis-targets the residual need |
| `UniversalPanel.tsx:247-262` profile `Dialog`+`RadioGroup` | PASS — exact |
| `RecapTab.tsx:50-53` vs `:78-86`, `VocabularyTab.tsx:447-455` + `module.css:112-137` | PASS — three chip impls; opposite hover verified (`RecapTab.module.css:130` brightness(1.06) vs `VocabularyTab.module.css:136` brightness(0.95)) |
| `CardCreatorDialogContent.tsx:292-317` | PASS — `outline`/`primarySubtle`/`primary` footer exact |
| `CardCreatorDialogContent.tsx:207-215` error banner | PASS — block is :208-217 (1-line drift) |
| `SyncPanel.tsx:257-258` | PASS — `variant={showRecoveryAction ? 'primary' : 'secondary'}`; default secondary |
| `CollapsibleSidebar.module.css:24-28` | PASS — `.sections` gap = `space-2` |
| Double seam `DictionaryTab.module.css:18` + `CardCreatorPanel.module.css:10` | PASS — hairline border-right + border-left = 2px seam |
| `PlaylistTab.module.css:9-10, :56`, `PlaylistTab.tsx:172-184` | PASS — radius-md + thick stripe + hand-rolled `.empty` all verified |
| `StudyModesTab.module.css:60-79` | PASS — `.modeIcon{opacity:.8}` :62, `.modeDesc{opacity:.85}` :78 |
| `StudyModesTab.module.css:176-181` `.customsDivider` | FAIL — drift; actual :185-191 (`text-transform: uppercase` at :189) |
| Uppercase+tracking ×5 (`CardCreatorDialog.module.css:209-215`, `SettingsDialog.module.css:92-93,113-114`, `LanguageProfilePanel.module.css:56-57,104-105`, `QueueSidebar.module.css:52-53`) | PASS — all exact |
| `HintIcon.module.css:18-24` | PASS with imprecision — hover = `primary-subtle` bg + `text-accent-strong` (:18-21); accent outline is `:focus-visible` (:23-26) |
| `tokens.json:88,264`, `:203`, `tokens.css:591,593` | PASS — all exact |
| `product-backlog.md:68` + `audit:68-75` dep edges | PASS — deps = 28,29,30,31,32; cost L; item ships last |
| `slidersHorizontal` collision (F-25) | PASS — `VocabularyTab.tsx:223` vs `UniversalPanel.tsx:55`/`UniversalPanelBottomNav.tsx:32` |
| All `02-code-audit.md` / `03-visual-desktop.md` refs (~30) | FAIL — `loop/` deleted; every finding ID survives in durable audit: V-2@:37, V-3@:38, V-4@:39, V-5@:40, V-9@:42, V-10@:43, V-11@:51, V-12/V-13/V-15/V-17@:54, V-14@:55, V-16/V-22@:56, V-7/V-18/V-19@:59, V-20@:58, V-21@:60, F-11@:52, F-13/F-14/F-15/F-23@:53, F-25@:51/54/60 |
| Context row `loop/universal-panel-ux/state/` | FAIL — re-point to `:3` (84 screenshots ×5 viewports) |
| N10 second error via `dictionary.png` | FAIL — deleted; code site: `CardCreatorSettingsPanel.tsx:408-418` `cc-connection-status`/`statusDetail` |
| `audit:52-60` "fix references" | LOOSE — :52-60 are P2 finding rows |
| `audit:14-16` "root causes 2–4" | MINOR — causes numbered :12-16; 2–4 ≈ :13-15 |

## Journey check
PASS — AS-IS 6 steps, TO-BE 5 steps; TO-BE lands promised value.

## Decision
`go` justified — every fix consumes existing tokens/atoms; ship-last dep ordering mitigates sequencing risk; risk register honest.

## Scope boundary
PASS — In/Out mirrors audit `:68-75` without stealing. Watch: "element-height floor" AC must stay visual-consistency (V-13), not item-30 target-size territory.

## ui_surface
PASS — `yes` correct.

## Stories
PASS with nit — done-when clauses name tokens; acceptable (DESIGN.md-sanctioned).

## Template completeness
PASS — all sections, honest confidence mix.

## Required fixes
1. Re-point every `02-code-audit.md` / `03-visual-desktop.md` citation (Needs N1–N11, Scope, Context row, Source line) to durable `docs/audits/20261006-universal-panel-ux-audit.md` rows (mapping above).
2. N10: replace dead `dictionary.png` with `CardCreatorSettingsPanel.tsx:408-418` or durable V-7 (`:59`).
3. Fix drift: `StudyModesTab.module.css:185-191`; `CardCreatorDialogContent.tsx:208-217`; HintIcon wording (accent outline is `:focus-visible`).
4. Re-calibrate draft AC: vocab menus already canonical — target the ghost-trigger/link presentation (V-5); verify or drop "~5 visible cap per V-16".
5. Restate `audit:52-60` (finding rows, not fix refs) and `:14-16` root-cause range.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes
1. All `02-code-audit.md`/`03-visual-desktop.md` citations re-pointed to durable `docs/audits/20261006-universal-panel-ux-audit.md` rows per the finding→row map (Source line, Context row, Regulator row, N1–N12, AS-IS steps 1/6, Risks); raw `loop/`/`state/` paths kept only in parens marked ephemeral.
2. N10: dead `dictionary.png` cite replaced with `CardCreatorSettingsPanel.tsx:408-418` (`cc-connection-status`/`statusDetail`); banner cite drifted to `:208-217`.
3. Drift fixed: `StudyModesTab.module.css:185-191` (`.customsDivider`); HintIcon wording corrected — hover = `primary-subtle` bg + `text-accent-strong` (`:18-21`), accent outline is `:focus-visible` (`:23-26`).
4. Draft AC re-calibrated: vocab-menu AC now targets the residual V-5 ghost-trigger/link presentation (menus already canonical at `VocabularyTab.tsx:259-316`); "~5 visible cap" dropped — durable V-16 carries only the ~17-icon strip (`audit:56`).
5. Loose audit refs restated: Solution row `:52-60` → `:51-60` as P2 finding rows; Need row "root causes 2–4" re-pointed `:14-16` → `:13-15` of `:12-16`.
