# Penpot `tihoka` — Atomic Design Audit

Audit toàn file theo Brad Frost: Foundations → Atoms → Molecules → Organisms → Templates → Pages.
Nguồn: Penpot file `tihoka` (228 components · 45 colors · 16 typographies) + `tokens.json`.

## 1. Cấu trúc file hiện tại

| Page | Nội dung thực tế | Trạng thái |
|---|---|---|
| `01 Foundations` | 12 boards: Colors ×7 (Ocean/Warmth/Forest L+D, Status&Base) · Spacing · Typography · Rules ×3 | ✅ flex-layout, token-bound |
| `02 Atoms` | Button reference image + ~50 board variant **rời** (không nằm trong variant container) + text rác | ⚠️ exploded, cần gom lại |
| `03 Molecules` | — | ❌ trống |
| `04 Organisms` | — | ❌ trống |
| `05 Templates` | — | ❌ trống |
| `06 Pages` | 13 `pages/*` (ảnh) · 6 `patterns/*` (ảnh) · 2 `templates/*` (ảnh) · `PM-Mobile-Reference` (vector phẳng) | ⚠️ chỉ là ảnh archive |
| `07 Icons` | 100 icon components 24×24, group action/media/nav/objects | ✅ |
| `08 Reference` | 70 board ảnh (1112×928) + **toàn bộ variant containers thật** + rác (`default`, `focus`, `ring`, `Board`, `surface`, MD3 `Button Elevated`) | ⚠️ mixed working/archive |

Vấn đề cốt lõi: **component mains nằm trên `08 Reference`, còn `03/04/05` trống** — cây page không phản ánh atomic level của library.

## 2. Inventory components (228)

```
atoms        48   actions 6 · content 21 · inputs 12 · layout 4 · navigation 5
molecules    30   actions 8 · data 8 · fields 9 · menus 1 · overlays 4
organisms     3   Card Creator · Header · Navigation
patterns      6   (docs-only pattern cards)
templates     2   Settings Dialog Layout · Sidebar
pages        13   (boards ảnh, không phải component edit được — chỉ là path marker)
primitives   10   Flex · Grid · Stack · Portal · Section · Container · Transition · VisuallyHidden · Collapsible · Icon
icons       100   action 26 · media 24 · nav 23 · objects 27
reference    16   boards archive còn sót
```

## 3. Audit từng screen → atoms/molecules dùng

| Screen | Elements quan sát | Map vào library |
|---|---|---|
| PM-Mobile-Reference (vector, 47 shapes) | video stage, cue-card ×3 (2 text + time + pin + layers), FAB ×4 (+icon), band pill (dot+label), transport ×4, exit, overflow | cue-card → **thiếu molecule `CueCard`**; FAB → IconButton ✓; band pill → Badge/Chip ✓; transport → IconButton ✓; icon shapes vẽ tay → chưa dùng icon components |
| Player Mode Overlay | video stage, cue list sidebar (card: text+trans+time), NavCluster trái (6 icon), SubtitleBlock giữa (2 pill), tools phải (6 icon), drag handle | → `CueCard` thiếu · `NavCluster` thiếu · SubtitleBlock ở `reference/` (sai level) · IconButton ✓ |
| Subtitle Overlay | NavCluster ×2 · SubtitleBlock pill ×2 | NavCluster thiếu · SubtitleBlock sai level |
| Video Player Test | NavCluster · native controls (play/time/progress/volume/fs/kebab) | NavCluster thiếu · Progress ✓ · IconButton ✓ |
| Side Panel | cue list (subtitle cards) · Slider + time | CueCard thiếu · Slider ✓ |
| Settings Dialog | nav sidebar 10 NavItem · Select · Toggle · HintIcon · Radio · profile rows · Badge · kebab · "+ New profile" | NavItem ✓ Select ✓ Toggle ✓ HintIcon ✓ Radio ✓ ListItem ✓ Badge ✓ → cần `ProfileRow` molecule? (có ListItem) |
| Universal Panel | nav column · tokenize pill · SearchField · word card · Card Creator header · IconButton ×n · Alert | NavItem ✓ SearchField ✓ Alert ✓ Chip(pill) ✓ |
| Vocabulary | Select filter+sort · Edit · SearchField · word rows + status Badge (Ignored/Known/Tracking) · Separator · Pagination | Select ✓ SearchField ✓ Badge ✓ ListItem ✓ Pagination ✓ → `WordRow` = ListItem+Badge compose |
| Study Modes | section heads · 9 mode cards (icon+title+desc) · kebab · "+ New mode" · Toggle | Card ✓ → **`ModeCard` molecule thiếu** |
| Clipboard | list items (icon+name+time+kebab) · "+ New" btn · search icon · title · icon btns · paragraph | ListItem ✓ IconButton ✓ Button ✓ |
| Card Creator Dialog | Dialog + overlay · drag handle · 2 Select · 10 field rows · media list · preview · queue sidebar · footer (Update toggle + Add/Update) | Dialog ✓ Select ✓ InputField ✓ organism Card Creator ✓ |
| Dictionary Popup | (idle shell) — desc: popup dialog, tabs, candidate list | Dialog ✓ Tabs ✓ ListItem ✓ |
| Pronunciation | Button · phoneme chip grid · IPA text · hint | Button ✓ → phoneme chip = Chip/Button-small ✓ |
| Async states | state buttons · Spinner · Skeleton · EmptyState · Alert · Card | tất cả ✓ |
| Form submit | Label · Input · Select · primary + destructive Button · Alert | Label ✓ Input ✓ Select ✓ Button ✓ Alert ✓ |
| Search result | SearchField · Button · Tabs · EmptyState | ✓ |
| Subtitle acquisition | InputField · Button "Detect" · Card empty | ✓ |
| Vocabulary capture | selectable words · EmptyState · (Dialog/Select/Badge/StatusDot/Alert) | ✓ |
| Tokenize Controls | Select · Toggle · SegmentedControl "Media/Text" · close | → `SegmentedControl` variant của Tabs chưa rõ |
| templates/Sidebar | icon nav · scroll-spy sections · checkbox + button | NavItem ✓ Checkbox ✓ |
| templates/Settings Dialog Layout | wireframe skeleton | Skeleton ✓ |

