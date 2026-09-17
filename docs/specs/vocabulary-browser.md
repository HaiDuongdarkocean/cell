# Spec — Vocabulary Browser (Quản lý Từ vựng)

> Intent: `docs/intent/vocabulary-browser.md` (8-field frame confirmed 2026-09-17, doubt-driven r1 reconciled).
> Backlog `#3` · Cost M · Value ★5 · Infra: wordStatusStore, statusKeyControls.
> Backlog row: `docs/ideas/product-backlog.md` #3 `vocabulary-browser`.

## 1. Phạm vi

**User story**: As a language learner, I want to see and manage every word I've marked, so that từ không "biến mất" sau lookup — xem lại vốn từ, sửa mis-mark, và jump sang dictionary khi cần.

Tab mới **"Vocabulary"** trong UniversalPanel list toàn bộ rows của `langWordStatus` store cho active profile language. Store chỉ chứa từ đã mark (explicit), kể cả `status='unknown'` do user cố ý chấm — **khác với "chưa từng chạm"** (không có row). Empty state chỉ khi store rỗng.

**Vocabulary semantics** (chốt từ doubt review):
- `setWordStatus`/'1'-'4' hotkey → upsert row → từ xuất hiện trong browser.
- `deleteWordStatus` → xóa row = "unmark" → từ biến khỏi browser, lookup lại sẽ thấy `DEFAULT_STATUS` unknown.
- Delete ≠ set 'unknown': 'unknown' là một marked-state hợp lệ (chip riêng trong filter).

## 2. Message layer (delta)

Convention: mọi payload `{ tabId: z.number().int(), langCode: z.string().length(2), ... }`; content script để `messageBus` inject `sender.tab.id`, extension page dùng `tabId: -1` placeholder (theo `wordStatusClient.ts:25,45`).

| Type | Payload | Response | Side effect |
|---|---|---|---|
| `WORD_STATUS_LIST` | `{tabId, langCode}` | `{entries: {term,status,updatedAt}[]}` | — |
| `WORD_STATUS_CYCLE` | `{tabId, langCode, term}` | `{status}` | `cycleWordStatus` atomic ở background + broadcast `WORD_STATUS_CHANGED` |
| `WORD_STATUS_DELETE` | `{tabId, langCode, term}` | `{success}` | `deleteWordStatus` + broadcast `WORD_STATUS_DELETED` |
| `WORD_STATUS_DELETED` (broadcast) | `{tabId, langCode, term}` | — | relay → `emitWordStatusRemoved` local bus |

Schemas mới trong `dictionarySchemas.ts` + `MESSAGE_TYPES` + `MessageType` union + `registry.ts`. Handler mở rộng `background/handlers/wordStatus.ts` — `broadcastWordStatusChanged` tái dùng cho cả DELETED (tham số hóa type, filter source tab giữ nguyên).

**Store helper**: `getAllWordStatuses(langCode): Promise<WordStatusEntry[]>` — `store.getAll()` trên `langWordStatus`, background-only (`wordStatusStore.ts`).

**langCode normalize — fix root tại `wordStatusClient`** (single shared point): mọi method client (`getWordStatuses`, `setWordStatus`, + 3 method mới) normalize `langCode.split('-')[0].toLowerCase()`, `''→'en'`. Fix bug hiện hữu: hotkey gửi raw `zh-hans` → schema `length(2)` reject → mark bị swallow (`webTokenizeController.ts:775` `.catch(()=>{})`). Vocab browser đọc lang = `normalize(subtitleOverlayTargetLanguage)` — khớp với nơi popup/tokenize ghi sau khi client normalize.

**Local event bus** (`wordStatusEvents.ts`): thêm `WordStatusRemovedDetail {langCode, term}` + `emitWordStatusRemoved`/`onWordStatusRemoved`. `startWordStatusCrossTabRelay` relay thêm `WORD_STATUS_DELETED` → emit removed. UI actions (cycle/delete trong panel) emit lên bus local sau khi response success — same-tab listeners (token underline, CueList, list itself) update ngay không cần broadcast quay về (broadcast skip source tab by design, `wordStatus.ts:39`).

