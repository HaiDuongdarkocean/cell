# Design Review — anki-known-seed

VERDICT: PASS (vision-reader, all mode)

Spec: `docs/specs/anki-known-seed.md` · Brief: `docs/intent/anki-known-seed-design-brief.md` · Mapping: `docs/intent/anki-known-seed-component-mapping.md` (lint PASS: 2 tokens, 13 components)

## Evidence

Mockup `src/entrypoints/mockup-anki-known-seed/` (design-time artifact, deleted at ship). Screenshots `tmp/anki-known-seed/`:

- `light-absent.png` — sync section + addon-absent Alert, 5-status chips + legend + keymap
- `light-connected.png` — addon connected (StatusDot success)
- `dark-absent.png` — dark theme, learning blue `#6BA5FF` holds contrast
- `mobile-light.png` — 380px, wraps correctly

## Vision-reader findings

P2 only (non-blocking):

1. Write-back row lacks ⓘ HintIcon — copy is inline muted text; acceptable, hint lives in copy itself.
2. Keymap lists 1U 2T 3K 4I 5L vs cycle order U→T→L→K→I — intentional: keys 1–4 unchanged (muscle memory), `5` added for learning. Recorded in spec Open Questions.
3. InputField renders filled/borderless pill — that IS the canonical InputField treatment.
4. Mobile chips <44px — chips are display/filter affordances matching existing vocabulary chip sizes; filter row uses Menu in product (mapping) — noted.

Confirmed: learning blue distinct in light+dark across chip/underline/keymap; toggles/buttons ≥44px; no clipping; dark mode clean.

VERDICT: PASS
