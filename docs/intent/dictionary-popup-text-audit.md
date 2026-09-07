# Dictionary Popup Settings — Text/UI Copy Audit

> Áp dụng skill `audit-text-in-ui` để quyết định tên card, nhãn, và i18n keys cho flow Dictionary Popup + Orbital + General mới.

---

## Scope

- `src/features/settings/ui/DictionaryPopupSettingsPanel.tsx`
- `src/features/settings/ui/SettingsDialogContent.tsx` (card title/description)
- New Word badge (orbital) settings card
- New General feature toggle + Popup appearance card

---

## Step 1 — Extract

| # | Chuỗi hiện tại | Vị trí | Bề mặt | Loại |
|---|---|---|---|---|
| 1 | "Dictionary Popup" | Card title | Heading | heading |
| 2 | "Hover or click words in subtitles to see definitions, audio, images, and Quick Add to Anki." | Card description | Text | description |
| 3 | "Enable Dictionary Popup" | Toggle label | Label | label |
| 4 | "Trigger mode" | Select label | Label | label |
| 5 | "Click" / "Hover" / "Hover + Ctrl" / "Hover + Shift" / "Hover + Alt" | Select options | Select option | select-option |
| 6 | "Pointer position" | Select label | Label | label |
| 7 | "Top" / "Bottom" / "Left" / "Right" / "Center" | Select options | Select option | select-option |
| 8 | "Badge size" | Slider label | Label | label |
| 9 | "Default active tab" | Select label | Label | label |
| 10 | "None (dictionary only)" / "Audio" / "Image" / "Translate" / "Links" / "Phonemes" | Select options | Select option | select-option |
| 11 | "Popup width (px)" | Input label | Label | label |
| 12 | "Popup max height (px)" | Input label | Label | label |
| 13 | "SRS destination" | Select label | Label | label |
| 14 | "Anki" / "Ocean SRS" | Select options | Select option | select-option |
| 15 | "Choose where Quick Add sends cards." | Hint | Text | hint |

---

## Step 2 & 3 — Classify + Check

| # | Chuỗi | Bề mặt | Verdict | Lý do (mã luật) |
|---|---|---|---|---|
| 1 | "Dictionary Popup" | heading | **PASS** | Tên feature, đã dùng trong app. |
| 2 | "Hover or click words in subtitles to see definitions, audio, images, and Quick Add to Anki." | description | **FAIL W2, W4** | Dài, 2 ý (cách mở + nội dung), từ quan trọng không đứng đầu. |
| 3 | "Enable Dictionary Popup" | label | **PASS** | Rõ, động từ + outcome. |
| 4 | "Trigger mode" | label | **FAIL W5, W9** | "Trigger" là jargon; không nói user sẽ làm gì. |
| 5 | "Click" / "Hover" ... | select-option | **PASS** | Ngắn, rõ. |
| 6 | "Pointer position" | label | **PASS** | Đã xác nhận đây là hướng pointer (mũi tên) trên orbital badge. |
| 7 | "Top" / "Bottom" ... | select-option | **FAIL W5** | Dùng cho hướng pointer; cần đổi thành "Pointer up / down / left / right / centered" để tránh nhầm với vị trí badge. |
| 8 | "Badge size" | label | **FAIL W5, W6** | "Badge" không phải từ quen thuộc; cùng khái niệm với "Orbital" trong tên card. |
| 9 | "Default active tab" | label | **FAIL W5, W9** | "Default active tab" là thuật ngữ UI; user không biết "tab active" là gì. |
| 10 | "None (dictionary only)" / "Audio" ... | select-option | **MIXED** | "None (dictionary only)" dài, có thể đơn giản hơn. Các tab khác OK. |
| 11 | "Popup width (px)" | label | **PASS** | Rõ, nhưng có thể gọn hơn. |
| 12 | "Popup max height (px)" | label | **PASS** | Rõ. |
| 13 | "SRS destination" | label | **FAIL W5, W9** | "SRS" và "destination" là jargon. |
| 14 | "Anki" / "Ocean SRS" | select-option | **PASS** | Tên sản phẩm, có context. |
| 15 | "Choose where Quick Add sends cards." | hint | **PASS** | Rõ, nhưng có thể gọn. |