## 3. Kiến trúc

```
langWordStatus (background IDB, per-lang DB)
   ▲ WORD_STATUS_LIST / CYCLE / DELETE          ▲ SET (popup, hotkeys)
   │                                             │
wordStatusClient (normalize langCode — shared point)
   │
   ▼
features/vocabulary/
  logic/vocabularyList.ts        — pure: filter+search+sort (3 modes), applyEvent(entry|removed)
  services/vocabularySource.ts   — LIST fetch + onWordStatusChanged/onWordStatusRemoved subscribe,
                                   buffer-during-await → replay (snapshot/event ordering)
  ui/VocabularyTab.tsx           — chips + SearchField + sort Select + paginated list
   │
   ▼ tab threading (6 sites — review finding #5)
universalPanel/types.ts (union) · UniversalPanel.tsx (TABS) · UniversalPanelBottomNav.tsx
(union + TABS riêng — KHÔNG derive, phải sửa tay) · mountUniversalPanel.ts (restorePersistedTab
whitelist + vocabularyPanel wiring) · UniversalPanelController.ts (whitelist thứ 2)
```

**Snapshot/event race**: `vocabularySource` subscribe cả 2 event TRƯỚC khi `await WORD_STATUS_LIST` → buffer events → sau khi snapshot về, replay buffer (dedupe theo term — event mới nhất thắng) → publish store. Pattern giống comprehension-score spec §3.

**Live update**: `onWordStatusChanged` → upsert `{term,status,updatedAt:Date.now()}` (CHANGED payload không có updatedAt — local timestamp chấp nhận được, refetch sẽ chuẩn hóa). `onWordStatusRemoved` → remove row. **Event `langCode` normalize giống client** trước khi compare/upsert — emitters gửi langCode gốc (popup `detectLangCode` 'zh', hotkey raw profile lang), nếu không normalize thì zh-family miss dù persistence đã đúng DB.

**Profile switch**: `dictionaryLangCode` đã re-resolve trong `mountUniversalPanel.onProfileChange` (`mountUniversalPanel.ts:238-253`) — VocabularyTab nhận `langCode` prop, prop đổi → source refetch + reset filter/scroll.

