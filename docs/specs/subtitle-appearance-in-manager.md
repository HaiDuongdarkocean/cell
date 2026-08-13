# Spec: Subtitle Appearance Customization in Manager Panel

> **Reviewed by 3 subagents** (feature completeness, UI design quality, SSOT architecture).
> All FAIL/WARN items addressed in sections marked `[REVIEW FIX]`.

## Objective

Di chuyển toàn bộ subtitle appearance customization (Target style, Native style, Block position/scale/opacity, NavCluster appearance) từ Settings Dialog sang Subtitle Manager Panel. Người dùng muốn chỉnh appearance ngay tại nơi quản lý subtitle — không cần mở Settings riêng.

**User story:**
> Khi đang xem video và mở Subtitle Manager, tôi muốn chọn track, import, sync offset, VÀ customize appearance (font, color, opacity, shadow, position, scale, nav cluster) — tất cả trong một panel. Tôi không muốn phải mở Settings riêng để đổi font size hay color.

**UX flow:**
1. Manager panel mở → mặc định hiển thị "Tracks view" (hiện tại: track list + offset + Generate native)
2. User click "Customize appearance" button (đặt ở **footer, cùng hàng với "Generate native"**, style ghost/secondary) → body + footer chuyển sang "Appearance view"
3. Appearance view có: **header giữ nguyên** (title "Subtitle Manager" + close button ×). **Đầu body content** có "← Back to subtitles" button — hiện ngay khi switch sang appearance view. Body scrollable riêng.
4. Appearance view render theo thứ tự trong body: **"← Back to subtitles" button** (đầu body) → **Block section** (position/scale/opacity) → **Target section** (visible toggle + SubtitleStylePanel) → **Native section** (visible toggle + SubtitleStylePanel) → **Cluster section** (button size, text opacity, bg opacity)
5. User chỉnh style → **debounced save** (300ms) → `chrome.storage.local` → `storage.onChanged` → `contentScriptController` → `blockController.updateSettings()` → realtime apply
6. User click "← Back to subtitles" → quay lại Tracks view

## Assumptions

1. **Shadow DOM**: Manager panel render trong shadow DOM (`#cell-subtitle-root` shadow root). Shared UI components (Button, Slider, Toggle) CSS phải được inject vào shadow root.
2. **Realtime apply**: Appearance changes persist qua `chrome.storage.local` → `storage.onChanged` listener trong `contentScriptController.ts` → `blockController.updateSettings()`. Flow này đã hoạt động cho Settings, reuse nguyên vẹn.
3. **Component ownership** `[REVIEW FIX]`: `SubtitleStylePanel`, `SubtitlePreview`, `SubtitleBlockSettingsPanel`, `NavClusterSettingsPanel` hiện sống trong `src/features/settings/ui/` nhưng là subtitle-appearance components. **Di chuyển 4 component này sang `src/features/subtitle/ui/appearance/`** — cả Settings và Manager import từ đó. Tránh cross-feature coupling `subtitle → settings`.
4. **Settings cleanup**: Sau khi move, Settings Dialog chỉ còn "Block" section cho behavior (auto-load, languages, auto-translate). Target/Native appearance sections + Block position/scale/opacity + Cluster appearance bị xóa. **Sidebar items `target`, `native`, `cluster` cũng bị xóa**. Orphaned code (`updateOverlayStyle`, `resetOverlayStyle`, `updateBlock`, `updateNavCluster`) được cleanup.
5. **`visible` toggle** `[REVIEW FIX]`: Hiện tại `contentScriptController.ts:706-707,769-773` overwrite `targetStyle.visible`/`nativeStyle.visible` với runtime `overlayVisible`. **Cần refactor**: `overlayVisible` tách thành `targetVisible` + `nativeVisible`, derive từ `targetStyle.visible` / `nativeStyle.visible`. Shortcut `toggle-overlay` flip cả 2 cùng lúc (giữ behavior hiện tại). Per-role visible toggle trong appearance view persist vào `OverlayStyleConfig.visible`.
6. **`Off` track option** `[REVIEW FIX]`: Hiện tại `onSelect(role, -1)` return early trong `contentScriptController.ts:1711-1714` — không tắt track. **Cần wire**: `onSelect(role, -1)` → set `targetStyle.visible = false` (hoặc `nativeStyle.visible = false`) cho role đó. `Off` = không hiển thị track nào (visible=false), `visible` toggle = style layer on/off (bật/tắt overlay layer).
7. **Persistence** `[REVIEW FIX]`: `saveSettings()` **không có debounce** (Assumption cũ sai). Cần thêm **debounce 300ms** cho style/block/cluster changes. **Partial merge**: `saveSettings` chỉ shallow-merge top-level keys. Callback phải merge `Partial<OverlayStyleConfig>` với current style trước khi save (giống `SettingsDialogContent.tsx:190-196`). Thêm `.catch(() => undefined)` cho error handling.
8. **NavCluster** `[REVIEW FIX]`: `NavClusterSettingsPanel` (button size, text opacity, bg opacity) cũng là subtitle appearance. **Move sang appearance view** như section thứ 4.
9. **Realtime preview** `[REVIEW FIX]`: Panel hiện tại opaque, che video. `SubtitlePreview` chỉ preview text style, không preview position/align/scale. **Giữ `SubtitlePreview`** cho text style preview. User có thể click "Back to subtitles" để thấy video. Không cần WYSIWYG trên video ngay.

