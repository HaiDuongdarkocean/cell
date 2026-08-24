# Elevation

## Levels

| Level | dp | Shadow CSS | Dùng cho |
|-------|----|------------|----------|
| 0 | 0 | none | Flat surface — Filled Card, Filled Button |
| 1 | 1 | `0 1px 4px 0 rgba(0,0,0,0.37)` | Elevated Card, Elevated Button |
| 2 | 3 | `0 2px 2px 0 rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.3)` | Nav Bar, Menu, Tooltip |
| 3 | 6 | `0 11px 7px 0 rgba(0,0,0,0.19), 0 13px 25px 0 rgba(0,0,0,0.3)` | FAB, Dialog |
| 4 | 8 | `0 14px 12px 0 rgba(0,0,0,0.17), 0 20px 40px 0 rgba(0,0,0,0.3)` | FAB hovered, Card dragged |
| 5 | 12 | `0 17px 17px 0 rgba(0,0,0,0.15), 0 27px 55px 0 rgba(0,0,0,0.3)` | Reserved |

Nguồn: Android Compose ElevationTokens, material-web.

## Component → elevation

| Component | Default | Hovered |
|-----------|---------|---------|
| Filled Card | L0 | — |
| Elevated Card | L1 | L2 |
| Outlined Card | L0 | — |
| Filled Button | L0 | L1 |
| FAB | L3 | L4 |
| Dialog | L3 | — |
| Nav Bar | L2 | — |
| Menu | L2 | — |

## Dark mode

M3 dùng **surface tint** (primary color overlay) thay vì shadow trong dark mode.

| Level | Tint opacity |
|-------|-------------|
| L0 | 0.00 |
| L1 | 0.05 |
| L2 | 0.08 |
| L3 | 0.11 |
| L4 | 0.12 |
| L5 | 0.14 |

Light theme: shadow + tint. Dark theme: chủ yếu tint, shadow giảm hoặc bỏ.

## Cell status

`tokens.json` chưa có elevation token. Cần thêm:

```json
"elevation": {
  "level0": "0",
  "level1": "1",
  "level2": "3",
  "level3": "6",
  "level4": "8",
  "level5": "12"
}
```
