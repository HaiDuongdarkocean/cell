# Spec: Subtitle Navigation Control Cluster (floating prev/repeat/next + seek + drag)

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-07-02
> **Intent source**: `docs/intent/intent-subtitle-navigation-control.md`
> **Related**: ADR-013 (subtitle-appearance-manager — 2 overlay layer + drag), ADR-015 (subtitle drag integrated — drag trực tiếp overlay background), `subtitleOverlay.ts` (sync + `findCurrentLine`), `subtitleShortcuts.ts` (kbd handler pattern), `subtitlePanel.ts:seekToCue` (seek helper)

## Objective

**Problem**: Mouse and touch users currently cannot navigate subtitle sentences, repeat the current learning segment, or seek small time windows without using keyboard shortcuts. This blocks tablet/phone usage and slows desktop learning workflows. The experience must provide these actions without obscuring the bilingual subtitle overlay.

**User**: Anh — người học ngoại ngữ xem video trên web (lordflix/kisskh) với bilingual subtitle overlay. Muốn tua theo câu, lặp lại câu khó, tua 5s/10s bằng chuột hoặc touch (tablet/phone), không muốn dùng keyboard.

**Why now**: Hiện tại navigation chỉ có qua keyboard shortcuts (a/d/s — `subtitleShortcuts.ts`). Touch/tablet users không có cách nào tua theo câu hoặc repeat mà không bật keyboard. Cluster floating giải quyết gap này + thêm seek 5s/10s (keyboard hiện không có).

## Proposed Solution

Implement a **floating control cluster** injected into the video player container, giving mouse + touch users quick access to subtitle sentence navigation, repeat loop, and time seek — without keyboard, without obscuring the subtitle overlay, with drag-to-move positioning and a collapse mode.

**Success**:
- 6-nút cluster (2 cột: main ⋯/◀/🔁/▶ + secondary ⏪/⏩) hiển thị trong video player, không che subtitle overlay.
- Drag handle ⋯: press+drag = move cluster trong video bounds; double-click = reset default (x=0%, y=75%); drag-to-edge = collapse half-circle.
- Collapse mode: half-circle icon edge-stuck (mirror theo mép gần nhất), tap = expand lại.
- Prev/Next sentence: nhảy cue trước/sau, fallback 5s/10s khi gap >5s.
- Repeat hold-to-loop: hold ≥500ms = loop câu hiện tại (cue start→end), release = stop.
- Seek 5s/10s: nút riêng ⏪⏩.
- No-subtitle adaptive: khi chưa load subtitle → ⏪⏩ ẩn, ◀▶ fill slot thành time mode (5s/10s), cluster gọn 4 nút 1 cột.
- Position persist vào `chrome.storage`, restore on load.
- Size customizable (settings: small/medium/large slider), background opacity + button opacity settings riêng, color theo dark/light mode.
- Keyboard shortcuts parallel: ◀ ▶ (prev/next sentence), R hold (repeat), `<` `>` (seek 5s/10s).
- Off toggle trong settings + confirm dialog.
- Unit tests pass + browser verify (Edge MCP) trên real video page.

## Assumptions (surface trước khi spec nội dung)

