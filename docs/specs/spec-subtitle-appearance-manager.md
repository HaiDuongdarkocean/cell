# Spec: Subtitle Appearance Manager

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-29
> **Intent source**: `docs/intent/intent-subtitle-appearance-manager.md`

## Objective

Tách subtitle overlay hiện tại (1 div chứa 2 span target+native chung, hardcoded style) thành **2 overlay layer độc lập** với full appearance control per-overlay, drag handle trực quan, realtime persist, live preview. Giúp người học ngoại ngữ tùy biến giao diện subtitle cho phù hợp khoảng cách màn hình, nền video, ngôn ngữ (CJK/Ả Rập/Latin cần font khác), và ưu tiên nổi bật target hay native.

**User**: Người học ngoại ngữ xem phim/video với bilingual subtitle overlay trên trang web (content script).

**Why now**: `OverlayConfig` type đã có móng (fontSize, position, colors) nhưng hardcoded trong `DEFAULT_OVERLAY_CONFIG` (`content-script.ts:69`, comment `"settings wiring is phase 2"`). Settings dialog chưa có appearance control. Đây là gap rõ ràng, user explicitly request.

**Success**:
- 2 overlay độc lập, mỗi cái tùy biến đầy đủ (font size, color, bg+alpha, shadow, font-family, opacity, position, align)
- Drag handle kéo lên/xuống trực quan, không xung đột select-text
- Realtime apply (kéo slider → overlay đổi ngay, debounce ~50ms)
- Persist chrome.storage, đổi tab không mất
- Live preview trong settings dialog
- Reset to defaults 1 nút
- Performance: không lag video playback (binary search không đổi, chỉ tách output 2 div)

## Assumptions (surface trước khi spec nội dung)

1. **2 overlay layer độc lập** — refactor `createOverlay` (1 div 2 span) → 2 div độc lập (`targetOverlay` + `nativeOverlay`), mỗi cái 1 text span + 1 drag handle.
2. **Y-offset = % video height**, step 1%, range 0–95%. Responsive khi resize/fullscreen. Drag handle cũng ra %.
3. **Text shadow**: 3 preset (None / Soft / Cinema) + 1 nút "Custom" expand ra 4 field (color / blur px / offsetX px / offsetY px).
4. **Font family**: dropdown 3 system font (sans-serif / serif / monospace) + 1 custom input text field (CSS `font-family` string, user paste font đã cài máy, ví dụ `"Noto Sans JP, sans-serif"`). **Không upload font** (security + bundle size), **không web font bundle** (latency + size), nhưng mở 100% cho mọi ngôn ngữ qua CSS fallback chain.
5. **Settings dialog layout**: tab "Target" / "Native" — per-overlay độc lập rõ ràng, gọn UI.
6. **Native off** → ẩn cả overlay native (không chỉ handle). Toggle trong settings + hotkey (nếu muốn, v2).
7. **Realtime apply**: popup `updateSettings(partial)` → `chrome.storage.local.set` → content script listen `chrome.storage.onChanged` → update inline style (không recreate overlay). Debounce ~50ms cho slider drag.
8. **Persist**: mở rộng `Settings` type thêm `subtitleOverlayTargetStyle` + `subtitleOverlayNativeStyle` (mỗi cái 1 object `OverlayStyleConfig`).
9. **Drag handle**: icon SVG `move-vertical` (Lucide-style, 2 mũi tên lên-xuống), vùng nhỏ ở cạnh overlay, `pointer-events: auto` chỉ trên handle, text span giữ `user-select: text` (copy word tra cứu không bị xung đột).
10. **Live preview**: trong settings dialog, 1 text sample (không cần video thật) với style áp dụng realtime — đủ để thấy font/color/shadow/size, không cần preview position (position chỉ thấy trên video thật).

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (content script + popup React + background service worker)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Testing**: Jest 30 (unit + integration), Playwright (E2E)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell)
- **No new dependency** — ponytail rung 5 (installed dep): không cần lib, dùng native DOM + React + Zustand hiện có. Drag = native `pointerdown/move/up`. Color picker = native `<input type="color">`. Slider = native `<input type="range">`.

## Commands

