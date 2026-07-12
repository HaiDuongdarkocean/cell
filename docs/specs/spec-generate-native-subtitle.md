# Spec: Generate Native Subtitle

> Phase IDEATE — đặc tả đã interview ngày 2026-07-12. Mockup được đề nghị và Anh yêu từ chối; UI reuse subtitle block + Subtitle Manager hiện có.

## 1. Objective

Thêm action thủ công **Generate native subtitle** để dịch toàn bộ target subtitle đang active sang ngôn ngữ native đã cấu hình. Cùng một kết quả phải:

1. hiện ngay trên bilingual overlay theo từng chunk dịch xong;
2. xuất hiện như một native subtitle có thể chọn trong Subtitle Manager;
3. tạo mới khi chưa có native, hoặc overwrite native đang active khi đã có;
4. khi chạy lại, bỏ kết quả generate cũ và thay bằng kết quả mới.

**User story:** Anh yêu đang học bằng target subtitle, muốn chủ động tạo một native subtitle máy dịch bằng button hoặc shortcut mà không chọn lại ngôn ngữ và không rời video.

**Why now:** `BackgroundPrefillController` đã dịch target → native và feed overlay, nhưng kết quả chỉ là state live; Subtitle Manager không có entry đại diện để quản lý như native subtitle thường.

### Scope

- Button thứ ba, nằm dưới cùng trong `rightColumn`, sau Quick update và Edit card.
- Shortcut configurable với action ID `generate-native`; mặc định `g`.
- Dùng `subtitleOverlayTargetLanguage` làm source language và `subtitleOverlayNativeLanguage` làm destination language.
- Reuse `BackgroundPrefillController`, message `TRANSLATE`, chunking, retry/backoff và overlay flow hiện có.
- Kết quả chỉ sống in-memory trong video session hiện tại; SPA navigation sang video khác phải clear.

### Out of scope

- Persist vào `chrome.storage`, IndexedDB hoặc OPFS; không có TTL 24 giờ.
- Chọn ngôn ngữ trong lúc generate.
- Thêm translation provider hoặc dependency mới.
- Thay đổi auto-translate-on-play hoặc semantics của `toggle-translate`.
- Nút toggle off; `generate-native` là action một chiều start/restart.
- Mockup UI mới.

## 2. Tech Stack

- Chrome Extension MV3; content script isolated world.
- TypeScript strict, React 19 cho Settings; imperative DOM cho subtitle block/manager.
- Existing translation pipeline: Google Translate unofficial endpoint qua background service worker.
- Existing UI primitives/styles: `cluster-btn`, `SubtitleBlockDOM`, `SubtitleManagerPanel`.
- Jest 30 + jsdom; Playwright/real Edge cho browser verification.
- Không thêm dependency.

## 3. Commands

```text
Dev:              npm run dev
Build:            npm run build
Typecheck:        npm run typecheck
Unit tests:       npm run test:unit
Targeted tests:   npx jest --selectProjects unit --runInBand --testPathPatterns="subtitleBlock|subtitleManager|subtitleShortcuts|translatePrefill|settingsStore"
Lint:             npm run lint
E2E:              npm run test:e2e
```

## 4. Project Structure

Các file dự kiến bị ảnh hưởng; implementation phải xác nhận lại bằng grep trước khi sửa:

