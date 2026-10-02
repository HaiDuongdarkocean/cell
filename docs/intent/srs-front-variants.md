# Intent: SRS variants — biến thể học thành entity user tự quản + guard theo front materials

> Slug: `srs-front-variants` · Mode: interactive · Source: user statement (2026-10-02, screenshot `quetta_D38QBkyvLA.png` + 2 vòng mở rộng scope)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | (a) Front card hiện tại leak đáp án / tự trả lời thay learner — sound autoplay audio, meaning hiện sẵn targetWord, spelling cho "chép" từ đang hiển thị; (b) 3 biến thể hardcode, learner không tự định nghĩa được cách mình muốn recall (front hiện gì, back hiện gì, tên gọi, card mới lặp mấy vòng); (c) nhu cầu chia sẻ/khác biệt cấu hình giữa các deck (2 deck chung cơ chế, 1 deck khác) → cần preset. | `SrsReviewCardFront.tsx:189-191` render `note.targetWord`+`sentence` raw mọi component; `:151-164` autoplay front; `ComponentType` enum cố định `types.ts:11`; user statement 2 lượt | high |
| Change | ComponentType cố định → **Variant entity** user quản (CRUD + search + rename + preset scope collection/deck + preview trong editor). Mỗi variant = 1 memory component riêng trên card (progress + FSRS riêng). Front variant = danh sách nguyên liệu khai báo; thiếu nguyên liệu → variant disabled cho note đó ("căn cứ vào front"). 3 builtin = variant mặc định với contract mới: sound=text-only, meaning=image-only, spelling=dictation audio+input (2 mode persist). | User answers: "Component riêng", "số lần variant hiện khi card mới", "chọn 1 [full CRUD] + nút reset default", "per collection + per deck… cần preset" | high |
| Solution | Domain mới: `SrsVariant` (name, front spec, back spec, newLoops) gom trong `SrsVariantPreset` (collection default, deck override/share). `card.components` keyed theo variantId (builtin id giữ `'sound'|'meaning'|'spelling'` → không migration data cũ). Scheduler + learning path + maintenance đọc preset của deck để biết card có những variant nào; guard servability tính từ front spec của variant vs `note.fields`. | User statement "tất cả phải căn cứ vào front" + preset answer | high |
| Value | Mỗi lần chạm thẻ = retrieval effort thật đúng kỹ năng variant đó đo; learner tự thiết kế cách học (vd variant riêng "nghe câu → gõ câu" cho advanced) mà không đổi deck; preset chia sẻ cấu hình giữa decks. | User statement về context recall + deck sharing edge case | high |
| Stakeholder | Người học ngoại ngữ trên Cell (5–80, desktop/tablet/Android); Anh = product owner quyết pedagogy. | spec gốc §User | high |
| Context | Offline-first IndexedDB `cell-srs-*`; một system notetype duy nhất (Anki import normalize về `createDefaultNotetype` — `importWriter.ts:220-224`); settings hiện có tab General/Customize (`SrsStudySettings.tsx`); `srsUiPrefs` localStorage persist được pref. | `docs/specs/ocean-language-acquisition-srs.md` §Constraints | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Devin + future agents | Model variant rõ ràng, SSOT ở 1 chỗ; builtin ids giữ nguyên để khỏi migrate review history cũ | Card schema `components: Record<ComponentType,…>` → `Record<variantId,…>` — compat nếu builtin giữ id cũ |
| Customer | Learner 5–80 | Front không lộ đáp án; tự quản variant; preset share giữa decks; preview trước khi lưu | <3s response, a11y, i18n, RAM ≥1GB persona |
| Supplier/Dependency | IndexedDB `cell-srs-*`, ts-fsrs adapter (opaque state per component), sync merge policies | components keyed string → merge policy + stats + deck detail phải theo; FSRS state per variant vẫn opaque | `sync/domain/merge/policies.ts`, `getSrsStats`, `SrsDeckDetail` đều iterate components |
| Organization | Anh — owner pedagogy + Cell product | Pedagogy mặc định đúng (3 variant builtin = contract đã chốt) nhưng user toàn quyền chỉnh | none |
| Regulator | none | none | none |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Sound front text-only: term + sentence, không audio element/autoplay — audio chỉ verify ở back | F/U | User "Chỉ term + sentence"; back autoplay `SrsReviewCardBack.tsx:151-160` | high |
| N2 | Meaning front image-only; thiếu image → variant ẩn khỏi learning path của note đó | F/U | User "Ẩn hẳn khỏi learning path" | high |
| N3 | Spelling front = audio + input dictation; 2 mode word/sentence; mode persist cross-card | F/U | User "Nghe từ / nghe câu → gõ tương ứng", "lưu lại sang thẻ khác" | high |
| N4 | Front không leak đáp án component đang test | U | lỗi hiện tại spelling hiện `targetWord` | high |
| N5 | Variant disable khi front thiếu nguyên liệu — guard tính từ front spec, áp cho MỌI variant (kể cả custom), không throw post-pick, không fallback | F/R | User "front biến thể mà không có nguyên liệu thì bị disable… tất cả phải căn cứ vào front"; `selectNextReview.ts:109-112` throw hiện tại | high |
| N6 | Per-mode gating spelling: thiếu `wordAudio` → chỉ sentence; thiếu `sentAudio` → chỉ word; thiếu cả hai → disabled; pref degrade sang mode serve được | F | User statement per-mode gating | high |
| N7 | Sound servable khi ≥1 trong {term, sentence} có; audio không phải nguyên liệu front | F | User "cả hai không có thì disable — cơ chế kiểm tra front" | high |
| N8 | Variant CRUD + tìm kiếm trong màn quản lý: list, search, add, rename, edit, delete | F/U | User "quản lý biến thể crud thêm, sửa, xóa, update, tìm kiếm, sửa tên" | high |
| N9 | Variant editor: đặt tên → setup front hiển thị field nào → setup back hiển thị field nào | F/U | User "thêm tên → setup front, back hiển thị gì" | high |
| N10 | Per-variant "vòng lặp lúc mới học" = số lần variant đó phải pass khi card mới (explore), input range 1–3 (Anh thấy hiện ~4 vòng/tổng; builtin default 1) | F | User "số lần variant hiện khi card mới… chỉ recommend 1-3" | high |
| N11 | Variant preset: collection có default preset; deck override preset riêng hoặc share preset với deck khác (edge: 3 decks, 2 share 1 preset, 1 preset khác) | F | User "per collection + per deck… cần các preset để dùng" | high |
| N12 | Variant editor có preview front/back của card (sample note) trong khi chỉnh | F/U | User "trong khi setting cũng có thể xem preview của biến thể flashcard" | high |
| N13 | Card có N memory component = N variant của preset đang áp; builtin 3 giữ id `sound`/`meaning`/`spelling` (không migrate history); variant custom có id riêng, FSRS state riêng | F/infra | User "Component riêng — hiện như component thứ 4+"; `SrsCard.components` hiện `Record<ComponentType,…>` | high |
| N14 | Builtin full CRUD (rename/edit front/back/delete) + nút "reset default" khôi phục bộ 3 gốc | F | User "chọn 1 [full CRUD] và có nút reset default" | high |

