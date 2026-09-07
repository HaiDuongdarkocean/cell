# Audio — Design Brief

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

> Gộp 3 section **Pronunciation**, **Local Pronunciation**, **TTS Voices** trong Settings thành một section duy nhất **Audio**.
> Nguồn: `SettingsDialogContent.tsx` (cards 7.4, 7.5, 10) + 3 production panels.
>
> **Update:** Three additional v2 concepts (Stepper, Accordion, Split Inspector) are in `docs/intent/audio-mockup-v2-design-brief.md`.

---

## 0. Design Story (từ `project-context.md`)

> *"Cell được sinh ra cũng từ nước, lớn lên và phát triển… tôi muốn Liquid Glass sẽ là design system style, màu chủ đạo là màu xanh dương của bầu trời…"*

- **Cảm giác:** yên bình, trong suốt, có trật tự, phản hồi nhẹ nhàng khi chạm.
- **Form:** pill, squircle, không góc vuông; touch target ≥ 44 px; mobile-first (320 px → 1280 px).
- **Palette:** xanh dương bầu trời, xanh lá, xám sỏi, nâu đất, vàng mặt trời — qua token `--color-primary`, `--color-tint-*`, `--color-glass-*`.
- **Material:** Liquid Glass dùng cho nav/control, không glass-on-glass quá 3 lớp, content-first.

---

## 1. Phân tích 3 section hiện tại

### 1.1 Vị trí trong Settings

| Card | Section | `data-section` | Sidebar label | Dòng trong `SettingsDialogContent.tsx` |
|---|---|---|---|---|
| 7.4 | **Pronunciation** | `pronunciation` | "Pronunciation" | 548–564 |
| 7.5 | **Local Pronunciation** | `localPronunciation` | "Local Pronunciation" | 566–582 |
| 10 | **TTS Voices** | `tts` | "TTS Voices" | 643–659 |

Sidebar items tương ứng: dòng 164–168 (`pronunciation`, `localPronunciation`, `tts`), cùng icon `audioWave` / `volumeHigh`.

### 1.2 Nội dung từng panel

#### `PronunciationSettingsPanel.tsx` (dòng 1–86)

| Element | Tính năng | Đánh giá IA/UX |
|---|---|---|
| "Audio source priority" | Sắp xếp 5 engine theo thứ tự ưu tiên (`fallbackEngines`). | Mục đích cốt lõi, nhưng dùng nút Up/Down dễ hiểu nhưng kém mượt trên mobile. |
| Engine list | 5 dòng: `localFile`, `native`, `supertonic`, `browserTts`, `espeak`. | Chưa có test/play trực tiếp, user không biết nguồn nào hoạt động. |
| "Download eSpeak TTS data" toggle | Bật tải dữ liệu eSpeak khi cần. | Nằm trong Pronunciation nhưng liên quan TTS — gợi ý gộp. |

#### `LocalPronunciationSettingsPanel.tsx` (dòng 1–171)

| Element | Tính năng | Đánh giá IA/UX |
|---|---|---|
| Package type select | `single` / `split`. | Rõ ràng. |
| Choose `.dsl` / `.zip` / split directory | File picker + lưu file handle. | Các nút lặp lại pattern chọn file; cần trạng thái rõ hơn. |
| Archive name pattern input | `ForvoEnglish_{firstLetter}.zip`. | Chỉ hiện khi split. |
| Build index button | Parse Lingvo DSL và lưu index. | Thiếu feedback trực quan ngoài dòng status text. |
| Status / Last indexed | Thông báo kết quả. | Phù hợp. |

#### `TtsVoiceManagerPanel.tsx` (dòng 1–497)

| Element | Tính năng | Đánh giá IA/UX |
|---|---|---|
| Card "Text-to-Speech (TTS)" | Master toggle, maxDisplay, 3-slot voice selection, autoplay, Save settings. | Thông tin quan trọng nhưng tự động thành card lồng card khi đặt trong `Card` của Settings. |
| Card "TTS Tester" | Sentence, country filter, voice list drag-drop, checkbox, play, save list. | Mạnh, nhưng không liên kết với priority chain hoặc local package. |
| `TtsLanguagePanel` (local Supertonic v3) | Local TTS toggle, download voice packs, hide/delete. | Nằm trong TTS Voices nhưng thực chất là một kênh âm thanh khác — phù hợp với mô hình gộp. |

