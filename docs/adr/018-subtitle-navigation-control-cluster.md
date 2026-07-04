# ADR-018: Subtitle Navigation Control Cluster — Floating 6-Button Controller Contract

## Status

Proposed (G3 Design — awaiting G4 implementation)

## Context

Spec `docs/specs/spec-subtitle-navigation-control.md` (APPROVED) + Plan `docs/plan/plan-subtitle-navigation-control.md` (G2) định nghĩa một **floating 6-button control cluster** (⋯/◀/🔁/▶ main + ⏪/⏩ secondary) injected vào `video.parentElement`, cho mouse + touch users subtitle sentence navigation + repeat hold + seek 5s/10s mà không cần keyboard.

**Forces**:
- Touch/tablet users không có cách nào tua theo câu hoặc repeat mà không bật keyboard (gap từ G0 intent).
- Existing kbd shortcuts (`subtitleShortcuts.ts`) dùng `bilingualCues` linear search — không phải timing source sạch cho cluster.
- `findCurrentLine` (binary search, `subtitleSync.ts`) đã có + là timing source sạch.
- ADR-015 đã establish Pointer Events + `setPointerCapture` drag pattern — cluster reuse.
- ADR-013 đã establish `chrome.storage.local` + `onStorageChanged` realtime persist pattern — cluster reuse.
- `settingsStore.ts` đã có schema versioning + migration framework (v0→v1) — cluster thêm v1→v2.
- `contentScriptController.ts` đã 670+ lines — cluster phải tách file riêng, không inline.

**Constraints (codebase)**:
- FSD target: feature-domain UI controller thuộc `features/subtitle/ui/`.
- Existing `Settings` interface dùng **flat keys** (`subtitleOverlayAutoLoad`, `autoSelectEnabled`, `keyboardShortcuts`).
- Existing `ShortcutAction` union (`prev-cue`/`next-cue`/`replay-cue`/`toggle-overlay`/`toggle-panel`) là cho configurable panel shortcuts — cluster shortcuts là fixed parallel, không mở rộng union.
- Existing kbd handler `handleShortcutKey` là single keydown → action, không hold state machine.

## Decision

### D1: `NavClusterController` class — sibling pattern với `SubtitleOverlayController`

```typescript
// src/features/subtitle/ui/navClusterController.ts

/** Cluster position as percent of video container (0-100). */
export interface NavClusterPosition {
  readonly x: number; // 0-100, default 0
  readonly y: number; // 0-100, default 75
}

/** Settings slice for nav cluster (flat keys in Settings, see D2). */
export interface NavClusterSettings {
  readonly enabled: boolean;
  readonly position: NavClusterPosition;
  readonly buttonSize: 40 | 48 | 56; // small/medium/large
  readonly bgOpacity: number; // 0-1
  readonly buttonOpacity: number; // 0-1
  readonly collapsed: boolean;
}

/** Cue accessor — lazy fetch from controller, avoids tight coupling. */
export interface NavClusterCueSource {
  /** Target cues (primary). Empty array = no target. */
  readonly targetCues: readonly SrtCue[];
  /** Native cues (fallback when target empty). */
  readonly nativeCues: readonly SrtCue[];
}

/**
 * Floating 6-button subtitle navigation cluster.
 *
 * Lifecycle: init() → updateCues() (on subtitle load) → updateSettings() (on storage change) → destroy()
 *
 * DOM: injected into video.parentElement, z-index 1000001, pointer-events auto only on cluster.
 * Drag: Pointer Events + setPointerCapture (reuse ADR-015 pattern).
 * Keyboard: fixed parallel shortcuts (ArrowLeft/Right/R hold/`<`/`>`), NOT in ShortcutAction union.
 */
export class NavClusterController {
  constructor(
    private readonly video: HTMLVideoElement,
    private readonly container: HTMLElement,
    initialSettings: NavClusterSettings,
    private readonly cueSource: NavClusterCueSource,
  );

  /** Build DOM + wire drag/click/keyboard listeners. Idempotent (no-op if already init). */
  init(): void;

  /** Update cue source (called when subtitle loads/unloads). Triggers 4↔6 nút transition. */
  updateCues(targetCues: readonly SrtCue[], nativeCues: readonly SrtCue[]): void;

  /** Update settings (called on chrome.storage.onChanged). Realtime apply, no reload. */
  updateSettings(settings: Partial<NavClusterSettings>): void;

  /** Show/hide cluster (off toggle). */
  setVisible(visible: boolean): void;

  /** Teardown: remove DOM, detach all listeners (pointer, keyboard, fullscreen, storage). */
  destroy(): void;
}
```

