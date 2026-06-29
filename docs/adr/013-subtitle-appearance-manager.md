# ADR-013: Subtitle Appearance Manager — 2 Overlay Layer Độc Lập + Per-Layer Style + Drag Handle

## Status
Proposed (draft G3 — chờ implement + browser verify để chuyển Accepted)

## Context

Subtitle overlay hiện tại (`src/content/subtitleUI.ts:11` `createOverlay`) tạo **1 div chứa 2 span** (target + native chung), position chỉ 3 preset (bottom 10% / top 10% / center), style **hardcoded** trong `DEFAULT_OVERLAY_CONFIG` (`content-script.ts:69`, comment `"settings wiring is phase 2"`). Settings dialog (`SettingsDialog.tsx`) chỉ có target/native language + auto-load toggle — **không có** appearance/position control.

**Forces (từ spec `docs/specs/spec-subtitle-appearance-manager.md`)**:
- User cần tùy biến đầy đủ per-overlay: font size, color, bg+alpha, text shadow, font-family, opacity, position (drag + numeric), align.
- Target + native cần **độc lập hoàn toàn** — ví dụ target kéo xuống dưới, native kéo lên trên cùng (không thể với 1 div 2 span chung).
- Realtime apply (kéo slider → overlay đổi ngay, không reopen dialog).
- Persist chrome.storage (đổi tab không mất).
- Không thêm dependency (ponytail rung 5: native DOM + React + Zustand đủ).
- Không break existing bilingual auto-load (ADR-007 `loadBilingualCues` contract).
- Không break existing fullscreen behavior (ADR `fullscreen-target-shared-container`).

**Constraints (MV3 + codebase)**:
- Content script isolated world — không access page `window`.
- Overlay append vào video-wrapper (fullscreen shared container, ADR đã có).
- `chrome.storage.local` 10MB quota — 2 style object ~400 bytes, negligible.
- `subtitleAutoLoad.ts:162` decoupled từ `SubtitleOverlayController` — chỉ dùng interface shape (`loadCues`/`loadBilingualCues`/`clearCues`/`destroy`), refactor phải giữ 4 method này.
- Existing migration pattern trong `popupStore.ts:170-198` (`loadPersistedSettings` fill defaults cho field mới).

## Decision

### D1: 2 overlay layer độc lập (refactor `createOverlay` → `createOverlayLayer`)

```typescript
// Thay vì 1 div 2 span:
export function createOverlay(container, config): HTMLDivElement  // OLD

// 2 div độc lập, mỗi cái 1 text span + 1 drag handle:
export function createOverlayLayer(
  role: 'target' | 'native',
  config: OverlayStyleConfig,
  container: HTMLElement,
): { overlay: HTMLDivElement; textSpan: HTMLSpanElement; dragHandle: HTMLButtonElement }
```

- `SubtitleOverlayController` giữ 2 ref `targetOverlay` + `nativeOverlay` thay vì 1 `overlay`.
- `onTimeUpdate` gọi `updateOverlayText(targetOverlay, targetText)` + `updateOverlayText(nativeOverlay, nativeText)` thay vì `updateOverlayBilingual(overlay, target, native)`.
- `loadBilingualCues(target, native)` contract **giữ nguyên** — chỉ tách output 2 div, 2 binary search song song không đổi (ADR-007 NF5: n~1000 cues, 4 fires/sec, no degrade).
- z-index: target=999999 > native=999998 (target nổi trên khi overlap — v1 hardcode, v2 configurable nếu cần).

**Lý do tách div (không giữ 1 div 2 span + offset per-span)**: drag handle cần `pointer-events: auto` riêng không xung đột text select. 2 span trong 1 div → handle của span nào? Position absolute của span bị constrain bởi div cha. 2 div độc lập = position absolute độc lập trong container, handle rõ ràng per-div.

### D2: `OverlayStyleConfig` tách khỏi `OverlayConfig` (style ≠ behavior)