### 1.3 Vấn đề cần giải quyết khi gộp

1. **Cùng một miền:** cả 3 section đều là "nguồn phát âm" — network, local file, TTS voices. Người dùng không cần 3 mục sidebar riêng biệt.
2. **Priority chain thiếu test:** user có thể sắp xếp engine nhưng không nghe thử.
3. **Double-card:** `TtsVoiceManagerPanel` tự render `Card` bên trong `SettingsDialogContent.Card`.
4. **eSpeak toggle ở nhầm chỗ:** `downloadEspeakTtsData` nằm trong Pronunciation nhưng là TTS.
5. **TTS tester cô lập:** không kiểm tra toàn bộ fallback chain, chỉ test từng voice.

---

## 2. Anchor the idea

- **Mood keyword:** *dàn âm thanh trên mặt hồ* — mỗi nguồn là một kênh, cùng phát sóng, dễ điều chỉnh, dễ thử.
- **Cảm giác:** yên bình nhưng có nhịp điệu; user điều khiển nguồn phát âm như điều chỉnh mixer nhạc nhẹ.
- **Primary job:** *Cấu hình TẤT CẢ nguồn phát âm một cách liền mạch, từ network, local file, đến TTS voices, với khả năng ưu tiên nguồn và thử nghiệm trước khi lưu.*
- **Cheapest version that still delivers the feeling:** một section "Audio" duy nhất với header chung, 3 nhóm cài đặt trong một card, thêm một ô thử từ + nút Play ở đầu.

---

## 3. Job & Dials

### 3.1 Default dials

| Dial | Default | Lý do |
|---|---|---|
| `DESIGN_VARIANCE` | 5 | Gộp 3 section là thay đổi cấu trúc đáng kể, nhưng vẫn giữ pattern card/settings row quen thuộc. |
| `MOTION_INTENSITY` | 4 | Tab/reorder/collapse cần motion nhẹ; không làm mất cảm giác yên bình. |
| `VISUAL_DENSITY` | 6 | Nhiều control trong một section — cần compact nhưng vẫn đủ không khí để thở. |

### 3.2 Responsive behavior (default)

- **320 px:** một cột dọc, tất cả control xếp chồng, touch target ≥ 44 px, tester nằm ngay dưới header.
- **1280 px:** một khung rộng tối đa ~720–800 px, các dòng label-control có thể 2 cột, list voice có thể hiển thị 2 cột, priority chain nằm ngang.

### 3.3 Must-haves

1. Một section "Audio" duy nhất trong Settings.
2. Một sidebar/nav item duy nhất `audio` thay cho `pronunciation` + `localPronunciation` + `tts`.
3. Priority chain chứa đủ 5 engine (`localFile`, `native`, `supertonic`, `browserTts`, `espeak`).
4. Local package configuration (`packageType`, file handles, index build).
5. TTS master toggle, voice slots, autoplay, voice tester, local TTS language packs.
6. Inline audio tester — gõ từ/câu, phát qua chain hoặc voice đang chọn, trước khi Save.

### 3.4 Out-of-scope

- Không thay đổi schema `PronunciationSettings` / `TtsSettings` ngoài việc nối dữ liệu vào cùng một panel.
- Không thêm audio editor, waveform, equalizer.
- Không phát triển mockup site trong subagent này.

---

## 4. Three Concepts

### Concept A — Single Audio Card *(conservative)*

- **IA mental model:** Một hộp cài đặt duy nhất, chia thành 3 ngăn theo thứ tự từ trên xuống: *Priority Chain → Local Package → TTS Voices*. Giống cấu trúc hiện tại nhưng được gộp header và thêm tester.
- **UX flow:**
  1. Mở Settings → chọn **Audio** trong sidebar.
  2. Thấy card dài với header chung "Audio" + mô tả.
  3. Thử một từ/câu ở **Audio tester** ngay dưới header → nghe kết quả.
  4. Kéo xuống sắp xếp **Priority chain** bằng Up/Down.
  5. Mở **Local Package**, chọn file, build index.
  6. Mở **TTS Voices**, bật TTS, chọn slot, cấu hình autoplay, save.
