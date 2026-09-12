# Implementation Plan: Liquid-Glass Button System

> Intent: `docs/intent/liquid-glass-buttons.md`  
> Spec: `docs/specs/liquid-glass-buttons.md`

## Overview

Deliver one themed liquid-glass material for shared `Button`, shared `IconButton`, and subtitle-overlay action controls. Work proceeds through a blocking V4 visual-approval checkpoint, then shared component/token implementation, then subtitle migration and real-browser verification.

## Architecture decisions

1. **V4 is the visual contract.** Exact optical values are not promoted until human approval.
2. **Shared component owns material.** Feature CSS owns layout and approved context geometry only.
3. **Three contexts, one optical model.** Light, dark and protected-overlay modes share layers but differ in surface/foreground values.
4. **Variants are visually neutral.** Existing variant API remains for compatibility and semantics.
5. **Static material.** No idle drift, hover lift or animated blur.
6. **Geometry is explicit.** IconButton circle; horizontal Button capsule; vertical/full-width radius zero.
7. **Semantic HTML remains semantic.** Tabs migrate to Tabs; listbox/radio controls do not become glass action buttons.

## Dependency graph

```text
Baseline tests and audit
          ↓
V4 material + state + geometry prototype
          ↓
Human visual approval (blocking)
          ↓
Token contract
     ┌────┴────┐
     ↓         ↓
 Shared Button  Shared IconButton
     └────┬────┘
          ↓
Subtitle native-action/Tabs migration
          ↓
Overlay CSS ownership cleanup
          ↓
Shadow-DOM + browser + performance verification
          ↓
Architecture/docs sync
```

## Phase 0 — Baseline and guards

### Task 1: Capture shared component and overlay baseline

Inventory current APIs, computed geometry, tests, Shadow DOM CSS injection and broad overlay overrides. Add no visual behavior yet.

**AC**
- Existing Button/IconButton props and variant matrix documented in tests.
- All subtitle native action/tab selectors and `data-cell-id` hooks listed.
- Overlay selectors that own material are identified.

**Verify**
- Targeted Button/IconButton/subtitle tests pass before changes.

**Files likely touched**
- `src/shared/ui/Button.test.tsx`
- `src/shared/ui/IconButton.test.tsx`
- Subtitle tests only where baseline coverage is missing

**Scope:** M (3–5 files)

### Task 2: Add deterministic style-contract guards

Add the smallest deterministic checks for prohibited idle animation/lift, geometry class application and overlay material ownership.

**AC**
- Tests fail against current idle drift/hover lift or missing geometry contract.
- Guards do not assert exact visual pixel values.
- Broad overlay background ownership has a grep/static guard or explicit test.

**Verify**
- Demonstrate RED state before implementation.

**Dependencies:** Task 1

**Scope:** S (1–2 test files)

## Phase 1 — V4 visual contract

### Task 3: Build V4 geometry matrix

Add explicit examples for IconButton circles, horizontal capsules, vertical square buttons and full-width square buttons across sizes.

**AC**
- Computed geometry matches spec.
- No content clipping at 320–1280px.
- Existing V4 edge-case rows remain intact.

**Verify**
- DevTools computed styles at representative viewports.

**Files**
- `src/entrypoints/design-system-showcase/mockups/liquid-glass-dewdrop-v4.html`

**Dependencies:** Task 2

**Scope:** S

### Task 4: Calibrate themed optical material in V4

Implement light, dark and protected-overlay examples using local prototype variables only.

**AC**
- Neutral material across all variants.
- No solid semantic color, idle animation, lift or animated blur.
- Readable on white, black, gradient, checkerboard and three photos.

**Verify**
- Chrome/Edge runtime inspection and human review.

**Files**
- V4 mockup only

**Dependencies:** Task 3

**Scope:** S

### Checkpoint A — Human visual approval (blocking)

- Geometry approved.
- Light/dark/overlay material approved.
- Radius-zero vertical/full-width examples approved.
- Edge-case readability approved.
- Exact optical values frozen for token promotion.

No production files change before this checkpoint.

## Phase 2 — Token and shared component foundation

### Task 5: Promote approved optical values into token SSOT

Add/refactor component tokens in `tokens.json`; regenerate artifacts through build hooks.

**AC**
- Light/dark values are generated from SSOT.
- Protected overlay final component tokens can be overridden at inheritance scope.
- No raw material values in Button/IconButton CSS.

**Verify**
- Token generation diff is deterministic.
- Build succeeds.

**Files**
- `src/shared/styles/tokens.json`
- Generated files via scripts

**Dependencies:** Checkpoint A

**Scope:** S

### Task 6: Implement shared Button material and geometry

Remove idle drift/lift/semantic fills while preserving public API and behavior.

**AC**
- Horizontal capsule; vertical/full-width radius zero.
- Variants share neutral themed material.
- Loading/disabled/active/error/ripple API remains compatible.
- Ripple concurrent-node guard added if required by RED test.

**Verify**
- Button unit tests, showcase, reduced-motion/transparency checks.

**Files**
- `Button.tsx`
- `Button.module.css`
- `Button.test.tsx`
- `Button.showcase.tsx`

**Dependencies:** Task 5

**Scope:** M

### Task 7: Implement shared IconButton liquid material

Add the same optical system with circular geometry while preserving variants and sizes.

**AC**
- All sizes remain square and circular.
- Existing active/danger semantics and loading behavior remain functional without colored material.
- Focus/touch-target requirements pass.

**Verify**
- IconButton tests and showcase/browser checks.

**Files**
- `IconButton.tsx` only if API needs no change; otherwise ask first
- `IconButton.module.css`
- `IconButton.test.tsx`
- Showcase file if one exists

