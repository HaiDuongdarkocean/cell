# Design Handoff: Dictionary Popup Prototype

## 0. Mục đích tài liệu

Tài liệu này giao việc cho agent UI/design tạo **prototype tương tác như sản phẩm thật** cho Dictionary Popup của Cell.

Đây là **prototype UI/UX**, không phải implementation production:

- Dùng mock data cục bộ để mô phỏng lookup, loading, lỗi và thao tác add card.
- Không gọi Forvo, Google Images, Google Translate, AnkiConnect hay IndexedDB thật trong prototype.
- Không triển khai OCEAN phrasal verb/idiom, Cell Memory SRS, hay click-đệ-quy correction.
- Prototype phải cho phép người review tự click qua các flow chính để phát hiện hành vi còn thiếu trước khi viết spec implementation.

### Prototype đã build

Folder prototype tương tác: `docs/mockups/dictionary-popup-prototype/` (mở `index.html` trong browser, không cần build). Đã tách module để reuse và dễ bảo trì:

- `index.html` — shell + SVG icon sprite + context area + popup + creator + settings dialog.
- `styles.css` — theme tokens (dark/light), layout, components, responsive.
- `fixtures.js` — mock data (English `hello`, Chinese `喜欢`, Not found `xyzabc`, English external error).
- `popup.js` — render + interaction của Dictionary Popup.
- `creator.js` — render + interaction của Card Creator workspace.
- `settings.js` — Card settings dialog (SRS target, default tab per language, auto-prefill toggles).
- `app.js` — state wiring, token clicks, selection fallback, dev controls, keyboard shortcuts.

Cách dùng:
- Dev bar trên cùng chọn fixture và theme (Dark/Light).
- Click token trong câu EN/ZH để mở popup. Chinese segmentation: click 喜 hoặc 欢 đều highlight cả 喜欢 và tra "喜欢".
- Bôi đen vùng text để fallback khi auto-detect sai.
- Popup Migaku-style: header (target + pronunciation + badges), toolbar icon SVG (Audio/Image/AI/Translate/Help/Links/More), **Definitions luôn hiển thị** dưới toolbar với checkbox từng definition, panel toggle (Audio/Image/Translate/Links) mở phía trên definitions, footer có status cycle (New → Known → Tracking → Learning) và Quick Add icon.
- Nút Quick Add (icon +) ở header popup hoặc footer → mô phỏng add thẻ Anki. Không có nút X đóng popup; click ngoài hoặc Esc để đóng.
- "Open Card Creator" hoặc mở creator từ prototype → workspace hai pane, header Migaku-style (title + Settings/History/Close icon), sub-header Card type + Deck, form với field actions SEARCH/CREATE + media slots inline.
- Card settings (icon ⚙ trong creator header): Language output, Automatic pre-fill toggles, Default tab per language, Send card to (Anki / Cell Memory stub), Bold target word.
- Cell Memory stub: chọn trong settings → nút Create card đổi thành "Create card (stub)" + toast error khi submit.
- Popup có `resize: both`; màn hình không đủ thì tự động đẩy sang trái/phải/trên/dưới.
- Esc đóng popup/creator/settings. Click ngoài popup đóng popup.
- Responsive: mobile 375px → popup full-width, Card Creator chuyển column (lookup 38% trên, creator dưới).

Verified bằng edge-devtools MCP: render đúng dark/light, segmentation highlight 2 token, toolbar toggle panel, definition checkbox, status cycle, Quick Add toast success, Card Creator auto-fill, Settings dialog save, Cell Memory stub, mobile 375px không overflow.

## 1. Nguồn yêu cầu và nguyên tắc ưu tiên

### Nguồn tham chiếu