1. **Cluster inject vào cùng container với subtitle overlay** (`video.parentElement`, ADR-008 D2 pattern). Không cần `videoWrapper` riêng. Fullscreen: reuse ADR-013 pattern (cluster neo vào fullscreen container khi video fullscreen).
2. **Z-index 1000001** — trên subtitle overlay target (999999) + native (999998). `pointer-events: auto` chỉ trên cluster element, không leak.
3. **Repeat hold-to-loop**: có subtitle = loop cue start→end (ms, từ `findCurrentLine` index); **không subtitle = hold-loop time window mặc định** — khi giữ 🔁, loop đoạn `[holdStartTime - 3s, holdStartTime]` (clamp về 0). Phục vụ shadowing khi user thấy đoạn hay nhưng chưa có subtitle: giữ ở điểm cuối đoạn → lặp lại 3s vừa nghe.
4. **Keyboard seek keys**: `<` (Shift+, US) = rewind 5s, `>` (Shift+. US) = forward 10s. `KeyboardEvent.key === '<'` / `'>'`. Conflict host page audit ở G4 — fallback J/L nếu conflict.
5. **No-sub adaptive**: khi `cues.length === 0 && nativeCues.length === 0` → ⏪⏩ ẩn, ◀▶ thành time mode (5s/10s). Cluster gọn 4 nút 1 cột: ⋯/◀(5s)/🔁(hold-loop last 3s)/▶(10s). Khi load subtitle → expand 6 nút 2 cột, ◀▶ thành sentence mode.
6. **Collapse threshold**: 20px từ mép video (cluster edge within 20px of video bounds = trigger collapse). Half-circle 32px diameter, tap target 44px (padding 6px).
7. **Cột phụ mirror**: cluster ở mép trái → cột phụ ⏪⏩ nhô bên phải (default). Cluster ở mép phải → cột phụ nhô bên trái (CSS flip). Quyết định mirror dựa trên cluster position vs video center.
8. **Multiple video elements**: bind active video — cùng logic `contentScriptController` (1 controller per video, init trên video detected). Cluster 1:1 với controller.
9. **Settings schema**: thêm 7 fields vào `Settings` (xem §Settings Schema). Schema version bump 1→2 + migration.
10. **Drag 2-axis**: ADR-015 drag chỉ Y-axis (subtitle yOffset). Cluster drag X+Y 2-axis — math mới (clamp trong `videoWrapper.getBoundingClientRect()`). Persist `{x, y}` percent (giống yOffsetPercent pattern).
11. **Pointer Events** cover mouse + touch (ADR-015 verify). Không cần touch-specific handler.
12. **No new dependency** — ponytail rung 5: native Pointer Events + reuse `findCurrentLine` + reuse drag pattern.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (content script)
- **UI**: React 19, Zustand 5, TypeScript 6 — nhưng cluster là **vanilla DOM** (giống subtitle overlay ADR-013, không React trong content script)
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Testing**: Jest 30 (unit), Edge DevTools MCP (browser verify)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell)
- **No new dependency** — native Pointer Events + reuse existing subtitle infra.

## Dependencies & Fallbacks

| Dependency | Owner | Available | Used For | Fallback |
|---|---|---|---|---|
| `findCurrentLine` | `src/features/subtitle/logic/subtitleSync.ts` | Now | current cue lookup (binary search) | Production: fail unit test if missing. Tests: linear nearest-cue helper. |
| Pointer Events + `setPointerCapture` | Browser platform | Chrome/Edge now | mouse + touch drag | If unsupported, cluster stays at saved/default position; buttons still work. |
| `chrome.storage.local` via `settingsStore` | Extension platform / shared storage | Now | settings + position persist | Runtime defaults, no persistence for session, non-blocking console warning. |
| Edge MCP | QA / browser verification | G5 | real browser acceptance | Playwright or manual Edge fallback with same steps. |
| lordflix/kisskh pages | External websites | Unknown per run | realistic video page verify | Local HTML fixture with `<video>` + injected cues for deterministic acceptance. |
| Fullscreen container detection | Browser platform (`fullscreenchange` event) | Now | cluster re-parent on fullscreen | If detection fails, attach to current `video.parentElement` and re-parent on next `fullscreenchange`. |
| Settings UI (`SettingsDialog.tsx`) | `src/features/settings/ui/` | Now | settings panel for cluster config | If panel mount fails, cluster uses defaults; settings editable via `chrome.storage` direct. |

## Commands

```bash
Build:            npm run build
Typecheck:        npm run typecheck
Test unit only:   npm run test:unit         # ~3s
Test integration: npm run test:integration
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

## Project Structure

```
src/
├── features/
│   └── subtitle/
│       ├── ui/
│       │   ├── navCluster.ts                  # NEW — createNavCluster (DOM build, 6 nút 2 cột)
│       │   ├── navClusterDrag.ts              # NEW — drag 2-axis + collapse + persist position
│       │   ├── navClusterActions.ts           # NEW — prev/next sentence, repeat hold, seek 5s/10s (pure)
│       │   ├── navClusterShortcuts.ts         # NEW — kbd handler (◀▶ R hold, < >)
│       │   ├── subtitleOverlay.ts             # EDIT — wire cluster vào controller init
│       │   └── contentScriptController.ts     # EDIT — wire cluster lifecycle + kbd
│       └── logic/
│           └── subtitleSync.ts                # REUSE — findCurrentLine (binary search)
├── entities/
│   ├── settings/
│   │   └── types.ts                           # EDIT — add NavClusterSettings interface
│   └── subtitle/
│       └── types.ts                           # EDIT — add NavClusterPosition {x,y}
├── shared/
│   ├── config/
│   │   └── config.ts                          # EDIT — DEFAULT_NAV_CLUSTER_SETTINGS
│   └── lib/
│       └── storage/
│           └── settingsStore.ts               # EDIT — migration v1→v2 (nav cluster fields)
└── features/
    └── settings/
        └── ui/
            └── SettingsDialog.tsx             # EDIT — add NavClusterSettingsPanel

