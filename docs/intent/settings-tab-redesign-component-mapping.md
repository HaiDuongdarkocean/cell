# Component Mapping — settings-tab-redesign

> Variant: "Flat bands, labeled groups" (all mode, single justified variant).
> Brief: `docs/intent/settings-tab-redesign-design-brief.md` · Spec: `docs/specs/settings-tab-redesign.md`
> Convention: the `Component` column names shared atoms (`src/shared/ui/`) only; feature components are named in `Element` / `Decision` text.

## New shared atoms (justify `create`)

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Section band — `<section>` + title + description + body slot + `data-section` anchor + forwarded ref | `SettingsSection` | create — `Card` is chrome-in-a-box (radius/border/surface); no existing atom expresses "flat section band". Repeat count: 13× in one surface | `static.spacing.6`, `static.spacing.3`, `static.spacing.12`, `static.borderWidth.hairline`, `derived.light.color-divider`/`derived.dark.color-divider`, `static.font.sizes.lg` | — |
| Sub-group label + body inside a section | `SettingsGroup` | create — 7 dialects today; `SectionHeader` is a full title+subtitle+action (too heavy for a sub-label). Repeat count: download×4, shortcuts×5, audio×2+, sync×2, dictLinks, theme | `static.font.sizes.sm`, `static.font.weights.semibold`, `presets.dawn.core.light.textSecondary`/`presets.dawn.core.dark.textSecondary`, `static.spacing.4`, `static.spacing.2` | — |

## Anatomy — extended atoms

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Row anatomy — title / description / hint + right-edge control | `SettingsRow` | extend — additive `title?`, `description?`, `hint?`, `hintAriaLabel?`, `labelFor?`, `child?` props; children API kept for composite rows | `static.font.sizes.sm`, `static.font.weights.medium`, `derived.light.color-text-primary`/`derived.dark.color-text-primary`, `static.font.sizes.xs`, `presets.dawn.core.light.textSecondary`/`presets.dawn.core.dark.textSecondary`, `static.spacing.2`, `static.spacing.3`, `static.spacing.4`, `static.borderWidth.hairline`, `derived.light.color-divider`/`derived.dark.color-divider` | — |
| Row hint (retained where used) | `HintIcon` | reuse — now only inside `SettingsRow.hint` and section titles | `component.iconbutton.size-sm` | `info` |
| Row↔row separation | `SettingsRow` | reuse — existing `divider` flag; replaces `.childField`-style ad-hoc borders inside groups | `static.borderWidth.hairline`, `derived.light.color-divider`/`derived.dark.color-divider` | — |
| Child/conditional field indent | `SettingsRow` | extend — `child` variant = `margin-left space-4` + `border-left hairline`, collapses to `space-2` under 480px | `static.spacing.2`, `static.spacing.4`, `static.borderWidth.hairline`, `derived.light.color-divider`/`derived.dark.color-divider` | — |

## Section anatomy — reused atoms

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Section title | `Heading` | reuse — `level={3} size={3}` inside `SettingsSection` | `static.font.sizes.lg`, `static.font.weights.semibold` | — |
| Section description | `Text` | reuse — `variant="supporting" color="secondary"` | `presets.dawn.core.light.textSecondary`/`presets.dawn.core.dark.textSecondary` | — |
| Body stack | `VStack` | reuse — `VStack` from `Stack.tsx`; rows own hairlines | `static.spacing.2`, `static.spacing.4` | — |
| Controls | `Toggle` `Select` `MultiSelect` `ShortcutInput` `Slider` `Input` `InputField` `Button` `SegmentedControl` `SearchableSelect` `Checkbox` | reuse — unchanged | component tokens unchanged | — |
| Empty section | `EmptyState` | reuse — `size="compact"` inside `SettingsSection` body | — | `languages` |
| Status/alert rows | `Alert` `StatusDot` `Badge` `Timestamp` `Spinner` `Skeleton` | reuse — unchanged | — | — |
| Section-anchor scroll margin | `SettingsSection` | create (CSS in `SettingsSection.module.css`) — `scroll-margin-top` covers the sticky subnav | `static.spacing.12` | — |

