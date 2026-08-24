# Motion

## Duration scale

| Token | ms | Dùng cho |
|-------|-----|----------|
| short1 | 50 | Ripple, checkbox tick |
| short2 | 100 | Element nhỏ appear/disappear |
| short3 | 150 | Icon transition, selection |
| short4 | 200 | Tooltip, chip selection |
| medium1 | 250 | FAB expand, card state change |
| medium2 | 300 | **Phổ biến nhất** — dialog, sheet, drawer |
| medium3 | 350 | Expanded component transition |
| medium4 | 400 | Page-level panel transition |
| long1 | 450 | Complex layout change |
| long2 | 500 | Shared element enter |
| long3 | 550 | Shared element large content |
| long4 | 600 | Full container morph |
| extraLong1-4 | 700-1000 | Full-screen transition only |

## Easing curves

| Token | cubic-bezier | Dùng |
|-------|--------------|------|
| standard | `0.2, 0, 0, 1` | Simple state change, two-way |
| standard-decelerate | `0, 0, 0, 1` | Enter (simple) |
| standard-accelerate | `0.3, 0, 1, 1` | Exit (simple) |
| emphasized | `0.2, 0, 0, 1` | Default M3 component transition |
| emphasized-decelerate | `0.05, 0.7, 0.1, 1` | Element arrive on screen |
| emphasized-accelerate | `0.3, 0, 0.8, 0.15` | Element leave screen |
| linear | `0, 0, 1, 1` | Looping only |
| legacy | `0.4, 0, 0.2, 1` | M2 — KHÔNG DÙNG |

## Duration × Easing

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Enter screen | 300ms | emphasized-decelerate |
| Exit screen | 200ms | emphasized-accelerate |
| Dialog enter | 300ms | emphasized-decelerate |
| Dialog exit | 200ms | emphasized-accelerate |
| Card state change | 250ms | standard |
| Bottom sheet | 300ms | emphasized |
| Press feedback | 50ms | standard |
| Container transform | 500-550ms | emphasized |

**Quy tắc Enter/Exit**: Enter = decelerate (fast start, gentle settle). Exit = accelerate (slow start, quick departure). Không bao giờ dùng cùng easing cho cả hai.

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- Tránh scale/pan object lớn (gây vestibular trigger).
- Ưu tiên cross-fade thay vì spatial transform.
- Bỏ parallax và choreography phức tạp.

## Cell tokens

| Token | Value | M3 tương đương |
|-------|-------|----------------|
| `--duration-fast` | 175ms | (giữa short3 và short4) |
| `--duration-normal` | 200ms | ≈ short4 |
| `--duration-medium` | 410ms | (giữa medium4 và long1) |

Thiếu 50ms, 100ms, 150ms, 250ms, 300ms. Thiếu emphasized-decelerate / emphasized-accelerate easing.
