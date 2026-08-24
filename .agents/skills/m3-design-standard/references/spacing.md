# Spacing

## Base unit

M3 dùng **4dp grid** cho element nhỏ (icon, type) và **8dp grid** cho layout (margin, padding, gutter).

## Spacing scale

| dp | Dùng cho |
|----|----------|
| 4 | Icon padding, tight spacing |
| 8 | Button internals, TextField top/bottom, gutter |
| 12 | List 3-line vertical, form gap |
| 16 | Standard padding/margin, list horizontal, TextField L/R |
| 24 | Button horizontal, dialog padding, section spacing |
| 32 | Major component spacing |
| 48 | Touch target minimum |

## Component specs

| Component | Padding | Token |
|-----------|---------|-------|
| Button (no icon) | H 24dp | `--space-6` |
| Button (with icon) | L 16dp, R 24dp | `--space-4` / `--space-6` |
| TextField | V 8dp, H 16dp | `--space-2` / `--space-4` |
| List item | H 16dp, V 16dp (12dp if 3-line) | `--space-4` / `--space-3` |
| Card | Flexible (container padding = 0, regions own spacing) | — |
| Dialog | 24dp | `--space-6` |

Touch target: **48dp minimum** (M3). Cell đang dùng 44px (Apple) — cân nhắc tăng lên 48px.

## Dead spacing rule

Token compliance ≠ spacing correctness. Một file pass tất cả token check nhưng vẫn có **dead spacing**: 2+ layer Box Model spacing chồng nhau không có content giữa.

```
BAD: Card (padding 16px) → cardBody (padding 12px) → Row (padding 12px)
     = 24px dead spacing giữa content layers

GOOD: Card (padding 0) → cardBody (padding 0) → Row (padding 12px 16px)
      = 1 layer owns spacing, container = border + radius only
```

**Quy tắc**: Tối đa 1 Box Model Spacing layer giữa 2 content layer. Container = border + radius, Row = spacing owner.

## Cell tokens

| Token | Value | M3 match |
|-------|-------|----------|
| `--space-1` | 4px | ✅ M3 base |
| `--space-2` | 8px | ✅ M3 layout grid |
| `--space-3` | 12px | ✅ M3 (Compose) |
| `--space-4` | 16px | ✅ M3 standard |
| `--space-6` | 24px | ✅ M3 section |
| `--space-8` | 32px | ✅ M3 macro |
| `--space-12` | 48px | ✅ M3 touch target |

Half-steps (2px, 6px, 10px, 14px): không có trong M3 nhưng hữu ích cho optical adjustment. Giữ cho flexibility.