- **UI structure:**
  - Một `Card` `.sectionCard` duy nhất, header `<Heading level={4}>Audio</Heading>` + `<Text color="secondary">` mô tả.
  - `groupLabel` chia 3 nhóm: "Source priority", "Local package", "TTS voices".
  - Một `SettingsRow` tester ở đầu: `Input` gõ từ + `Button` Play (icon `play`) + `Select` chọn test mode ("Follow priority chain" / "Selected TTS voice").
  - Engine priority list dạng `ol` với nút Up/Down `Button variant="ghost" size="sm"`.
  - Local package giữ nguyên các row label-control.
  - TTS Voices flatten thành các `SettingsRow` / list bên trong card chung, không render `Card` lồng.
- **3 dials:** `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 7`.
- **States:** default, hover (engine row, button), focus-visible, pressed (button scale 0.985), disabled (nút Up/Down đầu/cuối, TTS disabled), loading (đang tải voice list, đang build index), empty (chưa chọn file, chưa có voice), error (file picker denied, TTS load fail), success (saved), reordering (engine list), playing (tester).
- **Why it fits:** thay đổi tối thiểu, user không phải học lại, dễ ship nhanh; vẫn giải quyết double-card và thêm test trước save.
- **Risk:** card quá dài, user phải cuộn nhiều; TTS voice list dài làm section nặng.

### Concept B — Audio Tabs *(hybrid)*

- **IA mental model:** Một "máy nghe nhạc" có 3 băng: **Source Priority**, **Local Package**, **TTS Voices**. User chuyển băng bằng tab rail, nhưng audio tester luôn nổi ở trên cùng.
- **UX flow:**
  1. Vào **Audio**.
  2. Thấy header + audio tester cố định.
  3. Chọn tab **Source Priority** → reorder engine → thử từ.
  4. Chuyển tab **Local Package** → chọn file, build.
  5. Chuyển tab **TTS Voices** → bật TTS, chọn voice, save.
- **UI structure:**
  - `Card` chung, header "Audio".
  - `Tabs` với 3 trigger: `Source Priority` (icon `audioWave`), `Local Package` (icon `folderOpen`), `TTS Voices` (icon `volumeHigh`).
  - Audio tester dính (sticky) ngay dưới header, trên tab list, để luôn thử được ở mọi tab.
  - `Tabs.Content` render từng subpanel.
  - Mobile: tab list chuyển thành **bottom rail** (dùng `Navigation` hoặc `Tabs` với `flex` cuộn ngang) để dễ chạm.
- **3 dials:** `DESIGN_VARIANCE: 6`, `MOTION_INTENSITY: 5`, `VISUAL_DENSITY: 6`.
- **States:** default, hover (tab trigger), active/selected tab, focus, pressed, disabled, loading, empty, error, success, playing, tab-switching (content fade/slide).
- **Why it fits:** giảm chiều dài trang, tập trung vào từng nhiệm vụ, tester luôn sẵn; phù hợp Liquid Glass với tab rail nổi.
- **Risk:** user có thể quên kiểm tra tab khác; chuyển tab mất context; sticky tester trên mobile chiếm không gian.

### Concept C — Audio Command Deck *(experimental)*

- **IA mental model:** **Mixer kênh âm thanh** — trên cùng là priority chain kết hợp tester, dưới là 2 kênh song song: **Local Package** (trái) và **TTS Voices** (phải). Cả 3 kênh cùng chảy vào một đầu ra duy nhất.
- **UX flow:**
  1. Vào **Audio**.
  2. Thấy **priority chain** dạng horizontal rail; kéo thả hoặc dùng Up/Down để sắp xếp.
  3. Gõ từ/câu vào **inline tester** → Play → hệ thống đi qua chain theo thứ tự.
  4. Mở rộng kênh **Local Package** để chọn file, build index.
  5. Mở rộng kênh **TTS Voices** để chọn voice, autoplay.
  6. Save toàn bộ cấu hình ở footer.
- **UI structure:**
  - `Card` chung, header "Audio".
  - Top: priority chain dạng rail ngang, mỗi engine là một "module" pill có icon và Up/Down; bên phải là tester input + Play.
  - Dưới: 2 kênh dạng card con (`Card variant="glass"` hoặc `interactive`) xếp cạnh nhau trên desktop.
  - Mỗi kênh có header riêng, toggle expand/collapse, và nội dung bên trong.
  - Mobile: 2 kênh xếp chồng; priority chain + tester xếp dọc.
