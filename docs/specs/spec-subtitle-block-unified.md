:# Spec: Unified Subtitle Block

## Objective

Gộp `target` subtitle, `native` subtitle, và `nav cluster` thành một block duy nhất trên video.

- **User**: Người học ngoại ngữ dùng extension xem phim, cần layout subtitle + điều hướng gọn gàng, dễ căn chỉnh.
- **Why now**: Hiện tại 3 thành phần tách rời, cài đặt vị trí riêng rẽ, gây rối UX.
- **Success**:
  - 1 block duy nhất, kéo trục Y, tự động scale theo kích thước video.
  - Subtitle target/native luôn căn giữa video, không tràn vào cluster hoặc nút di chuyển.
  - Settings gọn hơn, bỏ các cài đặt không còn dùng.
  - Không break người dùng hiện tại (migrate settings cũ).

## Tech Stack

- Chrome Extension MV3, TypeScript strict.
- Content script DOM injection (no new dependencies).
- `ResizeObserver` API để theo dõi kích thước video.
- `Pointer Events` cho drag.

## Commands

```bash
npm run build
npm run test:unit
npm run lint
npm run typecheck
```

## Project Structure

```
src/features/subtitle/ui/
├── subtitleBlock.ts            # UnifiedSubtitleBlockController (mới)
├── subtitleBlockDom.ts         # DOM factories pure
├── subtitleBlockCss.ts         # CSS cho block
├── subtitleBlockDrag.ts        # Drag logic trên background block
├── subtitleBlockScale.ts       # Auto-scale theo video size
├── subtitleOverlay.ts          # refactor: logic sync cũ, UI giao cho block
├── navClusterController.ts     # refactor: chỉ còn actions, DOM vào block
└── navClusterDom.ts            # refactor: trả về 2 column DOM

src/entities/settings/types.ts  # thêm block settings, bỏ yOffsetPercent
src/shared/config/config.ts     # defaults mới
src/shared/lib/storage/settingsStore.ts  # migration v9
src/features/settings/ui/       # panels mới
```

## Code Style

- Function components + hooks named export.
- Pure functions cho DOM factory, scale, clamp.
- Named export, không default export.
- Không `any`.

## Testing Strategy

- **Unit**: scale formula, clamp, migration, DOM factory.
- **Integration**: `UnifiedSubtitleBlockController` với mock video element.
- **Browser**: MCP hoặc manual check trên YouTube/themoviebox.

## Boundaries

- **Always**: run `npm run test:unit` sau mỗi bước refactor; migrate schema cũ.
- **Ask first**: thêm dependency, thay đổi `manifest.json`.
- **Never**: xóa test cũ không thay thế; commit secrets; bỏ qua migration.

## Data Contract

### TypeScript

```typescript
export interface SubtitleBlockSettings {
  yOffsetPercent: number; // 0-95
  globalScale: number;    // 0.5-2
  bgOpacity: number;      // 0-1
}

export interface NavClusterSettings {
  enabled: boolean;
  buttonSize: number;     // base px
  buttonOpacity: number;
  // removed: position, bgOpacity, collapsed
}

export interface OverlayStyleConfig {
  fontSize: number;       // base px
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  textOpacity: number;
  textShadow: TextShadowConfig;
  fontFamily: string;
  horizontalAlign: 'left' | 'center' | 'right';
  visible: boolean;
  // removed: yOffsetPercent
}
```

### Settings keys

- `subtitleBlockYOffsetPercent`
- `subtitleBlockGlobalScale`
- `subtitleBlockBgOpacity`
- `subtitleOverlayTargetStyle`
- `subtitleOverlayNativeStyle`
- `navClusterEnabled`
- `navClusterButtonSize`
- `navClusterButtonOpacity`

## Auto-scale Formula

```
scaleFactor = sqrt(videoWidth * videoHeight) / 1000
finalSize = baseSize * globalScale * scaleFactor
finalSize = clamp(finalSize, min, max)
```

- `min` và `max` là hằng số theo loại (ví dụ target font min 8px max 60px).
- `REFERENCE` = 1000 (kích thước video chuẩn).

## Layout

- Block width = 100% video container.
- Grid 3 cột: `var(--cluster-width) 1fr var(--cluster-width)`.
- Cluster nằm cột trái (2 cột dọc: prev/repeat/next + rewind/forward).
- Target + native nằm cột giữa, căn giữa.
- Cột phải rỗng (reserve space) để subtitle không tràn vào nút di chuyển.
- Nút di chuyển đã bỏ; drag trên background block.

## Drag Behavior

- `pointerdown` trên block background, không phải `.subtitle-line` hoặc `.cluster-btn`.
- `pointermove` cập nhật `top` của block (tỷ lệ %).
- `pointerup` lưu `yOffsetPercent` debounced.
- Background + viền chỉ hiện khi class `.dragging` được thêm.

## Migration

- Bump `CURRENT_SCHEMA_VERSION` 8 → 9.
- `v8 → v9`:
  - `subtitleBlockYOffsetPercent` = trung bình `target.yOffsetPercent` và `native.yOffsetPercent` (hoặc cái còn lại).
  - `subtitleBlockGlobalScale` = 1.0
  - `subtitleBlockBgOpacity` = `navClusterBgOpacity` cũ (hoặc 0.7)
  - Xóa `navClusterPosition`, `navClusterCollapsed`, `navClusterBgOpacity`.
  - Xóa `yOffsetPercent` trong `targetStyle` và `nativeStyle`.

## Success Criteria

- [ ] Block hiển thị đúng 3 trạng thái: bilingual, no-sub, native-off, cluster-off.
- [ ] Subtitle target/native căn giữa video, không tràn vào cluster.
- [ ] Kéo block di chuyển mượt, background chỉ hiện khi kéo.
- [ ] Auto-scale thay đổi kích thước khi video resize/fullscreen.
- [ ] Settings panel mới render 4 section: Block/Cluster/Target/Native.
- [ ] `npm run test:unit` pass.
- [ ] Migration v8→v9 không mất cài đặt user.

## Open Questions

- None — intent đã confirm qua interview-me.
