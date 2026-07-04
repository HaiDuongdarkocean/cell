# ADR-019: Subtitle Time Offset (V1) — Interface Contracts

> G3 Design. Code-to-code contracts cho V1 offset feature.
> Input: `docs/specs/spec-subtitle-time-offset.md` + `docs/plan/plan-subtitle-time-offset.md`.
> Mockup: `docs/mockups/mockup-subtitle-time-offset.html` (v2.2 approved).
> **Amended 2026-07-04**: Drop C2 lazy window (xem Amendment section cuối file).

## Context

V1 Manual Offset Management cần 3 module mới + 4 module modify. Cần define interface contracts trước G4 để:
- Module boundaries rõ (OffsetController không leak state, panel không biết logic)
- Parallel implementation possible (T1 logic + T4 panel độc lập nếu contract chốt)
- Hyrum's Law mitigation — expose minimum, hide implementation

## Decision: 6 interface contracts

### Contract 1 — `OffsetState` (discriminated union, pure data)

```typescript
// src/features/subtitle/logic/subtitleOffset.ts

/** Offset mode — lazy = chỉ apply window 5ph, committed = apply all. */
export type OffsetMode = 'lazy' | 'committed';

/** Pure state — không chứa DOM, không chứa timer handle. */
export interface OffsetState {
  readonly valueMs: number;        // current offset (ms) — UI convert sang giây
  readonly mode: OffsetMode;
  readonly anchorMs: number;       // currentTime (ms) lúc vào lazy — window [anchor, anchor+300000]
  readonly lastActionAt: number;   // Date.now() lúc action gần nhất (wall-clock, ms)
}

/** Initial state — committed, offset 0. */
export const INITIAL_OFFSET_STATE: OffsetState = {
  valueMs: 0,
  mode: 'committed',
  anchorMs: 0,
  lastActionAt: 0,
};
```

**Rationale**: discriminated union qua `mode` field → consumer type-narrow. Pure data (no DOM, no timer) → testable, serializable. `readonly` fields → immutable, transitions tạo state mới.

### Contract 2 — Pure functions (logic, no side effects)

```typescript
// src/features/subtitle/logic/subtitleOffset.ts

/** Parse user input (giây) → ms. Accept: "0.7", "1.5", "-0.5". Reject: "abc", empty. */
export function parseOffsetInput(input: string): number | null;

/** Clamp ±60s. Return clamped value (always number, never null — use for internal accumulate). */
export function clampOffsetMs(ms: number): number;

/** Apply offset to currentTime for findCurrentLine. +offset = sub muộn = search time tăng. */
export function effectiveTime(currentTimeMs: number, offsetMs: number): number;

/** Check if cue is in lazy window [anchor, anchor+300000] ms. */
export function isInLazyWindow(cueStartMs: number, anchorMs: number): boolean;

/** Format ms → display string (giây). 700 → "+0.7s", -500 → "-0.5s", 0 → "0s". */
export function formatOffsetDisplay(ms: number): string;

/** Check if should auto-commit: Date.now() - lastActionAt > 120000 AND mode === 'lazy'. */
export function shouldAutoCommit(state: OffsetState, nowMs: number): boolean;
```

**Error semantics**: `parseOffsetInput` return `null` cho invalid (không throw) — caller decide toast/hint. `clampOffsetMs` always return number (clamp, không reject) — internal use. Consistent: null = invalid input, number = valid.

### Contract 3 — `findCurrentLine` modified signature (additive, backward-compat)

```typescript
// src/features/subtitle/logic/subtitleSync.ts

/** BEFORE */
export function findCurrentLine(lines: SrtCue[], currentTime: number): number;

/** AFTER — offsetMs optional, default 0 (backward-compat existing callers) */
export function findCurrentLine(lines: SrtCue[], currentTime: number, offsetMs: number = 0): number;
```

**Rationale**: optional param `offsetMs = 0` → existing 5 call sites không break (default 0 = no offset). New callers pass offset. Internal: `const effective = currentTime + offsetMs; // search với effective time`.

### Contract 4 — `OffsetController` API (orchestrator, mimic NavClusterController)

