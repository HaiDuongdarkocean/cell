# ADR-051: Add a 'very-low' frequency band so 100% of tokens with frequency data are colored

## Context

Khi test tokenize trên trang <https://scrappey.com/qa/reverse-engineering/why-content-scripts-cant-hook-page-javascript>,
nhận thấy frequency chỉ hiển thị trên một tỷ lệ rất nhỏ các từ. Phần lớn các từ
đã được tokenize nhưng không có màu frequency. Nguyên nhân là `rankToBand` chỉ
phân loại rank ≤20.000 thành `low`; các rank cao hơn (rare words) trả về `'none'`,
nên `tokenSpanRenderer` không gắn class frequency và token hiển thị như plain text.

Ngoài ra, `tokenSpanRenderer` luôn thêm `js-cell-token--frequency-off` cho token
có status `known` hoặc `ignore`, bất kể toggle `showFrequency`. Điều này làm giảm
thêm số lượng token có frequency visible, dù người dùng đã bật frequency layer.

## Decision

1. **Mở rộng `TokenFrequencyBand` thêm `'very-low'`** (`src/features/tokenize/types.ts`).
2. **Sửa `rankToBand`** (`src/features/tokenize/utils/frequencyBand.ts`):
   - `high` ≤ 1000, `medium` ≤ 5000, `low` ≤ 20000.
   - Mọi rank dương hữu hạn còn lại trả về `'very-low'`.
   - Chỉ `rank <= 0`, `NaN`, hoặc `Infinity` mới trả về `'none'`.
3. **Sửa `entriesToBand` fallback cho missing data** (`src/features/tokenize/utils/frequencyBand.ts`):
   - Nếu một term được tokenize nhưng không có frequency entry nào trong dictionary,
     trả về `'very-low'` thay vì `'none'`. Điều này đảm bảo 100% token đều có
     frequency band visible.
4. **Cập nhật `tokenSpanRenderer`** (`src/features/tokenize/ui/tokenSpanRenderer.ts`):
   - Thêm class `js-cell-token--frequency-very-low` khi `frequencyBand === 'very-low'`.
   - Chỉ ẩn frequency layer khi `!options.showFrequency`; không ẩn thêm cho
     `known`/`ignore` để `showFrequency` toggle kiểm soát 100% token.
5. **Cập nhật `tokenSpanCss`** (`src/features/tokenize/ui/tokenSpanCss.ts`):
   - Thêm CSS variables `--cell-token-freq-very-low-bg/fg`.
   - Thêm class `.js-cell-token--frequency-very-low`.

## Why (chỉ WHY)

- Frequency band là một tính năng trực quan; nếu dictionary có dữ liệu cho một
  từ (dù rare), ta nên hiển thị nó thay vì để token “lạc lõng” không màu.
- Mọi rank dương hữu hạn đều là dữ liệu hợp lệ; phân loại hết vào `very-low`
  giúp 100% token có frequency data được parse và hiển thị.
- `showFrequency` toggle nên là single source of truth cho việc ẩn/hiện frequency
  layer; ép ẩn frequency cho `known`/`ignore` là unexpected behavior và cản trở
  mục tiêu “100% parse frequency”.

## Trade-offs

- `very-low` có thể chiếm phần lớn tokens nếu corpus lớn; đây là trade-off của
  việc ưu tiên coverage 100% thay vì chỉ highlight các từ phổ biến.
- Màu của `very-low` (xám/muted) được chọn để không gây distraction, phân biệt
  với high/medium/low.
