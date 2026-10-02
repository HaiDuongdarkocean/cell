# Design Brief — srs-front-variants

Spec: `docs/specs/srs-front-variants.md` (v2.1, APPROVE_WITH_CHANGES applied)
Mockup: `src/entrypoints/mockup-srs-front-variants/` — `http://localhost:5173/src/entrypoints/mockup-srs-front-variants/index.html`

## Design Read

The new surface is a **variant manager for review card faces**: users own the list of memory components (search, CRUD, rename, pick front fields, per-variant new-card loops 1–3, live preview), organized into presets scoped to a collection or a deck. The model is deliberately minimal: a variant is `{ name, icon, fieldIds[], newLoops }` — card toggles (scope both/word/sentence, audio word/sentence) are **derived automatically** from the chosen fields + note material, never configured. The review back is always the canonical full-field verification surface — not configurable. The design decision that remains is *how the manager is organized*. **Chosen: Concept B — Card shelf.**

## Primary job

> “Choose which exercises a deck drills, and what shows on each exercise's front” — with safe defaults (3 built-ins, reset) and immediate visual feedback (live preview against a real note shape).

## Function audit

| Function | Class | Why |
|---|---|---|
| Search variants by name | must-have | explicit Anh requirement (N8) |
| Create / edit / rename / delete variant | must-have | N8, REQ-12 |
| Pick front fields (flat chips; toggles auto-derive) | must-have | N8/N9, REQ-8 |
| newLoops 1–3 per variant | must-have | N10, REQ-7 |
| Live front preview (same `SrsVariantFront` as review — SSOT) | must-have | N14, REQ-11 |
| Preset assign/share across decks (collection default + deck override) | must-have | N12, REQ-5/6 |
| Reset to default (3 built-ins) | must-have | N11, REQ-12 |
| Servability state on the note being previewed | must-have | “căn cứ vào front” guard — preview must show *hidden* state |
| Reorder variants | nice-to-have | spec has `order`; drag can ship later without breaking IA |
| Duplicate variant | nice-to-have | shortcut for presets |

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Open study settings | Open deck/collection settings | Variant section shows preset + list | settings |
| 2 | Find a variant | Type in search | List filters by name | manager |
| 3 | Inspect | Select variant | Editor + preview of front on current material | editor |
| 4 | Shape front | Tick field chips (word, sentence, image, word audio, sentence audio, dictation…) | Preview + derived toggles update live; unservable states shown | editor |
| 5 | Set loops | Pick 1–3 | Saved into variant | editor |
| 6 | Commit or discard | Save / dialog `×` | Draft applies on Save only; `×` discards | editor footer |
| 7 | Scope | Assign/share preset to decks | Preset refs update; deck chip shows override | preset row |
| 8 | Danger | Delete variant / reset defaults | Delete ghost→red-on-hover; reset via shelf kebab menu; confirm | actions |
| 9 | Edge | Note lacks material for a front | Preview shows “Hidden on this note”, tile dims | preview/list |

Moments of uncertainty: deleting a built-in (history kept — reassure), a front with no material (must never look broken — “hidden” not “empty”), derived-toggle availability per note (missing word audio → audio toggle collapses to fixed `Sent`).

## Dials

Baseline: `DESIGN_VARIANCE` 4 · `MOTION_INTENSITY` 3 · `VISUAL_DENSITY` 5

| Concept | VARIANCE | MOTION | DENSITY | Pushes |
|---|---|---|---|---|
| A · Field notebook | 3 | 2 | 7 | density — maximal info, minimal chrome |
| B · Card shelf | 6 | 5 | 3 | variance — preview IS the list item |
| C · Preset ledger | 5 | 2 | 6 | IA — scope-first, ledger rows |

## Inspiration anchor

Feeling: “bộ thẻ trên kệ — nhìn là biết mặt nào làm gì”. Non-digital ref: card catalog drawer / recipe card box. Fits the water/wood story — quiet surfaces, solid fills, no glass.

## Concepts

### Concept A — Field notebook (master–detail)

- **IA mental model:** a settings document — searchable list on the left, selected variant opens as a form on the right, preview docked below the form.
- **Visual archetype:** solid editorial — flat list rows, grouped field sections, pill selects.
- **Non-digital reference:** sổ ghi chép / index-card binder.
- **Material / surface:** `surface` list + `surface` editor on `background`; preview card on `surface-card`.
- **Typography:** weight hierarchy (semibold labels / base values), small meta badges.
- **Motion:** row select tint, preview crossfade only.
- **UX flow:** search → click row → edit inline → preview below → actions (reset/delete) at form foot.
- **UI structure:** `[search + new]` over `[list | editor+preview]`; mobile stacks editor under list.
- **Dials:** VARIANCE 3 · MOTION 2 · DENSITY 7
- **Why it fits:** cheapest path, dense config work, consistent with existing settings surfaces.
- **Risk:** preview competes with form length on mobile; least “flashcard” feel.

