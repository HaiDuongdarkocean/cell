# Implementation Plan: Subtitle Appearance Manager

> **Giai đoạn**: G2 Implementation Plan (output planning-and-task-breakdown high-level + cto-persona + doubt-driven)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-29
> **Spec source**: `docs/specs/spec-subtitle-appearance-manager.md` (mọi mục cite spec §F/NF/A)
> **Lưu ý**: File này là plan HIGH-LEVEL (approach, risk, milestones). Task list chi tiết chạy ở G4 đầu (sau Spec G1 + Plan G2 + ADR G3).

## Overview

Refactor subtitle overlay từ 1 div chứa 2 span (target+native chung, hardcoded style) thành 2 overlay layer độc lập với full appearance control per-overlay, drag handle, realtime persist, live preview. Approach: vertical slicing theo layer — build target layer đầy đủ trước (type + UI + persist + drag), rồi clone pattern cho native, rồi wire bilingual sync, rồi polish (preview/reset/browser verify).

## Architecture Decisions (build-vs-buy có cơ sở — cite spec)

### AD1: 2 overlay layer độc lập (refactor, không viết lại)
- **Decision**: Refactor `createOverlay` (1 div 2 span) → `createOverlayLayer(role, config, container)` (2 div độc lập).
- **Rationale** (spec §F1): Móc `OverlayConfig` type + `createOverlay` đã có, chỉ tách output. `loadBilingualCues` contract giữ nguyên (2 binary search song song), chỉ đổi output từ 2 span trong 1 div → 2 div riêng.
- **Build-vs-buy**: Không có lib fit (UI tùy biến overlay cho Chrome extension content script). Ponytail rung 2 (reuse codebase): refactor, không viết lại.
- **Alternatives rejected**:
  - Giữ 1 div 2 span, thêm position offset per-span → KHÔNG, vì drag handle cần div độc lập để `pointer-events` không xung đột, position absolute độc lập.
  - Web component / Shadow DOM → over-engineering, content script inject đơn giản đủ.

### AD2: Realtime sync qua chrome.storage.onChanged (không qua message bus)
- **Decision**: Popup `updateSettings` → `chrome.storage.local.set` (đã có pattern trong `popupStore.ts:135-140`) → content script listen `chrome.storage.onChanged` → `applyStyle(config, overlay)`.
- **Rationale** (spec §F5): Tránh thêm message type mới, reuse storage event native. Debounce 50ms cho slider drag.
- **Build-vs-buy**: Native Chrome storage API, 0 dependency.
- **Alternatives rejected**:
  - `chrome.runtime.sendMessage` popup → content → cần background relay (MV3 popup-content không nói chuyện trực tiếp), phức tạp hơn storage event.
  - Broadcast channel API → không cần, storage event đủ và persist luôn.

### AD3: Drag handle = native pointer events (không lib)
- **Decision**: `pointerdown/move/up` trên handle → pure `calcYOffsetPercent(deltaY, containerH, currentOffset)` → `applyStyle` position + debounce updateSettings.
- **Rationale** (spec §F3): Native Pointer Events API, 0 dependency, hỗ trợ touch + mouse. Pure calc testable.
- **Build-vs-buy**: Ponytail rung 3-4 (stdlib → native): native Pointer Events đủ.
- **Alternatives rejected**:
  - `react-dnd` / `@dnd-kit` → overkill cho 1D vertical drag, +bundle size.
  - Mouse events only → không hỗ trợ touch (tablet/laptop touchscreen).

### AD4: Font family = CSS string (không upload, không web font bundle)
- **Decision**: Dropdown 3 system font + 1 custom input text (CSS `font-family` string, user paste `"Noto Sans JP, sans-serif"`).
- **Rationale** (spec §F2.6, NF5, NF6): Mở 100% cho mọi ngôn ngữ qua CSS fallback chain. 0 bundle size, 0 security risk (sanitize: chỉ cho phép font-family value, không URL/import).
- **Build-vs-buy**: Ponytail rung 5 — native CSS, không cần lib.
- **Alternatives rejected**:
  - Web font bundle (Google Fonts) → +bundle size, latency, CJK font nặng (Noto Sans JP ~3MB).
  - Font upload → security (font có thể chứa exploit), bundle size, phức tạp.

