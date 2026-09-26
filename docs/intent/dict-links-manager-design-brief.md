# Design Brief — dict-links-manager

> Spec: `docs/specs/dict-links-manager.md` · Mockup: `src/entrypoints/mockup-dict-links-manager/` (`npm run dev` → `/src/entrypoints/mockup-dict-links-manager/index.html`)

**Design Read:** A small ordered list of shortcuts, edited rarely, inside an existing settings card — the UI should feel like tidying a shelf, not configuring a system.

## Function audit

| Function | Class | Why |
|---|---|---|
| View links in order | must-have | Entry point to every other op |
| Add link (name + URL template + placeholder hint) | must-have | Core ask; hint prevents dead pills |
| Rename (inline, click name) | must-have | "sửa tên" — cheap, frequent relative to add |
| Edit name + URL (dialog) | must-have | User direction: "nhấn vào edit là edit cả name và link" |
| Delete (confirm) | must-have | Destructive but reversible by re-add |
| Drag reorder + keyboard fallback | must-have | "thay đổi vị trí"; a11y persona 5–80 |
| Per-link `langCodes` | remove | User decision — profile-scoped |

**Primary job:** "keep my preferred dictionaries one tap away, in my order." Frequency: setup-once + occasional tweak. Risk: delete is the only destructive act → confirm dialog.

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Open | Settings → Dictionary Popup | link list renders in stored order | manager subsection |
| 2 | Add | tap Add → type name + template → Save | validates (incl. `{term}` probe) → persists → row appears | editor dialog |
| 3 | Edit | pencil → dialog (name + URL) → Save; or click name → inline rename | full validation / trim+non-empty → persists | editor dialog / inline input |
| 4 | Delete | activate delete → confirm | removes → persists | confirm dialog |
| 5 | Reorder | drag handle / arrows → drop | live preview → commit → persists | row/pill strip |
| 6 | Edge | empty list; invalid template; cancel mid-drag | empty state; inline error; order unchanged | — |
| 7 | Consume | next lookup | pills render stored list/order | popup (existing LinksPanel) |

Moments of uncertainty: writing a correct URL template (→ hint line + validation), accidental delete (→ confirm), mid-drag regret (→ Esc/pointercancel).

## Dials

Baseline — `DESIGN_VARIANCE` low-medium (settings card context), `MOTION_INTENSITY` 2 (row hover + drag ghost only), `VISUAL_DENSITY` 6 (compact rows, forms breathe).

## Inspiration anchor

Feeling: "xếp lại vài cuốn sổ tra từ trên giá" — a shelf of reference booklets you rearrange by hand. Non-digital reference: a bookmark row in a dictionary's edge. Matches the water/nature story: solid surfaces, no glass.

## Concepts

### Concept A — Resource rows (user-directed)
- **IA mental model:** vertical list you sort — the Resources-manager grammar
- **Visual archetype:** solid editorial rows inside the card (`Card` radius-lg, same as `ResourceCard`)
- **Non-digital reference:** book spines on a shelf edge
- **Material / surface:** `Card` rows on card surface
- **Typography treatment:** medium name, xs muted URL, `code` hint
- **Motion signature:** card lift (shadow-lg + slight rotate, `cardDragging`) + inset drop line; settle on drop
- **UX flow:** surface tab strip (audio / image / translate / **Dictionary**) mirrors the popup toolbar — selecting *Dictionary* reveals the manager; grip-left drag; click name → inline rename; pencil → shared `Dialog` editing **name + URL**; trash → confirm `Dialog`; "Add link" opens the same editor dialog empty
- **UI structure:** `[surface tabs]` → `[grip][name/url][pencil 40px][trash 40px]` per `Card` row; subsection header owns the Add button
- **3 dials:** DESIGN_VARIANCE 2, MOTION_INTENSITY 2, VISUAL_DENSITY 6
- **Why it fits:** identical grammar to `ResourceCard`/Resources — the codebase's established answer to "manage a list of things"; smallest design risk, clearest affordances at 320px
- **Risk:** least novel; two icon buttons + grip can feel busy on narrow widths
- **Audit findings:** none — surface is new

### Concept B — Pill strip (WYSIWYG)
- **IA mental model:** "the pills ARE the popup's pills" — arrange the very thing that renders
- **Visual archetype:** token/chip strip
- **Non-digital reference:** rearranging fridge-magnet words
- **Material / surface:** filled pills on card surface, dashed "+ Add" pill
- **Typography treatment:** xs pill labels mirroring `LinksPanel` exactly
- **Motion signature:** pill drag; editor block slides in under strip
- **UX flow:** tap pill → editor below (name + read-only URL + Delete/Done); drag pills horizontally; "+ Add" pill → editor becomes the add form
- **UI structure:** wrapping pill strip + conditional editor block
- **3 dials:** DESIGN_VARIANCE 5, MOTION_INTENSITY 2, VISUAL_DENSITY 4
- **Why it fits:** strongest WYSIWYG story — what you arrange is literally what the popup shows
- **Risk:** pill = both select-target and drag-source (tap vs drag gesture split on touch); delete is one level deep (editor); cramped when names are long on 320px
- **Audit findings:** none

### Concept C — Card deck
- **IA mental model:** a small collection — one card per dictionary
- **Visual archetype:** raised mini-cards (bento-adjacent, still flat)
- **Non-digital reference:** index cards in a recipe box
- **Material / surface:** `surface-card` cards, hairline border, subtle lift
- **Typography treatment:** medium name, xs domain (host extracted, not raw template)
- **Motion signature:** card lift on drag, drop-line inset
- **UX flow:** header row owns the primary Add button; per-card pencil/trash/grip; add opens an accent-bordered editor card on top
- **UI structure:** `┌ icon | name/domain | actions ┐` cards, stacked
- **3 dials:** DESIGN_VARIANCE 4, MOTION_INTENSITY 3, VISUAL_DENSITY 7
- **Why it fits:** most breathing room per entry; domain extraction reads friendlier than raw `{term}` template; scales to longer lists
- **Risk:** more chrome per row for a 3-item typical list; three right-edge controls tighten 320px (grip + pencil + trash)
- **Audit findings:** none

## Responsive

| Width | A | B | C |
|---|---|---|---|
| 320px | URL truncates; icons stay 40px | pills wrap 2-col-ish; editor full width | actions squeeze — drop zone still works |
| 768px | comfortable single rows | pills one/two lines | same |
| 1280px+ | unchanged (card max-width owns the bound) | unchanged | unchanged |

## States

All concepts render: default, hover (row/pill wash), focus-visible (border-focus outline), dragging (40% opacity + drop line), editing (inline input), adding (form), empty (hint text), error (inline destructive), confirm-delete (Dialog), disabled grip (<2 items).

## Anti-patterns avoided

- No Liquid Glass — solid/filled surfaces only
- No `touchTarget-mobile` (44px) on this surface — local classes pin `min-*` to `component.iconbutton.size-md`
- No `common.tsx` — each concept owns its layout
- Every control traces to a REQ (see mapping doc after selection)

## Why the archetypes differ

Same data, three mental models: A says "this is a settings list"; B says "this IS the popup strip"; C says "these are objects you collect". Different affordance discovery paths (icon buttons vs tap-to-edit vs card chrome) → genuinely different picks, not skins.
