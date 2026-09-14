# Spec: Queue Lazy Dictionary Lookup

## 1. Objective

Chuyển flow **Send to Card** và **Quick Add** từ "lookup toàn bộ unknown words trước khi mở panel" sang "mở Queue ngay lập tức, chỉ lookup khi user click từ trong Queue". Tất cả kết quả cuối cùng vẫn phải chảy qua **Dictionary → Card Creator/Anki**. Mục tiêu loại bỏ delay "recording" khi có nhiều unknown words (ví dụ 10 từ), đồng thời giữ nguyên UI/UX hiện tại.

### User stories

- **US-1:** Là người xem video, khi nhấn "Send to Card" ở subtitle overlay, tôi muốn panel mở ngay với danh sách unknown words, không phải chờ lookup.
- **US-2:** Là người tra popup dictionary, khi nhấn "Send to Card" hoặc "Quick Add", tôi muốn cùng mở Queue với các từ trong câu đang tra.
- **US-3:** Là người dùng, khi click một từ trong Queue, tôi muốn Dictionary tab lookup từ đó.
- **US-4:** Là người dùng, từ Dictionary tôi muốn nhấn "Send to Card" để điền form hoặc "Quick Add" để tự động thêm vào Anki.

---

## 2. Tech Stack

- TypeScript 5.x + React 18
- Zustand (`src/stores/cardCreatorStore.ts`)
- Chrome MV3 messaging (`src/shared/lib/chrome-apis`)
- Existing dictionary lookup (`src/features/dictionaryPopup/ui/useDictionaryLookup.ts`)
- Existing Card Creator / Queue UI (không thay đổi component cơ bản)

---

## 3. Commands

```bash
# Typecheck
npm run typecheck

# Unit tests
npm run test:unit

# Build (bắt lỗi Vite mà tsc không thấy)
npm run build

# E2E smoke (queue + dictionary)
npx playwright test e2e/stage2/card-creator-queue-select.spec.ts

# Real Chrome verify (nếu cần)
npm run test:chrome
```

---

## 4. Project Structure

| Path | Vai trò |
|------|---------|
| `src/features/subtitle/actions/cardActions.ts` | Tokenize, build queue, capture media, gọi `sendToCard` |
| `src/features/dictionaryPopup/controller/webTextDictionaryController.ts` | `sendToCard` / popup actions từ popup dictionary |
| `src/features/universalPanel/tabs/DictionaryTab.tsx` | Điều phối Dictionary (trái) + Card Creator/Queue (phải) |
| `src/features/universalPanel/tabs/CardCreatorPanel.tsx` | Nhận prefill, render Card Creator |
| `src/features/cardCreator/ui/useCardCreatorState.ts` | Khởi tạo form từ queue/prefill |
| `src/features/cardCreator/ui/CardCreatorDialogContent.tsx` | Render Queue sidebar/panel |
| `src/stores/cardCreatorStore.ts` | `selectQueueItem`, queue state |
| `src/entities/cardCreator/types.ts` | `CardCreatorQueueItem` |
| `src/features/cardCreator/types.ts` | `CardCreatorOpenContext`, `CardCreatorPrefill` |
| `tests/...` | Unit tests cập nhật cho `buildSubtitleQueue` và queue state |
| `e2e/stage2/card-creator-queue-select.spec.ts` | E2E cần cập nhật theo flow mới |

---

## 5. Code Style

- Function component + named export.
- Không `any`.
- Pure functions tách khỏi side effect.
- Không comment — code tự giải thích qua tên.
- SSOT: queue item shape một nơi, prefill shape một nơi.
- Prefer `readonly` arrays.

---

## 6. Data Flow

### Flow mới tổng quát

```
User nhấn Send to Card / Quick Add
  → tokenize + getWordStatuses (nhanh, không lookup)
  → build queue: { term, status }[] (không definitions)
  → capture media (screenshot + sentence audio) — song song, non-blocking
  → open panel với queue

User click từ trong Queue
  → Dictionary tab set initialTerm = term
  → Dictionary lookup term đó
  → Hiển thị kết quả (definitions, audio, image, translation)

User nhấn Send to Card (pencil) trong Dictionary
  → buildPrefill(candidate + selection)
  → set prefill cho Card Creator panel
  → Card Creator form được điền đầy đủ

User nhấn Quick Add (zap) trong Dictionary
  → buildPrefill(candidate + selection)
  → set prefill với initialAction: 'quick-add'
  → Card Creator panel tự động submit khi load xong
```

### Chi tiết từng nguồn

#### A. Subtitle overlay (`cardActions.ts`)

`handleCardCreatorAction` giữ nguyên capture media, nhưng `buildSubtitleQueue` chỉ trả về `{ term, status }` (không `definitions`). Sau đó gọi `ctx.webTextCtrl.sendToCard({ ...cardCtx, initialMedia, queue }, initialAction)`.

#### B. Popup dictionary (`webTextDictionaryController.ts`)

`handlePopupCardCreatorAction` và popup Quick Add đều build queue từ `prefill.contextSentence` (hoặc `cue.targetText`) bằng cùng hàm `buildQueueFromSentence`. Không còn truyền `definitions` sẵn trong `context.prefill`. `sendToCard(context, action, prefill)` gửi queue + selection vào panel.