```bash
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test
Test unit only:   npm run test:unit         # ~3s, day-to-day
Test integration: npm run test:integration
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

Note: `npm test -- --testPathPattern=` deprecated in jest 30; dùng `--testPathPatterns=`.

## Project Structure (files likely touched)

```
src/
├── types/
│   ├── subtitle.ts                    # MODIFY: OverlayConfig → OverlayStyleConfig (per-overlay), thêm shadow/fontFamily/opacity/align/yOffset
│   └── media.ts                       # MODIFY: Settings type thêm subtitleOverlayTargetStyle + subtitleOverlayNativeStyle
├── constants/
│   └── config.ts                      # MODIFY: DEFAULT_SETTINGS thêm 2 default OverlayStyleConfig (target + native)
├── content/
│   ├── subtitleUI.ts                  # MODIFY: createOverlay → createOverlayLayer(role, config) — 2 div độc lập + drag handle + applyStyle()
│   ├── subtitleOverlay.ts             # MODIFY: SubtitleOverlayController — 2 overlay layer, 2 updateOverlayText, listen storage.onChanged
│   ├── subtitleDragPosition.ts        # NEW: drag handle logic (pointerdown/move/up → yOffset %), pure calc + DOM wire
│   └── content-script.ts              # MODIFY: DEFAULT_OVERLAY_CONFIG → load từ settings, wire storage.onChanged listener
├── popup/
│   ├── store/popupStore.ts            # MODIFY: updateSettings đã có, chỉ thêm field mới (auto-persist)
│   └── components/settings/
│       ├── SettingsDialog.tsx         # MODIFY: thêm tab Target/Native, gọi SubtitleStylePanel
│       ├── SubtitleStylePanel.tsx     # NEW: per-overlay appearance controls (font size, color, bg+alpha, shadow, font-family, opacity, align, yOffset input, reset)
│       ├── SubtitleStylePanel.module.css # NEW
│       ├── SubtitlePreview.tsx        # NEW: live preview text sample với style áp dụng realtime
│       └── SubtitlePreview.module.css # NEW
tests/
├── unit/
│   ├── subtitleDragPosition.test.ts   # NEW: pure calc yOffset% from pointer delta
│   ├── subtitleStyleApply.test.ts     # NEW: applyStyle(config, element) → assert inline style
│   └── subtitleOverlayLayer.test.ts   # NEW: createOverlayLayer(role) → 2 div độc lập, role data attr
└── integration/
    └── subtitleAppearance.integration.test.ts # NEW: storage.onChanged → overlay update realtime
docs/
├── specs/spec-subtitle-appearance-manager.md  # This spec
└── adr/NNN-subtitle-appearance-manager.md     # G3 — 2 overlay độc lập + drag handle architecture
```

## Code Style

**Example snippet** (ponytail: minimal, pure functions cho logic testable):

```typescript
// types/subtitle.ts — per-overlay style config (thay OverlayConfig cũ)
export interface OverlayStyleConfig {
  readonly fontSize: number;            // px, default 24 (target) / 20 (native)
  readonly textColor: string;           // hex, default '#ffffff'
  readonly backgroundColor: string;     // rgba, default 'rgba(0,0,0,0.7)'
  readonly backgroundOpacity: number;   // 0-1, tách rời khỏi color (alpha slider)
  readonly textOpacity: number;         // 0-1, default 1
  readonly textShadow: TextShadowConfig; // preset or custom
  readonly fontFamily: string;          // CSS font-family string, default 'sans-serif'
  readonly yOffsetPercent: number;      // 0-95, % video height, default 10 (target bottom) / 5 (native top)
  readonly horizontalAlign: 'left' | 'center' | 'right'; // default 'center'
  readonly visible: boolean;            // on/off, default true (target) / true (native, toggle C1)
}

export interface TextShadowConfig {
  readonly preset: 'none' | 'soft' | 'cinema' | 'custom';
  readonly color: string;     // hex, default '#000000'
  readonly blur: number;      // px, default 2
  readonly offsetX: number;   // px, default 1
  readonly offsetY: number;   // px, default 1
}

// Pure: calc yOffset% from pointer Y delta + container height
export function calcYOffsetPercent(
  pointerDeltaY: number,
  containerHeight: number,
  currentOffset: number,
): number {
  const deltaPercent = (pointerDeltaY / containerHeight) * 100;
  return clamp(Math.round(currentOffset + deltaPercent), 0, 95);
}