```typescript
// types/subtitle.ts — per-layer style (NEW)
export interface OverlayStyleConfig {
  readonly fontSize: number;            // px, default 24 (target) / 20 (native)
  readonly textColor: string;           // hex
  readonly backgroundColor: string;     // hex (không chứa alpha — alpha tách rời)
  readonly backgroundOpacity: number;   // 0-1
  readonly textOpacity: number;         // 0-1
  readonly textShadow: TextShadowConfig;
  readonly fontFamily: string;          // CSS font-family string
  readonly yOffsetPercent: number;      // 0-95, % video height
  readonly horizontalAlign: 'left' | 'center' | 'right';
  readonly visible: boolean;            // on/off (C1 native toggle)
}

export interface TextShadowConfig {
  readonly preset: 'none' | 'soft' | 'cinema' | 'custom';
  readonly color: string;     // hex
  readonly blur: number;      // px
  readonly offsetX: number;   // px
  readonly offsetY: number;   // px
}

// OverlayConfig cũ (behavior) GIỮ NGUYÊN — targetLanguage, autoLoadEnabled, showTimestamps
// (đã có, không động)
```

- `Settings` type thêm 2 field: `subtitleOverlayTargetStyle: OverlayStyleConfig` + `subtitleOverlayNativeLanguage: OverlayStyleConfig`.
- `DEFAULT_SETTINGS` thêm `DEFAULT_OVERLAY_STYLE_TARGET` + `DEFAULT_OVERLAY_STYLE_NATIVE`.
- Migration trong `loadPersistedSettings`: fill defaults cho 2 field mới (pattern đã có `popupStore.ts:170-198`).
- Background color tách alpha rời (`backgroundColor` hex + `backgroundOpacity` 0-1) — vì color picker native `<input type="color">` không hỗ trợ alpha, alpha slider riêng linh hoạt hơn.

### D3: Realtime sync qua `chrome.storage.onChanged` (không message bus)

```typescript
// content-script.ts — listener mới
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings?.newValue?.subtitleOverlayTargetStyle) {
    applyStyle(changes.settings.newValue.subtitleOverlayTargetStyle, targetOverlay);
  }
  if (changes.settings?.newValue?.subtitleOverlayNativeStyle) {
    applyStyle(changes.settings.newValue.subtitleOverlayNativeStyle, nativeOverlay);
  }
});
```

- Popup `updateSettings(partial)` đã có pattern (`popupStore.ts:135-140` → `chrome.storage.local.set`).
- Content script đọc settings 1 lần khi init (pattern `loadShortcuts` `content-script.ts:80-90`), rồi listen `onChanged` cho update realtime.
- Debounce 50ms wrapper cho slider drag (tránh spam `storage.set` 60 lần/giây).
- `applyStyle(config, element)` = set inline style O(1), **không recreate DOM**.

**Lý do không dùng `chrome.runtime.sendMessage`**: MV3 popup ↔ content không nói chuyện trực tiếp, cần background relay → phức tạp hơn storage event. Storage event native, persist luôn, 0 message type mới.

### D4: Drag handle = native Pointer Events + pure calc

```typescript
// subtitleDragPosition.ts — NEW
export function calcYOffsetPercent(
  pointerDeltaY: number,
  containerHeight: number,
  currentOffset: number,
): number {
  const deltaPercent = (pointerDeltaY / containerHeight) * 100;
  return clamp(Math.round(currentOffset + deltaPercent), 0, 95);
}

export function createDragHandle(
  overlay: HTMLDivElement,
  container: HTMLElement,
  onDrag: (newYOffsetPercent: number) => void,
): HTMLButtonElement {
  // pointerdown → enter drag mode (capture pointer)
  // pointermove → calcYOffsetPercent(pure) → applyStyle position + onDrag (debounced)
  // pointerup → release, final persist
  // icon SVG move-vertical (2 mũi tên lên-xuống)
}
```

- Native Pointer Events (hỗ trợ mouse + touch), 0 dependency.
- Handle `pointer-events: auto`, `aria-label="Drag to move subtitle"`, `role="slider"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`.
- Text span giữ `user-select: text`, `pointer-events: auto` (copy word tra cứu không xung đột — A2 assumption).
- Drag realtime update overlay position + sync ngược settings (debounce 50ms).
- Fullscreen hoạt động (overlay + handle cùng container = video-wrapper, ADR `fullscreen-target-shared-container`).

