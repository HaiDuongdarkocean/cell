---
name: audit-text-in-ui
description: Audit and rewrite user-visible text in Cell UI surfaces (buttons, labels, errors, empty states, tooltips, headings, aria-labels, placeholders) against the education copy standard, then route every string into MV3 i18n (chrome.i18n + _locales/messages.json) instead of inline literals. Use when reviewing or rewriting screen text, preparing a surface for localization, or when asked "is this text correct?". Not for token/CSS audits (design-system-guardian), pre-build design gates (education-ui-principles), or non-UI logic.
---

# Audit Text in UI — audit + rewrite chữ trên màn hình, chuẩn i18n

> **Chữ trong UI là một phần của bài học, không phải đồ trang trí.**
> Cell phục vụ người học ngoại ngữ 5→80 tuổi: người dùng đang tốn sức giải mã ngôn ngữ — UI copy không được phép thành từ vựng ngoài chương trình.

Skill này trả lời 2 câu hỏi cho mọi chuỗi text trên màn hình:
1. **Viết đúng chuẩn chưa?** (clarity, tone giáo dục, bề mặt)
2. **Nằm đúng chỗ chưa?** (i18n — không hardcode literal)

**Nếu repo chưa có hạ tầng i18n, skill này PHẢI bootstrap rồi migrate — không được chỉ flag rồi dừng.** Cell hỗ trợ 2 locale: `en` (default) và `vi`.

## When to Use

- Audit text của một màn/component/panel: "check chữ", "audit text", "viết lại copy".
- Rewrite UI text cho đúng chuẩn trước khi ship.
- Chuẩn bị một surface để localize (Việt/Anh/…).
- Thêm chữ mới vào UI và muốn đặt đúng ngay từ đầu.

## When NOT to Use

- Audit token/CSS/component → `design-system-guardian`.
- Gate nguyên tắc trước khi build UI → `education-ui-principles`.
- Nội dung bài học / từ điển / phụ đề (content người học đọc, không phải chrome UI).
- String không render ra màn hình (log, error nội bộ không user-facing).

## Chuẩn copy — 4 nhóm luật

