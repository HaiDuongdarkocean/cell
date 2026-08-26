# Atomic Design — Tổng hợp cho Cell

> Tài liệu gốc: Brad Frost, *Atomic Design* (2013).  
> Mục đích: giúp team Cell tra cứu nhanh cấp độ của component/tokens trong design-system showcase.

---

## 1. Atomic design là gì?

**Atomic design** là một phương pháp luận (methodology) để xây dựng design system bằng cách chia giao diện thành các cấp độ thành phần từ nhỏ đến lớn, mượn hình ảnh từ hóa học: nguyên tử, phân tử, sinh vật, khuôn mẫu, trang.

Brad Frost nhấn mạnh nó là **mental model**, không phải quy trình tuyến tính. Các cấp độ tồn tại đồng thời: bạn vừa thiết kế toàn cục, vừa thiết kế chi tiết.

---

## 2. Năm cấp độ gốc

| Cấp độ | Định nghĩa | Đặc điểm | Ví dụ trong Cell |
|---|---|---|---|
| **Atoms** | Đơn vị UI chức năng nhỏ nhất, không thể chia nhỏ hơn mà vẫn còn chức năng | Thường là HTML tag hoặc React component đơn giản, độc lập | `Button`, `Input`, `Heading`, `Text`, `Icon`, `Grid`, `Flex`, `Box`, `Separator`, `Transition` |
| **Molecules** | Nhóm 2+ atoms hợp tác làm 1 việc cụ thể | Có ý nghĩa rõ ràng hơn atom riêng lẻ | `SearchField` (Icon + Input + Button), `Tabs`, `Dialog`, `Select`, `Pagination` |
| **Organisms** | Tổ hợp molecules/atoms tạo thành một phần giao diện phức tạp, có tính độc lập | Thường là một section hoàn chỉnh | `Sidebar`, `Header`, `DictionaryPanelView`, `ThemePanel`, `TTS Voice Manager Panel` |
| **Templates** | Bố cục trang (wireframe) ghép organisms lại, chưa có nội dung thật | Thể hiện cấu trúc, responsive, luồng | `Settings Dialog Layout` |
| **Pages** | Instance cụ thể của template với nội dung thật | Kiểm tra hiệu quả design system | `Popup Page`, `Side Panel Page`, `Video Player Test Page`, `Settings Page` |

> Nguồn: https://bradfrost.com/blog/post/atomic-web-design/  
> Nguồn chi tiết: https://atomicdesign.bradfrost.com/chapter-2/

---

## 3. Atom — định nghĩa chuyên sâu

### 3.1. Nguyên tắc "smallest functional unit"

Brad Frost:

> "Atoms are the basic building blocks of matter. Applied to web interfaces, **atoms are our HTML tags, such as a form label, an input or a button**."
>
> "These atoms include basic HTML elements like **form labels, inputs, buttons**, and others that **can't be broken down any further without ceasing to be functional**."

Nguồn: https://bradfrost.com/blog/post/atomic-web-design/  
Nguồn: https://atomicdesign.bradfrost.com/chapter-2/

**Điểm then chốt:**
- Một `<button>` là atom. Nếu chia nhỏ hơn (chữ, background, padding) thì không còn là button.
- Một `Heading` component là atom. Nếu chia nhỏ hơn (font-size, font-weight) thì không còn là heading.

### 3.2. Atom có thể "trừu tượng" không?

Brad Frost cho phép mở rộng:

> "Atoms can also include more abstract elements like **color palettes, fonts** and even more invisible aspects of an interface like **animations**."

Nguồn: https://bradfrost.com/blog/post/atomic-web-design/

Tuy nhiên, trong bài *Extending Atomic Design* (2019), ông đã làm rõ hơn:

> "In the world of UI, **design tokens are subatomic particles**. The design token `color-brand-blue` is a critical ingredient of a UI, but it's not exactly functional on its own. It needs to be applied to an 'atom' (such as the background color of a button) in order to come to life."

Nguồn: https://bradfrost.com/blog/post/extending-atomic-design/