---

## Step 4 — Rewrite đề xuất

### Card / section names

| Hiện tại | Đề xuất | Key mới | Lý do |
|---|---|---|---|
| "Dictionary Popup" (card title) | **Dictionary Popup** | `settings.dictionaryPopup.title` | Giữ tên feature đã quen, ngắn gọn. |
| Mô tả card | **Tap a word to look it up, hear it, and save it.** | `settings.dictionaryPopup.desc` | Frontload động từ, 1 ý, dễ đọc. |
| "Orbital button" (tên card mới) | **Word badge** | `settings.orbital.title` | Tránh "orbital" jargon; "badge" là hình dạng, "word" nói rõ nó ở đâu. |
| Mô tả Word badge | **The floating button with a pointer tip.** | `settings.orbital.desc` | Đơn giản, giải thích ngay. |
| "Popup appearance" (card mới) | **Popup size** | `settings.popupAppearance.title` | Rõ ràng, chỉ có size. |

### Labels

| Hiện tại | Đề xuất | Key mới | Lý do |
|---|---|---|---|
| "Enable Dictionary Popup" | **Show dictionary popup** | `settings.dictionaryPopup.enabled` | "Show" dễ hơn "Enable", nói rõ hành động. |
| "Trigger mode" | **Open with** | `settings.dictionaryPopup.openWith` | Động từ trước, nói rõ user chọn cách mở. |
| "Pointer position" | **Pointer position** | `settings.orbital.position` | Giữ nguyên — đã xác nhận đây là hướng pointer trên badge. |
| "Badge size" | **Button size** | `settings.orbital.size` | "Button" dễ hơn "badge" trong ngôn ngữ user-facing. |
| "Pointer scale" (mới) | **Pointer scale** | `settings.orbital.pointerScale` | Tỷ lệ pointer so với button. |
| "Default active tab" | **Show first** | `settings.dictionaryPopup.showFirst` | Động từ trước, nói rõ tab nào hiện đầu. |
| "None (dictionary only)" | **Dictionary** | `settings.dictionaryPopup.showFirst.none` | "Dictionary only" là thừa; trong dropdown "Show first", "Dictionary" đủ nghĩa. |
| "Audio" | **Sounds** | `settings.dictionaryPopup.showFirst.audio` | Trùng với `dict.tab.pronunciation` = "Sounds"; nhưng user gọi "Audio" cũng được. Cân nhắc dùng **Audio** cho consistency. |
| "Popup width (px)" | **Width** | `settings.popupAppearance.width` | Trong context Popup size, "Width" đủ. |
| "Popup max height (px)" | **Max height** | `settings.popupAppearance.maxHeight` | Tương tự. |
| "SRS destination" | **Save words to** | `settings.dictionaryPopup.saveWordsTo` | Động từ trước, nói rõ hành động. |
| "Choose where Quick Add sends cards." | **Quick Add sends new cards here.** | `settings.dictionaryPopup.saveHint` | Active, ngắn, rõ. |

### Select options

| Hiện tại | Đề xuất | Key mới |
|---|---|---|
| "Click" | **Click** | `settings.dictionaryPopup.openWith.click` |
| "Hover" | **Hover** | `settings.dictionaryPopup.openWith.hover` |
| "Hover + Ctrl" | **Hover + Ctrl** | `settings.dictionaryPopup.openWith.hoverCtrl` |
| "Hover + Shift" | **Hover + Shift** | `settings.dictionaryPopup.openWith.hoverShift` |
| "Hover + Alt" | **Hover + Alt** | `settings.dictionaryPopup.openWith.hoverAlt` |
| "Top" | **Pointer up** | `settings.orbital.position.top` |
| "Bottom" | **Pointer down** | `settings.orbital.position.bottom` |
| "Left" | **Pointer left** | `settings.orbital.position.left` |
| "Right" | **Pointer right** | `settings.orbital.position.right` |
| "Center" | **Pointer centered** | `settings.orbital.position.center` |
| "Audio" | **Audio** | `settings.dictionaryPopup.showFirst.audio` |
| "Image" | **Images** | `settings.dictionaryPopup.showFirst.image` |
| "Translate" | **Translation** | `settings.dictionaryPopup.showFirst.translate` |
| "Links" | **Links** | `settings.dictionaryPopup.showFirst.links` |
| "Phonemes" | **Sounds** | `settings.dictionaryPopup.showFirst.pronunciation` |
| "Anki" | **Anki** | `settings.dictionaryPopup.saveTo.anki` |
| "Ocean SRS" | **Ocean SRS** | `settings.dictionaryPopup.saveTo.oceanSrs` |

