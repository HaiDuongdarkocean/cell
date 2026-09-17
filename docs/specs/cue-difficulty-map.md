# Spec — `cue-difficulty-map`

> Status: draft r1 (review round 1: APPROVE WITH CHANGES — 5 Majors applied) · Intent: `docs/intent/cue-difficulty-map.md` · Backlog: #5
> Depends on: `cue-recommend-fab` (#4, shipped `763c8a75`) — reuses `cueDifficultyMap` + `cueFilterEnabled` gate

## 1. Problem

The cue list shows word-level status (token underlines) but no cue-level difficulty summary. A user hunting for i+1 material must inspect every cue or apply the cue filter — which removes all non-matching cues and loses context. Seeking to a good spot is blind.

## 2. Goal

Every cue row carries a subtle, ambient per-cue **heat indicator**: a vertical bar on the row's left edge whose band encodes difficulty, plus a tooltip and screen-reader text carrying the strange-word count. The user scans the bar column, spots bands, and seeks via the existing timestamp button — no interaction required to read the map.

## 3. Semantics

### 3.1 Bands

`CueHeatBand = 'easy' | 'i1' | 'dense'`, derived from the existing `CueDifficulty` (`{strange, tracking}` — `strange` already counts qualifying unknown+tracking terms under the frequency gate, same semantics as the FAB modes):

| Band | Condition | Meaning | Color token | Intensity |
|---|---|---|---|---|
| `easy` | `strange === 0` | No new words in level | `--color-token-status-known` | 45% |
| `i1` | `1 ≤ strange ≤ 2` | i+1 sweet spot | `--color-token-status-tracking` | 70% |
| `dense` | `strange ≥ 3` | Dense/hard cue | `--color-token-status-unknown` | 100% |

`cueHeatBand(d: CueDifficulty): CueHeatBand` is exported from `features/subtitle/logic/cueDifficulty.ts` — the same module that owns `cueMatchesMode`, keeping band policy beside filter policy.

**Encoding**: color + opacity intensity (easy < i1 < dense) — the heat metaphor gives a secondary non-hue channel (WCAG 1.4.1: hue alone can't separate green/red at 3px for colorblind users). Accepted residual: `easy` is freq-gated — a cue holding only out-of-level unknowns still shows the easy band next to red token underlines; consistent with the FAB's `allKnown` mode and the copy (§4.5) says "in level", not "all words".

### 3.2 Eligibility

The heat indicator renders **iff `cueFilterEnabled`** (the existing SubtitlePanel gate: `tokenize` on, not zh-suppressed, `practiceMode === 'off'`, not `panelBlurred`, `difficulties` resolved and non-empty). Same data source, same gate → one mental model: difficulty UI appears only when the underlying data is trustworthy. A cue missing from the map (e.g. unresolved) renders **no** `data-heat` and no bar — the absence is honest, never a fabricated `easy`.

### 3.3 Interaction

None added — the heat bar is ambient and non-interactive (`aria-hidden` visual + `title` tooltip; the cue's existing timestamp button still performs seeks). Filtering by mode does not affect the bars: a filtered list shows the heat of the cues that remain. The bar is intentionally a thin visual anchor — a ~10px transparent hit-slop pseudo-element widens its hover target so `title` is reachable.

## 4. Component deltas

### 4.1 `features/subtitle/logic/cueDifficulty.ts`

```ts
export type CueHeatBand = 'easy' | 'i1' | 'dense';
export function cueHeatBand(d: CueDifficulty): CueHeatBand;
```

Pure, O(1), no new imports.

### 4.2 `features/subtitle/ui/CueList.tsx`

New optional prop:

```ts
/** Per-cue difficulty for the ambient heat bar. Omit/undefined → no indicator. */
cueDifficulty?: ReadonlyMap<number, CueDifficulty>;
```

Per cue: `heat = cueDifficulty?.get(cue.index)`. When `heat !== undefined`, the cue item gets `data-heat={band}` (single source for styling hooks and DOM assertions — the bar span does **not** repeat it) and renders, as the **first child of the cue item regardless of the `renderCueContent` branch**:

```tsx
<span
  className={`${styles.heat} ${styles[`heat_${band}`]}`}
  data-cell-id="cue-heat"
  title={t(`cueHeat.tooltip.${band}`, [heat.strange])}
  aria-hidden="true"
/>
<VisuallyHidden id={`cue-heat-sr-${cue.index}`}>
  {t('cueHeat.srLabel', [heat.strange])}
</VisuallyHidden>
```

The `VisuallyHidden` sits immediately after the bar so screen readers hear the count before the cue text. The timestamp button gains `aria-describedby={\`cue-heat-sr-${cue.index}\`}` when heat exists — keyboard users hear "Seek to X, N new words in cue" at the seek decision point. (`aria-hidden` bar + `VisuallyHidden` + `listitem` role is the correct combination; `listitem` needs no accessible name.)

### 4.3 `features/subtitle/ui/CueList.module.css`

```css
.heat {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--cue-list-indicator-width);
}
.heat::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 10px; /* hover hit-slop so the title tooltip is reachable */
}
.heat_easy { background: var(--color-token-status-known); opacity: 0.45; }
.heat_i1 { background: var(--color-token-status-tracking); opacity: 0.7; }
.heat_dense { background: var(--color-token-status-unknown); }
```

`.cue` is already `position: relative` + `overflow: hidden` + `border-radius` — the bar clips cleanly inside the border, zero layout shift. `--cue-list-indicator-width` (3px) is the existing cue-list indicator token.

**Limitations (accepted)**: forced-colors/HC mode strips `background` — the bar disappears but `data-heat` + sr text + token underlines still carry the info; touch devices have no `title` hover — the sr text is the fallback channel.

### 4.4 `features/subtitle/ui/SubtitlePanel.tsx`

```tsx
cueDifficulty={cueFilterEnabled ? difficulties : undefined}
```

passed to the `practiceMode === 'off'` `CueList` instance. `cueFilterEnabled` already requires `difficulties !== null && size > 0`, so the prop is defined exactly when bands exist. Practice sessions never receive the prop (`PracticeCueListProps` doesn't carry it) — no difficulty hints leak into dictation/cloze.

### 4.5 i18n (`en`/`vi`, `cueHeat.*` namespace)

- `cueHeat.tooltip.easy`: `"No new words in level"` / `"Không có từ lạ trong tầm"`
- `cueHeat.tooltip.i1`: `"New words: $1"` / `"Từ lạ: $1"`
- `cueHeat.tooltip.dense`: `"New words: $1"` / `"Từ lạ: $1"`
- `cueHeat.srLabel`: `"New words in cue: $1"` / `"Từ lạ trong cue: $1"`

Copy avoids noun plurals (`t()` has no pluralization). Tooltip explains band semantics; srLabel reports the count — `easy` intentionally differs ("No new words in level" vs "New words in cue: 0") since the tooltip's job is explaining the band while the sr channel reports the number.

## 5. Data flow

```
resolveCueListTokenMetadata → onTokensResolved(map, meta)
  → SubtitlePanel.lastGood → difficulties = cueDifficultyMap(...)
  → cueDifficulty={difficulties} → CueList
  → per cue: cueDifficulty.get(cue.index) → cueHeatBand → data-heat + bar + tooltip + sr text
```

Live word-status changes already flow through `onTokensResolved` → `difficulties` recomputes → bars update with no extra wiring.

## 6. Acceptance criteria

- **A1 — bands**: `cueHeatBand` maps `strange 0/1/2/3+` → `easy/i1/i1/dense` (unit).
- **A2 — render**: with `cueDifficulty` provided, each cue item exposes `data-heat` matching its band and a `cue-heat` bar span; `data-heat` appears exactly once per cue row (unit).
- **A3 — honest absence**: a cue missing from the map renders no `data-heat` and no bar (unit).
- **A4 — a11y**: the bar is `aria-hidden`; a `VisuallyHidden` text carries the localized count immediately after the bar; `title` tooltip present; timestamp button `aria-describedby` points at the sr span (unit).
- **A5 — gating**: heat appears iff `cueFilterEnabled` — hidden when tokenize off / zh-suppressed / practice mode / blurred / unresolved (integration).
- **A6 — live update**: a word-status change that moves a cue across a band boundary updates its `data-heat` (integration via emit + rerender; real-Chrome smoke).
- **A7 — coexistence**: heat bars coexist with `cueFilter` — filtered lists show bars; `data-current` highlight unchanged; seek still works (unit + smoke).
- **A8 — i18n**: tooltip + sr text localized en/vi (unit).
- **A9 — surfaces**: works in the shared `SubtitlePanel` → every surface inherits (smoke on Split View).
- **A10 — perf**: band lookup is O(1) per cue render; no new fetch/resolve pass (code review).

## 7. Test plan

- `cueDifficulty.test.ts`: band boundaries (0/1/2/3/10 → easy/i1/i1/dense/dense).
- `tests/unit/entrypoints/sidepanel/CueList.test.tsx`: `data-heat` presence per band on the cue item, missing-entry honesty, `aria-hidden` bar, sr text, tooltip title, `aria-describedby` wiring.
- `src/features/subtitle/ui/SubtitlePanel.cueFilter.test.tsx`: extend — `data-heat` present when eligible, absent under each gate-off condition, re-bands after `emitWordStatusChanged`.
- Real-Chrome smoke via the `testing-extension-browser` workflow (fresh script under `tmp/cue-difficulty-map/`): bars render in Split View, `[data-cell-id="cue-item"][data-heat="dense"]` count matches the FAB's dense menu count, live status change re-bands a cue, filter + heat coexist.
- **DoD**: `docs/2-architechture-system.md` + `docs/0-wiki.md` updated; gates green (`typecheck`, `lint`, `test:unit`, `build`).

## 8. Non-goals

- Timeline/progress-bar heat strip (separate surface — future item).
- Sorting or reordering by difficulty.
- Practice-mode hints.
- User-configurable band thresholds or colors.
- Per-token heat (token underlines already encode word status).

## 9. Alternatives considered

See `docs/intent/cue-difficulty-map.md` — a timeline heat strip was rejected as a different surface with much larger scope; a numeric count chip was rejected for visual noise (the count lives in tooltip + sr text instead).
