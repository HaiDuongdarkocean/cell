# Spec: Study Modes

> Status: **Final — review-resolved, implementation-ready.**
> Intent source: `docs/intent/media-study-modes.md`.
> UI source of truth: `dist/study-modes-prototypes/variant-e2.html`.

## 1. Objective

Universal Panel tab **Study Modes** giúp language learner chọn và tùy chỉnh chuỗi phát lại video theo từng câu phụ đề. Cung cấp 7 preset, khả năng tạo nhiều custom mode, và cấu hình nâng cao. Custom mode hỗ trợ CRUD đầy đủ, lưu cục bộ, active mode được áp dụng cho video đang phát qua message contract.

## 2. Problem & user

- **Problem:** Prototype hiện tại chỉ có 8 preset và 1 custom mode inline; người dùng không thể lưu/tái sử dụng nhiều chuỗi học cá nhân.
- **User:** Language learner 5–80 tuổi, persona chính 10–25, dùng Chrome/Edge/Brave trên desktop/tablet/Android.
- **Business value:** Giảm ma sát khi chuyển đổi giữa các bài tập nghe/nói/đọc/viết trong cùng video, tăng retention bằng cá nhân hóa workflow.

## 3. Success metrics

- User tạo được custom mode trong < 30s (E2E).
- Panel mở và active mode load trong < 200ms.
- Active mode áp dụng cho video trong < 1s.
- Tỷ lệ hoàn thành CRUD không lỗi ≥ 95% (QA).

## 4. Phased scope

| Phase | Must-have | Nice-to-have |
|---|---|---|
| **P1 (MVP)** | 7 preset, custom grid, CRUD mode, builder với 5 step fields, advanced settings, persistence, message contract tới player | — |
| **P2** | Reorder step, duplicate/clone mode, discard-changes guard, `cloze` rendering, icon picker, reduced-motion/transparency | Auto-advance for `wait` |
| **P3** | Import/export, per-video mode, AI/community templates, cloud sync | — |

### Non-goals

- Sharing / import / export (P3).
- Cloud sync (P3).
- AI-suggested mode (P3).
- Mode per video (P3).
- Advanced audio processing ngoài playback `speed`.
- Image-based / OCR cloze (out of scope).

## 5. User stories & acceptance criteria

### US-1: Chọn preset
> **As a** language learner, **I want** chọn preset từ grid, **so that** video áp dụng ngay chuỗi step phù hợp.

- **AC1 (happy):** Given panel đang mở, when user chạm card `Listen`, then `activeModeId = 'listen'`, player ẩn phụ đề và phát tiếp.
- **AC2 (failure):** Given player chưa tải phụ đề, when chọn `Cloze`, then player hiển thị toast "Cloze cần phụ đề target" và active mode vẫn đổi.
- **AC3 (switch):** Given đang chọn `Normal`, when chọn `Read`, then `activeModeId` chỉ còn `read` (không có 2 mode cùng active).

### US-2: Tạo custom mode
> **As a** learner, **I want** bấm `New mode`, **so that** tôi có thể lưu chuỗi step của riêng mình.

- **AC1 (happy):** Given tab Study Modes, when bấm `New mode` → nhập "Shadowing" → thêm 2 step → bấm Save, then mode mới xuất hiện trong Custom grid, active mode = mode mới.
- **AC2 (failure):** Given tên trống, when bấm Save, then input báo lỗi "Name is required" và không lưu.
- **AC3 (failure):** Given đã có mode tên "Shadowing", when nhập tên trùng, then báo lỗi "Name already exists".

### US-3: Sửa custom mode
> **As a** learner, **I want** bấm `Edit` trên custom mode, **so that** tôi cập nhật chuỗi step đã lưu.

- **AC1 (happy):** Given card "My combo", when bấm `Edit` → đổi step 2 subtitle thành `none` → Save, then preview cập nhật, grid hiển thị mô tả mới.
- **AC2 (failure):** Given đang sửa và đóng builder bằng Cancel khi có thay đổi, then Dialog hỏi "Discard changes?".

### US-4: Xóa custom mode
> **As a** learner, **I want** xóa custom mode, **so that** grid không bị lộn xộn.

- **AC1 (happy):** Given 3 custom modes, when bấm `Delete` → confirm, then mode bị xóa, active mode fallback về `normal` nếu đang active.
- **AC2 (failure):** Given chỉ còn 1 custom mode, when xóa, then vẫn hiển thị confirm, fallback `normal`.

