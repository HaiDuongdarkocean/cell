# UI Design Spec — SRS Review Variants (handoff to design agent)

> Mục đích: spec này đủ để một design agent thiết kế UI hoàn chỉnh mà **không cần đọc tài liệu khác**.
> Product spec (behavior/data/scheduling): `docs/specs/srs-front-variants.md` — chỉ đọc nếu cần chi tiết implementation.
> Live mockup có sẵn 3 hướng khám phá: `src/entrypoints/mockup-srs-front-variants/` (xem §7).

---

## 1. Feature context

Tihoka là Chrome extension học ngoại ngữ (SRS flashcard). Một **note** (từ vựng + câu + media) sinh ra **card**; mỗi card được ôn qua nhiều **variant** — mỗi variant là một bài tập nhỏ với *mặt trước* (front) hiển thị một số "nguyên liệu" của note và *mặt sau* (back) hiển thị đáp án để tự chấm.

Trước đây cố định 3 variant. Feature này biến variant thành **entity người dùng tự quản**: tạo/sửa/xóa/đổi tên/tìm kiếm, tự chọn field hiển thị trên front, và mỗi variant có tiến trình + lịch ôn riêng (FSRS). **Back luôn canonical đầy đủ — không cấu hình.** Variant được nhóm trong **preset** — collection có preset mặc định, deck có thể override hoặc share preset với deck khác.

**Người dùng KHÔNG cấu hình "mode".** Toggle trên mặt thẻ tự derive từ field đã chọn + nguyên liệu note: chọn `target`+`sentence` → toggle góc trái-trên xoay `cả hai → word → sentence`; chọn `wordAudio`+`sentAudio` → toggle nghe `word/sentence`; chọn `input` (dictation) → phải nghe audio đang chọn rồi gõ lại (không audio → variant ẩn, không fallback gõ theo text).

**Nguyên tắc thiết kế cốt lõi của feature:** mặt trước phải *test trí nhớ thật* — không được lộ đáp án. Variant nào thiếu nguyên liệu cho front thì bị ẩn trên note đó (guard "căn cứ vào front").

### Persona & platform

- Người dùng 5–80 tuổi, đa số 10–25; desktop + tablet + Android; Chrome/Edge/Brave.
- Touch target ≥ 44px; mobile-first (thiết kế 320px trước); dark theme bắt buộc đẹp ngang light.
- Mọi chữ user-visible phải qua i18n keys (không hardcode chuỗi).

## 2. Domain vocabulary (dùng cho labels/ia)

| Term | Nghĩa |
|---|---|
| `variant` | Một bài tập trên card — có tên, icon, `fieldIds[]` (nguyên liệu front), `newLoops` |
| `field` | Nguyên liệu của note (xem field catalog §4); pseudo-field `input` = dictation |
| `derived toggle` | Toggle trên card tự sinh từ fieldIds + material — user không cấu hình |
| `newLoops` | Số lần card mới phải pass variant này (1–3) trước khi vào lịch FSRS thường |
| `preset` | Một bộ variant có tên, gán cho collection (default) hoặc deck (override/share) |
| `builtin` | 3 variant hệ thống: `sound`, `meaning`, `spelling` — sửa/xóa được, luôn có "Reset to default" |
| `servable` | Variant render được trên note hiện tại (đủ nguyên liệu front) |

## 3. Surfaces cần thiết kế

### S1 — Review card front (màn học)

Khung card hiện tại giữ nguyên (grade buttons, flip). Thiết kế lại **vùng nội dung front** theo contract của từng builtin variant + renderer generic cho custom variant.

| Variant | Front hiển thị | Ghi chú thiết kế |
|---|---|---|
| **sound** | Term + câu (text only) + scope toggle `cả hai → word → sentence` góc trái-trên (chỉ khi note có cả hai). **Không** nút audio, **không** autoplay | Minimal, tập trung đọc — audio chỉ ở back để verify |
| **meaning** | Chỉ image | Image chiếm trung tâm; không image → variant không tồn tại trên note đó |
| **spelling** | Audio button + input có placeholder + audio toggle `Word / Sentence` (chỉ khi cả hai audio có; persist) | Input là element chính; autoplay audio đang chọn |
| **custom** | Render `fieldIds` theo thứ tự: text → đoạn text; image → ảnh; audio → nút play; `input` → ô nhập. Toggle scope/audio tự sinh khi đủ điều kiện | Cần generic layout cho tổ hợp field bất kỳ |

