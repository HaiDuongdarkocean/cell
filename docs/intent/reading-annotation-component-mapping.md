# Component Mapping — reading-annotation

> Deconstruction of the "Ruby cap" variant (`docs/intent/reading-annotation-design-brief.md`). No new atoms — the feature is one attribute, one pseudo-element rule, one settings row.

| Element (site) | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Reading attribute (`tokenSpanRenderer`) | css (feature module) | extend — `data-reading` on inner `js-cell-token-word` when `token.reading` resolves; `applyTokenClasses` gains `showReadings` → per-token `reading-off` modifier (mirrors the `status-off`/`frequency-off` layer toggles) | — | — |
| Annotation cap CSS (`tokenSpanCss`) | css (feature module) | extend — one rule block in both `buildTokenSpanCss` (:100) and `buildTokenSpanCssForShadow` (:309+); `html body` ancestor specificity precedent applies to the plain builder | `static.shadow.sm` | — |
| Word span positioning (`tokenSpanCss`) | css (feature module) | extend — `js-cell-token-word` gains `position: relative` (inline+relative is layout-neutral, no reflow) | — | — |
| Cue-list tokens (`CueList.tsx` token twin) | css (feature module) | extend — same attribute + modifier mirror on the React twin | — | — |
| Card-creator preview tokens (`PreviewBlock.tsx` twin) | css (feature module) | extend — same attribute + modifier mirror | — | — |
| "Show readings" settings row (`SettingsDialogContent` Subtitle card) | Toggle | reuse — beside the `subtitleOverlayAutoLoad` family (:377-422); i18n `settings.subtitle.showReadings` + desc, en+vi | `component.toggle.*`, `color-text-secondary` | — |
| Settings plumbing (profile schema) | settings schema | extend — `LanguageProfile.showReadings` + `Settings.showReadings` required booleans; `FLAT_FIELD_KEYS` + `syncFlatFieldsToActiveProfile` + `ACTIVE_PROFILE_MIRROR_EXCLUSIONS` + migration (spec REQ-4) | — | — |

## Conventions check

- No new shared components; the only "create" is CSS rules inside existing builders.
- Icons: none.
- Tokens referenced: `static.shadow.sm` (existing; also already injected for host pages via `STATIC_TOKENS_NEEDED`). No new design tokens — annotation color derives from `color: inherit` + `opacity`.
- Toggle home follows the real precedent: `SettingsDialogContent` Subtitle card, not `ProfileForm` (identity-only editor).
