# Spec: Session Recap — per-session immersion metrics surface (watch time · lookups · status changes · coverage)

> Intent: `docs/intent/session-recap.md` · ui_surface: yes · Mode: all

## Objective

Sau mỗi phiên immersion, learner mở universal panel → tab **Recap** và đọc được phiên vừa rồi làm được gì: thời lượng, nguồn (host/video), các từ đã tra, các từ đã mark status, và coverage của media (khi có). Hệ thống capture lookup/status events ở background (điểm signal-capture duy nhất), persist append-only vào IDB, và compose recap ở read-time bằng cách join events ↔ history records theo (attribution, time window) — không phụ thuộc boundary phiên ở write-path.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | Mở universal panel, chuyển sang tab Recap, tap vào từ trong list, đóng panel | Chọn tab, chọn từ | Recap phiên mới nhất + list phiên gần đây; dictionary tra lại từ |
| Content script / extension page (implicit) | Lookup request, status write, timeupdate | Term, status, video position | — (không nhận output từ recap) |
| Universal panel | `GET_SESSION_RECAP` request | — | Composed session list |

System-internal: capture events tại bg handlers, persist `sessionEvents`, group segments→sessions, derive status changes cho phiên cũ, compose response. Human behavior không xuất hiện trong flow nội bộ.

## Requirements

### Functional

REQ-1: Session-event capture
- Actor: content script / extension page (qua runtime messages)
- Goal: mọi immersion lookup thành công và mọi user status write được ghi lại thành event có attribution + timestamp
- Preconditions: extension SW đang sống; lookup/wordStatus handler đang xử lý message
- Basic flow:
  1. Content script gửi `LOOKUP_REQUEST` (có `origin:'immersion'`) / message word-status
  2. System (bg dispatch seam trong `handleMessage`/`messageBus` — nơi `sender` + raw `request.payload` còn trong scope, TRƯỚC khi handler zod-strip) ghi nhận
  3. Sau khi handler resolve `success`, tap append một `SessionEvent` vào store `sessionEvents` (fire-and-forget `void`, không block response)
- Alt flow: sender không mang `tabId` hợp lệ → `tabId=-1`; `surface` phân loại tại tap: `'stream'` (sender có tab + url là web), `'local-player'` (sender url = extension local-player entry), `'panel'` (sender url = host page nhưng message từ panel-originated ops — phân biệt bằng `origin`/payload field khi cần), `'other'`
- Exception: IDB write fail/blocked → swallow (fail-closed, retry tối đa 1 lần on-version-blocked, không ảnh hưởng response của handler gốc)
- Rules:
  - **Capture point = dispatch seam, KHÔNG `ctx.on` handler** — `ctx.on` handlers chỉ nhận `request` đã-parse (`sender` bị drop tại `messageBus.ts:180`; `tabId` inject vào raw payload `:150-159` nhưng bị zod strip vì `LookupRequestPayloadSchema` không khai báo). Tap đặt tại seam có `sender` + raw payload.
  - Lookup events: CHỈ khi `request.payload.origin === 'immersion'` (field optional additive trên schema — tokenize controllers/web-text lookups set; card-generator `dictionaryGenerate.ts`, DictionaryTab lookups, vocab surfaces KHÔNG set → tự động loại, kể cả re-lookup từ REQ-4) VÀ response `success:true`.
  - Status events: message ops trong word-status handler set/cycle status (kể cả pos-variant); trash/restore/delete ops KHÔNG emit (recap đếm "đã mark", không đếm lịch sử chỉnh sửa). Sync/ankiStatusSync writes không đi qua handler này (`statusSyncService.ts`, `dictLocalSource.writeRemote`) → tự động loại.
  - Event payload tối thiểu: `{id, at, tabId, surface, kind: 'lookup'|'status', term, langCode?, status?, pos?}`
- Postcondition: `sessionEvents` có event mới, query được theo `by_at`
- NFR refs: NFR-2 (hot path), NFR-4 (local-first)

