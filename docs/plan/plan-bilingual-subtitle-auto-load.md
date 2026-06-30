# Feasibility & Scope — Bilingual Subtitle Auto-Load

> Output của **G1 — Feasibility & Scope** (Giai đoạn 1).
> Input: `docs/intent/intent-bilingual-subtitle-auto-load.md` (confirmed intent).
> **KHÔNG chứa task list** — task list chạy ở G4 đầu (sau Spec + ADR), lưu tại `docs/task/task-bilingual-subtitle-auto-load.md`.

## Overview
Mở rộng subtitle overlay auto-load từ 1 sub (target) thành 2 sub song ngữ (target + native). Background chọn sub khớp settings, push xuống content-script; content-script fetch/parse/merge/hiển thị. Overlay runtime-align 2 dòng; panel pre-merge theo target. V1 không làm dropdown chọn sub — chọn sub đầu tiên khớp.

## Scope

### In scope (V1)
- Auto-load 2 sub riêng (target + native) khi vào trang có video.
- Overlay hiển thị 2 dòng (target trên, native dưới), runtime align.
- Panel list song ngữ (target xương + native best-effort; fallback native xương khi target rỗng).
- Settings: 2 `CustomSelect` (target + native language), bỏ text input cũ.
- Background push `AUTO_LOAD_SUBTITLES` + content-script request re-push.
- CORS fallback: content-script fetch fail → background fetch.
- Cache parsed cues theo URL (dedup re-fetch).
- Partial load: chỉ 1 sub → vẫn load; sub thứ 2 đến sau → re-render.
- Hỗ trợ SRT/VTT/ASS (ASS → `assToSrt`).

### Out of scope (V1)
- Dropdown overlay chọn sub khi 2+ sub cùng ngôn ngữ (V2).
- Persist sub preference theo URL/tab (V2).
- Smart-merge timestamp (nối cue khi lệch) (rejected ở interview).
- Thay thế flow `parseBilingualSrt` (giữ 2 flow song song).
- Detect native language từ browser locale (V2).
- Offscreen document fetch với `credentials: 'include'` (V2 nếu CORS fallback SW không đủ).

## Feasibility Assessment

### Build vs Buy vs Reuse
| Capability | Build | Buy/Dep | Reuse codebase | Verdict |
|---|---|---|---|---|
| 2 dòng overlay | ✅ Mở rộng `subtitleUI.ts` | — | `createOverlay` pattern | **Reuse + extend** |
| Runtime align 2 cues | ✅ 2 binary search | — | `findCurrentLine` (`subtitleSync.ts`) | **Reuse** |
| Merge 2 bộ cues cho panel | ✅ `mergeCuesForPanel` pure fn | — | `BilingualCue` interface | **Reuse interface, new fn** |
| Background chọn 2 sub | ✅ Mở rộng `findSubtitleForOverlay` | — | existing pattern | **Reuse + extend** |
| Message push + re-push | ✅ 2 message types | — | `MessageBus` pattern | **Reuse pattern** |
| CORS fallback | ✅ `FETCH_SUBTITLE_CONTENT` | — | existing `fetch` in SW | **Reuse SW fetch** |
| Cache parsed cues | ✅ `Map<URL, cues>` | — | — | **Build (trivial)** |
| Settings 2 dropdown | ✅ 2 `CustomSelect` | — | `CustomSelect` + `SUBTITLE_LANGUAGES` | **Reuse** |

**Verdict**: **Build, reuse codebase tối đa**. Không dependency mới. Không thay thế flow cũ. Mở rộng pattern hiện có.

### Technical Feasibility
- **Chrome MV3**: content-script fetch bị CORS restrict → cần background fallback. SW fetch không có page cookie → sub cần credentials (Netflix/YouTube) có thể fail. V1 chấp nhận, V2 offscreen nếu demand.
- **SW ephemeral**: `REQUEST_AUTO_LOAD_SUBTITLES` handler đọc từ `session_media` (survive SW restart) — đã có pattern trong `BackgroundService.performSessionRestore`.
- **Performance**: runtime align 2 binary search mỗi `timeupdate` (n ~ 1000 cues, 4 lần/giây) — không degrade. Panel merge linear scan 1 lần (render 1 lần) — không hot path.
- **Memory**: cache `Map<URL, cues>` — sub text nhỏ (~100KB/sub), 10 sub URL < 1MB.

### Business Alignment
- **User**: Anh yêu (người học ngôn ngữ) — cần đối chiếu target + native khi học.
- **Differentiation**: bilingual auto-load là feature hiếm (asbplayer có manual, không auto).
- **ROI**: cao — mở rộng feature hiện có, không build mới từ scratch, reuse codebase tối đa.

## Risks and Mitigations
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Timestamp lệch lớn giữa 2 sub → panel native rớt nhiều | Med | High | Chấp nhận best-effort (intentional, ADR-007 D1) |
| CORS / fetch sub fail (Netflix/YouTube cần cookie) | High | Med | CORS fallback 2 layer (content-script → SW). V1 chấp nhận fail + toast, V2 offscreen nếu demand |
| Re-fetch sub khi scan re-trigger (SPA lazy-load) | Med | High | Content-script cache theo URL |
| Content-script chưa inject khi background push | Med | Med | `REQUEST_AUTO_LOAD_SUBTITLES` re-push (đọc từ `session_media`) |
| Hardcode default `vi` cho tất cả user | Med | — | Default `''`, migration fill `'vi'` cho existing |
| Dropdown multi-sub scope creep | High | — | V1 không làm dropdown (rejected) |
| Overlay 2 span phá drag-drop flow | Med | Low | Giữ `loadCues` cũ, test drag-drop sau |
| Sub URL leak trong log | Low | — | Không log full URL (security — ADR-007 D8) |
| Sub URL relative + background fetch | Low | Med | Background resolve từ `tabUrl` trước khi fetch |
| ASS format convert fail | Low | Low | Toast error, skip sub đó |

## Open Questions (resolved in Spec)
- Q1 toggle off clear → **Resolved**: giữ trạng thái, không clear (Spec F11).
- Q2 panel native-only → **Resolved**: fallback native xương (Spec F6 + ADR-007 D1).
- Q3 cache clear → **Resolved**: clear khi re-inject, không clear khi toggle (Spec).

## Downstream
- **Spec (G2)**: `docs/specs/spec-bilingual-subtitle-auto-load.md` — PRD chi tiết (F/NF/A criteria, error cases, data flow).
- **ADR (G3)**: `docs/adr/007-bilingual-subtitle-auto-load.md` — 8 architecture decisions + 7 alternatives.
- **Task list (G4 đầu)**: `docs/task/task-bilingual-subtitle-auto-load.md` — 10 tasks chi tiết (chạy sau Spec + ADR).
