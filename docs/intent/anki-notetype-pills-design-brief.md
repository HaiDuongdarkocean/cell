# Design Brief — anki-notetype-pills

> Spec: `docs/specs/anki-notetype-pills.md` · ui_surface: yes · Mode: interactive

## Concept

Single user-directed concept (alternatives rejected at spec review): a **borderless notetype bar** sits directly above the field rows in the mapping step — pills on the left, ghost manage icon on the right. The bar replaces the "Advanced options" disclosure.

## Layout

```
┌─ settingsCol ───────────────────────────────────┐
│ [Core 2000 · 237] [Recognition · 96]      ⚙(gh) │  ← .ntBar, no background
│                                                 │
│ Target word     [Front          ▾]              │  ← .fieldRows (unchanged)
│ Sentence        [Back           ▾]              │
│ Definition      [Meaning        ▾]              │
│ …                                               │
└─────────────────────────────────────────────────┘

manage open (desktop ≥840px):               manage open (mobile <840px):
                    ┌─ Popover ──────────┐      ┌─ BottomSheet ─────────┐
                    │ Manage notetypes   │      │ ─────── (grab)        │
                    │ ☑ Core 2000   237  │      │ Manage notetypes      │
                    │ ☑ Recognition  96  │      │ ☑ Core 2000      237  │
                    │ ☐ Listening    85  │      │ ☐ Listening       85  │
                    └────────────────────┘      └───────────────────────┘
```

## Elements

- **Pill** — `Chip as="button"` size sm, `selected` on the active notetype; label = `<name>` + secondary `<span>· N cards</span>`; `aria-pressed` reflects selection; focus ring = 2px `--color-border-focus`.
- **Bar** — plain `div` (no background, per user); `display:flex`, pills wrap (`flex-wrap`) inside a `min-width:0` container; right slot = `IconButton variant="ghost" size="sm"` icon `slidersHorizontal`, `aria-expanded` + `aria-haspopup="dialog"`.
- **Manage surface** — desktop: `Popover` (`variant="menu"` rounded-rect, `triggerRef` = icon button, `menuAlign="right"`) containing a title + `Checkbox variant="row"` list over `data.notetypes.filter(!isCloze)`; mobile (`useIsMobile(BREAKPOINTS.expanded)`): `BottomSheet` with same list. Dismissal: outside mousedown + Escape→restore icon focus + `useDismissOnScroll` (SpeedPill pattern); Tab/Shift+Tab wrap within the row list (explicit containment since Popover portals outside Dialog's trap).
- **Selection** — `selectedNtId` state in `MappingStep`; effective nt = stored id if `enabled ∩ cards≥1` else next enabled-with-cards in `data.notetypes` order (wrap); samples = ≤4 importable notes of effective nt; pill press → `setSelectedNtId` + `sampleIdx=0` + `flipped=false`.
- **Empty state** — zero enabled notetypes: pills area empty, manage icon stays, column shows existing `noneSelected` text; `canContinue` requires ≥1 enabled nt with cards → Start disabled.
- **Removal** — `.advRow` disclosure, `.advText`, `.advChevron`, `.fieldIcon`, `advOpen` state, `Icon name="slidersHorizontal"` on the row, and the `pickList` checkbox block inside it are deleted; `slidersHorizontal` is reused by the manage icon.

## States

| Element | Default | Hover | Focus | Selected | Disabled-context |
|---|---|---|---|---|---|
| Pill | `--color-field` bg | `--color-surface-hover` | 2px focus ring | `--color-primary-subtle` + accent text | — |
| Manage icon | transparent | `--color-overlay-hover` | 2px focus ring | `aria-expanded` | — |
| Manage row | — | `--color-surface-hover` | checkbox ring | checked = enabled | unchecked = dimmed opacity |
| Bar | transparent | — | — | — | wraps at <480px; horizontal scroll fallback |

## Mockup

`src/entrypoints/mockup-anki-notetype-pills/` — dark-theme render of the bar + open popover + mobile sheet. Screenshots: `tmp/anki-notetype-pills/mockup-*.png`.