---

## Step 5 — Localize

Repo đã có `src/shared/i18n/messages/{en,vi}.json` và `t()`. Các key mới cần thêm vào cả 2 file. Dưới đây là đề xuất `vi`:

```json
{
  "settings.dictionaryPopup.title": "Từ điển nổi",
  "settings.dictionaryPopup.desc": "Chạm vào từ để tra nghĩa, nghe phát âm và lưu từ.",
  "settings.dictionaryPopup.enabled": "Hiện từ điển nổi",
  "settings.dictionaryPopup.openWith": "Mở bằng",
  "settings.dictionaryPopup.openWith.click": "Click",
  "settings.dictionaryPopup.openWith.hover": "Hover",
  "settings.dictionaryPopup.openWith.hoverCtrl": "Hover + Ctrl",
  "settings.dictionaryPopup.openWith.hoverShift": "Hover + Shift",
  "settings.dictionaryPopup.openWith.hoverAlt": "Hover + Alt",
  "settings.dictionaryPopup.showFirst": "Hiện trước",
  "settings.dictionaryPopup.showFirst.none": "Từ điển",
  "settings.dictionaryPopup.showFirst.audio": "Âm thanh",
  "settings.dictionaryPopup.showFirst.image": "Hình ảnh",
  "settings.dictionaryPopup.showFirst.translate": "Dịch",
  "settings.dictionaryPopup.showFirst.links": "Liên kết",
  "settings.dictionaryPopup.showFirst.pronunciation": "Phát âm",
  "settings.dictionaryPopup.saveWordsTo": "Lưu từ vào",
  "settings.dictionaryPopup.saveHint": "Quick Add sẽ gửi thẻ mới đến đây.",
  "settings.dictionaryPopup.saveTo.anki": "Anki",
  "settings.dictionaryPopup.saveTo.oceanSrs": "Ocean SRS",

  "settings.orbital.title": "Nút từ",
  "settings.orbital.desc": "Nút nổi có mũi tên chỉ hướng.",
  "settings.orbital.position": "Hướng mũi tên",
  "settings.orbital.position.top": "Chỉ lên",
  "settings.orbital.position.bottom": "Chỉ xuống",
  "settings.orbital.position.left": "Chỉ trái",
  "settings.orbital.position.right": "Chỉ phải",
  "settings.orbital.position.center": "Ở giữa",
  "settings.orbital.size": "Kích thước nút",
  "settings.orbital.pointerScale": "Tỷ lệ mũi tên",

  "settings.popupAppearance.title": "Kích thước popup",
  "settings.popupAppearance.width": "Chiều rộng",
  "settings.popupAppearance.maxHeight": "Chiều cao tối đa"
}
```

---

## Step 6 — Consistency / W6 pass

- "Từ điển nổi" = `Dictionary popup` — dùng xuyên suốt cho feature.
- "Nút từ" = `Word badge` — dùng cho orbital badge/button.
- "Mở bằng" = `Open with` — dùng cho trigger mode.
- "Hiện trước" = `Show first` — dùng cho default active tab.
- "Lưu từ vào" = `Save words to` — dùng cho SRS destination.
- "Hướng mũi tên" = `Pointer position` — dùng cho hướng pointer trên badge.
- Không dùng "Orbital" trong UI copy user-facing.

---

## Verdict

| Khía cạnh | Kết quả |
|---|---|
| Literal cần đưa vào i18n | 19 keys mới |
| Vi phạm blocking | 4 labels cần viết lại (Trigger mode, Badge size, Default active tab, SRS destination) |
| Tên card Orbital | **Word badge** thay vì "Orbital button" |
| Verdict | **REWRITE + NEEDS I18N KEYS** |
