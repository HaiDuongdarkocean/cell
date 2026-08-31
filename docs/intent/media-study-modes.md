# Intent — Study Modes (Media Study Modes)

> Confirmed statement of intent cho tab "Study Modes" trong Universal Panel.
> Source of truth UI: `dist/study-modes-prototypes/variant-e2.html` (Liquid Glass, CRUD presets/custom).
> Output của phase DEFINE (elicitation + doubt-driven validation). Downstream: `docs/specs/media-study-modes.md`.
> Confirmed: 2026-08-21.

## 1. Outcome

Tab **Study Modes** trong Universal Panel cho phép người dùng chọn và tùy chỉnh cách video phát lại theo từng câu phụ đề. Có 8 preset sẵn và khả năng tạo nhiều custom mode, mỗi mode là một chuỗi các `StudyStep` có thể cấu hình. Custom mode hỗ trợ đầy đủ CRUD, lưu trữ cục bộ, áp dụng ngay cho video đang phát.

## 2. User

- Language learner từ 5–80 tuổi, persona nhiều nhất 10–25 tuổi.
- Mọi ngành nghề, yêu thích học ngoại ngữ qua video.
- Dùng trên Chrome / Edge / Brave, desktop + tablet + Android, MV3 extension.

## 3. Why now

Prototype hiện tại (`StudyModesPanelPage.showcase.tsx`) chỉ có 8 preset và 1 custom mode inline, không lưu được nhiều combo, không có CRUD. Người dùng cần tái sử dụng các chuỗi học cá nhân (Shadowing → Check, Read → Dictation → Normal, v.v.) và tinh chỉnh từng bước playback.

## 4. Success

- Mở tab Study Modes → thấy rõ nhóm **Presets** và **Custom**.
- Chọn 1 preset hoặc custom mode → mode đó được kích hoạt cho video hiện tại.
- Bấm **New mode** → builder mở → đặt tên, thêm/sửa/xóa step, lưu → custom mode xuất hiện trong grid.
- Bấm **Edit** trên custom mode → mở builder với dữ liệu cũ → sửa → lưu.
- Bấm **Delete** trên custom mode → confirm → xóa.
- Advanced settings (skip scenes, remove bracketed) được ghi nhớ và áp dụng.
- Toàn bộ UI tuân thủ Liquid Glass, responsive trong side panel, accessible.

## 5. Constraint

- MV3 extension, side panel width hẹp (≈320–560px).
- Không dùng Material Design 3 tokens; dùng `tokens.css` và `src/shared/ui/*`.
- Responsive: 4 cột trên desktop, 2 cột trên mobile/side panel hẹp, touch target tối thiểu 40–44px.
- `localStorage` / `chrome.storage.local` cho persistence; custom modes cần sống qua reload.
- Không block UI thread, không dùng native `confirm()`/`alert()` trong production (dùng `Dialog` component).
- Thuật toán CRUD O(1)–O(n), không vượt O(n).

## 6. Out of scope

- Chia sẻ / import / export custom modes.
- AI đề xuất mode.
- Lưu mode theo video cụ thể (modes là global trước).
- Audio processing ngoài tốc độ phát (`speed` chỉ là playback rate, không render file).
- Lặp A-B theo khoảng thời gian thủ công.
- Cloud sync.

## 7. Data model

```ts
// Mỗi mode (preset hoặc custom)
interface StudyMode {
  id: string;            // preset: 'normal' | 'listen' | ... ; custom: generated
  type: 'preset' | 'custom';
  icon: IconCatalogKey;
  title: string;
  description: string;
  steps: StudyStep[];
}

// Mỗi bước trong chuỗi playback
interface StudyStep {
  subtitle: 'none' | 'native' | 'target' | 'both' | 'cloze';
  pause: 'none' | 'start' | 'end';
  repeat: '1x' | '2x' | '3x';
  speed: '0.5x' | '0.75x' | '1x' | '1.25x' | '1.5x';
  after: 'continue' | 'wait' | 'loop';
}

// Cấu hình advanced
interface StudyModeAdvanced {
  skipNoDialogue: 'OFF' | '2X' | '4X' | '6X' | '8X' | 'JUMP';
  removeBracketed: boolean;
}

// State active
interface StudyModeState {
  activeModeId: string;
  customModes: StudyMode[];
  advanced: StudyModeAdvanced;
}
```

## 8. UI — Source of truth

File `dist/study-modes-prototypes/variant-e2.html` là SSOT cho giao diện. Cấu trúc:

### 8.1 Header

- **Cell logo + "Study Modes"**.
- **Toggle theme** (icon button).
- **Advanced** pill toggle — bật/tắt phần Advanced ở dưới.

### 8.2 Presets

- Eyebrow: "Playback settings".
- Title: "Play mode".
- Grid 4 cột (desktop) / 2 cột (mobile) các card:
  - Normal, Listen, Read, Listen-Check, Hybrid, Dictation, Cloze, Custom base.
- Card active: primary background, icon + title + description màu trắng.
- Chạm card → chọn mode.

### 8.3 Custom

