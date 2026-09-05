# Universal Panel — Dark Mode Iteration 2

## Goal
Address the P1/P2 visual-hierarchy and contrast issues remaining after iteration 1: token-pill readability, Card Creator elevation, error-banner dominance, light-mode warmth, and frequency-count styling.

## What changed

1. **Token-pill and status contrast** (`src/shared/styles/tokens.json` + generated `tokens.css`)
   - Dark `color-token-freq-*` pills: raised foreground white mix to 60–80% and background alpha to 0.20 for crisper text on subtle fills.
   - Dark `color-token-status-*` colors: mixed 45–50% with `var(--color-text)` so status dots/pills are less saturated.
   - Dark `color-token-status-*-bg` colors: unified alpha to 0.12 for consistent subtle fills.
   - Light `derived` tokens: refactored `color-surface-elevated/-hover/-pressed`, `color-background-elevated/-muted`, `color-primary-hover/-active/-subtle`, and `color-border-subtle/-emphasized` to use `color-mix` against the core palette so light surfaces pick up a cool theme tint instead of a warm cream cast.
   - `color-text-tertiary`, `color-text-disabled`, `color-skeleton`, `color-track`, `color-scrollbar-thumb`, `color-glass-*`, and `color-overlay-hover/pressed` all now derive from `var(--color-text)` or `var(--color-surface)`, removing hardcoded warm neutrals.

2. **Status and frequency pill CSS** (`src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`)
   - Swapped `.cellHeaderStatus--*` to use `*-bg` tokens for the background and `*-fg/status` tokens for the text, fixing the light-on-light contrast mismatch in dark mode.
   - `.cellHeaderFrequencyRank` now uses `color-text-secondary` with a transparent background, so the frequency count reads as metadata instead of a third semantic pill.

3. **Card Creator right panel** (`src/features/universalPanel/tabs/CardCreatorPanel.module.css`)
   - Background: `var(--color-background)` → `var(--color-surface-elevated)`.
   - Left divider: `color-border-subtle` → `color-border` for clearer separation.

4. **Dictionary tab surface** (`src/features/universalPanel/tabs/DictionaryTab.module.css`)
   - Background: `var(--color-background)` → `var(--color-surface)` so the tab body sits on the panel surface while the Card Creator pane is elevated.

5. **Error banner** (`src/features/cardCreator/ui/CardCreatorDialog.module.css`)
   - Error alert background: `color-error-subtle` → `color-surface-elevated`.
   - Left accent border: `var(--space-1)` → `var(--border-width-hairline)` to reduce visual weight.

6. **Panel shadow / showcase frame** (`src/features/universalPanel/UniversalPanel.module.css`, `src/entrypoints/design-system-showcase/pages/UniversalPanelPage.module.css`)
   - Added `box-shadow: var(--panel-shadow)` to the panel so it lifts off the simulated page.
   - Showcase frame: removed the heavy gradient border and replaced it with a flat `color-background` surface and `color-text-tertiary` placeholder text.

7. **Runtime color fix** (`src/entrypoints/background/helpers.ts`)
   - `setBadgeTextColor` now reads `tokensJson.derived.light['color-text-inverse']` directly instead of `color-primary-foreground`, which became a CSS variable after the token refactor.

## Verification
- `node scripts/generate-tokens.js` (success).
- `npm run typecheck` (pass).
- `npm run test:unit` (pass, 5405 tests; one transient phrase-match benchmark timing flake that passed on re-run).
- `npm run lint` (pass).
- `npm run build` (pass).
- `node scripts/generate-design-system-health-report.mjs` (warn, pre-existing drift only).
- Playwright dark + light screenshots captured and reviewed:
  - `universal-panel-dark-1280-after.png`
  - `universal-panel-light-1280-after.png`

## Visual outcome
- Dark mode: token-pill row is now readable; the status pill uses a translucent color fill with light text instead of a bright saturated red.
- Card Creator right panel is clearly elevated from the dictionary body.
- Error banner is a subtle surface-elevated strip with a thin red left accent, not a dominant coral banner.
- Light mode: surfaces are cool (blue-tinted) instead of warm/cream; the showcase device frame is lighter.
- Frequency count reads as neutral metadata.
- No P1 blockers in the final vision-reader audit; remaining P2s are pre-existing minor items (search clear ×× duplication, overall red hue of the unknown status pill, etc.).

## Related commits
- `<iteration-2 token commit>` — `refactor(tokens): derive light surfaces and token-pill/status colors from theme`
- `<iteration-2 style commit>` — `style(universal-panel): fix panel elevation, error banner, and token/status contrast`
