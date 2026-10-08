# Component Mapping: srs-daily-reminder

> Every element → a real `src/shared/ui/` component or explicit create decision.
> Linter-enforced: components/icons must exist; tokens must come from tokens.json.

Chosen variant: **Sibling row** — a "Nhắc học" section inside `SrsStudySettings` General tab, rendered through the file's existing `Section`/`SettingRow` helpers (same grammar as all sibling rows). The OS notification is a system surface — mapping covers content only.

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| "Nhắc học" section wrapper + title | Heading + Box | reuse — file-local `Section` helper (`styles.section`/`sectionTitle`), identical to Schedule/Answering sections | `static.font.sizes.lg` | — |
| Enable row (label + description + toggle) | Text + Toggle | reuse — file-local `SettingRow` helper + `Toggle size="xs"`, same grammar as Answering rows | `static.font.sizes.sm`, `static.font.sizes.xs`, `--color-text-muted` | — |
| Ideal-hour row (label + hour select) | Text + Select | reuse — `Select` + `styles.pillSelect` + `HOUR_OPTIONS`, identical to the `dayBegins` row above it | `--radius-full`, `--color-primary-subtle` | — |
| Status line (fires HH:00 / learned ≈HH:00) | Text | reuse — `styles.rowDesc` style, third row inside the section | `static.font.sizes.xs`, `--color-text-muted` | — |
| Blocked status (permission denied) | Text + Icon + Button | reuse — `rowDesc` line with leading warning icon + small ghost re-request button | `static.font.sizes.xs`, `--color-error-muted` | `triangleAlert` |
| OS notification card (mockup only) | Box + Text + Button | reuse — static approximation in the mockup for visual review; production is `chrome.notifications` (OS chrome) | `--color-surface-elevated`, `--radius-card`, `--shadow-md` | — |
| i18n keys | — | reuse pattern — new keys under `srs.settings.*` / `srs.reminder.*`, same `t()` call sites as siblings | — | — |

## New assets

- No new shared components — the section composes the file's existing `Section`/`SettingRow` helpers + `Toggle`/`Select`/`Text`/`Button`/`Icon` atoms. Extracting to `shared/ui` would be premature for a single consumer.
- No new icons — `triangleAlert` already in `ICON_CATALOG`.

## Token discipline

All text/row colors reuse `--color-text-muted` (sibling desc text — derived alias of text-secondary), error state uses `--color-error-muted` (exists in tokens.json). Hour select reuses `pillSelect` verbatim — `--color-primary-subtle` + `--radius-full`. No new tokens, no hardcoded values.

## Interaction → requirement trace

| Journey step | REQ | Function | Element |
|---|---|---|---|
| 1 Enable | REQ-1 | save `srs.reminder` + `permissions.request` in-gesture | Toggle row |
| 2 Pick hour | REQ-1 | `preferredHour` persist → re-arm via storage.onChanged | Select row |
| 3 Learned | REQ-5 | `learnedHour` display from reminder state | status line |
| 4 Blocked | REQ-6 | permission state read + re-request affordance | status line + ghost button |
| 5 Fire | REQ-2 | notification create (no DOM) | OS surface — content keys only |
| 6 Click | REQ-3 | focus-or-create srs-study tab (no DOM) | — |
| 7 Snooze | REQ-3 | one-shot re-arm (no DOM) | — |