**Rationale**: Mimic `SubtitleOverlayController` lifecycle (init → load → update → destroy). `cueSource` as injected dependency (not constructor param `cues`) — lets cluster read fresh cues on every action without re-init when subtitle swaps. `updateCues` for explicit transition triggers (4↔6 nút).

**Alternatives rejected**:
- Functional `createNavCluster` returning handle object (plan AD1) — class matches existing `SubtitleOverlayController` pattern, easier to reason about lifecycle + private state.
- Cluster reads `controller.cues` directly (tight coupling) — brittle if controller internals change. `cueSource` interface is stable contract.

### D2: Settings schema v1→v2 — flat `navCluster*` keys

```typescript
// src/entities/settings/types.ts — add to Settings interface
export interface Settings {
  // ... existing fields ...
  /** Nav cluster master toggle. Default: true. */
  readonly navClusterEnabled: boolean;
  /** Nav cluster position as percent of video container. Default: { x: 0, y: 75 }. */
  readonly navClusterPosition: NavClusterPosition;
  /** Nav cluster button size preset. Default: 48 (medium). */
  readonly navClusterButtonSize: 40 | 48 | 56;
  /** Nav cluster background opacity (0-1). Default: 0.7. */
  readonly navClusterBgOpacity: number;
  /** Nav cluster button opacity (0-1). Default: 0.9. */
  readonly navClusterButtonOpacity: number;
  /** Nav cluster collapsed state (half-circle edge-stuck). Default: false. */
  readonly navClusterCollapsed: boolean;
}
```

```typescript
// src/shared/lib/storage/settingsStore.ts
export const CURRENT_SCHEMA_VERSION = 2;

const migrations = {
  0: (s) => ({ ...DEFAULT_SETTINGS, ...s, schemaVersion: 1 }),
  1: (s) => ({ ...DEFAULT_SETTINGS, ...s, schemaVersion: 2 }), // merge DEFAULT_NAV_CLUSTER_SETTINGS
};
```

**Rationale**: Flat keys consistent with `subtitleOverlayAutoLoad`, `autoSelectEnabled`. Nested `navCluster: NavClusterSettings` would diverge + complicate `loadSettings` merge (`{ ...DEFAULT_SETTINGS, ...raw }` flattens naturally). Migration v1→v2 = merge defaults (same template as v0→v1).

**Validation at boundary** (`loadSettings` post-migration):
- `navClusterPosition.x/y` clamp to [0, 100].
- `navClusterBgOpacity`/`navClusterButtonOpacity` clamp to [0, 1].
- `navClusterButtonSize` snap to nearest preset {40, 48, 56}.
- `navClusterEnabled`/`navClusterCollapsed` coerce to boolean.

**Alternatives rejected**:
- Nested `navCluster: NavClusterSettings` — diverges from flat convention, complicates merge.
- Separate storage key `navClusterSettings` — fragments storage, loses atomic migration.

### D3: Cue source = target cues primary via `findCurrentLine`, native fallback

