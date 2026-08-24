# Box Contract

## Box regions

Mọi box (Card, Dialog, Panel) có tối đa 4 regions. Mỗi region tự quản spacing.

```
┌──────────────────────────────────────┐
│  HEADER   — title + description      │
│  ─── divider ───                     │
│  BODY     — rows / grid / list       │
│  ─── divider ─── (optional)          │
│  FOOTER   — actions (buttons)        │
└──────────────────────────────────────┘
```

## Region contracts

| Region | Padding | Divider | Gap |
|--------|---------|---------|-----|
| Container | **0** (border + radius only) | — | — |
| Header | 12px 16px | border-bottom hairline | title→desc: 4px |
| Body | **0** | — | 0 (divider thay gap) |
| Footer | 12px 16px | border-top hairline | 8px (between actions) |
| Row | 12px 16px | border-top hairline | label→control: 12px |
| Grid | **0** | — | 12px (cells tự pad) |
| Group label | 8px 16px 4px | — | margin-top: 8px (between groups) |

Container không có padding/margin/gap. Container chỉ quản shape + elevation + color + border. Regions tự quản spacing.

## Dead spacing detection

```
2 layer liên tiếp cả 2 đều có spacing > 0?
├── padding + padding → DEAD
├── padding + margin → DEAD
├── padding + gap (+ children cũng pad) → DEAD
└── margin + margin → DEAD (margin collapse)
```

Fix: set outer layer = 0, giữ inner layer (content owner).

## Gestalt Proximity

Spacing là syntax của visual grouping — không phải trang trí. Elements gần nhau = cùng group. Elements xa nhau = separate groups.

### 3 quy luật

**1. Space between groups > space within groups**

Ratio `between / within > 1`. Target 1.5-2.5.

```
GOOD (8 within / 24 between)     BAD (16 everywhere — flattened)
Name                             Name
[______________]                 [______________]
Email                            Email
[______________]                 [______________]
```

**2. Label-to-field ratio ≤ 50%**

`label→field / field→next-label ≤ 0.5`. Nếu ratio = 1, label equidistant — user không biết label thuộc field nào.

**3. Heading gần content nó introduce hơn content nó follow**

`heading→content / heading→previous ≤ 0.5`. Space-before heading > space-after heading (thường gấp đôi).

### Blur test

Blur screenshot đến khi text không đọc được. Nếu grouping vẫn nhận diện được → spacing đúng. Nếu ambiguous → fix ratio.

## Cell case study (320px)

| Fix | Before | After | Quy luật |
|-----|--------|-------|----------|
| groupLabel margin-top | 0px | 8px | between > within |
| between/within ratio | 0.0 | 1.46 | > 1 ✅ |
| heading→content ratio | ∞ | 0.11 | ≤ 0.5 ✅ |
