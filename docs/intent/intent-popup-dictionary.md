# Intent — Popup Dictionary tích hợp Cell

> Confirmed intent via `interview-me` (18 câu). Core feature của hệ thống.
> Reference (chỉ để hiểu nguồn dữ liệu + logic, KHÔNG port tên): `project-reference/theocean-extension-dictionary/`
> Parent intents: `intent-port-theocean-dict-and-theme.md` (dict import), `intent-card-creator.md` (Anki).

## Outcome

Popup dictionary tích hợp Cell — tra từ/cụm từ mọi nơi có text (subtitle overlay + bôi đen/hover text web), hiển thị definition + IPA + frequency + các tab nguyên liệu (audio/image/translate/external dict), tick chọn nguyên liệu + Quick Add hoặc Send to Creator → Anki/Cell Memory. Thay thế hoàn toàn extension tra từ bên thứ ba.

## User

Người học ngôn ngữ qua video (English + Chinese đợt này) trên Chromium desktop/tablet/mobile, RAM 4GB.

## Why now

- Cell đã có `features/dictionary` (import 5 format → IndexedDB) + `features/cardCreator` (AnkiConnect) nhưng chưa wire dict vào lookup.
- Reference pet project đã validate nguồn dữ liệu + logic phrasal/idiom detection + lemmatization + possessive normalization.
- Core value của Cell = tra từ + tạo thẻ trong 1 flow, rút ngắn workflow.

## Success

- Tra cứu ≤1s (trigger → popup hiện).
- Lazy load tab-switch (chỉ fetch nguyên liệu tab ngoài khi user click tab đó; dict/IPA/frequency IndexedDB load ngay).
- Auto-detect cụm/đơn qua dictionary match (cụm dài ưu tiên) + plugin ngôn ngữ bổ trợ (lemmatization, possessive, phrasal/idiom pattern).
- Popup resize + auto-position (tránh overflow màn hình, sticky size).
- 5 word status ở footer popup: unknown → known → tracking → learning → ignore.
- Quick Add 3 mode: manual tick / quick (definition tất cả + nguyên liệu khác lấy item đứng đầu) / hybrid (tick phần thiếu tự lấy top).
- English + Chinese plugin đầy đủ, architecture plugin interface clean cho mở rộng ngôn ngữ khác.
- Không nhắc tên sản phẩm bên thứ ba ("OCEAN", "Yomitan"...) trong codebase/comment/tên biến/docs.
- Default popup tab global sticky (user pin 1 lần, áp dụng mọi popup sau).
- Trigger mode setting: click | hover | hover + modifier (Ctrl/Shift/Alt).

## Nguồn dữ liệu (từ reference)

- **IPA + Definition + Frequency** → IndexedDB đã import (offline, <1s). User tự import dict qua options page (5 format importer có sẵn).
- **Audio target word** → Forvo scrape HTML qua background fetch (parse `#pronunciations-list-*`, decode base64 URL `audio00.forvo.com/mp3/`). Không API key, không trả phí.
- **Audio sentence** → `chrome.tts` native + fallback Google TTS unofficial (`translate.google.com/translate_tts`). Không key.
- **Image** → scrape `google.com/search?tbm=isch` HTML, regex extract `.jpg/.png/.jpeg`, filter `gstatic`/`encrypted`. Không key, không trả phí.
- **Translate** → Google Translate unofficial (Cell đã có pattern cho subtitle translate).
- **External dict** → static link list (URL pattern + `{term}`/`{lang}` placeholder), click mở tab mới. Default Cambridge + Oxford. Không iframe (X-Frame-Options block).

## Constraint

