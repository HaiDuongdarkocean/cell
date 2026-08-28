# Spec: Solid/Liquid Button Material

> Intent: `docs/intent/solid-liquid-button-material.md`  
> Status: Draft for approval  
> Confirmed: 2026-08-27

## Objective

Introduce a second `solid` material family for the shared `Button` without duplicating color values or breaking the existing liquid-glass contract. Solid provides an opaque, flat surface suitable for forms, dialogs, settings and other contexts where glass is too subtle.

### User stories

1. **As a** Cell user, **I want** a `solid` button option **so that** I can clearly see and tap actions on light or white backgrounds where glass is too subtle.
2. **As a** Cell developer, **I want** to switch a `Button` between `liquid` (default) and `solid` with a single `variant` prop **so that** I don't have to learn a new component or prop surface.
3. **As a** maintainer, **I want** `solid` to reuse existing color tokens **so that** adding a new material does not duplicate or fork the color system.

## Design contract

### Alternatives considered

| Alternative | Why not chosen |
|---|---|
| **Prop `material="solid"`** | Requires changing `Button` prop types and every call site that wants solid. Also creates two orthogonal axes (`variant` semantic + `material` surface) that can conflict (e.g., `variant="success" material="solid"`). Kept as backup if `variant` becomes too crowded later. |
| **Separate `SolidButton` component** | Duplicates size, icon, loading, disabled, ARIA and ripple logic already in `Button`. Breaks the rule "use `src/shared/ui/*`, don't create inline components" and makes future `solid` support for Card/Dialog inconsistent. |
| **`variant="solid"`** (chosen) | Reuses the existing `variant` enum that already includes `glass` (a material). Minimal API change; no new prop; no code duplication; easiest to migrate gradually. |

### Material families

| Family | Surface | Use case |
|---|---|---|
| `liquid` | Translucent glass with SVG filter refraction | Overlay, video, floating actions (default) |
| `solid` | Opaque flat fill + subtle border/shadow | Forms, dialogs, settings, static surfaces |

### Color reuse rule

- `solid` does **not** define new colors. It maps to existing semantic color tokens (`--color-surface`, `--color-surface-hover`, `--color-text-primary`, `--color-border`, etc.).
- `liquid` continues to use `button-liquid-*` tokens.
- New `button-solid-*` tokens are aliases/wrappers, not new color definitions, so future components can reuse them.

### Solid optical layers

1. Opaque body from `--button-solid-surface`.
2. Optional 1px border (`--button-solid-border`) for shape on light/dark surfaces.
3. Subtle inset or drop shadow (`--button-solid-shadow`) for depth.
4. Foreground above surface.
5. Hover: `background` transitions to `--button-solid-surface-hover`.
6. Active/pressed: `background` transitions to `--button-solid-surface-active`, slight `scale` + `brightness`.
7. Disabled: `background` from `--button-solid-surface-disabled` or `opacity` reduction.
8. Focus-visible: `outline: 2px solid currentColor` with `outline-offset: 3px`.

No `backdrop-filter`, no `blur`, no caustic rim, no SVG filter on `solid`.

### Geometry

Same as existing `Button`:

- Horizontal content-width: capsule pill radius.
- `vertical` / `fullWidth`: `border-radius: 0`.
- `iconOnly` / `circle`: circular.
- Touch target, padding and font sizing remain unchanged.

### States

| State | Solid behavior |
|---|---|
| Default | Opaque body, foreground from semantic token |
| Hover | `background` to `--button-solid-surface-hover` |
| Pressed | `transform: scale(var(--button-press-scale))`, `filter: brightness(0.98)`, `background` to `--button-solid-surface-active` |
| Focus-visible | `outline: 2px solid color-mix(in srgb, currentColor 60%, transparent)` with `outline-offset: 3px` |
| Disabled | `opacity: 0.5` and `pointer-events: none`; optional `--button-solid-surface-disabled` |
| Loading | Spinner replaces content; disabled-like opacity; no ripple |
| Error | Keeps solid material; `aria-invalid`; may combine with error text |

No infinite animation, no animated blur.

## API contract

### `Button` variant type

```ts
type ButtonVariant =
  | 'primary'
  | 'primarySubtle'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'glass'
  | 'destructive'
  | 'link'
  | 'success'
  | 'transparent';

type ButtonMaterial = 'liquid' | 'solid';
```

`material="solid"` is a surface directive. It can be combined with any `variant` to switch from the default liquid glass to a flat, opaque surface.

### Usage

```tsx
<Button material="solid" variant="primary" onClick={save}>
  Save
</Button>

<Button material="solid" variant="success" size="sm" leadingIcon={<Icon name="download" />}>
  Download
</Button>

<Button variant="primary" onClick={save}>          {/* liquid default */}
  Liquid primary
</Button>
```

