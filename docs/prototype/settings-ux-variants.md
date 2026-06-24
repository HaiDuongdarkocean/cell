# Settings Popover — 6 UI/UX Variants

> Dựa trên screenshot settings hiện tại: 5 rows dạng label-trái / control-phải, hint text ở dưới.
> Mục tiêu: đưa ra 6 hướng redesign khác nhau về layout, visual, và interaction.

---

## Variant 1: Classic Two-Column (Refined)

### Layout
Giữ nguyên cấu trúc 2 cột nhưng tinh chỉnh visual:

```
┌─────────────────────────────────────┐
│ Settings                       ✕   │
├─────────────────────────────────────┤
│ Downloads at once        ┌────┐     │
│                          │  3 ▼│     │
│ Convert to MP4           ┌────┐     │
│                          │Always│    │
│ Parallel conversion      ┌────┐     │
│                          │ Auto│    │
│ Default quality          ┌────┐     │
│                          │Auto │    │
│ Subtitle language        ┌────┐     │
│                          │ All │    │
├─────────────────────────────────────┤
│ Parallel conversion: auto           │
│ (số lượng tùy vào GPU của máy tính) │
└─────────────────────────────────────┘
```

### Visual
- Controls có viền mỏng, radius nhỏ, background trùng popup
- Label font-weight 500, màu text chính
- Giá trị được căn phải, tạo cột thẳng
- Hint text có divider riêng, màu muted

### Pros
- Quen thuộc, dễ hiểu ngay
- Không học lại
- Scan nhanh theo cột

### Cons
- Hơi truyền thống, ít đột phá
- Label dài ("Subtitle language") có thể bị đẩy control xuống hàng

### Best for
- Người dùng lần đầu, conservative UX
- Prototype cần ship nhanh

---

## Variant 2: Card Grouped

### Layout
Mỗi setting là một card/chip riêng, tách biệt rõ ràng:

```
┌─────────────────────────────────────┐
│ Settings                       ✕   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ▶ Downloads at once       3 ▼   │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ □ Convert to MP4       Always ▼ │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⚡ Parallel conversion   Auto ▼  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ▶ Default quality    Auto ▼     │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ T  Subtitle language    All ▼   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Parallel conversion: auto           │
│ (số lượng tùy vào GPU của máy tính) │
└─────────────────────────────────────┘
```

### Visual
- Mỗi row là một card với border, background surface nhẹ
- Icon prefix để nhận diện chức năng
- Control nằm bên trong card
- Hover card: nâng nhẹ / border đậm hơn

### Pros
- Tactile, cảm giác như đang bấm nút vật lý
- Mỗi setting là một "đơn vị" riêng biệt
- Dễ thêm icon / badge / trạng thái

### Cons
- Tốn chiều cao hơn
- Nếu quá nhiều card sẽ bị "card fatigue"

### Best for
- Touch-friendly UI
- Settings ít (5-7 items)
- Muốn cảm giác hiện đại, tactile

---

## Variant 3: Compact Inline

### Layout
Tối đa hóa không gian, label và control cùng dòng, không card:

```
┌─────────────────────────────────────┐
│ Settings                       ✕   │
├─────────────────────────────────────┤
│ Downloads at once       3        ▼  │
│ Convert to MP4          Always   ▼  │
│ Parallel conversion     Auto     ▼  │
│ Default quality         Auto     ▼  │
│ Subtitle language       All      ▼  │
├─────────────────────────────────────┤
│ Parallel conversion: auto             │
│ (số lượng tùy vào GPU của máy tính) │
└─────────────────────────────────────┘
```

### Visual
- Không background, không border cho từng row
- Chỉ có divider mỏng giữa các row
- Giá trị + chevron cùng hàng với label
- Font size nhỏ hơn một chút

### Pros
- Gọn nhất, tốn ít chiều cao
- Trông như native iOS/macOS menu
- Focus vào nội dung

### Cons
- Không có visual boundary rõ
- Dễ click nhầm
- Không gian ít cho icon / hint

### Best for
- Minimalist design
- Power users
- Popup nhỏ (400px)

---

## Variant 4: Tabbed Sections

### Layout
Chia settings thành 2-3 nhóm, dùng tab hoặc segmented control:

```
┌─────────────────────────────────────┐
│ Settings                       ✕   │
├─────────────────────────────────────┤
│ [ General ] [ Download ] [ Convert ]│ ← tabs
├─────────────────────────────────────┤
│                                     │
│ Downloads at once      ┌────┐       │
│                        │ 3  ▼│       │
│ Default quality        ┌────┐       │
│                        │Auto│       │
│ Subtitle language      ┌────┐       │
│                        │ All│       │
│                                     │
│ Parallel conversion: auto           │
│ (số lượng tùy vào GPU của máy tính) │
└─────────────────────────────────────┘
```