Nguồn: NN/g (3 C's, copy sizes), Microsoft Writing Style, Material Content Design, GOV.UK Service Manual, Apple Style Guide, WCAG 2.2 §3.1 Readable.

### Nhóm W — nền (mọi chuỗi)

| # | Luật | Câu hỏi check |
|---|---|---|
| W1 | **Clarity > Concision > Character** — đúng thứ tự | Lướt 3 giây hiểu hành động/kết quả không? |
| W2 | **Frontload** — từ quan trọng đứng đầu | Cắt nửa sau, ý chính còn không? |
| W3 | **Active voice, ngôi thứ 2**, không "hệ thống/chúng tôi" | Có bị động? |
| W4 | **1 ý / câu; microcopy <3 câu** | Câu nào 2 ý → tách |
| W5 | **Plain language ≤ trình THCS**; không jargon, không viết tắt Latin (e.g./etc.); thuật ngữ bắt buộc phải giải thích lần đầu | Trẻ 10 tuổi hiểu không? |
| W6 | **1 khái niệm = 1 từ, toàn app** | Cùng thứ 2 tên → fail |
| W7 | **Scan được** — heading mô tả (không phải câu hỏi), bullet thay đoạn | Đọc riêng heading hiểu cấu trúc? |
| W8 | **Không dùng chữ vá UI** — "click to…", "nhấn vào đây" = design bug | Copy đang giải thích cách dùng → báo UI bug, không viết dài hơn |
| W9 | **Label nói ý nghĩa tính năng, không nói ID/tên nội bộ** | Người dùng đọc label có biết hệ thống sẽ làm gì không? |

### Nhóm S — theo bề mặt

| Bề mặt | Luật | Sai → Đúng |
|---|---|---|
| Button | Verb + outcome; cấm OK/Submit trần; không "ngay" | `Lưu` → `Lưu thẻ` |
| Error | Xảy ra gì + cách sửa; không đổ lỗi; "xin lỗi" chỉ khi sự cố nặng | `Error!` → `Chưa tra được từ. Thử lại sau ít giây.` |
| Empty state | Vì sao trống + bước tiếp theo | `Trống` → `Chưa có ảnh. Thử từ khác.` |
| Label vs placeholder | Placeholder không bao giờ thay label | input chỉ có placeholder → thêm label/aria |
| Heading | Mô tả, frontload, động từ khi là tác vụ | `Giới thiệu` → `Ôn tập hôm nay` |
| Tooltip/title | Không lặp lại label; chỉ thêm info mới | title=`Lưu` trên nút `Lưu` → xóa |
| Link | Mang information scent | `Bấm đây` → `Xem lịch sử tra` |
| aria-label | Ngắn, định danh control — không dồn cả nội dung | `aria-label="Select definition: <cả câu dài>"` → nhãn ngắn + `aria-describedby` |

### Nhóm E — lớp giáo dục (đặc thù Cell)

| # | Luật |
|---|---|
| E1 | **UI copy dễ hơn bài học** — người học không được tốn sức vào chrome |
| E2 | **Lỗi = bình tĩnh + mời thử lại** — không phán xét, không "sai rồi!" |
| E3 | **1 màn = 1 chỉ dẫn** — chồng instruction = không instruction |
| E4 | **Calm, không trẻ con hóa, không hàn lâm** — đọc được bởi trẻ 5, tôn trọng người 80 |
| E5 | **Thuật ngữ UI ≠ từ vựng bài học** — app dạy từ vựng, tránh từ gây nhiễu nghĩa |
| E6 | **Tiến độ viết tường minh** — "Còn 3 thẻ" thắng icon mơ hồ |

### Nhóm L — i18n (blocking)

**Kiến trúc SSOT của repo:** messages là `src/shared/i18n/messages/{en,vi}.json` (JSON import — chạy được trong mọi context: React, content script, Shadow DOM, showcase page, jest); `t()` là `@/shared/i18n`. `public/_locales/{en,vi}/messages.json` + `default_locale` trong manifest chỉ lo chuỗi cấp manifest (`__MSG_*__`), không phải UI copy — `chrome.i18n.getMessage` không tồn tại ngoài extension context nên không làm SSOT được.

| # | Luật | Cơ chế |
|---|---|---|
| L0 | **Chưa có i18n → bootstrap + migrate, không chỉ flag** | Tạo `src/shared/i18n/` (index `t()`, `messages/en.json`, `messages/vi.json`) + `public/_locales/{en,vi}/messages.json` + `"default_locale": "en"` trong manifest |
| L1 | **Mọi chuỗi user-visible phải qua `t(key)`** — cấm literal mới trong `.tsx`/`.ts` | `import { t } from '@/shared/i18n'` |
| L2 | **Không nối chuỗi** — câu có biến dùng placeholder `$1`/`$2` | `t('dict.audio.play', [name])`; cấm `'Play ' + x` |
| L3 | **Hai locale bắt buộc: `en` (default) + `vi`** — mọi key mới phải có đủ 2 bản; vi copy: plain, ngắn, xưng hô "bạn", calm | `t()` resolve `vi` khi `getUILanguage()`/`navigator.language` bắt đầu `vi`, ngược lại `en`; key thiếu → fallback `en` |
| L4 | **Key naming** `<domain>.<surface>.<element>` — phản ánh bề mặt, không phản ánh nội dung | `dict.search.placeholder`, `dict.error.lookup` |
| L5 | **Cùng ý = cùng key** — không clone message cho từng file | Grep `messages/en.json` trước khi thêm key |
| L6 | **Error code nội bộ không được trôi ra UI** — map tại boundary sang copy thân thiện | `'worker-not-hydrated'` → `t('dict.error.lookup')` + `console.warn` raw |

## Hỏi trước khi rewrite

> **Một rewrite tốt bắt đầu bằng câu hỏi đúng, không phải cảm tính ngôn từ.**

Khi chuẩn bị viết lại một chuỗi, hãy chạy 16 câu hỏi này. Câu nào trả lời "chưa" hoặc "không" → đó chính là lỗi cần sửa.

| # | Câu hỏi | Luật | Khi nào đặc biệt chú ý |
|---|---------|------|------------------------|
| 1 | Người dùng hiểu hành động/kết quả sau 3 giây không? | W1 | Button, heading, error |
| 2 | Từ quan trọng nhất đã đứng đầu chưa? | W2 | Heading, description, error |
| 3 | Câu đang dùng chủ động (active voice) hay bị động? | W3 | Tooltip, description, error |
| 4 | Có ghép 2 ý vào cùng một chuỗi không? | W4 | Description, empty state |
| 5 | Trẻ 10 tuổi đọc được không? Jargon đã giải thích chưa? | W5 | Tất cả, đặc biệt setting/feature name |
| 6 | Cùng khái niệm đang được gọi bằng 2 từ khác nhau không? | W6 | Cross-file, cross-card |
| 7 | Có thể scan qua heading/bullet mà vẫn hiểu cấu trúc không? | W7 | Card title, group label, section |
| 8 | Chuỗi có đang "vá" lỗi UI ("click to…", "nhấn vào đây") không? | W8 | Button, link, tooltip |
| 9 | Label đang mô tả tác vụ/kết quả, không phải feature? | S Label | Label hành động, nhóm |
| 10 | Button có bắt đầu bằng động từ và kết quả rõ không? | S Button | Commit button |
| 11 | Error có nói nguyên nhân + cách sửa, không đổ lỗi không? | S Error | Toast, alert, inline error |
| 12 | Placeholder có thay label không? | S Label | Input, search field |
| 13 | Tooltip có thêm thông tin mới, không lặp label không? | S Tooltip | Icon-only button, dot, badge |
| 14 | Copy có bình tĩnh, không phán xét, phù hợp 5→80 tuổi không? | E2/E4 | Error, empty state, warning |
| 15 | Đã qua `t(key)` và có đủ `en` + `vi` chưa? | L1/L3 | Mọi chuỗi ship |
|| 16 | Đã trace code để biết tính năng này thực sự làm gì chưa? | W9 | Label hành động, nhóm, feature name |

**Nguồn bổ sung để hỏi sâu hơn:**
- `/inquiry-creativity` — khi cần 5W1H, first-principles, hoặc trade-off matrix trước khi quyết định rewrite.
- `/education-ui-principles` — khi cần gate persona 5→80, cognitive load, calm tone trước khi build UI.
- Microsoft Writing Style, Material Content Design, GOV.UK Service Manual, Apple Style Guide — cho các quyết định ngôn ngữ Anh.

## Workflow

### Step 1 — Extract

**Mục tiêu:** liệt kê toàn bộ chuỗi user-visible của surface.

**Actions:**
1. Xác định scope (file/thư mục). Không rõ → hỏi.
2. Grep pattern: `aria-label=|title=|placeholder=|alt=|label:|title:|description=|>[A-Za-zÀ-ỹ]` trong `*.tsx` của scope; thêm string literal trong `.ts` controller nếu nó bubble ra UI (vd `panel.error`).
3. Bỏ qua: `*.test.*`, `*.showcase.tsx` (demo copy — ghi "out of scope"), className, data-cell-id, key nội bộ.

**Guard:** Có bảng `file:line → chuỗi → loại`. Thiếu nguồn string nào (vd error text phát sinh ở hook) → grep ngược theo prop.

### Step 2 — Classify

**Mục tiêu:** mỗi chuỗi gán đúng 1 bề mặt của nhóm S.

**Guard:** Cùng 1 câu, sai trên button có thể đúng trên tooltip — không classify → không rewrite.

### Step 3 — Check

**Mục tiêu:** chấm từng chuỗi theo W + S + E + L.

**Actions:** với mỗi dòng, ghi `PASS` hoặc `FAIL(<mã luật>)`. L1 fail ⇒ chuỗi đó fail tổng.

**Guard:** Mọi FAIL chỉ rõ mã luật — không chấm cảm tính.

### Step 4 — Rewrite

**Mục tiêu:** đề xuất chuỗi mới + key.

**Actions:**
1. Trace code: tìm handler/consumer của action/prop để hiểu tính năng thực sự làm gì (không chỉ dịch từ tên `action` hoặc từ tiếng Anh).
2. Chạy 16 câu hỏi trong mục **Hỏi trước khi rewrite**. Nếu trả lời được ngay → rewrite. Nếu không → invoke `/inquiry-creativity` hoặc `/education-ui-principles`.
3. Viết đề xuất vào dòng output.
4. Đặt message key theo L4.

**Output per dòng:** `file:line | surface | hiện tại | FAIL(mã) | đề xuất | message key`.

**Ví dụ rewrite thường gặp:**

| Sai | Đúng | Luật | Lý do |
|-----|------|------|-------|
| `Toggle overlay` | `Show/hide subtitles` | W5/W9 | `Overlay` là jargon; người dùng chỉ thấy phụ đề trên video. |
| `Toggle panel` | `Show/hide subtitle list` | W5/W9 | `Panel` không nói đó là danh sách câu phụ đề. |
| `Toggle player mode` | `Full-screen viewing mode` | W5/W9 | `Player mode` là tên nội bộ; cần nói rõ chế độ xem rộng. |
| `Generate native subtitle` | `Translate to native language` | W5/W9 | `Native` mơ hồ; thực chất là dịch sang ngôn ngữ gốc. |
| `Card Creator: Quick update` | `Quick add words` | W4/W6/W9 | `Update` sai nghĩa; thực chất là thêm từ mới nhanh. |
| `Play / pause video` | `Play/pause video` | W1 | Bỏ khoảng trắng thừa, gọn hơn. |
| `This key is already used by another action` | `Another shortcut uses this key.` | W3/W6 | Active voice + nhất quán thuật ngữ `shortcut`. |
| `Remap keys for subtitle panel navigation actions` | `Set keys for subtitles, video, and flashcards.` | W2/W5/W9 | Frontload động từ + mô tả đúng phạm vi. |

**Guard:** Rewrite phải sửa đúng luật bị fail — fail W5 thì đơn giản hóa, không được chỉ đổi casing.

### Step 5 — Localize (khi được duyệt rewrite)

**Actions:**
1. Nếu `src/shared/i18n/` chưa có → bootstrap theo L0 (helper `t()` + `en.json` + `vi.json` + `_locales` + `default_locale`).
2. Thêm key vào **cả** `messages/en.json` và `messages/vi.json` theo naming L4, placeholder L2 — thiếu `vi` sẽ bị typecheck bắt.
3. Thay literal bằng `t(key)`; aria/title/placeholder/alt cũng qua `t()`.
4. Manifest: `"default_locale": "en"` + `__MSG_*__` cho name/description. Theo `AGENTS.md`: sau khi sửa manifest phải load extension trong Chrome thật (skill `testing-extension-browser`).

**Guard:** `npm run build` pass, `dist/_locales/` tồn tại, `npm run typecheck` không lỗi key. Không thêm dependency i18n (react-i18next…) — JSON + `t()` thuần đã đủ.

### Step 6 — Verify

1. Pass nhất quán (W6): grep từ đồng nghĩa — cùng khái niệm phải cùng key/cùng từ.
2. `npm run typecheck` + `npm run build`.
3. Mở Chrome thật (skill `testing-extension-browser`): đọc lại text trên màn hình, kiểm truncate ở viewport 320px.

## Output template

```markdown
## Copy Audit — [surface]

| # | file:line | Bề mặt | Hiện tại | Verdict | Đề xuất | Key |
|---|-----------|--------|----------|---------|---------|-----|

### Tổng kết
- Literal cần đưa vào i18n: N
- Vi phạm blocking (L*, W1/W5, E2): N
- Verdict: PASS / REWRITE / NEEDS I18N INFRA
```

## Anti-patterns

| Không được | Tại sao | Làm thay |
|---|---|---|
| Rewrite rồi để literal trong tsx | Sửa copy nhưng không i18n → nợ vẫn còn | L1: mọi rewrite đi kèm key |
| `'Nhãn: ' + value` | Không dịch được, sai thứ tự từ theo ngôn ngữ | Placeholder `$1` (L2) |
| aria-label chứa cả câu nội dung | Screen reader đọc 1 lèo, mất điểm dừng | Nhãn ngắn + `aria-describedby` |
| Thêm dependency i18n (react-i18next…) | Dependency mới, phức tạp không cần | `t()` + JSON SSOT (L0–L3) |
| Dùng `chrome.i18n.getMessage` cho UI copy | Không tồn tại ngoài extension context → showcase/jest chết | `t()` resolve từ JSON import |
| Audit riêng từng file rồi dừng | W6 (nhất quán thuật ngữ) chỉ thấy khi nhìn cross-file | Step 6 consistency pass |
| Viết lại copy trong showcase/test | Demo copy không ship | Out of scope, ghi chú thôi |
| Nhóm heading chỉ là động từ chung (Toggle / Generate / Navigation) | Không nói *vùng miền* của các action | Dùng danh từ miền: `Display`, `Translation`, `Playback`, `Flashcards` |
| Dịch từ tiếng Anh mà không trace code | Tên `action` / ID thường gây nhầm | Trace handler → viết theo hành động thực sự xảy ra |

## Common rationalizations

| Nói | Trả lời |
|---|---|
| "App chỉ có tiếng Anh, i18n sau" | Persona 5→80 Việt học ngoại ngữ — i18n là khi nào, không phải có hay không. Giá phải trả tăng theo số literal. |
| "String này nội bộ thôi" | Nếu nó render ra màn hình → user-visible → L1. |
| "Sửa từng từ khi cần" | Không chuẩn = mỗi lần sửa một văn phong → app nói nhiều giọng. Audit theo surface. |
| "TTS/Card Creator ai cũng hiểu" | Trẻ 10 tuổi không hiểu. Giải thích hoặc đổi từ (W5). |
| "Cứ dịch từ tiếng Anh sang tiếng Việt là đủ" | Tiếng Anh cũng có thể là jargon. Mọi locale đều cần viết theo ý nghĩa (W9). |
| "Tên nội bộ/ID là tên đúng" | Tên nội bộ dành cho dev, không phải người dùng. Label phải diễn đạt hành động. |

## Verification checklist

- [ ] Bảng extract đầy đủ (không sót error text từ hook/controller).
- [ ] Mọi dòng FAIL có mã luật.
- [ ] 16 câu hỏi trong mục **Hỏi trước khi rewrite** đã được chạy trước khi viết đề xuất.
- [ ] Đã trace code của từng action/feature trước khi viết lại label.
- [ ] Mọi rewrite kèm message key đúng naming.
- [ ] Không literal user-visible mới trong `.tsx` sau sửa (grep verify).
- [ ] `dist/_locales/` tồn tại sau build.
- [ ] Mọi locale (en + vi) được viết theo ý nghĩa tính năng, không chỉ dịch từ tiếng Anh.
- [ ] Consistency pass W6 chạy cross-file.
- [ ] Đọc lại trên Chrome thật, viewport 320px.

## Router boomerang

- Audit token/CSS/component → `design-system-guardian`.
- Gate nguyên tắc trước khi build UI → `education-ui-principles`.
- Cần đặt câu hỏi sắc, first-principles, hoặc trade-off trước khi rewrite → `inquiry-creativity`.
- Verify trên browser thật → `testing-extension-browser`.
- Không rõ skill → `using-agent-skills`.