## Scope

- **In:** domain `SrsVariant`/`SrsVariantPreset` + repositories; card components keyed variantId; scheduler + learning path + maintenance theo preset + servability guard; 3 builtin variant với contract mới (N1–N3); spelling mode toggle + pref; variant management UI (list/search/CRUD/preset assign per deck) + editor preview; per-variant newLoops; reset-default; i18n; unit tests.
- **Out:** đổi FSRS formula/progress gain; back face layout mặc định (back vẫn full-fields khi variant không custom back? — spec quyết: back spec có default "all fields"); Anki/FSRS import mapping sang variant khác ngoài 3 builtin (import map vào builtin ids); notetype field editor.
- **Non-goals:** component nhúng AI/pronunciation scoring; partial credit input; variant marketplace/share giữa users; migration dữ liệu card cũ sang variant custom (builtin id giữ nguyên nên không cần).

## Workflow

Anh vào SRS settings → tab quản lý variant: list các variant trong preset (search box lọc theo tên), add → form (tên → front fields → back fields → newLoops 1-3) kèm preview live → save. Deck detail/setting chọn preset áp cho deck (mặc định kế thừa collection). Khi học: scheduler đọc preset của deck → mỗi card có component per variant → variant nào thiếu nguyên liệu front trên note hiện tại bị loại khỏi candidate → pick → render front theo spec của variant → flip → back → grade → FSRS component riêng update. Card mới: variant phải được pass `newLoops` lần (explore) trước khi vào schedule thường.

## Journey

### AS-IS
1. Learner mở study; sound card autoplay audio + hiện nút speaker — nghe đáp án trước khi recall.
2. Meaning/spelling card hiện sẵn `targetWord` + `sentence` raw — spelling thành "chép bài"; `maskTarget` dead code do `FRONT_SKIP_FIELDS`.
3. Component set cố định 3 (`sound|meaning|spelling`); learner không đổi được front/back; `frontTemplates` trên notetype không có UI author.
4. Card mới explore mỗi component `minExplores` lần (global, settings `graduatePasses` 1/2/3/5); tổng cảm giác ~4 vòng.
5. Note không ảnh vẫn nhận meaning review qua def/sentence fallback; surface fail post-pick → throw `NO_TEMPLATE`.

