# Audit Checklist

## Process (4 phase — rẻ → đắt)

```
Phase 1: Static scan (audit.sh, tất cả files) → loại files sạch
Phase 2: Runtime measure (MCP devtools, files đáng ngờ) → đo Box Model thực tế
Phase 3: Visual verify (screenshot, elements cụ thể) → xác nhận mắt thấy
Phase 4: Migration plan (nếu non-SSOT) → reuse → variant → new atom
```

## Token compliance

### Spacing
- [ ] Tất cả padding/margin/gap dùng `var(--space-*)` — không hardcode px
- [ ] Touch target ≥ 48px (M3) hoặc 44px (Apple — Cell hiện tại)
- [ ] Tất cả spacing là bội số của 4 (hoặc half-step 2px cho optical)

### Shape
- [ ] Tất cả border-radius dùng `var(--radius-*)` — không hardcode px
- [ ] Card dùng 12px (M3 Medium)
- [ ] Dialog dùng 28px (M3 Extra Large)

### Typography
- [ ] Tất cả font-size/line-height/font-weight/letter-spacing dùng token
- [ ] Font size tối thiểu ≥ 12px

### Elevation
- [ ] Tất cả box-shadow dùng elevation token
- [ ] Card: L0 (filled) hoặc L1 (elevated). Dialog: L3.
- [ ] Dark mode: tonal elevation (surface tint), không shadow

### Motion
- [ ] Tất cả transition duration dùng `var(--duration-*)`
- [ ] Tất cả cubic-bezier dùng `var(--ease-*)`
- [ ] Enter = decelerate, Exit = accelerate (không cùng easing)
- [ ] `@media (prefers-reduced-motion: reduce)` present

## Box Model (dead spacing)
- [ ] Không có 2 layer Box Model spacing liên tiếp > 0 (dead spacing)
- [ ] Container (Card, cardBody, panel) spacing = 0 nếu children tự quản
- [ ] M3 List pattern: Card = border+radius, Row = spacing owner, Divider = hairline
- [ ] Walk leaf → root: measure padding + margin + gap + border-width, flag 2 layer liên tiếp > 0

## Box Region Contract
- [ ] Container padding = 0
- [ ] Header padding = 12px 16px, border-bottom hairline
- [ ] Body padding = 0, gap = 0 (divider thay gap)
- [ ] Row padding = 12px 16px, divider = border-top hairline
- [ ] Grid padding = 0, gap = 12px (cells tự pad)
- [ ] Group label padding = 8px 16px 4px, margin-top = 8px

## Gestalt Proximity
- [ ] Space between groups > within groups (ratio > 1, target 1.5-2.5)
- [ ] Label-to-field ≤ 50% field-to-next-label
- [ ] Heading gần content introduce hơn content follow (≤ 50%)
- [ ] Blur test: grouping vẫn nhận diện khi blur

## Composition
- [ ] Không card-in-card (organism nest cùng loại)
- [ ] Molecule không thêm elevation/shape
- [ ] Organism không hardcode shape — dùng token
- [ ] Không dead spacing: container + child = max 1 layer giữa content

## SSOT
- [ ] Không native `<input type="checkbox">` — dùng `<Toggle>`
- [ ] Không native `<select>` — dùng `<Select>`
- [ ] Không emoji trong TSX — dùng `<Icon>`
- [ ] Không inline SVG — import từ ICON_CATALOG

## Responsive
- [ ] Base CSS = 320px (mobile-first)
- [ ] `@media (min-width: ...)` cho màn lớn, không `max-width`
- [ ] Component padding cố định across breakpoints
- [ ] Layout gap/margin scale per breakpoint
- [ ] Direction: column mobile → row tablet+