Trạng thái bắt buộc có: front đầy đủ; front thiếu media (vẫn render phần có); toggle collapse (spelling thiếu `wordAudio` → toggle ẩn, cố định nghe câu); input focus/typing; card "hidden" (trong manager/preview — trong session variant ẩn thì đơn giản không xuất hiện). Toggle/chip phải có `min-width` cố định — label đổi (`cả hai`/`word`/`sentence`, `Word`/`Sent`) không được làm element resize.

### S2 — Variant manager (trong Study settings)

- Danh sách variant + search by name + nút "New variant".
- Mỗi item: icon, tên, badge builtin, số `newLoops`, trạng thái servable trên note đang preview (Active / Hidden).
- Row actions hoặc mở editor: rename, edit, delete (có confirm), reset to default (restore 3 builtin).
- Empty state khi search không khớp; trạng thái sau delete.

### S3 — Variant editor (Dialog)

Form cấu hình một variant — tối giản, draft-only:

1. **Live preview** — render front của variant trên note mẫu (đỉnh dialog, dùng chung component với card thật — SSOT); derived toggles bấm được trong preview; cho phép đổi note mẫu để thấy variant bị hidden khi thiếu nguyên liệu.
2. **Name** — input gọn (radius ~8px, nhỏ hơn input chuẩn).
3. **Front fields** — chip toggle chọn `fieldIds` từ field catalog (gồm `input` = Dictation). Toggle trên preview tự sinh; không có cấu hình mode riêng.
4. **New-card loops** — segmented `1× 2× 3×`, kèm `HintIcon` giải thích.
5. **Footer** — `Delete` ghost (neutral, chỉ đỏ khi hover) trái + `Save` primary phải. **Không** có nút Close ở footer — duy nhất `×` trên dialog. Edit = draft, chỉ commit khi Save; `×` discard.
6. Back không có trong editor — luôn canonical full fields (ghi chú nhỏ trong dialog).

### S4 — Preset scope & assignment

- Chọn preset cho **collection** (default) và cho **deck** (inherit / override / share).
- Hiển thị deck nào đang dùng preset nào; tạo preset mới từ preset hiện tại (duplicate-as-new OK nếu giúp flow).
- Khi preset bị xóa mà deck đang trỏ tới → deck tự về collection default (UI phải nói rõ điều này trong confirm).

## 4. Field catalog (nguyên liệu khai báo được)

| Field id | Label | Kind | Vai trò |
|---|---|---|---|
| `target` | Word | text | Đáp án chính — canonical |
| `sentence` | Sentence | text | Ngữ cảnh |
| `ipa` | IPA | text | Phiên âm |
| `definition` | Definition | text | Nghĩa |
| `image` | Image | image | Ảnh gợi nhớ |
| `wordAudio` | Word audio | audio | Phát âm từ |
| `sentAudio` | Sentence audio | audio | Đọc câu |
| `example` | Usage example | text | Back only |

## 5. Servability matrix (design phải thể hiện)

| Variant | Serve khi | Không serve khi |
|---|---|---|
| sound | `target` hoặc `sentence` có | thiếu cả hai |
| meaning | `image` resolve được | không image |
| spelling | ≥1 trong `wordAudio`/`sentAudio` resolvable (input cần audio để nghe) | không audio nào → ẩn |
| custom | ≥1 non-`input` field có; nếu có `input` → cần thêm ≥1 audio field | variant ẩn khi front không render được |

Toggle options degrade theo material: thiếu `wordAudio` → audio toggle collapse còn `Sent`; thiếu `sentence` → scope toggle collapse còn `word`.

Trong editor/manager phải có cách thấy trạng thái này (dim row, "Hidden on this note" trong preview) — variant ẩn **không phải lỗi**, là behavior đúng.

## 6. Design constraints (Tihoka design system — bắt buộc)