### US-5: Cấu hình step
> **As a** learner, **I want** chọn chip trong builder, **so that** tôi điều chỉnh subtitle, pause, repeat, speed, after.

- **AC1 (happy):** Given builder mở step 1, when chọn `subtitle=target`, `speed=0.75x`, `repeat=2x`, then cue strip và preview cập nhật.
- **AC2 (edge):** Given chỉ còn 1 step, when bấm `Delete this step`, then nút bị disabled.

### US-6: Advanced settings
> **As a** learner, **I want** bật Advanced và chọn skip/bracketed, **so that** playback bỏ qua phần không cần thiết.

- **AC1 (happy):** Given toggle Advanced on, when chọn `JUMP` và tick `removeBracketed`, then player bỏ qua khoảng im lặng và ẩn nội dung trong ngoặc.
- **AC2 (persistence):** Given đã chọn `2X` remove bracketed, when tắt/mở lại panel, then giá trị vẫn giữ nguyên.

### US-7: Persistence
> **As a** learner, **I want** custom modes và active mode được lưu, **so that** tôi không phải tạo lại sau khi đóng trình duyệt.

- **AC1:** Given đã tạo 2 custom modes, when reload page, then 2 modes vẫn hiển thị và active mode như cũ.

### US-8: Áp dụng cho video
> **As a** learner, **I want** mode đã chọn điều khiển playback, **so that** video phát theo đúng chuỗi step.

- **AC1:** Given active mode = `Hybrid`, when chuyển câu tiếp theo, then player thực hiện native → target → none với đúng pause/speed/repeat.

## 6. Data model

```ts
// src/entities/studyMode/types.ts
export type SubtitleVisibility = 'none' | 'native' | 'target' | 'both';
export type PausePoint = 'none' | 'start' | 'end';
export type RepeatCount = 1 | 2 | 3;
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5;
export type AfterCue = 'continue' | 'wait' | 'loop';

export interface StudyStep {
  subtitle: SubtitleVisibility;
  pause: PausePoint;
  repeat: RepeatCount;
  speed: PlaybackSpeed;
  after: AfterCue;
}

export interface StudyMode {
  id: string;
  type: 'preset' | 'custom';
  icon: IconCatalogKey;
  title: string;
  description: string;
  steps: StudyStep[];
}

export interface StudyModeAdvancedSettings {
  skipNoDialogue: 'OFF' | '2X' | '4X' | '6X' | '8X' | 'JUMP';
  removeBracketed: boolean;
}

export interface StudyModeState {
  version: number;
  activeModeId: string;
  customModes: StudyMode[];
  advanced: StudyModeAdvancedSettings;
}
```

### Preset definitions (P1)

```ts
export const PRESETS: readonly StudyMode[] = [
  { id: 'normal',     type: 'preset', icon: 'play',       title: 'Normal',        description: 'Both subtitles visible, no auto-pause.',  steps: [{ subtitle: 'both',   pause: 'none',  repeat: 1, speed: 1,    after: 'continue' }] },
  { id: 'listen',     type: 'preset', icon: 'volumeHigh', title: 'Listen',        description: 'Hide both subtitles, focus on listening.', steps: [{ subtitle: 'none',   pause: 'none',  repeat: 1, speed: 1,    after: 'continue' }] },
  { id: 'read',       type: 'preset', icon: 'bookOpen',   title: 'Read',          description: 'Pause at cue start so subtitle can be read.', steps: [{ subtitle: 'both',   pause: 'start', repeat: 1, speed: 1,    after: 'wait' }] },
  { id: 'listen-check', type: 'preset', icon: 'eyeOff',   title: 'Listen-Check',  description: 'Hide subtitles while playing, then pause and reveal.', steps: [{ subtitle: 'none',   pause: 'end',   repeat: 1, speed: 1,    after: 'wait' }] },
  { id: 'hybrid',     type: 'preset', icon: 'layers',     title: 'Hybrid',        description: 'Native → target → audio only, in one cue loop.', steps: [
    { subtitle: 'native', pause: 'none',  repeat: 1, speed: 1, after: 'continue' },
    { subtitle: 'target', pause: 'none',  repeat: 1, speed: 1, after: 'continue' },
    { subtitle: 'none',   pause: 'none',  repeat: 1, speed: 1, after: 'continue' },
  ]},
  { id: 'dictation',  type: 'preset', icon: 'pencil',     title: 'Dictation',     description: 'Play the sentence, then type and check.', steps: [{ subtitle: 'none',   pause: 'end',   repeat: 2, speed: 0.75, after: 'wait' }] },
  { id: 'cloze',      type: 'preset', icon: 'scanText',   title: 'Cloze',         description: 'Fill in missing target words.', steps: [{ subtitle: 'target', pause: 'end',   repeat: 1, speed: 1,    after: 'wait' }] },
];
```

