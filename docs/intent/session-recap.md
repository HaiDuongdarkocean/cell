# Intent: Session Recap — tổng kết phiên immersion (phút xem, từ tra, từ học thêm, coverage)

> Slug: `session-recap` · Mode: all · Source: backlog row #26 (idea-grab 2026-10-04)
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Phiên immersion kết thúc "vô hình": learner không biết phiên vừa nạp bao nhiêu phút, tra mấy từ, học thêm từ nào, media có dễ hơn trước không. Không có feedback loop → immersion khó thành thói quen, streak chỉ là con số khô. Đây là *pain về feedback*, không phải feature request. | Backlog row #26 Pain; exSTATic/LingQ tồn tại như standalone products chỉ để làm việc này (market scan) | high |
| Change | Dữ liệu session chỉ nằm ở `HistoryRecord` thô (duration, position) + `ImmersionStats` tổng tích lũy → mỗi phiên được làm giàu metric (lookups, status changes, position span, coverage signal) và có surface đọc lại phiên mới nhất + các phiên gần đây. | `mediaLibraryRepository.ts:66-72` (HistoryRecord thô); `ImmersionStats.tsx` (chỉ totals) | high |
| Solution | Hướng: session-stats accumulator ở background (điểm *signal-capture* duy nhất — mọi lookup/status message đều qua đây) + join stats ↔ history records theo (tabId, session window) ở read-time; metrics derivable được thì derive, không ghi trùng. Background KHÔNG thấy boundary phiên local (`useImmersionSession` flush thẳng vào IDB, SAVE_HISTORY handler là dead code) → join theo window, không theo write-path. | `immersionTracker.ts` (bg, stream segments); `useImmersionSession.ts:33-53` (local flush page-side); `handlers/lookup.ts`; `handlers/wordStatus.ts:82` | medium |
| Value | Feedback hữu hình sau mỗi phiên → dopamine loop → retention ("progress chỉ tích lũy ở đây"); đồng thời cho learner thấy từ mình vừa tra/học trong context vừa xem → cầu nối immersion→SRS. | Market scan: exSTATic streak calendar, LingQ LingQs-per-session, LR saved-words | high |
| Stakeholder | Language learner dùng Tihoka immersion (persona 5–80, mọi thiết bị); Anh là primary dogfooder. | AGENTS.md persona | high |
| Context | Chrome MV3, local-first; SW có thể chết bất cứ lúc nào; mọi data phải đọc được offline từ IDB; universal panel là surface chung duy nhất có mặt trên mọi site. | AGENTS.md; `src/features/universalPanel/types.ts:5` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Agent dev + repo | Data paths đã tồn tại; cần accumulator + join + 1 surface | `immersionTracker`, lookup/wordStatus handlers đều ở background — điểm *signal-capture* duy nhất (bg thấy mọi lookup/status event, nhưng KHÔNG thấy boundary phiên local → join theo window) |
| Customer | Learner | Thấy phiên vừa làm được gì mà không phải tự nhớ/ghi | Không được thêm bước thủ công (zero-effort như exSTATic) |
| Supplier/Dependency | Không có — mọi signal local (IDB, chrome.storage, runtime messages) | none — không external dep | Không network, không analytics telemetry |
| Organization | Repo maintainers | Session stats không được làm nặng hot path lookup (<3s persona) | Counter O(1) in-memory + merge khi flush segment |
| Regulator | Store policy / privacy | Recap chứa danh sách từ user tra — data nhạy cảm về hành vi xem | Giữ local-only, sync theo hướng sync domain hiện có hoặc không sync (quyết ở SPECIFY) |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Learner đọc lại được "phiên vừa xem làm được gì" — mỗi phiên (local `watch-*` + stream `stream-*`) có: thời lượng, khoảng vị trí, số lần tra từ + danh sách từ, số status changes theo loại + danh sách từ | F | `immersionTracker.ts:63-77` (stream flush); `useImmersionSession.ts:33-53` (local flush); lookups/status đều qua bg handlers (`lookup.ts`, `wordStatus.ts:82`) | high |
| N2 | Surface đọc recap: phiên mới nhất nổi bật + danh sách phiên gần đây, truy cập được trên mọi site Tihoka chạy (universal panel) — không chỉ local-player library | F, U | `universalPanel` tabs hiện: dictionary/playlist/settings/studyModes/vocabulary (`types.ts:5`); `ImmersionStats.tsx` chỉ sống trong local-player | high |
| N3 | Recap của phiên quá khứ vẫn có phần derivable: status changes suy từ `wordStatusStore` entries có `source:'user'` + `sourceAt`/`updatedAt` trong window phiên (lọc sync writes — `wordStatusStore.ts:48-51,243`); lookups chỉ có từ khi counter được ship (ẩn field, không hiện "0" giả). Derivation chỉ đáng tin cho phiên gần đây — re-mark sau phiên xoá vết (upsert-by-key) → label derived + cap recency | R | `wordStatusStore.ts:46-51` (`updatedAt`/`source`/`sourceAt` per entry); `lookupLogStore.ts` là dev-only (`isDevMode` gate) → không dùng được cho prod | high |
| N4 | Coverage signal cho local media có score cache: hiển thị coverage/band + delta khi suy được đáng tin. Stream coverage NGOÀI scope — stream score chỉ sống trong `comprehensionStore` in-memory, không persist, và `stream-*` records chỉ có `videoId:'stream:<host>'` (không media identity để join) | F | `mediaLibraryRepository.ts:34-40` (`VideoComprehension.computedAt`); `immersionTracker.ts:104` | medium |
| N5 | Zero-effort: không bước thủ công nào để có recap; counter fail-closed (SW chết mất ≤1 segment buffer, không bơm số ảo) | R, +privacy | `immersionTracker.ts:37` cùng semantics fail-closed | high |
| N6 | i18n en+vi đầy đủ, a11y (recap list đọc được bằng screen reader), render <3s persona | U, P | AGENTS.md persona + i18n mandate | high |

