# Design review — settings-tab-redesign

- Item: `settings-tab-redesign` (mode `all`)
- Stage: design
- Brief: `docs/intent/settings-tab-redesign-design-brief.md` — `check-design-brief.mjs` PASS (61 tokens, 2 components)
- Mapping: `docs/intent/settings-tab-redesign-component-mapping.md`
- Mockup: `src/entrypoints/mockup-settings-tab-redesign/` (real `SettingsDialogContent` + redesigned "Flat bands, labeled groups" variant; concept/viewport/theme switchers + URL params)

## Chosen direction

"Flat bands, labeled groups" — one variant, justified in the brief. Grammar: strong section titles (`Heading` 3/3), visible supporting descriptions, `SettingsGroup` sub-group labels, canonical `SettingsRow` (title + optional visible description + control at predictable edge), hairline band separators, card chrome only where the boundary is meaningful (draggable resource rows, selectable profiles, theme mode cards).

## Evidence captured

`tmp/settings-tab-redesign/shots/` — 8 shots via Playwright against `localhost:5173` mockup (`?concept&viewport&theme&full=1`):

- `real-320-light|dark`, `real-840-light|dark` — production baseline (13 sections, boxed cards)
- `bands-320-light|dark`, `bands-840-light|dark` — redesigned variant (5 representative sections exercising every new atom: flat band, group labels, inline/stacked rows, `child` rows, chips, retained card, status rows, visible descriptions)

## Fresh-context vision review (vision-reader)

Reviewed all 8 shots against the brief:

- Hierarchy: section titles / group labels / row title vs description all distinguishable; bands read as sections without card chrome.
- Spacing: consistent rhythm between rows, groups, and sections in both viewports.
- Color: hairlines subtle, secondary text legible in light and dark; no contrast failures.
- Shape: no per-section boxes; controls keep system radii; chips wrap cleanly at 320px.
- Control edge: toggles/badges/buttons right-aligned; full-width stacked selects as briefed.
- Responsive: no horizontal overflow at 320px; wrapped descriptions and chips stay readable.
- Defects: none reported.

## Findings carried into DELIVER

- `SettingsRow` needs the extended anatomy (`title`/`description`/`hint`/`labelFor`/`child`) — already implemented and typechecked; production migration in DELIVER.
- Missing i18n keys resolved by using existing keys (`settings.download.group.concurrency`, `settings.download.group.formatQuality`, `settings.shortcuts.group.navigation`, `settings.sync.accounts.title`, `settings.ankiSync.*`).
- `SyncPanel` body-wrapper bug and per-feature label dialects (`downloadGroupTitle`, `groupLabel`, `SectionHeader`, raw `h2`, `sectionTitle`, `timelineLabel`) converge on `SettingsSection`/`SettingsGroup`.
- Mobile nit to watch in production migration: conditional rows' `child` indent and control placement under stacked layout.

VERDICT: PASS
