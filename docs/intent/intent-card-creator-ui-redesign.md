# Intent — Card Creator UI redesign

> Redesign the Card Creator dialog/bottom sheet UI for a cleaner, more minimalist layout with a Yomitan-scanable preview block and improved media management.
> Parent intent: `docs/intent/intent-card-creator.md`
> Mockup (approved, must match): `docs/mockups/anki-card-mockup.html`

## Outcome

Card Creator UI được thiết kế lại gọn gàng, phân cấp thị giác rõ ràng hơn, với một vùng preview dùng Yomitan scan trực tiếp và quản lý media (image/audio) dễ dàng hơn qua drag-and-drop, reorder, add/remove.

## User

Người học ngôn ngữ qua video dùng Cell để tạo/cập nhật thẻ Anki, thường kết hợp với Yomitan để tra từ trong target word/sentence.

## Why now

- UI hiện tại còn dày đặc, field mapping selector chiếm nhiều sự chú ý, media list chưa phân biệt rõ image/audio.
- User muốn tra từ bằng Yomitan ngay trong Card Creator nhưng textarea/input trong overlay dialog bị Yomitan scan không ổn định → cần vùng preview text thuần để Yomitan scan.
- Preview block cũng mở đường cho tính năng tương lai: hiển thị IPA/reading/furigana trên target word.

## Success

- UI khớp y hệt mockup `docs/mockups/anki-card-mockup.html` (preview block, media layout, selector label-style, responsive mobile/desktop).
- Preview block hiển thị target word + sentence, realtime sync, target word in đậm, sentence in đậm tất cả lần xuất hiện target word.
- Image media: hiển thị dạng slide ngang, thumbnail cố định ~120px, xóa góc trên phải, hỗ trợ D&D và reorder.
- Audio media: hiển thị dạng list dọc, waveform icon, tên file, xóa, hỗ trợ D&D và reorder.
- Field mapping selector: nhãn text mỏng, không `→`, không background/viền, chỉ mũi tên nhỏ, width fit-content, active đổi màu chữ.
- Không làm hỏng logic Card Creator hiện có (AnkiConnect, media capture, draft autosave, field mapping).
- `npm run test:unit` pass; `npx tsc --noEmit` clean; `npm run lint` clean.

## Constraint

- Giữ nguyên data model, service, state logic (`useCardCreatorState`, `cardCreatorService`, `fieldMapping`, `cardDraft`, media capture).
- Không đổi manifest, không thêm dependency mới nếu không cần thiết.
- Dùng design-system tokens (`--space-*`, `--color-*`, `--input-*`) và shared UI components (`Select`, `Button`, `Dialog`, `BottomSheet`).
- Responsive: desktop Dialog, mobile BottomSheet (existing `CardCreatorBottomSheet`).
- Content-script isolated world: px-based tokens, không rem.
- D&D reorder: desktop click-drag, mobile long-press-drag; không hiển thị drag handle.

## Out of scope

- Tích hợp lookup trực tiếp với Yomitan API (không có public API). Chỉ tạo vùng preview text để Yomitan extension scan như bình thường.
- IPA/reading/furigana rendering (future — preview block chỉ chuẩn bị struct).
- Thay đổi media capture, AnkiConnect, field mapping auto-map logic.
- Bulk operations ngoài reorder/remove/add.

## Mockup

Approved: `docs/mockups/anki-card-mockup.html`.

## Key decisions (from interview)

- **Preview block**: read-only text, nằm ở trên cùng các fields, không title, target word + sentence đều căn giữa, cùng size, target in đậm, sentence in đậm mọi lần xuất hiện target word.
- **Preview purpose**: vùng scan cho Yomitan (text thuần, dễ scan hơn input/textarea trong overlay); tương lai thêm IPA/reading.
- **Image media**: slide/carousel ngang, thumbnail cố định ~120px height, width auto theo aspect ratio, nút xóa góc trên phải, nút `+` ở cuối.
- **Audio media**: list dọc, waveform icon, tên file, nút xóa, nút `+ Add ...`.
- **Empty state**: dropzone với icon + text "Drop image here or click to add" / "Drop audio here or click to add".
- **Reorder**: click-drag desktop, long-press-drag mobile; không drag handle icon.
- **Drag-and-drop add**: cả image và audio đều hỗ trợ thả file vào media zone.
- **Field mapping selector**: label style, no `→`, no background/border, small chevron, fit-to-content, active color change.
- **Media zone background**: faint `surface` background, no border.
- **Section style**: fields không dùng bordered box, chỉ dùng gap và section title.

## Next

- Write `docs/specs/spec-card-creator-ui-redesign.md` (PRD self-contained 8 sections).
- Write `docs/plan/plan-card-creator-ui-redesign.md`.
- Write `docs/task/task-card-creator-ui-redesign.md`.
