# Component Mapping — dict-sheet-breadcrumb

> Variant: Lookup trail strip — fixed header slot trong Sheet (all mode, single justified variant).

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Strip host — fixed giữa handle và `.content` | `Sheet` | extend (additive `header?: ReactNode`, render giữa `.handle` và `.content`) | — | — |
| Modal/inert phân tầng | `Sheet` | extend (additive `modal?: boolean` + `inert?: boolean`; `aria-modal` chỉ khi `modal` true, `inert` khi non-top) | — | — |
| Strip container | — | create — `LookupTrail` (feature file `dictionaryPopup/ui/LookupTrail.tsx`, không phải shared atom): cần scroll ngang + wheel-map + auto-scroll-end mà `Breadcrumb` không lo | `derived.light.color-surface-card`/`derived.dark.color-surface-card`, `derived.light.color-border-subtle`/`derived.dark.color-border-subtle`, `static.spacing.1`, `static.spacing.2`, `static.motion.duration-normal`, `static.motion.ease-out` | — |
| Crumb list + separators + current | `Breadcrumb` | extend — `separator?: string` (local CSS custom prop, default `/`) để render `>`; clickable qua label là `<Button>` | `static.font.sizes.sm`, `core.light.textSecondary`/`core.dark.textSecondary`, `core.light.text`/`core.dark.text` | — |
| Crumb button | `Button` | reuse — `variant="ghost" size="sm"`; `min-height` từ `static.touchTarget.mobile` sẵn có | `component.button.padding-y-sm`, `component.button.padding-x-sm`, `component.button.font-size-sm` | — |
| Crumb label truncate | — | create (class trong `LookupTrail.module.css`) | `static.spacing.24` làm `max-width` cap | — |
| Scrollbar ẩn | — | reuse (`composes: hide` từ `Scrollable.module.css`) | — | — |
| Scroll-edge fade | — | create (`mask-image` gradient per-edge, class toggle theo scrollLeft/scrollWidth trong `LookupTrail`) | `static.spacing.5` làm fade width | — |
| Strip aria-label | — | reuse `ui.breadcrumb.aria` message đã có | — | — |

Notes:

- `Sheet` extension giữ backward-compat: `header` optional, `modal`/`inert` default giữ behavior cũ — SubtitleManager (`ManagerLayer.tsx`) không đổi.
- `Breadcrumb.separator` implement bằng CSS custom prop (`.item::after { content: var(<local var>, '/') }`) — prop `separator` set inline style trên `<nav>`; không đổi markup.
- `LookupTrail` là feature wrapper duy nhất được tạo: nhận `trail: readonly string[]` + `onNavigate(index)`, render `null` khi `trail.length < 2` (gate ở nơi gọi cũng được, component tự guard để an toàn).
- Wheel map: `onWheel` trên strip — `if (e.deltaX === 0 && e.deltaY !== 0) { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault(); }` (non-passive listener cần `addEventListener` với `{ passive: false }` vì React wheel là passive).
- `lookupTerm` (PopupLevel) + `trail`/`isTopLevel`/`onTrailNavigate` (mount options + `setOptions` keys) là data plumbing — không phải visual element.
