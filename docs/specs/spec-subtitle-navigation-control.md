# Spec: Subtitle Navigation Control Cluster (floating prev/repeat/next + seek + drag)

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-07-02
> **Intent source**: `docs/intent/intent-subtitle-navigation-control.md`
> **Related**: ADR-013 (subtitle-appearance-manager — 2 overlay layer + drag), ADR-015 (subtitle drag integrated — drag trực tiếp overlay background), `subtitleOverlay.ts` (sync + `findCurrentLine`), `subtitleShortcuts.ts` (kbd handler pattern), `subtitlePanel.ts:seekToCue` (seek helper)

## Objective

Build a **floating control cluster** injected into the video player container, giving mouse + touch users quick access to subtitle sentence navigation, repeat loop, and time seek — without keyboard, without obscuring the subtitle overlay, with drag-to-move positioning and a collapse mode.

**User**: Anh — người học ngoại ngữ xem video trên web (lordflix/kisskh) với bilingual subtitle overlay. Muốn tua theo câu, lặp lại câu khó, tua 5s/10s bằng chuột hoặc touch (tablet/phone), không muốn dùng keyboard.

**Why now**: Hiện tại navigation chỉ có qua keyboard shortcuts (a/d/s — `subtitleShortcuts.ts`). Touch/tablet users không có cách nào tua theo câu hoặc repeat mà không bật keyboard. Cluster floating giải quyết gap này + thêm seek 5s/10s (keyboard hiện không có).

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

- **F1**: Cluster hiển thị 6 nút 2 cột (⋯/◀/🔁/▶ main + ⏪/⏩ secondary) khi subtitle đã load, 4 nút 1 cột (⋯/◀/🔁/▶) khi chưa load.
- **F2**: Drag handle ⋯ press+drag → cluster follow pointer trong video bounds (clamp). Release = drop. Position persist vào `chrome.storage`.
- **F3**: Double-click ⋯ → reset position về default (x=0%, y=75%).
- **F4**: Drag ⋯ đến within 20px mép video → collapse thành half-circle 32px edge-stuck (mirror theo mép). Tap half-circle = expand lại tại vị trí trước collapse.
- **F5**: ◀ prev sentence — `findCurrentLine` index-1, seek `cues[index].startMs/1000`. Fallback 5s rewind khi gap >5s.
- **F6**: ▶ next sentence — index+1, seek. Fallback 10s forward khi gap >5s.
- **F7**: 🔁 hold ≥500ms → loop cue start→end (seek về start khi đến end). Release → stop loop, tiếp tục playback. Icon đổi state (idle/looping).
- **F8**: ⏪ rewind 5s (`video.currentTime -= 5`). ⏩ forward 10s (`video.currentTime += 10`).
- **F9**: No-sub adaptive — `cues.length === 0` → ⏪⏩ ẩn, ◀▶ thành time mode (5s/10s), 🔁 giữ nguyên hold-loop nhưng dùng time window mặc định `[holdStartTime - 3s, holdStartTime]`. Load subtitle → expand 6 nút, ◀▶ sentence mode, 🔁 loop cue start→end.
- **F10**: Settings panel — size (small/medium/large slider), background opacity, button opacity, off toggle. Persist realtime (giống subtitle style ADR-013 D3).
- **F11**: Off toggle → confirm dialog giữa overlay ("Đóng control cluster? Yes/No") → Yes = hide cluster + persist `navClusterEnabled: false`.
- **F12**: Keyboard shortcuts parallel — ◀ (ArrowLeft) = prev, ▶ (ArrowRight) = next, R hold = repeat, `<` = rewind 5s, `>` = forward 10s. Guard editable target (reuse `isEditableTarget`).
- **F13**: Dark/light mode — color theo `prefers-color-scheme` hoặc settings theme. Realtime switch.
- **F14**: Fullscreen — cluster neo vào fullscreen container (reuse ADR-013 pattern), không bị mất khi video fullscreen.
- **F15**: Cột phụ mirror — cluster mép trái → ⏪⏩ nhô phải; mép phải → nhô trái.

