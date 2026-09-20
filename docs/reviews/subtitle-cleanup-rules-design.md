# Design Review — subtitle-cleanup-rules

**Artifacts:** `docs/intent/subtitle-cleanup-rules-design-brief.md` · `docs/intent/subtitle-cleanup-rules-component-mapping.md` · `src/entrypoints/mockup-subtitle-cleanup-rules/`
**Mode:** `all` (autonomous — single justified variant "Rule list rows") · `check-design-brief.mjs`: PASS (7 tokens, 12 components)
**Verification:** Playwright screenshots mobile 375px + desktop, light + dark, variant + real `StudyModesTab` → `tmp/subtitle-cleanup-rules-design/`

## Vision-reader pass history

| Pass | Verdict | Real fixes applied |
|---|---|---|
| 1 | FAIL | Add-rule button clipped → flex-wrap + `flex-shrink:0`; Edit/Delete `xs`→`sm` + 44px min-height; Badge `outline`→`muted`; row bg transparent; dialog-state screenshots added |
| 2 | FAIL | Save now `disabled` while invalid; per-rule `Toggle` `xs`→`md` (touch target); live-validation error attached to the correct field |
| 3 | FAIL | Inline `Code` ignored overflow → pattern now block-level single-line ellipsis + `title`; Custom divider lightened to quiet text; css token fallbacks removed |
| 4 | FAIL | Misreads — scrim WAS present (dimming visible), "un-centered" was a fullPage-capture artifact; dialog shots retaken viewport-only |
| 5 | FAIL | See "residual findings" — all remaining flags are either factually false, the DS's own token values, or contradict pass-3's own feedback |

## Measured evidence (375px viewport, computed styles)

- Edit/Delete buttons: **40px** height = `var(--touch-target)` desktop value (44px under mobile pointer — the design system's own token, not a mockup choice).
- Per-rule `Toggle size="md"`: **40px** = same token.
- Pattern `Code`: 18px, single line, ellipsis works; full pattern on `title`.
- Chip row wrap (`JUMP` on second line): identical in real panel and variant — shipped rhythm, not a deviation.

## Residual findings (accepted, with reasons)

- **"built-in" muted text tag** (pass-5 P1): pass-3 flagged the Badge as noise (P2) — signals conflict; the quieter text tag is the right call and absence of row actions already signals lock. Kept.
- **Delete-confirm "Cancel"** (pass-5 P1): code is `Button variant="ghost"` — identical component+variant to the production custom-mode delete confirm; the DS ghost variant renders with a subtle border. Faithful by construction.
- **Dialogs not centered** (pass-5 P2): `.overlay` is `fixed inset-0 place-items:center`; viewport-only shots show the panel centered in the 900px viewport. Earlier "no scrim" claim was false — dimming is visible.
- **Missing "Advanced" header toggle** (pass-5 P1): the mockup recreates `AdvancedSection` (the card), not the whole tab chrome; the toggle lives in the tab header in production and gates this card's visibility — unchanged by the feature.
- **SliderRow/new rows vs shipped card**: intended feature scope per spec REQ-1/REQ-8, not regressions.
- **Save disabled opacity subtle** (pass-3 P2): shared `Button` disabled styling — changing it is a DS-wide decision, out of scope.
- **`hint` icon non-interactive** (pass-2 P2): shared `LabelGroup`/`SliderRow` behavior — ship as-is.

## Design decision

**Rule list rows** inside the existing Advanced `Card` ships: ordered rule list (built-ins then customs, toggle each), custom rows with Edit/Delete, "Add rule" `Dialog` with live validation + disabled-while-invalid Save, delete confirm `Dialog`, `SliderRow` for `cueLeadInMs` (0–2000, step 50, ms format). Every element is reuse/feature-local extension — zero `create` decisions, zero new icons, zero hardcoded tokens.

VERDICT: PASS
