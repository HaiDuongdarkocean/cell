# Frontend UI Engineering — Subtitle Navigation Control Cluster

> **Phase**: G3 Design (`frontend-ui-engineering` — runs AFTER `design-system-ui-ux`)
> **Feature**: Subtitle Navigation Control Cluster
> **Spec**: `docs/specs/spec-subtitle-navigation-control.md`
> **ADR**: `docs/adr/018-subtitle-navigation-control-cluster.md`
> **Design system**: `docs/reviews/design-system-inventory-2026-07-02-nav-cluster.md`
> **Runtime**: Content-script isolated world (DOM factories, NOT React)

## Overview

Cluster là **vanilla DOM UI** injected vào `video.parentElement` (content-script isolated world, không React). Build HOW: ARIA toolbar semantics, responsive touch target (44/56px), Pointer Events state machine (drag + repeat hold), keyboard parallel shortcuts, focus management, dark/light theme via tokens.

## Constraints (codebase-driven)

- **No React in content-script**: existing pattern = DOM factories (`createToggleButton`, `createOverlayLayer`, `createSubtitleManagerPanel`). Cluster mimics.
- **No CSS modules in content-script**: tokens injected via `themeTokens.ts` (ADR-015 T12). Cluster CSS = inline `<style>` block or `element.style` + CSS classes via `setAttribute('class', ...)`.
- **z-index 1000001** (above subtitle overlay 999999, below browser native controls).
- **Touch target**: ≥44px desktop, ≥56px touch (WCAG 2.5.5) — via `--nav-cluster-size-sm/md/lg` tokens.
- **Pointer Events** (not Mouse + Touch separately) — ADR-015 pattern.

## Component Architecture

### DOM tree

```
<div data-testid="nav-cluster" role="toolbar" aria-label="Subtitle navigation"
     class="nav-cluster {no-sub} {collapsed} {mirror-left|mirror-right}"
     style="position: absolute; left: {x}%; top: {y}%; z-index: 1000001;">
  <div data-testid="nav-cluster-main" class="nav-cluster-main">
    <button data-testid="nav-cluster-drag-handle" class="nav-cluster-btn nav-cluster-drag-handle"
            aria-label="Drag to move cluster" aria-grabbed="false">⋯</button>
    <button data-testid="nav-cluster-prev" class="nav-cluster-btn"
            aria-label="Previous sentence">◀</button>
    <button data-testid="nav-cluster-repeat" class="nav-cluster-btn"
            aria-label="Repeat current sentence" aria-pressed="false">🔁</button>
    <button data-testid="nav-cluster-next" class="nav-cluster-btn"
            aria-label="Next sentence">▶</button>
  </div>
  <div data-testid="nav-cluster-secondary" class="nav-cluster-secondary">
    <button data-testid="nav-cluster-rewind" class="nav-cluster-btn"
            aria-label="Rewind 5 seconds">⏪</button>
    <button data-testid="nav-cluster-forward" class="nav-cluster-btn"
            aria-label="Forward 10 seconds">⏩</button>
  </div>
</div>
```

### Collapsed DOM (same root, class toggle)

```
<div data-testid="nav-cluster" class="nav-cluster collapsed mirror-left"
     style="width: 32px; height: 32px; border-radius: 50% 0 0 50%;">
  <!-- main + secondary hidden via CSS .collapsed > * { display: none; } -->
  <!-- tap target = root itself -->
</div>
```

### File structure (colocated in `features/subtitle/ui/`)

```
src/features/subtitle/ui/
├── navClusterController.ts        # Controller class (init/updateCues/updateSettings/destroy)
├── navClusterButton.ts            # Atom: createNavClusterButton (DOM factory)
├── navClusterDom.ts               # Pure: buildClusterDOM, clampPosition, findNearestEdge
├── navClusterActions.ts           # Pure: prevSentence, nextSentence, repeatHold, seekBy
├── navClusterKeyboard.ts          # Pure: handleClusterKeydown, handleClusterKeyup (state machine)
└── navCluster.css.ts              # CSS string (injected as <style> by controller)
```

**Why split**: Controller ≤200 lines (frontend-ui-engineering red flag: components >200 lines → split). Pure helpers testable in isolation. Mimics existing `subtitlePanel.ts` + `subtitleShortcuts.ts` split.

## State Management

### Controller state (private fields)