### Non-Functional (NF)

- **NF1**: Touch target ≥44px desktop, ≥56px touch (WCAG 2.5.5). Size customizable trong settings.
- **NF2**: Cluster không che subtitle overlay (z-index 1000001, pointer-events chỉ trên cluster). Subtitle overlay drag (ADR-015) vẫn hoạt động ở vùng không overlap.
- **NF3**: Drag mượt — `setPointerCapture` giữ drag khi pointer đi qua video controls native. 60fps (no layout thrash, transform thay position).
- **NF4**: Position persist debounced 300ms (giống ADR-013 yOffset persist pattern).
- **NF5**: No-sub adaptive render <16ms (toggle CSS class, không recreate DOM).
- **NF6**: Repeat loop seek không gây audio glitch — seek về start khi currentTime ≥ end (timeupdate check), không setInterval.
- **NF7**: Keyboard shortcuts không conflict với host page (audit G4, fallback J/L nếu `<` `>` bị capture).
- **NF8**: Cluster ARIA — `role="toolbar"` + `aria-label="Subtitle navigation"`, mỗi nút `aria-label` riêng + `aria-pressed` cho repeat/toggle.
- **NF9**: Settings schema migration v1→v2 — existing users không mất settings, nav cluster fields merge với defaults.

### Acceptance (A) — browser verify (Edge MCP)

- **A1**: Cluster hiển thị 6 nút 2 cột trên lordflix video page có subtitle.
- **A2**: Drag ⋯ → cluster move trong video bounds, release = drop, position persist (reload page → restore).
- **A3**: Double-click ⋯ → reset về x=0%, y=75%.
- **A4**: Drag ⋯ đến mép trái 20px → collapse half-circle trái, tap = expand.
- **A5**: ◀ → nhảy câu trước (verify currentTime = cue.startMs/1000). ▶ → nhảy câu sau.
- **A6**: 🔁 hold 500ms → loop câu (verify seek về start khi đến end). Release → stop.
- **A7**: ⏪ → currentTime -5. ⏩ → currentTime +10.
- **A8**: Unload subtitle → cluster gọn 4 nút, ◀▶ thành 5s/10s, 🔁 hold loops last 3s from hold start. Load subtitle → expand 6 nút, 🔁 loops cue start→end.
- **A9**: Settings → size slider, opacity sliders, off toggle + confirm dialog.
- **A10**: ◀ ▶ R `<` `>` kbd hoạt động (guard editable).
- **A11**: Dark/light mode switch → color đổi realtime.
- **A12**: Fullscreen video → cluster vẫn hiển thị trong fullscreen container.
- **A13**: Cột phụ mirror — drag cluster mép phải → ⏪⏩ nhô trái.
- **A14**: Subtitle overlay drag (ADR-015) vẫn hoạt động ở vùng không overlap cluster.
- **A15**: Existing kbd shortcuts (a/d/s/w/t) vẫn hoạt động (không break).

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

## Data Flow

```
video.timeupdate → findCurrentLine(cues, currentTimeMs) → index
                                                          ↓
navClusterActions.prevSentence(video, cues, index) → video.currentTime = cues[index-1].startMs/1000
navClusterActions.nextSentence(video, cues, index) → video.currentTime = cues[index+1].startMs/1000
navClusterActions.repeatHold(video, cues, index) → loop: if currentTime≥cue.endMs → seek cue.startMs
navClusterActions.seek(video, ±seconds) → video.currentTime ±= seconds

⋯ pointerdown → navClusterDrag.startDrag → pointermove → clamp position → transform cluster
                                                            → persist debounced 300ms → chrome.storage
⋯ dblclick → reset position {x:0, y:75} → persist
⋯ drag-to-edge (within 20px) → collapse → half-circle → persist collapsed:true

chrome.storage.onChanged → navCluster.updateConfig (realtime, ADR-013 D3 pattern)
settings.navClusterEnabled === false → hide cluster + confirm dialog on toggle

kbd keydown → navClusterShortcuts.handleKey → action → navClusterActions.*
```

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
