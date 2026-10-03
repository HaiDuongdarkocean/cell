# Review — `session-recap` SPEC (spec-reviewer, fresh context, one pass)

Reviewer: `spec-reviewer` subagent (BA/PO/TL lenses) against `docs/specs/session-recap.md` v1 → fixes applied into v2.

## Findings (v1)

**MAJOR-1 [TL] Capture point không thấy data cần.** `ctx.on` handlers chỉ nhận `request` — `sender` bị drop tại `messageBus.ts:180`; `tabId` inject vào raw payload (`:150-159`) nhưng `LookupRequestPayloadSchema` không khai báo → zod strip → lookup events luôn `tabId=undefined` → không bao giờ attribute vào stream session → AC-1 fail. `surface:'panel'` cũng không suy ra được từ `sender.url` (panel content-script url = host page).

**MAJOR-2 [TL] IDB v3→4 contention mất local events.** `openDB` reject `onblocked` (`mediaLibraryRepository.ts:111`), không `db.onversionchange` (khác `baseRepository.ts:51-54`) — tab local-player giữ v3 connection → SW v4 open block → mọi append fail đúng lúc local sessions sinh events.

**MAJOR-3 [TL] REQ-4 dùng sai prefill channel.** `externalPrefill` prop arm `cardCreatorContext` (`DictionaryTab.tsx:40-48`) → chip tap load card-creator state. Channel đúng: `controller.openDictionaryLookup(term)` (`UniversalPanelController.ts:113-117` → `pendingSearchTerm` → `initialTerm`; DictionaryTab re-read qua `useEffect` + remount on tab switch).

**MAJOR-4 [TL] Lookup-event false positives.** `LOOKUP_REQUEST` cũng bắn từ card-generator (`dictionaryGenerate.ts:115-118`), DictionaryTab (`useDictionaryLookup.ts:199` — kể cả re-lookup của chính REQ-4 → self-attribution), vocab surfaces. `success:true` đếm hết.

**MAJOR-5 [TL] `tabId=-1` bucket gần như không bao giờ fire.** Bus overwrite `tabId` bằng `sender.tab.id` cho mọi tab sender (`messageBus.ts:150-154`) → panel marks mang tabId của tab host → rơi vào "tabId khác → không gán" → drop, mâu thuẫn intent "panel-originated marks vẫn tính vào window".

**MINOR-6 [TL]** Derive statuses là per-lang (`getAllWordStatuses(langCode)`, `orca-dict-*-<lang>` DBs) — spec không nói scan lang nào.
**MINOR-7 [PO]** "mọi user status write" không enumerate ops — DELETE/TRASH/RESTORE vs SET/CYCLE.
**MINOR-8 [BA]** REQ-4 thiếu ở Need traceability.
**MINOR-9 [BA]** `live:true` lệch intent Scope-Out — đã ghi accepted deviation.
**MINOR-10 [PO]** AC-7 "không regression đáng kể" untestable.
**MINOR-11 [TL]** Tab wiring thiếu touch-points: 2 TABS lists (`UniversalPanel.tsx:50` sidebar + `UniversalPanelBottomNav.tsx:29`), `recapPanel` prop/render, 2 persisted whitelists (`UniversalPanelController.ts:56`, `mountUniversalPanel.ts:65`).
**MINOR-12 [TL]** `local-player` overlap rule thiếu else cho ≥2 sessions.

**NIT** — `getAllWordStatuses` xoá rows `unknown` lúc đọc (side effect); `langCode` normalization khác nhau giữa status client (base-2) vs lookup; remote-synced marks giữ `source:'user'`.

## Verified true (claims đứng)

- Fire-and-forget append sau handler resolve khả thi, không block response.
- Sync/ankiStatusSync bypass word-status handlers — `statusSyncService.ts:200,490,546` + `dictLocalSource.writeRemote:476-506` → "handler = user-only" CONFIRMED.
- `HistoryRecord` không tabId/startPosition; id formats `stream-<tabId>-*`/`watch-<videoId>-*` đúng.
- Local-player page gọi `LOOKUP_REQUEST` (`useSubtitleActions.ts:21,70` → `webTextDictionaryController`).

## Applied fixes (v2 — đã áp vào `docs/specs/session-recap.md`)

1. MAJOR-1 → REQ-1 rewrite: capture point = **dispatch seam** trong `handleMessage`/`messageBus` (có `sender` + raw payload trước zod-strip), không phải `ctx.on` handler.
2. MAJOR-4+5 → `origin:'immersion'` optional field trên `LookupRequestPayloadSchema` — chỉ tokenize/web-text lookups set; card-gen/DictionaryTab/vocab tự loại; re-lookup từ REQ-4 cũng tự loại. Attribution rules viết lại quanh tabId thật (panel marks trên cùng tab vẫn gán) + surface/window cho unattributed.
3. MAJOR-2 → Data + Boundaries: `onversionchange → close + clear dbInstance` (pattern `baseRepository.ts:51-54`) + retry 1 lần append on-blocked.
4. MAJOR-3 → REQ-4 mechanism = `openDictionaryLookup(term)`; bỏ clipboard fallback; cấm `externalPrefill`.
5. MINOR-6 → derive scan mọi per-lang DB qua `indexedDB.databases()` prefix `orca-dict-`.
6. MINOR-7 → status events = set/cycle ops only; trash/restore/delete documented không emit.
7. MINOR-8 → N1 trace thêm REQ-4.
8. MINOR-10 → AC-7 = p95 delta <50ms vs baseline (đo bằng perf marks).
9. MINOR-11 → REQ-3 Rules liệt kê đủ 5 touch-points.
10. MINOR-12 → local-player ≥2 overlap → bỏ.
11. NIT → `getAllWordStatuses` side-effect ghi chú trong Boundaries; remote-sync marks accepted-risk.

VERDICT: APPROVE_WITH_CHANGES
