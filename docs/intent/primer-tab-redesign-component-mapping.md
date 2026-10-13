# Component mapping — primer-tab-redesign

Maps the design brief onto existing shared primitives. No new shared components are needed;
changes scope to `PrimerTab.tsx`/`PrimerTab.module.css` (Words tab), `SubtitlePanel.tsx`
(REQ-5 tab strip), `CueList.tsx`/`CueList.module.css` (REQ-6 desync + pill).

## Shared components (reuse as-is)

| Slot | Component | Notes |
|---|---|---|
| Play button | `Button` (`src/shared/ui/Button`) | `variant="transparent"`, `shape="circle"`, keeps `data-tihoka-id="primer-seek"` |
| Play glyph | `Icon` | `name="navPlay"` (play-circle, phosphor) per spec |
| Repeat glyph (B only) | `Icon` | `name="repeat"`, `size="xs"` |
| Panel shell | existing | `data-tihoka-id="primer-tab"`, header, list — structure kept |
| Tab strip | `Tabs` (`src/shared/ui/Tabs`) | reuse — REQ-5 only changes *when* `Tabs.List` renders, not how |
| Sync pill | `Button` (`src/shared/ui/Button`) | `variant="overlay"`, `shape="pill"`, `size="sm"`, `elevation="med"`, `data-tihoka-id="cue-list-sync"` |
| Sync glyph | `Icon` | Icon: `crosshair` — new ICON_CATALOG entry (lucide `Crosshair`), added with this feature |

## Status/word text

- Status words reuse i18n `vocabulary.status.unknown` / `vocabulary.status.tracking`
  (spec decision: shared keys, not new primer keys).
- Header uses a new joined i18n key `primer.headerStats` — e.g. `{total} new words · {unknown} unknown · {tracking} learning` — added to `en.json` + `vi.json`.
- Meta join separator `·` comes from the same i18n string templates, not hardcoded.
- Sync pill label: new key `cueList.syncToVideo` — en "Sync to video" / vi "Đồng bộ với video".

## CSS tokens consumed

| Use | Token |
|---|---|
| Term text | `color-text-primary`, `sizes-sm`, `weights-semibold` |
| Meta text | `color-text-tertiary`, `sizes-xs` |
| Status tint (B/C) | `color-token-status-unknown`, `color-token-status-tracking` |
| Row gap/padding | `spacing-2` gap, `spacing-1` padding (one step tighter than current `spacing-3`/`spacing-4`) |
| Row hover | `color-surface-hover` |
| Rank tag border (B) | `color-border-subtle`, `radius-sm` |
| Meter segments (C) | `color-border-subtle` (off), `color-text-tertiary` (on) |
| Play hit area | `touchTarget-desktop` floor |
| Focus ring | `shadow-focus` / standard `:focus-visible` treatment |
| Sync pill surface/fg | `component.button.overlay-bg`, `component.button.overlay-fg` (via `Button variant="overlay"`) |
| Sync pill anchoring | `static.zIndex.overlay-base` (under blur overlay's `static.zIndex.overlay-low`), `space-3` bottom inset |
| List bottom pad while pill shown | `touch-target` + `space-3` |

## Neutralized shared styles (per spec SC)

`js-Tihoka-token` underline + `status-*` modifier tint effects from `tokenSpanCss.ts`
are neutralized **inside `PrimerTab.module.css`** via module-scoped `!important` overrides —
the classes remain as lookup hooks but the term renders as plain panel text. `tokenSpanCss.ts`
itself is untouched.

## Dead code cleanup (spec DoD)

- `FrequencyBadge` (`src/features/subtitle/ui/FrequencyBadge.tsx`) — sole consumer is
  `PrimerTab`; **remove component + styles** once the rank chip is gone.
- Dead CSS in `PrimerTab.module.css`: `.band`, `.bandDot_*`, `.occurrences` and any
  rank-chip styles — delete with the rework.

## Per-variant implementation deltas

| Variant | Extra markup | Extra CSS | Extra i18n |
|---|---|---|---|
| A — Plain text | none (single text run) | none | one meta template |
| B — CSS-visual | status span, rank tag span, repeat icon span | `.status_*` tints, `.freqTag`, `.repeat` | status + freq + repeat templates |
| C — Signal meter | as B minus tag, plus 5-segment meter | `.meter`, `.seg`, `.segOn` | as B; `band` → fill map in `primerList` or colocated constant |

## Attributes that must survive the rework

`data-tihoka-id`: `primer-tab`, `primer-header`, `primer-list`, `primer-row`, `primer-seek`.
On term: `js-Tihoka-token`, its `status-*` modifiers, `data-tihoka-term`, `data-tihoka-start`.
On row: `data-cue-start`, `data-cue-end`.
Cue list: `cue-list-scroll` stays on the scroller (new sibling wrapper is plain div);
new: `cue-list-sync` on the pill. `subtitle-panel-tab-*` hooks render iff the strip does.

## REQ-5/REQ-6 structural deltas

| Area | Change |
|---|---|
| `SubtitlePanel.tsx` | `showTabs` → count renderable tabs (1 + playlist + words-renderable); ≤1 → existing no-tabs path |
| `CueList.tsx` | New `position:relative` wrapper owns scroller + pill; `expected` scrollTop ref marks programmatic aligns; `onScroll` divergence >2px ⇒ desync; resync on pill click / timestamp seek / `filterEpoch` |
| `CueList.module.css` | `.wrap` (flex:1 column, relative), `.syncPill` (absolute bottom-center) |
| i18n | `cueList.syncToVideo` en + vi |
| icons | `crosshair` catalog entry (lucide `Crosshair` + `svg/crosshair.svg`) |
