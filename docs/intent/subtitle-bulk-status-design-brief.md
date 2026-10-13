# Design Brief — Subtitle bulk status (selected state)

> Stage: DESIGN. Spec: `docs/specs/subtitle-bulk-status.md`. Mockup: `src/entrypoints/mockup-subtitle-bulk-status/` (`npm run dev` → `/src/entrypoints/mockup-subtitle-bulk-status/index.html`).

## Design Read

One new visual only — a *selected* mark on `.js-Tihoka-token` that must coexist with the status underline (bottom edge) and the frequency pill (fill) without being mistaken for either.

## Function audit

| Function | Class | Why |
|---|---|---|
| Selected mark on tokens (ctrl/cmd+click target) | `must-have` | The only user-visible change; without it the gesture is invisible (intent N4) |
| Mark composes with status underline + frequency pill | `must-have` | Selection applies to every status×band combo incl. plain known/ignore |
| Selection count announced (aria-live, visually hidden) | `must-have` | A11y channel for count; invisible — no design surface |
| Esc clears / plain click opens dictionary | `must-have` | Existing behavior, unchanged visuals |
| Tokenized overlay in local player | `must-have` | Visual parity with streaming overlay — existing token styling, no new design |
| Any new chrome (toolbar, checkboxes, badges) | `remove` | Spec forbids new bulk UI; gestures/keys only |

**Primary job:** *let the user see at a glance which words are queued for a bulk status change* — nothing else on screen is new.

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Begin | Ctrl/cmd+click a word in subtitle block or cue list | Token gains selected mark; count announced | Token span |
| 2 | Middle | Ctrl/cmd+click more words (any mix of statuses/bands) | Each toggles; re-click deselects | Token spans across surfaces |
| 3 | End | Press 1–4 | Status applied to all selected; mark clears | All live surfaces repaint |
| 4 | Edge | Esc | Selection + marks cleared | All marked tokens |
| 5 | Edge | Plain click | Dictionary popup (no selection change) | Token → popup |
| 6 | Edge | Popup already open | Keys 1–4 apply to popup term, not selection | Popup |

Moments of uncertainty: "did my click select or open the dictionary?" → the mark must be unambiguous vs. status colors; "is this word already known?" → selected mark must not hide the status underline.

## Dials

Baseline: `DESIGN_VARIANCE 2` (mark must feel native to existing token grammar), `MOTION_INTENSITY 1` (at most a 100–150ms fade; tokens are read while video plays), `VISUAL_DENSITY` n/a (no layout change).

## Inspiration anchor

Tihoka's own selected grammar (`inset-selected` shadow token) + the nature story: a pebble ringed, a leaf washed — the mark is a *gesture of marking*, not a new object.

## Context quote

Spec REQ-4: "a distinct visual treatment, not a status recolor" — status encoding is domain-owned (L-DOMAIN); the mark must use the accent channel.

## Concepts

### Concept A — Tick mark (vạch dấu)
- **IA mental model:** marking — a stroke a reader draws above a word in a notebook margin.
- **Visual archetype:** minimal mark grammar, a new edge channel.
- **Non-digital reference:** gạch chân ngược — vạch kẻ trên đầu từ trong sổ tay.
- **Material / surface:** solid; 2px primary bar inset at the token's top edge.
- **Typography treatment:** unchanged.
- **Motion signature:** fade-in ≤150ms on box-shadow.
- **UX flow:** ctrl+click → top bar appears; status underline stays fully visible below; freq pill keeps hairline frame.
- **UI structure:** no layout change; mark = extra box-shadow layer.
- **3 dials:** VARIANCE 3, MOTION 1, DENSITY n/a.
- **Why it fits:** zero channel conflict — top edge is unused; status (bottom) + freq (fill) + selected (top) all readable at once; `box-decoration-break: clone` gives a tick per line fragment.
- **Risk:** least conventional "selected" read; may read as a second status encoding (similarity-Gestalt, T6) since it reuses the underline *grammar* on another edge.
- **Audit findings:** solves "no visible selected state"; preserves L-DOMAIN (status untouched).