```typescript
// src/features/subtitle/ui/offsetController.ts

export interface OffsetController {
  /** Init — create panel + badge, attach listeners, load persist. */
  init(): void;

  /** Update cues reference (called when load new sub). Reset offset to 0 + cancel lazy. */
  loadCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void;

  /** Get current offset (ms) — for findCurrentLine callers. */
  getOffsetMs(): number;

  /** Check if cue is currently active in lazy window (for overlay to decide apply). */
  isCueInLazyWindow(cueStartMs: number): boolean;

  /** Destroy — remove panel, badge, listeners. */
  destroy(): void;
}

/** Factory — closure-based state (mimic subtitleDragPosition pattern). */
export function createOffsetController(
  video: HTMLVideoElement,
  container: HTMLElement,
  url: string,  // for persist key
): OffsetController;
```

**Rationale**: factory + closure (not class) — follow `subtitleDragPosition` pattern. `getOffsetMs()` + `isCueInLazyWindow()` là read-only API cho `subtitleOverlay` query mỗi `timeupdate`. `loadCues` reset khi sub mới (R5). Không expose `state` trực tiếp — encapsulation.

### Contract 5 — Panel + Badge factory (DOM, mimic subtitleManagerPanel)

```typescript
// src/features/subtitle/ui/subtitleOffsetPanel.ts

export interface OffsetPanelApi {
  readonly panel: HTMLDivElement;
  readonly icon: HTMLButtonElement;  // toggle button (nếu cần, hoặc null)
  /** Update UI theo state. */
  update(state: OffsetState, hasSubtitle: boolean): void;
  /** Flash apply button "✓ Đã lưu" 1.5s. */
  flashSaved(): void;
  /** Destroy — remove panel, listeners. */
  destroy(): void;
}

export function createOffsetPanel(
  container: HTMLElement,
  handlers: {
    onStep: (deltaMs: number) => void;  // ±500 or ±2000
    onInput: (valueMs: number) => void;  // parsed input
    onReset: () => void;
    onApply: () => void;
  },
): OffsetPanelApi;
```

```typescript
// src/features/subtitle/ui/subtitleOffsetBadge.ts

export interface OffsetBadgeApi {
  readonly badge: HTMLDivElement;
  /** Show badge + start timer countdown. */
  show(anchorMs: number): void;
  /** Hide badge + stop timer. */
  hide(): void;
  /** Update timer text (called mỗi giây). */
  updateTimer(remainingMs: number): void;
  /** Destroy. */
  destroy(): void;
}

export function createOffsetBadge(
  container: HTMLElement,
  onReset: () => void,  // click badge = reset
): OffsetBadgeApi;
```

**Rationale**: panel + badge là DOM factory, nhận handlers callback (inversion of control) — không biết OffsetController logic. `update(state)` render theo state (4 states từ mockup). `flashSaved()` tách riêng vì trigger từ auto-commit (không phải user click).

### Contract 6 — Settings type extension (additive)

```typescript
// src/entities/settings/types.ts — ADD field

export interface Settings {
  // ... existing fields ...
  readonly subtitleOffset?: Record<string, number>;  // URL → offsetMs (AD3)
}
```

**Rationale**: optional field `?` → backward-compat (existing settings không có field này vẫn load OK). Follow `subtitlePreference` precedent (`Record<string, Record<string, number>>`). Key = `window.location.href` (full URL, AD3 confirmed).

## Consequences

**Positive**:
- 6 contract chốt → T1 (logic) + T4 (panel) + T5 (badge) implement song song.
- `findCurrentLine` backward-compat (optional param) → không break existing 5 call sites.
- Pure functions testable 100% (no DOM, no side effects).
- Encapsulation: `OffsetController.getOffsetMs()` thay vì expose state — Hyrum's Law mitigation.

**Negative**:
- `OffsetController` closure state khó inspect debug hơn class (không `this.state`) — accept trade-off cho consistency với codebase.
- `findCurrentLine` optional param có thể bị quên pass offsetMs ở caller mới — mitigate bằng T2 update all 5 call sites + lint rule (không có sẵn, manual review).

## Verification

