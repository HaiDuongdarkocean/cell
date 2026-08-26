# Spec: Liquid-Glass Button System

> Intent: `docs/intent/liquid-glass-buttons.md`  
> Status: Draft for plan approval  
> Confirmed: 2026-08-27

## Objective

Create one liquid-glass optical system for shared `Button`, shared `IconButton`, and subtitle-overlay action buttons. The system must remain readable and responsive across light UI, dark UI, and unpredictable moving-video backgrounds without converting containers or semantic selection controls into glass buttons.

### User stories

1. As a Cell user, I see the same button material and interaction language in popup, sidepanel, options and subtitle overlay.
2. As a video learner, I can identify and activate overlay controls on bright, dark or high-motion video.
3. As a keyboard/touch user, I retain visible focus, sufficient touch targets and predictable pressed/disabled/loading behavior.
4. As a maintainer, I change button material in shared tokens/components rather than feature CSS.

## Design contract

### Material modes

| Context | Surface | Foreground | Purpose |
|---|---|---|---|
| Light theme | Light translucent glass | Dark neutral | Readability on light application surfaces |
| Dark theme | Dark translucent glass | White/off-white | Readability on dark application surfaces |
| Subtitle overlay | Protected dark translucent glass | White/off-white | Stable legibility on video independent of app theme |

Exact alpha, blur and shadow values are calibrated in V4 and are not promoted to production until human approval.

### Optical layers

Every glass action button uses the same ordered model:

1. Translucent neutral body.
2. Backdrop blur and bounded saturation.
3. Soft upper specular highlight.
4. Soft lower caustic/contact reflection.
5. Curved inner shadow for volume.
6. Low contact shadow; no lift shadow.
7. Content above optical layers.

No solid perimeter border is used to fake glass. Edge visibility must come from soft inset light/shadow gradation. The material must preserve background influence rather than render as opaque plastic.

### Variant contract

All existing variants keep their API and behavior but share one neutral material:

- `primary`
- `primarySubtle`
- `secondary`
- `outline`
- `ghost`
- `glass`
- `destructive`
- `link`
- `success`

Variant names remain for backward compatibility and semantic intent. They do not receive colored bodies, borders or reflections. Meaning is conveyed through label, icon, placement, confirmation, loading/error text and ARIA.

Destructive actions with significant consequences must not be icon-only without an unambiguous destructive icon and accessible label, and must preserve an existing confirmation step or add one in a separately approved behavior change.

### Geometry

| Component/configuration | Shape |
|---|---|
| `IconButton` all sizes | Circle; equal width/height; `border-radius: 50%` |
| Horizontal content-width `Button` | Capsule; pill radius |
| `Button orientation="vertical"` | Rectangle; `border-radius: 0` |
| `Button fullWidth` | Rectangle; `border-radius: 0` |
| Vertical + fullWidth | Rectangle; `border-radius: 0` |

Geometry must not turn horizontal buttons into fixed-width ovals. Width follows content and token padding. Long labels remain single-line unless an existing call site explicitly supports wrapping.

### Motion and states

| State | Contract |
|---|---|
| Default | Static glass; no idle drift |
| Hover | Slight highlight/opacity increase; no `translateY` |
| Pressed | Scale around `0.985`; no lift |
| Focus-visible | External accessible focus indicator, contrast ≥3:1 |
| Active/toggle | Optical intensity change only; no semantic color |
| Disabled | Reduced opacity while preserving recognizable content |
| Loading | Spinner replaces content; no idle liquid animation |
| Error | `aria-invalid` and explicit text/status; material remains neutral |
| Ripple | Only when caller passes `ripple`; bounded DOM creation |
| Reduced motion | No scale, ripple or non-essential transition |
| Reduced transparency | Opaque-enough neutral fallback; no backdrop filter |

No state animates `backdrop-filter`, blur radius or saturation. No infinite compositor animation is allowed.

## Subtitle component normalization

### Migrate to shared components

| Current | Target | Required preservation |
|---|---|---|
| `SubtitleSearchPanel.apiHintBtn` | `Button` | `aria-expanded`, `data-cell-id`, inline layout, Add key/Hide label |
| `SubtitleManagerPanel.stepBtn` ×2 | `Button` | icon + `±0.5s`, pill-group geometry, click handlers, focus order |
| `SubtitleManagerPanel.headerBack` | `IconButton` | forwarded ref, `aria-label`, `data-cell-id`, back motion if retained |
| `NavClusterSettingsPanel.presetBtn` map | `Button` | `aria-pressed`, active state, wrapping/flex behavior |
| Search Target/Native raw tabs | `Tabs` compound component | controlled value, count badge, `data-cell-id`, tab semantics |

