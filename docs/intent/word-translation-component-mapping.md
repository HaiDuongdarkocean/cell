# Component Mapping: word-translation

> Every element → a real `src/shared/ui/` component or explicit create decision.
> Linter-enforced: components/icons must exist; tokens must come from tokens.json.

Chosen concept: **A — Interlinear** (user pick, 2026-10). Gloss is a text pseudo-element under each word token — no new DOM surface, no new shared component.

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Per-word gloss under token | `.js-cell-token-word::after` reading `attr(data-gloss)` | extend — mirror of the shipped `::before` reading cap in `tokenSpanCss`; new attr `data-gloss` + `gloss-off` modifier class on the word token span | `--color-overlay-text` | — |
| Bottom headroom (wrap safety) | `margin-bottom` on the word token span when glosses on | extend — same technique as the top reading headroom | — | — |
| Gloss width bound | `::after` box = token width + 0.8em bleed, `text-overflow: ellipsis` | extend — keeps spec REQ-3 "ellipsis not reflow" | — | — |
| Settings row "Show word translations" | SettingsRow + Toggle + HintIcon | reuse — identical to the "Show readings" row above it (`SettingsDialogContent.tsx`) | `--color-text-primary`, `--color-text-muted` | — |
| i18n keys | `settings.block.showWordTranslations` + `.hint` (+ `settings.hint.aria` reuse) | reuse pattern — same key family as `settings.block.showReadings` | — | — |
| Gloss-free/failed state | no element — `data-gloss` absent, `::after` empty | reuse — identical to reading-miss behavior | — | — |

## New assets

- No new components. The gloss is a pseudo-element extension of the existing token span renderer — a `GlossLine` component would only be warranted if a second surface (cue list, card preview) needed it, which v1 explicitly excludes.
- No new icons. v1 has no toolbar affordance (quick toggle deferred per brief).

## Token discipline

Gloss inherits overlay text color (`--color-overlay-text`, always white on video) with `opacity` reduction — no new color. Sizing is `em`-relative to the token font so it follows `globalScale` and subtitle font settings for free. Headroom is `em`-relative `margin-bottom`, matching the reading-cap approach.

## Interaction → requirement trace

| Journey step | REQ | Function | Element |
|---|---|---|---|
| 1 Enable | REQ-4 | `showWordTranslations` setting persist + live update | SettingsRow + Toggle |
| 2 Watch | REQ-1, REQ-2 | batched TRANSLATE_TERMS → `Token.gloss` hydration | background handler + preloader (no UI) |
| 3 Read | REQ-3 | gloss below token, copy-clean | `data-gloss` ::after |
| 4 Deep lookup | REQ-3 | token click unchanged → dictionary popup | existing `onTokenClick` |
| 5 Distract-free | REQ-3, REQ-4 | toggle off → `gloss-off` releases ::after + headroom | Toggle |
| 6 Switch language | REQ-5 | `setGlossTargetLanguage` + cache invalidation | settings native-language row (existing) |
| 7 Failure | REQ-1 | non-fatal — no error element | — |
