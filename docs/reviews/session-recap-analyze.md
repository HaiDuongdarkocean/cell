# Review — `session-recap` ANALYZE (fresh-context audit, mode `all`)

Auditor: `subagent_explore` fresh context, doc v1 → findings applied into doc v2.

## Findings (doc v1)

**MAJOR-1 — Enrich-at-write-path premise sai cho local sessions.** `SAVE_HISTORY` handler là dead code (không sender nào — chỉ có constant + registry + handler); local flush thật là `useImmersionSession.ts:33-53` → `addHistoryEntry` trực tiếp trong page; background không thấy boundary phiên local → không attach stats được "khi flush". Local lookups cũng không derive được ở read-time (không store).

**MINOR-2 — N4 stream coverage undeliverable.** Stream score chỉ sống trong `comprehensionStore` in-memory (per-mount, không persist); `stream-*` records chỉ mang `videoId:'stream:<host>'` — không media identity để join. S5 đã ngầm scope-out nhưng N4 chưa khớp.

**MINOR-3 — `updatedAt` derivation over-attribute + silently degrade.** Sync writes cũng set `updatedAt` (`wordStatusStore.ts:243`); marks từ tab khác trong window bị gán vào phiên; upsert-by-key → re-mark sau phiên xoá vết — derive chỉ đáng tin cho phiên gần.

**MINOR-4 — tabId attribution cần precision.** `LookupRequestPayloadSchema` không có `tabId` — bus inject vào raw `request.payload` pre-validation (`messageBus.ts:150-160`) nhưng schema strip; sender không-phải-tab gửi sentinel `-1` (`wordStatusClient.ts:38`).

**MINOR-5 — Lookup lúc pause không thuộc segment nào.** `immersionTracker` đóng segment khi pause; pause→lookup→resume là pattern phổ biến → stats phải gắn vào grouped session window, không phải segment.

**MINOR-6 — AC3 mơ hồ về "local player flow".** `mountUniversalPanel` chỉ chạy trong content script; local-player page không có panel — nếu AC đòi panel mount trong extension page đó là scope mới.

**NIT** — (a) "DB_VERSION 3→4" overstate: additive optional fields không cần bump (chỉ index mới cần); (b) N1 viết như solution hơn need; (c) cite `wordStatus.ts:101` → nên cite handler registration `:82`; (d) header comment repo `mediaLibraryRepository.ts:4` nói "version 2" nhưng `DB_VERSION=3` — stale comment, không phải lỗi doc.

## Verification (đã confirm bằng code)

- `HistoryRecord` thô `mediaLibraryRepository.ts:66-72`; `VideoComprehension.computedAt` `:34-40` ✓
- Stream segments `stream-<tabId>-<t>` `immersionTracker.ts:94`; fail-closed `:36-37` ✓
- `lookupLogStore` dev-only `isDevMode` early-return ✓ — intent đã né đúng
- Lookup/status qua bg handlers: `handlers/lookup.ts`, `handlers/wordStatus.ts`; `tabId` inject `messageBus.ts:150-160` ✓
- `wordStatusStore` `updatedAt`/`source`/`sourceAt` `:46-51` ✓
- `UniversalPanelTab` `types.ts:5`; `ImmersionStats` totals-only local-only ✓
- Journey AS-IS 5 steps / TO-BE 6 steps, kết thúc ở promised value ✓
- `ui_surface: yes` nhất quán với journey có user-visible steps ✓

## Strengths

- Tự đính chính giả định sai của backlog ("leverage lookupLogStore" — store đó dev-only).
- "Ẩn field thay vì số 0 giả" + fail-closed SW-death semantics khớp `immersionTracker` model.
- Needs thật ở business level (feedback-loop pain), scope boundary chặt (overlay defer, không rewrite records cũ).

## Applied fixes (doc v2 — đã áp vào `docs/intent/session-recap.md`)

1. MAJOR-1 → Solution/Stakeholders/Scope/Workflow/Journey viết lại: accumulator = điểm *signal-capture* duy nhất ở background; join stats ↔ history theo (tabId, window) ở read-time; bỏ khẳng định "merge khi flush" + bỏ cite SAVE_HISTORY, cite `useImmersionSession.ts:33-53`.
2. MINOR-2 → N4 chỉ còn local media có score cache; stream coverage declared out với lý do (in-memory store, no media identity).
3. MINOR-3 → N3 + risk row mới: chỉ derive `source:'user'` + `sourceAt`/`updatedAt` trong window, label derived, cap recency.
4. MINOR-4 → Risk row mới: attribution đọc raw payload, `-1`/absent → "unattributed" bucket.
5. MINOR-5 → Workflow + TO-BE: stats gắn vào session window, lookup lúc pause vẫn tính.
6. MINOR-6 → AC3 viết lại: cùng một list trong universal panel trên site bất kỳ, không đòi mount panel trong local-player.
7. NIT → N1 reword thành need; cite `wordStatus.ts:82`; risk "DB_VERSION 3→4" thay bằng "stats store riêng, additive-only".

VERDICT: APPROVE_WITH_CHANGES