## Tech Stack

- React 19 + TypeScript (strict, no `any`)
- CSS Modules (scoped, shadow DOM compatible, camelCase class names)
- Shared UI: `Slider`, `Button`, `Toggle` from `@/shared/ui`
- Existing (moved to `src/features/subtitle/ui/appearance/`): `SubtitleStylePanel`, `SubtitlePreview`, `SubtitleBlockSettingsPanel`, `NavClusterSettingsPanel`
- Storage: `chrome.storage.local` via `saveSettings()` / `loadSettings()`
- Shadow DOM: `injectShadowCss()` + `mountReactShadow()`

## Commands

```bash
Build:     npm run build
Typecheck: npm run typecheck
Test unit: npx jest --selectProjects unit --testPathPatterns <file>
Dev:       npm run dev
```

## Project Structure

```
src/features/subtitle/ui/appearance/     # [REVIEW FIX] NEW — moved from settings/ui/
  SubtitleStylePanel.tsx                 # font, color, opacity, shadow, align, reset
  SubtitleStylePanel.module.css
  SubtitlePreview.tsx                    # live text preview
  SubtitlePreview.module.css
  SubtitlePreview.test.tsx               # moved from settings/ui/
  SubtitleBlockSettingsPanel.tsx         # position/scale/opacity
  SubtitleBlockSettingsPanel.module.css
  NavClusterSettingsPanel.tsx            # button size, text/bg opacity
  NavClusterSettingsPanel.module.css
  appearanceShadowCss.ts                 # [REVIEW FIX] NEW — canonical CSS manifest

src/features/subtitle/ui/
  SubtitleManagerPanel.tsx               # + Appearance view + view state
  SubtitleManagerPanel.module.css        # + appearance view styles + scroll layout
  SubtitleManagerPanel.test.tsx          # + appearance view tests
  SubtitlePanels.tsx                     # ManagerState extended with AppearanceState
  reactSubtitleController.ts             # + style/block/cluster change callbacks + debounced persist
  mountSubtitle.tsx                      # + inject appearance CSS via appearanceShadowCss.ts
  contentScriptController.ts             # [REVIEW FIX] refactor overlayVisible → per-role visible

src/features/settings/ui/
  SettingsDialogContent.tsx              # - Target/Native/Block appearance + Cluster + orphaned code
  # SubtitleStylePanel/Preview/BlockSettings/NavCluster moved to subtitle/ui/appearance/

docs/mockup/
  subtitle-manager-redesign.html         # + appearance view mockup (360px + 420px + desktop)
docs/specs/
  subtitle-appearance-in-manager.md      # this spec
docs/adr/
  NNN-subtitle-appearance-in-manager.md  # [REVIEW FIX] NEW — ADR for why appearance moved
docs/0-wiki.md                           # [REVIEW FIX] + list new spec
docs/2-architechture-system.md           # [REVIEW FIX] + update tree/dependency/function index
```