**Kết luận:**
- Token (màu, font, spacing, radius, duration, icon) là **subatomic**.
- Component hiển thị/hành động (button, input, heading, icon, grid) là **atom**.
- Bản thân "color palette" hay "type scale" là token reference, **không phải atom**.

---

## 4. Subatomic — design tokens / foundations

### 4.1. Design tokens là gì?

> "Design tokens are an agnostic way to store variables such as **typography, color, and spacing** so that your design system can be shared across platforms like iOS, Android, and regular ol’ websites."

Nguồn: https://bradfrost.com/blog/post/extending-atomic-design/

> "A design token is an abstraction of a visual property such as **color, size, or animation**. Instead of using hard-coded values, such as hex values for colors, tokens are key-value pairs that represent reusable design decisions in the form of a variable."

Nguồn: https://cloudscape.design/foundation/visual-foundation/design-tokens/

### 4.2. Các dimensions trong Cell

| Dimension | Vai trò | Ví dụ token |
|---|---|---|
| **Color** | Quyết định màu sắc giao diện | `--color-background`, `--color-text`, `--color-primary` |
| **Typography** | Font, size, weight, line-height, tracking | `--font-family`, `--font-size-lg`, `--font-weight-semibold` |
| **Spacing** | Khoảng cách 4px base unit | `--space-1`, `--space-4` |
| **Shape** | Border radius theo vai trò component | `--radius-pill`, `--radius-card`, `--radius-md` |
| **Elevation** | Độ nổi qua surface lift | `--color-surface-elevated` |
| **Motion** | Duration, easing cho transition | `--duration-fast`, `--ease-default` |
| **Iconography** | Kích thước, stroke, canvas icon | 24×24, 1.5px stroke, round caps |
| **Grid & Breakpoints** | Hệ thống lưới và điểm dừng responsive | 320 / 480 / 768 / 1024 / 1280px |

**Tất cả các giá trị trên là subatomic**, chúng phải được áp dụng lên atoms mới có ý nghĩa.

---

## 5. Phân biệt nhanh: gì là atom, gì là token?

| Câu hỏi | Nếu trả lời "có" → là token | Nếu trả lời "có" → là atom |
|---|---|---|
| Nó có phải là **giá trị** (hex, px, ms, ratio)? | ✅ Token | ❌ Không |
| Nó có thể đứng một mình và **hành động** (nhận click, render nội dung, sắp xếp layout)? | ❌ Không | ✅ Atom |
| Nếu chia nhỏ hơn, nó có mất chức năng không? | Không áp dụng | ✅ Mất chức năng → Atom |

### 5.1. Ví dụ kiểm tra

| Thành phần | Phân loại | Lý do |
|---|---|---|
| `#5E6AD2` | Token (color) | Là giá trị, không làm gì nếu không gán cho một atom |
| `Button` | Atom | Có chức năng click, nhãn, state; chia nhỏ hơn không còn là button |
| `Heading` | Atom | Render text với semantic tag; chia font-size ra thì không còn heading |
| `Grid` | Atom | Layout primitive, sắp xếp children theo cấu trúc |
| `Flex` | Atom | Layout primitive, direction/justify/align |
| `Box` | Atom | Container với background, border, radius, elevation |
| `Transition` | Atom | Wrapper component quản lý enter/exit motion |
| `Icon` | Atom | Render SVG icon từ catalog |
| `Separator` | Atom | Element trực quan phân cách content |
| `Text` | Atom | Component hiển thị text với variants |
| `Container` | Atom | Giới hạn max-width và căn giữa content |
| `Section` | Atom | Wrapper semantic với padding/gap |
| `AspectRatio` | Atom | Giữ tỷ lệ khung hình cho media |
| `Color Scale` (showcase) | Token reference / Foundation | Hiển thị tất cả giá trị màu, không phải component UI |
| `Spacing Scale` (showcase) | Token reference / Foundation | Hiển thị tất cả giá trị spacing |
| `Foundation` (story page) | Token reference / Foundation | Kể chuyện + swatches về 7 dimensions |