### Usage

```tsx
<Button variant="solid" onClick={save}>
  Save
</Button>

<Button variant="solid" size="sm" leadingIcon={<Icon name="download" />}>
  Download
</Button>
```

## Token architecture

Add the following tokens to `src/shared/styles/tokens.json` under the existing button token group. They must alias existing color tokens, not introduce new color values.

```text
--button-solid-surface              → var(--color-surface)
--button-solid-surface-hover        → var(--color-surface-hover)
--button-solid-surface-active       → var(--color-surface-active)
--button-solid-surface-disabled     → var(--color-surface)
--button-solid-foreground           → var(--color-text-primary)
--button-solid-border               → var(--color-border)
--button-solid-shadow               → var(--shadow-button) or none
--button-solid-focus-ring           → var(--color-outline) or currentColor
```

Token names may be adjusted to existing naming conventions. Generated `tokens.css` and `tokens.ts` are updated via the existing `npm run build` prebuild script.

## Tech stack

- React 19
- TypeScript 6 strict mode
- CSS Modules
- Generated CSS custom properties from `tokens.json`
- Jest + Testing Library
- Vite 8

No new dependency.

## Commands

```text
Dev showcase:  npm run dev
Typecheck:     npx tsc --noEmit
Unit tests:    npx jest src/shared/ui/Button --selectProjects unit
Lint:          npx eslint src/shared/ui/Button.tsx src/shared/ui/Button.module.css
Build:         npm run build
```

## Project structure

```text
src/shared/styles/
  tokens.json                         # add button-solid-* aliases

docs/intent/
  solid-liquid-button-material.md     # confirmed 8-field frame

docs/specs/
  solid-liquid-button-material.md     # this file

src/shared/ui/
  Button.tsx                          # add 'solid' to variant type
  Button.module.css                   # add .solid styles
  Button.test.tsx                     # add solid variant tests
  Button.showcase.tsx                 # add solid examples
```

## Code style

Use existing named exports, CSS Modules and token references. No hardcoded colors.

```css
.solid {
  background: var(--button-solid-surface);
  color: var(--button-solid-foreground);
  border: var(--border-width-hairline) solid var(--button-solid-border);
  box-shadow: var(--button-solid-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.solid:hover {
  background: var(--button-solid-surface-hover);
}

.solid:active {
  background: var(--button-solid-surface-active);
  transform: scale(var(--button-press-scale));
}

.solid:disabled {
  background: var(--button-solid-surface-disabled);
  opacity: 0.5;
}
```

```tsx
const variantClasses: Record<ButtonVariant, string> = {
  ...,
  solid: styles.solid,
};
```

## Testing strategy

### Unit / component tests

- `Button` renders `solid` variant with `styles.solid` class.
- `solid` does not apply `backdrop-filter` or `blur`.
- `solid` uses `--button-solid-surface` and related tokens.
- Existing variants continue to default to liquid.
- Disabled, loading, active, focus and ripple states still work.

### Style guards

- No hardcoded hex or rgba in `Button.module.css`.
- No `backdrop-filter` on `.solid`.
- No `animation` or infinite loop.

### Browser verification

- Open `design-system-showcase` in light and dark.
- Verify `solid` buttons are opaque and readable on white and black surfaces.
- Verify `liquid` buttons still use SVG filter.

## Boundaries

### Always do

- Add `button-solid-*` tokens as aliases to existing color tokens.
- Keep `liquid` as the default material.
- Preserve all existing props, ARIA, refs and tests.
- Run `typecheck`, unit tests and `build`.

### Ask first

- Change `Button` prop API beyond `variant`.
- Add semantic color back to `solid`.
- Expand `solid` to other components before this spec is approved.

### Never do

- Hand-edit generated `tokens.css` / `tokens.ts`.
- Add a new dependency.
- Remove or break existing liquid material.
- Hardcode colors in component CSS.

## Success criteria

- [ ] `Button` accepts `variant="solid"` and renders an opaque, flat button.
- [ ] `solid` uses tokens from `tokens.json`; no hardcoded colors in CSS.
- [ ] `liquid` remains the default and still uses the SVG filter.
- [ ] Showcase displays `solid` examples in light/dark.
- [ ] `npm run typecheck` passes.
- [ ] `npx jest src/shared/ui/Button` passes.
- [ ] `npm run build` passes.
- [ ] No accessibility regressions.

## Open questions / accepted risks

1. **Exact shadow/border values for solid:** will be calibrated in the showcase during implementation; spec assumes `var(--shadow-button)` and `var(--color-border)` as starting points.
2. **Whether `button-solid-surface-disabled` should be a separate token or simply `opacity: 0.5` on `--button-solid-surface`:** to be decided during token PR; default to `opacity`.