### Concept B — Water wash (vệt nước)
- **IA mental model:** highlighting — the OS text-selection idiom.
- **Visual archetype:** tonal fill, highlighter pen.
- **Non-digital reference:** vệt nước loang nhạt trên giấy.
- **Material / surface:** `color-mix(primary 18%)` overlay via `background-image` — layers over frequency pills without hiding band hue.
- **Typography treatment:** unchanged (no fg override — pill fg is owned).
- **Motion signature:** fade-in ≤150ms on background.
- **UX flow:** ctrl+click → token fills softly; status underline untouched (box-shadow channel free); plain tokens read like selected text.
- **UI structure:** no layout change; mark = background-image layer only — zero per-combo shadow merging.
- **3 dials:** VARIANCE 2, MOTION 1, DENSITY n/a.
- **Why it fits:** the strongest learned "selected" association (T3 — text selection fills); cheapest CSS — one rule covers every status×band combo; quiet (Q1).
- **Risk:** on freq pills the wash shifts band hue slightly (18% tint — bands stay distinguishable but not identical); on `primary-subtle`-tinted dark surfaces the wash is subtle.
- **Audit findings:** solves visibility with the single-rule implementation; L-SCARCITY satisfied (`primary-subtle` is the sanctioned selected fill).

### Concept C — Pebble ring (vòng sỏi)
- **IA mental model:** selection outline — the checkbox/list-item ring.
- **Visual archetype:** existing `inset-selected` grammar.
- **Non-digital reference:** vòng kẻ bao quanh hòn sỏi — ring drawn around a picked stone.
- **Material / surface:** 2px primary inset ring (`inset-selected` token) appended to the token's box-shadow list.
- **Typography treatment:** unchanged.
- **Motion signature:** fade-in ≤150ms on box-shadow.
- **UX flow:** ctrl+click → ring hugs the token; status bar paints over the ring's bottom segment so both stay visible; freq pills get ring + hairline.
- **UI structure:** no layout change; mark = extra box-shadow layer.
- **3 dials:** VARIANCE 1, MOTION 1, DENSITY n/a.
- **Why it fits:** reuses the system's canonical selected encoding (`inset-selected`, L-BORDER state exception); instantly read as "this item is selected"; works on every combo.
- **Risk:** per-combo shadow-list merging is the heaviest implementation (ring must compose with 4 statuses + 5 bands + layer toggles); ring on a 2-line token hugs fragments individually (clone) — visually busier than A/B on wrapped text.
- **Audit findings:** solves visibility with the most conventional read; highest implementation surface.

## Responsive behavior

| Width | Behavior |
|---|---|
| 320px | Marks identical; wrapped multi-line tokens get per-fragment marks (clone) — verified in mockup at Mobile viewport |
| 768px | No layout change anywhere |
| 1280px | No layout change |
| 1920px | No layout change |

## Chosen direction

**Concept B — Water wash** (approved 2026-09-17): `background-image` overlay of the primary accent at ~18% (`color-mix`, anchored on `--color-primary-subtle`) on the selected token. Status underline (box-shadow) and frequency pill (background-color) are untouched channels — one CSS rule covers every status×band combination on both surfaces.

## States

- default / hover (existing) · selected · selected+status(4) · selected+freq(5) · selected+status+freq · selected during resolving state (mark suppressed with rest) · cleared (mark removed)

## Anti-patterns avoided

- No new chrome — the mark is the only pixel change.
- No status-color reuse (L-STATUS/L-DOMAIN): mark is accent-channel only.
- No underline for selected (bottom edge is the status channel — T6 similarity would mis-encode).
- No `outline` (does not fragment across lines; box-shadow clones).

## Why the archetypes differ

Three genuinely different encoding *channels*: A invents a new edge grammar (top bar), B uses fill (the learned selection idiom), C uses the system's existing outline grammar (`inset-selected`). Different non-digital references, different implementation costs, different readings of "selected".