> **Note `cloze`:** P1 hiển thị đầy đủ phụ đề target; cloze rendering (ẩn từ ngẫu nhiên) là P2. Nếu user chọn `Cloze` trước P2, UI vẫn cho phép, player fallback về target và hiển thị hint "Cloze rendering coming soon".

### State machine cho 1 cue

```
Start cue
  ├─ subtitle set theo step
  ├─ speed set theo step
  ├─ if pause == 'start' → pause immediately, wait user Continue
  │     (phát tiếp khi Continue)
  ├─ play to end
  ├─ if repeat == 2 → play lại (tổng 2 lần)
  ├─ if pause == 'end' → pause
  └─ apply after:
       continue → next step (hoặc next cue nếu cuối)
       wait     → pause, chờ Continue
       loop     → quay lại step 1 của cùng cue
                  (tối đa 5 vòng, sau đó tự động continue để tránh vô hạn)
```

- `repeat: N` = câu được phát tổng cộng N lần trước khi xử lý `after`.
- `pause: 'end'` + `after: 'wait'` = dừng ở cuối và chờ (không chờ kép, `after: 'wait'` ưu tiên sau repeat).
- `loop` P1: loop toàn bộ chuỗi step của câu hiện tại, max 5 lần.

### `skipNoDialogue` semantics

- `OFF`: không skip.
- `2X`/`4X`/`6X`/`8X`: trong khoảng im lặng giữa 2 cue (no dialogue), phát nhanh gấp N lần, sau đó tiếp tục bình thường khi có dialogue.
- `JUMP`: khi gặp khoảng im lặng, seek đến start của cue tiếp theo ngay lập tức.
- Phát hiện "no dialogue": khoảng thời gian giữa `end` cue trước và `start` cue sau.

### `removeBracketed`

- Trước khi render, strip nội dung trong `()`, `[]`, `{}` và cả dấu ngoặc.
- Không thay đổi file gốc, chỉ áp dụng khi render.

## 7. Persistence & state sync

### Storage

- Key: `STUDY_MODES` trong `src/shared/config/config.ts` → `cell:studyMode:state`.
- Lưu trong `chrome.storage.local`.
- State bao gồm `version` để forward-compatible migration.
- Initial state:
  ```json
  { "version": 1, "activeModeId": "normal", "customModes": [], "advanced": { "skipNoDialogue": "OFF", "removeBracketed": false } }
  ```

### Migration

```ts
function migrateStudyModeState(raw: unknown): StudyModeState {
  const defaultState = INITIAL_STUDY_MODE_STATE;
  if (!raw || typeof raw !== 'object') return defaultState;
  const state = raw as Partial<StudyModeState>;
  const version = state.version ?? 0;
  if (version < 1) return defaultState;
  // future: if (version < 2) { ... }
  return { ...defaultState, ...state, version: 1 };
}
```

### Edge cases

- Storage read lỗi / quota exceeded: fallback về `INITIAL_STUDY_MODE_STATE`, hiển thị inline error.
- `activeModeId` trỏ đến custom đã xóa: tự động fallback `normal`.
- Concurrent save: dùng optimistic update + last-write-wins (local only).

## 8. Player integration contract

### Message

Thêm message type trong `src/shared/config/messages.ts`:

```ts
APPLY_STUDY_MODE = 'APPLY_STUDY_MODE',
```

Payload:

```ts
interface ApplyStudyModePayload {
  activeMode: StudyMode;
  advanced: StudyModeAdvancedSettings;
}
```

### Flow

1. `StudyModesPanel` gọi `sendMessage({ type: MESSAGE_TYPES.APPLY_STUDY_MODE, payload: { activeMode, advanced } })` khi active hoặc advanced thay đổi.
2. Content-script / player engine nhận message, cập nhật `currentStudyMode`.
3. Mỗi khi chuyển cue, player engine chạy state machine ở §6.2.
4. Local player (nếu có) cũng subscribe cùng message hoặc đọc từ storage.

### Storage-first fallback

- Player cũng đọc `chrome.storage.local[STORAGE_KEYS.STUDY_MODES]` khi mount để khôi phục active mode mà không cần panel mở.

## 9. Universal Panel integration

### Types

```ts
// src/features/universalPanel/types.ts
export type UniversalPanelTab = 'dictionary' | 'settings' | 'studyModes';
```

