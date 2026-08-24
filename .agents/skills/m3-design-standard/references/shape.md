# Shape

## Shape scale

| Token | dp | CSS |
|-------|----|-----|
| None | 0 | `0px` |
| Extra Small | 4 | `4px` |
| Small | 8 | `8px` |
| Medium | 12 | `12px` |
| Large | 16 | `16px` |
| Extra Large | 28 | `28px` |
| Full | 50% | `9999px` |

Nguồn: Android Compose ShapeTokens, M3 shape docs.

## Component → shape

| Component | Shape | dp |
|-----------|-------|----|
| Button | Full | 50% |
| Card | Medium | 12 |
| Dialog | Extra Large | 28 |
| TextField | Extra Small | 4 |
| Chip | Small | 8 |
| FAB | Large | 16 |
| Bottom Sheet | Extra Large (top only) | 28 |
| Snackbar | Extra Small | 4 |
| Menu | Extra Small | 4 |
| List Item | None | 0 |
| Nav Drawer Item | Full | 50% |

## Quy tắc

- Shape không đổi trong dark mode.
- Shape không liên quan elevation.
- Button shape hardcoded Full (50%), không themeable.

## Cell tokens

| Token | Value | M3 tương đương |
|-------|-------|----------------|
| `--radius-2xs` | 4px | Extra Small |
| `--radius-sm` | 8px | Small |
| `--radius-lg` | 12px | Medium |
| `--radius-xl` | 16px | Large |
| `--radius-card` | 12px | Medium ✅ |
| `--radius-full` | 9999px | Full |

Thiếu 28px (M3 Extra Large) cho dialog. `--radius-md` = 8px trùng `--radius-sm` = 8px — cần dọn.