tests/
└── unit/
    └── features/
        └── subtitle/
            └── ui/
                ├── navCluster.test.ts              # NEW — DOM build, layout states
                ├── navClusterDrag.test.ts          # NEW — drag 2-axis + collapse + persist
                ├── navClusterActions.test.ts       # NEW — prev/next/repeat/seek pure logic
                └── navClusterShortcuts.test.ts     # NEW — kbd mapping
```

## Code Style

Named exports, typed props, JSDoc, vanilla DOM (no React in content script — mimic `subtitleUI.ts` pattern):

```typescript
// navCluster.ts
interface NavClusterConfig {
  /** Position percent relative to video container. Default {x:0, y:75}. */
  position: NavClusterPosition;
  /** Button size px. 44 desktop, 56 touch. Customizable. */
  buttonSize: number;
  /** Background opacity 0-1. */
  backgroundOpacity: number;
  /** Button opacity 0-1. */
  buttonOpacity: number;
  /** Theme — follows dark/light mode. */
  theme: 'light' | 'dark';
}

export function createNavCluster(
  video: HTMLVideoElement,
  container: HTMLElement,
  config: NavClusterConfig,
  callbacks: NavClusterCallbacks,
): NavClusterHandle { ... }
```

## Testing Strategy

- **Unit** (`tests/unit/.../navCluster*.test.ts`): DOM build, layout states (expanded/collapsed, 6-nút/4-nút adaptive), drag math (2-axis clamp), collapse trigger, prev/next index logic, repeat hold state machine, seek pure functions, kbd mapping. ~15-20 tests.
- **Integration**: không thêm — reuse existing subtitle integration test infra nếu cần.
- **Browser verify** (Edge MCP, G5): drag cluster, prev/next sentence, repeat hold loop, seek 5s/10s, collapse/expand, no-sub adaptive, settings persist, dark/light, fullscreen, touch (tablet mode).
- **Coverage**: ≥80% cho nav cluster files (giống subtitle overlay coverage).

## Boundaries

- **Always do**: Run `npm run test:unit` + `npx tsc --noEmit` before commit. Browser verify (Edge MCP) cho browser-facing change. Update `docs/2-architechture-system.md` 3 chỗ khi add/rename files.
- **Ask first**: Add new dependency, modify `manifest.json`, change settings schema version (migration needed).
- **Never do**: Commit secrets, edit `dist/`, break existing subtitle overlay/shortcuts (a/d/s/w/t phải vẫn hoạt động).

## Success Criteria (Acceptance Criteria)

### Functional (F)

- **F1**: Cluster hiển thị 6 nút 2 cột (⋯/◀/🔁/▶ main + ⏪/⏩ secondary) khi subtitle đã load, 4 nút 1 cột (⋯/◀/🔁/▶) khi chưa load. **Verify: A1, A8.**
- **F2**: Drag handle ⋯ press+drag → cluster follow pointer trong video bounds (clamp). Release = drop. Position persist vào `chrome.storage`. **Verify: A2.**
- **F3**: Double-click ⋯ → reset position về default (x=0%, y=75%). **Verify: A3.**
- **F4**: Drag ⋯ đến within 20px mép video → collapse thành half-circle 32px edge-stuck (mirror theo mép). Tap half-circle = expand lại tại vị trí trước collapse. **Verify: A4.**
- **F5**: ◀ prev sentence — `findCurrentLine` index-1, seek `cues[index].start / 1000`. Fallback 5s rewind khi gap >5s. **Verify: A5.**
- **F6**: ▶ next sentence — index+1, seek. Fallback 10s forward khi gap >5s. **Verify: A5.**
- **F7**: 🔁 hold ≥500ms → loop cue start→end (seek về start khi đến end). Release → stop loop, tiếp tục playback. Icon đổi state (idle/looping). **Verify: A6.**
- **F8**: ⏪ rewind 5s (`video.currentTime -= 5`). ⏩ forward 10s (`video.currentTime += 10`). **Verify: A7.**
- **F9**: No-sub adaptive — `cues.length === 0` → ⏪⏩ ẩn, ◀▶ thành time mode (5s/10s), 🔁 giữ nguyên hold-loop nhưng dùng time window mặc định `[holdStartTime - 3s, holdStartTime]`. Load subtitle → expand 6 nút, ◀▶ sentence mode, 🔁 loop cue start→end. **Verify: A8.**
- **F10**: Settings panel — size (small/medium/large slider), background opacity, button opacity, off toggle. Persist realtime (giống subtitle style ADR-013 D3). **Verify: A9.**
- **F11**: Off toggle → confirm dialog giữa overlay ("Đóng control cluster? Yes/No") → Yes = hide cluster + persist `navClusterEnabled: false`. **Verify: A9.**
- **F12**: Keyboard shortcuts parallel — ◀ (ArrowLeft) = prev, ▶ (ArrowRight) = next, R hold = repeat, `<` = rewind 5s, `>` = forward 10s. Guard editable target (reuse `isEditableTarget`). **Verify: A10.** Fixed parallel (không replace a/d existing shortcuts).
- **F13**: Dark/light mode — color theo `prefers-color-scheme` hoặc settings theme. Realtime switch. **Verify: A11.**
- **F14**: Fullscreen — cluster neo vào fullscreen container (reuse ADR-013 pattern), không bị mất khi video fullscreen. **Verify: A12.**
- **F15**: Cột phụ mirror — cluster mép trái → ⏪⏩ nhô phải; mép phải → nhô trái. **Verify: A13.**

### Non-Functional (NF)

- **NF1**: Touch target ≥44px desktop, ≥56px touch (WCAG 2.5.5). Size customizable trong settings. **Verify: unit DOM assertion (`getBoundingClientRect`) + A11 visual.**
- **NF2**: Cluster không che subtitle overlay (z-index 1000001, pointer-events chỉ trên cluster). Subtitle overlay drag (ADR-015) vẫn hoạt động ở vùng không overlap. **Verify: A14.**
- **NF3**: Drag mượt — `setPointerCapture` giữ drag khi pointer đi qua video controls native. 60fps (no layout thrash, transform thay position). **Verify: unit + A2 visual smoothness.**
- **NF4**: Position persist debounced 300ms (giống ADR-013 yOffset persist pattern). **Verify: unit (jest fake timers) + A2 reload.**
- **NF5**: No-sub adaptive render <16ms (toggle CSS class, không recreate DOM). **Verify: unit (performance.now delta).**
- **NF6**: Repeat loop seek không gây audio glitch — seek về start khi currentTime ≥ end (timeupdate check), không setInterval. **Verify: A6.**
- **NF7**: Keyboard shortcuts không conflict với host page (audit G4, fallback J/L nếu `<` `>` bị capture). **Verify: A10 + G4 host audit.**
- **NF8**: Cluster ARIA — `role="toolbar"` + `aria-label="Subtitle navigation"`, mỗi nút `aria-label` riêng + `aria-pressed` cho repeat/toggle. **Verify: unit DOM assertion + Edge MCP accessibility snapshot.**
- **NF9**: Settings schema migration v1→v2 — existing users không mất settings, nav cluster fields merge với defaults. **Verify: unit (migration test) + Rollback & Migration Failure Strategy section.**

### Acceptance (A) — browser verify (Edge MCP)

> Selectors use `data-testid` attributes set on cluster elements. Edge MCP probes via `Runtime.evaluate` + DOM clicks. Fallback: Playwright or manual Edge with same steps.

| ID | Precondition | Steps | Expected | Verify method | Selector/Probe |
|---|---|---|---|---|---|
| A1 | lordflix video page, subtitle loaded | Open page, wait cluster render | 6 nút 2 cột visible: ⋯/◀/🔁/▶ main + ⏪/⏩ secondary | Edge MCP DOM query: count buttons + layout class | `[data-testid="nav-cluster"]`, `[data-testid="nav-cluster-main"]`, `[data-testid="nav-cluster-secondary"]` |
| A2 | Cluster visible, video loaded | Record `pos0 = cluster.getBoundingClientRect()`; pointerdown on ⋯, pointermove +50px x +30px y, pointerup; reload page | Cluster moves to new pos; after reload, position restored (persist debounced 300ms) | Edge MCP `Runtime.evaluate` getBoundingClientRect + `chrome.storage.local.get` | `[data-testid="nav-cluster-drag-handle"]` |
| A3 | Cluster at custom position | Double-click ⋯ | Cluster position = {x:0%, y:75%} of video container | Edge MCP getBoundingClientRect + compute percent | `[data-testid="nav-cluster-drag-handle"]` |
| A4 | Cluster visible | pointerdown on ⋯, pointermove to within 20px of left edge, pointerup | Cluster collapses to half-circle 32px stuck left edge; tap half-circle → expand at pre-collapse position | Edge MCP DOM query: collapsed class + size | `[data-testid="nav-cluster-collapsed"]` |
| A5 | Subtitle loaded, video playing | Record `t0 = video.currentTime`, `idx = findCurrentLine(cues, t0*1000)`; click ◀; record `t1`; click ▶; record `t2` | `t1 ≈ cues[idx-1].start/1000` (±0.25s); `t2 ≈ cues[idx+1].start/1000` (±0.25s); fallback 5s/10s when gap >5s | Edge MCP `Runtime.evaluate` + cue array probe | `[data-testid="nav-cluster-prev"]`, `[data-testid="nav-cluster-next"]` |
| A6 | Subtitle loaded, video playing | pointerdown on 🔁, hold 600ms, wait 1 loop cycle, pointerup | While holding: loop cue start→end (seek to start when currentTime ≥ end); after release: stop loop, continue playback; icon state changes (idle/looping) | Edge MCP `Runtime.evaluate` currentTime tracking + `aria-pressed` | `[data-testid="nav-cluster-repeat"]`, `[aria-pressed]` |
| A7 | Video loaded | Record `t0 = video.currentTime`; click ⏪; record `t1`; click ⏩; record `t2` | `Math.abs(t1 - Math.max(0, t0-5)) < 0.25`; `Math.abs(t2 - Math.min(duration, t1+10)) < 0.25` | Edge MCP `Runtime.evaluate` | `[data-testid="nav-cluster-rewind"]`, `[data-testid="nav-cluster-forward"]` |
| A8 | Cluster visible (sub loaded) | Trigger subtitle unload (clear cues); observe cluster; trigger subtitle load; observe cluster | Unload: ⏪⏩ hidden, ◀▶ become time mode (5s/10s), 🔁 hold loops last 3s from hold start. Load: expand 6 nút, ◀▶ sentence mode, 🔁 loops cue start→end | Edge MCP DOM query + A5/A7 re-run for time mode | `[data-testid="nav-cluster-secondary"]` (hidden), `[data-testid="nav-cluster-prev"]` (time mode) |
| A9 | Settings dialog open | Open SettingsDialog, find NavCluster panel; adjust size slider, bg opacity slider, btn opacity slider; toggle off → confirm dialog → Yes | Settings persist realtime (cluster updates live); off toggle shows confirm dialog; Yes hides cluster + persists `navClusterEnabled:false` | Edge MCP DOM query + `chrome.storage.local.get` | `[data-testid="nav-cluster-settings-panel"]`, `[data-testid="nav-cluster-off-toggle"]`, `[data-testid="nav-cluster-confirm-dialog"]` |
| A10 | Video page focused (not in input/textarea) | Press ArrowLeft, ArrowRight, hold R 600ms, press `<`, press `>` | Same as A5 (prev/next), A6 (repeat hold), A7 (seek 5s/10s). Editable guard: focus `<input>`, press ArrowLeft → no seek | Edge MCP `Input.dispatchKeyEvent` + `Runtime.evaluate` | n/a (keyboard) |
| A11 | Cluster visible | Toggle `prefers-color-scheme` dark↔light (or settings theme) | Cluster color switches realtime (bg, button, icon) | Edge MCP `Emulation.setEmulatedMedia` + getComputedStyle | `[data-testid="nav-cluster"]` computed `background-color` |
| A12 | Cluster visible | Enter video fullscreen (`video.requestFullscreen`) | Cluster re-parents into fullscreen container, still visible + functional; exit fullscreen → cluster back to video parent | Edge MCP `Runtime.evaluate` `document.fullscreenElement` + DOM query | `[data-testid="nav-cluster"]` parent |
| A13 | Cluster visible | Drag cluster to right edge (within 20px); observe secondary column | Secondary column ⏪⏩ flips to left side (mirror); drag back to left → secondary flips back to right | Edge MCP getBoundingClientRect + layout class | `[data-testid="nav-cluster-secondary"]` class `mirror-left`/`mirror-right` |
| A14 | Subtitle overlay visible (ADR-015) | Drag subtitle overlay background (not on cluster) | Subtitle overlay drag still works in non-overlap region; cluster drag does not affect subtitle overlay | Edge MCP pointer events + getBoundingClientRect | `[data-testid*="subtitle-overlay"]` |
| A15 | Video page, existing shortcuts a/d/s/w/t | Press a, d, s, w, t | Existing shortcuts still work (prev-cue, next-cue, replay-cue, toggle-overlay, toggle-panel) — not broken by cluster | Edge MCP `Input.dispatchKeyEvent` + observe panel/overlay state | n/a (keyboard) |

## Settings Schema

```typescript
// entities/settings/types.ts — add to Settings
interface NavClusterSettings {
  /** Enable/disable cluster. Default: true. */
  enabled: boolean;
  /** Position percent relative to video container {x, y} 0-100. Default {x:0, y:75}. */
  position: NavClusterPosition;
  /** Button size px. Preset: 40 (small), 48 (medium), 56 (large). Default 48. */
  buttonSize: number;
  /** Background opacity 0-1. Default 0.7. */
  backgroundOpacity: number;
  /** Button opacity 0-1. Default 0.9. */
  buttonOpacity: number;
  /** Collapsed state. Default false. */
  collapsed: boolean;
}

