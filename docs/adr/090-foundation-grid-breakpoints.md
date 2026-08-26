# ADR-090: Grid & Breakpoints for "Quiet Confidence" Foundation

## Status

Accepted — build verification passed; foundation tokens shipped in tokens.css.

## Context

Cell chạy trên desktop, tablet, Android. UI surfaces khác nhau: popup (nhỏ, 320-400px), sidepanel (trung bình, 360-480px), options page (lớn, 800px+), content script overlays. Cần breakpoint và grid rõ ràng để responsive không phải "cắt cho có".

## Decision

### 1. Mobile-first breakpoints

| Name | Value | Range | Usage |
|------|-------|-------|-------|
| `compact` | 0 | < 600px | Mobile compact (Android popup) |
| `medium` | 600px | 600px → 839px | Mobile large / small tablet |
| `expanded` | 840px | 840px → 1199px | Tablet / desktop sidepanel |
| `large` | 1200px | 1200px → 1599px | Desktop small |
| `extra-large` | 1600px | ≥ 1600px | Desktop large |

**Lý do:**
- 600px là điểm đủ rộng để chuyển từ compact/mobile sang layout hai cột.
- 840px là điểm tablet/sidepanel có không gian nội dung thoải mái.
- 1200px+ là desktop/options page.

**Quan trọng:** CSS custom properties **không thể** dùng trong `@media` queries. Các media query trong CSS phải hardcode giá trị px; JS dùng `BREAKPOINTS` export từ `src/shared/lib/tokens.ts`. Do đó `--breakpoint-*` không được sinh ra trong `tokens.css`.

### 2. Grid: 4-column on small, 12-column on large

Grid column/gutter/margin không được token hóa thành CSS custom properties vì chúng phụ thuộc layout cụ thể và không cần theme switching. Các giá trị này dùng như pattern khi viết layout, không phải foundation tokens.

| Breakpoint | Columns | Gutter | Margin |
|------------|---------|--------|--------|
| compact | 4 | 16px | 16px |
| medium | 4 | 16px | 24px |
| expanded | 12 | 24px | 24px |
| large | 12 | 24px | 32px |
| extra-large | 12 | 24px | 48px |

**Lý do:**
- 4-column đủ cho màn hình nhỏ (button, card, list).
- 12-column cho desktop giống Carbon/Material, linh hoạt layout.
- Gutter 16-24px đủ rộng để phân tách, không quá lớn gây lãng phí.

### 3. Container patterns

Container max-width không được token hóa. Dùng hardcode px hoặc component token khi cần, nhưng không sinh CSS custom property chung.

| Context | Max-width | Usage |
|---------|-----------|-------|
| Popup | 320-360px | Extension popup |
| Sidepanel | 480px | Desktop sidepanel |
| Dialog compact | 100% (dưới 600px) | Full-screen trên mobile |
| Dialog | 480px | Default dialog |
| Dialog large | 640px | Wide dialog |
| Options page | 1120px | Centered page |

### 4. Responsive patterns

- **Dialog**: full-screen dưới 600px; max-width 448px trên 840px+.
- **Sidepanel**: 100% width, max-width 480px.
- **Options page**: max-width 1120px, centered.
- **Popup**: max-width 360px, min-width 320px.

## Consequences

**Positive:**
- Responsive rõ ràng theo thiết bị thực tế.
- 4/12 column phù hợp cả mobile và desktop.

**Negative:**
- Component cũ dùng hardcoded `@media (max-width: 768px)` cần chuẩn hóa lại về 600px/840px hoặc giữ nguyên nếu là feature-local threshold.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| 8pt grid cho tất cả | Quá thô cho mobile. |
| Chỉ 1 breakpoint (mobile/desktop) | Không đủ cho tablet/sidepanel. |
| 16-column desktop | Quá phức tạp, không cần thiết cho extension. |

## References

- [Carbon 2x Grid](https://cds-pictograms.vercel.app/guidelines/layout)
- [Material 3 — Breakpoints](https://m3.material.io/foundations/layout/understanding-layout/overview)
- [Apple HIG — Adaptivity & Layout](https://developer.apple.com/design/human-interface-guidelines/foundations/adaptivity-and-layout/)
