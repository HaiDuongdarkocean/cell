# Component Mapping — srs-front-variants (Concept B · Card shelf)

Brief: `docs/intent/srs-front-variants-design-brief.md` · Spec: `docs/specs/srs-front-variants.md`
Mockup source: `src/entrypoints/mockup-srs-front-variants/ConceptB.tsx` + `mockup.css`

## New shared/feature-local pieces (SSOT)

| Piece | Location | Decision | Notes |
|---|---|---|---|
| `SrsVariantFront` | `src/features/srs/ui/SrsVariantFront.tsx` | Create — extract from `SrsReviewCardFront` | One renderer for review front + editor preview + shelf tile + settings preview. Renders `fieldIds` + derived scope/audio toggles. Reuses `SrsReviewCard.module.css` classes — visual SSOT with production card. |
| `deriveToggles` + `isServable` + `expectedField` | `src/features/srs/lib/variantFront.ts` | Create — pure functions, no I/O | Used by scheduler, preview, shelf. |
| Field-kind map | same file | Create | `target`→heading; text/context/translation→text; `wordAudio`/`sentAudio`→audio button; `image`→img; `'input'`→InputField. |
| Variant tile / add-tile / field chip / front-toggle chip | feature CSS (`SrsVariants.module.css`) | Create — feature-local, no shared equivalent | tokens only; chips have `min-width` + centered label + `tabular-nums` so state labels never resize. |

## Shared UI usage

| Element | Component | Decision | Tokens | Icons | Trace |
|---|---|---|---|---|---|
| Variants tab in study settings | SegmentedControl | Extend usage — `General → Variants → Customize` | — | — | REQ-8 |
| Preset picker (shelf top bar) | Select | Reuse | spacing-2 gaps | — | REQ-5 |
| Search expand/collapse | IconButton + SearchField | Reuse | — | `search` | REQ-8 |
| Kebab menu (reset defaults…) | Menu | Reuse | — | `ellipsisVertical`, `rotateCcw` | REQ-8 |
| New variant button | Button | Reuse (primary, `plus` icon) | — | `plus` | REQ-8 |
| Hidden-on-note badge | Badge | Reuse | `color-text-secondary` | `eyeOff` | REQ-6 |
| Editor dialog + close `×` | Dialog | Reuse (`size="md"`) | `radius-dialog` | `x` | REQ-9 |
| Name field | InputField | Extend usage (compact, `radius-lg`) | `radius-lg` | — | REQ-8 |
| Loop picker 1–3 | SegmentedControl | Reuse | — | — | REQ-7 |
| Explanatory hints | HintIcon | Reuse beside labels | — | `info` | REQ-9 |
| Delete variant | Button | Reuse — `ghost`, destructive color only on hover | `color-destructive`, `error-subtle` | `trash` | REQ-8 |
| Save variant | Button | Reuse (primary) | — | `check` | REQ-9 |
| Confirm delete / reset | ConfirmDialog | Reuse | — | — | REQ-8 |
| Empty search result | EmptyState | Reuse | — | — | REQ-8 |
| Load error | Alert | Reuse | — | — | states |
| List loading | Skeleton | Reuse | — | — | states |
| Deck preset override row | Select + SettingsRow | Reuse on deck detail | — | — | REQ-5 |
| Field iconography | Icon (catalog) | Reuse | — | `volumeHigh`, `audioWave`, `image`, `pencil`, `layers`, `bookOpen` | REQ-9 |
| Dictation input on card | InputField | Reuse — existing front pattern | `radius-md` | — | REQ-4 |

## Feature-local CSS (tokens only — no hardcode)

| Class (mockup) | Purpose | Tokens used |
|---|---|---|
| `.bTile` / `.bTileNew` | shelf tile + dashed add tile | `surface`, `surface-hover`, `radius-xl`, `shadow-sm`, spacing-2 |
| `.bFrontToggles` / `.bFrontToggle` | derived toggle chips top-left of card face | `surface`, `border-subtle`, `radius-pill`, `font-size-xs`; `min-width` fixed for stable size |
| `.bChip` / `.bChip.on` | field picker chips | `border`, `surface`, `primary-subtle`, `color-primary`, `radius-pill`; `min-width` fixed |
| `.bName` | compact name input | `radius-lg`, `font-size-sm` |
| `.bFoot` / `.bDeleteGhost` | editor footer; ghost delete red on hover | `border-subtle`, `color-text-secondary`, `color-destructive`, `error-subtle` |

## Review card changes

- Front body replaced by `SrsVariantFront` — same component renders review, editor preview, shelf tile (SSOT). Trace REQ-1..4.
- Derived toggles (scope `both→word→sentence`, audio `word|sentence`) rendered inside the front, top-left; offer only options with material; pref persists in `srsUiPrefs.variantToggles`. Trace REQ-1, REQ-4.
- Back unchanged — `SrsReviewCardBack` canonical full-fields; not configurable.

## Deleted/deprecated

| Old | Fate |
|---|---|
| `frontTemplates` / `SrsFrontTemplate` on notetype | schema kept for compat; review path stops consulting — vestigial |
| `isSpelling` prop + spelling branches in front | absorbed by `'input'` pseudo-field + expected-field map |
| Manually configured front "modes" | removed — toggles derive from `fieldIds` |
| Footer `Close` button in editor | removed — dialog `×` only |

## i18n keys (new)

`srs.variants.*` — tab label, search placeholder, new variant, hidden-on-note, reset defaults + confirm, delete + confirm, editor labels (name, front hint, loops hint), field chip labels per field id; `srs.review.*` — dictation placeholders (`typeWord` / `typeSentence`), toggle aria-labels (`showBoth`/`showWord`/`showSentence`, `listenWord`/`listenSentence`).