```text
src/
├── entities/settings/types.ts
│   └── thêm ShortcutAction 'generate-native'
├── shared/config/config.ts
│   └── thêm default shortcut G
├── shared/lib/storage/settingsStore.ts
│   └── migration schema v11 → v12, bổ sung shortcut cho user cũ
├── features/settings/ui/SettingsDialog.tsx
│   └── thêm generate-native vào danh sách shortcut configurable
├── features/subtitle/ui/
│   ├── subtitleBlockDom.ts
│   │   └── tạo generateNativeBtn ở cuối rightColumn
│   ├── subtitleBlockController.ts
│   │   └── phát GenerateNativeAction từ button
│   ├── subtitleManagerPanel.ts
│   │   └── source 'translated' + badge TRANSLATED
│   ├── subtitleShortcuts.ts
│   │   └── reuse matching hiện có; không tạo keyboard system mới
│   └── contentScriptController.ts
│       └── một generate-native flow dùng chung button + shortcut; translated virtual slot + cues
├── features/translate/logic/translatePrefill.ts
│   └── thêm optional onComplete callback tối thiểu; giữ nguyên queue/cache/retry
└── features/subtitle/ui/*.test.ts
    └── colocated tests cho DOM, manager, shortcut và controller logic

docs/
├── specs/spec-generate-native-subtitle.md
├── 0-wiki.md
└── 2-architechture-system.md  # update trong BUILD khi src thay đổi
```

Không tạo `schema.ts`: generated entry là state nội bộ trong content script, không đi qua MV3 message/storage boundary. Response dịch tiếp tục dùng validation/guard của pipeline `TRANSLATE` hiện có.

## 5. Code Style and Data Contract

- Named exports; không default export.
- Function component + hooks cho React; imperative DOM theo pattern hiện có trong content script.
- Logic state transition tách thành hàm thuần nếu không thể chứng minh bằng DOM test trực tiếp.
- Không dùng `any`; không thêm abstraction ngoài helper cần thiết để button và shortcut đi chung một flow.
- Icon dùng SVG inline hiện có: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, round cap/join, `aria-hidden="true"`, `focusable="false"`.

```ts
export type ShortcutAction =
  | ExistingShortcutAction
  | 'generate-native';

export interface SubtitlePanelItem {
  readonly id: string;
  readonly name: string;
  readonly format: string;
  readonly size?: number;
  readonly source: 'auto' | 'imported' | 'translated';
  readonly role: 'target' | 'native';
  readonly index: number;
  readonly isAsr?: boolean;
}
```

### Generated entry contract

- `role`: `native`.
- `source`: `translated`.
- `name`: native language display label + ` (translated)`, ví dụ `Vietnamese (translated)`.
- `format`: giữ format của target active nếu xác định được; fallback `srt`.
- `id`: hằng `translated-native`; prefix không trùng `auto-*`/`imported-*`, ổn định trong video session.
- `cues`: timestamps/index giữ từ target active; chỉ thay `text` bằng translation.
- `isAsr` và `size`: để `undefined` vì đây không phải track ASR hoặc file import.
- Native language label phải reuse helper mapping ISO hiện có (`isoCodeToLabel` hoặc public equivalent), không tạo bảng mapping thứ hai.
- Các cue chưa dịch có text rỗng và không được render như native text giả.
- Entry translated phải có badge text `TRANSLATED`; không gắn badge `Imported` hoặc `AUTO`.

### State and overwrite semantics

Controller giữ tối đa một state riêng:

```ts
type TranslatedNativeSlot = {
  readonly replacedSource: 'auto' | 'imported' | null;
  readonly replacedIndex: number;
  readonly item: SubtitlePanelItem;
  readonly cues: SrtCue[];
  readonly runId: number;
};
```