```typescript
// Inside NavClusterController — prev/next action
private findActiveCueIndex(): { cues: readonly SrtCue[]; index: number } {
  const t = this.video.currentTime * 1000;
  if (this.cueSource.targetCues.length > 0) {
    return { cues: this.cueSource.targetCues, index: findCurrentLine(this.cueSource.targetCues, t) };
  }
  return { cues: this.cueSource.nativeCues, index: findCurrentLine(this.cueSource.nativeCues, t) };
}

prevSentence(): void {
  const { cues, index } = this.findActiveCueIndex();
  if (index > 0) {
    this.video.currentTime = cues[index - 1].start / 1000;
  } else if (index === -1) {
    // In gap — find nearest previous cue
    const prevCue = [...cues].reverse().find((c) => c.end < t);
    if (prevCue) this.video.currentTime = prevCue.start / 1000;
  }
  // index === 0 → no-op (first cue)
}
```

**Rationale** (spec §Cue Source Decision): `findCurrentLine` binary search O(log n), clean timing source. `bilingualCues` (existing kbd) is panel display merge — not timing. Divergence documented; ceiling v2 migrate existing kbd to `findCurrentLine`.

**Alternatives rejected**:
- Reuse `bilingualCues` linear search — inaccurate timing, conflicts spec.
- Merge target+native then `findCurrentLine` — merged cues are panel display, not timing.

### D4: Keyboard state machine — fixed parallel shortcuts, NOT in `ShortcutAction` union

```typescript
// Inside NavClusterController.init()
this.keydownHandler = (e: KeyboardEvent) => {
  if (isEditableTarget(e.target)) return;
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      this.prevSentence();
      break;
    case 'ArrowRight':
      e.preventDefault();
      this.nextSentence();
      break;
    case 'r':
    case 'R':
      if (!e.repeat && !this.repeatHolding) {
        this.startRepeatHold();
      }
      break;
    case '<':
    case ',':
      e.preventDefault();
      this.seekBy(-5);
      break;
    case '>':
    case '.':
      e.preventDefault();
      this.seekBy(10);
      break;
  }
};
this.keyupHandler = (e: KeyboardEvent) => {
  if ((e.key === 'r' || e.key === 'R') && this.repeatHolding) {
    this.stopRepeatHold();
  }
};
document.addEventListener('keydown', this.keydownHandler);
document.addEventListener('keyup', this.keyupHandler);
// Cancel on blur/visibilitychange (R held, focus moves to editable)
window.addEventListener('blur', this.onBlurCancel);
document.addEventListener('visibilitychange', this.onVisibilityCancel);
```

**Rationale** (spec §Keyboard State Machine): Existing `ShortcutAction` union is for configurable panel shortcuts (a/d/s/w/t). Cluster shortcuts are gesture-equivalent for touch users, fixed for discoverability. R hold needs keydown/keyup state machine (not single keydown → action). `e.repeat` ignored to avoid re-trigger. `blur`/`visibilitychange` cancel handles edge case where keyup lost.

