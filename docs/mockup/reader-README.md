# Cell Reader — HTML Mockup Notes

## Mục đích

Tệp `reader.html` là mockup tĩnh (static HTML) minh họa UI/UX cho tính năng **Reader** trong Cell. Không chỉnh sửa mã nguồn chính (`src/`), chỉ dùng để review flow và design token trước khi implement.

## User journey

1. **Universal Panel (`#panel`)**  
   Người dùng nhìn thấy lưới các tiện ích. Thẻ **Reader** (icon `book-open`) mở trang chủ Reader.

2. **Reader Home (`#home`)**  
   - Header có nút quay lại Universal Panel.  
   - Vùng import (drag & drop / chọn tệp) cho EPUB/PDF/TXT/HTML.  
   - Danh sách sách đã import: mỗi cuốn hiển thị tên, tác giả, **% tiến trình** và **thời gian đọc**.  
   - Nhấn vào sách mở trang đọc.

3. **Reading View (`#read`)**  
   - Header: tên sách, thời gian đọc, nút **Lưu Anki**.  
   - Nội dung sách được **tokenize** từng từ bằng `span.token` (static markup) với màu theo tần suất / trạng thái từ vựng.  - Thanh **TTS** ở dưới: `prev` → `play/pause` → `next` → `repeat`, kèm progress bar và timer.

## Token / CSS sử dụng

Mockup link trực tiếp:

- `../../src/shared/styles/tokens.css` — tất cả design tokens.  
- `../../src/shared/styles/components.css` — `.btn`, `.icon-btn`.  
- `../../src/shared/ui/Card.module.css` — `.card`, `.interactive`, `.selected`.

Các token chính được dùng (không hardcode màu / kích thước):

| Loại | Token ví dụ | Dùng ở đâu |
|------|-------------|-----------|
| Màu nền / surface | `--color-background`, `--color-surface` | `body`, `.top-bar`, `.tts-bar` |
| Màu text | `--color-text-primary`, `--color-text-secondary` | tiêu đề, meta |
| Border | `--color-border`, `--border-width-hairline` | card, divider, import area |
| Spacing | `--space-3`, `--space-4`, `--space-6`, `--space-8` | padding, gap |
| Radius | `--radius-card`, `--radius-full`, `--radius-sm` | card, nút, token, progress |
| Typography | `--font-family-body`, `--font-size-*`, `--font-weight-*` | toàn trang |
| Button | `--button-bg`, `--button-fg`, `--button-height` | `.btn` từ `components.css` |
| Icon button | `--iconbutton-size-md`, `--iconbutton-icon-sm` | `.icon-btn` |
| Token từ vựng | `--color-token-freq-*`, `--color-token-status-*` | `.tok-core`, `.tok-known`, v.v. |
| Track / progress | `--color-track`, `--color-primary` | progress bar |

## Component patterns tái sử dụng

- **Button**: dùng `.btn .btn--primary`, `.btn--secondary`, `.btn--sm`, `.btn--with-icon`.  
- **IconButton**: dùng `.icon-btn`, `.icon-btn--filled` cho play/pause.  
- **Card**: dùng `.card .interactive` cho sách, `.card` cho panel.  
- **Progress**: tự tạo `div.progress` + `div.progress__bar` với token `--color-track` / `--color-primary`.

## Icon

Các icon được copy trực tiếp từ `src/shared/icons/svg/` thông qua `ICON_CATALOG` (`src/shared/icons/index.ts`) với đúng `viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="1.5"`. Icon được dùng:

- `book-open`, `chevron-left`, `chevron-right`, `plus`, `folder-open`, `clock`, `nav-prev`, `nav-next`, `nav-repeat`, `play`, `pause`, `sun`, `moon`.

## Responsive behavior

Breakpont theo `tokens.css`:

- **Mobile (320px trở lên)**:  
  - `.page` padding `var(--space-4)`.  
  - `.book-grid` 1 cột.  
  - `.reader-text` tối đa `70ch`, font-size base.

- **Tablet (768px trở lên)**:  
  - `.page` padding `var(--space-6)`.  
  - `.book-grid` 2 cột.  
  - Font text đọc tăng lên `var(--font-size-lg)`.

- **Desktop (1280px trở lên)**:  
  - `.page` padding `var(--space-8)`.  
  - `.book-grid` 3 cột.  
  - `.reader-text` tối đa `80ch`.

## Dark / Light mode

- `<html data-theme="...">` quyết định theme.  
- `tokens.css` đã cung cấp `[data-theme="dark"]` override, nên toàn bộ màu tự động chuyển khi toggle.  
- Nút theme ở góc phải trên cùng (`#themeToggle`) dùng icon `sun` / `moon` và theo `prefers-color-scheme` mặc định.

## Cách mở

Mở file trực tiếp trong trình duyệt:

```
<repo-root>\docs\mockup\reader.html
```

Hoặc phục vụ qua http local (từ thư mục `cell`):

```bash
cd "<repo-root>"
python -m http.server 4000
# rồi mở http://localhost:4000/docs/mockup/reader.html
```

## Hạn chế

- Không có xử lý thật: tokenize, TTS, import file, lưu Anki đều là static markup.  
- Chuyển màn hình dùng hash routing nhỏ (`#panel`, `#home`, `#read`) chỉ để minh họa flow, không phải implement cuối cùng.