### Concept B — Card shelf (preview-first) — CHOSEN

- **IA mental model:** the variants *are* the cards — a shelf of mini card faces rendering the actual front on the selected note.
- **Visual archetype:** dashboard bento — portrait tile grid, each tile a live front face + name/loops foot; dashed “New variant” tile.
- **Non-digital reference:** kệ thẻ mẫu / sample swatch board.
- **Material / surface:** tile `surface` + face `surface-card` reusing `SrsReviewCard.module.css` classes (SSOT with production card).
- **Typography:** minimal — the face carries meaning, name small under it; name input compact (36px, `radius-lg`).
- **Motion:** tile lift on hover, editor opens as Dialog sheet.
- **UX flow:** glance shelf → tap a tile → Dialog editor: live card preview (top) → name → field chips (toggles derive automatically, shown live in preview) → loops 1–3 → footer `Delete (ghost, red on hover) | Save (primary)`; only `×` on the dialog closes — no footer Close. Edits live in a draft; Save commits, `×` discards. Reset-to-defaults lives in the shelf kebab menu (with preset select + search).
- **UI structure:** `[preset select + search icon + kebab + New]` over responsive tile grid.
- **Placement:** new **“Variants”** tab in Study settings sheet (`General | Variants | Customize`); per-deck preset override assigned from deck detail.
- **Dials:** VARIANCE 6 · MOTION 5 · DENSITY 3
- **Why it fits:** “preview = identity” — hidden variants visibly dim on the note; strongest match to the product metaphor.
- **Risk:** editor inside dialog is a second scroll context — mitigated: editor is short (preview + 3 groups).

### Concept C — Preset ledger (scope-first)

- **IA mental model:** a preset is a rulebook assigned to decks — pick the scope (collection default / deck override chips), then manage variant rows inside the preset.
- **Visual archetype:** command deck — scope chips, preset select, ledger table with expandable editor rows.
- **Non-digital reference:** bảng phân công / patching board.
- **Material / surface:** preset card `surface`, expanded editor on `background` inset.
- **Typography:** tabular ledger — name / mini front preview / loops / status columns.
- **Motion:** accordion expand only.
- **UX flow:** pick scope chip → see preset + rows → expand row → inline editor + mini preview; status column shows Active/Hidden for the current note.
- **UI structure:** `[scope chips]` `[preset select + search + new]` `[ledger rows→accordion]`.
- **Dials:** VARIANCE 5 · MOTION 2 · DENSITY 6
- **Why it fits:** only concept where preset *scope* is first-class — sharing/override is visible, not buried.
- **Risk:** table headers compress on mobile (stacked below 640px); ledger reads more “admin” than “study”.

## Responsive

| Width | A | B | C |
|---|---|---|---|
| 320 | list→editor stack | 2-col tiles → 1 | chips wrap, rows stack (name row + meta) |
| 768 | list\|editor split | 3–4 col tiles | ledger columns visible |
| 1280 | same, wider preview | 5–6 col tiles | comfortable ledger |
| 1920 | capped max-width | capped | capped |

## States

All three render: default, hover (`surface-hover` + `opacity-hover`), selected (`primary-subtle`), disabled/hidden (“Hidden on this note” + dim), empty search, loading (list skeleton — same as settings), error (Alert), touch ≥44px, dark theme via tokens.

## Audit findings addressed

- No Liquid Glass — solid surfaces only.
- No ad-hoc components in production plan — mapping doc decides per element.
- Close/delete affordances per Anh's review: delete is `ghost` Button neutral-by-default, red (`color-destructive` + `error-subtle` bg) only on hover; dialog `×` (ghost) is the single close control — no footer Close; Save is primary.
- Toggle/chip stability: cycling labels (`A + ¶`/`A`/`¶`, `Word`/`Sent`) and chip on/off must not resize — `min-width` + centered content + `tabular-nums` (Anh's OCD balance requirement).

## Anti-patterns avoided

- Review fronts are NOT redesigned here beyond spec contracts (no extra chrome on the card face).
- No fixed-enum assumptions in mock data — variants are dynamic entities with builtin flags.
- Preview always reflects the *selected note material* — guarding is demonstrable live (switch Note chips in the shell).
