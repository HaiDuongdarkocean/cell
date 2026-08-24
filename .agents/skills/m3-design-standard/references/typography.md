# Typography

## 15-style scale

| Role | Size | sp | Line height | Weight |
|------|------|----|-------------|--------|
| Display | Large | 57 | 64 | 400 |
| Display | Medium | 45 | 52 | 400 |
| Display | Small | 36 | 44 | 400 |
| Headline | Large | 32 | 40 | 400 |
| Headline | Medium | 28 | 36 | 400 |
| Headline | Small | 24 | 32 | 400 |
| Title | Large | 22 | 28 | 400 |
| Title | Medium | 16 | 24 | 500 |
| Title | Small | 14 | 20 | 500 |
| Body | Large | 16 | 24 | 400 |
| Body | Medium | 14 | 20 | 400 |
| Body | Small | 12 | 16 | 400 |
| Label | Large | 14 | 20 | 500 |
| Label | Medium | 12 | 16 | 500 |
| Label | Small | 11 | 16 | 500 |

Nguồn: Android Compose Typography API, Flutter TextTheme, M3 typography docs.

## Font family

- Default: Roboto. Fallback: `'Roboto Flex', 'Roboto', 'Noto Sans', system-ui, sans-serif`.
- Brand typeface: Display, Headline. Plain typeface: Body, Label.

## Accessibility

- Font size tối thiểu: 10sp (không bao giờ thấp hơn).
- Dùng `sp` (Android) / `rem` (web) để user scale qua system settings.
- Line length tối đa ~60 ký tự cho readability trên màn lớn.

## Cell tokens

| Token | Value | M3 tương đương |
|-------|-------|----------------|
| `--font-size-xs` | 12px | Body Small |
| `--font-size-sm` | 14px | Body Medium / Label Large |
| `--font-size-base` | 16px | Body Large / Title Medium |
| `--font-size-lg` | 18px | (không có trong M3) |
| `--font-size-xl` | 20px | (không có trong M3) |

Cell có 5 font size, M3 có 15. Thiếu Display, Headline, Title Large/Small, Label Medium/Small. Chỉ thêm khi component thực sự cần.
