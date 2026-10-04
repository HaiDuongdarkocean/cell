# Design Brief — dict-sheet-breadcrumb

> Spec: `docs/specs/dict-sheet-breadcrumb.md` · Mockup: `src/entrypoints/mockup-dict-sheet-breadcrumb/`
> Live: `npm run dev` → `http://localhost:5173/src/entrypoints/mockup-dict-sheet-breadcrumb/index.html`
> Mode: `all` — single justified variant.

## Design Read

Mobile sheet mất "địa vị" của stack — desktop thấy popup cha phía sau, sheet thì level mới phủ kín level cũ. Job của strip: trả lại dấu vết chuỗi lookup ở nơi mắt user nhìn đầu tiên, với chrome tối thiểu.

## Function Audit

| Function | REQ | Element(s) it needs |
|---|---|---|
| Duy trì stack đa-level ở sheet mode | REQ-1 | non-visual (lifecycle) |
| Hiển thị vị trí chuỗi | REQ-2 | strip cố định: nav + crumb list |
| Điều hướng ngược | REQ-3 | crumb = button thật |
| Scroll ngang | REQ-4 | overflow-x + pan-x + wheel map |
| Phân biệt modal level | NFR-4 | aria-modal/inert trên Sheet |
| Đóng level | REQ-5 | reuse handle/drag/Escape (đã có) |

## Journey Map

| TO-BE step | Coverage |
|---|---|
| lv1 mở, strip ẩn | strip render gate `trail.length >= 2` |
| nested lookup → lv2 + strip | `Sheet.header` slot giữa handle và content |
| drill lvN, scroll ngang | `overflow-x:auto` + `touch-action:pan-x` + wheel→scrollLeft |
| tap crumb i → về level i | `onTrailNavigate(i)` → `closeFromLevel(i+1)` |
| page lookup → reset | trail length 1 → strip ẩn |

## Dials

- DESIGN_VARIANCE: low — breadcrumb là pattern chuẩn, không cần di sản mới
- MOTION_INTENSITY: low — strip fade+drop-in khi mount (`static.motion.duration-normal` + `static.motion.ease-out`), sheet slide-up sẵn có
- VISUAL_DENSITY: — strip ~1 row, `static.touchTarget.mobile` (44px) cho crumb hit

## Inspiration Anchor

Mobile browser "tab stack" + iOS Settings back-label — người dùng đọc "đường đã đi" từ trái sang, chạm bất kỳ mắt xích nào để quay lại. Feeling: "dấu chân trên đường", không phải navigation drawer.

## Primary Job

Cho learner thấy và nhảy ngược chuỗi drill-down mà không đánh mất sheet hiện tại.

## Variant (all mode)

### Lookup trail strip — fixed header slot trong Sheet

- **IA mental model:** stack of pages — mỗi crumb là một "trang" đã mở, phải→trái = sâu→nông… (thứ tự trái→phải = lv1→lvN, current ở cuối)
- **Visual archetype:** breadcrumb text chips `term > term > current`, nền `derived.*.color-surface-card` tách khỏi `--color-surface-popover` của sheet bằng hairline `derived.*.color-border-subtle` ở bottom
- **Non-digital reference:** vụn bánh mì trên đường — chuỗi phẳng, không hierarchy UI
- **Material / surface:** strip `color-surface-card`, crumb `Button` ghost/`size-sm`, current = `derived.*.color-text-primary` semibold (kế thừa `.current` của `Breadcrumb`), separator `>` màu `core.*.textSecondary`
- **Typography treatment:** `static.font.sizes.sm` mặc định Breadcrumb; label dài truncate `text-overflow: ellipsis` + `max-width` cố định token
- **Motion signature:** strip `@starting-style` fade 0→1 + `translateY(-4px→0)` trong `static.motion.duration-normal`; ẩn = không render; tôn trọng `prefers-reduced-motion`
- **UX flow:** tap crumb → quay về; swipe ngang để đọc chuỗi dài; wheel dọc map sang scroll ngang; crumb mới auto `scrollIntoView` về cuối
- **UI structure:**

```
┌────────────────────────────────┐
│            ── handle           │  Sheet handle (drag/resize/close)
│ ┌────────────────────────────┐ │
│ │ above  ›  used  ›  world   │ │  header slot — fixed, không scroll
│ └────────────────────────────┘ │  bg=surface-card, border-bottom hairline
│ ┌────────────────────────────┐ │
│ │ world  AmE /wɜːrld/        │ │
│ │ [tracking]  freq ★★★       │ │  .content — scroll dọc như cũ
│ │ • [noun] the earth…        │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

- **3 dials:** DESIGN_VARIANCE: low · MOTION_INTENSITY: low · VISUAL_DENSITY: +1 fixed row (chỉ khi depth ≥2)
- **Why it fits:** user chỉ định đúng pattern này ("box ở trên cùng, breadcrumb, quay về lv nào close theo logic cũ"); tái dùng `Breadcrumb` + `Sheet` + `Button` — không pattern mới
- **Risk:** strip chiếm ~52px chiều dọc — chấp nhận được vì chỉ hiện khi có chain
- **Audit findings:** | strip trong `.content` bị drag-dismiss nuốt | solve — `header` slot trên Sheet, ngoài `.content` | | separator `>` vs `/` | solve — `separator` prop additive trên Breadcrumb (CSS var) | | N sheet aria-modal | solve — chỉ top modal, non-top `inert` |

## Responsive Table

| Width | Behavior |
|---|---|
| <600 (sheet) | strip hiện khi depth≥2; crumb ≥44px hit; scroll ngang |
| ≥600 (popup) | không strip — stack desktop đã thấy ancestor; behavior không đổi |

## Component Mapping summary

Xem `dict-sheet-breadcrumb-component-mapping.md`. Điểm chính: extend `Sheet` (`header` + `inert`), extend `Breadcrumb` (`separator`), create `LookupTrail` feature component, reuse `Button` cho crumb.
