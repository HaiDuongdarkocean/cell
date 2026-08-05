# Implementation Plan: Player Mode Prototype

## Objective

Build a toggleable Player Mode for the Cell subtitle overlay. It must work on every viewport, with the first visual target at 320–480px. The mode is a fixed overlay that keeps the website's native subtitle on the video while moving Cell's `SubtitleBlock` and `NavCluster` into a bottom Player Action Dock. The existing Dictionary popup opens as a resizable sheet above the dock and may cover the video, but must never cover the dock itself.

## Confirmed product decisions

- Toggle button occupies the current `data-cell-id="generate-native-btn"` slot.
- `generate-native-btn` moves into `tools-toggle-btn` → `.extraCol`.
- Toggle is available on every viewport and toggles Player Mode on/off.
- Website/native caption remains on the video.
- Cell `SubtitleBlock` also renders in the Player Action Dock at the same time.
- The original `NavCluster` behavior remains available; only its Player Mode layout changes.
- `content khác` is intentionally empty in V1 and is the sheet's expansion area.
- Dictionary uses the existing `Dictionary`/popup behavior rather than a duplicate lookup implementation.
- Dictionary sheet can resize vertically and can cover the video, but reserves the bottom Player Action Dock.
- Player Mode may temporarily reposition/resize the detected host player container to the top of the viewport, preserving intrinsic aspect ratio and restoring every captured inline style/value on exit.

## Proposed component structure

```text
PlayerModeOverlay
├── VideoStage                  # transparent/visual stage over host video
├── ContentOther                # empty V1 expansion region
├── DictionarySheet (optional)  # resizable, above dock, above video when expanded
└── PlayerActionDock
    ├── SubtitleBlock           # Cell target + native
    ├── NavCluster              # existing two-column controls, moved into dock
    └── ToolActions             # existing low-frequency action cluster, preserved in dock
```

## Behavior

1. Player Mode off: preserve current subtitle overlay behavior.
2. Player Mode on: mount a fixed full-viewport layout, keep host video visible above, render Cell subtitle and controls in the dock.
3. Player Mode button toggles the mode and exposes `aria-pressed`.
4. Dictionary lookup opens the existing dictionary sheet from the dock; the dock remains visible and interactive.
5. Dragging the sheet handle changes height within min/max bounds using Pointer Events and `touch-action: none`.
6. Escape closes Dictionary first; a second Escape exits Player Mode if no modal sheet is open.
7. Resize/orientation changes preserve mode and clamp sheet height to the current viewport.
8. `prefers-reduced-motion` disables slide/resize transitions.
9. No subtitle: preserve current time-mode fallback and render an accessible empty subtitle state.

## Layout rules

- Root uses `position: fixed`, `inset: 0`, `100dvh`, and a shared overlay container.
- Video keeps its intrinsic aspect ratio; Player Mode temporarily top-aligns the detected host player/video and restores it exactly when off.
- Player Action Dock is fixed/anchored at the bottom and includes safe-area padding.
- Dictionary sheet is anchored immediately above the dock, with a maximum height that leaves the dock visible.
- Mobile touch targets use the existing design-system minimums; no hardcoded colors or new button state CSS.
- Existing icons are reused first (`pip`, `captions`, `panel-bottom-close`, `resize`); no new icon is required for the first prototype.

## Testing strategy

- Pure layout/state helpers: unit tests for mode toggling, sheet-height clamping, and viewport/dock geometry.
- Component tests: Player Mode button placement, simultaneous website-caption contract (represented by the host layer) + Cell SubtitleBlock, dock persistence while Dictionary is open, and accessible labels/state.
- Existing subtitle and dictionary tests must remain green.
- Browser verification: rebuild, launch the extension with `testing-extension-browser`, then inspect at 320px, 480px, tablet, and desktop widths using stealth Chrome DevTools.

## Commands

```bash
npm run typecheck
npm run test:unit
npm run build
npx vite build --mode development
```

## Boundaries

- Always: reuse existing `SubtitleBlock`, `NavCluster`, `Dictionary`, `IconButton`, and design tokens; preserve keyboard and touch accessibility; restore host styles on exit.
- Ask first: adding a dependency, changing manifest permissions, changing host video behavior, or changing the dictionary data contract. Host video repositioning is now explicitly approved for Player Mode.
- Never: inline SVG in a component, hardcode token values, hide the dock behind Dictionary, or remove existing subtitle actions.

## Success criteria

- [ ] The Player Mode toggle is present at the old generate-native slot and toggles on every viewport.
- [ ] Generate-native is still reachable from the expanded tools area.
- [ ] Host caption and Cell SubtitleBlock can render simultaneously without either being removed by Player Mode.
- [ ] `overlay-player-action` contains SubtitleBlock, the original two-column NavCluster, and the existing action cluster.
- [ ] Dictionary opens above the dock, resizes with touch/mouse, can cover video, and never covers the dock.
- [ ] All existing NavCluster/tool actions remain reachable and behave unchanged.
- [ ] Layout works at 320px, 480px, tablet, and desktop widths.
- [ ] Unit/component tests, production build, development build, and real-browser verification pass.

## Open questions

None for the V1 prototype. The website subtitle is treated as host-owned content; Cell renders its own SubtitleBlock in the dock simultaneously. Host player repositioning is explicitly approved and must be reversible.