## Scope

- **In:** session-stats accumulator ở background (lookup count + terms, status-change count + terms — keyed theo tabId + session window); session-stats persistence + read-time join với history records theo (tabId, window) — KHÔNG phụ thuộc write-path boundary (bg không thấy local segment close); recap surface = tab mới trong universal panel (canonical) với phiên mới nhất + list phiên gần đây; derive status-changes ở read-time cho phiên cũ (lọc `source:'user'`, label derived, cap recency); coverage signal cho local media có score; i18n + a11y.
- **Out:** proactive overlay/toast trên video khi phiên kết thúc (cost overlay shadow-DOM per-site — defer); calendar heatmap/goals/notifications (item khác — `immersion-goals` rejected wave này); per-video aggregated watch totals; export recap; sync recap records sang Drive (quyết ở SPECIFY — lean không sync vì là derived data); recap cho phiên đang chạy (chỉ phiên đã đóng).
- **Non-goals:** không thay đổi semantics `aggregateHistory`/ImmersionStats hiện có; không đếm lại history bằng cách rewrite records cũ; không phải "practice session" (dictation/cloze) — đó là studyModes.

## Workflow

Learner xem video trên streaming site (hoặc local player) → Tihoka subtitles active → background immersion tracker / local page-side hook đang ghi segment vào `history` → trong lúc xem learner tra từ (lookup handler) và mark status (wordStatus handler) — hai luồng này đều chạy qua background nên accumulator gộp chúng vào session stats keyed theo tabId + window (kể cả lookup lúc pause — segment đóng nhưng window còn) → learner mở universal panel → tab Recap → read-time join stats ↔ history records theo (tabId, window) → đọc phiên vừa rồi: thời lượng, số từ tra, từ mới learning/known, coverage signal → thấy tiến bộ hữu hình → quay lại immersion. System↔system: content-script↔background (lookup/status/timeupdate), background↔IDB (history/wordStatus/stats), panel↔background (đọc recap). Person↔device: learner đọc recap, tap vào từ trong list → mở dictionary tab tra lại (reuse surface có sẵn).

## Journey

### AS-IS

1. Learner xem một tập trên YouTube với Tihoka subtitles, tra ~12 từ, mark 3 từ learning, xem hết 22 phút rồi tắt.
2. Segment `stream-<tab>-<t>` được flush vào `history` — chỉ chứa duration + position cuối.
3. Learner mở library/panel muốn xem mình vừa làm được gì → chỉ thấy tổng giờ tích lũy (`ImmersionStats`), không có khái niệm "phiên vừa rồi".
4. 12 từ vừa tra "bốc hơi" — không surface nào liệt kê lại chúng; `lookupLogStore` chỉ ghi ở dev-mode nên production không có vết.
5. Feedback loop đứt: phiên sau cũng y hệt — immersion trở thành hoạt động không tích lũy cảm giác tiến bộ.

### TO-BE

1. Learner xem một tập trên YouTube với Tihoka subtitles, tra 12 từ, mark 3 từ learning + 1 known, xem 22 phút rồi tắt — không làm thêm thao tác nào.
2. Background gộp lookup/status events của tab đó vào session-stats theo window (lookup lúc pause vẫn tính — window không đóng theo segment); local flush chạy page-side nhưng join theo window vẫn bắt được stats.
3. Learner mở universal panel → tab Recap → card "Phiên gần nhất": 22 phút · youtube.com · 12 từ tra (list) · +3 learning +1 known (list) · coverage 89% (nếu media local có score).
4. Bên dưới là list các phiên trước (7 ngày / N gần nhất) — mỗi row cùng metrics; tap từ trong list → tra lại trong dictionary tab.
5. Phiên cũ từ trước khi feature ship vẫn hiển thị phần derivable (status changes từ `updatedAt`); metrics không có data được ẩn, không hiện số 0 giả.
6. Learner thấy tiến bộ hữu hình sau mỗi phiên → feedback loop đóng → quay lại immersion sớm hơn.