interface NavClusterPosition {
  x: number; // 0-100 percent
  y: number; // 0-100 percent
}
```

**Migration v1→v2**: merge `DEFAULT_NAV_CLUSTER_SETTINGS` cho existing users (giống migration v0→v1 pattern trong `settingsStore.ts`).

## Rollback & Migration Failure Strategy

Migration v1→v2 phải **atomic từ caller perspective**:

1. **On load**: copy raw v1 settings, merge `DEFAULT_NAV_CLUSTER_SETTINGS`, validate nav fields (clamp position 0-100, opacity 0-1, buttonSize ∈ {40,48,56}, enabled boolean, collapsed boolean), then save v2.
2. **If save fails**: return runtime settings with nav defaults, **do not mutate storage again in a loop** (avoid retry storm). Log once.
3. **If any nav field invalid**: clamp to defaults, persist only after successful full settings validation.
4. **Existing v1 settings remain usable**: v1-compatible callers ignore unknown nav fields (forward-compat via `{ ...DEFAULT_SETTINGS, ...raw }` merge in `loadSettings`).
5. **Rollback semantics**: removing nav fields + resetting `schemaVersion` is **not required** — v1 callers ignore unknown fields. If user downgrades extension, nav fields are silently ignored (no crash).
6. **`navClusterEnabled` / position defaults recover**: if storage cleared, `loadSettings` returns `DEFAULT_SETTINGS` (nav enabled, position {x:0, y:75}). Cluster renders at default.

## Data Flow

```
video.timeupdate → findCurrentLine(cues, currentTimeMs) → index
                                                          ↓
