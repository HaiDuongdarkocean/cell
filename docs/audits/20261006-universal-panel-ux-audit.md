# Universal Panel — UX Audit 2026-10-06

> Method: `continuous-ux-audit-cycle` Discover→Diagnose. Evidence: Playwright spec `e2e/stage2/universal-panel-ux-audit.spec.ts` — 84 screenshots across 5 viewports (1440×900, 900×700, 768×1024, 390×844, 320×568) × 6 tabs × states (menus open, hover, focus, sheets) + computed-style dump + clean console. Three independent passes: code audit vs DESIGN.md/STANDARD.md (F-*), desktop visual critique (V-*), mobile/breakpoint critique (M-*).
> Standard: `docs/design-system/DESIGN.md`, `src/shared/styles/STANDARD.md`, `tokens.json`, persona 5–80 any device.
> Evidence dir (ephemeral): `loop/universal-panel-ux/` — detailed per-finding evidence lives in `state/02-code-audit.md`, `state/03-visual-desktop.md`, `state/03-visual-mobile.md` until `loop/` is cleaned; this doc carries the durable summary.
> Prior audits reconciled: `universal-panel-*-2026-09-05` P0 token/class bugs verified fixed; carried-over items re-flagged below.

## Executive read

The shell is well tokenized and the sidebar/bottom-nav skeleton is sound. The debt concentrates in **five systemic root causes**:

1. **No single tab-layout contract** — each tab invents its own padding/scroll/surface/mounting model; two tabs ship no scroll region at all (content clipped = P0).
2. **Token/atom bypass, not token absence** — `--touch-target`, `Menu`, `IconButton`, `Tabs`, `EmptyState` all exist; a whole class of controls never consumes them (hit areas <24px, hand-rolled menus, 13-icon unlabeled nav).
3. **No canonical selected-state recipe** — five different recipes (accent-bar, underline, inset ring, solid fill, outline ring) for one meaning.
4. **Alpha washes leak into floating layers** — translucent select listboxes, `overlay-hover` tool-row wash, weakest shadow + transparent border on the panel itself.
5. **Mobile treated as edge case** — bottom-nav labels clip, settings nav relies on hover tooltips, 600–839px is a chrome no-man's-land, mobile header has no title/context.

## Findings (deduplicated, severity-sorted)

### P0 — broken / unreachable / a11y-floor failures

| ID | Finding | Evidence |
|---|---|---|
| F-1 | **Playlist & Recap have no scroll container** — `.list`/`.body` lack `overflow-y:auto`+`flex:1;min-height:0` inside `.content{overflow:hidden}` → long lists clipped, unreachable (empirically: no scroll region at any viewport) | `PlaylistTab.module.css:1-6`, `RecapTab.module.css:1-6` vs correct sibling pattern `VocabularyTab.module.css:49-58` |
| V-1 / M-8 | **Touch targets below every floor** — toggles 20px, dict-link rename 18.7px, hints 32px, vocab search 38.1px; 35 violations desktop, sub-24px WCAG floor failures mobile | `computed-styles.json` violation lists; `Toggle`/`IconButton sm`/inputs never bind `--touch-target` |
| F-2 | **Focus trap picks a `display:none` bottom-nav button** → focus stays outside an `aria-modal` dialog on all non-dictionary tabs; mobile inverts tab order (nav is DOM-first but visually last) | `useFocusTrap.ts:34-35`, `UniversalPanel.tsx:207-211`, `UniversalPanelBottomNav.module.css:5` |
| F-3 | **Playlist `<audio autoPlay>` keeps playing when tab hidden** — `display:none` doesn't stop audio; tab switch leaks sound | `PlaylistTab.tsx:218-224` + keep-alive mount |

### P1 — clearly wrong vs the system

| ID | Finding |
|---|---|
| F-4 / M-9 | 28–34px control cluster: profile flag 34px, vocab statusBadge 20px, xs/sm circle buttons 28/32px (kebab, trash, dictionary toolbar forced 32px) — `--iconbutton-size-*` never reaches 44px coarse |
| F-5 | Tab gutters differ ~2× (playlist/recap 28–32px vs 12–16px) via fragile `data-tihoka-id` padding carve-out list; recap mounts without `.tabPane` — 3 mounting patterns for 1 job |
| F-6 | Token-name typos silently break styles ~8 sites: `--borderWidth-hairline`×5, `--font-sizes-xs` (no fallback → wrong timestamp size), `--font-weights-semibold`, `--motion-duration-fast`, `var(--error/--success)` dead aliases |
| F-7 / M-1 | Mobile bottom nav = 7 items; labels clip mid-word at ≤390px ("Dicti…/Voca…"), collapse to fragments at 320px; ≤359px font drops to 10px (below 12px floor) |
| V-2 | Floating select/listbox surfaces translucent — page text bleeds through listbox rows (§5.1: floating = `surface-elevated`/`field-solid`, never alpha washes) |
| V-3 | "Selected" has 5 recipes: subtle+bar (nav), underline (vocab menu, settings subnav), inset ring (mode card), solid fill (segment), outline ring (theme tile) |
| V-4 | Serif small-caps headings (`CARD DESTINATION`, `FLASHCARDS`, `SPEED`, `Card Creator` title) inside a sans-only token system |
| V-5 | Vocabulary filter/sort = bare text links; menu items render as underlined links — not `Menu`/`MenuItem`/`Select` |
| V-8 / M-7 | Settings sub-nav = 13 unlabeled icons, tooltips can't fire on touch, edges clip mid-glyph; `Tabs` component exists for this |
| V-9 | Panel = `--shadow-sm` + transparent border on near-black page — floating layer barely separates (needs `shadow-modal` + `border`) |
| V-10 | Sidebar groups split by ~64px void, no `divider` hairline |
| F-12 / M-5 | Tokenize capsule `flex:1` + fullWidth halves — stretches ~1000px desktop / ~330px mobile, two icon halves read as ambiguous void, no seam |
| M-2 | Page chrome bleeds ~10px under bottom nav; floating word badge renders *above* the panel at every viewport |
| M-11 | Collapsed Card Creator = bare 180px gray pill — no title/chevron; `MobileSheet` peek-header slot unused |
| M-13 | 600–839px band = phone chrome inside a 94% rounded desktop card — neither model resolved |