REQ-2: Session grouping & recap composition
- Actor: universal panel (qua `GET_SESSION_RECAP`)
- Goal: nhận danh sách session đã compose sẵn để render, desc theo thời gian
- Preconditions: history store có records (có thể rỗng)
- Basic flow:
  1. Panel gửi `GET_SESSION_RECAP {}`
  2. System đọc `getHistory()` + `sessionEvents` trong horizon (90 ngày) + video records (title/coverage)
  3. System group consecutive records cùng `videoId` có gap ≤ `SESSION_GROUP_GAP_MS` (15 phút) thành một session
  4. System join events vào session theo attribution rules (xem Rules)
  5. System trả `{sessions: SessionRecap[]}` desc
- Alt flow: phiên `watch-*` của video có `comprehension` cache → attach `{coverage, band, computedAt}`; phiên mới nhất có record flush trong <90s → flag `live: true`
- Exception: history rỗng → `{sessions: []}`; sessionEvents corrupt/missing → sessions vẫn trả với metrics rỗng (không fail request)
- Rules:
  - Session identity: `videoId` (local = video id, stream = `stream:<host>`) — hai video khác nhau cùng host stream vẫn group chung (accepted simplification)
  - Attribution (bus overwrite `tabId` bằng `sender.tab.id` cho mọi tab sender → panel marks mang tabId của tab host, `-1` chỉ còn trên sender không-tab):
    - `event.tabId` = tabId trích từ `stream-<tabId>-*` → session stream đó (kể cả mark từ panel trên cùng tab — đúng ngữ cảnh)
    - `event.surface='stream'` nhưng tabId khác session → không gán (tra trên tab khác)
    - `event.surface='local-player'` → gán vào session `watch-*` nếu đúng 1 session overlap event time; ≥2 overlap → bỏ
    - `event.surface='panel'|'other'` hoặc `tabId=-1` → gán vào session duy nhất có window chứa `event.at`; ≥2 overlap → bỏ (không double count)
  - Session window = `[first.watchedAt, last.watchedAt + last.watchDurationMs]` mở rộng grace `SESSION_GROUP_GAP_MS` về hai phía (cover lookup lúc pause/ngoài segment)
  - Terms list: dedup theo term (+pos cho status), cap 30, kèm `moreCount`
  - Phiên cũ (trước khi feature ship — không có events) → derive status changes từ `wordStatusStore` entries có `source:'user'` và `updatedAt`/`sourceAt` trong window — scan `getAllWordStatuses(langCode)` qua mọi per-lang DB (`indexedDB.databases()` lọc prefix `orca-dict-`); kết quả đánh `derived: true`; lookups của phiên cũ = không hiển thị (field absent, không phải 0). Remote-synced user marks giữ `source:'user'` → có thể false-attribute vào window (accepted — `derived` label đã cover)
  - Derivation cap: chỉ derive cho sessions có `watchedAt` trong `DERIVE_LOOKBACK_DAYS` (30 ngày) — xa hơn thì bỏ derive
- Postcondition: response chứa mọi sessions trong horizon, mỗi session đủ fields để render
- NFR refs: NFR-1 (perf), NFR-4

REQ-3: Recap tab surface trong universal panel
- Actor: learner
- Goal: đọc recap phiên mới nhất + list phiên gần đây trên mọi site
- Preconditions: universal panel mở được; `GET_SESSION_RECAP` trả dữ liệu
- Basic flow:
  1. Learner mở universal panel → chọn tab Recap (bottom nav)
  2. System render phiên mới nhất nổi bật (card) + list các phiên trước
  3. Mỗi session hiển thị: nguồn (host hoặc tên video), thời điểm + thời lượng, số từ tra + chips, status changes theo loại + chips, coverage chip (khi có), badge `live`/`derived` khi áp dụng
