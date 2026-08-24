---
name: m3-design-standard
description: Material Design 3 standard for building or redesigning UI. Use when designing new components/pages, redesigning existing UI, auditing design system compliance, filling token gaps, or when agent needs M3 rules to make design decisions. Contains verified M3 token specs, atomic design composition rules, responsive breakpoints, and hybrid audit (script + checklist).
---

# M3 Design Standard

## Khi nào dùng

- Thiết kế component hoặc trang mới.
- Redesign UI đang có.
- Audit design system compliance (tìm hardcoded values, token violations).
- Điền token còn thiếu.
- Cần M3 rules để quyết định design.

## Khi nào KHÔNG dùng

- Task pure logic/backend (không liên quan UI).
- Fix bug trong code không phải UI.
- Tối ưu performance (dùng skill `performance-optimization`).

## 6 nhóm token

| Nhóm | File reference | Trạng thái Cell |
|------|---------------|-----------------|
| Color | (có sẵn trong codebase) | Đủ |
| Typography | `references/typography.md` | Thiếu M3 15-style scale |
| Spacing | `references/spacing.md` | Đủ (4/8/12/16/24px) |
| Shape | `references/shape.md` | Thiếu 28px cho dialog |
| Elevation | `references/elevation.md` | Chưa có — cần thêm |
| Motion | `references/motion.md` | Thiếu emphasized easing |

**Trước khi thiết kế atom**: đọc file reference liên quan để lấy giá trị M3 chính xác.

## Atomic Design — thứ tự build

```
Token → Atom → Molecule → Organism → Template → Page
```

Mỗi layer chỉ dùng layer phía dưới, không skip. Page hardcode token = system hỏng.

## Composition rules

| Layer | Quy tắc |
|-------|---------|
| Atom | Chỉ dùng token, không hardcode. Không compose atom khác. |
| Molecule | Compose 2+ atom. Không thêm elevation/shape. Spacing giữa atom = `--space-*`. |
| Organism | Compose molecule + atom. Có thể thêm layout spacing. Không nest organism cùng loại (no card-in-card). |
| Template | Layout grid + responsive breakpoint. Component padding cố định, chỉ layout spacing đổi. |
| Page | Áp content vào template. Không thêm token mới. |

## Responsive breakpoints

| Class | M3 (dp) | Cell (px) |
|-------|---------|-----------|
| Compact | <600 | 320-599 |
| Medium | 600-839 | 768-1023 |
| Expanded | 840-1199 | 1024-1279 |
| Large | 1200-1599 | 1280-1919 |
| Extra-large | ≥1600 | 1920+ |

Cell dùng breakpoint riêng (480/768/1024/1280/1920) vì extension viewport nhỏ hơn mobile fullscreen. Giữ Cell breakpoints.

**Quy tắc chính**: Component padding cố định across breakpoints. Chỉ layout-level (margin, gutter, pane spacer) đổi.

## Workflow thiết kế

1. **Identify layer**: đang build atom/molecule/organism/template/page?
2. **Đọc token specs**: đọc file reference cho token categories cần thiết.
3. **Check tokens hiện có**: đọc `tokens.json` — map M3 specs sang token Cell. Tìm gap.
4. **Thiết kế với token**: chỉ dùng CSS custom property, không hardcode px. Thiếu token → thêm vào `tokens.json` trước, rồi `npm run build`.
5. **Audit**: chạy `audit/audit.sh` + checklist trong `audit/audit-checklist.md`.

## Audit

```bash
bash .agents/skills/m3-design-standard/audit/audit.sh
```

Script scan codebase tìm: hardcoded border-radius/padding/font-size/box-shadow/transition, emoji trong TSX, native HTML inputs.

Chi tiết checklist: `audit/audit-checklist.md`.

## Box Contract

Mọi box (Card, Dialog, Panel) có tối đa 4 regions: Header, Body, Footer. Mỗi region tự quản spacing, container không có padding. Chi tiết: `references/box-contract.md`.

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke `/using-agent-skills` để re-route.