## Stories

- S1: As a learner, I want to see what my last immersion session accomplished so that watching feels cumulative — done when opening Recap shows the most recent completed session with watch time, lookups, status changes.
- S2: As a learner, I want the list of words I looked up in a session so that I can re-check them — done when the recap lists looked-up terms for sessions recorded after the counter shipped, and older sessions hide the field instead of showing fake zeros.
- S3: As a learner, I want to see which words I marked during a session so that status progress feels real — done when status changes inside the session window are listed grouped by new status, including for pre-feature sessions (derived from `updatedAt`).
- S4: As a learner on any site, I want the recap where my sessions actually happen — done when the surface lives in the universal panel, covering both `watch-*` (local) and `stream-*` sessions.
- S5: As a learner, I want the media's coverage shown on the recap when it exists — done when local sessions for scored media show the cached band/coverage, and uncovered media simply omit the field.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| SW restart giữa phiên làm mất in-memory counters → recap thiếu lookups/status cho phần cuối phiên | operational | medium | Fail-closed semantics giống immersionTracker: chấp nhận mất ≤ buffer; optional persist counter vào `chrome.storage.session` nếu spec thấy cần |
| Session boundaries mờ: segment = per play-segment (pause = đóng segment) → "phiên" user-hiểu vs segment kỹ thuật lệch nhau | internal | medium | Group consecutive segments (gap < threshold, cùng videoId/host) thành "session" ở read-time — quyết ở SPECIFY |
| Lookup/status attribution: `tabId` được bus inject vào raw `request.payload` trước schema validation (`messageBus.ts:150-160`) — handler đọc được nhưng schema strip khi parse; sender không-phải-tab (popup, side panel) gửi sentinel `-1` (`wordStatusClient.ts:38`) | internal | medium | Attribution đọc raw payload tại handler; `-1`/absent → bucket "unattributed" (panel-originated marks vẫn tính vào window, không gán tab) — quyết ở SPECIFY |
| Status-change derive từ `updatedAt` over-attribute: sync writes cũng set `updatedAt` (`wordStatusStore.ts:243`), marks từ tab khác/vocab tab trong window bị gán vào phiên; re-mark sau phiên xoá vết (upsert-by-key) | internal | medium | Chỉ derive `source:'user'` + `sourceAt`/`updatedAt` trong window; label "derived" trên UI; cap derivation cho phiên gần đây — SPECIFY định ngưỡng |
| Stats persistence store riêng (không enrich HistoryRecord) — additive, không migration IDB | internal | low | Store/fields optional, additive-only; chỉ bump DB version nếu cần index mới |
| wordStatus full-scan ở read-time (không có index by_updatedAt) — vài nghìn rows, chạy khi mở tab | performance | low | `getAll` + filter one-shot khi tab mở, memoize per mount; nếu store lớn quá mức thêm index — đo ở DELIVER |
| Recap lộ "từ đã tra" cho ai đó mở panel trên máy chung | privacy/hidden | low | Data đã local-only; surface nằm sau panel user chủ động mở — không telemetry |
| Số liệu "fake precision": coverage delta khi score stale → recap hiện số sai lệch | hidden | medium | Chỉ hiện coverage khi `computedAt` còn nghĩa; delta chỉ khi có before/after đáng tin — quyết ở SPECIFY |

## Decision

go — mọi signal đã tồn tại trong background + IDB, surface chung (universal panel) đã có chỗ cắm, pain feedback-loop được cả market lẫn backlog confirm; rủi ro lớn nhất (session boundary + counter loss) giải được ở SPECIFY bằng derive-over-write và fail-closed semantics.

## Draft Acceptance Criteria

- [ ] Phiên mới đóng (local hoặc stream) xuất hiện trong Recap với: thời lượng, nguồn (host/video), số lượt tra + danh sách từ tra, status changes theo loại + danh sách từ — không cần thao tác thủ công nào để tạo ra nó.
- [ ] Phiên ghi trước khi feature ship vẫn hiển thị được phần derivable (status changes từ `updatedAt` window); field không có data thì ẩn, không hiện "0" giả.
- [ ] Recap surface truy cập được từ universal panel trên một streaming site bất kỳ; phiên `watch-*` (local player) lẫn `stream-*` đều xuất hiện trong cùng list đó — KHÔNG cần mount panel trong local-player page.
- [ ] Media có comprehension cache → recap hiển thị coverage/band tương ứng; media không có score → field ẩn.
- [ ] SW restart giữa phiên không crash recorder; mất tối đa phần stats chưa flush — record cuối vẫn hợp lệ.
- [ ] i18n en+vi đầy đủ cho mọi text mới; không `any`, không hardcode màu ngoài tokens.
