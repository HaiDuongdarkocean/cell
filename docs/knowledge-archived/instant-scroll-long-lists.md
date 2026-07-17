# Instant scroll for long lists (learned while fixing side panel motion sickness)

> **Principle**: [Instant scroll for long lists, smooth only for short distances](principles.md#instant-scroll-for-long-lists-smooth-only-for-short-distances)

## Problem

Side panel subtitle cue list scroll gây **motion sickness** khi panel mở hoặc user
seek far. `scrollIntoView({ behavior: 'smooth', block: 'center' })` animate scroll
từ top của list (vị trí ban đầu) đến middle (highlighted cue) — khoảng cách lớn →
animation dài → disorienting.

## Root causes

### `scrollIntoView` smooth behavior trên long list

```typescript
// CueList.tsx — trước fix:
highlightedRef.current?.scrollIntoView({
  behavior: 'smooth',  // ← animate scroll
  block: 'center',
});
```

Khi panel mở hoặc user seek far:
1. `highlightedRef.current` = null (chưa render highlighted cue)
2. List render → `highlightedRef.current` set → `scrollIntoView` fire
3. List ở top (scroll position 0), highlighted cue ở middle (VD: cue 500/1000)
4. `behavior: 'smooth'` animate scroll từ 0 → middle → **long animation** → motion sickness

## Fix

### `behavior: 'auto'` (instant scroll)

```typescript
// CueList.tsx — sau fix:
highlightedRef.current?.scrollIntoView({
  behavior: 'auto',  // ← instant, no animation
  block: 'center',
});
```

`behavior: 'auto'` = instant scroll (no animation). User không bị disorient vì list
jump thẳng đến highlighted cue, không animate qua toàn bộ list.

## Key insight

`scrollIntoView({ behavior: 'smooth' })` phù hợp cho **short distance** (scroll vài
item, user thấy context movement). Trên **long list** (hundreds/thousands items),
smooth scroll animate qua toàn bộ list → motion sickness + disorientation.

Rule: **Instant scroll cho long distance, smooth cho short distance.** Khi không biết
beforehand distance (VD: panel open, seek far) → default instant. User có thể scroll
manual nếu muốn xem context.

## Verification

### Regression test (CueList.test.tsx)

```
✓ uses instant scroll (behavior: 'auto') not smooth
```

### Unit tests: 1136/1137 pass. `npx tsc --noEmit`: pass.

## Apply cho
- Long list scroll (cue list, log viewer, chat history)
- Seek-to-position (jump far → instant, not animate)
- Panel open with pre-selected item (jump to item, not animate from top)
- Any `scrollIntoView` trên list > 50 items