### P2 — polish / consistency gaps (batched)

- **Empty states**: anchor top leaving 60–70% void (V-11/M-14); vocabulary lone line vs full icon+title+desc+CTA elsewhere (V-11); playlist hand-rolls empty vs `EmptyState` (F-25)
- **Surfaces**: two surface schemes — 4 tabs copy the same `--card-background` remap, playlist/recap paint nothing (F-10); tool-row resting `surface-elevated` + `overlay-hover` wash hover (F-11)
- **Chips**: 3 status-chip implementations, opposite hover physics (F-13); opacity-as-color for hierarchy (F-14); double divider dictionary↔card-creator (F-15); playlist card radius-family override + bespoke status stripe (F-23)
- **Emphasis/states**: card-creator footer Clear/Add/Update three semantic styles, Update reads disabled (V-12); "Sync now" wears disabled costume (V-17); destructive playlist delete = same ghost weight as preview (F-25); hint ⓘ reads as radio + accent-ring hover (V-15); dashed Add boxes mix radius + 39px (V-13)
- **Typography**: nav labels at `--font-size-xs` for primary navigation (V-14); off-token `letter-spacing` (F-22)
- **Structure-by-void**: collapsed sidebar → ~17 unlabeled header icons (V-16); header pill ~1000px holding 2 icons vs hero "Type a word" input duplicating the job (V-6/V-22)
- **A11y semantics**: tabs are buttons not `tablist`/`tabpanel` (F-8); `Toggle` as disclosure w/o `aria-expanded` (F-16); `role=radio` cards in `role=group` not `radiogroup` (F-17); `aria-live` on every playlist card (F-18); tools-sheet fake grabber + 32px close + clipped last row (M-12)
- **Responsive**: dead `@container` — playlist rows never wrap (F-19); no bottom scroll inset above nav (M-3); dictionary split starves own pane ≤1000px, "Create" labels silently drop (V-20); vocab filter row clips chevron at 320px (M-15); 44px coarse-pointer flip unverified (M-10)
- **Content**: AnkiConnect error rendered twice in one view (V-7); slider unfilled track near-invisible (V-18); action tiles (Q/E) dwarf their keycap (V-19)
- **Craft**: `role=presentation` on clickable backdrop wrapper, hand-rolled Escape vs `pushEscapeLayer`, permanent `will-change`, docstring says "right-edge" but CSS centers 94% modal, render-phase `setVisitedTabs` (F-24); TABS registry duplicated ×2 with diverging labels (F-20); native `<button>/<input>/<textarea>` in FieldRow/CandidateView + wrong Icon barrel (F-21); hardcoded literals ~20 sites incl. `#e3e3e0` hex, `--radius-full` deprecated aliases, `radius:50%`, `font-weight:600` literals (F-22); `slidersHorizontal` icon collision filter-vs-tab (F-25); profile `Dialog`+`RadioGroup` where `Menu` is canonical (F-25); header chrome borderless vs golden rule 7 (V-21)

## Fix plan → backlog items

Items ordered by risk-reduction; each is independently shippable. See `docs/ideas/product-backlog.md` rows 28–33.

| # | Slug | UI | Cost | Findings covered |
|---|---|---|---|---|
| 28 | `up-tab-layout-contract` | yes | M | F-1, F-3, F-5, F-9, F-10, F-19, M-3, EmptyState-centering (V-11/M-14) |
| 29 | `up-token-atom-debt` | no | S | F-6, F-20, F-21, F-22, F-24 (Escape/role/docstring/will-change), literal batches |
| 30 | `up-a11y-hit-targets` | yes | M | V-1, M-8, M-9, F-4, F-2, F-8, F-16, F-17, F-18, M-10 |
| 31 | `up-mobile-chrome` | yes | L | M-1, M-2, M-4, M-5, M-6, M-11, M-12, M-13, M-15, F-7, F-12, V-6 |
| 32 | `up-settings-subnav` | yes | S | V-8, M-7 |
| 33 | `up-visual-system-convergence` | yes | L | V-2..V-5, V-7, V-9..V-23 remainders, F-11, F-13, F-14, F-15, F-23, F-25 |

Deps: 31 ← {28, 30}; 33 ← {28, 29, 30, 31, 32}. Items 29/30/32 are independent; 28 is prerequisite-free.