**Tab unmount**: `UniversalPanel.tsx:247-249` conditional render → tab remount mỗi lần switch → source refetch (data fresh là feature, không phải bug); filter/query/sort state giữ trong feature-level zustand nhỏ nếu muốn survive — v1 giữ trong component state, accepted reset (intent §9 #9).

**Lookup jump**: `controller.openDictionaryLookup(term)` — method mới trên `UniversalPanelController` interface: set `pendingSearchTerm` (KHÔNG đụng `pendingCardCreatorContext`) + `open('dictionary')`. `DictionaryTab` đã nhận `initialTerm` → lookup chạy, card-creator draft không bị arm, không replay on reopen (`pendingSearchTerm` là one-shot, clear ở `clearPendingOneShots`/`onClose`).

## 4. UI

- `features/vocabulary/ui/VocabularyTab.tsx` — header row: 4 `Chip` filter (unknown/tracking/known/ignore, toggle multi-select, default all-on) + `SearchField` + `Select` sort (Recent/A–Z/Grouped).
- Row = `ListItem`: term (click → lookup) + `updatedAt` (`Timestamp` component) + status `Badge`/`StatusDot` (click → cycle, aria-label đầy đủ) + delete `IconButton` (icon `bin`/`close` — check ICON_CATALOG).
- List: `Pagination` component (shared/ui sẵn có), page size 200 — không virtualization lib (0 dep mới); scroll trong `Scrollable`. 5000 rows → 25 pages, render ≤200 DOM rows. **Live event × pagination**: mỗi event re-derive filtered+sorted list từ entries, `pageIndex` clamp vào range mới (xóa hết page cuối → lùi về page hợp lệ, không trang trắng); user đứng page N vẫn giữ page N trừ khi out-of-range.
- Delete: `Dialog` confirm nhẹ ("Remove {term} from vocabulary?" / "Bỏ {term} khỏi từ vựng?"), không undo v1 (accepted — intent §4); sau delete focus return về row kế hoặc search field.
- Empty state: `EmptyState` "Chưa có từ nào được mark" + filtered-empty variant.
- Tab icon: check ICON_CATALOG — `collection` hoặc `book` (dictionary đang dùng `bookOpen`); label i18n `vocabulary.tab`.
- i18n keys `vocabulary.*` en/vi: tab label, filter labels, sort labels, empty states, aria-labels ("Cycle status for {term}", "Remove {term}").
- Status colors: dùng status palette hiện hữu (`tokenSpanCss` status colors / tokens) — không hardcode màu.
- Quota error từ cycle → toast convention hiện hữu (check `useToast`/toast util trước khi implement).

## 5. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| A1 | 3 từ marked (1 tracking, 2 known) | mở tab Vocabulary | 3 rows đúng term/status/updatedAt |
| A2 | filter chip 'tracking' | click | chỉ row tracking; chips multi-toggle |
| A3 | search 'pen' | gõ | substring match, case-insensitive |
| A4 | sort A–Z / grouped / recent | switch | order đúng; grouped = 4 section theo status |
| A5 | click status badge tracking | — | `WORD_STATUS_CYCLE` → known, row update, `getWordStatus` confirm known |
| A6 | click term | — | Dictionary tab mở, term trong search, lookup chạy, card-creator context KHÔNG đổi |
| A7 | delete row | confirm | `WORD_STATUS_DELETE` → row biến mất, `getWordStatus` trả unknown |
| A8 | panel đang mở, mark từ mới từ popup same-tab | — | row mới xuất hiện (local bus) |
| A9 | mark từ từ tab khác | — | row update (cross-tab relay) |
| A10 | delete từ tab khác | — | row biến mất (DELETED relay → removed bus) |
| A11 | LIST in-flight, event đến trong await | — | event buffer + replay — không mất |
| A12 | store rỗng | — | empty state; store chỉ có explicit-unknown → rows hiện |
| A13 | `zh-hans` profile | hotkey mark | persist vào DB `zh` (client normalize), list thấy |
| A14 | 5000 rows | mở tab | first render <3s, paginate ≤200/page |
| A15 | profile switch | — | list refetch lang mới |
| A16 | mobile ≤768px | — | bottom nav có tab Vocabulary (finding #5 — whitelist không derive) |
| A17 | reopen panel → persisted 'vocabulary' | — | restore đúng tab (cả 2 whitelist updated) |
| A18 | đang ở page cuối, event xóa hết rows của page đó | — | pageIndex clamp → page hợp lệ, không trắng |
| A19 | event langCode 'zh-hans' (emitter raw) với list lang 'zh' | — | normalize trước compare → row vẫn update |

## 6. Test plan

- Unit `vocabularyList.test.ts`: filter/search/3 sort modes/applyEvent upsert+remove/dedupe-replay.
- Unit `vocabularySource.test.ts`: mock sendMessage + bus — snapshot ordering (A11), removed event, lang normalize (A19).
- Unit `wordStatusClient` normalize: `'zh-hans'→'zh'`, `'ZH'→'zh'`, `''→'en'` — áp cho cả 5 method.
- Unit `vocabularyList` pagination: insert/delete → clamp pageIndex (A18).
- Handler test `wordStatus.test.ts` mở rộng: LIST trả entries, CYCLE atomic trả status mới + broadcast, DELETE + broadcast DELETED.
- Component `VocabularyTab.test.tsx`: render rows, chip toggle, badge click → cycle call, delete confirm, empty states, term click → callback.
- Mount wiring test: persisted 'vocabulary' restore (A17), `openDictionaryLookup` không arm card-creator.
- Real-Chrome smoke theo `testing-extension-browser` sau wiring: mở panel → tab Vocabulary → mark từ trên page → row xuất hiện.

## 7. Boundaries & DoD

- Always: `npm run typecheck && npm run lint && npm run test:unit && npm run build` trước commit; named export; không comment; reuse `src/shared/ui/` + tokens; i18n en/vi cho text mới.
- Ask first: manifest change (KHÔNG cần), dependency mới (KHÔNG cần), settings schema (KHÔNG cần).
- Never: fake shipped khi gate đỏ; đọc IDB từ UI; reuse `sendToCard` cho lookup jump.
- DoD: A1–A17 pass · gates xanh · `docs/2-architechture-system.md` updated · spec link vào backlog row · smoke Chrome thật.

## 8. Success criteria

- User mở tab thấy hết từ đã mark trong <3s, sửa/xóa/lookup không rời panel.
- Không regression: hotkey mark, popup cycle, cross-tab broadcast hoạt động như cũ (+ zh-hans fix).

## 9. Alternatives considered

- **Extension page riêng** (kiểu srs-study): rejected v1 — rời context đang học; panel tab mở được mọi trang có content script. Upgrade path: share `VocabularyTab` vào launcher-dashboard/reader.
- **Set 'unknown' thay delete row**: rejected — semantic khác nhau (explicit-unknown vs unmarked), và CHANGED không biểu diễn được delete (finding #2).
- **Client-side cycle (GET→SET)**: rejected — 2 round-trip + race; `WORD_STATUS_CYCLE` atomic ở background rẻ hơn và fix luôn stale-read.
- **Virtualization lib**: rejected — 0-dep rule; `Pagination` sẵn có đủ cho ≤ vài nghìn rows; upgrade path content-visibility/virtualizer nếu list vượt 10k.
- **derive BottomNav TABS từ union type**: không làm được (type-level), nhưng spec bắt buộc test A16/A17 để bắt silent-drop regression.
- **Giữ filter/sort state trong zustand để survive unmount**: rejected v1 — refetch-on-mount cho data fresh, state reset accepted (intent §9 #9).

## 10. Open questions / accepted risks

- `detectLangCode` binary en/zh: ja/ko marks từ web-text popup lưu vào DB `zh` — system bug hiện hữu, browser sẽ show từ ja dưới lang zh khi profile là zh; fix detectLangCode ngoài scope (touch mọi writer). Documented.
- Term surface vs headword mismatch: tokenize mark surface, popup mark headword → cùng "từ" có thể 2 rows — system ceiling hiện hữu (giống comprehension-score §10). Documented.
- Cross-context → extension pages: `WORD_STATUS_CHANGED/DELETED` broadcast đi qua content-script tabs; reader/local-player/sidepanel (extension pages) không nhận relay — accepted v1 (comprehension-score §10 cùng gap). Panel mount ở content page là context chính.
- Quota error UX: toast "Bộ nhớ đầy" reuse convention `WordStatusQuotaError` message sẵn có.
- `WORD_STATUS_LIST` unbounded `getAll`: ceiling ~10k rows ≈ vài MB message payload — chấp nhận được (term ≤200 chars enforced at write); nếu vượt → key-range paging sau.
- `Timestamp` component: check i18n relative-time trước khi dùng; nếu chưa localize → hiện absolute date.

## Elicitation revision log

- r0 2026-09-17: draft từ confirmed 8-field frame.
- r1 2026-09-17: doubt-driven fresh-context review → 14 findings (1 blocker: no delete message; 4 major: delete-broadcast ambiguity, same-tab via local bus, langCode inconsistency, 6-site tab threading) → reconciled vào intent §9 + spec §2/§3/§5.
- r2 2026-09-17: spec-review-stakeholder APPROVE WITH CHANGES → event langCode normalize ở source (A19), pagination×live-event clamp (A18), delete confirm copy + focus return, normalize unit tests, getAll ceiling note.
