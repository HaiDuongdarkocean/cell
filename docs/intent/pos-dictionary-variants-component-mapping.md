# Component Mapping — pos-dictionary-variants (Concept A · Chapter links)

Chosen direction: text-link POS bar pinned at top of popup + `AmE/BrE` accent label inline before IPA. Deconstructed from `src/entrypoints/mockup-pos-dictionary-variants/ConceptA.tsx`.

| Element | Decision | Component | Notes |
|---|---|---|---|
| POS nav bar (`nav` landmark + link buttons + pipe separators) | Create | — | New feature component `PosVariantNav` in `src/features/dictionaryPopup/ui/`. Rationale: `InkTabs` is an ink-bar underline archetype without separators (would flatten the design); `Breadcrumb` is hierarchical-path semantics; `Link` requires `href` while POS switch is a button action. Feature-scope, not shared/ui — only dictionary popup uses it. |
| POS link item | Reuse | Button | `variant="transparent"` + feature css class; selected state = `--color-text-primary` + `static.font.weights.semibold`, `aria-current`. `min-height: 44px` via padding. |
| Pipe separator | Create | — | Plain text node, `--color-muted-foreground`, `aria-hidden`. |
| Accent label `AmE`/`BrE` before IPA | Reuse | Button | `variant="transparent"` styled as inline link (same visual language as POS links); cycles variant accents; static `span` when only one accent. New feature component `AccentToggle` co-located in CandidateView module css. |
| Reading row container | Reuse | — | Existing `.TihokaHeaderReading` row in `CandidateView` — gains the accent label child before the IPA span. |
| Play-audio icon button | Reuse | IconButton | Existing audio button; icon: `volumeHigh`. Audio source follows selected accent (`audioRef` per accent in variant `prons[]`). |
| Frequency stars / level | Reuse | — | Existing `.TihokaHeaderLevel` spans; stars now come from selected variant's `prons`/`frequencyStars`. |
| Status pill | Reuse | Button | Existing `.TihokaHeaderStatus` + `--chip-status-unknown-bg` family; now reads/writes `(term,pos)` composite key; label = selected variant's resolved status. |
| Frequency chip (two-tone `COCA · 1,334`) | Extend | Tooltip | Existing `.TihokaHeaderFrequency` two-tone capsule; add `Tooltip` on hover/focus showing COCA genre breakdown (`SPOK · FIC · MAG · NEWS · ACAD`). Content swaps per variant's joined frequency row. |
| Toolbar (audio/image/translate/links/pronunciation) | Reuse | — | `DictionaryToolbar` unchanged; panel content re-keys on variant switch (image query becomes `${term} ${pos}`). |
| Variant swap region | Reuse | — | Same remount-key pattern as `.TihokaTabContent`: wrapper `div key={pos}` replays fade+rise; respects `prefers-reduced-motion` globally. |
| Sense checkable rows | Reuse | Checkbox | Existing checkable definition rows; scope = selected variant's merged senses (same-POS providers concatenated per spec). |
| Headword + send/quick-add actions | Reuse | Heading | Unchanged — term stays put, only variant-scoped content swaps. |
| `other` bucket item | Create | — | Same POS nav item, label = localized `other`, forced last, pos key `''`. |
| Accent persistence | — | — | Last-used accent stored in settings per `langCode` (no UI element). |

## Data hooks the UI needs (non-visual, for DELIVER)

- `LookupResult.variants[]` — assembled by lookup orchestrator (POS-normalized, `other` last).
- `variant.status` — composite status read `term␟pos` → `term` → `unknown`.
- `variant.prons[]` — `[{ accent, ipa, audioRef }]` from Macmillan homographs.
- `variant.frequency` — joined COCA row incl. genres for tooltip.

## States covered in mockup

selected/hover/focus (pos links + accent) · static single-accent · per-variant status pill · per-variant freq chip + genre tooltip · swap animation · hidden selector (1 variant) · `other` last (`well` entry).

## Verification notes

- Mockup verified via Playwright screenshots: `tmp/pos-dictionary-variants/` (a-present, a-verb, a-verb-bre, b, c-menu, real). Variant swap + accent toggle confirmed working.
- Light-theme check pending in review (theme switcher in mockup shell).