### AD5: Settings layout = tab Target/Native (spec §Q4 resolved)
- **Decision**: Tab trong SettingsDialog, mỗi tab gọi `SubtitleStylePanel` với role prop.
- **Rationale**: Per-overlay độc lập rõ ràng, gọn UI, reuse 1 component với prop `role`.

## Approach per Requirement (cite spec §F)

| Spec Req | Approach | Cite |
|---|---|---|
| F1 2 layer độc lập | Refactor `createOverlay` → `createOverlayLayer(role, config, container)`. Controller giữ 2 ref `targetOverlay` + `nativeOverlay` thay vì 1 `overlay`. `onTimeUpdate` gọi `updateOverlayText(targetOverlay, targetText)` + `updateOverlayText(nativeOverlay, nativeText)` thay vì `updateOverlayBilingual(overlay, target, native)`. | §F1 |
| F2 Appearance per-overlay | `OverlayStyleConfig` type (thay `OverlayConfig`). Pure `applyStyle(config, element)` set inline style. `buildTextShadow(config)` pure. | §F2 |
| F3 Drag handle | `subtitleDragPosition.ts` new: `createDragHandle(overlay, container, onDrag)` + pure `calcYOffsetPercent`. Handle `pointer-events: auto`, text span giữ `user-select: text`. | §F3 |
| F4 Native on/off | `visible: boolean` trong `OverlayStyleConfig`. `applyStyle` set `display: none` khi false. Toggle trong `SubtitleStylePanel`. | §F4 |
| F5 Realtime persist | `popupStore.updateSettings` đã có. Content script thêm `chrome.storage.onChanged` listener → `applyStyle`. Debounce 50ms wrapper cho slider. | §F5 |
| F6 Live preview | `SubtitlePreview.tsx` new: text sample + style áp dụng từ local state (không cần message). Dark/light bg toggle. | §F6 |
| F7 Reset | Nút "Reset" trong `SubtitleStylePanel` → `updateSettings` với `DEFAULT_OVERLAY_STYLE_TARGET` / `DEFAULT_OVERLAY_STYLE_NATIVE`. Confirm dialog. | §F7 |

## Risk Mitigation (cite spec edge cases + assumptions)

| Risk | Impact | Mitigation | Cite |
|---|---|---|---|
| Refactor `subtitleOverlay.ts` break bilingual auto-load (ADR-007) | High | Giữ `loadBilingualCues(target, native)` contract — chỉ tách output 2 div. Test A16 (existing auto-load vẫn hoạt động) trước khi merge. | §A16, §E5 |
| `subtitleAutoLoad.ts` phụ thuộc controller shape | Med | Check: comment ghi "decoupled from SubtitleOverlayController" — chỉ dùng interface shape (loadCues/loadBilingualCues/clearCues/destroy). Refactor giữ 4 method này. | impact radius check |
| Realtime sync lag khi kéo slider liên tục | Med | Debounce 50ms `chrome.storage.local.set`. Chỉ `applyStyle` (set inline style), không recreate DOM. Test A13 (FPS không giảm). | §F5.3, §A13, §NF1 |
| Drag handle xung đột `user-select: text` (copy word) | Med | Handle vùng nhỏ riêng (~24x24px), `pointer-events: auto` chỉ handle. Text span giữ `user-select: text`, `pointer-events: auto`. Test A4/A5 + manual copy word. | §F3.3, §A2 assumption |
| Fullscreen drag không hoạt động | Med | Overlay append vào video-wrapper (ADR `fullscreen-target-shared-container` đã có). Handle cùng container → OK. Test A12 (browser verify fullscreen). | §A12, §NF3, §A6 assumption |
| 2 overlay overlap khi kéo cùng vị trí | Low | z-index target=999999 > native=999998. Visual feedback overlap = v2 (out of scope). | §F1.4, §A1 assumption |
| Font family string invalid (CSS parse fail) | Low | Sanitize: chỉ cho phép font-family value (regex check không có `url()`/`@import`). Fallback 'sans-serif' khi invalid. | §NF5, §E3 |
| Migration existing users thiếu field | Low | `loadPersistedSettings` đã có pattern fill defaults (popupStore.ts:170-198). Thêm migration cho 2 field mới. | §NF2, §popupStore pattern |
| chrome.storage.set fail (quota) | Low | Catch error, log, giữ style hiện tại (không crash). | §E1 |

