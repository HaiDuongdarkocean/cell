# Component mapping — condensed-audio · Media shelf

> Variant: media shelf trong tab `playlist` mới của universal panel + circle action trong SubtitleManagerPanel + settings row + record pill. Elements → shared components.

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Playlist tab nav entry (bottom nav + desktop sidebar) | — | extend — feature nav (`UniversalPanelBottomNav` + `UniversalPanelTab` union), không phải shared component | — | icon: `audioWave` |
| Item row container | `Card` | extend — `variant='default'` + `job` modifier class (status border) — precedent durable-job-registry | `--input-bg`, `--border`, `--radius-md` | — |
| Status icon leading | `Icon` | reuse | — | icon: `loader` (processing/recording), icon: `check` (ready), icon: `alertCircle` (failed), icon: `info` (missing) |
| Item title | `Text` | reuse — `size='sm'` truncate | `--text` | — |
| Meta line (duration · size · format · Drive state) | `Text` | reuse — `size='xs'`, `color='secondary'` | `--textSecondary` | icon: `navRepeat` (synced badge inline) |
| Failure/pending reason line | `Text` | reuse — `size='xs'` warning/error color | `--warning`, `--error` | — |
| Progress bar (processing rows) | `Progress` | reuse — `value`/`max` | (component tokens) | — |
| Play preview button | `Button` | reuse — `variant='ghost'`, `size='sm'`, aria-label | (component tokens) | icon: `play` / icon: `pause` |
| Save-a-copy action | `Button` | reuse — `variant='ghost'`, `size='sm'` | — | icon: `download` |
| Sync Drive action | `Button` | reuse — `variant='ghost'`, `size='sm'` | — | icon: `navRepeat` |
| Delete action | `Button` | reuse — `variant='ghost'`, `size='sm'` | — | icon: `trash` |
| Retry action (failed) | `Button` | reuse — `variant='ghost'`, `size='sm'` | — | icon: `rotateCcw` |
| "Chọn thư mục export" pending action | `Button` | reuse — `variant='secondary'`, `size='sm'` | — | icon: `folderOpen` |
| Item list stack | `Stack` | reuse — vertical `gap='2'` | `--spacing-2` | — |
| Empty state block | `Text` + `Icon` | reuse — centered icon + 2-line hint | `--textSecondary` | icon: `audioWave` |
| SubtitleManager trigger button | `Button` | reuse — `shape='circle'`, header action row | (component tokens) | icon: `audioWave` |
| Record pill (overlay trên video) | `Button` + row div | extend — overlay pill: filled `--input-bg` row, `radius-md`; stop = circle `Button` variant `overlay` | `--input-bg`, `--error` (dot), `--radius-md` | icon: `x` (stop) |
| Recording elapsed text | `Text` | reuse — `size='xs'` trong pill | `--text` | — |
| Settings → Media row (export dir) | settings row pattern (label + value + Button) | reuse — giống các row path/folder hiện có trong Media card | `--textSecondary` | icon: `folderOpen` |
| Live region (status flips) | `Card` row container | extend — `aria-live='polite'` | — | — |

## Decisions rationale

- **Không `create` gì** — mọi element map lên `Card`/`Icon`/`Text`/`Progress`/`Button`/`Stack` + nav item + settings row. Phần mới duy nhất là `PlaylistTab.tsx` (tổ hợp sẵn-có) + record pill (row + overlay button, surface grammar giống NavCluster overlay).
- **Icon `audioWave` cho tab** — cùng icon với Settings→Audio nav; semantic đúng ("audio waveform") và catalog không có icon playlist; context tab vs settings card đủ phân biệt.
- **Drive sync icon `navRepeat`** — icon đã dùng cho section Sync trong settings nav; catalog không có cloud icon — giữ nhất quán.
- **Record pill `variant='overlay'`** — grammar của NavCluster buttons đã ship trên video surface; không tự viết glass.
- **JobRow** — tái dùng row language của durable-job-registry (status icon + label + meta + progress + actions); render trong Playlist tab (owning surface), không thêm Activity center.

## Accessibility

- `aria-live='polite'` trên item row → status flips announce (NFR-5).
- Record pill `role='status'`; elapsed updates throttle ≥1s (không spam SR).
- Icon-only buttons đều `aria-label` (Button API sẵn).
- `disabled` trigger button có tooltip/aria-describedby "cần subtitle".
