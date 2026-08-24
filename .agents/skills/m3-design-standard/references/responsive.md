# Responsive

## Window size classes

| Class | M3 (dp) | Cell (px) |
|-------|---------|-----------|
| Compact | <600 | 320-599 |
| Medium | 600-839 | 768-1023 |
| Expanded | 840-1199 | 1024-1279 |
| Large | 1200-1599 | 1280-1919 |
| Extra-large | ≥1600 | 1920+ |

Cell dùng breakpoint 480/768/1024/1280/1920 thay vì 600/840/1200/1600 vì extension viewport nhỏ hơn mobile fullscreen. Giữ Cell breakpoints.

## Quy tắc chính

**Component padding cố định across breakpoints.** Chỉ layout-level (margin, gutter, pane spacer) đổi.

## Cell responsive strategy

Mobile-first CSS với `@media (min-width: ...)`:

```css
/* Base = 320px (mobile) */
.component { padding: var(--space-3); }

/* 480px+ */
@media (min-width: 480px) {
  .component { padding: var(--space-4); }
}

/* 768px+ */
@media (min-width: 768px) {
  .panel { flex-direction: row; }
}
```

- Base CSS = màn nhỏ nhất (320px).
- Component padding: cố định (hoặc scale tối thiểu).
- Layout gap/margin: scale per breakpoint.
- Layout direction: column mobile → row tablet+.
