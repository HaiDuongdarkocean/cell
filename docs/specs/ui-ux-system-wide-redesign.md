# Spec: UI-UX system-wide redesign (SSOT + 14/12px type scale)

> Status: Slice 1 & 2 implemented; Slices 3 & 4 pending.
> Date: 2026-07-21

## 1. Objective

Cải thiện UI-UX toàn hệ thống theo painpoint:

- HTML/CSS + BEM không tuân convention `learning-and-apply`.
- Content-script UI và React UI không dùng chung một ngôn ngữ thiết kế SSOT.
- Font-size ưa thích là **14px** hoặc **12px**, nhưng hiện tại quá nhiều nơi dùng **13px**.
- Hardcoded `px`, màu sắc, breakpoint, animation durations gây drift.

Kết quả mong muốn: toàn bộ extension dùng một design language duy nhất, `tokens.json` là SSOT, mọi text chỉ render 14px hoặc 12px, icon/diagram chỉ dùng `--space-*` cho kích thước.

## 2. Assumptions

1. "14px hoặc 12px" áp dụng cho **mọi text** (body, label, caption, heading). Decorative icon/emoji vẫn có thể lớn hơn nhưng phải dùng `--space-*` (hoặc `font-size` với giá trị `--space-*`), không dùng `font-size-lg/xl` cho text.
2. SSOT là `src/shared/styles/tokens.json`; `tokens.css` và `tokens.ts` là generated artifacts, không sửa tay.
3. Thay đổi được chia thành các slice nhỏ, mỗi slice pass build + verify trước khi sang slice tiếp theo.
4. Không thay đổi API/props của shared atoms (`Button`, `Input`, `Select`, v.v.) — chỉ sửa CSS module và component tokens.
5. BEM naming cleanup ưu tiên thấp hơn type-scale/hardcoded-value cleanup.
6. Không thêm dependency mới.

## 3. Painpoints discovered

### 3.1 Type scale drift (root cause)
- `tokens.json` `static.font.sizes.sm = 13px`, `md = 15px`, `lg = 16px`, `xl = 18px`, `2xl = 20px`, `3xl = 24px`, `4xl = 30px`, `2xs = 10px`.
- `shared/ui` atoms (`Button`, `Input`, `Select`, `Dialog`, `Accordion`, `Tabs`, `Badge`, `Label`, v.v.) dùng `var(--font-size-sm)` → render 13px.
- `features/theme`, `features/cardCreator`, `features/dictionary`, `features/tts`, `entrypoints/popup`, `entrypoints/sidepanel` cũng dùng `font-size-sm` / `font-size-2xs` / `font-size-lg` / `font-size-xl`.
- `features/subtitle/ui/subtitleBlockCss.ts` có `font-size: 9px`, `11px`, `var(--font-size-sm, 13px)`, `var(--font-size-lg, 16px)`, `var(--font-size-xl, 18px)`.
- `features/tokenize/ui/tokenBadgeCss.ts` dùng `var(--font-size-sm, 13px)`.

### 3.2 Hardcoded px / spacing / colors
- `features/cardCreator/ui/TtsVoiceManagerPanel.module.css`: `max-width: 880px`, `flex: 0 0 140px`, `max-width: 320px`, `max-height: 420px/320px`, `width: 48px`.
- `entrypoints/popup/components/media/*Card.module.css`: `22px`, `18px`, `140px`, `60px`, `3px` padding, v.v.
- `features/subtitle/ui/subtitleBlockCss.ts`: hơn 100 giá trị px cứng (blur 8px, top 40px, badge `font-size: 9px`, padding `1px 5px`, border-radius 3px, ...).
- `features/dictionaryPopup/ui/popupDictionary.css`: hơn 100 giá trị px/fallback cứng (`translateY(8px)`, `width: 14px`, `height: 6px`, ...).
- `features/tokenize/ui/tokenBadgeCss.ts`: `width: 260px !important`, `height: 18px`.
- `features/subtitle/ui/subtitleBlockCss.ts`: 34 màu `rgba()` cứng cho overlay.
- `features/dictionaryPopup/ui/wordHighlight.ts`: màu highlight sentence hardcoded.
- `src/features/cardCreator/service/cardCreatorService.ts`: CSS string cho card preview dùng `font-size: 20px`, `color: black`, `background-color: white`.

