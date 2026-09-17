# Intent — Vocabulary Browser (Quản lý Từ vựng)

> Confirmed statement of intent cho nhóm quản lý từ đã mark.
> Backlog item: `vocabulary-browser` (docs/ideas/product-backlog.md #3).
> Source: asbplayer (sidebar word list), internal gap.
> Confirmed: 2026-09-17 qua elicitation — 1 observation/interview round, Anh yêu duyệt frame sau khi agent tự suy luận surface/data-flow.
> r1 2026-09-17: doubt-driven fresh-context review → 14 findings reconciled (xem §9).

## 1. Outcome

Một chỗ thấy hết từ đã mark status — filter theo status, search, sort (recent/alpha/grouped), sửa mis-mark, jump sang dictionary lookup — thay vì từ "biến mất" sau khi chấm.

## 2. User

- Immersion learner đang tích lũy wordStatus qua popup cycle + `statusKeyControls` hotkey.
- Muốn xem lại vốn từ đã mark và sửa mis-mark mà không cần chờ gặp lại từ đó.
- Persona 5–80 tuổi → list phải glanceable, action lớn rõ, không dense power-UI mặc định.

## 3. Why now

- Hiện tại: mark xong data nằm trong `langWordStatus` IDB nhưng không UI nào đọc — review/sửa bất khả thi trừ khi lookup lại đúng từ.
- Infra gần đủ: store `{term,status,updatedAt}` + index `by_status`; `WORD_STATUS_SET` + broadcast + local `onWordStatusChanged` bus đã ship; UniversalPanel có tab infra sẵn. Delta thật = 3 message mới (list/cycle/delete) + 1 broadcast type + 1 tab UI (xem §9 — review vạch "1 message" là underestimate).

## 4. Success

- UniversalPanel có tab "Vocabulary": load list từ của active profile lang trong <3s.
- Filter chips 4 status, ô search substring, sort switch 3 mode: recent (updatedAt desc) / alphabetical / grouped-by-status.
- Click status badge trên row → `WORD_STATUS_CYCLE` (atomic ở background, tránh read-modify-write race) → row update không reload.
- Click term → switch sang Dictionary tab với term prefilled → lookup chạy (path riêng, không arm card-creator draft).
- Delete row → `WORD_STATUS_DELETE` → `deleteWordStatus` (unmark, xóa row) → broadcast `WORD_STATUS_DELETED`.
- List live-update qua local `onWordStatusChanged` bus (same-tab) + cross-tab relay → mark từ trong popup trong lúc panel mở → row mới/xóa/đổi phản ánh ngay.
- List lớn (vài nghìn từ) vẫn mượt trên máy 1GB RAM — virtualize hoặc paginate.
- Explicit-'unknown' rows (user cố ý mark "chưa biết") hiện như row bình thường — khác với "chưa từng chạm" (không có row). Empty state chỉ khi store thật sự rỗng.

## 5. Constraint

- Tab mới trong UniversalPanel — threading đầy đủ 6 sites: `types.ts` union, `UniversalPanel.tsx` TABS, `UniversalPanelBottomNav.tsx` (union + TABS riêng, không derive), `mountUniversalPanel.ts` persisted-tab whitelist, `UniversalPanelController.ts` whitelist thứ 2, `vocabularyPanel` prop + wiring.
- Data path: message layer only, không đọc IDB từ UI. `WORD_STATUS_LIST`/`WORD_STATUS_CYCLE`/`WORD_STATUS_DELETE` theo convention schema (`tabId` inject/-1 placeholder, `langCode` 2-char).
- **langCode normalize base-2 tại `wordStatusClient`** (single shared point): `zh-hans→zh`, `''→'en'` fallback — fix luôn bug hiện hữu hotkey gửi `zh-hans` bị schema `length(2)` reject + swallow.
- MV3, 0 dependency mới; sort/filter client-side; i18n en/vi cho text mới (chrome hiện hữu hardcode EN là debt riêng).
- Snapshot/event ordering: subscribe `onWordStatusChanged` TRƯỚC khi await LIST → buffer → replay sau khi list về (pattern đã dùng ở comprehension-score spec §3).

## 6. Out of scope

- Export CSV/TSV, bulk-select ops, stats đếm nâng cao.
- Count/seen-source metadata (cần schema mới — chạm #7 `mining-history`).
- Reader/local-player mount riêng — reader không có UniversalPanel, accepted gap v1.
- Click→card-creator từ list (lookup xong dùng Quick Add flow sẵn có là đủ).
- Sửa `detectLangCode` binary en/zh (ja marks lưu nhầm DB `zh` — system bug hiện hữu, spec ghi accepted risk).

## 7. Data model (delta)

```ts
// Messages mới (dictionarySchemas + registry + handlers):
WORD_STATUS_LIST:   { langCode, tabId } → { entries: { term, status, updatedAt }[] }
WORD_STATUS_CYCLE:  { langCode, term, tabId } → { status }  // background cycleWordStatus, atomic
WORD_STATUS_DELETE: { langCode, term, tabId } → void
WORD_STATUS_DELETED:{ langCode, term }   // broadcast mới — CHANGED schema bắt buộc status nên không reuse được

// Store helper mới (background only):
getAllWordStatuses(langCode) → WordStatusEntry[]   // getAll() trên store

// Client state (feature vocabulary):
{ entries, filter: Set<WordStatus>, query, sort: 'recent'|'alpha'|'grouped' }
```

## 8. Acceptance seeds

1. Đã mark 3 từ (1 tracking, 2 known) → mở tab → 3 rows, đúng status badge.
2. Filter chip "tracking" → chỉ 1 row; search "pen" → substring match.
3. Click badge tracking → known → row đổi màu, `getWordStatus` trả known (cycle atomic).
4. Click term → Dictionary tab mở, term trong search box, lookup chạy — card-creator draft không bị arm.
5. Panel mở sẵn, mark từ mới từ popup trên page → row mới xuất hiện (local bus); mark từ tab khác → cũng xuất hiện (cross-tab relay).
6. Delete row → row biến mất + panel khác cùng xóa (DELETED broadcast).
7. 5000 rows → scroll mượt, first render <3s.
8. Store rỗng → empty state; store chỉ có explicit-unknown → rows hiện bình thường.
9. `zh-hans` profile → mark qua hotkey persist được (normalize fix), list đọc DB `zh` thấy từ.

## 9. Doubt-driven reconcile log (r1)

| # | Finding | Class | Resolution |
|---|---|---|---|
| 1 | No delete message — contract impossible | actionable | `WORD_STATUS_DELETE` + `WORD_STATUS_DELETED` broadcast |
| 2 | 'unknown' ambiguous: deleted vs explicit-mark | actionable | delete = remove row (DELETED event riêng); explicit-unknown hiện như row thường |
| 3 | Broadcast skips source tab — same-tab không qua message | actionable | subscribe local `onWordStatusChanged` bus (relay feed vào đó); actions local emit lên bus |
| 4 | langCode writers không nhất quán (detectLangCode binary / raw zh-hans bị reject / toIso6391) | actionable | normalize base-2 trong `wordStatusClient` — fix root tại shared point; `detectLangCode` binary → accepted risk |
| 5 | Tab threading 6 sites, 2 whitelist không derive → silent drop | actionable | spec liệt kê đủ 6 sites + test bottom-nav mobile |
| 6 | `sendToCard` prefill arm card-creator + replay on reopen | actionable | controller method riêng `openDictionaryLookup(term)` |
| 7 | Cycle read-modify-write race | actionable | `WORD_STATUS_CYCLE` atomic ở background; quota error → toast convention |
| 8 | Snapshot vs event ordering | actionable | subscribe-trước-await + buffer + replay |
| 9 | Tab unmount mất state + miss events | trade-off | refetch on mount (data fresh), filter/scroll reset — accepted v1 |
| 10 | Profile switch → lang đổi mid-session | actionable | list keyed resolved lang; prop đổi → refetch |
| 11 | i18n vs chrome hardcode EN | trade-off | text mới i18n en/vi; sibling hardcode = debt hiện hữu |
| 12 | `tabId` convention bỏ sót | actionable | follow schema convention + `-1` placeholder extension page |
| 13 | CHANGED thiếu `updatedAt`; `''` lang | actionable | live rows dùng `Date.now()` local; `''→'en'` fallback |
| 14 | term surface vs headword mismatch | trade-off | system ceiling hiện hữu (giống comprehension-score §10) — documented |
