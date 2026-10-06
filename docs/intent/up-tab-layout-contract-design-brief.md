# Design Brief — up-tab-layout-contract

> Spec: `docs/specs/up-tab-layout-contract.md` · Intent: `docs/intent/up-tab-layout-contract.md` · Mode: `all` (single justified variant)
> Mockup: `src/entrypoints/mockup-up-tab-layout-contract/` · Mapping: `docs/intent/up-tab-layout-contract-component-mapping.md`

## Design read

One declared tab-layout contract replaces three divergent mounting patterns — the panel stops looking like six apps taped together and reads as one shell with six views, while two tabs gain their missing scroll regions and empty states stop floating in a top-anchored void.

This is a **structure item**, not a visual redesign: the pixel deltas are exactly the defect repairs — unified gutters, a scroll-bottom inset, elevated card shade on tabs that lacked the remap, centered empty states, and a live narrow-width row wrap. Everything else is pixel-parity (NFR-5).

## Function audit

| Function (system does) | REQ | Surface element |
|---|---|---|
| Mount all six tabs identically | REQ-1 | `.tabPane` + `visitedTabs` on every pane, recap included |
| One scroll region per tab | REQ-2 | `.scrollport` recipe in `Scrollable.module.css`, composed per tab |
| One gutter authority | REQ-3 | flush `.content` + per-tab `padding:` fed by `universal-panel-tab-gutter` on `.body` |
| Last row clears bottom chrome | REQ-4 | `padding-block-end: var(…scroll-inset)` inside each scrollport |
| Defined pane lifecycle | REQ-5 | `isActive` prop bound at `mountUniversalPanel` render fns |
| Preview follows the visible tab | REQ-6 | playlist teardown effect on `!isActive` + publish-guard on mid-read flip |
| Recap keeps place, revalidates | REQ-7 | keep-alive pane + `load()` on activation edge |
| One surface scheme | REQ-8 | `--card-background`/`--color-surface-card` remap hoisted to `.body` |
| Empty state fills scrollport | REQ-9 | `EmptyState .root` gains `flex:1 1 auto` (`.bordered` excluded); tab hosts become flex-column fills; playlist `.empty` gains `justify-content:center` |
| Dead `@container` resolves | REQ-10 | `container-type: inline-size` on playlist `.list` |

## Journey (TO-BE)

1. Playlist opens: `.list` is a real scrollport — every recording reachable, bottom inset lifts the last row off the nav hairline.
2. Preview plays → tab switch: `isActive` flips, `<audio>` unmounts, blob URL revoked — silence from the hidden pane.
3. Recap: expand a session, scroll, leave, return — expansion and scroll survive; `GET_SESSION_RECAP` quietly revalidates.
4. All six tabs: same gutter rhythm, same card shade, same mount — one contract is felt.
5. Phone ≤480px container width: playlist rows wrap as originally written; empty tabs center.

## Dials (chosen direction)

| Dial | Value | Why |
|---|---|---|
| DESIGN_VARIANCE | minimal | Contract unification is the opposite of divergence — every tab inherits, none invents |
| MOTION_INTENSITY | zero-new | No new animation; existing panel open/close untouched; `prefers-reduced-motion` path unchanged |
| VISUAL_DENSITY | unchanged | Same rows, same type, same radius language; only the spacing authority moves |

## Token decisions (DESIGN sign-off)

| Contract var (declared on `.body`) | Value | Resolved | Justification |
|---|---|---|---|
| `universal-panel-tab-gutter` | `var(--spacing-3) var(--spacing-4)` | 12px block / 16px inline | The audit's 28–32px on playlist/recap is double-padding fallout (shell `--spacing-4` + tab `--spacing-3`/`--spacing-4`), not intent — those tabs already *self-declared* 12/16. Adopting 12/16 makes the repair equal to "delete the shell layer", the smallest honest delta, and matches the 12–16px siblings. Vocabulary inline goes 12→16 (its rows already inset `--spacing-3` inner padding — the gutter step aligns row content with the toolbar it sits under); studyModes block goes 16→12 (inline stays 16). |
| `universal-panel-tab-scroll-inset` | `var(--spacing-4)` | 16px | ≥ the `--spacing-3` floor REQ-4 pins; one step above the block gutter (16 > 12) so the last row rests visibly off the nav hairline instead of looking like a terminated list item. Matches `--universal-panel-bottom-nav-item-height` 52px rhythm — inset reads as deliberate edge clearance, not list padding. |

