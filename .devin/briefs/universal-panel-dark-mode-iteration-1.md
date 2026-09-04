# Universal Panel — Dark Mode Iteration 1

## Goal
Realign the Universal Panel dark-mode UI with the project's design-system
principles: eliminate hardcoded values, improve surface hierarchy, and make
color/selection/accessory states consistent across themes.

## What changed

1. **Dark-mode color tokens** (`src/shared/styles/tokens.json` + generated
   `tokens.css`)
   - `core.dark`:
     - Primary: `#5E6AD2` → `#8C94E7` (lighter, accessible on dark).
     - Background: `#0F1011` → `#0F1015` (subtle blue tint).
     - Surface: `#18191A` → `#181920` (subtle blue tint).
     - Text secondary: `#AEB4BC` → `#A9AFBF`.
     - Border: `#33363A` → `#2E3038`.
   - `derived.dark`:
     - Replaced most hardcoded surface/primary/border hexes with
       `color-mix(in srgb, ...)` so they derive from the core set.
     - `color-surface-elevated / -hover / -pressed` now mix surface + primary +
       text for a consistent elevation ramp.
     - `color-background-elevated / -muted`, `color-border-subtle /
       -emphasized`, `color-primary-hover / -active / -subtle` all reference
       the core tokens.
     - `color-text-on-primary` and `color-primary-foreground` now resolve to
       `var(--color-text-inverse)` so light primary has dark text.
     - `color-token-freq-*` and `color-token-status-*` were desaturated and
       reduced in opacity to clash less with the new dark palette.

2. **NavItem active state** (`src/shared/ui/NavItem.module.css`)
   - Active background: `color-surface-hover` → `color-primary-subtle`.
   - Active icon remains `color-primary`; text remains `color-text` for
     contrast safety.

3. **Showcase page fixes** (`src/entrypoints/design-system-showcase/pages/UniversalPanelPage.module.css`)
   - Removed hardcoded `#f0f4f8 → #d9e2ec` placeholder gradient; now uses
     `var(--color-background)` → `var(--color-surface-elevated)`.
   - Panel frame border: `color-border` → `color-border-subtle`.

4. **Test/runtime guards**
   - `src/shared/ui/useIsMobile.ts`: guards `window.matchMedia`.
   - `src/shared/lib/chrome-apis/storage.ts`: guards `chrome.storage.local`
     and `chrome.storage.session`, returning empty defaults in non-extension
     environments.

## Verification
- `node scripts/generate-tokens.js` (success).
- `npm run typecheck` (pass).
- `npm run test:unit` (pass, 5405 tests).
- `npm run lint` (pass).
- `npm run build` (pass).
- `node scripts/generate-design-system-health-report.mjs` (warn, no errors;
   pre-existing issues only).
- Playwright dark-mode screenshot captured:
  - `universal-panel-dark-1280-after.png`
  - `universal-panel-light-1280-after.png`

## Visual outcome
- Dark mode is now more cohesive: a deep navy/slate base with a single
  primary family, visible active nav, and softer token pills.
- Active nav is clearly readable (left pill + primary icon + subtle fill).
- Showcase frame is no longer a heavy gray bevel.
- No P0 blockers in the dark-mode vision-reader audit.

## Remaining work (future iteration)
P1:
- Pink / red `advanced` token pill still has lower contrast than the others.
- Card Creator right panel feels visually merged with the dictionary body.
- Error banner coral border competes with semantic tag colors.

P2:
- Duplicate "Dictionary" label in nav + panel header.
- `1,234` frequency count reads as a third tag instead of metadata.
- Empty Card Creator fields need placeholder hints.
- "Side Panel" badge and header star icon need clearer affordance.
- Light-mode audit found the device mockup frame and Card Creator cream
  surface still feel heavy; these are pre-existing in the light palette and
  not regressions from this dark-mode pass.

## Related commits
- `181692dd` — debt(universal-panel): realign dark-mode tokens with M3 and
  remove hardcoded values
- `2c472ee6` — chore(design-system): regenerate component inventory and health
  report