- **3 dials:** `DESIGN_VARIANCE: 9`, `MOTION_INTENSITY: 7`, `VISUAL_DENSITY: 5`.
- **States:** default, hover (kênh, module, button), focus, pressed, active/selected (kênh mở), disabled, loading (build index / voice list), empty (kênh chưa có dữ liệu), error, success, playing (tester pulse), reordering, collapsed/expanded.
- **Why it fits:** nhấn mạnh mục tiêu chính "tất cả nguồn âm thanh cùng phát sóng"; phù hợp với persona trẻ thích điều khiển trực quan; giảm sự cô lập của TTS tester.
- **Risk:** card lồng card / glass-on-glass dễ vượt 3 lớp; responsive phức tạp; kênh song song trên mobile dễ dài.

---

## 5. Responsive Behavior

| Viewport | Concept A | Concept B | Concept C |
|---|---|---|---|
| **320** | 1 cột dọc, tester full-width, priority list 1 cột, local package row xếp dọc, TTS voice list 1 cột, cuộn dài. | Tab rail xếp chồng 3 hàng hoặc cuộn ngang; tester sticky trên cùng; tab content full-width. | Priority chain + tester xếp dọc; 2 kênh xếp chồng full-width; mỗi kênh expand/collapse. |
| **768** | 1 cột rộng hơn, tester và Play có thể nằm cùng hàng, priority list vẫn 1 cột, voice list 2 cột được. | Tab rail nằm ngang 3 tab; content thoáng hơn; tester có thể dính. | Kênh vẫn xếp chồng nhưng có nhiều không khí; priority chain có thể nằm ngang. |
| **1280** | Max-width ~720–800 px, label-control 2 cột, engine list nằm ngang hoặc 2 cột, voice list 2 cột, tester ngang. | Tabs top, content max-width ~720 px, voice list 2 cột, sticky tester bên trái hoặc trên. | 2 kênh side-by-side 50/50; priority chain + tester 1 hàng; kênh có scroll riêng nếu dài. |
| **1920** | Giữ max-width, thêm padding hai bên, không kéo dài vô hạn. | Giữ max-width, tab rail rộng hơn, tester có thể nằm cạnh tab list. | Giữ 2 kênh 50/50, thêm khoảng cách, priority chain có thể rộng hơn. |

---

## 6. States

Chung cho cả 3 concept:

- **Default:** section mở ra với header, tester, và các control mặc định.
- **Hover:** `Button`, `Card`, row, tab trigger sáng `var(--color-surface-hover)`.
- **Focus:** `focus-visible` ring `var(--color-primary)`.
- **Pressed:** button scale 0.985; `Toggle` thumb di chuyển; row pressed.
- **Active/Selected:** tab đang chọn, kênh đang mở, engine được focus, voice slot được chọn.
- **Disabled:** nút đầu/cuối priority, TTS disabled, build index khi chưa chọn file.
- **Loading:** voice list đang tải, index đang build, file đang xử lý.
- **Empty:** chưa chọn file local, chưa có voice pack, chưa chọn TTS voice.
- **Error:** file picker denied, TTS engine fail, build index fail, không tìm thấy voice.
- **Success:** "Đã lưu" / "Indexed N entries".
- **Playing:** tester đang phát, icon chuyển `play` → `pause`, nút disabled khi đang phát.
- **Reordering:** engine priority thay đổi; drag/Up-Down cập nhật order.

---

## 7. Anti-patterns đã tránh

- Không giữ 3 sidebar item riêng biệt cho cùng một miền âm thanh.
- Không để `TtsVoiceManagerPanel` tự render `Card` bên trong `SettingsDialogContent.Card` (double-card).
- Không để TTS tester cô lập — luôn có audio tester chung cho priority chain.
- Không dùng góc vuông hoặc hardcoded px/spacing ngoài token scale.
- Không dùng Material Design 3 tokens (`md-sys-color`).
- Không glass-on-glass quá 3 lớp; Concept C cần kiểm soát kỹ lớp kênh.
- Không inline SVG — dùng `Icon` từ `ICON_CATALOG`.
- Mobile-first: 320 px phải dùng được, touch target ≥ 44 px.

---

## 8. Text & i18n Considerations

### 8.1 Cần viết lại / gộp