## Doubt-Driven Stress-Test (adversarial review approach)

### Doubt 1: "2 overlay độc lập có thực sự cần, hay over-engineering?"
- **Challenge**: 1 div 2 span + position offset per-span có thể đạt drag độc lập? Tại sao phải tách div?
- **Response**: Drag handle cần `pointer-events: auto` riêng không xung đột text select. Nếu 2 span trong 1 div, handle của span nào? Position absolute của span trong div cha bị constrain. 2 div độc lập = position absolute độc lập trong container, handle rõ ràng per-div. **Tách div là đúng**, không over-engineering.
- **Counter**: Nhưng 2 div = 2x DOM node, 2x style apply per storage event?
- **Response**: 2 DOM node = negligible (overlay đã lightweight). Style apply = set inline style O(1) per div, không phải recreate. OK.

### Doubt 2: "Realtime qua storage.onChanged có reliable không? Tab chưa inject thì sao?"
- **Challenge**: Tab mới mở chưa có content script → storage.onChanged không fire cho tab đó. Style mất?
- **Response**: Content script đọc settings khi init (load từ storage 1 lần khi inject). storage.onChanged chỉ cho update realtime khi tab đã mở. Tab mới = đọc settings mới nhất khi init. **Pattern đã có** (loadShortcuts content-script.ts:80-90). OK.
- **Edge case**: Tab mở popup, đổi style, đóng popup, tab cũ vẫn chạy → storage đã set, content script nghe onChanged → update. OK.

### Doubt 3: "Drag handle trong fullscreen — ADR fullscreen-target-shared-container có thực sự cover?"
- **Challenge**: Fullscreen target có thể là video element hoặc container cha. Overlay append vào đâu?
- **Response**: Đọc ADR `fullscreen-target-shared-container.md` — overlay append vào video-wrapper (container shared), khi fullscreen container đó thành fullscreen target, overlay vẫn trong container → hiện đúng. **Đã verify trong ADR trước**. Low risk.

### Doubt 4: "Live preview không preview position — user không thấy position trên preview, có confusing?"
- **Challenge**: Preview chỉ show font/color/shadow/size, không show position. User đổi Y-offset trong settings, preview không đổi → confusing?
- **Response**: Preview label ghi rõ "Preview shows font/color/shadow only. Position visible on video." + Y-offset có input numeric + drag handle trên video thật. **Trade-off chấp nhận được** — preview position cần mock video container, phức tạp hơn, v1 skip.

### Doubt 5: "Font family CSS string — user không rành CSS, paste sai format?"
- **Challenge**: User paste "Noto Sans JP" thay vì `"Noto Sans JP, sans-serif"` → font không có trên máy → fallback default không rõ ràng.
- **Response**: Input có placeholder example `"Noto Sans JP, sans-serif"`. Sanitize + fallback 'sans-serif' khi CSS parse fail. Tooltip giải thích "Paste CSS font-family value, e.g., 'Noto Sans JP, sans-serif'". **Acceptable** — user học ngoại ngữ thường technical enough, và 3 preset font đã cover majority.

## Milestones (high-level phase chia — task list chi tiết ở G4)

### Phase 1: Foundation — Type + Pure Logic (vertical slice target layer)
- `OverlayStyleConfig` + `TextShadowConfig` type (thay `OverlayConfig`)
- `DEFAULT_OVERLAY_STYLE_TARGET` + `DEFAULT_OVERLAY_STYLE_NATIVE` trong config.ts
- Pure: `calcYOffsetPercent`, `buildTextShadow`, `applyStyle` (set inline style)
- `Settings` type thêm 2 field + migration trong `loadPersistedSettings`
- Unit test pure logic (3 file test)
- **Checkpoint**: `npm run test:unit` + `npx tsc --noEmit` pass. Pure logic 100% coverage.