#### C. Universal Panel (`DictionaryTab.tsx`)

`DictionaryTab` quản lý state `prefill: DictionaryPanelPrefill | null`. `CardCreatorPanel` nhận `context={prefill}` và callback `onQueueTermSelect(term)`.

Khi user click item trong Queue:
- `CardCreatorPanel` gọi `onQueueTermSelect(item.term)`
- `DictionaryTab` cập nhật `prefill.term = item.term`, giữ `contextSentence`, `translation`, `queue`, `initialMedia`
- `Dictionary` component nhận `initialTerm={prefill.term}` và tự lookup

#### D. Dictionary → Card Creator

`DictionaryTab` cung cấp `onSendToCard` và `onQuickAdd` cho `Dictionary`:
- `onSendToCard(next)`: `setPrefill({ ...next, initialAction: undefined })`
- `onQuickAdd(next)`: `setPrefill({ ...next, initialAction: 'quick-add' })`

`CardCreatorPanel` convert `prefill` thành `OpenContext` cho `useCardCreatorState`. Nếu `initialAction === 'quick-add'`, `CardCreatorPanelCore` effect auto-submit.

---

## 7. Testing Strategy

### Unit tests

- `buildSubtitleQueue` trả về queue không có `definitions`.
- `buildSubtitleQueue` không gọi `LOOKUP_REQUEST`.
- `selectQueueItem` cập nhật `targetWord` và `definitions = ''`.
- `DictionaryTab` cập nhật `prefill.term` khi `onQueueTermSelect`.
- `Dictionary` lookup khi `initialTerm` thay đổi.

### E2E

- Cập nhật `e2e/stage2/card-creator-queue-select.spec.ts`:
  - Sau khi click Queue item, **Dictionary** hiển thị từ đó (chứ không phải form Card Creator tự điền definitions ngay).
  - Click "Send to Card" trong Dictionary → form Card Creator điền definitions.
- Thêm E2E cho popup dictionary: double-click từ → Send to Card → Queue mở → click từ → Dictionary lookup → Send to Card → form điền.

---

## 8. Boundaries

### Always do
- Tách lookup ra khỏi `buildSubtitleQueue`.
- Giữ media capture non-blocking.
- Reuse `Dictionary`/`CandidateView`/`useCandidate` hiện có.
- Cập nhật tests ngay khi thay đổi behavior.

### Ask first
- Thay đổi `CardCreatorQueueItem` shape.
- Thêm dependency.
- Thay đổi message type / background API.

### Never do
- `Promise.all` lookup hàng loạt trong flow mới.
- Commit secrets.
- Xóa test cũ mà không thay thế.

---

## 9. Success Criteria

1. [ ] Nhấn "Send to Card" từ subtitle overlay mở panel trong < 500ms (không chờ lookup).
2. [ ] Queue hiển thị đúng danh sách `unknown`/`tracking` words với status badge, không có definitions.
3. [ ] Click từ trong Queue kích hoạt Dictionary lookup từ đó.
4. [ ] Nhấn "Send to Card" trong Dictionary điền Card Creator form với definitions/audio/image/translation.
5. [ ] Nhấn "Quick Add" trong Dictionary tự động thêm từ vào Anki.
6. [ ] Popup dictionary "Send to Card" và "Quick Add" cũng mở Queue (dựa trên câu chứa từ đang tra).
7. [ ] `buildSubtitleQueue` unit test pass với queue không definitions.
8. [ ] `npm run typecheck && npm run test:unit && npm run build` pass.

---

## 10. Definition of Done

- [ ] Spec được review (không cần human blocking — async veto).
- [ ] Tất cả acceptance criteria pass.
- [ ] Unit/integration tests pass.
- [ ] Build, lint, typecheck pass.
- [ ] E2E queue-select cập nhật và pass.
- [ ] UI audit bằng `design-system-guardian` nếu chạm CSS.
- [ ] `docs/2-architecture-system.md` cập nhật nếu data flow thay đổi đáng kể.
- [ ] `docs/0-wiki.md` cập nhật danh mục spec.

---

## 11. Open Questions / Accepted Risks

1. **Standalone Card Creator dialog fallback (không có universal panel):** Khi `deps.panelController` không tồn tại, `openStandaloneCardCreator` hiện mở dialog không có Dictionary. Để tất cả chảy qua Dictionary, cần mở popup dictionary khi click từ trong queue của standalone dialog. Lần này ưu tiên integrated panel; standalone dialog giữ nguyên hoặc được xử lý trong follow-up.
2. **Quick Add từ popup dictionary hiện là batch direct add:** Sau thay đổi, popup Quick Add sẽ mở Queue và yêu cầu user click từ + nhấn Quick Add trong Dictionary. Đây là behavior mới, cần E2E và UX validation.
3. **Queue từ popup dictionary:** `contextSentence` của popup có thể ngắn hoặc chỉ là một cụm từ. `tokenizeSubtitleWords` sẽ trích xuất các từ đủ dài. Nếu `contextSentence` không có unknown word khác, queue có thể chỉ có 1 item.
4. **E2E cũ `card-creator-queue-select.spec.ts` sẽ fail** vì behavior click queue item thay đổi (không còn tự điền form ngay). Cần cập nhật test.