navClusterActions.prevSentence(video, cues, index) → video.currentTime = cues[index-1].start / 1000
navClusterActions.nextSentence(video, cues, index) → video.currentTime = cues[index+1].start / 1000
navClusterActions.repeatHold(video, cues, index) → loop: if currentTime≥cue.end/1000 → seek cue.start/1000
navClusterActions.seek(video, ±seconds) → video.currentTime ±= seconds

⋯ pointerdown → navClusterDrag.startDrag → pointermove → clamp position → transform cluster
                                                            → persist debounced 300ms → chrome.storage
⋯ dblclick → reset position {x:0, y:75} → persist
⋯ drag-to-edge (within 20px) → collapse → half-circle → persist collapsed:true

chrome.storage.onChanged → navCluster.updateConfig (realtime, ADR-013 D3 pattern)
settings.navClusterEnabled === false → hide cluster + confirm dialog on toggle

kbd keydown → navClusterShortcuts.handleKey → action → navClusterActions.*
```

## Edge Cases

### Layout / No-sub adaptive
- Subtitle unloaded mid-playback → cluster transitions 6-nút → 4-nút without recreate DOM (CSS class toggle).
- Subtitle reloaded after unload → cluster transitions 4-nút → 6-nút, ◀▶ switch time→sentence mode.
- Both target + native cues empty but `bilingual: true` flag stale → treat as no-sub (check `cues.length === 0 && nativeCues.length === 0`).

### Drag / Collapse
- Window resize after persisted position → clamp position into new video bounds on next render.
- Pointer leaves iframe/video bounds during drag → `setPointerCapture` keeps drag; on `pointerup` outside, clamp to last in-bounds position.
- Collapsed state restored on opposite-size viewport (e.g. landscape→portrait) → half-circle re-sticks to nearest edge of new bounds.
- Right-edge mirror with secondary column: cluster at right edge, secondary column ⏪⏩ flips left; tap expand → secondary stays left until cluster moves away from right edge.

### Prev/Next sentence
- Prev at first cue (index 0) → no-op (no cue before first); optional 5s rewind fallback.
- Next at last cue (index = cues.length-1) → no-op; optional 10s forward fallback.
- Current time in cue gap (`findCurrentLine === -1`) → prev = nearest previous cue, next = nearest next cue (binary search neighbors).
- Gap exactly 5000ms between cues → boundary: ≤5000ms = sentence jump, >5000ms = time fallback.

### Repeat hold
- Release before 500ms → no loop, treat as no-op (or single replay — ponytail: no-op to avoid accidental replay).
- `pointercancel` / `keyup` outside window during hold → end loop, seek to current playback position (no jump).
- Cue changes while holding (rare, timeupdate fires) → loop boundary updates to new cue start/end.
- No cue at current time + hold → use no-sub time window `[holdStartTime - 3s, holdStartTime]` (clamp to 0).

### Seek 5s/10s
- `currentTime < 5s` + rewind → clamp to 0.
- `currentTime` near `duration` + forward → clamp to `duration`.
- `duration` is `NaN`/`Infinity` (live stream) → clamp lower bound only (0); forward = no-op or +10s without upper clamp.

### Settings / Persistence
- Invalid opacity in storage (e.g. 1.5, -0.3) → clamp to [0, 1], persist corrected.
- Invalid buttonSize (e.g. 33) → snap to nearest preset {40, 48, 56}.
- `chrome.storage.save` rejected (quota exceeded) → keep in-memory config, log once, no blocking dialog.
- Off toggle canceled in confirm dialog → cluster stays visible, `navClusterEnabled` unchanged.

### Keyboard shortcuts
- ArrowLeft/ArrowRight pressed while focus in `<input>`/`<textarea>`/`[contenteditable]` → no-op (`isEditableTarget` guard).
- R key held, then focus moves to editable → keyup may not fire → `blur`/`visibilitychange` listener cancels repeat.
- `<` `>` captured by host page (lordflix/kisskh) → fallback to J/L (audit G4, configurable in settings v2).
- Existing a/d/s/w/t shortcuts pressed while cluster open → both work (cluster shortcuts are parallel, not replacement).

### Fullscreen
- Fullscreen element is not video parent (e.g. user fullscreen a different element) → cluster stays in original video parent, hidden behind fullscreen.
- Enter fullscreen after cluster created → re-parent cluster into fullscreen container on `fullscreenchange`.
- Exit fullscreen → re-parent back to original video parent.

## Error States & Recovery

- **Storage load fails**: use `DEFAULT_NAV_CLUSTER_SETTINGS`, cluster remains usable, persistence disabled for current page session, log once.
- **Storage save fails**: keep in-memory position/config, no blocking dialog, log once.
- **Migration fails validation**: keep old v1 settings, merge nav defaults at runtime, do not persist partial migration (see Rollback & Migration Failure Strategy).
- **No cues / `findCurrentLine === -1`**: prev = nearest previous cue if available; next = nearest next cue if available; repeat no-sub uses 3s window; if no valid time window (currentTime < 3s), no-op.
- **Seek target clamps to `[0, duration]`** when finite; if `duration` unknown (`NaN`/`Infinity`), clamp lower bound only (0).
- **Pointer capture lost** (`pointercancel`, `lostpointercapture`): end drag, clamp current position, persist if changed.
- **Fullscreen container unavailable**: attach to current `video.parentElement`, re-parent on next `fullscreenchange`.
- **Host shortcut capture** (`<` `>` taken by host page): fallback to J/L (audit G4, configurable in settings v2).
- **Browser verify page unavailable** (lordflix/kisskh down, Edge MCP quota): use local HTML fixture with `<video>` + injected cues + Playwright/manual Edge fallback with same A1-A15 steps.

## Keyboard State Machine (repeat hold + seek)

Repeat hold uses **keydown + keyup state machine** (not single keydown → action like existing shortcuts):

```
keydown(R) [not repeat, not editable]
  → if not already looping: start loop (cue start→end OR no-sub 3s window)
  → ignore auto-repeat keydown events (e.repeat === true)