- Eyebrow: "Your combinations".
- Title: "Custom".
- Grid các card custom đã lưu + card "New mode" (nét đứt).
- Mỗi custom card có:
  - Icon, title, mô tả (tóm tắt chuỗi step).
  - Footer: hai nút **Edit** và **Delete**.
  - Chạm thân card → chọn mode.
  - Bấm **Edit** → mở builder ở chế độ edit.
  - Bấm **Delete** → confirm xóa.

### 8.4 Advanced

- Title: "Advanced".
- "Skip scenes with no dialogue": chip group `OFF | 2X | 4X | 6X | 8X | JUMP`.
- Checkbox: "Also remove bracketed subtitles".

### 8.5 Builder (bottom sheet)

- Mở khi New mode / Edit.
- Title: "New custom mode" hoặc "Edit custom mode".
- Field "Mode name" (pill input).
- **Cue strip** — dải block ngang, mỗi block là 1 step.
  - Block hiển thị: số thứ tự, subtitle mode, speed, repeat.
  - Block cuối: "Add" để tạo step mới.
  - Chạm block → chọn step để edit.
- **Step editor** — card chứa chip group cho từng thuộc tính:
  - Subtitles: none / native / target / both / cloze.
  - Pause: none / start / end.
  - Repeat: 1x / 2x / 3x.
  - Speed: 0.5x / 0.75x / 1x / 1.25x / 1.5x.
  - After cue: continue / wait / loop.
  - Nút **Delete this step** (ẩn nếu chỉ còn 1 step).
- **Preview** — tóm tắt chuỗi step theo tên mode.
- **Save / Cancel**.

## 9. Behavior

### 9.1 Selection

- Chỉ 1 mode active tại 1 thời điểm.
- Chọn preset: custom selected bị xóa trạng thái.
- Chọn custom: preset active bị xóa trạng thái.
- Mode active được gửi đến player / subtitle engine để điều khiển playback.

### 9.2 Custom mode CRUD

- **Create**: New mode → builder → ít nhất 1 step → Save. ID tự sinh, icon mặc định `slidersHorizontal` (hoặc user chọn sau này).
- **Read**: hiển thị trong grid Custom.
- **Update**: Edit → mở builder với steps cũ → sửa tên/step → Save.
- **Delete**: Delete → confirm → xóa khỏi `customModes`.

### 9.3 Step CRUD trong builder

- **Create**: bấm Add block ở cuối cue strip.
- **Read**: chạm block để xem/sửa.
- **Update**: chọn chip tương ứng.
- **Delete**: bấm "Delete this step". Không cho phép xóa step cuối cùng (giữ ít nhất 1 step).

### 9.4 Validation

- Tên mode không được rỗng; nếu rỗng thì báo lỗi hoặc focus vào input (không auto fallback "Untitled").
- Không cho phép tạo 2 mode cùng tên (trong custom).
- Ít nhất 1 step trong 1 mode.

### 9.5 Persistence

- Custom modes + active mode + advanced settings lưu trong `chrome.storage.local` (ưu tiên) hoặc `localStorage` nếu chưa sẵn sàng MV3.
- Restore khi mở lại panel.

### 9.6 Apply to player

- Khi active mode thay đổi, emit event hoặc cập nhật store để player áp dụng chuỗi step cho từng cue.
- Player sử dụng các trường `subtitle`, `pause`, `repeat`, `speed`, `after` để điều khiển playback.
- Preset cần được ánh xạ sang cùng 1 dạng `StudyStep[]` để player xử lý thống nhất.

## 10. Edge cases / open questions từ doubt review

1. **Preset "Custom base" có thể trùng ý nghĩa với "New mode"** → quyết định: loại "Custom base" khỏi presets, chỉ giữ "New mode" card trong nhóm Custom. Hoặc biến "Custom base" thành shortcut mở builder với 3 step mặc định.
2. **Cloze preset** cần subtitle mode `cloze` trong `StudyStep` → giữ nguyên enum.
3. **Tốc độ phát (`speed`)** có cần hỗ trợ <0.5x hoặc >1.5x? Hiện tại giới hạn 5 mức phổ biến.
4. **Reorder step** chưa có trong mockup → MVP chỉ cần add/delete; reorder có thể thêm sau nếu user yêu cầu.
5. **Discard changes** khi bấm Cancel/X/overlay → nếu đã sửa, cần confirm trước khi đóng (tránh mất dữ liệu).
6. **Touch target** của footer `Edit/Delete` 26px cần nâng lên 40px trong production.
7. **Focus trap + a11y** cho builder (role dialog, aria-modal, focus return) cần đảm bảo khi implement.
8. **Hình ảnh icon** mỗi custom mode hiện hardcode; MVP có thể dùng icon mặc định, sau này cho phép chọn icon từ catalog.

## 11. Downstream

- `docs/specs/media-study-modes.md`: technical plan, component map, data flow, persistence, player integration.
- `src/entrypoints/design-system-showcase/pages/StudyModesPanelPage.showcase.tsx`: cần thay thế/merge với UI final.
- Mở rộng player engine để hỗ trợ `StudyStep` với `pause`, `repeat`, `speed`.