1. Hình tham chiếu do product owner cung cấp: popup dictionary nền tối, header từ lớn, hàng badge, toolbar icon, các section audio/definition/inflection.
2. `docs/specs/design/UC/UC03_doc_trang_web/UC03.4_word_popup.md` — word popup hiện có trong product specification.
3. `docs/specs/design/UC/UC09_tao_flashcard/UC09.2_quick_add_flashcard.md` — quick add và card creator.
4. `src/shared/lib/themeTokens.ts` — token runtime dùng cho content-script UI.
5. `src/shared/ui/Button.tsx`, `Dialog.tsx`, `IconButton.tsx`, `Tooltip.tsx` — shared component contracts.
6. `src/features/subtitle/ui/subtitleUI.ts` — overlay subtitle hiện tại: text đang là plain text trong span, selection được phép.

### Quyết định sản phẩm đã chốt

- User đầu tiên: chủ project, học tiếng Anh và tiếng Trung.
- MVP phải chạy thật sau prototype cho mọi text trên trang web và subtitle overlay.
- Auto-detect target word là cơ chế chính; native text selection là fallback khi detect sai.
- English: whitespace/token boundary.
- Chinese: dictionary-based segmentation; click một chữ trong `我喜欢你` phải ưu tiên token `喜欢`, không chỉ `喜`.
- Lookup local/offline dùng dictionary và frequency resource đã có trong ADR-023.
- Hiển thị pronunciation: IPA cho English, pinyin cho Chinese nếu resource cung cấp.
- Target word audio: Forvo theo language config; sentence audio: system TTS.
- External material lazy-load: audio, image, translation chỉ tải khi user mở tab hoặc yêu cầu.
- Add flow có hai đường: `Quick Add` và `Send to Creator`.
- Card Creator có lựa chọn SRS destination: `Anki` hoặc `Cell Memory` (Cell Memory chỉ là stub trong MVP).
- Default tab lưu theo language: English có thể mở Audio, Chinese có thể mở Dictionary.
- Không có click đệ quy trong sentence ở MVP.
- Không có OCEAN phrasal verb/idiom detection và lemmatization trong MVP.

## 2. Mục tiêu trải nghiệm

Người dùng gặp một từ khi đọc web/xem video:

1. Chọn hoặc click từ.
2. Popup xuất hiện gần vị trí từ, không che mất ngữ cảnh nếu còn vị trí khác.
3. Trong khoảng dưới 1 giây, phần local lookup hiển thị target, pronunciation, frequency và definition.
4. User có thể nghe audio, xem ảnh, dịch sentence, mở dictionary ngoài.
5. User tích chọn nguyên liệu muốn học.
6. User Quick Add trực tiếp hoặc Send to Creator để review.
7. UI luôn báo rõ đang loading, thành công, thất bại hoặc thiếu resource.

Prototype phải trả lời được các câu hỏi sau:

- User có biết popup đang tra token nào không?
- User có phân biệt được definition local với material tải ngoài không?
- User có hiểu icon nào là nghe word, nghe sentence, mở link, add card không?
- User có nhìn thấy và thay đổi được default tab theo từng ngôn ngữ không?
- Khi resource chưa tải hoặc lỗi, user có biết cách tiếp tục không?
- Quick Add và Send to Creator có khác nhau rõ ràng không?
- Chinese segmentation có được giải thích bằng UI khi confidence thấp không?

## 3. Phạm vi màn hình prototype

Agent design cần tạo một prototype screen có thể chuyển giữa các trạng thái sau bằng control/dev toggle rõ ràng (chỉ dùng cho prototype, không hiển thị trong product final):

1. `english-ready` — English lookup đầy đủ.
2. `chinese-ready` — Chinese lookup đầy đủ, có pinyin và segmentation.
3. `loading-material` — local result đã có, panel material đang lazy-load.
4. `not-found` — không có local dictionary result.
5. `offline-material-error` — definition local vẫn dùng được, external material lỗi.
6. `quick-add-success` — toast thành công.
7. `quick-add-failure` — toast lỗi và retry.
8. `creator-workspace` — Card Creator two-pane review.
9. `creator-settings` — Card Settings dialog mở, có thể đổi destination giữa Anki và Cell Memory.
10. `mobile-narrow` — popup responsive ở chiều rộng hẹp.

Prototype không cần mô phỏng toàn bộ trang web, nhưng nên có một vùng context giả lập phía sau với một câu subtitle/web text và target token được highlight để thể hiện anchor của popup.

