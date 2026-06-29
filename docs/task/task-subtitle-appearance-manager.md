# Task List: Subtitle Appearance Manager

> **Giai đoạn**: G4 Implementation (task breakdown đầu G4 — output planning-and-task-breakdown chế độ task list)
> **Status**: Ready for implementation
> **Date**: 2026-06-29
> **Sources**: Spec (`docs/specs/spec-subtitle-appearance-manager.md`) + Plan (`docs/plan/plan-subtitle-appearance-manager.md`) + ADR (`docs/adr/013-subtitle-appearance-manager.md`)
> **Lưu ý**: Mỗi task = 1 atomic commit (theo Phase Boundary Commits rule). TDD: RED → GREEN → COMMIT → REFACTOR → COMMIT.

## Dependency Graph

```
Task 1 (type + defaults + migration)
  │
  ├── Task 2 (pure logic + unit test)  ← parallel với Task 3 sau Task 1
  │
  └── Task 3 (createOverlayLayer + applyStyle + unit test)
        │
        ├── Task 4 (subtitleDragPosition + unit test)  ← parallel với Task 5 sau Task 3
        │
        └── Task 5 (controller refactor + storage.onChanged listener)
              │
              └── Task 6 (SubtitleStylePanel + SubtitlePreview + css)
                    │
                    └── Task 7 (SettingsDialog tab wire)
                          │
                          └── Task 8 (native toggle + reset + edge cases)
                                │
                                └── Task 9 (integration test storage.onChanged)
                                      │
                                      └── Task 10 (browser MCP verify A1-A16 + test report)
```

---

## Phase 1: Foundation — Type + Pure Logic

### Task 1: OverlayStyleConfig type + defaults + Settings migration
**Description**: Thêm `OverlayStyleConfig` + `TextShadowConfig` type vào `types/subtitle.ts`. Thêm `DEFAULT_OVERLAY_STYLE_TARGET` + `DEFAULT_OVERLAY_STYLE_NATIVE` vào `config.ts`. Thêm 2 field vào `Settings` type + `DEFAULT_SETTINGS`. Thêm migration fill defaults trong `loadPersistedSettings`.

**Acceptance criteria**:
- [ ] `OverlayStyleConfig` interface có 10 field (fontSize, textColor, backgroundColor, backgroundOpacity, textOpacity, textShadow, fontFamily, yOffsetPercent, horizontalAlign, visible)
- [ ] `TextShadowConfig` interface có 5 field (preset, color, blur, offsetX, offsetY)
- [ ] `DEFAULT_OVERLAY_STYLE_TARGET` + `DEFAULT_OVERLAY_STYLE_NATIVE` defined với giá trị default (target: fontSize 24, bottom 10%; native: fontSize 20, top 5%)
- [ ] `Settings` type thêm `subtitleOverlayTargetStyle` + `subtitleOverlayNativeStyle` (readonly OverlayStyleConfig)
- [ ] `DEFAULT_SETTINGS` thêm 2 field default
- [ ] `loadPersistedSettings` migration: fill defaults cho 2 field mới nếu missing (pattern đã có popupStore.ts:170-198)
- [ ] `OverlayConfig` cũ (behavior: targetLanguage, autoLoadEnabled, showTimestamps) GIỮ NGUYÊN — không xóa

**Verification**:
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run test:unit` pass (không break existing test)

**Dependencies**: None

**Files likely touched**:
- `src/types/subtitle.ts` (MODIFY — thêm 2 interface)
- `src/types/media.ts` (MODIFY — Settings thêm 2 field)
- `src/constants/config.ts` (MODIFY — DEFAULT_SETTINGS + 2 default style object)
- `src/popup/store/popupStore.ts` (MODIFY — loadPersistedSettings migration)

**Estimated scope**: Medium (4 files)

---

### Task 2: Pure logic (calcYOffsetPercent, buildTextShadow, sanitizeFontFamily, hexToRgba) + unit tests
**Description**: Viết 4 pure function + unit test. Logic không DOM side effect, testable 100%.

**Acceptance criteria**:
- [ ] `calcYOffsetPercent(pointerDeltaY, containerHeight, currentOffset)` → number, clamp 0-95, round
- [ ] `buildTextShadow(config: TextShadowConfig)` → string (none/soft/cinema/custom preset)
- [ ] `sanitizeFontFamily(raw: string)` → string (block url()/@import/expression(), fallback 'sans-serif')
- [ ] `hexToRgba(hex: string, alpha: number)` → string (rgba format)
- [ ] Unit test 4 function, coverage 100% pure logic
- [ ] Edge cases: clamp 0-95, preset none/soft/cinema/custom, empty string, invalid hex, alpha 0/1

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns subtitleStyle` pass
- [ ] `npx tsc --noEmit` pass

