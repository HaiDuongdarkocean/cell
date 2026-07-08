# Content-script DOM Factories — Cell Extension

> Location: `src/features/subtitle/ui/`
> Content-script runs in isolated world, NO React. All UI = DOM factories returning `HTMLElement`. Mimic pattern when adding new content-script UI.

## Inventory

| Factory | File | Output | Status | Since | a11y | Used in |
|---|---|---|---|---|---|---|
| `createToggleButton` | `subtitlePanel.ts` | HTMLButtonElement | stable | 1.0.0 | aria-label, aria-pressed | Overlay toggle |
| `createOverlayLayer` | `subtitleUI.ts` | HTMLDivElement | stable | 1.0.0 | role=slider, aria-valuenow/min/max, aria-orientation, aria-label | Subtitle overlay (target + native) |
| `createDragHandle` | `subtitleDragPosition.ts` | HTMLButtonElement | stable | 1.1.0 | aria-label | Overlay drag handle |
| `createDragHint` | `subtitleUI.ts` | HTMLDivElement | stable | 1.1.0 | aria-hidden | Drag hint visual |
| `createSubtitleDropdown` | `subtitleSelector.ts` | HTMLButtonElement + listbox | stable | 1.1.0 | aria-haspopup=listbox, aria-expanded, aria-selected | Target/native subtitle selector |
| `createTrackDropdown` | `subtitleTrackDropdown.ts` | HTMLSelectElement | stable | 1.0.0 | native select | Track selection |
| `createSubtitleManagerPanel` | `subtitleManagerPanel.ts` | HTMLDivElement (panel + icon) | stable | 1.1.0 | aria-label, aria-expanded, aria-selected, aria-hidden on icons | Manager panel |
| `createNavClusterButton` | `navClusterButton.ts` | HTMLButtonElement | stable | 1.2.0 | aria-label, aria-pressed (toggle) | Nav cluster buttons |
| `createInitialKeyboardState` | `navClusterKeyboard.ts` | NavClusterKeyboardState | stable | 1.2.0 | — (pure state) | Keyboard state machine |

---

## Usage guide — do/don't + code examples

| Do | Don't |
|---|---|
| Return `HTMLElement` from factory — caller appends to DOM | Return HTML string + `innerHTML` — loses event listener binding |
| Set ARIA attributes inside factory (aria-label, aria-pressed, role) | Set ARIA after append in caller — factory contract incomplete, drift risk |
| Use `themeTokens.ts` for colors (mirror, ADR-015 T12) | Use `var(--color-*)` directly — unresolved in isolated world |
| Follow `init → update → destroy` lifecycle (controllers) | Create-and-forget — leaks listeners across SPA navigations |

```ts
// Factory — returns configured element
const toggleBtn = createToggleButton({
  label: 'Toggle subtitle overlay',
  pressed: false,
  onToggle: (next) => settingsStore.setOverlayEnabled(next),
});
container.appendChild(toggleBtn);

// Controller — lifecycle managed
const cluster = new NavClusterController({ container, settings, cues });
await cluster.init();
// ... on settings change:
cluster.updateSettings(nextSettings);
// ... on teardown:
cluster.destroy();
```
