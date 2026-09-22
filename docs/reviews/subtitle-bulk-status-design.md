# Design Approval — Subtitle bulk status

Date: 2026-09-17 · Stage: DESIGN gate (interactive) · Mockup: `src/entrypoints/mockup-subtitle-bulk-status/`

## Presented

Three divergent selected-state encodings for `.js-cell-token`, exercised live on the mockup (ctrl/cmd+click toggle, Esc clear, status×frequency matrix, mobile/desktop, light/dark):

- **A — Tick mark**: 2px accent bar on the token's top edge (new edge grammar, mirror of the bottom status underline).
- **B — Water wash**: ~18% primary `color-mix` fill via `background-image` (OS text-selection idiom).
- **C — Pebble ring**: `inset-selected` outline grammar appended to the token's box-shadow list.

## Decision

User picked **Concept B — Water wash**: "chọn b như water wash" — selected words show the wash; status and frequency encodings stay the system's existing design (user explicitly confirmed status/frequency keep the current designed look).

## Rationale captured

- Cheapest honest implementation: one CSS rule covers every status×band combo — `background-image` overlays the frequency pill without hiding band hue, and the status underline (box-shadow) is an untouched channel.
- Strongest learned "selected" association (fill = selection idiom); quiet, consistent with Q1/Q4.
- L-SCARCITY satisfied — `primary-subtle` is the sanctioned selected-state fill.

## Follow-ups for DELIVER

- Selected known/ignore tokens reveal their status underline while selected (same grammar as hover/`--popup-open`) — carried into spec behavior.
- Wash var injected via `CELL_TOKEN_MAP` in `tokenSpanCss.ts` (host pages lack `tokens.css`); both builders get the rule.
- `aria-live` count region via `VisuallyHidden`, one per page.
- Mockup directory is deleted at ship.

VERDICT: APPROVE