### D5: Font family = CSS string (sanitize, no upload, no web font bundle)

```typescript
// Sanitize: chỉ cho phép font-family value, không URL/import
function sanitizeFontFamily(raw: string): string {
  // Block url(), @import, expression() — chỉ cho phép font name + comma + generic family
  if (/url\(|@import|expression|javascript:/i.test(raw)) return 'sans-serif';
  return raw.trim() || 'sans-serif';
}
```

- Dropdown 3 system font (sans-serif / serif / monospace) + 1 custom input text (CSS `font-family` string, user paste `"Noto Sans JP, sans-serif"`).
- Mở 100% cho mọi ngôn ngữ (CJK/Ả Rập/Latin) qua CSS fallback chain.
- 0 bundle size, 0 security risk (sanitize block `url()`/`@import`/`expression()`).
- Fallback 'sans-serif' khi CSS parse fail hoặc string rỗng.

**Lý do không web font bundle**: CJK font nặng (Noto Sans JP ~3MB), latency, bundle size. **Lý do không upload**: font file có thể chứa exploit, phức tạp validate, bundle size.

### D6: Pure `applyStyle` + `buildTextShadow` (testable, no DOM side effect trong logic)

```typescript
// Pure: build CSS text-shadow string from config
export function buildTextShadow(config: TextShadowConfig): string {
  if (config.preset === 'none') return 'none';
  if (config.preset === 'soft') return `0 1px 2px ${config.color}`;
  if (config.preset === 'cinema') return `2px 2px 4px ${config.color}`;
  return `${config.offsetX}px ${config.offsetY}px ${config.blur}px ${config.color}`;
}

// Side effect: apply style to element (thin wrapper, logic ở pure function)
export function applyStyle(config: OverlayStyleConfig, overlay: HTMLDivElement): void {
  overlay.style.fontSize = `${config.fontSize}px`;
  overlay.style.color = config.textColor;
  overlay.style.backgroundColor = hexToRgba(config.backgroundColor, config.backgroundOpacity);
  overlay.style.opacity = String(config.textOpacity);
  overlay.style.textShadow = buildTextShadow(config.textShadow);
  overlay.style.fontFamily = sanitizeFontFamily(config.fontFamily);
  overlay.style.bottom = `${config.yOffsetPercent}%`;
  overlay.style.textAlign = config.horizontalAlign;
  overlay.style.display = config.visible ? 'block' : 'none';
}
```

- Pure function (`buildTextShadow`, `calcYOffsetPercent`, `sanitizeFontFamily`, `hexToRgba`) = testable 100%, no DOM.
- `applyStyle` = thin wrapper set inline style, logic ở pure function.

## Ponytail ceiling

- **z-index hardcode target > native**: nếu user cần native nổi trên target → không configurable v1. Upgrade: thêm `zIndex` field vào `OverlayStyleConfig` v2.
- **Drag handle vị trí trái cạnh hardcode**: nếu user cần phải/center cạnh → không configurable v1. Upgrade: thêm `handlePosition` field v2.
- **Visual feedback khi 2 overlay overlap**: handle sáng khi gần nhau → không v1. Upgrade: collision detect + highlight v2.
- **Live preview không show position**: preview chỉ font/color/shadow/size, position thấy trên video thật. Upgrade: mock video container trong preview v2.
- **Preset themes (Cinema/High-contrast/Minimal)**: không v1. Upgrade: preset bundle v2.
- **Per-site override profile**: 1 global profile v1. Upgrade: per-hostname profile map v2.

## Alternatives considered