keyup(R) OR blur OR visibilitychange(hidden) OR pointercancel
  → stop loop, continue playback
```

- **Schema decision**: cluster shortcuts (ArrowLeft, ArrowRight, R hold, `<`, `>`) are **fixed parallel shortcuts**, NOT added to existing `keyboardShortcuts` settings array (which controls a/d/s/w/t). Existing `ShortcutAction` union does NOT expand. Rationale: cluster shortcuts are gesture-equivalent for touch users, fixed for discoverability. Ceiling v2: make configurable.

## Cue Source Decision

Prev/Next/Repeat operates on **target cues** as primary source:

- **Primary**: `controller.cues` (target cues) — `findCurrentLine(cues, currentTimeMs)` → index ± 1 for prev/next.
- **Fallback when target empty**: `controller.nativeCues` — same `findCurrentLine` logic.
- **NOT merged bilingual cues**: existing `contentScriptController` shortcuts use `bilingualCues` (panel display merge), but merged cues are for panel display, not timing source. Cluster uses raw cue arrays for accurate timing.
- **Bilingual mode**: cluster operates on target cues only (target = learning language). Native cues are translation reference, not navigation target. If target empty + native present, fallback to native.

## Out of Scope (v1)

- CC1/CC2 toggle (subtitle target/native toggle) — anh yêu explicit, phát triển sau.
- A-B tap repeat (set A → set B → loop) — rejected G1, giữ hold-to-loop.
- 2 layout riêng desktop/mobile — dùng 1 responsive component.
- Click-count semantics (2/3/4 lần) — rejected, gesture-based + settings toggle.
- Long-press trên prev/next cho time seek — rejected, tách nút ⏪⏩ riêng.
- Auto-hide theo idle timer — rejected, dùng collapse mode thay thế.
- A-B tap repeat when no subtitle — rejected; no-sub repeat uses hold-loop last-3s time window instead.
- Cluster draggable ra ngoài video bounds — clamp trong video bounds only.

## Open Questions (resolve ở G2 Plan / G4 Implementation)

- **Host page kbd conflict**: lordflix/kisskh có capture `<` `>` không? Audit G4, fallback J/L.
- **No-sub repeat window length**: mặc định 3s trước điểm hold (`[holdStartTime - 3s, holdStartTime]`). G2 quyết có cần setting `noSubtitleLoopSeconds` hay hardcode 3s v1.
- **Half-circle visual**: 32px diameter, lồi hướng vào trong video. SVG hay CSS border-radius? (G3 design.)
- **Settings panel placement**: thêm tab mới "Navigation" trong SettingsDialog hay gộp vào tab "Subtitle"? (G3 design.)
- **Cluster initial render timing**: render ngay khi `contentScriptController.init` hay đợi subtitle load? (Suggest ngay — user có thể seek 5s/10s trước khi load subtitle.)

## Related

- **Intent**: `docs/intent/intent-subtitle-navigation-control.md`
- **Builds on**: ADR-013 (2 overlay layer + drag + persist pattern), ADR-015 (drag trực tiếp + Pointer Events), `subtitleSync.ts` (`findCurrentLine`), `subtitleShortcuts.ts` (kbd pattern), `subtitlePanel.ts:seekToCue` (seek helper), `settingsStore.ts` (schema migration pattern).
- **Does NOT break**: existing kbd shortcuts (a/d/s/w/t), subtitle overlay drag (ADR-015), bilingual subtitle auto-load (ADR-007), subtitle manager panel (ADR-015 T11).