// Pure: build CSS text-shadow string from config
export function buildTextShadow(config: TextShadowConfig): string {
  if (config.preset === 'none') return 'none';
  if (config.preset === 'soft') return `0 1px 2px ${config.color}`;
  if (config.preset === 'cinema') return `2px 2px 4px ${config.color}`;
  return `${config.offsetX}px ${config.offsetY}px ${config.blur}px ${config.color}`;
}
```

**Conventions**:
- TypeScript strict mode — no `any` without justification
- Named exports (no default exports)
- Pure functions cho logic (calc, build string) — testable, no DOM
- Colocate tests: `subtitleDragPosition.ts` → `subtitleDragPosition.test.ts`
- `// ponytail:` comment cho deliberate simplifications
- Always pass `tabId` in message payloads (AGENTS.md rule)
- Functional components with hooks (no class components)

## Testing Strategy

**Framework**: Jest 30 (existing), Playwright (E2E)

**Test locations**:
- Unit (`tests/unit/`): pure logic — `calcYOffsetPercent`, `buildTextShadow`, `applyStyle` (assert inline style output)
- Integration (`tests/integration/`): `storage.onChanged` → overlay update realtime (mock storage event)
- E2E (`tests/e2e/`): full flow trên trang web thật — mở settings, đổi font size, kéo slider, kéo drag handle, verify overlay update

**Coverage expectations**:
- Pure logic (calc/build/apply): 100% — pure function, edge cases (clamp 0-95, preset none/custom)
- Drag position: 90%+ — pointer delta calc, boundary clamp
- Style apply: 90%+ — mỗi field → inline style đúng
- Storage sync: 80%+ — onChanged listener, debounce
- UI components: 70%+ — render, event handlers

**Test levels**:
- Unit: pure calc + build string + applyStyle (no DOM)
- Integration: storage.onChanged → overlay update (mock storage)
- E2E: real browser (MCP chrome-devtools/edge-devtools) — visual verify per AGENTS.md "browser-facing code verification"

## Boundaries

### Always do
- Run `npm run test:unit` + `npx tsc --noEmit` before commits
- Follow TypeScript strict mode
- Validate style values (yOffset 0-95, opacity 0-1, fontSize > 0) ở trust boundary (settings → apply)
- Performance: binary search không đổi (2 search song song đã có), chỉ tách output 2 div — không thêm per-frame work
- Browser-facing verify (MCP chrome-devtools/edge-devtools) trước khi commit — AGENTS.md stop-the-line rule
- Update `docs/2-architechture-system.md` khi thêm/sửa file src/

### Ask first
- Adding new dependencies (ponytail: native DOM + React đủ, không cần lib)
- Modifying `manifest.json`
- Changing `Settings` type shape (migration cho existing users — cần fill defaults)
- Refactor `subtitleOverlay.ts` controller (shared với download feature? — check dependency map)

### Never do
- Commit secrets
- Upload font files (security + bundle size — dùng CSS font-family string fallback)
- Break existing bilingual subtitle auto-load (ADR-007) — refactor phải giữ `loadBilingualCues` contract
- Break existing drag-drop/import/auto-load flows
- Remove existing tests without approval

## Functional Requirements (F)

### F1: 2 overlay layer độc lập
- F1.1: `createOverlayLayer(role: 'target' | 'native', config: OverlayStyleConfig, container)` → 1 div với `data-role="target|native"`, 1 text span, 1 drag handle
- F1.2: Target + native là 2 div riêng, không chung span, không chung position
- F1.3: Mỗi layer sync đúng cue qua binary search (target → targetCues, native → nativeCues) — reuse `loadBilingualCues` logic, chỉ tách output
- F1.4: z-index: target = 999999, native = 999998 (target nổi trên khi overlap) — visual feedback khi overlap (handle sáng, optional v2)

### F2: Appearance control per-overlay
- F2.1: Font size (slider 12-72px + input px, step 1)
- F2.2: Text color (color picker, hex)
- F2.3: Background color (color picker) + background opacity (slider 0-1, step 0.05) — tách rời, color không chứa alpha
- F2.4: Text opacity (slider 0-1, step 0.05)
- F2.5: Text shadow — 3 preset (None/Soft/Cinema) + Custom expand (color/blur/offsetX/offsetY)
- F2.6: Font family — dropdown (sans-serif/serif/monospace) + custom input text (CSS font-family string)
- F2.7: Horizontal align (left/center/right)
- F2.8: Y-offset (input %, step 1, range 0-95) — sync 2 chiều với drag handle