### TO-BE
1. Study: sound front chỉ term+sentence → đoán phát âm+nghĩa → flip nghe audio verify; meaning chỉ ảnh → nhớ từ theo hoàn cảnh; spelling nghe audio → gõ (word hoặc cả câu theo mode persist).
2. Mọi variant (builtin + custom) chỉ vào candidate khi note có đủ nguyên liệu front của spec nó; thiếu → disable êm, không throw, không chặn stage sau, không chặn maintenance.
3. Settings → Variants: search/list/add/rename/edit/delete variant; editor có preview card front+back; nút reset default khôi phục bộ 3.
4. Variant mới thêm vào preset → các card trong deck áp preset đó có thêm component riêng (progress/FSRS mới); variant bị xóa → component data cũ giữ nguyên nhưng không schedule.
5. Deck A,B share preset X; deck C preset Y → card cùng note-khác-deck học theo variant set riêng; đổi preset deck → components của card re-derive theo preset mới (giữ state của variant trùng id).
6. Card mới: mỗi variant phải pass `newLoops` (1–3) lần explore trước khi FSRS schedule — per-variant chứ không global.

## Stories

- S1: Learner muốn front sound chỉ là chữ để tự đoán phát âm+nghĩa — done khi front sound không còn audio.
- S2: Learner muốn front meaning chỉ là ảnh để nhớ từ qua hoàn cảnh — done khi image-only + no-image thì không schedule.
- S3: Learner muốn luyện dictation theo trình độ — done khi spelling nghe-gõ word/sentence, pref persist.
- S4: Learner muốn tự định nghĩa cách recall (vd "nghe câu → viết câu", "nhìn nghĩa → nhớ từ") — done khi tạo được variant mới với front/back/loops tự chọn, preview được, và nó xuất hiện như component riêng khi học.
- S5: Learner muốn deck khác nhau học kiểu khác nhau mà vẫn share được cấu hình — done khi preset gán per-deck và nhiều deck dùng chung 1 preset.
- S6: Learner muốn card không bao giờ hiện khi thiếu nguyên liệu front — done khi guard loại variant khỏi candidate trước pick.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| `components` keyed string: review history cũ + merge policy + stats phải không vỡ | internal | Giữ builtin ids cố định → history/merge đọc được; audit mọi chỗ iterate `ComponentType` | grep `ComponentType` + schema `Record<string,…>` |
| Preset đổi khi card đã có components → component mồ côi / thiếu component mới | internal | recalcCard reconcile: thiếu → init empty; thừa → giữ data, không schedule | 1 chỗ reconcile |
| Variant front spec tham chiếu field note không có → servability tự loại — đúng rule N5; nhưng variant "chỉ toàn field lạ" sẽ không bao giờ hiện | operational | Preview + editor validate cảnh báo | Field picker chỉ cho chọn field của system notetype + đã có trên notes |
| Scope lớn → deliver cần chia lanes (domain/scheduler, UI review card, settings CRUD) | internal | Chấp nhận — deliver dùng autonomous-pipeline lanes | planning-and-task-breakdown |
| Back spec default khi user không custom: "tất cả field" hay giữ back hiện tại? | internal | Spec quyết (lean: back spec mặc định = back hiện hữu full-fields) | SPECIFY |
| User xóa variant builtin rồi muốn lại → reset default khôi phục preset về bộ 3 gốc (ghi đè custom? — spec quyết: reset chỉ restore builtin, giữ custom, confirm dialog nói rõ) | human | Tránh mất custom variant vô tình | SPECIFY + dialog confirm |

## Decision

go — scope lớn nhưng coherent: variant entity là dạng tổng quát của chính fix ban đầu (guard theo front materials áp uniform); builtin giữ id → không cần data migration; mọi quyết định mở đã được owner chốt qua interactive.

## Draft Acceptance Criteria

- [ ] 3 variant builtin front đúng contract (sound=text-only; meaning=image-only; spelling=audio+input) — kèm per-mode degrade + persist pref.
- [ ] Variant thiếu nguyên liệu front không vào candidate; không `NO_TEMPLATE`; không chặn explore/maintenance của variant khác.
- [ ] Settings có màn quản lý variant: list + search + add + rename + edit + delete + preview front/back + reset default.
- [ ] Variant editor setup front fields + back fields + newLoops (1–3).
- [ ] Preset: collection default + deck override; 2 deck share 1 preset được; đổi preset reconcile components.
- [ ] Card với preset có N variant → N component riêng (progress + FSRS + schedule riêng); card mới pass variant `newLoops` lần trước khi schedule.
- [ ] Custom variant sau khi tạo xuất hiện trong session học đúng front spec khai báo.
- [ ] Review history/merge/sync không vỡ với components keyed variantId.