## Per-section mapping

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| `general` — ui-language select + dict-popup toggle | `SettingsRow` `Label` `Select` `Toggle` | reuse — both rows move hints into inline `description` | — | — |
| `languageProfile` — panel keeps `SelectableCard` `SearchableSelect` `FlagIcon` `Button` `Menu` `MenuItem` `EmptyState` list | `SelectableCard` `SearchableSelect` `FlagIcon` `Button` `Menu` `MenuItem` `EmptyState` | reuse structure; sweep `.radio`/`choice` literals in `LanguageProfilePanel` → `static.borderWidth.hairline`, `component.radio.dot`, `component.radio.bg`; `.linkBtn` → `Button variant="link"` | `static.borderWidth.hairline`, `static.spacing.2`, `derived.light.color-primary-subtle`/`derived.dark.color-primary-subtle` | `ellipsisVertical`, `chevronRight`, `plus` |
| `resources` — panel keeps `ResourceCard` `JobRow` `Dropzone` `Checkbox` `DragHandle` `Chip` `FrequencyBandsEditor` `Alert` `ImportProgress` `Skeleton` `Dictionary` lookup | `Card` `Checkbox` `DragHandle` `Chip` `Alert` `Skeleton` `EmptyState` `SettingsGroup` | reuse; `SectionHeader` sub-heads in `ResourcesPanel` → `SettingsGroup`; panel gap space-10 → `static.spacing.6`; `Dropzone` border → `static.borderWidth.medium` | `static.spacing.6`, `static.borderWidth.medium`, `derived.light.color-field`/`derived.dark.color-field` | `plus`, `pencil` |
| `media`/`block`/`localPlayer` — toggle rows + conditional `MultiSelect` | `SettingsRow` `Toggle` `MultiSelect` `Label` | reuse; every row hint → inline `description` | — | — |
| `dictionaryPopup` — timeline `SegmentedControl` steps + links list `Card` rows `DragHandle` `Dialog` `Input` | `SegmentedControl` `Card` `DragHandle` `Button` `Dialog` `Input` `SettingsGroup` | `.timelineLabel` → `SettingsGroup` label; `.surfaceTabs` active tint → primary-subtle tokens; `DictLinksManager` `SectionHeader` → `SettingsGroup` | `static.radius.full`, `component.iconbutton.size-sm`, `derived.light.color-primary-subtle`/`derived.dark.color-primary-subtle` | `plus`, `pencil`, `trash`, `link` |
| `wordBadge` — `Select` position + `Slider` size/pointer + preview box | `Select` `Slider` `SettingsRow` | `.label` xs → canonical sm medium; `.previewBox` → detail-box recipe (`color-field` + `radius-lg`); inline `9999px`/`2px` → `static.radius.full`, `static.borderWidth.medium` | `derived.light.color-field`/`derived.dark.color-field`, `static.radius.lg`, `static.radius.full`, `static.borderWidth.medium` | — |
| `audio` — `AudioPipeline` pills, `SourceDetailPanel` box, `TtsLanguagePanel`, `BrowserVoicePanel`, tester `Input` | `SettingsGroup` `SettingsRow` `Input` `Button` `SegmentedControl` | `.group`/`.sectionTitle` → `SettingsGroup`; `SourceDetailPanel` → detail-box recipe; bare `SettingsRow` in `TtsLanguagePanel` → `dense`; BrowserVoice `.check`/play-halo px → `component.iconbutton.size-xs`-scale tokens | `derived.light.color-field`/`derived.dark.color-field`, `static.radius.lg`, `component.iconbutton.size-xs` | `play`, `plus`, `trash` |
| `localPlayer` — 2 toggle rows | `SettingsRow` `Toggle` | reuse; hints → inline `description` | — | — |
| `download` — 4 sub-groups of `Select` rows + conditional workers child | `SettingsGroup` `SettingsRow` `Select` | `.downloadGroup`/`.downloadGroupTitle`/`.downloadCardBody`/`.childField` deleted → `SettingsGroup` + `SettingsRow child` | `static.spacing.4`, `static.spacing.2`, `static.borderWidth.hairline` | — |
| `shortcuts` — 5 groups of `ShortcutInput` grid fields | `SettingsGroup` `ShortcutInput` `SettingsRow` | `.shortcutGroupWrap`/`.groupLabel` deleted; `.shortcutField` normalized to shared field padding | `static.spacing.2`, `static.spacing.3`, `derived.light.color-destructive`/`derived.dark.color-destructive` | — |
| `theme` — `ModeCards` `Card` grid + preset `Select` | `Card` `Select` `SettingsGroup` | raw `<h2>` in `ThemePanel` → `SettingsGroup` label; `ModeCards` unchanged | — | `sun`, `moon`, `settings` |
| `sync` — `SyncPanel` summary + `AnkiStatusSyncPanel` rows | `SettingsGroup` `Card` `Button` `Badge` `StatusDot` `Alert` `Dialog` `Select` `Timestamp` `InputField` `EmptyState` | missing body wrapper fixed by `SettingsSection`; double `SectionHeader` → `SettingsGroup`; `.row` bordered divs → list-row Card recipe; `96px`/`140px`/`1px`/`0.04em` literals → `static.spacing.12`, `static.borderWidth.hairline`, shared label style | `static.borderWidth.hairline`, `static.spacing.3`, `static.spacing.12`, `component.input.height` | `plus`, `trash`, `link` |

## i18n / a11y hooks

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Hint strings → inline descriptions | `SettingsRow` | reuse — same `settings.*.hint` message ids rendered as `description` | — | — |
| `data-section` anchors + `sectionRefs` | `SettingsSection` | extend target — forwarded `data-*` attrs + `ref` | — | — |
| `data-tihoka-id` on controls | — | reuse — every value preserved verbatim | — | — |

## Notes

- `SettingsSection`/`SettingsGroup` live in `src/shared/ui/` — spec NFR-5 requires shared promotion only when a recipe repeats ≥2 sections; both repeat ≥10×.
- List-row recipe (`Card` `--card-padding space-2 space-3` `--card-radius radius-lg`) is a **CSS-var recipe on the existing atom**, not a new component — resources, dict-links, sync rows, jobs converge on it.
- Detail-box recipe (`derived.*.color-field` bg + `static.radius.lg` + `static.spacing.3` padding) likewise converges `SourceDetailPanel`, `.previewBox`, `.profileForm`, `.editBar` via CSS — no new atom.
- The `.select > button` dead selector, empty `@media` shells, and stale "dead class" comments inside touched files are swept in the same pass.