### F3: Drag handle
- F3.1: Icon SVG `move-vertical` (2 mũi tên lên-xuống) ở cạnh overlay, vùng nhỏ (~24x24px)
- F3.2: `pointerdown` trên handle → enter drag mode, `pointermove` → calc yOffset% (pure `calcYOffsetPercent`), `pointerup` → exit
- F3.3: Handle `pointer-events: auto`, text span giữ `user-select: text` (copy word không bị xung đột)
- F3.4: Drag trong fullscreen hoạt động (overlay append vào video-wrapper, ADR fullscreen-target-shared-container)
- F3.5: Drag realtime update overlay position + sync ngược về settings (debounce 50ms)

### F4: Native on/off
- F4.1: Toggle "Native subtitle visible" trong settings (default ON)
- F4.2: OFF → ẩn cả overlay native (display: none, không chỉ handle)
- F4.3: ON → hiện lại với style + position đã persist

### F5: Realtime apply + persist
- F5.1: Popup `updateSettings({ subtitleOverlayTargetStyle: partial })` → `chrome.storage.local.set` (đã có pattern trong popupStore)
- F5.2: Content script listen `chrome.storage.onChanged` → `applyStyle(config, overlay)` (update inline style, không recreate)
- F5.3: Debounce 50ms cho slider drag (tránh spam storage.set)
- F5.4: Persist 2 object: `subtitleOverlayTargetStyle` + `subtitleOverlayNativeStyle` (~400 bytes total)

### F6: Live preview
- F6.1: Trong settings dialog, mỗi tab (Target/Native) có 1 preview text sample
- F6.2: Sample text: "This is target subtitle sample" / "Đây là mẫu native subtitle"
- F6.3: Style áp dụng realtime (font size, color, bg, shadow, font-family, opacity) — position không preview (chỉ thấy trên video)
- F6.4: Preview background = dark (mock video nền tối) + light toggle (mock nền sáng) để test readability

### F7: Reset to defaults
- F7.1: Nút "Reset to defaults" trong mỗi tab (Target/Native) — reset chỉ tab đó
- F7.2: Confirm dialog trước reset (tránh mất config vô ý)
- F7.3: Reset → updateSettings với default OverlayStyleConfig cho role đó

## Non-Functional Requirements (NF)

- **NF1 Performance**: Binary search không đổi (2 search song song đã có). Drag = pointermove ~60fps, calc pure O(1). Style apply = set inline style, không recreate DOM. Không lag video playback.
- **NF2 Persistence**: chrome.storage.local, ~400 bytes total. Migration: existing users thiếu field → fill default (pattern đã có trong `loadPersistedSettings`).
- **NF3 Compatibility**: Chrome/Edge MV3, HTML5 `<video>`. Fullscreen hoạt động (ADR fullscreen-target-shared-container).
- **NF4 Accessibility**: Settings dialog keyboard-navigable (tab focus), color picker có label, slider có aria-valuenow/min/max. Drag handle có `aria-label="Drag to move subtitle"`, `role="slider"`, `aria-orientation="vertical"`.
- **NF5 Security**: No font upload, no eval, font-family string sanitize (chỉ cho phép font-family CSS, không cho URL/import). Validate yOffset 0-95, opacity 0-1, fontSize > 0 ở trust boundary.
- **NF6 i18n**: Font family mở cho mọi ngôn ngữ (CJK/Ả Rập/Latin) qua CSS font-family string fallback. UI label tiếng Anh (existing pattern).

## Acceptance Criteria (A)

- [ ] A1: Mở video có bilingual subtitle → 2 overlay độc lập hiện (target + native), mỗi cái position riêng
- [ ] A2: Mở settings → tab Target/Native, đổi font size slider → overlay đổi size realtime (debounce 50ms, không lag)
- [ ] A3: Đổi text color / bg color + opacity / text shadow / font family → overlay đổi realtime
- [ ] A4: Kéo drag handle target lên → target overlay di chuyển lên, yOffset% update trong input + persist
- [ ] A5: Kéo drag handle native xuống → native overlay di chuyển xuống, độc lập với target
- [ ] A6: Nhập Y-offset % trong input → overlay di chuyển, sync ngược drag handle
- [ ] A7: Toggle Native off → native overlay ẩn, target vẫn hiện; toggle on → native hiện lại với style cũ
- [ ] A8: Live preview trong settings hiển thị style realtime (dark + light bg toggle)
- [ ] A9: Reset to defaults → confirm → style reset về default, overlay update
- [ ] A10: Đóng popup, mở lại → style đã persist (không mất)
- [ ] A11: Đổi tab (video khác) → style vẫn persist (global profile, không per-site)
- [ ] A12: Fullscreen → drag handle vẫn hoạt động, overlay đúng position
- [ ] A13: Performance: kéo slider liên tục 5s → video playback không lag (FPS không giảm)
- [ ] A14: Browser verify (MCP chrome-devtools/edge-devtools) — A1-A12 pass trong real Chrome
- [ ] A15: `npm run test:unit` + `npx tsc --noEmit` pass
- [ ] A16: Existing bilingual auto-load (ADR-007) vẫn hoạt động — refactor không break `loadBilingualCues`

