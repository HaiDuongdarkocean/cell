# Component mapping — durable-job-registry · Concept A (Inline rows)

> Chosen by owner 2026-09-28: **A — job rows live inside their owning Settings card** (Resources → import/delete; Audio → voice/index). Deconstructed elements → shared component decisions.

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Job row container (bordered filled row inside section card) | `Card` | extend — `variant='default'` with a `job` modifier class for status borders | `--input-bg`, `--border`, `--radius-md` | — |
| Status icon (leading) | `Icon` | reuse | — | icon: `loader` (running/uploading), icon: `check` (done), icon: `info` (failed/interrupted) |
| Job label (file/resource name) | `Text` | reuse — `size='sm'`, truncation | `--text` | — |
| Kind + status meta line | `Text` | reuse — `size='xs'`, `color='secondary'` | `--textSecondary` | — |
| Error / interruption reason line | `Text` | reuse — `size='xs'` with warning/error color | `--warning`, `--error` | — |
| Determinate progress | `Progress` | reuse — `value`/`max` | (component tokens) | — |
| Retry action (retryable terminal jobs) | `Button` | reuse — `variant='ghost'`, `size='sm'` | (component tokens) | icon: `rotateCcw` |
| Dismiss action (terminal jobs) | `Button` | reuse — `variant='ghost'`, `size='sm'` | (component tokens) | icon: `x` |
| Job list block (rows above dropzone) | `Stack` | reuse — vertical, `gap='2'` | `--spacing-2` | — |
| Section hosting card (Resources / Audio) | `Card` | reuse — unchanged | `--card-background`, `--card-border`, `--card-radius` | — |
| Re-import hint on interrupted import row | `Text` | reuse — `size='xs'`, `color='secondary'` | `--textSecondary` | — |
| Live region wrapper for status changes | `Card` (row container above) | extend — `aria-live='polite'` attribute only, no visual change | — | — |

## Decisions rationale

- **Nothing `create`d** — every element maps to `Card`/`Icon`/`Text`/`Progress`/`Button`/`VStack`. The only new thing is a `job` modifier class on the row container for status borders (`--warning`/`--error`) — a CSS-module variant, not a new component.
- **Kind icon is not rendered** in Concept A rows (context = section) — `KIND_ICON` stays in `mockData` for the rejected B/C concepts only.
- **Panel-local statuses** (`duplicate`, `skipped`, upload-phase) reuse the same row surface — no extra elements needed beyond what `ResourcesPanel`'s `ImportJob` row already draws.
- **TtsLanguagePanel progress row** (existing `Progress` + text) maps 1:1 onto the registry-driven row — same components, different data source.
- **LocalPronunciationSettingsPanel status line** maps to a job row only while an index job is non-terminal; the static `lastIndexedAt` display stays as-is.

## Accessibility

- `aria-live='polite'` on the row container → screen readers announce status flips (NFR-6, AC-11).
- Icon-only action Buttons carry `aria-label` (existing `Button` API — `aria-label` prop already used across panels).
- Touch targets: `size='sm'` ghost buttons sit inside a ≥44px row — verified against `button-padding-y-sm` in tokens.
