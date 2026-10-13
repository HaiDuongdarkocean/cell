# Spec Review — srs-daily-reminder

Đã verify code claims trực tiếp trong repo: `by_timestamp`/`by_deck_due` indexes tồn tại (`srsDatabase.ts:126,143`), `wireAnkiStatusSyncScheduling` pattern đúng (`ankiStatusSync.ts:107-120`), `SRS_OPEN_STUDY_PAGE` hiện `tabs.create` unconditional (`srs.ts:98`), `CURRENT_SCHEMA_VERSION = 37` → v38 slice hợp lệ, `['srs']` trong syncedPaths với exclusions đúng, `srsUiPrefs` đọc `globalThis.localStorage` key `Tihoka.srs.uiPrefs`, init ordering step 4 đúng (`index.ts:216-218`). Platform claims (gesture-required `permissions.request`, fixed-id replace, elapsed `when`, `notifications` hợp lệ trong `optional_permissions`) đều chính xác.

Blockers:
1. —

Major:
1. [REQ-2/REQ-3 + AC-6] [PO]: Gate `lastNotifiedDayKey != today` (REQ-2 step 3) được set ngay sau initial notification (step 6), nên snooze re-fire +60min sẽ bị gate chặn — mâu thuẫn trực tiếp với REQ-3 step 3 "still-unstudied → notify again" và AC-6. REQ-3 Rules ("snooze is not counted against the ≤1/day budget") ngầm giải quyết nhưng REQ-2 gate không nói dedupe chỉ áp dụng cho `trigger: 'scheduled'|'missed'`. Implementer đọc literal sẽ ship snooze never-refires. Fix: ghi rõ dedupe term chỉ áp dụng cho initial-notification triggers; snooze eval = `enabled && permitted && studiedToday == 0`.
2. [REQ-2 Rules / Boundaries] [TL]: `dayStartMs` và `computeStreak` KHÔNG được export từ `getSrsHomeStats.ts` (chỉ `dayKeyFor`, `getSrsHomeStats`, `getStreakStats` là export — lines 54, 59, 66, 77, 152). Spec claim reuse 4 functions như đã available. Fix: sửa claim thành "export + reuse" hoặc giới hạn reuse vào exported surface.
3. [REQ-5] [TL]: Intent risk nêu rõ mitigation cho oscillation ("shift only after consecutive confirmations"); spec bỏ lặng — argmax recompute mỗi arm có thể nhảy hour hàng ngày giữa 2 bucket gần-tie (vd 9h micro-session vs 21h session thật → fire time dao động, mất trust). Fix: thêm hysteresis/stability rule (min margin hoặc consecutive confirmations) hoặc ghi explicit accepted-risk.
4. [REQ-2 step 4] [TL]: `dueNow` "over the collection's decks" thiếu data path: không nói SW resolve `collectionId` thế nào (`ensureFirstRun().collectionId` precedent ở `srs.ts:50`), và `by_deck_due` chỉ có `getCardIdsByDeckDueBefore` (id-only, có `maxResults` cap) — đếm due cần bound rõ hoặc path mới; `getSrsHomeStats` load toàn bộ cards+notes nặng cho SW tick. Fix: nêu rõ collection resolution + count query (vd `getAllByIndex` unbounded trên `by_deck_due`, hoặc accept `getSrsHomeStats` cost) dưới NFR-2 ≤2s.