## 4. Bố cục popup

### 4.1 Container

- Popup floating, anchored gần target text.
- Desktop width đề xuất: `min(560px, calc(100vw - 32px))`.
- Mobile width: `calc(100vw - 24px)`, không vượt viewport.
- Max height phải giới hạn theo viewport; body scroll độc lập.
- Không dùng modal overlay toàn màn hình cho word lookup.
- Có thể dùng Shadow DOM/isolation khi mount trên trang ngoài để CSS website không phá giao diện.
- `z-index` dùng semantic token hiện có; không tự đặt một magic number mới nếu token đã đủ.
- Border radius chính: `var(--radius-xl)` hoặc token gần nhất; không bo tròn từng section quá mức.
- Shadow: `var(--shadow-lg)` hoặc token tương đương.
- Không dùng gradient, glassmorphism, neon glow, hoặc animation gây mất tập trung.

### 4.2 Header

Header bám ảnh tham chiếu nhưng làm rõ hierarchy:

```text
┌──────────────────────────────────────────────────────────┐
│ hello                              [card] [quick add]    │ 
│ /həˈləʊ/                                                 │
│ [Known] [Netflix #199]                                   │
└──────────────────────────────────────────────────────────┘
```

Thành phần:

- Target word/phrase: lớn, đậm, dễ đọc.
- Pronunciation ngay dưới target: IPA hoặc pinyin, có nút nghe word cạnh pronunciation.
- Language/resource context nhỏ: `English · 2 dictionaries` hoặc `中文 · 1 dictionary`.
- Frequency badge: hiển thị rank rõ, ví dụ `#199 · Netflix`; nếu không có rank thì không render badge giả.
- Learning status badge: `Known`, `New`, `Learning`; đây là trạng thái minh họa cho prototype.
- Nút góc phải:
  - `Send to Creator`: icon card/note, aria-label rõ — chuyển sang Card Creator workspace.
  - `Quick Add`: icon `+` primary, aria-label rõ — dùng để add thẻ nhanh.
  - Không có nút `Close` trong popup header; đóng bằng click ngoài hoặc `Esc`.
- Trên mobile, các action vẫn là icon với tooltip/accessible name.

### 4.3 Header pronunciation & audio

- Pronunciation (IPA/pinyin) có nút play word audio nhỏ.
- Không phát audio tự động khi popup mở.

### 4.4 Toolbar (Migaku-style)

Dictionary content (definitions) luôn hiển thị dưới header. Toolbar không dùng để chuyển tab mà dùng để toggle các panel phụ (Audio / Image / Translate / Links) hoặc trigger các action nhanh.

Toolbar icons MVP:

- `Audio` — toggle panel phát word Forvo + sentence TTS.
- `Image` — toggle panel Google Images lazy-load (horizontal scroll).
- `AI / LLM` — placeholder, toast deferred (không trong MVP).
- `Translate` — toggle panel sentence translation.
- `Help` — placeholder, toast deferred.
- `Links` — toggle panel external dictionary links.
- `More` — overflow menu placeholder.

Quy tắc:

- Mỗi icon là nút tròn 36x36px với SVG.
- Nút đang active panel có viền/màu `var(--color-primary)`.
- Nhóm action liên quan (AI/Translate/Help) có thể bọc trong group pill.
- Có tooltip / aria-label rõ ràng.
- Mobile: horizontal scroll nếu không đủ chỗ.

Default panel per-language (cấu hình trong Card Settings):

- Khi mở popup, nếu default panel là `Audio`/`Image`/`Translate`/`Links`, panel đó tự động mở.
- Default `dictionary` nghĩa là không mở panel phụ nào, chỉ hiện definitions.

### 4.5 Definitions (luôn hiển thị)

Definitions là nội dung chính, luôn render ngay từ local mock data.

Nội dung:

1. **Target identity** (ở header)
   - Headword.
   - Reading/pronunciation (IPA / pinyin).
   - Part of speech chips.
   - Frequency rank.
   - Optional source label, ví dụ `Cambridge`, `CC-CEDICT`.
