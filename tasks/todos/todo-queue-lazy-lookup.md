# Todo: Queue Lazy Dictionary Lookup

## Task 1: Tách `buildSubtitleQueue` thành queue không definitions

**Description:** Sửa `buildSubtitleQueue` trong `src/features/subtitle/actions/cardActions.ts` để chỉ tokenize + lấy status, không còn `Promise.all` lookup. Tách lookup riêng thành `lookupQueueTerm`.

**Acceptance criteria:**
- [ ] `buildSubtitleQueue` trả về `CardCreatorQueueItem[]` với `term` và `status`, `definitions` là chuuỗi rỗng.
- [ ] `buildSubtitleQueue` không gọi `LOOKUP_REQUEST`.
- [ ] `lookupQueueTerm(term, sourceLang, contextSentence)` thực hiện single lookup.

**Verification:**
- [ ] `npm run test:unit -- src/features/subtitle/actions/cardActions.test.ts` pass.
- [ ] `npm run typecheck` pass.

**Dependencies:** None

**Priority:** P0

**Parallel:** false

**Blocked strategy:** wait

**Files likely touched:**
- `src/features/subtitle/actions/cardActions.ts`
- `src/features/subtitle/actions/cardActions.test.ts`
- `src/entities/cardCreator/types.ts` (nếu `definitions` cần optional)

**Estimated scope:** Small

---

## Task 2: Sửa `useCardCreatorState` khởi tạo form từ queue rỗng

**Description:** Khi `CardCreatorOpenContext.queue` tồn tại, `useCardCreatorState.loadData` khởi tạo `targetWord` từ queue item đầu, `definitions` rỗng. `selectQueueItem` cũng set `definitions` rỗng thay vì từ `item.definitions`.

**Acceptance criteria:**
- [ ] Khi mở với queue, `draft.fields.definitions` rỗng.
- [ ] `selectQueueItem` không tự generate/lookup definitions.
- [ ] `selectQueueItem` cập nhật `targetWord` và `definitions = ''`.

**Verification:**
- [ ] `npm run test:unit -- src/features/cardCreator/ui/useCardCreatorState.test.ts` pass.
- [ ] `npm run test:unit -- src/stores/cardCreatorStore.test.ts` pass.

**Dependencies:** 1

**Priority:** P0

**Parallel:** false

**Blocked strategy:** wait

**Files likely touched:**
- `src/features/cardCreator/ui/useCardCreatorState.ts`
- `src/stores/cardCreatorStore.ts`
- `src/features/cardCreator/ui/useCardCreatorState.test.ts`
- `src/stores/cardCreatorStore.test.ts`

**Estimated scope:** Small

---

## Task 3: Thêm `onQueueTermSelect` callback vào `CardCreatorPanel` + Queue UI

**Description:** `CardCreatorPanel` nhận prop `onQueueTermSelect?(term: string): void`. Truyền xuống `CardCreatorDialogContent`, `QueueSidePanel`, `QueueSidebar`. Khi click item trong Queue, gọi `onQueueTermSelect(item.term)` thay vì chỉ `selectQueueItem`.

**Acceptance criteria:**
- [ ] `CardCreatorPanelProps` có `onQueueTermSelect`.
- [ ] `QueueSidebar` gọi `onQueueTermSelect` khi click item.
- [ ] `selectQueueItem` vẫn được gọi để cập nhật active index.

**Verification:**
- [ ] `npm run test:unit -- src/features/cardCreator/ui/QueueSidebar.test.tsx` pass.
- [ ] `npm run typecheck` pass.

**Dependencies:** 2

**Priority:** P0

**Parallel:** false

**Blocked strategy:** wait

**Files likely touched:**
- `src/features/universalPanel/tabs/CardCreatorPanel.tsx`
- `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`
- `src/features/cardCreator/ui/QueueSidePanel.tsx`
- `src/features/cardCreator/ui/QueueSidebar.tsx`
- `src/features/cardCreator/ui/QueueSidebar.test.tsx`

**Estimated scope:** Medium

---

## Task 4: Sửa `DictionaryTab` cập nhật `prefill.term` khi chọn queue item

**Description:** `DictionaryTab` quản lý state `prefill` và truyền `onQueueTermSelect` vào `CardCreatorPanel`. Khi nhận `term`, cập nhật `prefill.term`. `Dictionary` component tự lookup khi `initialTerm` thay đổi. `onSendToCard` / `onQuickAdd` từ `Dictionary` cập nhật `prefill` với dữ liệu đầy đủ.