Minor:
1. [Data] [BA]: `ReminderConfig` sync qua `['srs']` syncedPath mâu thuẫn intent Non-goals ("syncing reminder prefs across devices — device-local is accepted"). Spec đã document consequence ở Open Questions nhưng traceability line N8/Boundaries nên flag đây là deliberate deviation, không phải default đúng intent. Fix: reconcile — thêm `['srs','reminder']` vào excludedPaths hoặc annotate deviation.
2. [Data table] [TL]: `snoozeUntil` field không REQ nào dùng (snooze state sống trong alarm `when`) — dead field. Fix: xóa hoặc wire vào REQ-3/REQ-4 re-assert.
3. [REQ-7] [TL]: Mirror key `Tihoka.srs.uiPrefs` trùng string với localStorage SSOT key — dễ nhầm khi debug. Fix: đổi tên vd `Tihoka.srs.uiPrefsMirror`. Đồng thời "write once on load() in an extension context" là module-import side-effect bất ngờ — tốt hơn chỉ write trong `setSrsUiPrefs` + một lần khi settings row mount.
4. [REQ-2 step 4-5] [TL]: Mỗi fire chạy 3 range query chồng lấn (day-range cho gate, 364d trong `getStreakStats`, 28d trong REQ-5) — NFR-7 ok nhưng redundant I/O. Fix: gợi ý reuse một event read cho gate+learning.
5. [REQ-6 Alt] [PO]: Chrome có thể auto-deny `permissions.request` sau khi user đã deny (không show UI lần 2). Fix: blocked-state copy nên có fallback hướng dẫn site/extension settings khi re-request trả false.
6. [Spec-wide] [BA]: Spec không có section Scope/Non-goals riêng (dựa hoàn toàn vào intent) — chấp nhận được vì intent rõ, nhưng nên pointer explicit trong Boundaries.

Nhận xét theo role:
- BA: Traceability N1–N10 + journey sạch, persona rõ; lệch duy nhất là reminder prefs được sync dù intent xếp non-goal.
- PO: REQ có actor/goal/3-luồng/postcondition đủ, AC numeric và testable — trừ mâu thuẫn snooze-vs-dedupe phải sửa trước khi QA viết test.
- TL: Platform + init-ordering + reuse claims đúng chỗ đã verify; còn thiếu export claim sai, hysteresis, và due-count data path.

Action items:
1. Làm rõ dedupe chỉ áp dụng initial triggers; snooze bypass `lastNotifiedDayKey` — spec author — REQ-2/REQ-3/AC-6
2. Sửa reuse claim: export `dayStartMs`/`computeStreak` hoặc chỉ reuse exports hiện có — spec author/dev — REQ-2 Rules, Boundaries
3. Thêm stability/hysteresis rule cho `learnedHour` (hoặc accepted-risk explicit) — spec author — REQ-5
4. Spec `collectionId` resolution + due-count query path — spec author — REQ-2 step 4
5. Xóa/define `snoozeUntil`; đổi tên mirror key; flag sync deviation vs intent non-goal — spec author — Data, REQ-7
6. Fallback copy khi re-request permission auto-deny — spec author — REQ-6

Risks chấp nhận:
- Firefox `optional_permissions` MV3 version-dependent — revisit khi Firefox ship
- False-positive reminder khi học device khác trước sync pull — revisit nếu complaints
- `learnedHour` proxy "first-review = sit-down" — revisit nếu complaints (đã document trong spec)
- `chrome.alarms` persistence pre-Chrome 150 — đã mitigate bằng re-assert ở REQ-4

## Applied fixes

1. REQ-2 step 3: dedupe term now explicitly applies only to `trigger: 'scheduled'|'missed'`; snooze evaluations skip it. REQ-3 snooze flow states `trigger: 'snooze'`.
2. REQ-2 Rules + Boundaries: reuse claim corrected — `dayStartMs`/`computeStreak` are module-local, DELIVER may export them; no parallel logic.
3. REQ-5: added hysteresis — adopt candidate only when `mode - runner-up ≥ 2` or candidate == current learnedHour; else keep previous.
4. REQ-2 steps 2/4: single 28d `by_timestamp` read feeds gate + learning; `collectionId` resolution specified (activeCollectionId → ensureFirstRun fallback, empty → silent); `dueNow`/`streakDays` via one `getSrsHomeStats` call gated behind the cheap gate.
5. Data table: `snoozeUntil` removed; mirror key renamed `Tihoka.srs.uiPrefsMirror`; write-through moved to `setSrsUiPrefs` + first row mount (no import side-effect); ReminderConfig annotated as deliberate sync deviation.
6. REQ-6 Alt: fallback copy for auto-denied re-request; Boundaries gained explicit scope pointer to intent.

VERDICT: APPROVE