**Dependencies**: Task 1 (cần TextShadowConfig type)

**Files likely touched**:
- `src/content/subtitleUI.ts` (MODIFY — thêm 4 pure function, export)
- `tests/unit/subtitleStyleApply.test.ts` (NEW — test 4 function)

**Estimated scope**: Small (2 files)

---

## Phase 2: Core — 2 Overlay Layer + Drag

### Task 3: createOverlayLayer refactor + applyStyle + unit tests
**Description**: Refactor `createOverlay` (1 div 2 span) → `createOverlayLayer(role, config, container)` (1 div độc lập + 1 text span + 1 drag handle placeholder). Thêm `applyStyle(config, overlay)` set inline style. Giữ `createOverlay` cũ tạm thời (backward compat cho Task 5 refactor xong mới xóa).

**Acceptance criteria**:
- [ ] `createOverlayLayer(role: 'target' | 'native', config: OverlayStyleConfig, container)` → `{ overlay, textSpan, dragHandle }`
- [ ] Overlay div có `data-role="target"|"native"`, `data-testid="subtitle-overlay-target|native"`
- [ ] Text span có `user-select: text`, `pointer-events: auto` (copy word không xung đột)
- [ ] Drag handle placeholder (icon SVG move-vertical, `pointer-events: auto`, `aria-label`, `role="slider"`) — logic drag wire ở Task 4
- [ ] `applyStyle(config, overlay)` set inline style: fontSize, color, bg (hexToRgba), opacity, textShadow (buildTextShadow), fontFamily (sanitize), bottom (yOffset%), textAlign, display (visible)
- [ ] z-index: target=999999, native=999998
- [ ] Unit test: createOverlayLayer tạo 2 div độc lập, role data attr đúng, applyStyle set inline style đúng

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns subtitleOverlayLayer` pass
- [ ] `npx tsc --noEmit` pass

**Dependencies**: Task 1 (OverlayStyleConfig type), Task 2 (buildTextShadow, sanitizeFontFamily, hexToRgba)

**Files likely touched**:
- `src/content/subtitleUI.ts` (MODIFY — createOverlayLayer + applyStyle, giữ createOverlay cũ tạm)
- `tests/unit/subtitleOverlayLayer.test.ts` (NEW)

**Estimated scope**: Medium (2 files)

---

### Task 4: subtitleDragPosition.ts (createDragHandle + wire) + unit tests
**Description**: Tạo file mới `subtitleDragPosition.ts`. `createDragHandle(overlay, container, onDrag)` wire Pointer Events (pointerdown/move/up). Dùng `calcYOffsetPercent` (pure, từ Task 2) cho calc. Debounce 50ms cho onDrag callback.

**Acceptance criteria**:
- [ ] `createDragHandle(overlay, container, onDrag)` → HTMLButtonElement
- [ ] Handle icon SVG move-vertical (2 mũi tên lên-xuống, Lucide-style)
- [ ] `pointerdown` → enter drag mode (setPointerCapture), `pointermove` → calcYOffsetPercent → applyStyle position + onDrag (debounced 50ms), `pointerup` → exit + final persist
- [ ] Handle `aria-label="Drag to move subtitle"`, `role="slider"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`
- [ ] Handle `pointer-events: auto`, text span giữ `user-select: text` (không xung đột)
- [ ] Unit test: calcYOffsetPercent wire (mock pointer event), debounce, aria attr

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns subtitleDragPosition` pass
- [ ] `npx tsc --noEmit` pass