| Hiện tại | Đề xuất mới | Lý do |
|---|---|---|
| "Pronunciation" (sidebar + card title) | "Audio" | Gộp miền rõ ràng, ngắn gọn. |
| "Local Pronunciation" | "Local audio package" hoặc "Local package" | Tránh trùng "Pronunciation", nhấn mạnh gói audio. |
| "TTS Voices" | "Text-to-Speech" hoặc "TTS" | Nhất quán với toggle/setting title. |
| "Audio source priority" | "Priority chain" hoặc "Audio source chain" | Ngắn hơn, gợi ý fallback. |
| "Engines are tried in order..." | "Sources are tried from top to bottom when you play a word." | Thân thiện hơn. |
| "Download eSpeak TTS data" | "Download eSpeak voice data on demand" | Rõ ràng đây là TTS data. |
| "Show buttons" (`maxDisplay`) | "Voice buttons to show" hoặc "Max voice buttons" | Ít gây nhầm. |
| "Delete selection (N)" trong tester | "Clear selection" hoặc "Deselect N" | Tránh từ "Delete" khi chỉ là bỏ chọn. |

### 8.2 Nhóm i18n keys cần thêm (không full list)

- `settings.audio.*`: title, description, nav label, nav icon aria.
- `settings.audio.priority.*`: title, description, source labels, reorder aria, test button.
- `settings.audio.local.*`: title, description, package type, file picker labels, build index, status.
- `settings.audio.tts.*`: title, description, enable, max display, autoplay, voice slots, save, tester.
- `settings.audio.tester.*`: placeholder, play, play via chain, play via voice, error, loading.
- `settings.audio.errors.*`: file picker denied, index build failed, voice load failed.

> **Lưu ý:** UI language hiện tại đang hardcoded nhiều chỗ trong các panel audio. Gộp section là cơ hội đưa toàn bộ string này vào `messages/en.json` và `messages/vi.json`.

---

## 9. Mockup

> **Không xây dựng mockup site trong subagent này** theo yêu cầu. Entrypoint dự kiến theo skill `idea-to-interface`:

```
src/entrypoints/mockup-audio/
├── index.html
├── main.tsx       # shell: concept / viewport / theme switcher + stage
├── real.tsx       # production Audio section hiện tại (3 cards)
├── ConceptA.tsx   # Single Audio Card
├── ConceptB.tsx   # Audio Tabs
├── ConceptC.tsx   # Audio Command Deck
├── common.tsx     # shared mock pieces
├── mockData.ts    # mock state khớp PronunciationSettings + TtsSettings
└── mockup.css
```

Shell cần có:

| Control | Options |
|---|---|
| Concept switcher | Real panel, Concept A, Concept B, Concept C |
| Viewport switcher | Mobile (≤420 px), Desktop (≥640 px) |
| Theme switcher | Light / Dark |

Stage dùng `container-type: inline-size`, default mobile, token background/border.

---

## 10. Component Mapping (tạm, hoàn thiện sau khi chọn concept)

| UI element | Có thể reuse / extend | Ghi chú |
|---|---|---|
| Section header | `Heading` + `Text` | Có sẵn. |
| Audio tester | `Input`/`Textarea` + `Button` + `Select` + `Icon` | Có thể tách thành component riêng nếu dùng ở nhiều concept. |
| Priority chain | `Card` / `SettingsRow` + `Button` + `Icon` (`arrowUpDown`) | Drag-and-drop cần đánh giá lại; Up/Down an toàn hơn. |
| Local package | `Select`, `Input`, `Button`, `SettingsRow` | Giữ nguyên logic file picker. |
| TTS settings | `Toggle`, `Select`, `Button` | Master toggle, maxDisplay, autoplay, voice slots. |
| Voice list tester | `Checkbox`, `Input` type number, `Button`, `Icon` | Có sẵn trong `TtsVoiceManagerPanel`. |
| Local TTS packs | `Toggle`, `Select`, `Button`, `Progress` | `TtsLanguagePanel` hiện có. |
| Tabs / bottom rail (Concept B) | `Tabs` | Có sẵn, cần điều chỉnh style cho mobile nếu dùng bottom rail. |
| Channel card (Concept C) | `Card` variant `interactive`/`glass` | Cần kiểm soát glass layer; có thể cần `Accordion` cho expand/collapse. |
| Alert / status | `Alert` | Dùng cho error/success. |
| Empty state | `EmptyState` | Khi chưa có voice/file. |

---

## 11. Design Read

> *Dàn âm thanh trên mặt hồ — mỗi nguồn là một kênh trong suốt, cùng chảy vào một đầu ra duy nhất, dễ điều chỉnh, dễ thử trước khi lưu.*
