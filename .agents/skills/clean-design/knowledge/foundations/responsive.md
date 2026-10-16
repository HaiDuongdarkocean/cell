# Foundation — Responsive & Targets

> Canon repo = breakpoint set dưới. iOS/HIG chỉ là tham khảo — xung đột thì repo thắng (chi tiết iOS: `spacing.md` §iOS canon).

## Breakpoint set (canon)

| Name | Khoảng | ≈ Context |
|---|---|---|
| `compact` | < 600px | phone portrait, popup hẹp |
| `medium` | 600–839 | phone landscape / tablet nhỏ |
| `expanded` | 840–1199 | tablet / laptop nhỏ |
| `large` | 1200–1599 | laptop |
| `extra-large` | ≥1600 | desktop |

## Usage rules

- **CSS media query hardcode px** — `var(--breakpoint-*)` không hợp lệ trong `@media` (deprecated, sẽ xóa).
- **JS** dùng `BREAKPOINTS` từ `src/shared/lib/tokens.ts`.
- Feature-local threshold khác được phép — khi có lý do ghi lại; không bắt buộc ép mọi `min-width` về foundation.
- **Responsive, không re-layout** (Q6): layout thích ứng, không đổi schema khi resize — cùng functionality, chỉ mật độ hiển thị đổi (iOS size-class tương đương).
- **Mobile-first:** design 320 → 768 → 1280; preview nhỏ nhất + lớn nhất trước.

## Targets & platform constants

| Gì | Giá trị | Nguồn |
|---|---|---|
| Touch target min | 40 desktop / 44 mobile | `--touch-target-*`, WCAG 2.5.8 (≥24 AA floor) |
| Visual vs hit | tách riêng — 40 visual + hit inflate ≥40/44 | spec-sheet |
| iOS status bar / home indicator | ~44–59 / 34 | platform constant, `env(safe-area-inset-*)` |
| iOS layout margin | 16 compact / 20 regular | HIG — Tihoka `space-4`/`space-5` |
| Readable width | `content-max-width` 640px | tokens.json |

## Layout integrity dưới áp lực

- Zoom 200% / narrow / long-content / localization: layout không cut, không horizontal scroll, row mọc cao chứ không crop (Dynamic Type mindset).
- Content dài có strategy khai báo (ellipsis/wrap) — `typography.md`.
- Primary action ở vùng chạm được (thumb zone nửa dưới màn cho mobile sheet).

## Compact recipes (đã chứng minh trên settings 320px)

Dùng `@container` khi ancestor có `container-type` (settings `.popoverBody`, `ResourcesPanel.panel`); `@container` **không tăng specificity** — block override phải đứng SAU rule gốc trong cùng file.

- **R-FULLWIDTH-SHRINK** — control `width:100%` với `min-width` intrinsic (`min-content` như `Button`, hoặc px cố định) sẽ tràn thay vì truncate. Mọi full-width trigger/flat-button phải có `min-width:0` + đường ellipsis tới text node. Dấu hiệu: `scrollWidth > clientWidth` ở column cha.
- **R-CARD-ROW-WRAP** — card row `[grip/controls][info flex:1 min-w:0][actions]`: ở compact, info co về ~0 chứ wrap không bao giờ kích (item flexible luôn hấp thụ squeeze). Fix: `row{flex-wrap:wrap} + info{flex:1 1 100%; order:-1}` → info full dòng 1, controls xuống dòng 2.
- **R-STICKY-OPAQUE** — `position:sticky` chrome không background → content lọt qua khe giữa các item. Sticky bar phải `background` đúng token của surface bên dưới (`--color-background`), không dùng blur (golden guard).
- **R-COMPACT-INSET** — inset lồng nhau cộng dồn: frame 16 + card 16 = 64px trên viewport 271px (~24%). Ở compact giảm outer inset 1 bậc (space-4→space-3), giữ ladder outer ≥ inner.
- **Scroll-strip hợp lệ** — stepper/tab strip ngang (`overflow-x:auto`) là pattern compact được chấp nhận khi anatomy không wrap được (rail nối giữa các bước). Pills/labels rời thì wrap (`flex-wrap`) trước khi scroll.
