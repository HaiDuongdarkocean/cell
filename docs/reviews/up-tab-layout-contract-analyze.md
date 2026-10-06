# Analyze-gate review: up-tab-layout-contract

> Artifact: `docs/intent/up-tab-layout-contract.md` · Mode: all · Reviewer: fresh-context adversarial audit · Date: 2026-10-06

## Evidence spot-checks (15)

| Check | Result |
|---|---|
| Code `file:line` refs across Needs/Scope/Risks | PASS — all 15 spot-checks verified exact, including the doc's own corrections of the audit's stale refs (F-3 window `PlaylistTab.tsx:217-225` not `:218-224`; 3 remaps + 4 surface paints not "4 remap copies") |
| `loop/` citations | FAIL → fixed — 5 cites to deleted `loop/universal-panel-ux/state/` files (header Source, N1 `:18`, N4 `:93`, N7 `:27-34`, N9 `:136-143`, MobileSheet risk `:34`) re-pointed to durable audit rows `:24,51,58,68` or restated qualitatively |
| Line drift ×2 | FAIL → fixed — `@container` block is `PlaylistTab.module.css:82-91` (was `:82-90`); studyModes remap is `StudyModesTab.module.css:8` and covers only `--card-background` (was `:7-8`) |
| Journey | PASS — AS-IS 6 steps / TO-BE 5, ends at value |
| Decision `go` | PASS — supported by P0 F-1, P1 F-3/F-5 + risk register mitigations |
| Scope boundary | PASS — In/Out cleanly split vs items 29–33 per backlog deps |
| `ui_surface: yes` | PASS — gutter/surface/mounting deltas are user-visible |
| Stories | PASS — S1–S7 map to needs with measurable done-when |
| Template completeness | PASS — all required sections present and filled |

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. Header Source line: dropped `loop/universal-panel-ux/state/02-code-audit.md` + `03-visual-mobile.md` — durable audit doc carries the findings.
2. N1: dead `02-code-audit.md:18` scroll-scan cite → `20261006-…-audit.md:24` (F-1 empirical) + 5-viewport method `:3`.
3. N4: dead `02-code-audit.md:93` staleness cite → F-9 ID source `…-audit.md:68`, staleness restated as the inherent keep-alive risk.
4. N6: `StudyModesTab.module.css:7-8` → `:8` (remap covers only `--card-background`).
5. N7: dead `03-visual-mobile.md:27-34` pixel cite (~4–8px clipped) → restated qualitatively vs `…-audit.md:58` (M-3).
6. N8 + Scope: `PlaylistTab.module.css:82-90` → `:82-91`.
7. N9: dead `03-visual-mobile.md:136-143` cite → `…-audit.md:51` (the 60–70% void is carried verbatim in the durable doc).
8. MobileSheet risk: dead `03-visual-mobile.md:34` cite → M-3 at `…-audit.md:58` + `MobileSheet.module.css:10-14` for the `bottom:0` anchor.
9. F-9 ID sourcing: "(audit F-9 risk note)"/"(audit F-9 note)" in Stakeholders + Risks → `(F-9, `20261006-…-audit.md:68`)` — the doc's own `UniversalPanel.tsx:287` + `RecapTab.tsx:201-203` evidence already carries the finding.