### TABS array

```ts
// src/features/universalPanel/UniversalPanel.tsx
const TABS: { key: UniversalPanelTab; icon: 'bookOpen' | 'settings' | 'slidersHorizontal'; label: string }[] = [
  { key: 'dictionary', icon: 'bookOpen', label: 'Dictionary' },
  { key: 'studyModes', icon: 'slidersHorizontal', label: 'Study Modes' },
  { key: 'settings', icon: 'settings', label: 'Settings' },
];
```

### Props

```ts
interface UniversalPanelProps {
  ...
  studyModesPanel: ReactNode;
}
```

### Render

```tsx
<div className={styles.content} data-cell-id={`universal-panel-content-${activeTab}`}>
  {activeTab === 'dictionary' && dictionaryPanel}
  {activeTab === 'studyModes' && studyModesPanel}
  {activeTab === 'settings' && settingsPanel}
</div>
```

### Mount

- `mountUniversalPanel` thêm `studyModesTabCss` vào `SHADOW_CSS`.
- Tạo `StudyModesTab` component trong `src/features/universalPanel/tabs/StudyModesTab.tsx`.
- `renderStudyModesPanel = () => createElement(StudyModesTab)`.
- `currentTab` khởi tạo vẫn là `dictionary`; persisted tab bao gồm `'studyModes'`.

## 10. UI structure

### Component map

| Mockup | Component | File |
|---|---|---|
| Page title | `Heading` | `src/shared/ui/Heading.tsx` |
| Section label | `Text` | `src/shared/ui/Text.tsx` |
| Mode card | `Card` | `src/shared/ui/Card.tsx` |
| Icon | `Icon` | `src/shared/icons/Icon.tsx` |
| Advanced toggle | `Toggle` | `src/shared/ui/Toggle.tsx` |
| Chips | `Chip` | `src/shared/ui/Chip.tsx` |
| Checkbox | `Checkbox` | `src/shared/ui/Checkbox.tsx` |
| Builder | `BottomSheet` | `src/shared/ui/BottomSheet.tsx` |
| Confirm delete | `Dialog` | `src/shared/ui/Dialog.tsx` |
| Input | `Input` | `src/shared/ui/Input.tsx` |
| Buttons | `Button`, `IconButton` | `src/shared/ui/*.tsx` |
| Layout | `Stack`, `Grid`, `Flex` | `src/shared/ui/*.tsx` |

### Layout

- **Header:** logo + title + theme `IconButton` + Advanced `Toggle`.
- **Play mode:** eyebrow + title + 4-col/2-col grid của 7 preset cards.
- **Custom:** eyebrow + title + grid custom modes + `New mode` dashed card.
- **Advanced (toggle on):** card chứa skip chips + checkbox.
- **Builder:** `BottomSheet` với input name, cue strip, step editor, preview, Save/Cancel.

### Responsive

- Side panel sử dụng `UniversalPanel.module.css`, chiều rộng theo viewport; nội dung Study Modes co theo container.
- Grid: 4 cột ≥ 520px, 2 cột < 520px, 1 cột < 360px.
- Touch target tối thiểu 40px desktop / 44px mobile.
- Builder `max-height: 85%`, có scroll, không che khuất hoàn toàn panel trên màn hình thấp.

### Accessibility

- Cards: `role="radio"`, `aria-checked`, `tabIndex={0}`, Enter/Space chọn.
- Custom card footer: `Button` with clear labels.
- Builder `BottomSheet`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, return focus.
- Chip groups: `role="radiogroup"`, roving `tabIndex`, arrow keys, `aria-checked`.
- Skip chips: `aria-label="Skip scenes with no dialogue"`.
- `prefers-reduced-motion`: tắt slide, dùng fade.
- `prefers-reduced-transparency`: solid background thay vì blur.

## 11. Behavior details

### Selection

- Chỉ 1 `activeModeId`.
- Chọn preset → `activeModeId = preset.id`.
- Chọn custom card (thân) → `activeModeId = custom.id`.
- Bấm `New mode` card → mở builder (không active).
- Bấm `Edit` trên custom card → mở builder với mode đó.
- Bấm `Delete` → `Dialog` confirm.

### Builder