### Preserve semantic native controls

- `SearchResultRow.resultButton`: listbox option/selectable row.
- `TrackList` Off row: listbox option.
- Alignment segmented radios: `radiogroup`/`radio` semantics.
- Shadow segmented radios: `radiogroup`/`radio` semantics.

These controls must not inherit liquid action-button material merely because their host element is `<button>`.

## CSS ownership contract

### Shared component owns

- Surface/body material.
- Foreground.
- Specular/caustic layers.
- Border/radius defaults.
- Hover/pressed/focus/disabled/loading visual states.
- Reduced-motion/transparency fallback.

### Feature CSS may own

- Placement and flex/grid alignment.
- Context-specific width/height only when component size props cannot express it.
- Container-query-driven overlay control size.
- Icon size where overlay scale settings explicitly control it.
- Opacity preference that represents user-configurable overlay visibility.

### Feature CSS must not own

- Button background material.
- Material border/highlight/shadow.
- Theme foreground except protected-overlay scoped tokens.
- Broad styling of every descendant `button` when only action components are intended.

`NavCluster.module.css` and `subtitlePanelsShared.module.css` must replace broad material overrides with explicit component classes or scoped component-token overrides. Touch-target sizing and user-configurable cluster geometry must remain intact.

## Token architecture

New/updated values originate in `src/shared/styles/tokens.json` and generate CSS/TS artifacts through existing scripts.

Provisional component-token roles:

```text
--button-liquid-surface
--button-liquid-surface-hover
--button-liquid-foreground
--button-liquid-specular
--button-liquid-caustic
--button-liquid-inner-shadow
--button-liquid-contact-shadow
--button-liquid-backdrop-blur
--button-liquid-backdrop-saturation
--button-liquid-focus-ring

--iconbutton-liquid-*     aliases/references button optical roles

--overlay-button-liquid-* protected dark-context overrides
```

Token names may be adjusted to existing naming conventions during implementation, but primitive values must not be hardcoded in component CSS. Overlay scoped variables must resolve at the actual component inheritance scope, not rely on re-resolution of root aliases.

## Tech stack

- React 19
- TypeScript 6 strict mode
- CSS Modules
- Generated CSS custom properties from `tokens.json`
- Jest + Testing Library
- Vite 8
- Chrome MV3 Shadow DOM UI

No new dependency is required.

## Commands

```text
Dev showcase:  npm run dev
Typecheck:     npm run typecheck
Unit tests:    npm run test:unit
Lint:          npm run lint
Build:         npm run build
Dev build:     npx vite build --mode development
E2E:           npm run test:e2e
```

## Project structure

```text
src/entrypoints/design-system-showcase/mockups/
  liquid-glass-dewdrop-v4.html       # visual contract and edge cases

src/shared/styles/
  tokens.json                         # token SSOT
  tokens.css                          # generated, never hand-edit
  tokens.ts                           # generated, never hand-edit

src/shared/ui/
  Button.tsx
  Button.module.css
  Button.test.tsx
  Button.showcase.tsx
  IconButton.tsx
  IconButton.module.css
  IconButton.test.tsx
  Tabs.tsx
  Tabs.test.tsx

src/features/subtitle/ui/
  SubtitleSearchPanel.tsx/.module.css/.test.tsx
  SubtitleManagerPanel.tsx/.module.css/.test.tsx
  NavCluster.tsx/.module.css/.test.tsx
  ClusterRightToolbar.tsx/.test.tsx
  subtitlePanelsShared.module.css
  appearance/NavClusterSettingsPanel.tsx/.module.css
  appearance/OverlayPreview.tsx/.module.css
```

## Code style

Use existing named exports, CSS Modules and token references. Preserve component APIs unless a change is explicitly required by this spec.

```tsx
<IconButton
  variant="transparent"
  aria-label="Previous sentence"
  data-cell-id="nav-prev"
  onClick={onPrev}
>
  <Icon name="navPrev" />
</IconButton>
```

Feature CSS may set geometry through an explicit class but must not replace shared material:

