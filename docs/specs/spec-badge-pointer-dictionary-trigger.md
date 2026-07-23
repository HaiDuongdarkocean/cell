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
├── createOrbitalBadge.ts       # Factory + controller: DOM, drag, tap, lookup wiring
├── createOrbitalBadge.test.ts  # jsdom unit tests
├── orbitalBadgeCss.ts          # Shadow DOM CSS (uses design tokens)
├── gestureDetector.ts          # Double/triple tap state machine
├── gestureDetector.test.ts     # jsdom unit tests
├── pointerPosition.ts          # Angle → preset + preset offsets
├── pointerPosition.test.ts     # jsdom unit tests
└── index.ts                    # Barrel exports
```

### Modified files

```
src/entities/settings/types.ts                          # Extend DictionaryPopupSettings
src/shared/config/config.ts                             # Default values
src/shared/lib/storage/settingsStore.ts                 # v15 → v16 migration
src/features/settings/ui/DictionaryPopupSettingsPanel.tsx  # UI toggle + preset select
src/entrypoints/content/content-script.ts               # Init orbital badge controller
docs/2-architechture-system.md                          # Update tree + index
docs/adr/055-orbital-badge-dictionary-trigger.md        # Architecture decision
```

## Code Style

- **Named exports**: `export function createOrbitalBadge(options)`.
- **Pure geometry/gesture logic** in `pointerPosition.ts` and `gestureDetector.ts`; DOM side effects live in `createOrbitalBadge`.
- **No explicit `any`**: ESLint enforces this.
- **CSS classes**: BEM with `cell-orbital-*` prefix inside the Shadow DOM.
- **JS hooks**: `.js-cell-orbital-badge` on the host for external queries.
- **Tokens**: use `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--duration-*)`.
- **Shadow DOM theme**: inject `tokens.css` with `:root` replaced by `:host`, set `data-theme` on the panel element.
- **Always on top**: badge host and pointer use the maximum valid CSS `z-index` (`2147483647`) so they render above all page layers, including fullscreen overlays and the tokenize FAB.

## Testing Strategy

- **Unit tests (jsdom)**:
  - `gestureDetector`: double vs triple tap, timeout windows, reset behavior.
  - `pointerPosition`: angle-to-preset mapping, preset offsets for top/left/right/center.
  - `createOrbitalBadge`: drag expands/collapses badge, tap cycles preset, lookup callback fires at pointer tip.
- **Integration (content-script init)**:
  - Verify controller attaches when `badgePointerTrigger.enabled` is true and detaches on settings change.
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
  - Bumping settings schema version (this spec does bump to v16 — documented).
- **Never do**:
  - Inline SVG without going through `ICON_CATALOG`.
  - Default exports for new modules.
  - Commit secrets or hardcoded credentials.
  - Rewrite the popup dictionary core; only wire into `WebTextDictionaryController`.

## Success Criteria

- [ ] `'orbital'` appears as a mutually-exclusive trigger mode in the Dictionary Popup trigger mode dropdown (not a separate toggle).
- [ ] Badge rests at the right edge as a crescent when collapsed.
- [ ] Dragging the badge expands it into a full circle.
- [ ] On expand, the pointer first faces the viewport center, then animates to the nearest preset.
- [ ] Double tap on the expanded badge toggles pointer between `top` and `center`.
- [ ] Triple tap on the expanded badge toggles pointer between `left` and `right`.
- [ ] When the pointer tip touches text, the word is looked up and the popup + highlight appear.
- [ ] Badge + pointer render above all page layers, including fullscreen video and the tokenize FAB (`z-index: 2147483647`).
- [ ] Works in fullscreen video context (YouTube/Netflix).
- [ ] Last selected pointer preset persists across reloads.
- [ ] Badge size is configurable (24–96 px) and the pointer scales with the badge.
- [ ] The pointer orbits just outside the badge edge with a small visible gap.
- [ ] `npx tsc --noEmit` clean, `npm run test:unit` pass, `npm run build` success.

## Open Questions

1. **Center preset hit-test**: when the pointer is at the badge center, the badge itself may block `document.elementFromPoint`. Because the badge is always on top (`z-index: 2147483647`), the lookup routine must temporarily disable pointer events on the badge host for one frame, call `document.elementFromPoint`/`elementsFromPoint`, then restore. → **Resolved**: use `elementsFromPoint`, skip elements inside `.js-cell-orbital-badge`, and take the first non-badge element.
2. **Animation duration**: 200ms for expand/snap? 150ms? → **Recommended**: 200ms.
3. **Pointer offset distance from badge center**: must keep the pointer visually outside the badge. → **Resolved**: offset = badge_radius + pointer_radius + 4px gap; pointer size scales with badge size via `pointerScale`.