- **New:** title "New custom mode", name empty, 1 default step `{ subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' }`.
- **Edit:** title "Edit custom mode", name + steps gốc.
- **Cue strip:** horizontal scroll, mỗi block hiển thị index + subtitle + speed + repeat. Block active selected. Block cuối `Add` append step.
- **Step editor:** 5 chip groups, chip active = value. `Delete this step` disabled khi còn 1 step.
- **Preview:** string tóm tắt, cập nhật real-time.
- **Save:** validate → lưu → đóng.
- **Cancel / X / overlay click:** nếu có thay đổi, `Dialog` discard; không thì đóng ngay.

### Validation

- `title` trimmed, non-empty, max 50 ký tự.
- Không trùng tên trong `customModes` (case-insensitive).
- `steps.length >= 1`.
- Step fields nằm trong enum.

### Advanced

- `Toggle` bật/tắt section.
- Skip chips single-select.
- Checkbox lưu boolean.
- Advanced settings là global, không theo mode.

## 12. Project structure

```
src/
├── entities/
│   └── studyMode/
│       ├── types.ts
│       ├── constants.ts          # PRESETS, enum option arrays
│       └── studyModeStore.ts     # Zustand + persistence
├── features/
│   ├── studyModes/
│   │   ├── ui/
│   │   │   ├── StudyModesTab.tsx           # tab panel
│   │   │   ├── StudyModesTab.module.css
│   │   │   ├── ModeCard.tsx
│   │   │   ├── ModeCardGrid.tsx
│   │   │   ├── AdvancedSection.tsx
│   │   │   ├── CustomModeBuilder.tsx
│   │   │   ├── CueStrip.tsx
│   │   │   ├── StepEditor.tsx
│   │   │   └── StepSummary.tsx
│   │   ├── hooks/
│   │   │   ├── useStudyMode.ts
│   │   │   └── useCustomModeCRUD.ts
│   │   └── lib/
│   │       ├── validateModeName.ts
│   │       ├── generateModeId.ts
│   │       ├── formatStepSummary.ts
│   │       └── migrateStudyModeState.ts
│   └── universalPanel/
│       ├── types.ts              # thêm 'studyModes'
│       ├── UniversalPanel.tsx    # thêm tab + panel
│       ├── mountUniversalPanel.ts # thêm SHADOW_CSS + studyModesPanel
│       └── tabs/StudyModesTab.tsx
└── entrypoints/
    └── design-system-showcase/
        └── pages/
            └── StudyModesPanelPage.showcase.tsx   # replace với UI final
```

## 13. Commands & verification

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run dev
npm run build
npm run test:e2e   # Playwright
```

## 14. Testing

- **Unit:** `validateModeName`, `formatStepSummary`, `migrateStudyModeState`, `studyModeStore` CRUD.
- **Integration:** builder mở/đóng, thêm/xóa step, lưu, xóa mode.
- **E2E:** chọn preset, tạo custom, edit, delete, advanced toggle, persistence qua reload.

## 15. Definition of Done

- [ ] `StudyModesTab` render trong `UniversalPanel` với 3 tab.
- [ ] Tất cả 7 preset selectable.
- [ ] CRUD custom mode hoàn chỉnh, lỗi validation hiển thị.
- [ ] Builder sử dụng `BottomSheet`, `Card`, `Chip`, `Input`, `Button`, `Dialog`.
- [ ] `APPLY_STUDY_MODE` message gửi được tới content script / player.
- [ ] Persistence qua `chrome.storage.local`, có migration `version`.
- [ ] Unit + E2E pass; panel load < 200ms.
- [ ] Không hardcode màu, dùng `tokens.css` và Liquid Glass.
- [ ] A11y audit: keyboard navigation, focus trap, `aria` labels.

## 16. Open questions / decisions

1. **Cloze rendering:** P1 fallback target; P2 implement hide-random-word. Owner: player team.
2. **Loop limit:** P1 max 5 lần; P2 cho phép user cấu hình hoặc infinite loop có nút Stop.
3. **Per-video mode:** P3; P1 active mode global.
4. **Icon picker:** P2; P1 custom mode dùng icon mặc định `slidersHorizontal`.
5. **Custom base removal:** Đã loại khỏi presets; `New mode` card đảm nhận. Cần user xác nhận nếu muốn quay lại 8 preset.

## 17. Risks

- Player engine cần mở rộng để hỗ trợ `pause`, `repeat`, `speed`, `after`. Nếu player không ready, `APPLY_STUDY_MODE` chỉ lưu state và fallback chế độ cũ.
- `cloze` P1 fallback có thể gây confuse; cần clear messaging.
- Thêm tab thứ 3 có thể làm tab bar chật ở mobile; P2 cân nhắc collapsible tab bar.
- Local only: user mất dữ liệu khi uninstall; P3 cân nhắc export.
