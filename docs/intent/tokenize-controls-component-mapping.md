# Tokenize Controls — Component Mapping

> Chosen concept: **Icon-only Split Capsule**.
> Source mockup: `src/entrypoints/design-system-showcase/mockups/tokenize-controls-split-capsule.html`

---

## Chosen interaction

- One pill-shaped control in the Universal Panel header, split into two icon halves.
- Left half = `Text` (page/scan icon). Right half = `Media` (video icon).
- Tap the left half to toggle Text, tap the right half to toggle Media.
- Each half can be on independently. When both are on, both halves fill with the active state.
- `Media` half is disabled when the page has no video.
- No master toggle, no labels, no advanced menu.

---

## Element → component mapping

| # | UI element | Existing component | File | Decision | Notes |
|---|---|---|---|---|---|
| 1 | Capsule container | `HStack` / `Flex` | `src/shared/ui/Stack.tsx` | **Reuse** | `HStack` or `Flex` with `borderRadius='pill'`, `overflow='hidden'`, `border='border-subtle'`. No fill background. |
| 2 | Text half | `Button` | `src/shared/ui/Button.tsx` | **Reuse** | `shape='square'`, `variant='ghost'`, child `<Icon name='scanText' />`. `onClick` toggles `text` state. |
| 3 | Media half | `Button` | `src/shared/ui/Button.tsx` | **Reuse** | `shape='square'`, `variant='ghost'`, child `<Icon name='video' />`. `disabled={!hasMedia}`; `onClick` toggles `media` state. |
| 4 | Middle divider | custom CSS / `Box` | `src/shared/ui/Box.tsx` | **Create / CSS** | A `1px` vertical line using `borderLeft` or a `Box` with `width='1px'`, `background='border-emphasized'`. |
| 5 | Tokenize control cluster | new `TokenizeControls` | `src/features/universalPanel/TokenizeControls.tsx` | **Create** | Feature-level composite. Two `Button` halves + divider inside an outlined pill. Capsule uses a `1px` `border-subtle` and no fill background. Active half uses `primary-subtle` fill. Receives `hasMedia` prop. |
| 6 | Header layout | `UniversalPanelHeader` | `src/features/universalPanel/UniversalPanelHeader.tsx` | **Redesign** | Replace the current `TOGGLE_ITEMS` row with `TokenizeControls`. Keep profile `Select` and close `Button`. |
| 7 | Language profile select | `Select` | `src/shared/ui/Select.tsx` | **Reuse** | `variant='ghost'`, `size='sm'`. |
| 8 | Close button | `Button` | `src/shared/ui/Button.tsx` | **Reuse** | `shape='circle'`, `variant='ghost'`, child `<Icon name='x' />`. |
| 9 | Active / disabled states | CSS | `TokenizeControls.module.css` | **Create** | Apply `emil-design-eng`: `:active` uses `transform: scale(0.97)` for press feedback; transitions use strong `cubic-bezier(0.23, 1, 0.32, 1)` with exact properties; hover is gated behind `@media (hover: hover) and (pointer: fine)`; `prefers-reduced-motion` keeps color/opacity but removes transform. |

---

## State shape (Option A — UI only)

The existing `TokenizePanelState` is kept unchanged:

```ts
interface TokenizePanelState {
  readonly enabled: boolean;       // maps to Text half
  readonly showStatus: boolean;    // not surfaced in the header
  readonly showFrequency: boolean; // not surfaced in the header
  readonly subtitleEnabled: boolean; // maps to Media half
}
```

- `TokenizeControls` maps:
  - `text` ↔ `enabled`
  - `media` ↔ `subtitleEnabled`
- `showStatus` and `showFrequency` remain in state but are no longer exposed in the Universal Panel header.
- `hasMedia` is a prop from page detection logic, not state.

---

## Business rule — Media availability

- `TokenizeControls` receives `hasMedia: boolean`.
- When `hasMedia === false`:
  - The `Media` half is `disabled` and `aria-disabled='true'`.
  - Interacting with `Media` does nothing.
  - If `media` was on and `hasMedia` flips to `false`, the system turns `media` off.
- The `Text` half is always available.

---

## Implementation route

1. Create `TokenizeControls` as a custom split-capsule component (two `button` halves + divider inside an outlined pill).
2. Update `UniversalPanelHeader` to render `TokenizeControls` and pass `hasMedia`.
3. Pipe `hasMedia` from page detection logic (`document.querySelector('video')` in mount functions).
4. Update `UniversalPanel` props and the design-system showcase page.
5. Update `UniversalPanel.test.tsx` expectations.
6. Run `npm run typecheck`, `npm run test:unit`, and `npm run build` before merging.
