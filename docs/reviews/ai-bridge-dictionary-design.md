# Design Review — ai-bridge-dictionary

Mode: `all` (single justified variant). Artifacts reviewed:

- `docs/intent/ai-bridge-dictionary-design-brief.md`
- `docs/intent/ai-bridge-dictionary-component-mapping.md`
- `src/entrypoints/mockup-ai-bridge-dictionary/` (index.html, main.tsx, mockup.css)
- Screenshots: `tmp/chatgpt-bridge-poc/design-shots/` (10 shots: 4 panels × states × dark/light × popup/narrow)

## Design lint

`node scripts/check-design-brief.mjs ai-bridge-dictionary` → `VERDICT: PASS` (10 tokens, 32 components, 10 icons — all resolve against `tokens.json` / `src/shared/ui` / `ICON_CATALOG`).

## Vision review (2 rounds)

Round 1 (VERDICT: CHANGES) — fixed:
1. Toolbar pill labels truncated → switched to icon-only pills matching the production `DictionaryToolbar` (`.TihokaLabel` hidden by default).
2. Loading state now dims non-active provider pills including their status dots.
3. Error state now marks all provider pills error-styled, none active.
4. Failover state now shows the surviving provider's answer + muted notice line, not the all-failed error.
5. Breakdown renders a real `<ol>` numbered list, one entry per line.
6. Settings failover-order chips moved to a stacked label-over-row layout — no orphan wrap.

Round 2 (VERDICT: CHANGES) — fixed:
- Literal `\n` in the user-prompt field → real newline.
- Inactive segmented item lacked affordance in dark mode → hairline border added.
- Accepted: mid-word ellipsis on the context line is standard `text-overflow: ellipsis` behavior and matches the production popup's existing pattern.

Round 3 spot-check → VERDICT: PASS.

## Trace to spec

- REQ-1/9 (AI tab, retry) → `ai` pill, answer card, attribution + retry IconButton.
- REQ-2 → `autoOpenOnMiss` toggle in settings; miss auto-opens the `ai` pill.
- REQ-3 → `breakdown` pill, numbered-list answer card.
- REQ-4 → `SegmentedControl` Google|AI inside translate tab.
- REQ-7/8 → provider pill row with `StatusDot`, failover pill states.
- REQ-6/10 → settings section: feature-segmented prompt editors, provider order chips, toggles.

VERDICT: APPROVE
