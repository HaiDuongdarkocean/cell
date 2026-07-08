# Shape, Elevation & Motion Tokens — Cell Extension

## Radius tokens

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--radius-sm` | 6px | stable | 1.0.0 | Small controls | theme.css:61 |
| `--radius-md` | 8px | stable | 1.0.0 | Default border (button, dropdown) | theme.css:62 |
| `--radius-lg` | 12px | stable | 1.0.0 | Cards, panels | theme.css:63 |
| `--radius-full` | 9999px | stable | 1.0.0 | Pills, half-circle collapse | theme.css:64 |

## Shadow tokens

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) / 0.3 dark | stable | 1.0.0 | Subtle elevation | theme.css:67 |
| `--shadow-md` | 0 4px 12px rgba(0,0,0,0.08) / 0.4 dark | stable | 1.0.0 | Floating panels, dropdowns | theme.css:68 |

## Transition tokens

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--transition` | 150ms ease | stable | 1.0.0 | Default transition | theme.css:71 |
| `--transition-fast` | 150ms | stable | 1.0.0 | Fast transition | theme.css:72 |
| `--transition-normal` | 200ms | stable | 1.0.0 | Normal transition | theme.css:73 |
| `--ease-standard` | ease | stable | 1.0.0 | Default easing | theme.css:74 |

---

## Feature-specific tokens (Nav Cluster — ADR-018)

| Token | Value | Status | Since | Used in | Source |
|---|---|---|---|---|---|
| `--nav-cluster-size-sm` | 40px | stable | 1.2.0 | Cluster button (small/dense) | theme.css:77 |
| `--nav-cluster-size-md` | 48px | stable | 1.2.0 | Cluster button (default) | theme.css:78 |
| `--nav-cluster-size-lg` | 56px | stable | 1.2.0 | Cluster button (touch) | theme.css:79 |
| `--nav-cluster-bg-opacity-default` | 0.7 | stable | 1.2.0 | Cluster bg opacity default | theme.css:80 |
| `--nav-cluster-btn-opacity-default` | 0.9 | stable | 1.2.0 | Cluster button opacity default | theme.css:81 |
| `--nav-cluster-collapse-size` | 32px | stable | 1.2.0 | Half-circle collapsed diameter | theme.css:82 |
| `--nav-cluster-edge-threshold` | 20px | stable | 1.2.0 | Drag-to-edge collapse threshold | theme.css:83 |
| `--nav-cluster-z-index` | 1000001 | stable | 1.2.0 | Above subtitle overlay (999999) | theme.css:84 |
| `--nav-cluster-repeat-hold-ms` | 500 | stable | 1.2.0 | Repeat hold threshold | theme.css:85 |
| `--nav-cluster-no-sub-window-ms` | 3000 | stable | 1.2.0 | No-sub repeat window | theme.css:86 |

## Border radius scale comparison

See [../references.md#border-radius-scale-comparison](../references.md#border-radius-scale-comparison) for YouTube/M3/our token mapping.