2. **Definitions**
   - Mỗi definition là một card có checkbox bên trái.
   - User tick/untick để chọn definition sẽ đưa vào card.
   - Mặc định tất cả definitions được chọn.
   - Definition HTML trong resource phải được render an toàn; prototype dùng text/approved markup, không dùng raw unsafe HTML tùy ý.
   - Ví dụ câu nằm dưới definition với typography secondary.

**KHÔNG hiển thị** trong popup: inflections/variants section, sentence context block, material checklist. Các thông tin này đã được chuyển vào Card Creator hoặc panel khác.

### 4.6 Audio panel

Bám ảnh tham chiếu với hai nhóm rõ:

```text
PLAY WORD
▶ Forvo · US native                    [play]
▶ Forvo · UK native                    [play]
▶ System TTS · Female                  [play]

PLAY SENTENCE
▶ System TTS · English (US)             [play]
▶ System TTS · English (UK)             [play]
```

Chinese mock:

```text
PLAY WORD
▶ Forvo · Mandarin native              [play]
▶ System TTS · 普通话                    [play]

PLAY SENTENCE
▶ System TTS · Chinese (Mandarin)       [play]
```

States bắt buộc:

- `idle`, `loading`, `playing`, `paused`, `unavailable`, `error`.
- Forvo external item có source badge và nút retry.
- System TTS không được trông như network error.
- Panel có thể mở default theo language setting.

### 4.7 Image panel

Toggle từ toolbar. Hiển thị dạng horizontal scroll strip phía trên definitions.

- Lazy-load khi mở panel, không fetch lúc popup vừa mở.
- Skeleton strip trong lúc load.
- Mỗi ảnh là card rounded với checkmark badge góc trên-phải khi selected.
- Click ảnh để toggle chọn; selected images được đưa vào card khi Quick Add / Send to Creator.
- Có retry khi ảnh lỗi.
- Có fallback `Open image search` nếu không load được.
- Không dùng ảnh bản quyền thật trong prototype; dùng placeholder có tỷ lệ aspect ratio thật.
- Alt text phải có, fallback `Image result for {term}`.

### 4.8 Translate panel

Toggle từ toolbar. Hiển thị một card duy nhất phía trên definitions theo bố cục tham chiếu #7:

- Target translation ở trên (font size lớn hơn, màu text chính).
- Source sentence ở dưới (font size nhỏ hơn, màu secondary, italic).
- Nút copy ở góc trên-phải card.
- Target language mặc định là ngôn ngữ học của user (mock: Vietnamese), cấu hình trong Card Settings.
- Trạng thái: loading skeleton, translated, unavailable/offline, retry.
- Không gọi AI; label `Machine translation`.

### 4.9 Links panel

Toggle từ toolbar. Hiển thị danh sách external dictionary links phía trên definitions.

- English: Cambridge, Oxford, Wiktionary.
- Chinese: MDBG, Wiktionary, Pleco/web link nếu product config cho phép.
- Link mở tab mới, có external-link icon.
- URL phải được render từ configured template, không cho raw user-controlled HTML.
- Nếu chưa cấu hình link, hiển thị empty state + `Configure external dictionaries`.

### 4.10 Footer actions

Footer sticky:

```text
                                              Status [Known ▼]
```

- Footer chỉ hiển thị **Status cycle** bên phải — click để chuyển vòng `New → Known → Tracking → Learning`. Đây là trạng thái từ trong SRS.
- **Quick Add** chỉ nằm ở header popup, không lặp lại ở footer.
- Không có nút `X` đóng popup trong header; user click ngoài popup hoặc nhấn `Esc`.
- Nút Quick Add cũng xuất hiện ở header popup (bên cạnh copy) để user không phải cuối footer.
- `Send to Creator` không còn ở footer; mở từ prototype dev control hoặc từ một icon shortcut khác trong tương lai. Trong prototype hiện tại, mở Card Creator từ dev bar hoặc nút mở rộng.
- Nếu destination là `Cell Memory`, Quick Add và Create Card đều trả trạng thái stub rõ ràng, không giả vờ lưu thành công.