**Dependencies**: Task 2 (calcYOffsetPercent), Task 3 (createOverlayLayer — handle placeholder)

**Files likely touched**:
- `src/content/subtitleDragPosition.ts` (NEW)
- `tests/unit/subtitleDragPosition.test.ts` (NEW)

**Estimated scope**: Small (2 files)

---

### Task 5: SubtitleOverlayController refactor + content-script storage.onChanged listener
**Description**: Refactor `SubtitleOverlayController`: 2 ref `targetOverlay` + `nativeOverlay` thay vì 1 `overlay`. `onTimeUpdate` gọi 2 `updateOverlayText` thay vì `updateOverlayBilingual`. `init` tạo 2 layer. `content-script.ts` load settings khi init + listen `chrome.storage.onChanged` → `applyStyle`. Xóa `createOverlay` cũ + `updateOverlayBilingual` (không dùng nữa).

**Acceptance criteria**:
- [ ] Controller có 2 ref `targetOverlay` + `nativeOverlay` (thay 1 `overlay`)
- [ ] `init(videoWrapper)` tạo 2 `createOverlayLayer` (target + native) + 2 `createDragHandle`
- [ ] `onTimeUpdate` bilingual: 2 `findCurrentLine` → 2 `updateOverlayText` (thay `updateOverlayBilingual`)
- [ ] `loadBilingualCues(target, native)` contract GIỮ NGUYÊN (ADR-007 không break)
- [ ] `loadCues(cues)` single mode: update target overlay only (native ẩn)
- [ ] `clearCues` hide cả 2 overlay
- [ ] `destroy` remove cả 2 overlay + 2 handle + listener
- [ ] `content-script.ts`: `DEFAULT_OVERLAY_CONFIG` → load từ chrome.storage khi init
- [ ] `content-script.ts`: `chrome.storage.onChanged` listener → `applyStyle` cho target + native overlay
- [ ] Xóa `createOverlay` cũ + `updateOverlayBilingual` (dead code sau refactor)
- [ ] Existing test `subtitleOverlay` vẫn pass (controller contract giữ)

**Verification**:
- [ ] `npm run test:unit` pass (không break existing)
- [ ] `npx tsc --noEmit` pass
- [ ] Manual: mở video có bilingual subtitle → 2 overlay độc lập hiện (browser check nhẹ, full verify Task 10)

**Dependencies**: Task 3 (createOverlayLayer), Task 4 (createDragHandle)

**Files likely touched**:
- `src/content/subtitleOverlay.ts` (MODIFY — 2 ref, onTimeUpdate, init, destroy)
- `src/content/subtitleUI.ts` (MODIFY — xóa createOverlay cũ + updateOverlayBilingual)
- `src/content/content-script.ts` (MODIFY — load settings init + storage.onChanged listener)

**Estimated scope**: Medium (3 files)

---

## Phase 3: UI — Settings Tab + Style Panel + Preview

### Task 6: SubtitleStylePanel.tsx + SubtitlePreview.tsx + css
**Description**: Tạo 2 component UI mới. `SubtitleStylePanel` nhận prop `role: 'target' | 'native'` + style config + `onChange`. Render 7 appearance control + Y-offset input + reset button. `SubtitlePreview` render text sample với style áp dụng realtime + dark/light bg toggle.

**Acceptance criteria**:
- [ ] `SubtitleStylePanel({ role, style, onChange })` render:
  - Font size (slider 12-72 + input px)
  - Text color (input type=color)
  - Background color (input type=color) + background opacity (slider 0-1)
  - Text opacity (slider 0-1)
  - Text shadow (3 preset radio + Custom expand 4 field: color/blur/offsetX/offsetY)
  - Font family (select 3 system + custom input text)
  - Horizontal align (3 radio: left/center/right)
  - Y-offset (input %, step 1, range 0-95)
  - Visible toggle (native only — target luôn hiện)
  - Reset button (confirm dialog)