```css
.navAction {
  width: var(--cluster-btn-size);
  height: var(--cluster-btn-size);
  min-width: var(--cluster-btn-size);
  min-height: var(--cluster-btn-size);
}
```

## Testing strategy

### Unit/component tests

- Existing props and event forwarding remain unchanged.
- Geometry classes resolve correctly for horizontal, vertical, full-width and IconButton.
- Loading, disabled, active, error and ripple behavior remain covered.
- Native subtitle actions retain handlers, ARIA, refs and `data-cell-id` after migration.
- Tabs remain controlled and retain count badges.

### Static style guards

- No `animation: liquidDrift` or infinite animation in Button/IconButton CSS.
- No hover `translateY` for liquid action buttons.
- No feature selector sets background/material on all descendant buttons in NavCluster or right toolbar.
- Generated files match `tokens.json` after build.

### Browser verification

Test V4 and production showcase at 320, 480, 768, 1024 and 1280px in light/dark. Test overlay on bright, dark, patterned and moving-video content. Verify Chrome and Edge; Brave follows Chromium unless a browser-specific failure is observed.

### Accessibility

- Text contrast ≥4.5:1.
- Focus indicator contrast ≥3:1.
- Touch target ≥44px touch and ≥40px desktop.
- Keyboard Tab/Enter/Space behavior.
- No color-only semantic distinction.
- `prefers-reduced-motion` and `prefers-reduced-transparency`.

### Performance

- No infinite animation.
- No animated blur.
- Ripple limits concurrent transient nodes per button.
- Record a DevTools performance trace for subtitle overlay interaction on moving video; no sustained frame degradation attributable to button effects.

## Boundaries

### Always do

- Calibrate and obtain human approval in V4 before production sync.
- Use `tokens.json` as SSOT.
- Preserve public props, ARIA, refs, tests and data hooks.
- Keep action semantics distinct from tabs/listbox/radio semantics.
- Run typecheck, unit tests, build and real-browser verification.

### Ask first

- Change `Button` or `IconButton` public prop types.
- Add a new shared semantic control.
- Add semantic color back to any variant.
- Change destructive confirmation behavior.
- Expand migration beyond subtitle UI native actions.

### Never do

- Hand-edit generated token files.
- Add a new dependency for visual effects.
- Apply liquid action-button material to all native `<button>` elements globally.
- Animate blur or run idle liquid animation.
- Remove tests or `data-cell-id` hooks to make migration pass.
- Convert containers/cards/inputs into liquid glass under this spec.

## Acceptance criteria

### Visual contract

- [ ] Human approves V4 light, dark and protected-overlay button examples.
- [ ] IconButton is circular at every size.
- [ ] Horizontal content-width Button is capsule.
- [ ] Vertical and full-width Button computed radius is `0px`.
- [ ] All semantic variants share neutral material with no semantic color.

### Shared components

- [ ] All existing shared Button/IconButton call sites compile without required prop changes.
- [ ] Material comes from component tokens.
- [ ] No idle drift, hover lift or infinite animation remains.
- [ ] Reduced motion/transparency fallbacks pass.

### Subtitle migration

- [ ] Five confirmed native action/tab groups are migrated.
- [ ] Four semantic native-control groups remain non-glass.
- [ ] Overlay feature CSS no longer overrides shared material with broad selectors.
- [ ] NavCluster and right-toolbar geometry/settings remain unchanged.

### Quality

- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npx vite build --mode development` passes.
- [ ] Browser verification passes in Chrome and Edge.
- [ ] No console errors or accessibility regressions.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Neutral destructive button becomes ambiguous | High | Explicit label/icon, placement and existing confirmation; test user flow |
| Radius-zero vertical/full-width buttons look like table cells | High | Validate V4 examples before production; approval checkpoint is blocking |
| Overlay CSS overrides shared material | High | Explicit geometry classes/scoped tokens; style guards |
| Blur hurts moving-video performance | High | Static effect, no animated blur, performance trace, reduced-transparency fallback |
| Token alias does not re-resolve in scoped overlay | Medium | Override final component tokens at inheritance scope |
| Tabs migration changes focus/selection behavior | Medium | Controlled Tabs tests and ARIA verification |
| Ripple node accumulation | Medium | Per-button concurrent-node guard and cleanup |

## Open questions

No unresolved product decisions. Exact optical values remain a visual calibration output of V4 and require human approval before production implementation.