- RAM 4GB (mobile Kiwi + desktop yếu).
- Không trả phí (Forvo scrape, Google Images scrape, Google TTS unofficial, Google Translate unofficial).
- Ponytail: reuse Cell, không thêm dep nếu tránh được. Dictionary-driven segmentation (forward maximum matching, không library ngoài).
- Không nhắc "OCEAN"/"Yomitan" hay sản phẩm bên thứ ba trong code/comment/tên biến. Logic phrasal/idiom/lemma/possessive = nội bộ Cell, tên neutral (`phraseMatcher`, `lemmaResolver`, `possessiveNormalizer`).
- Plugin interface per-language: English + Chinese implement đầu, ngôn ngữ khác architecture sẵn sàng chưa implement.
- Dict data user tự import (không bundle, bundle size + license). Plugin lo logic ngôn ngữ, dict lo content.
- `preferredAccent` per-language config (không hardcode US/UK) — mỗi ngôn ngữ define danh sách accent/voice riêng.
- 13 điểm redesign (xem dưới) = design principles xuyên suốt, không phải checklist implement 1 lần.
- Thuật toán segmentation + lookup phải verify ≤1s ở phase spec/prototype (benchmark dict ~120k entries CEDICT + ~100k Cambridge trên RAM 4GB; IndexedDB index + in-memory LRU cache + Web Worker off-main-thread).

## 13 design principles (từ interview — áp dụng xuyên suốt)

1. Dictionary luôn luôn hiện (không phải tab, là phần core ảnh #1).
2. Tab: audio, image, translate, dictionary external.
3. Popup dictionary: bỏ inflections, bỏ MATERIALS TO INCLUDE, bỏ SENTENCE CONTEXT trong tab dictionary.
4. Tab image redesign (tham chiếu #1, #3).
5. Popup dictionary: bỏ nút X (thoát), thay bằng nút Quick Add.
6. Tab translate redesign theo bố cục #7.
7. Mỗi definition có thể tick chọn để add vào SRS (gửi tới fields quy định).
8. Quick Add thay bằng SVG.
9. SRS lựa chọn Anki | Cell Memory, set default tab trong setting Card Creator.
10. Mọi tab/nút thiết kế SVG (tiết kiệm không gian, không chói mắt), button style tham chiếu #9.
11. Popup resize function + auto-position (biên trái/phải/trên/dưới) + icon resize.
12. Status unknown → know → tracking → learning (khi add thẻ + đang học) — ở footer popup dictionary. Phát triển scheduler sau, UI sẵn sàng.
13. Card Creator layout: header title "Card Creator" + settings/close, subheader card type + deck, large preview card (target word + sentence), field cards with action + clear, media cards with ADD/SEARCH, footer CLEAR FIELDS + CREATE CARD.

## Out of scope

- Click từ trong sentence để tra tiếp (chưa phát triển đợt này).
- SRS scheduler engine Cell Memory (chỉ status store đợt này, architecture forward-compatible cho SM-2 hoặc tương tự sau).
- Redesign full card creator (restyle theo 13 điểm, không rebuild logic).
- Plugin ngôn ngữ ngoài English/Chinese (architecture sẵn sàng, chưa implement).
- Thuật toán auto-detect cụm/đơn chi tiết (bàn riêng ở phase spec sau khi đọc dict data thực).
- `preferredAccent` hardcode (per-language config thay vì).
- Scan toàn trang tự động (hover mọi text) — trigger chủ động (hover subtitle overlay hoặc bôi đen + phím) tránh popup nhảy lung tung + nặng RAM.

## Open questions (bàn ở phase spec)

- Thuật toán auto-detect cụm/đơn chi tiết — cần tham chiếu dict data thực (Cambridge/Eng-Vi/CEDICT entry structure) để thiết kế match strategy. Nguyên tắc tạm: dictionary là source of truth, cụm dài ưu tiên, plugin ngôn ngữ bổ trợ.
- Thuật toán segmentation + lookup ≤1s — benchmark + index strategy + cache + Web Worker.
- Priority rule "item đứng đầu" per-language (audio accent/voice, image, translate, definition order) — per-language config, English + Chinese define đầu.

## Mockup

yes — tạo mockup trước spec (popup dictionary mới + card creator restyle), dùng design system tokens Cell + 13 design principles + `docs/mockups/anki-card-mockup.html` cho card creator. Anh review trực tiếp khi implement (không gửi được ảnh tham chiếu #1–#9).

## Next

- Mockup via `design-driven-development` skill → popup dictionary mockup + card creator restyle mockup.
- Spec via `spec-driven-development` (cite mockup).
- Plan via `planning-and-task-breakdown`.
- ADR cho plugin interface architecture + dictionary-driven segmentation.
