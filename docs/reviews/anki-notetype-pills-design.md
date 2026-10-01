# Design review — anki-notetype-pills

Reviewer: Anh (interactive approval gate)
Date: 2026-10-01

## Evidence

- Design brief: `docs/intent/anki-notetype-pills-design-brief.md`
- Component mapping: `docs/intent/anki-notetype-pills-component-mapping.md`
- Mockup: `src/entrypoints/mockup-anki-notetype-pills/` served via Vite dev server
- Screenshots: `tmp/anki-notetype-pills/mockup-desktop.png`, `tmp/anki-notetype-pills/mockup-mobile.png`
- Linter: `node scripts/check-design-brief.mjs anki-notetype-pills` → `VERDICT: PASS` (22 tokens, 8 components, 1 icon)

## Approved design

- Borderless bar above "Target word": notetype pills (name + card count) left, ghost `slidersHorizontal` icon button right.
- Pill click → active notetype; field mapping + live preview follow the pill.
- Manage surface: Popover anchored to icon (desktop) / Bottom Sheet (<840px mobile), `Checkbox variant="row"` list over all imported non-Cloze notetypes.
- Disable → pill removed immediately; active disabled → selection falls to next enabled notetype; all-disabled → Start import disabled.
- Advanced options notetype row removed (moved up).

VERDICT: APPROVE