**Rejected:** keep the audit's ~28–32px (it's a bug fossil, and doubling is exactly the failure class this item kills); a `≤599px` inline-gutter reduction on `.body` (16px inline at 320px leaves a 288px column — standard mobile margin; uniform pair keeps the contract one-greppable-site, and a later reduction is a one-line `.body` media override, not six tab edits).

## Variant — "Contract shell" (only variant, justified)

- **IA mental model:** one shelf, six drawers — the shell owns frame + chrome; each drawer owns its interior padding and its own scroll runway.
- **Visual archetype:** flush stage with uniform margins — like a reader app where the page inset is the page's own choice, consistent across sections.
- **Non-digital reference:** a binder with tab dividers — every sheet inside sits at the same margin; the binder never pads the sheet.
- **Material / surface:** `.body` paints `core.*.surface`-class base; hoisted remap makes every `Card` resolve `--color-surface-elevated` — cards read raised on all six tabs; studyModes `.modeCard` keeps its intentional `--color-field` override.
- **Typography treatment:** untouched — not this item's scope (item 33).
- **Motion signature:** none added.
- **UX flow:** tab switch = `[hidden]` flip on keep-alive panes; `isActive` gates audio; activation revalidates recap.
- **UI structure:** `.content` (flush clip) → `.tabPane` → tab root → `.scrollport` (gutter padding + block-end inset) → rows; empty states flex-fill and center.
- **3 dials:** DESIGN_VARIANCE: minimal, MOTION_INTENSITY: zero-new, VISUAL_DENSITY: unchanged.
- **Why it fits:** the spec already fixed the mechanism set; divergence would be a second invention on top of a convergence item.
- **Risk:** card-shade delta on playlist/recap/dictionary reads as redesign to a grumpy reviewer — bounded: it's the declared N6/NFR-5 delta and the before/after captures in the mockup show it.
- **Audit findings:** | finding | solve / defer / reject | F-1 unreachable lists | solve — `.scrollport` per tab | F-3 audio leak | solve — `isActive` teardown | F-5 carve-out | solve — flush `.content` + tab-owned gutter | F-9 recap remount | solve — `.tabPane` + `visitedTabs` | F-10 remap ×3 | solve — `.body` hoist | M-3 nav clearance | solve — scroll inset | F-19 dead `@container` | solve — `container-type` on `.list` | V-11/M-14 empty void | solve — `EmptyState` fill + centered hosts |

## ASCII sketch — the contract