## Code Style

```tsx
// View state — simple useState, extensible to future views
type ManagerView = 'tracks' | 'appearance';
const [view, setView] = useState<ManagerView>('tracks');

// AppearanceState — merged into ManagerState, per-role callbacks via role param
export interface AppearanceState {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  blockSettings: SubtitleBlockSettings;
  clusterSettings: NavClusterSettings;
  defaultTargetStyle: OverlayStyleConfig;
  defaultNativeStyle: OverlayStyleConfig;
  // Per-role callback — extensible to future roles without interface change
  onStyleChange: (role: 'target' | 'native', partial: Partial<OverlayStyleConfig>) => void;
  onBlockSettingsChange: (partial: Partial<SubtitleBlockSettings>) => void;
  onClusterSettingsChange: (partial: Partial<NavClusterSettings>) => void;
  onResetStyle: (role: 'target' | 'native') => void;
}

// ManagerState extended (existing fields + appearance)
export interface ManagerState {
  // ... existing fields (targetItems, nativeItems, targetActiveIndex, etc.)
  appearance?: AppearanceState;  // optional — only when appearance view is needed
}
```

**Persistence pattern** `[REVIEW FIX]`:
```tsx
// reactSubtitleController.ts — debounced persist with merge
private stylePersistTimer: ReturnType<typeof setTimeout> | null = null;
private currentTargetStyle: OverlayStyleConfig;
private currentNativeStyle: OverlayStyleConfig;

private persistStyleChange(role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void {
  const current = role === 'target' ? this.currentTargetStyle : this.currentNativeStyle;
  const merged = { ...current, ...partial };
  if (role === 'target') this.currentTargetStyle = merged;
  else this.currentNativeStyle = merged;

  if (this.stylePersistTimer) clearTimeout(this.stylePersistTimer);
  this.stylePersistTimer = setTimeout(() => {
    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    saveSettings({ [key]: merged } as Partial<Settings>).catch(() => undefined);
    this.stylePersistTimer = null;
  }, 300);  // debounce 300ms
}
```

## UI Design

### Layout `[REVIEW FIX]`

```
┌─────────────────────────────────────┐
│ Header (sticky)                     │
│  "Subtitle Manager"    [×]          │  ← same for both views
├─────────────────────────────────────┤
│ Body (scrollable, max-height)       │
│                                     │
│  [tracks view]                      │
│    Target section                   │
│    Native section                   │
│                                     │
│  [appearance view]                  │
│    ← Back to subtitles              │  ← top of body content
│    Block section (position/scale)   │
│    Target section (visible + style) │
│    Native section (visible + style) │
│    Cluster section (button/opacity) │
│                                     │
├─────────────────────────────────────┤
│ Footer (sticky)                     │
│  [Customize appearance] [Generate]  │  ← tracks view footer
│  (no footer in appearance view)     │  ← appearance view: body extends to bottom
└─────────────────────────────────────┘
```

- **Header sticky**: `position: sticky; top: 0; z-index: 1` — không scroll mất
- **Body scrollable**: `overflow-y: auto; max-height: min(580px, 100dvh - 120px)` — responsive
- **Footer sticky**: `position: sticky; bottom: 0` — chỉ ở tracks view
- **"Customize appearance" button**: footer, style `ghost` hoặc `secondary`, bên trái "Generate native"

### Scroll strategy `[REVIEW FIX]`

```css
.panel {
  display: flex;
  flex-direction: column;
  max-height: min(680px, 100dvh - 2 * var(--space-4));
}
.header { flex: 0 0 auto; position: sticky; top: 0; }
.body { flex: 1 1 auto; overflow-y: auto; }
.footer { flex: 0 0 auto; position: sticky; bottom: 0; }
```