### Visual
- Tab bar ở trên cùng
- Mỗi tab hiện 2-3 settings liên quan
- Tab active có underline hoặc nền
- Transition mượt khi chuyển tab

### Pros
- Scale tốt khi có nhiều settings hơn
- Người dùng tìm setting nhanh theo nhóm
- Ít overwhelming

### Cons
- Cần thêm click để đổi nhóm
- 5 items hiện tại có thể chưa cần tab
- Risk over-engineering

### Best for
- Dự kiến > 7 settings
- Settings có nhóm logic rõ ràng
- Muốn tổ chức chuyên nghiệp

---

## Variant 5: Full-Width Stacked

### Layout
Label nằm trên, control nằm dưới, full width:

```
┌─────────────────────────────────────┐
│ Settings                       ✕   │
├─────────────────────────────────────┤
│ Downloads at once                   │
│ ┌─────────────────────────────────┐ │
│ │ 3                           ▼   │ │
│ └─────────────────────────────────┘ │
│ Convert to MP4                      │
│ ┌─────────────────────────────────┐ │
│ │ Always                      ▼   │ │
│ └─────────────────────────────────┘ │
│ Parallel conversion                 │
│ ┌─────────────────────────────────┐ │
│ │ Auto                        ▼   │ │
│ └─────────────────────────────────┘ │
│ Default quality                     │
│ ┌─────────────────────────────────┐ │
│ │ Auto (best)                 ▼   │ │
│ └─────────────────────────────────┘ │
│ Subtitle language                   │
│ ┌─────────────────────────────────┐ │
│ │ All                         ▼   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Parallel conversion: auto           │
│ (số lượng tùy vào GPU của máy tính) │
└─────────────────────────────────────┘
```

### Visual
- Label font-weight 500, nhỏ gọn
- Control full width, dễ bấm
- Control có border, background
- Spacing giữa label và control nhỏ

### Pros
- Dễ đọc nhất cho label dài
- Touch target lớn
- Mobile-friendly
- Không bị wrap label

### Cons
- Tốn chiều cao gấp đôi
- Popup có thể phải scroll

### Best for
- Mobile-first design
- Label dài / đa ngôn ngữ
- Accessibility tốt hơn

---

## Variant 6: Searchable Command Palette

### Layout
Kết hợp search bar + danh sách settings có thể lọc:

```
┌─────────────────────────────────────┐
│ Settings                       ✕   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Search settings...           │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ⚙ Downloads at once            3 ▼  │
│ □ Convert to MP4           Always ▼ │
│ ⚡ Parallel conversion        Auto ▼  │
│ ▶ Default quality          Auto ▼   │
│ T Subtitle language           All ▼ │
├─────────────────────────────────────┤
│ Parallel conversion: auto           │
│ (số lượng tùy vào GPU của máy tính) │
└─────────────────────────────────────┘
```

### Visual
- Search bar sticky ở trên
- Mỗi setting có icon prefix
- Khi type → lọc danh sách
- Highlight matching text
- Có thể dùng arrow keys để navigate

### Pros
- Scale tuyệt vời khi có nhiều settings
- Power users tìm nhanh
- Hiện đại, "pro tool" feel
- Giảm cognitive load

### Cons
- Overkill cho 5 items
- Cần implement search/filter logic
- Có thể gây confusion cho user đơn giản

### Best for
- Dự kiến > 10 settings
- Power users
- Pro extension, advanced settings

---

## Summary Comparison

| Variant | Space | Familiarity | Modern Feel | Scalability | Touch-friendly | Best Item Count |
|---------|-------|-------------|-------------|-------------|----------------|-----------------|
| 1. Classic Two-Column | Medium | High | Medium | Low | Medium | 4-7 |
| 2. Card Grouped | High | Medium | High | Medium | High | 3-6 |
| 3. Compact Inline | Low | Medium | High | Low | Low | 3-5 |
| 4. Tabbed Sections | Medium | High | High | High | Medium | 7+ |
| 5. Full-Width Stacked | High | High | Medium | Medium | High | 4-7 |
| 6. Command Palette | Low | Low | Very High | Very High | Medium | 8+ |

---

## Recommendation

Với **5 settings hiện tại** trong popup 400×600px:

- **Ngắn gọn nhất**: Variant 3 (Compact Inline)
- **Dễ dùng nhất**: Variant 1 (Classic Two-Column) hoặc Variant 5 (Full-Width Stacked)
- **Hiện đại, tactile**: Variant 2 (Card Grouped)
- **Dự phòng scale sau này**: Variant 4 (Tabbed Sections)
- **Overkill ngay bây giờ**: Variant 6 (Command Palette)

Tôi đề xuất chọn **Variant 3** hoặc **Variant 5** cho prototype hiện tại.
