# ADR-086: Spacing System for "Quiet Confidence" Foundation

## Status

Proposed — awaiting build + showcase prototype before final acceptance.

## Context

Spacing quyết định relationship và hierarchy. Cell hiện dùng 4px base với scale khá tốt, nhưng chưa có lý do rõ ràng cho lựa chọn này. Nhiều hệ thống khác dùng 8pt/8px base (Carbon, Atlassian). Cần đưa ra quyết định conscious.

## Decision

### 1. Giữ 4px base unit

**Quyết định:** spacing base unit = `4px`.

**Lý do:**
- Cell là **MV3 extension** với UI surfaces nhỏ: popup, sidepanel, options, dictionary popup. Không gian chật, cần micro-spacing (2px, 6px, 10px) để điều chỉnh chính xác.
- 4px là base unit của **Material 3 spacing tokens** ([nguồn](https://m3.material.io/styles/spacing/tokens)).
- 4px cho phép scale mịn: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 80, 96.
- 8px base sẽ ép spacing thành 8, 16, 24, 32 — quá thô cho popup nhỏ.

**Rejected:**
- **8px base** (Carbon, Atlassian): tốt cho web app/desktop, nhưng quá thô cho extension UI dense.
- **8pt base với 2px mini unit** (Carbon 2x grid): quá phức tạp, không cần thiết cho MVP.

### 2. Spacing scale — 21 steps

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | No space |
| `--space-0-5` | 2px | Icon/text gap, hairline |
| `--space-1` | 4px | Tight internal padding |
| `--space-1-5` | 6px | Compact gap |
| `--space-2` | 8px | Default small gap |
| `--space-2-5` | 10px | Button padding-y, small controls |
| `--space-3` | 12px | Input padding, row gap |
| `--space-3-5` | 14px | Card padding compact |
| `--space-4` | 16px | Card padding, section gap |
| `--space-5` | 20px | Section margin |
| `--space-6` | 24px | Dialog padding, large gap |
| `--space-7` | 28px | Section spacing |
| `--space-8` | 32px | Page section |
| `--space-9` | 36px | Page block |
| `--space-10` | 40px | Large section |
| `--space-11` | 44px | Touch target container |
| `--space-12` | 48px | Page hero |
| `--space-14` | 56px | Extra-large section |
| `--space-16` | 64px | Major section |
| `--space-20` | 80px | Page top/bottom |
| `--space-24` | 96px | Landing section |

### 3. Spacing types & rules

- **Padding** (inside): dùng scale từ `space-1` đến `space-6`.
- **Margin** (outside): tránh dùng margin, ưu tiên `gap` trong flex/grid.
- **Gap**: dùng scale `space-1` đến `space-8`.
- **Section spacing**: `space-6` đến `space-12`.

### 4. Component spacing principles

- **Touch target**: 44px mobile, 40px desktop → dùng `--touch-target-mobile` / `--touch-target-desktop`.
- **Button padding**: `y = space-2-5` (10px), `x = space-4` (16px).
- **Input padding**: `y = space-2-5`, `x = space-3`.
- **Card padding**: `space-4` (16px) default, `space-3-5` (14px) compact.
- **Dialog padding**: `space-6` (24px).

## Consequences

**Positive:**
- 4px base phù hợp dense UI của extension.
- 18 steps đủ linh hoạt nhưng không quá nhiều.
- Micro-spacing giúp UI chính xác trên màn hình nhỏ.

**Negative:**
- Cần đảm bảo dev không dùng `space-1` (4px) cho margin lớn, gây clutter.
- Một số web convention 8px base có thể khiến designer mới bối rối.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| 8px base (Carbon/Atlassian) | Quá thô cho extension UI nhỏ. |
| 2px base (quá nhỏ) | Không tạo được visual rhythm rõ, dễ dùng magic numbers. |
| Scale liên tục (4, 8, 16, 32, 64) | Thiếu steps trung gian (12, 20, 28) cần cho UI chặt. |

## References

- [Material 3 Spacing Tokens](https://m3.material.io/styles/spacing/tokens)
- [Carbon Spacing](https://v10.carbondesignsystem.com/guidelines/spacing/overview/)
- [Atlassian Spacing](https://atlassian.design/foundations/spacing)