### Responsive `[REVIEW FIX]`

- **Mobile (320-360px)**: pair rows (color×2, opacity×2) stack 1 column. Panel `max-height: 100dvh - 2*padding`.
- **Tablet (420-768px)**: pair rows 2 columns.
- **Desktop (>768px)**: pair rows 2 columns, panel `max-width: 680px`.
- `SubtitleStylePanel.module.css` breakpoints (480px, 768px) giữ nguyên — khớp với panel width.

### Touch targets `[REVIEW FIX]`

- `SubtitleStylePanel` custom slider: **thay bằng shared `Slider`** từ `@/shared/ui` (đạt `--touch-target` 40/44px)
- Color input: `min-height: 44px` trên mobile
- Toggle visible: dùng `Toggle size="md"` (44px)
- Stepper buttons: đã đạt 40px

### Focus & ARIA `[REVIEW FIX]`

- Click "Customize appearance" → focus chuyển đến "← Back to subtitles" button
- Click "← Back to subtitles" → focus trả về "Customize appearance" button
- Appearance view sections: `<section aria-labelledby="...">` với heading
- `aria-live="polite"` cho `SubtitlePreview` (cập nhật khi style đổi)
- Escape key đóng panel từ cả 2 views (đã có)

### CSS class naming `[REVIEW FIX]`

- camelCase module classes (giống codebase hiện tại): `.appearanceView`, `.backButton`, `.appearanceSection`, `.appearanceHeader`

## Shadow CSS Manifest `[REVIEW FIX]`

Tạo `src/features/subtitle/ui/appearance/appearanceShadowCss.ts` — canonical list:

```ts
import subtitleStylePanelCss from './SubtitleStylePanel.module.css?inline';
import subtitlePreviewCss from './SubtitlePreview.module.css?inline';
import subtitleBlockSettingsCss from './SubtitleBlockSettingsPanel.module.css?inline';
import navClusterSettingsCss from './NavClusterSettingsPanel.module.css?inline';
import sliderCss from '@/shared/ui/Slider.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import toggleCss from '@/shared/ui/Toggle.module.css?inline';

export const appearanceShadowCss = [
  subtitleStylePanelCss,
  subtitlePreviewCss,
  subtitleBlockSettingsCss,
  navClusterSettingsCss,
  sliderCss,
  buttonCss,
  toggleCss,
];
```

`mountSubtitle.tsx` import `appearanceShadowCss` và spread vào existing CSS list. `mountSettingsDialog.ts` cũng import (nếu Settings vẫn dùng NavCluster — nhưng sau cleanup Settings không còn dùng).

## Testing Strategy

**Unit (jest + testing-library):**
- `SubtitleManagerPanel.test.tsx`:
  - Renders "Customize appearance" button in tracks view
  - Click → switches to appearance view (renders Block + Target + Native + Cluster sections)
  - "Back to subtitles" button → switches back to tracks view
  - Style change callback fires `onStyleChange('target', partial)` / `onStyleChange('native', partial)`
  - Block settings change fires `onBlockSettingsChange`
  - Cluster settings change fires `onClusterSettingsChange`
  - Reset callback fires `onResetStyle('target')` / `onResetStyle('native')`
  - Escape key closes panel from both views
  - Click-outside closes panel from both views
  - Focus moves to "Back to subtitles" when entering appearance view
- `SubtitlePreview.test.tsx`: moved from `settings/ui/` — existing tests still pass
- `reactSubtitleController.test.ts` (if exists): test debounced persist + merge logic

**Browser verify (stealth-chrome-devtools):**
- Open Manager → click "Customize appearance" → verify all 4 sections render
- Change font size slider → verify subtitle on video updates realtime (after 300ms debounce)
- Click "Back to subtitles" → verify tracks view restored
- Verify Settings Dialog no longer has Target/Native/Cluster appearance sections
- Verify Settings sidebar no longer has target/native/cluster items