---

## 6. Mối quan hệ trong showcase

```
Subatomic / Foundations
├── color, typography, spacing, shape, motion, iconography, grid
│   (design tokens — values, not components)
│
Atoms
├── Action: Button, Input, Toggle, Checkbox, Radio, IconButton
├── Content: Heading, Text, Icon, Separator, Avatar, Blockquote, Code
├── Layout: Box, Flex, Grid, Container, Section, AspectRatio
├── Feedback: Badge, Progress, Spinner, Alert
├── Input: Input, Label, Textarea, Select
├── Navigation: NavItem, Breadcrumb, Tabs
├── Overlay: Overlay, Tooltip, Dialog
└── Utility: Transition, Portal, Collapsible, Kbd

Molecules
├── SearchField, Tabs, Dialog, Select, Pagination, ButtonGroup, CardHeader

Organisms
├── Sidebar, Header, Footer, DictionaryPanelView, ThemePanel

Templates
├── Settings Dialog Layout

Pages
├── Popup Page, Side Panel Page, Video Player Test Page
```

---

## 7. Lỗi thường gặp

### Lỗi 1: Gọi token là atom

- Sai: "`--color-primary` là một atom."
- Đúng: "`--color-primary` là design token (subatomic). Nó được áp dụng lên `Button` (atom)."

### Lỗi 2: Đưa component UI vào foundations

- Sai: "`Heading` là foundation vì nó thể hiện typography."
- Đúng: "`Heading` là atom vì nó là component hiển thị text với semantic tag; typography tokens (font, size, weight) mới là foundation."

### Lỗi 3: Dùng "foundations" như một cấp trong atomic design

- Sai: "Foundations là cấp độ thứ nhất của atomic design."
- Đúng: "Atomic design gốc chỉ có 5 cấp: Atoms, Molecules, Organisms, Templates, Pages. 'Foundations' là layer token bên ngoài, thường dùng để lưu design tokens."

---

## 8. Tư duy quyết định khi phân loại showcase

Khi xem xét một file `.showcase.tsx`, hãy trả lời 3 câu:

1. **Nó có render ra một element/component có chức năng không?**
   - Có → `atoms` (hoặc molecule/organism tùy độ phức tạp)
   - Không, nó chỉ hiển thị giá trị/quy tắc → `foundations`

2. **Nó có kết hợp nhiều atoms không?**
   - Có 2–3 atoms làm một việc → `molecules`
   - Có nhiều molecules/atoms tạo thành section → `organisms`

3. **Nó có phải instance hoàn chỉnh của một màn hình với nội dung thật không?**
   - Có → `pages`
   - Chỉ là wireframe bố cục không có content thật → `templates`

---

## 9. Nguồn tham khảo còn sống

1. Brad Frost, *Atomic Design* (2013): https://bradfrost.com/blog/post/atomic-web-design/
2. Brad Frost, *Atomic Design Methodology*: https://atomicdesign.bradfrost.com/chapter-2/
3. Brad Frost, *Extending Atomic Design* (2019): https://bradfrost.com/blog/post/extending-atomic-design/
4. Brad Frost, *Design Tokens + Atomic Design = ❤️*: https://bradfrost.com/blog/post/design-tokens-atomic-design-%e2%9d%a4%ef%b8%8f/
5. Cloudscape, *Design tokens*: https://cloudscape.design/foundation/visual-foundation/design-tokens/
6. Atlassian Design, *Design tokens*: https://atlassian.design/foundations/tokens/design-tokens
7. VA.gov / USWDS, *Design tokens*: https://design.va.gov/foundation/design-tokens
8. SAP Digital Design System, *Design tokens*: https://www.sap.com/design-system/digital/foundations/tokens/design-tokens/
9. Material Design 3, *Foundations*: https://m3.material.io/foundations
10. Crucible, *Design tokens and the system layer*: https://readcrucible.com/articles/design-tokens-and-the-system-layer-lessons-from-public-design-systems