- `active native` là item đang selected/highlight trong manager và đang cấp native cues cho overlay.
- `translatedNativeSlot` là **virtual replacement**: underlying `autoNativeItems`/`importedNativeItems` và cue sources không bị mutate/xóa.
- `mergedPanelItems('native')` dựng auto + imported như hiện tại, sau đó thay item ở absolute active slot bằng translated item. Nếu không có native, append translated item tại index 0.
- `activeNativeSource` mở rộng thành `'auto' | 'imported' | 'translated'`; selection router có branch riêng để load `translatedNativeSlot.cues`.
- Khi generate ở slot khác, bỏ virtual replacement cũ trước; source item cũ tự xuất hiện lại từ underlying arrays, rồi translated item thay slot active mới. Vì vậy merged list luôn có tối đa một translated entry.
- Nếu action chạy lại: cancel prefill cũ, tăng `runId`, reset translated cues và tạo run mới; callback chỉ được commit khi `runId` còn active.
- Nếu auto-translate đang chạy, manual generate cancel và restart từ cue 0; không preserve partial cache. Đây là behavior cố ý để output manager là một run nhất quán.
- Native source cũ bị overwrite chỉ trong in-memory manager state của video hiện tại; SPA navigation clear `translatedNativeSlot` và rebuild từ detected/imported state của video mới.
- Mỗi chunk thành công cập nhật cùng translated entry và overlay; không append entry mới theo chunk.
- `BackgroundPrefillController` có optional `onComplete` để phát completion toast chính xác; caller cũ không truyền callback vẫn giữ behavior hiện tại.
- Source/native language được snapshot lúc start. Setting đổi giữa run chỉ áp dụng lần generate kế tiếp.

## 6. UI / Interaction Contract

### Button

- Vị trí: phần tử cuối của `block-right-column`, dưới `card-creator-quick` và `card-creator-edit`.
- Reuse class `cluster-btn`, scale, opacity, hover/focus và cluster enable/disable behavior hiện có.
- `data-testid="generate-native"`.
- `aria-label="Generate native subtitle"`.
- Tooltip/title thể hiện action và shortcut hiện hành; mặc định `Generate native subtitle (G)`.
- Icon phải truyền đạt rõ **dịch ngôn ngữ / tạo native** ở kích thước cluster (ưu tiên language glyph + directional arrow hoặc globe + arrows); không dùng icon chung chung như sparkle, download hay refresh. Chọn hình ít chi tiết nhất vẫn nhận ra ở button nhỏ, cùng hình học/stroke với icon cluster hiện tại.
- Button disabled khi không có target cues active hoặc target/native language thiếu/trùng nhau. Disabled state phải dùng native `disabled` + `aria-disabled="true"`.
- Khi cluster settings OFF, button ẩn cùng right column như hai Card Creator buttons.

### Shortcut

- Action ID: `generate-native`.
- Configurable trong Keyboard Shortcuts settings qua `ShortcutInput` hiện có.
- Default: phím `g`, không modifier.
- Guard input/textarea/select/contenteditable như shortcut hiện có.
- Button click và shortcut phải gọi cùng một function; không duplicate pipeline.

### Feedback

- Start/restart: toast `Generating native subtitle…`.
- Hoàn thành: toast `Native subtitle generated`.
- Không đủ điều kiện khi action đến từ shortcut: toast ngắn mô tả nguyên nhân (`No target subtitle` hoặc `Target and native languages must differ`).
- Translation error: reuse error/backoff toast hiện có; target overlay và manager vẫn usable.

## 7. Testing Strategy

### Unit / jsdom

1. `SubtitleBlockDOM` render generate button cuối `rightColumn`, đúng test id/ARIA/title/class và SVG style contract.
2. Cluster OFF ẩn right column; cluster ON hiện button giống Quick/Edit.
3. `SubtitleManagerPanel` render `source: 'translated'` với badge `TRANSLATED`, không render `Imported`.
4. Shortcut `g` map thành `generate-native`; editable target và modifier mismatch không fire.
5. Settings migration v11 → v12 theo pattern migration hiện có: append shortcut đúng một lần; không duplicate khi user đã có binding.
6. Generate không có auto-detected lẫn imported native tạo đúng một entry translated và activate.
7. Generate khi native auto/imported/translated đang active thay đúng active slot; source item gốc được giữ trong underlying array và khôi phục khi virtual slot chuyển nơi.
8. Chạy action lần hai cancel run cũ và chỉ còn một translated entry của run mới; stale chunk/completion callback bị `runId` guard bỏ qua.
9. Auto-translate đang chạy rồi manual generate: cancel partial run, restart cue 0, không có concurrent writer.
10. Mỗi chunk update cùng entry + overlay; cue chưa dịch giữ text rỗng; `onComplete` chỉ fire một lần khi queue hoàn tất.
11. Select translated entry load đúng stored cues; select auto/imported sau đó vẫn hoạt động.
12. SPA navigation clear prefill + translated slot/cues/run identity.
13. No target hoặc ngôn ngữ thiếu/trùng nhau không gửi `TRANSLATE`.