## 5. Card Creator prototype — two-pane workspace

### 5.1 Product decision

Card Creator **không phải dialog nhỏ**. Khi user chọn `Send to Creator`, trải nghiệm chuyển sang một workspace chuyên dụng:

- **Pane trái:** Dictionary Lookup — giữ nguyên target đang tra, definition, sentence, audio/image/translation và các material đã chọn.
- **Pane phải:** Card Creator — form field để review, chỉnh sửa và tạo card.

Mục tiêu là user không phải nhớ lại definition hoặc quay đi quay lại giữa popup và form. Lookup là nguồn dữ liệu sống; Creator là nơi quyết định output card.

Desktop mockup:

```text
┌──────────────────────────────────────────────┬──────────────────────────────┐
│ DICTIONARY LOOKUP                            │⚙         Card Creator     ✕ │
│                                              ├──────────────────────────────┤
│ [Search target / phrase                ×]    │ Card type [Sentence ▼]       │
│ hello                              [copy][+]  │ Deck      [My Cards ▼]       │
│ /həˈləʊ/                                     │                              │
│ [Known] [#199 Netflix]                       │ Target word                  │
│                                              │ [hello]                      │
│ [▶] [🖼] [AI|🌐|?] [🔗] [≡]                  │                              │
│                                              │ Sentence              CREATE  │
│ [IMAGES horizontal strip]                    │ [I said hello...]            │
│                                              │                              │
│ DEFINITIONS                                  │ Sentence translation  CREATE  │
│ ☑ 1. exclamation  A greeting...              │ [Tôi đã chào...]             │
│    “Hello, how are you today?”                │                              │
│ ☑ 2. noun  An utterance of “hello”...         │ Definition             SEARCH │
│    ...                                        │ [A greeting...]              │
│                                              │                              │
│ Status [Known ▼]                        [+]   │ Sentence audio        CREATE  │
│                                              │ [TTS sentence        ✕] [+ADD]│
│                                              │ Word audio            SEARCH  │
│                                              │ [Forvo US           ✕] [+ADD]│
│                                              │ Images                SEARCH  │
│                                              │ [🖼 selected        ✕] [+ADD]│
│                                              │ Example sentences     SEARCH  │
│                                              │ [Hello? Is anybody...]       │
│                                              │ Notes                 CREATE  │
│                                              │ [Any memory hint...]         │
│                                              │                              │
│                                              │ [CLEAR FIELDS] [CREATE CARD] │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

The supplied Migaku-style screenshot is the visual reference for density, dark layout, rounded icon buttons, and compact icon-toolbar. It is **not** a license to hardcode those colors; map everything to Cell theme tokens.

### 5.2 Workspace shell

- Desktop (>1024px): left lookup pane `50%`, right creator pane `50%`; both scroll independently.
- Tablet/small laptop (≤1024px): stack vertically — lookup pane on top (`max 35vh`), creator form below.
- Right pane has its own vertical scroll; left pane may scroll independently.
- Top-level workspace fills the available extension viewport, not a centered modal.
- Header remains visible while the form scrolls.
- Keep a clear close action (icon ✕) so user can leave creator without losing the current lookup draft.
- The lookup pane must remain interactive: switching tabs, playing audio and changing selected images updates creator preview/input when selected.
- The creator pane must never silently overwrite user edits when lookup data changes. If lookup target changes while fields are dirty, show a small `Replace fields?` confirmation in prototype.

### 5.3 Left pane — Dictionary Lookup

Reuse the popup content model from sections 4.2–4.9, adapted to a full-height pane:

1. Search/lookup bar at top with current target and clear action.
2. Recent/current lookup chip row.
3. Word header: target, pronunciation/pinyin, status, frequency, share/open actions.
4. Compact icon toolbar.
5. Media strip (image/audio/translate/link panel) with selectable materials.
6. Definitions and examples (with checkboxes).

Required behavior:

- `Search` in the lookup bar updates the left result using mock fixtures.
- `Add`/check actions mark materials as included in the creator.
- `DELETE` on current lookup clears only the lookup target, not the entire creator draft unless user confirms.
- If lookup result is not found, creator may still keep manually entered target but must show `No local dictionary result`.

### 5.4 Right pane — Creator form

Top controls:

- Card type select: prototype options `Sentence`, `Basic`, `Cloze`.
- Deck select: mock `My Cards`, `English Vocabulary`, `Chinese Vocabulary`.
- Settings icon opens **Card Settings** dialog (functional in prototype): Language output, Automatic pre-fill toggles, Default tab per language, Send card to (Anki / Cell Memory), Bold target word.

Field rows follow the screenshot's action grammar. Each row has a field label, input/control, and optional source action:

1. `Target word` — auto-filled from lookup; editable.
2. `Sentence` — auto-filled from current context; `CREATE` means generate/reselect in future, for prototype it opens a mock state.
3. `Sentence translation` — editable; `CREATE` shows mock translation loading/result.
4. `Definition` — editable; `SEARCH` copies the active definition from left pane.
5. `Sentence audio` — media slot with `ADD`; selected TTS/video audio appears as removable chip.
6. `Word audio` — media slot with `ADD`; selected Forvo/TTS audio appears as removable chip.
7. `Images` — media slot with `ADD`; selected image thumbnails appear in the slot.
8. `Example sentences` — editable supplementary examples; `SEARCH` imports mock examples.
9. `Notes` — editable free text; `CREATE` shows mock note suggestion, never calls AI.

Each source action must show a result state in the prototype: idle → loading → populated/error. `SEARCH` and `CREATE` are action labels, not decorative text.

Bottom action bar:

- `CLEAR FIELDS` — clears creator fields only; must ask for confirmation if fields are dirty.
- `CREATE CARD` or `UPDATE CARD` — primary action mapped to `var(--color-primary)`/semantic action token.
- Success toast: `Added “hello” to Anki`.
- Failure toast: `Could not add card` + `Retry`.
- Cell Memory submit: `Cell Memory chưa khả dụng trong MVP`; do not show success.

### 5.5 Card Creator state and editing rules

- Opening Creator copies a snapshot of the selected lookup materials into the form.
- Later changes in the left lookup pane update only fields still marked `auto-filled`.
- Once user edits a field, mark it dirty internally and preserve the manual value.
- `SEARCH`/`CREATE` actions explicitly replace only their own field after confirmation if that field is dirty.
- Switching `Anki` / `Cell Memory` preserves common fields.
- Switching card type may alter visible fields, but never delete hidden values without confirmation.
- Empty required field states are inline, not only a toast.
- Creator draft survives switching left tabs and opening audio/image previews.

### 5.6 Responsive behavior

- Desktop: two panes side by side.
- Tablet: two panes remain if width allows; otherwise left pane becomes a collapsible drawer, right pane remains primary.
- Mobile: use a two-step flow with a persistent step switcher:
  - `1 Lookup` — inspect/select materials.
  - `2 Creator` — review/edit card.
- On mobile, never squeeze both panes into unreadable columns.
- `CREATE CARD` remains sticky at bottom with safe-area padding.
- Left lookup state and creator draft must survive step switching.

### 5.7 Prototype must allow

- Open workspace from `Send to Creator`.
- Search English and Chinese fixtures from the left pane.
- Select/deselect audio, images and translation on the left and see corresponding creator slots update.
- Edit creator fields without them being overwritten by left-pane changes.
- Use field-level `SEARCH`/`CREATE` mock actions.
- Change card type and deck. Change SRS destination, default tab per language, and auto-prefill toggles in Card Settings.
- Clear fields with confirmation.
- Create success, create failure/retry, and Cell Memory unavailable states.
- Return to lookup while preserving the draft.

## 6. Interaction contract

### Lookup trigger

Prototype should include a small context area outside popup:

```text
I said hello to everyone.
```

Interactions:

- Click/hover target token opens popup.
- Selected token receives visual highlight.
- Clicking another token replaces current result instead of stacking popups.
- Click outside closes popup.
- Escape closes popup.
- Native selection of `hello to` shows selected text as lookup target in prototype fallback.
- The prototype must not implement recursive click inside sentence examples.

### Chinese segmentation demo

Include a switch/context example:

```text
我喜欢你
```

- Highlight `喜欢` as detected token.
- Show a subtle confidence/source note only if useful: `Detected phrase · dictionary match`.
- Include a prototype-only toggle to demonstrate a segmentation fallback, but do not make the fallback look like production behavior.

### Loading and lazy-load

- Local definition skeleton only if local lookup is simulated as delayed.
- External tabs show skeleton on first open.
- Switching back to a loaded tab preserves result and does not restart loading.
- Closing/reopening popup may reset external tab state in prototype unless persistence is explicitly demonstrated.

### Toasts

Use existing toast visual language from subtitle manager spec:

- Success: success icon + `Added “hello” to Anki`.
- Failure: error icon + actionable `Retry`.
- Informational: `Audio panel set as default for English`.
- Toast must not block popup actions.

## 7. Visual system constraints

### Must reuse existing tokens

Use CSS custom properties from `src/shared/lib/themeTokens.ts`:

- Colors: `--color-background`, `--color-surface`, `--color-surface-hover`, `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-primary`, `--color-primary-subtle`, `--color-success`, `--color-warning`, `--color-error`, `--color-border`, `--color-border-subtle`.
- Typography: `--font-family`, `--font-size-xs/sm/base/lg/xl/2xl`, `--font-weight-medium/semibold/bold`, `--leading-*`.
- Spacing: `--space-1` through `--space-16`.
- Radius: `--radius-sm/md/lg/xl/2xl/full`.
- Motion: `--duration-150/200/300`, `--ease-*`.
- Shadows: `--shadow-sm/md/lg`.
- Layering: `--z-dropdown`, `--z-modal`, `--z-popover`, `--z-tooltip`.

Do not introduce raw hex values, arbitrary spacing, or a second theme system. The screenshot's purple background is a visual reference only; map it to current theme tokens so both light/dark/custom palettes work.

### Typography and density

- Use existing Inter/system font stack.
- Target word may use `--font-size-2xl` or `--font-size-3xl` only when popup width allows.
- Definitions use readable `--font-size-base`, `--leading-normal`; avoid dense tiny text.
- Section labels are uppercase/small only for grouping (`PLAY WORD`, `DEFINITIONS`), not for important content.
- Maintain 4px-based spacing.

### Accessibility

- Semantic tablist/tab/tabpanel with roving keyboard behavior or equivalent.
- Every icon-only button has an accessible name.
- Focus visible with `--color-ring`.
- Contrast must pass existing theme contrast validation.
- Never rely on color alone for selected/known/error states.
- Audio controls have text or screen-reader labels.
- Images have alt text.
- Popup must be keyboard navigable without trapping focus on a non-modal floating panel.
- Card Creator workspace must expose an accessible landmark, keyboard navigation, and an Escape/back action to return to lookup; use existing Dialog semantics only for confirmation popovers.
- Respect `prefers-reduced-motion`.

## 8. Responsive behavior

### Desktop

- Popup can show two-column media content where useful.
- Full tab labels and action labels.
- Max body height about 70vh.

### Tablet

- Keep full popup but reduce horizontal padding.
- Toolbar may become scrollable.
- Card Creator uses a near-full-width two-pane workspace; collapse the lookup pane if width is insufficient.

### Mobile / narrow viewport

- Popup width leaves 12px side margins.
- Header actions are icon-first.
- Toolbar horizontal-scroll if needed.
- Definition content remains single column.
- Image grid stays usable with 40px touch targets.
- Footer keeps status pill on the right.
- No horizontal page overflow.

### Card Creator responsive breakpoints

- Desktop (>1024px): two-pane, left lookup `50%`, right creator `50%`. Both panes scroll independently.
- Tablet/small laptop (≤1024px): stack vertically — lookup pane becomes `35vh` max on top, creator form below.
- Mobile (≤768px): same stacked layout; creator header stacks title + action icons; all inputs full width.

## 9. Mock data contract

The prototype may define local fixtures, but the shape should mirror the future logic/UI boundary:

```ts
type DictionaryPopupFixture = {
  language: 'en' | 'zh';
  term: string;
  reading: string;
  pronunciationKind: 'ipa' | 'pinyin';
  frequency: { rank: number; source: string } | null;
  status: 'new' | 'learning' | 'known';
  partsOfSpeech: string[];
  definitions: Array<{
    id: string;
    pos?: string;
    text: string;
    examples: string[];
  }>;
  sentence: {
    source: string;
    translation?: string;
    targetRange?: [number, number];
  };
  audio: Array<{
    id: string;
    kind: 'word' | 'sentence';
    source: 'forvo' | 'tts';
    label: string;
    state: 'idle' | 'loading' | 'ready' | 'error';
  }>;
  images: Array<{ id: string; alt: string; src: string; selected: boolean }>;
  externalLinks: Array<{ id: string; name: string; url: string }>;
};
```

Required fixtures:

- English: `hello`, IPA `/həˈləʊ/`, rank `#199`, multiple definitions, Forvo US/UK, TTS sentence.
- Chinese: `喜欢`, pinyin `xǐhuān`, rank fixture, simplified/traditional metadata, Mandarin Forvo/TTS, sentence `我喜欢你`.
- Not found: `xyzabc`.
- External error: English result with Forvo/image/translate failure.