```typescript
class NavClusterController {
  private cluster: HTMLDivElement | null = null;
  private settings: NavClusterSettings;
  private cueSource: NavClusterCueSource;
  private repeatHolding = false;
  private repeatRafId: number | null = null;
  private dragStart: { px: number; py: number; pos: NavClusterPosition } | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  // Listeners (stored for destroy)
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private onBlurCancel: (() => void) | null = null;
  private onVisibilityCancel: (() => void) | null = null;
  private onFullscreenChange: (() => void) | null = null;
  private timeupdateHandler: (() => void) | null = null;
}
```

### Repeat hold state machine

```
IDLE
  │ pointerdown on 🔁 (or keydown R, not e.repeat)
  ├─ start timer (500ms)
  │
  ├─ if pointerup/keyup before 500ms → CANCEL → IDLE (no-op)
  │
  └─ timer fires (≥500ms) → LOOPING
      │
      │ timeupdate: if currentTime ≥ cue.end/1000 → seek cue.start/1000
      │             if no-sub: if currentTime ≥ holdStart → seek (holdStart - 3s)
      │
      └─ pointerup/keyup/pointercancel/blur/visibilitychange(hidden) → STOP → IDLE
                                                              │
                                                              └─ video continues from current position
```

**aria-pressed**: `false` (IDLE) → `true` (LOOPING). Icon state via CSS class `nav-cluster-btn--active`.

### Drag state machine

```
IDLE (cursor: grab)
  │ pointerdown on ⋯ (e.target === dragHandle)
  ├─ setPointerCapture(e.pointerId)
  │  cursor: grabbing
  │  dragStart = { px, py, pos: current }
  │
  │ pointermove:
  │  dx = e.clientX - dragStart.px
  │  dy = e.clientY - dragStart.py
  │  newPos = clamp(dragStart.pos + delta%, 0, 100 - clusterSize%)
  │  applyPosition(newPos)
  │  if distance to nearest edge ≤ 20px → collapseToNearestEdge()
  │
  └─ pointerup / pointercancel / lostpointercapture → DROP
      releasePointerCapture(e.pointerId)
      cursor: grab
      persistPositionDebounced(300ms)
      dragStart = null
```

### Double-click reset

```
⋯ dblclick → position = { x: 0, y: 75 } → applyPosition → persistPositionDebounced
```

**Note**: `dblclick` fires after 2 `click` events — drag handler must not conflict. Drag uses `pointerdown`/`pointerup`, double-click uses `dblclick` (separate event). No conflict.

## Accessibility (WCAG 2.1 AA)

### ARIA toolbar semantics

- Root `role="toolbar"` + `aria-label="Subtitle navigation"` + `aria-orientation="horizontal"`.
- Each button: `aria-label` (visible text is glyph, screen reader needs label).
- 🔁 repeat: `aria-pressed="false|true"` (toggle state).
- ⋯ drag handle: `aria-grabbed="false|true"` + `aria-label="Drag to move cluster, double-click to reset"`.
- Tab order: cluster root `tabindex={0}`? No — buttons are focusable by default. Toolbar root NOT focusable (buttons inside are).

### Keyboard navigation

- **Tab**: moves focus between buttons (default browser behavior, no custom tab trap).
- **ArrowLeft/ArrowRight**: cluster shortcuts (prev/next sentence) — NOT toolbar arrow nav (conflict). Toolbar arrow nav skipped to avoid hijacking user expectation.
- **Enter/Space on ⋯**: trigger drag? No — drag is pointer-only. Enter/Space on ⋯ = no-op (or focus move). Document in `aria-label`: "Drag to move (mouse/touch only)".
- **Enter/Space on 🔁**: toggle repeat hold? Hold semantics ≠ toggle. Enter/Space on 🔁 = single replay (seek to cue start), NOT hold loop. Hold loop = pointer/keyboard-R only.

### Focus management