## Error Cases

- E1: chrome.storage.set fail (quota exceeded) → log error, giữ style hiện tại (không crash)
- E2: content script không nghe storage.onChanged (tab chưa inject) → style apply khi tab reload hoặc video scan lại
- E3: Font family string invalid (CSS parse fail) → fallback 'sans-serif', log warning
- E4: Y-offset ngoài range (drag quá nhanh) → clamp 0-95 (pure `calcYOffsetPercent` đã clamp)
- E5: Overlay container null (video removed) → skip apply, không crash

## Data Flow

```
Settings Dialog (popup)
  ├─ updateSettings({ subtitleOverlayTargetStyle: partial })
  ├─ popupStore.updateSettings → chrome.storage.local.set
  ├─ Debounce 50ms (slider drag)
  └─ Live preview (local state, không cần message)

chrome.storage.onChanged (event)
  └─ Content script listener
      ├─ Read settings.newValue.subtitleOverlayTargetStyle
      ├─ applyStyle(config, targetOverlay) — update inline style
      └─ applyStyle(config, nativeOverlay) — update inline style

Drag handle (content script)
  ├─ pointerdown → enter drag mode
  ├─ pointermove → calcYOffsetPercent(pure) → applyStyle position + debounce updateSettings
  └─ pointerup → exit drag mode, final persist

Video timeupdate (content script, không đổi)
  ├─ findCurrentLine(targetCues) → updateOverlayText(targetOverlay, text)
  └─ findCurrentLine(nativeCues) → updateOverlayText(nativeOverlay, text)
```

## Out of Scope (Not Doing — v2 hoặc không làm)

- Preset themes (Cinema/High-contrast/Minimal) — v2
- Border radius / padding / line-height fine control — hardcode default đẹp
- Export/import theme JSON — chưa cần
- Custom font upload — security + size, CSS font-family string đủ
- Per-site override profile — 1 global profile đủ
- Max width % control — hardcode 90%
- Swap order field — tự động qua vị trí độc lập (target kéo xuống, native kéo lên)
- Hotkey toggle native on/off — v2 (nếu cần)
- Visual feedback khi 2 overlay overlap (handle sáng) — v2

## Open Questions (RESOLVED trong spec này)

1. **Q1 Y-offset unit**: ✅ % (percent), step 1%, range 0-95. Responsive khi resize/fullscreen.
2. **Q2 Text shadow**: ✅ 3 preset (None/Soft/Cinema) + Custom expand 4 field.
3. **Q3 Font family**: ✅ Dropdown 3 system font + custom input text (CSS font-family string). Mở 100% cho mọi ngôn ngữ (CJK/Ả Rập) qua CSS fallback chain. Không upload, không web font bundle.
4. **Q4 Settings layout**: ✅ Tab Target/Native.
5. **Q5 Native off behavior**: ✅ Ẩn cả overlay native (display: none), không chỉ handle.

## Success Criteria (testable)

- [x] F1: 2 overlay độc lập hiện, mỗi cái position/style riêng (A1)
- [x] F2: 7 appearance control per-overlay hoạt động realtime (A2, A3)
- [x] F3: Drag handle kéo lên/xuống, sync Y-offset input + persist (A4, A5, A6)
- [x] F4: Native on/off toggle (A7)
- [x] F5: Realtime apply + persist (A2, A10, A11)
- [x] F6: Live preview (A8)
- [x] F7: Reset to defaults (A9)
- [x] NF1: Performance không lag (A13)
- [x] NF3: Fullscreen hoạt động (A12)
- [x] NF5: Font family mở cho mọi ngôn ngữ (F2.6)
- [x] A14: Browser verify pass
- [x] A15: test:unit + tsc pass
- [x] A16: Existing bilingual auto-load không break