**`<` `>` fallback**: `,` `.` also accepted (Shift+`,` = `<`, Shift+`.` = `>` on US layout; some layouts don't need Shift). Host page capture audit deferred to G4 — if `<` `>` captured, fallback J/L ready (ceiling v2 configurable).

**Alternatives rejected**:
- Expand `ShortcutAction` + `keyboardShortcuts` — config UI bloat, conflicts spec "fixed parallel".
- Reuse `handleShortcutKey` — single keydown → action, no hold state machine.

### D5: Drag — native Pointer Events + `setPointerCapture` (reuse ADR-015)

```typescript
// Inside NavClusterController — drag handle ⋯
private onPointerDown(e: PointerEvent): void {
  if (e.target !== this.dragHandle) return;
  e.preventDefault();
  this.dragHandle.setPointerCapture(e.pointerId);
  this.dragStart = { px: e.clientX, py: e.clientY, pos: { ...this.settings.position } };
  this.dragHandle.style.cursor = 'grabbing';
}

private onPointerMove(e: PointerEvent): void {
  if (!this.dragStart) return;
  const dx = e.clientX - this.dragStart.px;
  const dy = e.clientY - this.dragStart.py;
  const rect = this.video.getBoundingClientRect();
  const clusterRect = this.cluster.getBoundingClientRect();
  const newX = clamp(this.dragStart.pos.x + (dx / rect.width) * 100, 0, 100 - (clusterRect.width / rect.width) * 100);
  const newY = clamp(this.dragStart.pos.y + (dy / rect.height) * 100, 0, 100 - (clusterRect.height / rect.height) * 100);
  this.applyPosition({ x: newX, y: newY });
  // Check edge collapse
  if (newX <= 20 / rect.width * 100 || newX >= 100 - 20 / rect.width * 100) {
    this.collapseToNearestEdge();
  }
}

private onPointerUp(e: PointerEvent): void {
  if (!this.dragStart) return;
  this.dragHandle.releasePointerCapture(e.pointerId);
  this.dragStart = null;
  this.dragHandle.style.cursor = 'grab';
  this.persistPositionDebounced(); // 300ms debounce
}
```

**Rationale** (spec §F2-F4, ADR-015): ADR-015 đã verify Pointer Events + `setPointerCapture` cho subtitle overlay drag. Cluster reuse same pattern. Position as percent of video container (not px) — survives resize + fullscreen. Persist debounced 300ms (reuse ADR-013 `yOffset` persist pattern).

**Alternatives rejected**:
- Mouse + Touch Events separately — 2 code paths, ADR-015 chose Pointer Events.
- Library (interact.js) — overkill, native suffices.

### D6: Collapse — CSS `border-radius` half-circle, mirror via `transform: scaleX(-1)`

```typescript
private collapseToNearestEdge(): void {
  const pos = this.settings.position;
  const edge = pos.x < 50 ? 'left' : 'right';
  this.cluster.classList.add('collapsed');
  this.cluster.classList.toggle('mirror-left', edge === 'left');
  this.cluster.classList.toggle('mirror-right', edge === 'right');
  this.updateSettings({ collapsed: true });
}

private expand(): void {
  this.cluster.classList.remove('collapsed', 'mirror-left', 'mirror-right');
  this.updateSettings({ collapsed: false });
}
```

```css
.nav-cluster.collapsed {
  width: 32px;
  height: 32px;
  border-radius: 50% 0 0 50%; /* left-stuck half-circle */
}
.nav-cluster.collapsed.mirror-right {
  transform: scaleX(-1);
}
```

**Rationale** (spec §F4, plan AD6): Ponytail rung 4 (native CSS). SVG asset adds asset pipeline + bundle size for 32px shape. `border-radius: 50% 0 0 50%` = half-circle, `scaleX(-1)` mirrors.

**Alternatives rejected**:
- SVG half-circle — asset pipeline, bundle size, no benefit at 32px.
- Image asset — raster scaling.

### D7: Settings UI — new "Navigation" tab in `SettingsDialog.tsx`

```typescript
// src/features/settings/ui/NavClusterSettingsPanel.tsx (new)
interface NavClusterSettingsPanelProps {
  /** Current nav cluster settings slice. */
  settings: NavClusterSettings;
  /** Persist updated settings (debounced in caller). */
  onChange: (settings: Partial<NavClusterSettings>) => void;
}
export function NavClusterSettingsPanel({ settings, onChange }: NavClusterSettingsPanelProps): ReactElement;
```

**Rationale** (spec §F10-F11, plan AD7): Cluster distinct from subtitle styling. New tab keeps concerns separate. Off toggle → confirm dialog (reuse existing dialog pattern).

**Alternatives rejected**:
- Gộp vào "Subtitle" tab — muddies both.
- Separate dialog — extra click.

### D8: No-sub adaptive — CSS class toggle, no DOM recreate

```typescript
updateCues(targetCues: readonly SrtCue[], nativeCues: readonly SrtCue[]): void {
  this.cueSource = { targetCues, nativeCues };
  const hasSub = targetCues.length > 0 || nativeCues.length > 0;
  this.cluster.classList.toggle('no-sub', !hasSub);
  // CSS: .no-sub .nav-cluster-secondary { display: none; }
  //      .no-sub .nav-cluster-prev / .nav-cluster-next → time mode (5s/10s)
}
```

**Rationale** (spec §F9, NF5): CSS class toggle <16ms, no DOM recreate. ◀▶ click handler checks `this.cueSource.targetCues.length` to switch sentence mode vs time mode.

## Consequences

### Positive
- Cluster isolated in 1 file (`navClusterController.ts`) — easy to test, maintain, remove.
- Reuse ADR-013 (persist) + ADR-015 (drag) patterns — no new infra.
- Settings schema v2 migration atomic, forward-compat.
- Cue source divergence documented — ceiling v2 migrate existing kbd.

### Negative
- Cue source divergence: cluster `findCurrentLine` + target cues vs existing kbd `bilingualCues` linear — prev/next behavior may differ slightly between cluster click + kbd shortcut for same action. **Mitigation**: G4 verify A5 + A10 give consistent results; ceiling v2 migrate existing kbd.
- `Settings` interface +6 fields — larger payload. Negligible (settings small + infrequent).
- New "Navigation" tab — tab count +1. Acceptable.
- Fixed parallel shortcuts not configurable v1 — users who want custom keys wait v2.

### Neutral
- `NavClusterController` class (not functional) — matches `SubtitleOverlayController` pattern, slight OOP divergence from functional preference.

## Verification (G4/G5)

- [ ] Unit: `navClusterController.test.ts` — DOM structure, drag clamp, collapse threshold, button click → action, kbd state machine, editable guard, `e.repeat` ignore, blur/visibilitychange cancel.
- [ ] Unit: `settingsStore.test.ts` — migration v1→v2 (existing + new fields merge, invalid clamp).
- [ ] Unit: `NavClusterSettingsPanel.test.tsx` — tab render, slider → onChange, off toggle → confirm dialog.
- [ ] Browser (Edge MCP): A1-A15 acceptance criteria (spec §Acceptance table).
- [ ] `npx tsc --noEmit` exit 0, `npm run lint` clean, `npm run test:unit` pass.

## Related

- **Spec**: `docs/specs/spec-subtitle-navigation-control.md`
- **Plan**: `docs/plan/plan-subtitle-navigation-control.md`
- **Builds on**: ADR-013 (overlay layer + persist), ADR-015 (Pointer Events drag), `subtitleSync.ts` (`findCurrentLine`), `subtitleShortcuts.ts` (`isEditableTarget`), `subtitlePanel.ts` (`seekToCue`), `settingsStore.ts` (schema migration).
- **Does NOT break**: existing kbd shortcuts (a/d/s/w/t), subtitle overlay drag (ADR-015), bilingual subtitle auto-load (ADR-007), subtitle manager panel (ADR-015 T11).

---

## Supplement D5-rev: Grip tab drag handle (replaces border-zone hit-test)

**Status**: Approved (mockup `docs/mockups/mockup-nav-cluster-grip-tab.html` v1, variant (b) pill bar)

### Context — why revise D5

D5 specified "drag handle" but G4 implementation drifted to **border-zone hit-test** (4px padding strip around cluster edge). This works for mouse (`cursor: move` is visible) but is unusable on touch devices:

- Touch target 4px << HIG minimum 44pt / Material 48dp / WCAG 2.5.5 44 CSS px.
- Finger covers the 4px strip when trying to hit it — no visual feedback, no hit.
- `cursor: move` is a desktop affordance — invisible to touch users (no discoverability).

### Decision — grip tab (drawer-pull metaphor)

Add a dedicated drag handle element (grip tab) attached to the top edge of the cluster:

```typescript
// navClusterDom.ts — buildClusterDOM adds grip element
const grip = document.createElement('div');
grip.className = 'nav-cluster-grip';
grip.setAttribute('role', 'button');
grip.setAttribute('aria-label', 'Kéo để di chuyển cluster');
grip.setAttribute('tabindex', '0');
cluster.append(grip, mainColumn, secondaryColumn, noSubColumn, gapCover);
```

```css
/* navClusterCss.ts — grip tab */
.nav-cluster-grip {
  position: absolute;
  top: -22px;               /* hit-area extends 22px above cluster top edge */
  left: 50%;
  transform: translateX(-50%);
  width: 44px;              /* HIG minimum hit-area width */
  height: 24px;             /* HIG minimum hit-area height */
  display: flex; align-items: center; justify-content: center;
  cursor: grab;
  touch-action: none;       /* prevent page scroll while drag on touch */
  z-index: 11;
}
.nav-cluster-grip::before {
  /* visual pill bar — 28×4px, centered in 44×24 hit-area */
  content: '';
  width: 28px; height: 4px;
  border-radius: var(--radius-full, 9999px);
  background: var(--color-text-muted, #94a3b8);
  opacity: 0.35;
  transition: opacity 150ms ease, background 150ms ease;
}
.nav-cluster-grip:hover::before { opacity: 0.7; }
.nav-cluster.dragging .nav-cluster-grip::before {
  opacity: 0.9;
  background: var(--color-text, #0f172a);
}
.nav-cluster.dragging .nav-cluster-grip { cursor: grabbing; }

/* Drop cursor:move on cluster body — drag is via grip only now */
.nav-cluster { cursor: default; }   /* was: cursor: move !important */

/* Collapsed: grip hidden — collapsed circle IS the handle (no buttons inside) */
.nav-cluster.collapsed { cursor: grab; }
.nav-cluster.collapsed.dragging { cursor: grabbing; }
.nav-cluster.collapsed .nav-cluster-grip { display: none; }
```

### Drag logic refactor (navClusterController.ts)

- **Before**: `pointerdown` on cluster → hit-test `e.target === cluster && within 4px of edge` → drag.
- **After**: `pointerdown` on grip (expanded) OR cluster (collapsed) → drag. No border math.
- `dblclick` reset moves from cluster border → grip (collapsed: dblclick on cluster circle).
- `aria-grabbed` moves from cluster → grip (expanded); stays on cluster (collapsed).

### Why grip tab wins over alternatives

| Option | Touch target | Discoverability | Minimalism | Conflict risk | Verdict |
|---|---|---|---|---|---|
| **Grip tab (chosen)** | 44×24 ✅ | visual affordance ✅ | +1 subtle element | none | ✅ |
| Long-press anywhere | whole cluster ✅ | hidden ❌ | zero visual ✅ | button long-press ⚠️ | rejected |
| Invisible touch ring | 20px ring ⚠️ | hidden ❌ | zero visual ✅ | overlap video controls ⚠️ | rejected |
| 6th drag button | explicit ✅ | explicit ✅ | breaks 5-btn grid ❌ | none | rejected (not minimal) |

### Ponytail

- Rung 4 (native CSS + 1 div): no SVG asset, no JS timer for long-press.
- Reuses ADR-015 Pointer Events + `setPointerCapture` — no new drag infra.
- Removes border-zone hit-test math (4px pad check) — simpler controller code.
- One drag mechanism for mouse + touch + keyboard (grip is focusable, arrow keys nudge).

### Accessibility

- `role="button"` + `aria-label="Kéo để di chuyển cluster"` + `tabindex="0"` → keyboard reachable.
- Arrow keys nudge 1% (Shift+arrow = 5%); Enter/Space = reset to default position.
- `aria-grabbed` on grip (expanded) communicates drag state to AT.

### Verification (G5)

- [ ] Unit: `navClusterDom.test.ts` — grip element present, role/aria-label/tabindex.
- [ ] Unit: `navClusterController.test.ts` — drag via grip (expanded), drag via cluster (collapsed), dblclick grip → reset, border click does NOT drag.
- [ ] Browser (Edge MCP): touch drag via grip (device toolbar), mouse drag via grip, collapsed drag, dblclick reset, keyboard nudge.
- [ ] `npx tsc --noEmit` exit 0, `npm run test:unit` pass.
- **Ceiling v2**: migrate existing kbd to `findCurrentLine` (resolve cue source divergence), configurable cluster shortcuts, `noSubtitleLoopSeconds` setting.
