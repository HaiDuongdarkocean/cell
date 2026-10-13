# Design Brief — Vocabulary tab redesign

> Slug: `vocabulary-tab-redesign` · Spec: `docs/specs/vocabulary-tab-redesign.md` · Mockup: `src/entrypoints/mockup-vocabulary-tab-redesign/`

## Design Read

A calm review surface — the learner's personal word notebook inside the panel: sections they can flip between, a list that stays readable on a phone-width panel, and a trash that quietly keeps yesterday's removals.

## Function audit

| Function | Class | Why |
|---|---|---|
| Filter vocabulary by status | must-have | core navigation of the tab |
| Search words | must-have | primary way to find a term |
| Sort list | must-have | recency / alpha / grouped |
| Look up a word | must-have | bridge to Dictionary tab |
| Cycle word status | must-have | the learning loop itself |
| Edit mode (reveal delete) | must-have | REQ-6 — destructive affordances on demand only |
| Remove → trash (soft delete) | must-have | REQ-7 — the feature's reason to exist |
| Trash view + restore + delete-forever | must-have | REQ-9/10/11 |
| Purge expired trash | must-have | REQ-12 — system-internal, no UI beyond countdown text |
| Segment counts | nice-to-have | cheap; makes the filter legible |
| Bulk select / bulk delete | remove | not requested; adds a second selection model for zero gain |

**Primary job:** review and manage marked words — scanning happens daily, removal is rare, restore is rare. The UI optimizes for scanning first.

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Open tab | tap Vocabulary | list renders under current segment | whole surface |
| 2 | Narrow scope | pick a status segment | list filters; count visible | filter control |
| 3 | Find a word | type in search | list/trash filters live | search row |
| 4 | Re-order | pick a sort | list re-sorts | sort control |
| 5 | Check a word | tap term | Dictionary lookup opens | row |
| 6 | Manage | tap Edit | delete affordances appear; control → Done | mode toggle |
| 7 | Remove | tap row Remove → confirm | word → Trash; toast-free quiet removal | dialog → list |
| 8 | Recover | open Trash, tap Restore | word returns at previous status | trash view |
| 9 | (edge) Empty | filter/trash has nothing | localized empty state | list area |
| 10 | (edge) Expiry | 24h passes | entry purged on next read | system-internal |

Moments of uncertainty: accidental remove (→ dialog + trash undo), losing a word to expiry (→ visible countdown).

## Dials

Baseline: `DESIGN_VARIANCE` 4 · `MOTION_INTENSITY` 2 · `VISUAL_DENSITY` 4

| | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
|---|---|---|---|
| A — Chapter tabs | 4 | 2 | 4 |
| B — Compact toolbar | 6 | 2 | 6 |
| C — Inbox rail | 7 | 2 | 3 |

## Inspiration anchor

Feeling: quiet notebook, not a dashboard. Non-digital references per concept below. Visual reference: the shipped Dictionary toolbar + Universal Panel surfaces — same component family, same tokens.

## Concepts

### Concept A — Chapter tabs
- **IA mental model:** the tab is a notebook with labeled section tabs along the top; Trash is the back pocket.
- **Visual archetype:** solid editorial — one segmented pill row, stacked controls, ruled list rows.
- **Non-digital reference:** sổ từ vựng có tab phân loại ở mép trang + túi đựng giấy nháp ở bìa sau.
- **Material / surface:** solid surface card, subtle dividers between rows.
- **Typography treatment:** `sm` labels, medium-weight terms, `xs` timestamps/counts.
- **Motion signature:** none beyond control hovers/focus.
- **UX flow:** segment → search → (sort, Edit) → list → edit-mode remove → dialog → trash view → restore.
- **UI structure:** `[segments] [search] [sort | Edit] [list]` — everything stacked, never side-by-side-collapsing.
- **3 dials:** DESIGN_VARIANCE: 4, MOTION_INTENSITY: 2, VISUAL_DENSITY: 4
- **Why it fits:** direct continuation of the Dictionary toolbar language; every control visible, zero discoverability risk; structure identical at all widths.
- **Risk:** five segments may scroll horizontally on very narrow panels (mitigated: scrollable rail, counts preserved).