**Dependencies:** Task 5

**Scope:** M

### Checkpoint B — Shared UI

- Typecheck, unit tests, lint and build pass.
- Existing 254 shared call sites compile.
- Light/dark showcase verified.
- No infinite animation or hover lift remains.

## Phase 3 — Subtitle semantic normalization

### Task 8: Migrate SubtitleSearch actions and tabs

Replace API-key hint with Button and raw Target/Native tabs with controlled Tabs while preserving count badges and hooks.

**AC**
- Add key/Hide behavior and `aria-expanded` unchanged.
- Tab selection/filtering/count badge unchanged.
- Search-result listbox option remains native and non-glass.

**Verify**
- SubtitleSearchPanel tests and keyboard tab behavior.

**Files**
- `SubtitleSearchPanel.tsx`
- `SubtitleSearchPanel.module.css`
- `SubtitleSearchPanel.test.tsx`

**Dependencies:** Checkpoint B

**Scope:** M

### Task 9: Migrate SubtitleManager action buttons

Replace latency decrement/increment with Button and header back with IconButton.

**AC**
- Offset math, debounce/save, focus order and ref behavior unchanged.
- Pill-group geometry remains intact despite shared component material.
- Track Off listbox option remains native and non-glass.

**Verify**
- SubtitleManagerPanel tests including ref/focus and offset actions.

**Files**
- `SubtitleManagerPanel.tsx`
- `SubtitleManagerPanel.module.css`
- `SubtitleManagerPanel.test.tsx`

**Dependencies:** Checkpoint B

**Scope:** M

### Task 10: Migrate NavCluster appearance preset pills

Use shared Button for preset actions while preserving `aria-pressed` and layout.

**AC**
- Preset selection behavior unchanged.
- Segmented alignment/shadow radios remain native.
- Active state uses neutral optical change, not semantic color.

**Verify**
- Appearance/preset tests and responsive wrap.

**Files**
- `appearance/NavClusterSettingsPanel.tsx`
- `.module.css`
- relevant tests

**Dependencies:** Checkpoint B

**Scope:** S

## Phase 4 — Overlay ownership and protected material

### Task 11: Separate NavCluster geometry from material

Replace broad material overrides with explicit geometry classes or final component-token overrides.

**AC**
- User-configurable cluster size/icon/text opacity remains functional.
- Shared IconButton owns background/highlight/shadow.
- No broad selector sets material on all descendant buttons.

**Verify**
- NavCluster tests and computed styles in real overlay.

**Files**
- `NavCluster.tsx`
- `NavCluster.module.css`
- `NavCluster.test.tsx`

**Dependencies:** Task 7

**Scope:** M

### Task 12: Separate Right Toolbar geometry from material

Apply the same ownership contract to ClusterRightToolbar, Player Mode and OverlayPreview.

**AC**
- Toolbar expansion, placement and icons unchanged.
- Protected dark-overlay tokens inherit in all overlay render paths.
- Preview matches production component material.

**Verify**
- ClusterRightToolbar/PlayerMode/OverlayPreview tests and computed styles.

**Files**
- `ClusterRightToolbar.tsx`
- `subtitlePanelsShared.module.css`
- `PlayerModeOverlay.module.css` only if required
- `appearance/OverlayPreview.module.css` only if required
- relevant tests

**Dependencies:** Tasks 7 and 11

**Scope:** M; split if >5 files after inspection

### Checkpoint C — Subtitle overlay

- All confirmed action migrations pass.
- Semantic list/radio controls remain non-glass.
- NavCluster and Right Toolbar show shared protected material.
- Touch geometry and user settings remain unchanged.

## Phase 5 — Verification and documentation

### Task 13: Cross-context browser and performance verification

Verify popup/showcase and real subtitle overlay on bright/dark/moving video.

**AC**
- Chrome and Edge pass.
- Light, dark and protected overlay pass contrast/focus checks.
- No console errors or sustained frame degradation.
- Reduced motion/transparency fallback works.

**Verify**
- DevTools computed styles and performance trace.
- Required project quality commands.

**Dependencies:** Checkpoint C

**Scope:** M

### Task 14: Sync architecture and decision documentation

Record final material decision and update architecture indexes after source changes.

**AC**
- `docs/2-architechture-system.md` reflects modified shared/subtitle files.
- ADR-092 relationship is explicit: retained purity principles vs superseded implementation details.
- `docs/0-wiki.md` links final docs.

**Verify**
- Links and paths resolve; build remains clean.

**Dependencies:** Task 13

**Scope:** S

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Radius-zero vertical/footer buttons fail visually | High | Blocking V4 approval before production |
| Neutral destructive semantics become ambiguous | High | Explicit label/icon/confirmation and flow review |
| Broad overlay CSS wins cascade | High | Explicit ownership guard + computed-style verification |
| Blur hurts moving video | High | No animated blur, performance trace, reduced-transparency fallback |
| Tabs migration regresses focus | Medium | Controlled Tabs tests and keyboard verification |
| Scoped token alias fails in Shadow DOM | Medium | Override final component tokens at actual inheritance boundary |

## Parallelization

- Tasks 6 and 7 may run in parallel after Task 5, but must not edit the same showcase/test file.
- Tasks 8, 9 and 10 may run in parallel after Checkpoint B.
- Tasks 11 and 12 are sequential because they share overlay material ownership.
- Browser verification begins only after Checkpoint C.

## Approval gates

1. Intent confirmed: complete.
2. Spec/plan review: required before implementation.
3. V4 visual approval: required before production token/component changes.
4. Shared UI checkpoint: required before subtitle migration.