- [ ] 6 contract defined trong ADR-019
- [ ] `findCurrentLine` backward-compat (optional param default 0)
- [ ] Pure functions return `null | number` consistent (null = invalid)
- [ ] Panel/Badge factory nhận handlers (inversion of control, không biết logic)
- [ ] Settings field optional (backward-compat)
- [ ] OffsetController encapsulate state (getOffsetMs, không expose state)

## Open Questions

- (không còn — 6 contract chốt, sẵn sàng G4)

---

## Amendment 2026-07-04: Drop C2 lazy window

### Delta (what changed)

- **Contract 1 `OffsetState`**: xóa `anchorMs` field. Lazy mode không còn window constraint.
- **Contract 2 pure functions**: xóa `isInLazyWindow()`. Xóa `LAZY_WINDOW_MS` const.
- **Contract 4 `OffsetController`**: xóa `isCueInLazyWindow()` method.
- **Contract 5 `OffsetBadgeApi`**: `show(anchorMs)` → `show()` (không cần anchor). Timer đếm ngược 2 phút (auto-commit), không phải 5 phút window.
- **Lazy semantics**: lazy = apply all ngay (chưa persist), không phải "apply chỉ window 5 phút". Badge "Xem thử · MM:SS" đếm ngược 2 phút (timer auto-commit).

### Why changed

C2 lazy window constraint đòi per-cue effective time (rebuild `effectiveCues[]` O(n) mỗi lần user tune), mâu thuẫn với AD1 "add `offsetMs` param vào `findCurrentLine`" (apply 1 offset cho ALL cues via `currentTime + offsetMs`).

Spec review (2026-07-04) flag CRITICAL #1: C2 vs AD1 contradiction. Anh approved drop C2. Lý do:
1. **Ponytail rung 1 (YAGNI)**: User chỉ xem cue hiện tại, không quay lại cues đã qua trong lazy session → window constraint không có giá trị user-perceived.
2. **Performance**: drop C2 = gán 1 `offsetMs` biến + binary search O(log n) giữ nguyên. C2 = rebuild `effectiveCues[]` O(n) mỗi lần tune (2000 cues → 2000 ops + GC).
3. **Simpler = đúng hơn**: bấm offset → all cue dịch ngay (lazy = chưa persist). Reset + lazy mode = safety net đủ.

### What stays (see original contracts above)

- AD1: offset at search level (`currentTime + offsetMs`), không mutate `SrtCue`.
- AD2: separate `OffsetController` + panel + badge.
- AD3: persist `Record<string, number>` per-URL (type corrected — không nested).
- AD4: wall-clock timer + `timeupdate`/`visibilitychange`.
- AD5: UI giây, internal ms.
- AD6: bilingual 1 offset chung.
- `findCurrentLine` `offsetMs` param (Contract 3) — unchanged, đã tồn tại.
- `parseOffsetInput`, `clampOffsetMs`, `effectiveTime`, `formatOffsetDisplay`, `shouldAutoCommit` — unchanged.

### Consequences (delta only)

- **Positive**: lazy mode đơn giản hơn (apply all, không window logic). `OffsetState` giảm 1 field. `subtitleOffset.ts` giảm 1 function + 1 const. Tests giảm (không test `isInLazyWindow`/`anchorMs`).
- **Negative**: user bấm offset ở giây 1000 → cue ở 500s (đã xem qua) cũng dịch ngay. Nhưng user không quay lại 500s trong lazy session (đang xem 1000s trở đi) → không ảnh hưởng UX. Nếu seek về 500s → thấy cue đã dịch (đúng behavior V1 "constant offset global").
- **Migration**: code đã tồn tại `anchorMs`/`isInLazyWindow`/`LAZY_WINDOW_MS` → G4 Task 1 cleanup (xem plan).

### Schema migration note (resolved 2026-07-04)

`settingsStore.ts` currently `CURRENT_SCHEMA_VERSION = 2`. Bump → 3, migration 2→3 default `subtitleOffset: {}` (additive). Không rollback strategy — field optional, reset-to-0 (runtime) đủ cho user-facing revert. Ponytail: không over-engineer rollback cho additive field.