## 10. Prototype acceptance criteria

### Core interaction

- [ ] Reviewer can open popup from English context token.
- [ ] Reviewer can open popup from Chinese token and sees `喜欢`, not only `喜`.
- [ ] Clicking another context token swaps result in the same popup.
- [ ] Native selection fallback visibly uses selected text as target.
- [ ] Click outside and Escape close popup.

### Content

- [ ] Ready state shows target, IPA/pinyin, frequency, status, POS, definitions.
- [ ] Definitions are always visible; each definition has a selectable checkbox.
- [ ] Audio/Image/Translate/Links panels toggle from toolbar and open above definitions.
- [ ] Audio panel distinguishes target word audio from sentence audio.
- [ ] Image panel is a horizontal scroll strip with selected checkmark badges.
- [ ] Translate panel shows target translation above source sentence in one card.
- [ ] External panels visibly lazy-load and preserve loaded state.
- [ ] Missing/error states are actionable and do not erase local definitions.

### Card creation

- [ ] Quick Add icon uses selected definitions and shows success/failure toast.
- [ ] Card Creator opens as two-pane review workspace with populated fields.
- [ ] Creator header has Settings/History/Close icons and Card type + Deck dropdowns.
- [ ] Settings dialog contains SRS target, default tab per language, and auto-prefill toggles.
- [ ] Creator allows editable fields, media slots, and SEARCH/CREATE field actions.
- [ ] Anki mock submit succeeds; Cell Memory clearly reports unavailable/stub.
- [ ] Back/Cancel returns to lookup without losing the current creator draft or selected materials.

### Design system and quality

- [ ] No hardcoded colors/spacing where existing tokens apply.
- [ ] Works in light, dark, and custom theme token contexts.
- [ ] Keyboard focus and aria labels are present.
- [ ] No horizontal overflow at narrow viewport.
- [ ] Prototype has an obvious way to switch fixture/state for review.
- [ ] No OCEAN, recursive sentence lookup, or real external API behavior is implied as complete.

## 11. Agent deliverables

The design agent should return:

1. Interactive prototype implemented as modular HTML/CSS/JS files in `docs/mockups/dictionary-popup-prototype/` so components can be reused across future prototypes.
2. A short screen/state map: each state, entry action, exit action.
3. A list of unresolved UX decisions discovered while prototyping.
4. A list of missing production dependencies/logic, separated from UI gaps.
5. Screenshots or a reproducible local route/entry point for:
   - English ready
   - Chinese ready
   - Audio loading/error
   - Card Creator with Anki selected
   - Card Creator with Cell Memory selected
   - Mobile narrow layout

Do not begin production implementation of network adapters, tokenizer, OCEAN engine, Cell Memory, or manifest permissions as part of this prototype task.