### Phase 2: Core — 2 overlay layer + drag (target layer đầy đủ)
- Refactor `createOverlay` → `createOverlayLayer(role, config, container)` (2 div độc lập + drag handle)
- `subtitleDragPosition.ts` new (pointer events + pure calc wire)
- Refactor `SubtitleOverlayController`: 2 ref `targetOverlay` + `nativeOverlay`, `onTimeUpdate` gọi 2 `updateOverlayText`
- `content-script.ts`: load settings khi init + `chrome.storage.onChanged` listener → `applyStyle`
- Unit test `createOverlayLayer` + drag position
- **Checkpoint**: `npm run test:unit` pass. Target overlay hiện độc lập, drag hoạt động (manual browser check).

### Phase 3: UI — Settings dialog tab + style panel + preview
- `SubtitleStylePanel.tsx` new (per-overlay: 7 appearance control + Y-offset input + reset)
- `SubtitlePreview.tsx` new (live preview text sample, dark/light toggle)
- `SettingsDialog.tsx` modify: tab Target/Native, gọi 2 panel
- `popupStore` đã có `updateSettings` — wire 2 field mới
- Unit test component render + event handlers
- **Checkpoint**: `npm run test:unit` pass. Settings dialog mở, đổi font size → target overlay đổi realtime (browser verify).

### Phase 4: Polish — Native layer + reset + edge cases
- Native layer wire (clone target pattern, toggle visible)
- Reset to defaults + confirm dialog
- Edge cases: sanitize font-family, clamp yOffset, storage error catch
- Integration test: storage.onChanged → overlay update realtime
- **Checkpoint**: `npm run test:unit` + `npm run test:integration` pass. All F1-F7 working.

### Phase 5: Verify — Browser MCP + E2E
- Browser verify (MCP chrome-devtools/edge-devtools): A1-A12 trong real Chrome
- Performance verify: kéo slider 5s, FPS không giảm (A13)
- Fullscreen verify (A12)
- Existing bilingual auto-load verify (A16)
- Test report: `docs/test-reports/2026-06-29-subtitle-appearance-manager-mcp.md`
- **Checkpoint**: A14 browser verify pass. A15 test:unit + tsc pass. A16 auto-load không break. Ready for commit.

## Parallelization Opportunities

- **Safe to parallelize** (G4 task list chi tiết sẽ note):
  - Phase 1 pure logic (3 file test) — độc lập
  - Phase 3 UI components (`SubtitleStylePanel` + `SubtitlePreview`) — độc lập sau khi type xong
- **Must be sequential**:
  - Phase 1 → Phase 2 (type trước, refactor sau)
  - Phase 2 → Phase 3 (overlay refactor trước, UI wire sau)
  - Phase 4 → Phase 5 (polish trước, browser verify sau)
- **Needs coordination**:
  - `Settings` type shape (Phase 1) — chia sẻ giữa popup + content, define contract trước rồi parallelize UI + content listener

## Open Questions (cho G3 ADR)

- Q-ADR1: `OverlayConfig` cũ (targetLanguage, autoLoadEnabled, showTimestamps) — giữ lại hay tách ra `OverlayBehaviorConfig` riêng? (style ≠ behavior). Đề xuất tách: `OverlayStyleConfig` (per-layer) + giữ `OverlayConfig` cho behavior (target language, autoLoad — đã có).
- Q-ADR2: z-index rule target > native — hardcode hay configurable? Đề xuất hardcode (v1), configurable v2 nếu user cần.
- Q-ADR3: Drag handle vị trí mặc định (trái/phải/center cạnh overlay)? Đề xuất trái cạnh, v1 hardcode.

## Success Criteria (plan-level — cite spec §A)

- [ ] Plan cite spec mỗi section (approach, risk, milestone) — DONE
- [ ] Build-vs-buy có cơ sở cho mỗi AD — DONE
- [ ] Risk mitigation cite spec edge cases — DONE
- [ ] Doubt-driven stress-test 5 doubts — DONE
- [ ] Milestones high-level (task list chi tiết G4) — DONE
- [ ] Parallelization opportunities note — DONE