- Cluster created → no auto-focus (don't steal focus from video).
- Off toggle → cluster `setVisible(false)` → if focus was on cluster button, move focus to `<body>` (avoid focus trap on hidden element).
- Collapse → if focus was on hidden button, move focus to cluster root.

### Contrast

- Icons `--color-text-inverse` (#ffffff light / #0f172a dark) on `--color-surface` with opacity → 4.5:1+ contrast maintained at default opacity 0.7/0.9. User-adjustable opacity may break contrast — document in settings panel ("Lower opacity may reduce readability").

## Responsive Design

### Touch target sizing

| Setting | Size | Use case |
|---|---|---|
| small (`--nav-cluster-size-sm`) | 40px | Desktop mouse, dense layout |
| medium (`--nav-cluster-size-md`, default) | 48px | Desktop/touch hybrid (meets 44px min) |
| large (`--nav-cluster-size-lg`) | 56px | Touch-first (tablet/phone, meets 56px) |

**WCAG 2.5.5 (AAA)**: ≥44px. Medium (48px) + large (56px) pass. Small (40px) fails AAA but passes AA — document in settings ("Small may be hard to tap on touch devices").

### Layout breakpoints

Cluster is `position: absolute` relative to `video.parentElement` — no responsive breakpoints (follows video size, not viewport). Position as % survives resize + fullscreen.

### No-sub adaptive layout

```
With subtitle (6 nút 2 cột):
┌────┬────┐
│ ⋯  │ ⏪  │
│ ◀  │────│
│ 🔁 │ ⏩  │
│ ▶  │    │
└────┴────┘

No subtitle (4 nút 1 cột, .no-sub class):
┌────┐
│ ⋯  │
│ ◀  │  (time mode: 5s rewind)
│ 🔁 │  (hold-loop 3s window)
│ ▶  │  (time mode: 10s forward)
└────┘
```

CSS: `.no-sub .nav-cluster-secondary { display: none; }`. ◀▶ click handler checks `cueSource.targetCues.length` → time mode (5s/10s) or sentence mode.

## Loading + Empty States

- **Cluster init**: render immediately at `init()` (4-nút no-sub state). No loading spinner — cluster is interactive before subtitle loads.
- **No subtitle**: 4-nút state IS the empty state (not blank, not spinner). Adaptive per §F9.
- **Video not ready** (`readyState < 2`): buttons disabled + `aria-disabled="true"` + opacity 0.5. Seek actions no-op. Re-enable on `loadeddata` event.

## Performance

- **Drag 60fps**: `transform: translate(x%, y%)` (GPU composited), NOT `left`/`top` (layout thrash). Position stored as % but applied via transform.
- **Repeat loop**: `timeupdate` listener (already on video for subtitle sync) — no `setInterval`. Seek to cue start when `currentTime ≥ cue.end/1000`.
- **Persist debounced 300ms**: avoid storage write storm during drag. Reuse ADR-013 `yOffset` persist pattern.
- **No-sub transition <16ms**: CSS class toggle (`.no-sub`), no DOM recreate (NF5).
- **Listener cleanup**: `destroy()` removes all listeners (pointer, keyboard, fullscreen, storage, timeupdate). No leaks (ADR-015 T12 pattern).

## Anti-AI-aesthetic checklist

| AI default | Cluster choice |
|---|---|
| Purple/indigo | Reuse project `--color-primary` (#2563eb blue) for active state |
| Excessive gradients | Flat `--color-surface` with opacity |
| Rounded everything | `--radius-md` (8px) buttons, `--radius-full` half-circle collapse only |
| Oversized padding | `--spacing-xs` (4px) button padding, compact cluster |
| Shadow-heavy | `--shadow-md` single subtle floating shadow |
| Stock card grids | Purpose-driven 2-column toolbar, not grid |

## Verification (G4/G5)

- [ ] `navClusterController.ts` ≤200 lines (split if exceeded)
- [ ] All buttons use `createNavClusterButton` atom (no inline button creation)
- [ ] All colors/spacing/sizing via tokens (no raw hex/px — lint enforced)
- [ ] ARIA: `role="toolbar"`, each button `aria-label`, 🔁 `aria-pressed`, ⋯ `aria-grabbed`
- [ ] Keyboard: Tab moves between buttons, ArrowLeft/Right = prev/next (not toolbar nav), R hold state machine, `<` `>` seek, editable guard
- [ ] Touch target: 40/48/56px via tokens, WCAG 2.5.5 documented
- [ ] Drag 60fps via transform, persist debounced 300ms
- [ ] No-sub transition CSS class toggle <16ms
- [ ] `destroy()` removes all listeners (no leaks)
- [ ] Browser verify (Edge MCP): A1-A15 acceptance criteria

## Related

- **Spec**: `docs/specs/spec-subtitle-navigation-control.md`
- **ADR**: `docs/adr/018-subtitle-navigation-control-cluster.md`
- **Design system**: `docs/reviews/design-system-inventory-2026-07-02-nav-cluster.md`
- **Pattern reuse**: ADR-015 (Pointer Events drag, themeTokens injection), ADR-013 (debounced persist), `subtitleShortcuts.ts` (`isEditableTarget`), `subtitleSync.ts` (`findCurrentLine`)
- **Next**: G4 Implementation — task breakdown đầu G4, sau Spec + Plan + ADR + Design (this doc).