### Concept B — Compact toolbar
- **IA mental model:** a pro toolbar — the list is the content; controls collapse into menus.
- **Visual archetype:** command bar — slim top bar with popover menus for filter and sort.
- **Non-digital reference:** thanh công cụ máy ảnh — ít nút mặt ngoài, mở panel khi cần.
- **Material / surface:** hairline-divided toolbar, popover card menus.
- **Typography treatment:** same scale as A, denser rows (`1.5` padding).
- **Motion signature:** popover open/close only.
- **UX flow:** filter menu (w/ counts + Trash) → search → list → edit → dialog → trash.
- **UI structure:** `[toolbar: Filter▾ Sort▾ · Edit] [search] [dense list]`.
- **3 dials:** DESIGN_VARIANCE: 6, MOTION_INTENSITY: 2, VISUAL_DENSITY: 6
- **Why it fits:** maximizes list space; scales to more filters later without growing chrome.
- **Risk:** filter visibility drops behind a menu — the exact complaint Anh made is about *presentation*, and burying filters may read as hiding them; Trash also becomes less discoverable.

### Concept C — Inbox rail
- **IA mental model:** the tab is a small mailbox — folders on the side, contents on the right.
- **Visual archetype:** file cabinet — vertical folder rail with counts; wide pane for the list.
- **Non-digital reference:** tủ hồ sơ mini — ngăn kéo ghi nhãn một bên.
- **Material / surface:** rail separated by hairline; airy rows (`3` padding).
- **Typography treatment:** same scale; counts right-aligned per folder.
- **Motion signature:** none beyond hovers.
- **UX flow:** pick folder → search → list → edit → dialog → trash folder.
- **UI structure:** `[rail | search / (sort,Edit) / list]` at ≥640px; rail collapses to a horizontal scroll strip below 640px.
- **3 dials:** DESIGN_VARIANCE: 7, MOTION_INTENSITY: 2, VISUAL_DENSITY: 3
- **Why it fits:** uses horizontal space on wide panels (fixes the "unfriendly on large screens" complaint structurally); folders make Trash a first-class place.
- **Risk:** rail steals ~180px on narrow panels (mitigated: collapses to strip); deviates furthest from current panel IA — the only concept where the tab gains an internal two-pane layout.

## Responsive table

| | 320–420px | ~700px | ≥840px |
|---|---|---|---|
| A | segments scroll sideways, controls stack, full-width search | same stack, more padding | same stack, generous padding, no dead space inside frame |
| B | toolbar 3 buttons + search row, dense list | same | same — least change across widths |
| C | rail → horizontal scroll strip on top | rail → vertical, list pane comfortable | rail + airy pane, best use of width |

## States (chosen-direction-agnostic)

- Segment: default / hover / selected (primary-subtle or elevated pill) / focus-visible ring
- Row: default / hover / status-pill active / edit-mode delete visible
- Trash row: countdown text / restore hover / delete-forever danger hover
- Dialog: remove-confirm (mentions 24h), purge-confirm (destructive)
- Empty: list-empty / filter-empty / trash-empty (distinct copy)
- Dark theme: all token-driven, no hardcoded color

## Audit findings addressed

- Search+Select shared row → **all concepts give search a dedicated full-width row** (P0 fixed structurally, not by CSS patching)
- Always-visible delete → **view/edit split in all concepts**
- Filter chip cloud → **three distinct alternatives: segments / menu / rail**
- Flat uniform padding → **per-concept density + container-query padding steps**

## Anti-patterns avoided

- No shared `common.tsx` layout across concepts — each file owns its archetype
- No invented tokens/components in wireframes — `var(--*)` only
- No Liquid Glass — solid surfaces
- Mock data + handlers shared via `state.tsx` only (state, never layout)

## Chosen concept

**Concept B — Compact toolbar** — user pick (vetoed an earlier autonomous pick of A).

User refinements on B:

1. **Row spacing reserves the delete slot** — row height/width must not shift when Edit mode reveals the delete button (reserve the action slot, don't append it).
2. **No timestamp in rows** — drop the `x ago`/`toLocaleDateString` meta; it adds noise without value.
3. **Status chip cycles only the 3 persisted states** — `tracking → known → ignore → tracking`. A word inside the Vocabulary tab is by definition marked; `unknown` is never reachable from the chip. Only external surfaces (dictionary popup footer, shortcut keys 1–4) can set `unknown`, which auto-removes the row from this tab (removal semantics, not a ghost row).

Row anatomy (final): `term (flex-1, ellipsis) — status chip (dictionary TihokaHeaderStatus pastel) — [reserved action slot: delete icon in Edit mode]`.

Trash row anatomy: `term — previousStatus chip (static) — "Nh left" retention — restore icon — delete-forever icon`.
