# Foundation — Spacing (atom → page)

> Định lý: **spacing = quan hệ** (`why/philosophy.md`). Base unit 4px; scale names và giá trị: `tokens.json`.
> Một adaptive density duy nhất (comfortable mặc định); context compact giảm qua component token/wrapper — không tạo density-token mới.

## 6 concepts (taxonomy — Curtis/EightShapes)

| Concept | Hình thức | Ví dụ |
|---|---|---|
| **inset** | padding đều 4 phía | card, dialog panel, icon box |
| **inset-squish** | padding-x ≈ 2× padding-y | button, chip, input (dáng ngang) |
| **inset-stretch** | padding-x < padding-y hoặc full-bleed với inset | row trong list, cell |
| **stack** | gap dọc giữa các phần tử | title→desc→actions |
| **inline** | gap ngang | icon→label, item trong row, nút↔nút |
| **grid** | 2 chiều, gutter đều | card grid, stats |

Cơ chế: **gap trên parent flex/grid** — không sibling margin chains.

## Tier ladder — giá trị mang nghĩa

| Tier | Token điển hình | Quan hệ |
|---|---|---|
| atom-internal | `space-1` (4) · `space-0-5` (2) | icon↔label, badge↔text |
| tight micro | `space-2` (8) | gap nhỏ, padding chặt |
| same-group items | `space-3` (12) | items cùng list, nút↔nút, input padding |
| between-groups | `space-4` (16) | label→block, inset chuẩn card, section gap nhỏ |
| section boundary | `space-5`–`space-8` (20–32) | giữa các section lớn, dialog inset `space-6` |
| page frame | `space-4` compact · `space-5`–`space-8` lớn | margin trang theo breakpoint |

**Test:** outer ≥ 2× inner trong cùng ngữ cảnh; dãy số theo chiều ra ngoài phải tăng dần (ladder check — `method/spec-sheet.md`).

## Gap ladder theo vai trò — canon cho grouped lists/settings

Mỗi *cặp vai trò* = **1 con số duy nhất**. Cùng số cho các cặp khác vai trò = hierarchy dẹt (Atlassian: "the same step on every edge flattens hierarchy"). Canon ladder (decision: Anh, xác nhận bởi Atlassian/Carbon role-spacing):

| Cặp | Giá trị | Token | Ratio với bậc dưới |
|---|---|---|---|
| heading ↔ description/subheading | 4 | `space-1` | — |
| item ↔ item (cùng group) | 8 | `space-2` | 2× |
| group heading → items của nó | 12 | `space-3` | 1.5× |
| group ↔ group | 24 | `space-6` | 2× |
| card inset (riêng — padding không phải gap) | 16 | `space-4` | — |

Quy tắc suy ra:
- `8` cho mọi cặp = vỡ phân cấp — item-item(8) < heading→items(12) < group-group(24) phải **đọc được** trên build.
- Between-group whitespace = gap của parent section (`space-6` = 24) — KHÔNG sibling margin. Đo edge-to-edge để confirm = 24.
- Mọi cặp không thuộc bảng này phải ghi provenance `decision: <lý do>` trong spec.

## Height ladder (rhythm thứ hai)

| Element | Giá trị | Token |
|---|---|---|
| icon render | 18 | `ICON_SIZE_PX` |
| element sm / md / lg | 28 / 32 / 40 | `size-element-*` |
| touch target | ≥40 (desktop) / 44 (mobile) | `--touch-target-*` |
| list row | 40–48 | component token |
| CTA / primary control | 44–48 | — |

**Visual ≠ hit:** control 40px visual vẫn phải hit ≥40/44 — inflate bằng padding trong suốt, spec ghi cả hai.

## Screen-level — từ frame vào atom (thứ tự gán B4)

```
1. frame    → margin ngang + content-max-width theo breakpoint
2. sections → gap giữa section (20–32)
3. blocks   → gap trong section (16)
4. items    → gap list/inline (12)
5. inset    → padding card/row (12–16)
6. atoms    → icon-label (4–8)
7. chrome   → platform constant, ghi source "platform"
```

**S3:** page margin = 1 giá trị toàn màn, không per-section.
**Alignment:** các item align = "liên quan"; indent = "phụ thuộc" — căn lề cũng mang nghĩa quan hệ. Inner column inset cùng edge với rows dưới.

## iOS canon (tham khảo — Tihoka canon = bảng breakpoint repo)

| Level | iOS | Map Tihoka |
|---|---|---|
| Atom | 4pt fine + 8pt grid | `space-1`–`space-2` |
| Component inset | h:16 v:8–12 | `space-2..4` |
| List row / target | ≥44pt | `size-element-lg` + target ladder |
| Section gap | grouped-list 20–32 | `space-5`–`space-8` |
| **Layout margin** | **16pt compact / 20pt regular** | `space-4` / `space-5` |
| Chrome | nav ~44, tab ~49, toolbar 44 | component constants |
| Platform | status 44–59 (notch) · home 34 | `env(safe-area-inset-*)` — ngoại lệ hợp lệ |
| Readable width | ~672pt | `content-max-width` 640px |

Quy tắc Apple giữ lại: target ≥44pt · safe-area ≠ margin (hai thứ cộng dồn) · spacing đều mới thành grid · primary action nửa dưới màn (thumb zone) · functionality không đổi theo size-class — chỉ mật độ hiển thị đổi · Dynamic Type: layout giãn theo text, không crop.

⚠️ Margin 24 trong nhiều cheat sheet = practice phổ biến, **không phải canon Apple** (canon = 16/20). Tihoka `compact → space-4` khớp Apple compact.

## Checklist

**Mode A (design, B4):**
- [ ] Mỗi gap gán được 1 trong 6 concepts + 1 tier
- [ ] Gap trên parent, không margin chains
- [ ] Margin toàn màn 1 giá trị
- [ ] Số ngoài scale = platform constant có nhãn, hoặc flag
- [ ] Coupled pairs (trigger↔menu, label↔field) = 1 token cố định mọi nơi

**Mode B (audit, FIX):**
- [ ] 1 rhythm per container — không lone 11px/offset tùy ý
- [ ] Edge alignment: inner columns align với rows dưới
- [ ] Related gần hơn unrelated — section > item > inline
- [ ] Even vertical rhythm header→control→list→footer
- [ ] Không separator khi whitespace tách được (L-BORDER)