### 3.3 SSOT drift ở content-script
- `features/subtitle/ui/subtitleBlockCss.ts` inject CSS string nhưng không inject `tokens.css`; dựa vào controller set biến.
- `features/tokenize/ui/tokenSpanCss.ts` dùng `DEFAULT_LIGHT_TOKENS`/`DEFAULT_DARK_TOKENS` thay vì `tokens.css` canonical.
- `orbitalBadge.ts` và `tokenBadge.ts` inject `tokens.css?raw` đúng pattern.
- `subtitleBlockDom.ts`, `navClusterIcons.ts`, `subtitlePanel.ts`, `subtitleManagerPanel.ts`, `subtitleImport.ts`, `subtitleOffsetPanel.ts`: chèn inline SVG style với `width:65%`, `width:12px`, `width:14px`, `width:16px`.

### 3.4 BEM / naming
- `entrypoints/popup` và `entrypoints/sidepanel` dùng camelCase class names (`.tabList`, `.headerLeft`, `.mainRow`, `.qualityTrigger`, `.cueCurrent`, ...).
- Một số file dùng `data-*` làm JS hook mặc dù đúng cách là `.js-*` class.

### 3.5 Animation / accessibility
- Tất cả CSS module và content-script CSS thiếu `@media (prefers-reduced-motion: reduce)`.
- Một số duration hardcoded (`300ms`, `200ms`, `1.5s`) thay vì `var(--duration-*)`.

### 3.6 Component duplication
- `popup/components/media/VideoCard`, `SubtitleCard`, `DownloadCard` tự implement card thay vì dùng `shared/ui/Card`.
- `TtsVoiceManagerPanel` dùng `<select>` native thay vì `shared/ui/Select`.

## 4. Plan — sliced implementation

### Slice 1: Canonical 14/12px type scale (SSOT)
**Goal:** Không còn 13px/10px/11px/15px/16px/18px/20px render trong text. `tokens.json` là SSOT.

**Actions:**
1. Sửa `tokens.json` `static.font.sizes`:
   - `xs` = `12px` (giữ)
   - `sm` = `14px` (từ 13px)
   - `base` = `14px` (giữ)
   - `2xs` = `var(--font-size-xs)` (từ 10px)
   - `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl` = `var(--font-size-base)` (từ 15/16/18/20/24/30) **cho text**.
   > Lưu ý: các `font-size-*` vẫn tồn tại như alias để tránh break build, nhưng sẽ không dùng cho text mới.
2. Regenerate `tokens.css` / `tokens.ts`.
3. Cập nhật `component.button.font-size` và `component.input.font-size` từ `var(--font-size-sm)` thành `var(--font-size-base)`.
4. Sửa `shared/ui` atoms để text dùng `var(--font-size-base)` / `var(--font-size-xs)` thay vì `sm`.
5. Sửa feature/entrypoint CSS modules: mọi `font-size-sm` (text) → `base`; `font-size-2xs` → `xs`; `font-size-md/lg/xl/2xl/3xl/4xl` (text) → `base` hoặc `xs` tùy context.
6. Chuyển các `font-size` dùng cho icon/emoji sang `font-size: var(--space-*)`:
   - `ModeCards.module.css .icon` → `var(--space-6)` (24px)
   - `MediaList.module.css .cc-media__preview-close` → `var(--space-5)` (20px)
   - `subtitleBlockCss.ts` icon badge → `var(--space-*)` phù hợp.
7. Sửa các literal `font-size: 9px/11px/13px` trong `subtitleBlockCss.ts` và `cardCreatorService.ts`.

**Verification:**
- `grep -R "font-size:" src --include="*.css" --include="*.ts" --include="*.tsx"` chỉ còn `base`, `xs`, hoặc `var(--space-*)`.
- Build pass.
- Targeted unit tests pass.

### Slice 2: Hardcoded px → design tokens (React/entrypoint + content-script CSS)
**Goal:** Không còn hardcoded `px` cho sizing/spacing trong `.module.css`, `.css`, và content-script CSS strings.