**Acceptance criteria:**
- [ ] Click queue item cập nhật `prefill.term`.
- [ ] `Dictionary` lookup term mới.
- [ ] "Send to Card" trong Dictionary set `prefill` cho Card Creator.
- [ ] "Quick Add" trong Dictionary set `prefill` với `initialAction: 'quick-add'`.

**Verification:**
- [ ] `npm run test:unit -- src/features/universalPanel/tabs/DictionaryTab.test.tsx` pass (nếu có).
- [ ] `npm run typecheck` pass.

**Dependencies:** 3

**Priority:** P0

**Parallel:** false

**Blocked strategy:** wait

**Files likely touched:**
- `src/features/universalPanel/tabs/DictionaryTab.tsx`

**Estimated scope:** Medium

---

## Task 5: Sửa popup dictionary `sendToCard` / `quickAdd` để build queue

**Description:** `webTextDictionaryController.handlePopupCardCreatorAction` và `handlePopupAnkiQuickAdd` build queue từ `prefill.contextSentence` (hoặc `cue.targetText`) bằng `buildQueueFromSentence`. Không còn điền definitions sẵn trong `context.prefill`. Gọi `sendToCard(context, action, prefill)`.

**Acceptance criteria:**
- [ ] Popup "Send to Card" mở panel với queue chưa definitions.
- [ ] Popup "Quick Add" mở panel với queue và `initialAction: 'quick-add'`.
- [ ] Queue chứa các unknown/tracking words từ câu chứa từ đang tra.

**Verification:**
- [ ] `npm run test:unit -- src/features/dictionaryPopup/controller/webTextDictionaryController.test.ts` pass.
- [ ] `npm run typecheck` pass.

**Dependencies:** 1

**Priority:** P1

**Parallel:** true (files disjoint from Tasks 3-4)

**Blocked strategy:** mock-contract

**Files likely touched:**
- `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
- `src/features/dictionaryPopup/controller/webTextDictionaryController.test.ts`

**Estimated scope:** Medium

---

## Task 6: Cập nhật unit tests

**Description:** Cập nhật và bổ sung unit tests cho `buildSubtitleQueue`, queue select, `DictionaryTab` prefill update.

**Acceptance criteria:**
- [ ] `buildSubtitleQueue` test xác nhận không lookup.
- [ ] `selectQueueItem` test xác nhận definitions rỗng.
- [ ] `DictionaryTab` test xác nhận `initialTerm` thay đổi khi queue item selected.

**Verification:**
- [ ] `npm run test:unit` pass.

**Dependencies:** 4, 5

**Priority:** P1

**Parallel:** false

**Blocked strategy:** wait

**Files likely touched:**
- `src/features/subtitle/actions/cardActions.test.ts`
- `src/features/cardCreator/ui/useCardCreatorState.test.ts`
- `src/stores/cardCreatorStore.test.ts`
- `src/features/universalPanel/tabs/DictionaryTab.test.tsx` (nếu cần tạo)

**Estimated scope:** Medium

---

## Task 7: Cập nhật E2E `card-creator-queue-select.spec.ts`

**Description:** Cập nhật E2E để phản ánh flow mới: click queue item → Dictionary lookup, sau đó nhấn "Send to Card" trong Dictionary mới điền Card Creator form.

**Acceptance criteria:**
- [ ] E2E pass với flow mới.
- [ ] Xác nhận Dictionary hiển thị từ đang chọn sau khi click queue item.
- [ ] Xác nhận Card Creator form được điền sau khi nhấn "Send to Card" trong Dictionary.

**Verification:**
- [ ] `npx playwright test e2e/stage2/card-creator-queue-select.spec.ts` pass.

**Dependencies:** 4

**Priority:** P1

**Parallel:** false

**Blocked strategy:** wait

**Files likely touched:**
- `e2e/stage2/card-creator-queue-select.spec.ts`

**Estimated scope:** Medium

---

## Task 8: Chạy full verification

**Description:** Chạy `typecheck`, `test:unit`, `build` và `testing-extension-browser` nếu cần.

**Acceptance criteria:**
- [ ] `npm run typecheck` pass.
- [ ] `npm run test:unit` pass.
- [ ] `npm run build` pass.
- [ ] Real Chrome smoke test pass (nếu có).

**Verification:**
- [ ] `npm run typecheck && npm run test:unit && npm run build`

**Dependencies:** 6, 7

**Priority:** P0

**Parallel:** false

**Blocked strategy:** wait

**Files likely touched:** None (verification only)

**Estimated scope:** Small