- **Không** Liquid Glass/blur; solid surfaces: `background → surface → surface-card → surface-elevated`.
- Chỉ dùng tokens `src/shared/styles/tokens.json` (`var(--color-*)`, `--space-*`, `--radius-*`, `--font-*`) — cấm hex/px hardcode, cấm `--md-sys-*`.
- Components từ `src/shared/ui/`: `Button` (primary/ghost/destructive…), `IconButton`, `Card`, `Input`/`InputField`, `SearchField`, `Checkbox`, `Select`, `SegmentedControl`, `Toggle`, `Dialog`, `ConfirmDialog`, `Menu`/`MenuItem`, `Badge`, `Accordion`, `EmptyState`, `Tabs`. Danh sách chọn lựa → dùng `Menu`, không tự viết dropdown.
- Icons từ `src/shared/icons/index.ts` (ICON_CATALOG): `volumeHigh`, `audioWave`, `image`, `pencil`, `search`, `plus`, `trash`, `rotateCcw`, `eye`/`eyeOff`, `chevronDown`, `chevronRight`, `layers`, `bookOpen`… Dùng semantic name; icon mới phải đề xuất theo Nucleus (24×24, stroke 1.5).
- Radius: cards/panels `--radius-xl` (12px), small controls `--radius-md`, pills `--radius-pill`. Hover: `surface-hover` + `opacity: var(--opacity-hover)`. Selected: `primary-subtle` bg + `primary` text. Focus: `var(--shadow-focus)`.
- Touch ≥44px; `@container`/`@media` breakpoints; `prefers-reduced-motion`.
- Full rules + audit checklist: `docs/design-system/DESIGN.md`; theory: `docs/design-system/DESIGN_RATIONALE.md`.

## 7. Existing exploration (mockup đã có sẵn)

Dev server (đang chạy): `http://localhost:5199/src/entrypoints/mockup-srs-front-variants/index.html`
Source: `src/entrypoints/mockup-srs-front-variants/` — shell có switcher Concept / Note material / Viewport / Theme; note switcher demo servability guard.

Ba hướng đã prototype (có thể kế thừa, trộn, hoặc đề xuất hướng mới tốt hơn):

- **A · Field notebook** — master–detail: list + search trái, editor form phải, preview dưới form. An toàn, dense, rẻ.
- **B · Card shelf** — preview-first: mỗi variant là tile render front thật; tap → Dialog editor. Trực quan nhất với metaphor "bộ thẻ".
- **C · Preset ledger** — scope-first: chips chọn collection/deck, preset select, ledger rows expand editor. Đưa preset/deck scoping lên first-class.

Design brief nền: `docs/intent/srs-front-variants-design-brief.md` (function audit, journey, dials).

## 8. Deliverables

1. Design direction được chọn + lý do (1-2 đoạn).
2. Mockup/prototype cho 4 surfaces S1–S4 (light + dark, mobile + desktop) — có thể mở rộng `mockup-srs-front-variants` hoặc tạo `mockup-<slug>` mới.
3. Component mapping: mỗi element → `src/shared/ui/` component (reuse/extend/create + justification) + tokens + icon ids — format bảng `Element | Component | Decision | Token(s) | Icon`.
4. States hoàn chỉnh: default/hover/focus/pressed/disabled/hidden/empty/error/loading cho từng surface.
5. i18n key naming proposal cho mọi chuỗi mới (`srs.variants.*`, `srs.review.*`).

## 9. Acceptance criteria (design output)

- [ ] Mọi contract front ở S1 đúng spec — không element nào lộ đáp án trên front.
- [ ] Servability/hidden state có representation rõ ràng ở S2/S3/S4.
- [ ] CRUD + search + rename + reset-default + newLoops(1–3) + preview đều có chỗ trong flow.
- [ ] Preset scope (collection default / deck override / share) hiểu được trong 10 giây nhìn.
- [ ] Mọi element map được vào `src/shared/ui/` hoặc có justification `create`.
- [ ] Không hardcode color/spacing; dark theme hoàn chỉnh; touch targets đủ.
- [ ] Derived toggle (scope/audio) persist + chỉ offer option có material; toggle/chip không resize khi label đổi.
- [ ] Editor đúng shape đã duyệt: preview đỉnh → name → field chips → loops → footer `Delete ghost | Save primary`; chỉ `×` đóng dialog; draft-only tới khi Save.