- [ ] `SubtitlePreview({ style, role })` render text sample với style realtime
- [ ] Preview dark/light bg toggle (mock video nền tối/sáng)
- [ ] Preview label: "Preview shows font/color/shadow only. Position visible on video."
- [ ] Accessibility: label htmlFor, aria-label, keyboard-navigable
- [ ] Unit test: render component, event handler onChange gọi đúng

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns SubtitleStylePanel` pass
- [ ] `npx tsc --noEmit` pass

**Dependencies**: Task 1 (OverlayStyleConfig type), Task 2 (buildTextShadow cho preview)

**Files likely touched**:
- `src/popup/components/settings/SubtitleStylePanel.tsx` (NEW)
- `src/popup/components/settings/SubtitleStylePanel.module.css` (NEW)
- `src/popup/components/settings/SubtitlePreview.tsx` (NEW)
- `src/popup/components/settings/SubtitlePreview.module.css` (NEW)
- `tests/components/SubtitleStylePanel.test.tsx` (NEW)

**Estimated scope**: Medium (5 files)

---

### Task 7: SettingsDialog.tsx tab Target/Native wire
**Description**: Modify `SettingsDialog.tsx` thêm tab Target/Native. Mỗi tab gọi `SubtitleStylePanel` với role + style từ settings + onChange → `updateSettings`. Wire `popupStore.updateSettings` (đã có, chỉ thêm field mới).

**Acceptance criteria**:
- [ ] SettingsDialog có 2 tab: "Target" + "Native" (trong section subtitle overlay)
- [ ] Tab Target → `SubtitleStylePanel role="target" style={settings.subtitleOverlayTargetStyle}`
- [ ] Tab Native → `SubtitleStylePanel role="native" style={settings.subtitleOverlayNativeStyle}`
- [ ] onChange → `updateSettings({ subtitleOverlayTargetStyle: partial })` (hoặc Native)
- [ ] Tab switch giữ state (không reset style khi đổi tab)
- [ ] Existing settings (target language, native language, auto-load) vẫn hoạt động
- [ ] Unit test: tab render, switch tab, onChange wire

**Verification**:
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Manual: mở settings → tab Target/Native, đổi font size → overlay đổi realtime (browser check nhẹ)

**Dependencies**: Task 6 (SubtitleStylePanel)

**Files likely touched**:
- `src/popup/components/settings/SettingsDialog.tsx` (MODIFY)
- `src/popup/components/settings/SettingsDialog.module.css` (MODIFY — tab style)

**Estimated scope**: Small (2 files)

---

## Phase 4: Polish — Native Toggle + Reset + Edge Cases

### Task 8: Native toggle + reset to defaults + edge cases
**Description**: Wire native `visible` toggle (ẩn cả overlay native). Wire reset to defaults (confirm dialog). Edge cases: sanitize font-family (block url/import), clamp yOffset 0-95, storage error catch.

**Acceptance criteria**:
- [ ] Native `visible: false` → `applyStyle` set `display: none` (ẩn cả overlay native, không chỉ handle)
- [ ] Native `visible: true` → hiện lại với style + position đã persist
- [ ] Reset button → confirm dialog → `updateSettings` với `DEFAULT_OVERLAY_STYLE_TARGET` (hoặc NATIVE)
- [ ] Reset chỉ reset tab hiện tại (không reset cả 2)
- [ ] Font family sanitize: block `url()`/`@import`/`expression()` → fallback 'sans-serif'
- [ ] Y-offset clamp 0-95 (drag quá nhanh → clamp)
- [ ] chrome.storage.set fail (quota) → catch error, log, giữ style hiện tại (không crash)
- [ ] Overlay container null (video removed) → skip apply, không crash

**Verification**:
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass

**Dependencies**: Task 7 (SettingsDialog wire)

**Files likely touched**:
- `src/content/subtitleUI.ts` (MODIFY — applyStyle edge case: visible false, sanitize)
- `src/popup/components/settings/SubtitleStylePanel.tsx` (MODIFY — reset confirm dialog)
- `src/content/content-script.ts` (MODIFY — storage error catch, container null guard)

**Estimated scope**: Small (3 files)

---

### Task 9: Integration test storage.onChanged → overlay update
**Description**: Integration test verify realtime sync: mock `chrome.storage.onChanged` event → `applyStyle` gọi → overlay inline style update.

**Acceptance criteria**:
- [ ] Integration test: fire `chrome.storage.onChanged` với new settings → overlay style update
- [ ] Test debounce 50ms (slider drag không spam)
- [ ] Test target + native độc lập (đổi target không affect native)
- [ ] Test migration: existing settings thiếu field → fill defaults

**Verification**:
- [ ] `npm run test:integration -- --testPathPatterns subtitleAppearance` pass

**Dependencies**: Task 8 (edge cases done)

**Files likely touched**:
- `tests/integration/subtitleAppearance.integration.test.ts` (NEW)

**Estimated scope**: Small (1 file)

---

## Phase 5: Verify — Browser MCP + Test Report

### Task 10: Browser verify (MCP chrome-devtools/edge-devtools) A1-A16 + test report
**Description**: Verify tất cả acceptance criteria A1-A16 trong real Chrome/Edge bằng MCP. Viết test report.

**Acceptance criteria**:
- [ ] A1: 2 overlay độc lập hiện, position riêng
- [ ] A2-A3: đổi font size/color/shadow/font-family → overlay đổi realtime
- [ ] A4-A5: drag handle target/native độc lập
- [ ] A6: Y-offset input sync ngược drag
- [ ] A7: native toggle on/off
- [ ] A8: live preview trong settings
- [ ] A9: reset to defaults
- [ ] A10: đóng popup mở lại → style persist
- [ ] A11: đổi tab → style persist
- [ ] A12: fullscreen → drag handle hoạt động
- [ ] A13: kéo slider 5s → FPS không giảm
- [ ] A14: browser verify pass (this task)
- [ ] A15: `npm run test:unit` + `npx tsc --noEmit` pass
- [ ] A16: existing bilingual auto-load (ADR-007) vẫn hoạt động
- [ ] Test report: `docs/test-reports/2026-06-29-subtitle-appearance-manager-mcp.md`

**Verification**:
- [ ] MCP chrome-devtools/edge-devtools screenshot + DOM inspect pass
- [ ] Test report written

**Dependencies**: Task 9 (integration test pass)

**Files likely touched**:
- `docs/test-reports/2026-06-29-subtitle-appearance-manager-mcp.md` (NEW)
- `docs/2-architechture-system.md` (UPDATE — remove "planned ADR-013" markers, mark implemented)
- `docs/adr/013-subtitle-appearance-manager.md` (UPDATE — Status: Accepted, add Verification results)

**Estimated scope**: Medium (3 files, mostly docs)

---

## Checkpoints

### Checkpoint 1: After Task 1-2 (Foundation)
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Pure logic 100% coverage
- [ ] Type system solid, no `any`

### Checkpoint 2: After Task 3-5 (Core)
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] 2 overlay độc lập hiện (manual browser check nhẹ)
- [ ] Existing bilingual auto-load không break

### Checkpoint 3: After Task 6-7 (UI)
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Settings dialog tab Target/Native hoạt động (manual browser check)
- [ ] Realtime apply hoạt động (manual)

### Checkpoint 4: After Task 8-9 (Polish)
- [ ] `npm run test:unit` + `npm run test:integration` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Edge cases covered

### Checkpoint 5: After Task 10 (Verify)
- [ ] A1-A16 pass trong real browser
- [ ] Test report written
- [ ] ADR-013 Status: Accepted
- [ ] Architecture map updated (remove "planned" markers)
- [ ] Ready for release (G6)

## Risks per Task

| Task | Risk | Mitigation |
|---|---|---|
| Task 5 | Refactor break bilingual auto-load (ADR-007) | Giữ `loadBilingualCues` contract, test A16 sớm |
| Task 5 | Xóa createOverlay cũ break existing test | Giữ tạm Task 3, xóa Task 5 sau khi controller refactor xong + test pass |
| Task 7 | SettingsDialog phức tạp, break existing settings | Tab riêng section subtitle overlay, không động existing section |
| Task 10 | Fullscreen drag không hoạt động | ADR fullscreen-target-shared-container đã verify, overlay append đúng container |
