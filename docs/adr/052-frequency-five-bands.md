# ADR-052: 5-band frequency levels for tokenize

## Context

Tokenize hiện tại dùng 4 band `high`/`medium`/`low`/`very-low` với ngưỡng 1k/5k/20k. Các ngưỡng này:
- Thiếu một cấp độ ở giữa để phản ánh vocabulary milestones thực tế.
- Tên gọi (`high`/`medium`/`low`) không truyền tải rõ ý nghĩa học tập cho người dùng.
- Band `high` quá hẹp (≤1k), khiến nhiều từ "rất phổ biến" (theo nghiên cứu tần suất) bị tô màu `medium`.

Nhu cầu từ phía sản phẩm: xây dựng nền tảng phân cấp frequency từ vựng dựa trên research SLA (Krashen i+1, AJATT, MIA) để người dùng có thể dựa vào đó quyết định "có học hay không" cho từng từ.

## Decision

1. **Thay `TokenFrequencyBand` thành 5 band** (`src/features/tokenize/types.ts`):
   - `core` — rank ≤ 3.000 — Rất phổ biến
   - `common` — 3.000 < rank ≤ 5.000 — Phổ biến
   - `general` — 5.000 < rank ≤ 10.000 — Thông dụng
   - `advanced` — 10.000 < rank ≤ 20.000 — Chuyên sâu
   - `rare` — rank > 20.000 — Hiếm
   - `none` — rank ≤ 0, `NaN`, `Infinity` (invalid data)
2. **Sửa `rankToBand`** (`src/features/tokenize/utils/frequencyBand.ts`):
   - Ngưỡng mới: 3k / 5k / 10k / 20k.
   - Mọi rank dương hữu hạn còn lại trả về `rare`.
3. **Sửa `entriesToBand` fallback** (`src/features/tokenize/utils/frequencyBand.ts`):
   - Term được tokenize nhưng không có frequency entry → `rare` thay vì `none`/`very-low`, duy trì 100% token có màu.
4. **Cập nhật `tokenSpanCss`** (`src/features/tokenize/ui/tokenSpanCss.ts`):
   - Thay CSS variables `--cell-token-freq-*` và class `.js-cell-token--frequency-*` theo 5 band mới.
   - Màu: `core` success, `common` warning, `general` info, `advanced` secondary (ponytail: design system chưa có màu semantic riêng cho band thứ 4, cần tune sau), `rare` muted.
5. **Cập nhật test** (`frequencyBand.test.ts`, `tokenSpanRenderer.test.ts`, `textTokenizer.test.ts`):
   - Đổi assertions và sample data sang band mới.
6. **Cập nhật `docs/2-architechture-system.md`**:
   - Ghi nhận ADR-052 trong mô tả `tokenize/` và function index.

## Why (chỉ WHY)

- 3k/5k/10k/20k là các vocabulary coverage milestones được dùng trong nghiên cứu tần suất: ~3k word families bao phủ đa số ngôn ngữ đời thường, ~5k-10k nâng coverage lên 95-98%, ~20k là ranh giới educated native vocabulary.
- 5 cấp độ cho phép ánh xạ tốt hơn với các framework học ngôn ngữ:
  - `core`/`common` = từ cần học ngay (i+1 gần, phổ biến).
  - `general` = học nếu gặp lặp lại.
  - `advanced` = học nếu cần cho domain cụ thể.
  - `rare` = mặc định bỏ qua.
- Giữ nguyên nguyên tắc từ ADR-051: 100% token có dữ liệu (dù là `rare`) đều được tô màu, `showFrequency` toggle là SSOT cho layer.
- Tên gọi mới (core/common/general/advanced/rare) truyền tải ý nghĩa SLA rõ hơn `high`/`medium`/`low`/`very-low`.

## Trade-offs

- `advanced` dùng token màu surface (`--color-secondary`) vì design system hiện chỉ có 4 màu semantic distinct (success/warning/info/error) + muted. Đây là visual ceiling cần tune khi có palette mới.
- Tên band dài hơn (`common`/`general`/`advanced`) có thể khiến class CSS dài hơn, nhưng vẫn trong giới hạn chấp nhận và rõ nghĩa hơn.
- Thay đổi là breaking đối với bất kỳ code nào còn hardcode `high`/`medium`/`low`/`very-low`; đã grep và cập nhật toàn bộ `src/features/tokenize`.