**Actions:**
- Thay `22px`, `18px`, `140px`, `60px`, `48px`, `880px`, `320px`, `420px`, `260px`, `1.5px`, `2px`, v.v. bằng token tương đương (`var(--space-*)`, `var(--radius-*)`, `var(--touch-target-mobile)`, `var(--touch-target-desktop)`, `calc(...)`).
- Áp dụng cho `shared/ui`, `shared/styles/components.css`, `entrypoints/*/styles/global.css`, `features/*`, `entrypoints/popup`, `entrypoints/sidepanel`.
- Giữ lại `1px` hairline border và `@media`/`@container` breakpoints.
- Xử lý negative offset bằng `calc(var(--token) * -1)`, không dùng `-var(--token)`.

**Verification:**
- `grep -R ":\s*[0-9]\+px" src --include="*.module.css" --include="*.css" --include="*.ts" --include="*.tsx" --include="*.html" | grep -v "tokens.css"` chỉ còn `1px` hairline, media/container queries, comments, và inline SVG style injections (Slice 3).
- `npm run build`, `npm run typecheck`, `npm run test:unit` pass.
- Cập nhật experience atom `css-hardcoded-px-to-token.json`.

### Slice 3: Content-script SSOT + a11y
**Goal:** Content-script UI dùng cùng tokens với React UI.

**Actions:**
- Thêm overlay color tokens vào `tokens.json` (`--overlay-bg`, `--overlay-border`, `--overlay-text`, `--overlay-accent`) và thay 34 `rgba()` trong `subtitleBlockCss.ts`.
- Sửa `wordHighlight.ts` đọc màu từ `tokens.json`.
- Inject `tokens.css?raw` cho `subtitleBlockCss.ts` / `tokenSpanCss.ts`.
- Thay inline SVG style injections bằng CSS classes dùng `--space-*`.
- Thêm `@media (prefers-reduced-motion: reduce)` cho content-script CSS.

### Slice 4: BEM + component reuse + animation polish
**Goal:** Convention BEM, reuse shared atoms, reduced motion.

**Actions:**
- Chuyển camelCase class names trong `popup`/`sidepanel` về kebab-case BEM.
- Đảm bảo JS hooks dùng `.js-*` class, data attributes chỉ chứa data.
- Đánh giá `VideoCard`/`SubtitleCard`/`DownloadCard` dùng `shared/ui/Card`.
- Thêm `prefers-reduced-motion` cho toàn bộ `.module.css` và `global.css`.
- Thay duration cứng bằng `var(--duration-*)`.

## 5. Acceptance criteria (system-wide)

- [A] `tokens.json` là SSOT; không sửa `tokens.css` / `tokens.ts` tay; regenerate artifact khi đổi token.
- [B] Không còn `font-size` render ra 13px, 10px, 11px, 15px, 16px, 18px, 20px trong text; chỉ còn 14px/12px.
- [C] Không còn hardcoded hex/rgb/rgba colors ngoài `tokens.json` (trừ overlay được tài liệu hóa rõ ràng).
- [D] Không còn hardcoded `px` cho sizing/spacing (trừ 1px hairline border, 2px focus offset).
- [E] Content-script UI inject `tokens.css` canonical; không còn parallel token system.
- [F] Tất cả animation/transition có `prefers-reduced-motion` support.
- [G] Class names tuân BEM-like kebab-case; JS hooks dùng `.js-*`.
- [H] `npm run build`, `npm run typecheck`, `npm run test:unit` pass (ngoại trừ lỗi pre-existing).

## 6. Commands

```bash
# Regenerate tokens sau khi sửa tokens.json
node scripts/generate-tokens.js

# Verify build + tests
npm run build
npm run typecheck
npm run test:unit

# Audit hardcoded values
grep -R "font-size:.*13px\|font-size:.*10px\|font-size:.*11px" src --include="*.css" --include="*.ts" --include="*.tsx"
grep -R "#[0-9a-fA-F]\{3,8\}" src --include="*.css" --include="*.ts" --include="*.tsx" | grep -v tokens.css | grep -v tokens.ts
grep -R "width: [0-9]\+px\|height: [0-9]\+px\|font-size: [0-9]\+px" src --include="*.css" --include="*.ts" --include="*.tsx"
```

## 7. Boundaries

- **Always do:** dùng `tokens.json`, regenerate artifacts, chạy build trước commit.
- **Ask first:** thay đổi component API, thêm dependency, sửa `manifest.json`.
- **Never do:** sửa `tokens.css`/`tokens.ts` tay, commit secret, xóa test đang fail không hỏi.