- **(a) Giữ 1 div 2 span + position offset per-span**: FAIL — drag handle không có div độc lập để `pointer-events` riêng, position absolute span bị constrain div cha. Xung đột text select.
- **(b) Web component / Shadow DOM cho overlay**: over-engineering — content script inject đơn giản đủ, Shadow DOM thêm complexity không cần (style isolation đã đủ qua inline style + data-attr).
- **(c) `chrome.runtime.sendMessage` popup → content (qua background relay)**: phức tạp hơn storage event, cần message type mới + background relay. Storage event native, persist luôn.
- **(d) `react-dnd` / `@dnd-kit` cho drag handle**: overkill cho 1D vertical drag, +bundle size. Native Pointer Events đủ (mouse + touch).
- **(e) Web font bundle (Google Fonts) cho CJK**: +bundle size (Noto Sans JP ~3MB), latency. CSS font-family string fallback chain đủ + user tự có font trên máy.
- **(f) Font upload**: security risk (font exploit), bundle size, phức tạp validate. CSS string sanitize đủ.
- **(g) Mouse events only (không Pointer Events)**: không hỗ trợ touch (tablet/laptop touchscreen). Pointer Events cover cả 2.
- **(h) Recreate overlay khi style đổi**: lag, mất drag state, flicker. `applyStyle` set inline style O(1) không recreate.

## Verification (planned — G5 sau implement)

- **Unit**: `calcYOffsetPercent` (clamp 0-95, delta calc), `buildTextShadow` (3 preset + custom), `sanitizeFontFamily` (block url/import, fallback), `hexToRgba` (alpha apply), `applyStyle` (assert inline style output). Coverage 100% pure, 90%+ wrapper.
- **Integration**: `chrome.storage.onChanged` → `applyStyle` realtime (mock storage event).
- **Browser MCP (chrome-devtools/edge-devtools)** — AGENTS.md stop-the-line:
  - A1: 2 overlay độc lập hiện, position riêng
  - A2-A3: đổi font size/color/shadow/font-family → overlay đổi realtime
  - A4-A5: drag handle target/native độc lập
  - A6: Y-offset input sync ngược drag
  - A7: native toggle on/off
  - A12: fullscreen drag hoạt động
  - A13: kéo slider 5s, FPS không giảm
  - A16: existing bilingual auto-load (ADR-007) vẫn hoạt động
- **`npm run test:unit` + `npx tsc --noEmit`**: pass.
- **Test report**: `docs/test-reports/2026-06-29-subtitle-appearance-manager-mcp.md`.

## Files changed (planned)

**Modify**:
- `src/types/subtitle.ts` — thêm `OverlayStyleConfig`, `TextShadowConfig` (giữ `OverlayConfig` behavior)
- `src/types/media.ts` — `Settings` thêm 2 field `subtitleOverlayTargetStyle` + `subtitleOverlayNativeStyle`
- `src/constants/config.ts` — `DEFAULT_SETTINGS` thêm 2 default style object
- `src/content/subtitleUI.ts` — `createOverlay` → `createOverlayLayer(role, config, container)`, thêm `applyStyle`, `buildTextShadow`, `hexToRgba`, `sanitizeFontFamily`
- `src/content/subtitleOverlay.ts` — controller 2 ref `targetOverlay` + `nativeOverlay`, `onTimeUpdate` 2 `updateOverlayText`
- `src/content/content-script.ts` — load settings khi init + `chrome.storage.onChanged` listener
- `src/popup/store/popupStore.ts` — `loadPersistedSettings` migration 2 field mới (pattern đã có)
- `src/popup/components/settings/SettingsDialog.tsx` — tab Target/Native, gọi `SubtitleStylePanel`

**New**:
- `src/content/subtitleDragPosition.ts` — `calcYOffsetPercent` (pure) + `createDragHandle` (DOM wire)
- `src/popup/components/settings/SubtitleStylePanel.tsx` + `.module.css` — per-overlay appearance controls
- `src/popup/components/settings/SubtitlePreview.tsx` + `.module.css` — live preview text sample
- `tests/unit/subtitleDragPosition.test.ts` — pure calc
- `tests/unit/subtitleStyleApply.test.ts` — `applyStyle` + `buildTextShadow` + `sanitizeFontFamily` + `hexToRgba`
- `tests/unit/subtitleOverlayLayer.test.ts` — `createOverlayLayer` 2 div độc lập
- `tests/integration/subtitleAppearance.integration.test.ts` — storage.onChanged → overlay update

**Docs**:
- `docs/2-architechture-system.md` — update 3 chỗ (cây thư mục + bảng phụ thuộc + function index)
- `docs/0-wiki.md` — mục lục ADR + test report
- `docs/test-reports/2026-06-29-subtitle-appearance-manager-mcp.md` — browser verify report (G5)