## 4. Gap list — elements chưa có component đúng level

| Element | Xuất hiện | Level đề xuất |
|---|---|---|
| `CueCard` (subtitle text + translation + time + pin) | PM-Mobile, Player Mode, Side Panel | **molecules/data** |
| `NavCluster` (floating icon-button cluster) | Player Mode, Subtitle Overlay, Video Player | **molecules/actions** |
| `ModeCard` (icon + title + desc, selectable) | Study Modes | **molecules/data** |
| `WordRow` (word + status badge + actions) | Vocabulary, Universal Panel | **molecules/data** (hoặc compose ListItem+Badge) |
| `ProfileRow` (radio + flag + name + native + kebab) | Settings Dialog | **molecules/data** |
| `PhonemeChip` (square symbol button) | Pronunciation | **atoms/inputs** (variant của Button sm) |
| `SegmentedControl` (pill "Media/Text") | Tokenize Controls, Universal Panel | **atoms/navigation** (variant Tabs) |
| `SubtitleBlock` | hiện ở `reference/` | move → `molecules/data` |
| `FabCluster` (4 FAB dọc) | PM-Mobile | **molecules/actions** |
| `StatusPill` / Badge statuses (Ignored·Tracking·Known) | Vocabulary | Badge ✓ — cần variant status |

## 5. Rác cần dọn

- `02 Atoms`: ~50 board Button variant rời + text loose + `svg` board → gom về VC hoặc xóa
- `08 Reference`: `default`, `focus`, `ring`, `Board`, `surface`, `Text`, `Button / Common / Elevated / Button Elevated` (MD3 sót)
- `06 Pages`: stray `Text` (281×58)
- Pages `03/04/05` trống — quyết định: move VCs về đúng page level, hoặc đổi tên `08 Reference` thành working page

## 6. Plan tiếp theo (đề xuất)

1. **Dọn rác** + gom Button exploded về variant container
2. **Tạo 10 components thiếu** theo gap list (CueCard, NavCluster, ModeCard, WordRow, ProfileRow, PhonemeChip, SegmentedControl, FabCluster + move SubtitleBlock)
3. **Tổ chức lại pages**: VCs về đúng `02/03/04/05`, `08 Reference` thuần archive
4. **Rebuild screens quan trọng bằng component instances** (Player Mode mobile trước — đang là flat vector)
5. Verify: mỗi screen dùng ≥1 instance thật, không flat draw
