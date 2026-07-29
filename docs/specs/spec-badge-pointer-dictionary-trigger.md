# Spec: Orbital Badge Dictionary Trigger

## Objective

Add an alternate dictionary lookup trigger for small screens (mobile/tablet) and fullscreen video where precise text selection is awkward. A floating badge rests at the right edge as a crescent; dragging it out expands it into a circle (the "sun"). A smaller pointer (the "moon") orbits the badge and points at the word to look up.

## User Stories

- As a tablet user reading a web article, I want to look up words with one hand without tiny text selection.
- As a mobile user watching a fullscreen video with subtitles, I want a one-handed lookup trigger that works over the video.
- As a desktop user, I want an optional trigger mode I can enable if I prefer it over click/hover.

## Commands

```bash
# Build / typecheck / test
npm run build
npx tsc --noEmit
npm run test:unit

# Dev server (regenerates tokens.css via predev hook)
npm run dev

# If tokens.json is changed
node scripts/generate-tokens.js
```

## Project Structure

### New files

```
src/features/dictionaryPopup/badgePointer/
├── mountOrbitalBadge.ts        # Shadow DOM host + React mount + fullscreen re-parenting
├── useOrbitalPointer.ts        # Geometry: badge center → pointer preset + tip
├── useOrbitalSnap.ts           # Geometry: nearest viewport edge + collapsed/expanded centers
├── useOrbitalGesture.ts        # Pointer gesture hook: drag, double/triple tap
├── pointerPosition.ts          # Angle → preset + preset offsets
├── pointerPosition.test.ts     # jsdom unit tests
├── gestureDetector.ts          # Double/triple tap state machine
├── gestureDetector.test.ts     # jsdom unit tests
└── resolveWordAtTip.ts         # Resolve text word under the pointer tip

src/features/dictionaryPopup/ui/
├── OrbitalBadge.tsx            # React component: drag, snap, tap, preset cycling
├── OrbitalBadge.module.css     # Shadow DOM scoped styles
├── OrbitalBadge.test.tsx       # React component tests
└── mountOrbitalBadge.test.ts   # Shadow DOM mount lifecycle tests
```

### Modified files

```
src/entities/settings/types.ts                          # Extend DictionaryPopupSettings
src/shared/config/config.ts                             # Default values
src/shared/lib/storage/settingsStore.ts                 # v15 → v16 → v17 → v18 migrations
src/features/settings/ui/DictionaryPopupSettingsPanel.tsx  # Pointer position select + size slider
src/features/dictionaryPopup/controller/webTextDictionaryController.ts  # Badge lifecycle + lookup wiring
src/entrypoints/content/content-script.ts               # Mount badge when popup enabled
src/stores/orbitalBadgeStore.ts                         # Persist badge position + preset
docs/2-architechture-system.md                          # Update tree + index
docs/adr/055-orbital-dictionary-pointer.md              # Architecture decision
```

## Code Style

- **Named exports**: `export function mountOrbitalBadge(options)` and `export function OrbitalBadge(props, ref)`.
- **Pure geometry/gesture logic** in `pointerPosition.ts`, `gestureDetector.ts`, `useOrbitalPointer.ts`, `useOrbitalSnap.ts`; DOM side effects live in `mountOrbitalBadge` and `OrbitalBadge` event handlers.
- **No explicit `any`**: ESLint enforces this.
- **CSS classes**: BEM with `cell-orbital-*` prefix inside the Shadow DOM.
- **JS hooks**: `.js-cell-orbital-badge` and `.js-cell-orbital-badge-host` on the host for external queries.
- **Tokens**: use `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--duration-*)`.
- **Shadow DOM theme**: inject `tokens.css` with `:root` replaced by `:host`, set `data-theme` on the host element.
- **Always on top**: badge host and pointer use the maximum valid CSS `z-index` (`2147483647`) so they render above all page layers, including fullscreen overlays and the tokenize FAB.

## Testing Strategy

- **Unit tests (jsdom)**:
  - `gestureDetector`: double vs triple tap, timeout windows, reset behavior.
  - `pointerPosition`: angle-to-preset mapping, preset offsets for top/left/right/bottom/center.
  - `useOrbitalPointer` / `useOrbitalSnap`: pointer tip and snap edge computation.
  - `useOrbitalGesture`: tap/drag callbacks invoke the latest `onDoubleTap`/`onTripleTap` references (no stale closures).
  - `OrbitalBadge`: single tap, drag snap, double/triple tap preset cycling, `onTipReady`/`onTipMoving` callbacks.
  - `mountOrbitalBadge`: shadow DOM host creation, fullscreen re-parenting, destroy.
- **Integration (content-script init)**:
  - Verify badge mounts when `dictionaryPopup.enabled` is true and `mountOrbitalBadge` is wired from `WebTextDictionaryController`.
- **Manual tests**:
  - Chrome/Edge mobile emulation on a text article.
  - Fullscreen YouTube/Netflix subtitle overlay.

## Boundaries

- **Always do**:
  - Use the shared design system tokens and components.
  - Update `docs/2-architechture-system.md` when new files are added.
  - Write/update unit tests for pure logic.
  - Named exports only.
- **Ask first**:
  - Adding a new npm dependency.
  - Changing `manifest.json`.
  - Bumping settings schema version (this spec introduced v16, later advanced to v17/v18 — documented in `settingsStore.ts` migrations).
- **Never do**:
  - Inline SVG without going through `ICON_CATALOG`.
  - Default exports for new modules.
  - Commit secrets or hardcoded credentials.
  - Rewrite the popup dictionary core; only wire into `WebTextDictionaryController`.

## Success Criteria

- [ ] Orbital badge pointer settings (position, size) appear in the Dictionary Popup settings panel whenever the popup is enabled; the badge itself is active whenever `dictionaryPopup.enabled` is true.
- [ ] Badge rests at the right edge as a crescent when collapsed; it can be dragged to any edge.
- [ ] Dragging the badge expands it into a full circle.
- [ ] On expand, the pointer restores the last user-selected preset; when collapsed against an edge it temporarily points inward from that edge.
- [ ] Double tap on the expanded badge cycles the pointer preset forward through the preset ring.
- [ ] Triple tap on the expanded badge cycles the pointer preset backward through the preset ring.
- [ ] When the pointer tip touches text, the word is looked up and the popup + highlight appear.
- [ ] Badge + pointer render above all page layers, including fullscreen video and the tokenize FAB (`z-index: 2147483647`).
- [ ] Works in fullscreen video context (YouTube/Netflix).
- [ ] Last selected pointer preset and badge position persist across reloads.
- [ ] Badge size is configurable (10–200 px) and the pointer scales with the badge.
- [ ] The pointer orbits just outside the badge edge with a small visible gap.
- [ ] `npx tsc --noEmit` clean, `npm run test:unit` pass, `npm run build` success.

## Open Questions

1. **Center preset hit-test**: when the pointer is at the badge center, the badge itself may block `document.elementFromPoint`. Because the badge is always on top (`z-index: 2147483647`), the lookup routine must temporarily disable pointer events on the badge host for one frame, call `document.elementFromPoint`/`elementsFromPoint`, then restore. → **Resolved**: use `elementsFromPoint`, skip elements inside `.js-cell-orbital-badge`, and take the first non-badge element.
2. **Animation duration**: 200ms for expand/snap? 150ms? → **Recommended**: 200ms.
3. **Pointer offset distance from badge center**: must keep the pointer visually outside the badge. → **Resolved**: offset = badge_radius + pointer_radius + 4px gap; pointer size scales with badge size via `pointerScale`.