### Regression

- `toggle-translate` vẫn start/stop live prefill theo behavior cũ.
- Auto-translate vẫn hoạt động khi native missing.
- Import/select target/native và Card Creator Quick/Edit không đổi.
- Existing shortcut remapping tiếp tục hot-reload không reload page.

### Browser verification

Trên Edge/Chrome thật:

1. Load video có target, không native → click button → native line xuất hiện dần; manager có một translated entry.
2. Trigger lại bằng shortcut → không duplicate; nội dung được regenerate.
3. Load/import native, chọn nó, generate → active slot đổi thành translated và overlay đổi theo.
4. SPA navigate sang video khác → translated entry video cũ biến mất.
5. Kiểm keyboard focus, tooltip, disabled state, responsive scaling trên viewport desktop và mobile/tablet giả lập.

## 8. Boundaries

### Always

- Reuse `BackgroundPrefillController`, `TRANSLATE`, `loadBilingualCues`, shortcut matcher và cluster styles hiện có.
- Button + shortcut đi qua một action handler.
- Cancel run cũ trước khi overwrite để response cũ không ghi đè run mới.
- Dùng run identity/token hoặc guard tương đương nếu `clear()` chưa đủ ngăn stale async callback.
- Update `docs/2-architechture-system.md` khi sửa `src/`.
- Chạy unit, typecheck, lint và browser verify trước khi hoàn tất.

### Ask first

- Thêm dependency, provider dịch, storage persistence hoặc message type mới.
- Đổi default shortcut khỏi `g`.
- Đổi behavior của `toggle-translate` hoặc auto-translate.
- Sửa manifest.

### Never

- Persist generated cues hoặc giữ chúng qua SPA navigation.
- Tạo pipeline dịch thứ hai.
- Gửi subtitle tới endpoint khác.
- Xóa native detected/imported khỏi nguồn dữ liệu nền; overwrite chỉ là state manager in-memory của video session.
- Để callback từ run cũ overwrite run mới.

## 9. Success Criteria

- **F1:** Button Generate native subtitle là button cuối right column, cùng visual system với cluster; icon nhận ra là translation ở kích thước button nhỏ và tuân thủ SVG style contract.
- **F2:** Click button hoặc shortcut configurable `generate-native` chạy cùng một handler; default shortcut là `g`.
- **F3:** Handler dịch target active sang configured native language bằng pipeline hiện có và feed overlay theo chunk.
- **F4:** Manager có đúng một translated entry cho run hiện tại, badge `TRANSLATED`, active sau khi generate.
- **F5:** Không có native → tạo; có native active bất kỳ source → overwrite đúng active slot; trigger lần hai → replace, không duplicate.
- **F6:** Stale callback từ run cũ không thể ghi vào run mới.
- **F7:** SPA navigation clear generated entry và prefill state; reload/tab close cũng mất do in-memory.
- **F8:** Invalid preconditions không gửi request; UI/shortcut đưa feedback accessible.
- **F9:** Auto-translate, toggle-translate, import/select subtitle và Card Creator không regression.
- **Q1:** `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build` pass.
- **Q2:** Browser verification trên Edge/Chrome pass ở desktop và mobile/tablet responsive viewport.

## 10. Open Questions

Không còn blocker requirement. Các chi tiết icon path và cách lưu slot nội bộ được quyết định ở BUILD, nhưng phải thỏa UI/data contract và tests ở trên.