```
UniversalPanel (one shell, all six tabs identical):
┌──────────────────────────────────────────────────────────────┐
│ .panel ─ flex row (desktop) / column-reverse (≤839px)        │
│ ┌─────────┐ ┌──────────────────────────────────────────────┐ │
│ │ sidebar │ │ .body  ── owns:                               │ │
│ │ nav     │ │   universal-panel-tab-gutter      = 12/16     │ │
│ │ (icons+ │ │   universal-panel-tab-scroll-inset = 16       │ │
│ │  labels)│ │   card-background → surface-elevated (remap)  │ │
│ │         │ │ ┌──────────────────────────────────────────┐ │ │
│ │ dict    │ │ │ UniversalPanelHeader                     │ │ │
│ │ vocab   │ │ ├──────────────────────────────────────────┤ │ │
│ │ modes   │ │ │ .content ── flush host, overflow:hidden, │ │ │
│ │ playlist│ │ │  NO padding, NO data-cell-id selectors   │ │ │
│ │ recap   │ │ │ ┌──────────────────────────────────────┐ │ │ │
│ │ settings│ │ │ │ .tabPane (keep-alive) ×6             │ │ │ │
│ │         │ │ │ │ hidden panes: display:none, isActive │ │ │ │
│ │         │ │ │ │ ┌──────────────────────────────────┐ │ │ │ │
│ │         │ │ │ │ │ tab root (flex col, min-h:0)     │ │ │ │ │
│ │         │ │ │ │ │ ┌──────────────────────────────┐ │ │ │ │ │
│ │         │ │ │ │ │ │ .scrollport                  │ │ │ │ │ │
│ │         │ │ │ │ │ │ padding: 12/16 gutter        │ │ │ │ │ │
│ │         │ │ │ │ │ │ ┌──┐ row                     │ │ │ │ │ │
│ │         │ │ │ │ │ │ │++│ row                      │ │ │ │ │ │
│ │         │ │ │ │ │ │ └──┘ row                      │ │ │ │ │ │
│ │         │ │ │ │ │ │ padding-block-end: 16 inset  │ │ │ │ │ │
│ │         │ │ │ │ │ └──────────────────────────────┘ │ │ │ │ │
│ │         │ │ │ └──────────────────────────────────────┘ │ │ │
│ └─────────┘ └──────────────────────────────────────────────┘ │
│            bottom nav (≤839px) ── hairline at top edge       │
│            ▲ last scroll row rests 16px above this line      │
└──────────────────────────────────────────────────────────────┘

Empty state (every tab):
┌── .scrollport ──────────────────┐
│                                 │   EmptyState .root{flex:1}
│         (icon, centered)        │   fills the viewport area —
│         title                   │   top ≈ bottom gap,
│         description             │   60–70% void gone
│                                 │
└─────────────────────────────────┘

Playlist row wrap @container ≤480px (activated, was dead):
  [lead] title                    [act][act][act]   →  wraps: actions drop
         meta                                       to full-width row with
                                                    hang-indent calc(12+20)
```

## Responsive

| | 320 | 768 | 1280 |
|---|---|---|---|
| chrome | bottom nav (column-reverse) | bottom nav | left sidebar |
| gutter | 12 block / 16 inline | 12/16 | 12/16 |
| scroll inset | 16 above nav | 16 above nav | 16 (harmless) |
| playlist wrap | rows wrap (container ≤480) | no | no |
| empty state | centered | centered | centered |

## States rendered in mockup

- Populated (overflowing lists — scrollport proves reachability) and Empty (`EmptyState` centered) via density switch.
- Playlist preview playing → switch tab (contract variant stops it; real variant leaks — the defect on display).
- Recap expand + scroll → round-trip (contract preserves; real remounts — the defect on display).
- Light + dark; mobile 390 + desktop 1280 stages via iframe `ViewportFrame`.

## Audit findings addressed

F-1, F-3, F-5, F-9, F-10, F-19, M-3, V-11/M-14 (centering part) — all solved per the table above; no deferrals.

## Anti-patterns avoided

- No `data-cell-id`-keyed CSS anywhere (the carve-out dies, never re-appears).
- `.scrollport` is mechanics-only — zero padding in the shared recipe (gutters would break flush tabs like dictionary panes).
- No `scroll-padding-bottom` / spacer divs for the inset — `padding-block-end` extends the scroll extent honestly.
- No MutationObserver/`[hidden]` polling — `isActive` is a prop bound at the mount seam (precedent: `renderDictionaryPanel(open)`).
- No redesign creep — typography, chips, selected recipes, nav chrome, hit targets untouched (items 30–33).
- No new tokens in `tokens.json` — the pair is contract-scoped custom properties on `.body`, fed by existing spacing leaves.

## Non-goals (unchanged by this item)

Nav chrome/order/badges (item 31), tab hit-targets/focus/`tablist` semantics (item 30), settings subnav (item 32), selected-state recipes/typography/playlist-EmptyState-migration (item 33), token registry/`TABS` dedup/render-phase `setVisitedTabs` (item 29).