- Alt flow: không có session nào → empty state hướng dẫn (xem video với Cell subtitles để có recap)
- Exception: request fail → error state với retry; field thiếu data → ẩn (không hiện "0" giả)
- Rules:
  - Tab wiring đầy đủ: `UniversalPanelTab` union (`types.ts:5`); TABS trong `UniversalPanel.tsx:50` (sidebar) VÀ `UniversalPanelBottomNav.tsx:29` (bottom nav); `recapPanel` prop + conditional render (`UniversalPanel.tsx:265-271`); persisted-tab whitelists tại `UniversalPanelController.ts:56` + `mountUniversalPanel.ts:65` (thiếu = tab không restore); composition trong `mountUniversalPanel.ts`
  - Reuse `<Card>`, `<Icon>`, shared/ui components + ICON_CATALOG; i18n en+vi toàn bộ; surface mount qua `mountReactShadow` rules (AGENTS.md)
- Postcondition: learner thấy được recap mà không cần thao tác nào khác
- NFR refs: NFR-3 (a11y/i18n), NFR-1

REQ-4: Tap term → tra lại trong dictionary tab
- Actor: learner
- Goal: từ trong recap mở lại lookup trong dictionary tab
- Preconditions: `UniversalPanelController.openDictionaryLookup(term)` tồn tại (`UniversalPanelController.ts:113-117` → `pendingSearchTerm` → `initialTerm`, `mountUniversalPanel.ts:138-140,190`; `DictionaryTab` re-read `initialTerm` qua `useEffect` `:44-49` — prop-change đủ trigger, không cần remount (tab giờ keep-alive `visitedTabs` + `hidden` ở `UniversalPanel.tsx`);
- Basic flow:
  1. Learner tap chip từ trong recap
  2. System gọi `openDictionaryLookup(term)` → panel switch sang tab dictionary với term prefill
  3. Dictionary tab chạy lookup của từ
- Alt flow: dictionary tab chưa mount → lazy mount rồi prefill (controller đã handle qua `pendingSearchTerm`)
- Exception: term rỗng → chip không render (đã lọc lúc compose)
- Rules: KHÔNG dùng `externalPrefill` prop (nó arm `cardCreatorContext` — `DictionaryTab.tsx:40-48` — mở sai surface); re-lookup này mang KHÔNG `origin:'immersion'` → tự loại khỏi session events (không self-attribute); không mở popup mới trên page
- Postcondition: learner tra được lại từ từ recap
- NFR refs: NFR-3

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | `GET_SESSION_RECAP` ≤ 500ms với ≤90 ngày events + full history trên persona hw | P | getAll events (index by_at range) + getAll statuses một lần, memoize per request — không N+1 |
| NFR-2 | Event capture không chậm hot path lookup/status | P | append fire-and-forget sau khi handler resolve; O(1); không await trong response path |
| NFR-3 | a11y + i18n đầy đủ | U | aria labels cho session list/chips; `t()` mọi text; en+vi parity |
| NFR-4 | Local-first: không network, không telemetry; data không sync Drive | +privacy/infra | Events + sessions chỉ IDB local; không vào sync domain |
| NFR-5 | Retention bounded | R | `sessionEvents` prune entries > `SESSION_EVENTS_MAX_AGE_DAYS` (90) một lần per SW session |
| NFR-6 | Fail-closed | R | SW chết mất tối đa event chưa flush (đã fire-and-forget per event → mất ≈0); history/session records cũ không bị rewrite |

## Flows / States

```
lookup/status msg ──▶ bg handler ──▶ [success] ──▶ append sessionEvents (void)
                          │
                          └──▶ normal response (unblocked)

GET_SESSION_RECAP ──▶ read history + events(range) + videos + statuses
                    ──▶ group records→sessions (same videoId, gap≤15m)
                    ──▶ per session: window = [start, end] ± gap
                    ──▶ join events by attribution rules
                    ──▶ old sessions (no events) → derive statuses
                       (source:'user' ∧ sourceAt∈window ∧ ≤30d)
                    ──▶ attach coverage (local videoId → VideoRecord.comprehension)
                    ──▶ sessions[] desc
```

State (per event, at capture): `queued → persisted | dropped(on write fail)`
State (per session, at read): `closed` | `live` (latest record flushed <90s ago)

## Function ↔ Feature Map

| Function (system does) | Features (tools) |
|---|---|
| Ghi lại hoạt động học trong phiên | `sessionEventsTap` tại bg dispatch seam (`handleMessage`/`messageBus` — có `sender` + raw payload); `origin:'immersion'` marker trên lookup payload; `sessionEvents` IDB store |
| Tổng hợp phiên từ records + events | `sessionGrouper` (pure: group + window + join + derive); `GET_SESSION_RECAP` handler + zod schemas |
| Cho learner đọc lại phiên | `RecapTab` (universal panel tab) — latest card + session list + term chips + badges |
| Cho learner tra lại từ | Term chip → `openDictionaryLookup(term)` |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `SessionEvent` | `id` (keyPath, `${at}-${rand}`), `at`, `tabId`, `surface`, `kind`, `term`, `langCode?`, `status?`, `pos?` | IDB `orca-local-player` → store `sessionEvents`, index `by_at` (DB_VERSION 3→4, additive store — old records untouched). **Contention:** `openDB` reject `onblocked` (`mediaLibraryRepository.ts:111`) và KHÔNG có `db.onversionchange` — tab local-player giữ connection v3 sẽ block v4 → phải thêm `onversionchange → close + clear dbInstance` (pattern `baseRepository.ts:51-54`) + retry 1 lần ở append path | prune >90d, once per SW session |
| `HistoryRecord` | `id`, `videoId`, `watchedAt`, `watchDurationMs`, `positionMs` — **không đổi schema** | `history` store (hiện có) | existing |
| `SessionRecap` (composed, không persist) | `id`, `videoId`, `sourceLabel`, `start`, `end`, `durationMs`, `positionMs`, `live`, `lookups{count, terms[], moreCount}`, `statusChanges{learning:[],known:[],tracking:[],ignore:[],counts,moreCount,derived}`, `coverage?{value,band,computedAt}` | response only | n/a |
| `VideoRecord.comprehension` | `coverage`, `band`, `computedAt` | `videos` store (hiện có) | existing |
| `WordStatusEntry` | `term`, `pos?`, `status`, `updatedAt`, `source?`, `sourceAt?` | `langWordStatus` (hiện có) | existing |

Message surface: `GET_SESSION_RECAP` — payload `{}`, response `{sessions: SessionRecapSchema[]}`; zod schema ở `entities/message/` + registry (convention `message-validation-thread`).

## Traceability

| Need (intent ID) | REQ | AC |
|---|---|---|
| N1 (đọc lại phiên có metrics) | REQ-1, REQ-2, REQ-3, REQ-4 | AC-1, AC-2, AC-5 |
| N2 (surface đa-site) | REQ-3 | AC-3 |
| N3 (phiên cũ derivable) | REQ-2 (derive rules) | AC-4 |
| N4 (coverage local) | REQ-2 (attach) | AC-6 |
| N5 (zero-effort + fail-closed) | REQ-1 (fire-and-forget), REQ-2 | AC-7 |
| N6 (i18n/a11y/perf) | REQ-3, NFR-1/2/3 | AC-8 |

| Journey step | REQ |
|---|---|
| TO-BE-1,2 (capture trong lúc xem) | REQ-1 |
| TO-BE-3 (card phiên gần nhất) | REQ-2, REQ-3 |
| TO-BE-4 (list + tap từ) | REQ-3, REQ-4 |
| TO-BE-5 (phiên cũ derivable) | REQ-2 |
| TO-BE-6 (feedback loop) | REQ-3 (outcome, không có REQ kỹ thuật riêng) |

## Boundaries

- Always: pure logic tách khỏi side effects (grouper/composer pure, repo/handler side-effect); named exports; không `any`; tokens cho màu; zod schema cho message mới (`origin` field additive optional trên `LookupRequestPayloadSchema`); tests cho logic không-tầm thường; `getAllWordStatuses` có side-effect xoá rows `unknown` khi đọc (`wordStatusStore.ts:285-304`) — derive path chấp nhận, ghi chú khi reuse
- Ask first: thêm index/store IDB mới (đã duyệt ở đây — `sessionEvents` + `by_at`, DB_VERSION 3→4 kèm `onversionchange` close handler); icon mới ngoài ICON_CATALOG (prefer catalog trước); đụng `messageBus` dispatch seam (tap point)
- Never: rewrite HistoryRecord cũ; sync events ra ngoài máy; `lookupLogStore` (dev-only) làm data source; telemetry/analytics ngoài máy

## Success Criteria

- [ ] AC-1: Xem video có Cell subtitles (stream hoặc local), tra ≥2 từ + mark ≥1 status → mở panel tab Recap → phiên xuất hiện với đúng thời lượng (±5%), nguồn, số lượt tra + chips từ, status changes đúng loại + chips.
- [ ] AC-2: Tra từ lúc video PAUSE giữa phiên vẫn được tính vào session (grace window ±15m).
- [ ] AC-3: Tab Recap có mặt trong universal panel trên một streaming site bất kỳ; cả phiên `watch-*` lẫn `stream-*` hiển thị chung một list, desc theo thời gian.
- [ ] AC-4: Phiên ghi TRƯỚC khi feature ship (không có events) hiển thị status changes derive từ `wordStatusStore` (lọc `source:'user'`, in-window) kèm nhãn derived; lookups field không render (không phải "0"); phiên >30 ngày không derive.
- [ ] AC-5: Tap chip từ trong recap → panel chuyển sang dictionary tab với term đã prefill.
- [ ] AC-6: Phiên của video local có `comprehension` cache → hiển thị coverage/band; video không có score → field ẩn.
- [ ] AC-7: Capture không làm chậm hot path: p95 lookup+status response delta <50ms so với baseline trước change (đo qua perf marks dev-build); SW kill giữa phiên không corrupt recap — event đã persist vẫn xuất hiện.
- [ ] AC-8: Mọi text mới có i18n en+vi; empty state + error state + retry; không màu hardcode ngoài tokens; không `any`.
- [ ] AC-9: `GET_SESSION_RECAP` với dữ liệu ~90 ngày trả trong <500ms (đo trên máy dev, ghi nhận số trong verify report).

## Definition of Done

- [ ] Mọi Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Design-system check pass cho RecapTab (tokens, shared/ui, Menu nếu có list actions)
- [ ] Browser verify trên Chromium thật: stream session → recap; local session → recap; tap chip → dictionary prefill; empty state
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` cập nhật; ADR nếu có quyết định kiến trúc đáng ghi (session-events store + join model)

## Open Questions / Accepted Risks

- `SESSION_GROUP_GAP_MS = 15min`, `SESSION_EVENTS_MAX_AGE_DAYS = 90`, `DERIVE_LOOKBACK_DAYS = 30` — constants chọn conservative; tuning qua settings nếu user xin.
- Status handler = kênh user-only: VERIFIED (review) — sync/ankiStatusSync writes đi qua `statusSyncService`/`dictLocalSource.writeRemote`, không qua word-status message handlers.
- Remote-synced user marks giữ `source:'user'` + remote `sourceAt` → có thể false-attribute vào window khi derive — accepted, `derived` label cover.
- "Live" session (flushed <90s) hiển thị với flag — accepted deviation nhỏ so với intent "chỉ phiên đã đóng": data tồn tại sẵn, label honest, không phải live UX riêng.
- Trash/restore/delete status ops không emit event — recap đếm marks chứ không phải edit history.
