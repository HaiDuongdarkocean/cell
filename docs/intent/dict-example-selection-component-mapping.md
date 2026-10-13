# Component Mapping — dict-example-selection

> Chosen concept: **A — Mirror rows**, user amendment: def + example share the same small `•`/`·` idle dot (the existing `TihokaDefCheck::before` circle — already what Concept A renders for both).

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Example row host (`role="checkbox"`, sibling of def item) | — | extend | `static.spacing.1`, `static.radius.sm`, `derived.light.color-surface-hover` | — |
| Idle `•` dot | — | reuse | `static.spacing.2`, `static.radius.full`, `core.light.textSecondary` | — |
| Checkbox box + check draw | Icon | reuse | `static.spacing.4`, `static.radius.sm`, `static.borderWidth.thick`, `core.light.primary`, `derived.light.color-overlay-text`, `component.checkbox.disabled-opacity`, `static.motion.duration-fast`, `static.motion.ease-out` | `check` |
| Hidden real input | — | reuse | — | — |
| Example text (lookup-safe zone) | — | create | `core.light.textSecondary`, `static.font.sizes.sm`, `static.font.leading.normal` | — |
| Examples container | — | reuse | — | — |
| Focus-visible outline | — | reuse | `static.spacing.0-5`, `core.light.primary` | — |
| Settings "Examples" pill step | — | reuse | — | — |
| Card-text example marker (`· ` line) | — | create | — | — |

Notes:

- "Example row host" extends `DictionaryCheckable.module.css` with a new `TihokaDefExampleItem` class — same compound-selector contract as `TihokaDefItem` (co-located per that file's warning header).
- "Example text" is a new `TihokaDefExampleText` class in `CandidateView.module.css` — needed as the click-guard sentinel (mirrors `TihokaDefText`) and for secondary text color.
- "Idle `•` dot" reuses `TihokaDefCheck::before` — the small circle the user pointed at; identical for def and example rows.
- "Settings pill step" reuses the feature-local pill row inside `DictionaryPopupSettingsPanel` (string-valued pills coerced to boolean per spec REQ-5).
- "Card-text marker" is the `· ` line prefix emitted by `formatDefinitions` — deliberately distinct from the `• ` def prefix so the `sendToCard` string-parse fallback can re-attach example lines (spec REQ-4); the visual UI marker stays the shared `•` dot.
- `sendToCard` precedence flip + snapshot field are logic-layer, no visual element.