## Boundaries

- **Always:**
  - Move `SubtitleStylePanel`, `SubtitlePreview`, `SubtitleBlockSettingsPanel`, `NavClusterSettingsPanel` to `src/features/subtitle/ui/appearance/` — không tạo mới
  - Inject CSS cho shared components via `appearanceShadowCss.ts` manifest
  - Persist changes qua `saveSettings()` với **debounce 300ms** + **merge partial** + `.catch()`
  - TDD: test trước, implement sau
  - Build pass + test pass trước khi commit
  - Update `docs/2-architechture-system.md` + `docs/0-wiki.md` + create ADR

- **Ask first:**
  - Thay đổi `OverlayStyleConfig` hoặc `SubtitleBlockSettings` type
  - Thay đổi storage schema
  - Refactor `overlayVisible` → per-role visible (affects `shortcutActionDispatcher`)

- **Never:**
  - Tạo duplicate component thay vì reuse
  - Hardcode CSS values — dùng design tokens
  - Break existing `SubtitlePreview.test.tsx` (move with component)
  - Import `features/settings` from `features/subtitle` (avoid cross-feature coupling)
  - Pass `Partial<OverlayStyleConfig>` directly to `saveSettings` without merging

## Success Criteria

1. Manager panel có 2 views: "tracks" (hiện tại) + "appearance" (mới)
2. "Customize appearance" button ở tracks view footer → switch sang appearance view
3. Appearance view có "← Back to subtitles" ở **đầu body content** (header giữ nguyên: title + close)
4. Appearance view render: Block section → Target section (visible toggle + style) → Native section (visible toggle + style) → Cluster section
5. Style changes apply realtime lên video (sau 300ms debounce)
6. Style changes persist qua `chrome.storage.local` (reload page → style giữ nguyên)
7. Partial style updates merge với current style trước khi save (không wipe fields)
8. Settings Dialog không còn Target/Native/Block appearance + Cluster sections
9. Settings Dialog sidebar không còn target/native/cluster items
10. Settings Dialog giữ: Block behavior (auto-load, languages, auto-translate, ASR), Shortcuts, Download, Card Creator, Dictionary, Theme, TTS, Resources
11. Escape key đóng panel từ cả 2 views
12. Click-outside đóng panel từ cả 2 views
13. `Off` track option wires to `visible=false` cho role đó
14. Per-role `visible` toggle persists và không bị overwrite bởi `overlayVisible`
15. Header sticky, body scrollable, footer sticky (tracks view only)
16. Focus management: "Customize appearance" → focus "Back to subtitles" và ngược lại
17. Touch targets đạt 44px trên mobile (Slider, Toggle, color input)
18. `SubtitleStylePanel` dùng shared `Slider` từ `@/shared/ui`
19. 4 appearance components moved to `src/features/subtitle/ui/appearance/`
20. `appearanceShadowCss.ts` manifest created và injected vào shadow root
21. ADR created tại `docs/adr/NNN-subtitle-appearance-in-manager.md`
22. `docs/2-architechture-system.md` updated (tree + dependency + function index)
23. `docs/0-wiki.md` updated (list new spec)
24. All unit tests pass
25. Build pass

## Open Questions (Resolved)

1. **Reset confirm**: Giữ nguyên (reuse `SubtitleStylePanel`, không đổi).
2. **Visible toggle**: Move sang appearance view section header. Refactor `overlayVisible` → per-role `visible` derive từ `OverlayStyleConfig.visible`.
3. **Block section position**: Đầu (shared settings trước, per-role sau).
4. **NavCluster**: Move sang appearance view (section thứ 4).
5. **Realtime preview**: Giữ `SubtitlePreview` cho text style. User "Back to subtitles" để thấy video.
6. **Component ownership**: Move 4 components sang `src/features/subtitle/ui/appearance/`.
7. **Debounce**: 300ms cho style/block/cluster changes.
8. **Partial merge**: Merge `Partial<OverlayStyleConfig>` với current style trước khi `saveSettings`.
