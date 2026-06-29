# Implementation Plan: Subtitle Selector When Multiple Matches (V2 of ADR-007 D3)

> **Giai đoạn**: G2 Implementation Plan (output planning-and-task-breakdown high-level + cto-persona + doubt-driven)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-29
> **Spec source**: `docs/specs/spec-subtitle-selector-multi-match.md` (mọi mục cite spec §F/NF/A)
> **Lưu ý**: File này là plan HIGH-LEVEL (approach, risk, milestones). Task list chi tiết chạy ở G4 đầu (sau Spec G1 + Plan G2 + ADR G3).

## Overview

Thêm subtitle selector dropdown (overlay góc phải container) khi ≥2 subtitle cùng language match. Auto-load first-match (V1 behavior giữ nguyên) + manual override qua dropdown. Preference persist theo origin + lang + sub index trong `chrome.storage.local`. Content-script tự re-fetch (cache hit instant) khi user chọn sub — không qua background. Bug A fix gộp: `loadBilingualCues` merge thay ghi đè (giữ cues cũ khi side mới rỗng). Approach: vertical slicing theo layer — bug A fix trước (foundation), rồi pure logic (findPreferredMatch), rồi background wire (preference-aware auto-load), rồi UI dropdown (content-script), rồi persist, rồi browser verify.

## Architecture Decisions (build-vs-buy có cơ sở — cite spec)

### AD1: Bug A fix — `loadBilingualCues` merge thay ghi đè (foundation, 1 line)
- **Decision**: `subtitleOverlay.ts:107-113` — `if (targetCues.length > 0) this.cues = targetCues; if (nativeCues.length > 0) this.nativeCues = nativeCues;` thay vì ghi đè unconditionally.
- **Rationale** (spec §A4, B5): Root cause bug A — multiple `AUTO_LOAD_SUBTITLES` push, lần cuối chỉ native → `loadBilingualCues([], nativeCues)` → target cues bị clear. Merge giữ cues cũ khi side mới rỗng = 1 line fix, không phá contract.
- **Build-vs-buy**: 1 line change, 0 dependency. Ponytail rung 6 (one line).
- **Alternatives rejected**:
  - Dedup push ở background (skip push nếu URL đã push) → phức tạp hơn, không fix root cause (ghi đè vẫn xảy ra khi user manually đổi sub).
  - Content-script ignore push nếu đã có cues → sai semantic (user đổi sub muốn update).

### AD2: `findPreferredMatch` pure function (preference-aware, thay `findFirstMatch`)
- **Decision**: `subtitleService.ts` — thêm `findPreferredMatch(subtitles, language, preferredIndex)` trả sub theo preference index, fallback first-match (index 0) khi index out of range. `findSubtitlesForOverlay` gọi `findPreferredMatch` thay `findFirstMatch`.
- **Rationale** (spec §A3, B8): Pure function testable độc lập. Background đọc preference từ `chrome.storage.local` trước khi gọi. Fallback first-match khi index out of range (site đổi sub list) = graceful degradation.
- **Build-vs-buy**: 0 dependency, reuse `DetectedSubtitle` type. Ponytail rung 3 (stdlib filter).
- **Alternatives rejected**:
  - Content-script tự filter + chọn → sai architecture (ADR-007 D2: background quyết định "load cái nào", content-script "hiển thị thế nào").
  - Persist theo URL thay index → URL expire (signed URL), không stable.

### AD3: Dropdown overlay góc phải container (content-script, không che text)
- **Decision**: `subtitleSelector.ts` (NEW) — `createSubtitleDropdown(role, container, subtitles, lang, activeIndex, onSelect)`. Icon `chevron-down` SVG position absolute top-right container (không overlay), z-index = overlay z-index + 1. Click → popover list sub cùng lang + cue count + format. Đóng khi click outside / Esc / chọn sub.
- **Rationale** (spec §A1, B1, B6, Q1=container): Container position không che overlay text. Reuse `CustomSelect` styling pattern từ SettingsDialog (ponytail rung 2). z-index overlay+1 đảm bảo popover trên overlay.
- **Build-vs-buy**: 0 dependency, reuse SVG icon pattern (subtitleDragPosition đã có). Ponytail rung 2 (reuse codebase).
- **Alternatives rejected**:
  - Dropdown trong Side Panel — sai UX (user xem overlay, không nhìn panel khi muốn đổi sub).
  - Dropdown trong Settings Dialog — quá nặng cho quick switch.

### AD4: Content-script tự re-fetch (cache hit instant, không qua background)
- **Decision**: Khi user chọn sub trong dropdown → content-script gọi `fetchAndParseSubtitle(url, format, tabUrl)` (đã có trong `subtitleAutoLoad.ts:92`) → cache hit instant (ADR-007 D5) → `controller.loadBilingualCues(targetCues, nativeCues)` với sub mới. Không gửi message lên background.
- **Rationale** (spec §A5, B3, Q3=content-script): Cache hit = instant (< 50ms). Tránh round-trip background (MV3 SW có thể restart giữa chừng). Reuse `fetchAndParseSubtitle` + `subtitleCache` đã có.
- **Build-vs-buy**: 0 dependency, reuse `subtitleAutoLoad.ts` functions. Ponytail rung 2 (reuse codebase).
- **Alternatives rejected**:
  - `CHANGE_SUBTITLE` message qua background → round-trip + SW restart risk + phức tạp hơn.
  - Reload page để áp dụng preference → UX tệ (mất 2-3s, video restart).

### AD5: Persist theo origin + lang + sub index (chrome.storage.local)
- **Decision**: `Settings.subtitlePreference: Record<string, Record<string, number>>` — key = origin (vd "themoviebox.org"), value = `{ [lang]: subIndex }`. Migration default `{}`. Content-script save khi user chọn sub. Background đọc khi `pushAutoLoadSubtitles` → truyền `preferredIndex` cho `findSubtitlesForOverlay`.
- **Rationale** (spec §A2, B4, Q2=origin only): Origin stable (không expire như URL). Sub index = vị trí trong `subtitles.filter(s => s.language === lang)` array. Fallback first-match khi index out of range (B8). Origin only đủ cho V2 (đơn giản, không quá granular).
- **Build-vs-buy**: Native Chrome storage API, 0 dependency. Ponytail rung 4 (native platform).
- **Alternatives rejected**:
  - Persist theo full URL → signed URL expire, không stable.
  - Persist theo origin + path (per-movie) → quá granular cho V2, preference không share across movies cùng site.
  - Tab session only → quay lại site phải chọn lại (US2 fail).

## Milestones (vertical slicing — mỗi milestone working state)

| M | Scope | Deliverable | Verify |
|---|-------|-------------|--------|
| M1 | Bug A fix | `loadBilingualCues` merge | Unit test: target rỗng giữ cues cũ |
| M2 | Pure logic | `findPreferredMatch` + unit tests | Unit test: preference, fallback, out of range |
| M3 | Background wire | `findSubtitlesForOverlay` dùng `findPreferredMatch` + đọc preference | Unit test: background push sub theo preference |
| M4 | Dropdown UI | `createSubtitleDropdown` + render + click + close | Unit test: dropdown render, click, close outside/Esc |
| M5 | Content-script wire | Dropdown trong content-script + re-fetch cache hit + loadBilingualCues | Integration test: dropdown → chọn → re-fetch → render |
| M6 | Persist | Save preference khi chọn + migration default {} | Integration test: chọn sub #2 → reload → auto-load sub #2 |
| M7 | Browser verify | edge-devtools MCP trên themoviebox (2x en) | B1-B12 acceptance criteria |

## Risks and Mitigations (cite spec edge cases)

| Risk | Impact | Mitigation (cite spec) |
|------|--------|------------------------|
| R1 — Dropdown che subtitle text | Med | Position absolute top-right container (không overlay), z-index overlay+1, max-height 200px (spec §A1, B6) |
| R2 — Persist preference stale (site đổi sub list) | Low | Fallback first-match khi index out of range (spec §A2, B8) |
| R3 — Re-fetch latency (cache miss) | Low | Cache hit instant (ADR-007 D5), cache miss ~1-2s + toast "Loading..." (spec §A7, B9) |
| R4 — Bug A fix phá existing bilingual flow | Med | Unit test regression: loadBilingualCues với cả 2 non-empty → vẫn ghi đè (behavior giữ), chỉ merge khi 1 side empty (spec §B11) |
| R5 — Dropdown z-index conflict với fullscreen | Low | Reuse z-index pattern từ subtitleOverlay (target 1000000, native 999999), dropdown = +1 (spec §A8) |
| R6 — Multiple dropdown (target + native) xung đột click | Low | Chỉ 1 dropdown open tại 1 thời điểm — click dropdown thứ 2 đóng dropdown thứ 1 (spec §A1) |

## Open Questions (resolved ở G0/G1)

- Q1 (icon position) = container ✅ (anh confirm)
- Q2 (persist key) = origin only ✅ (default đề xuất, anh không phản đối)
- Q3 (re-fetch) = content-script tự re-fetch ✅ (anh confirm)

## Sources

- Spec: `docs/specs/spec-subtitle-selector-multi-match.md` (G1)
- Intent: `docs/intent/intent-subtitle-selector-multi-match.md` (G0)
- ADR-007 D3/A4: "V1 first-match, V2 dropdown nếu demand" — `docs/adr/007-bilingual-subtitle-auto-load.md`
- Bug A evidence: console log themoviebox session 2026-06-29 (`targetCueCount: 0` do multiple push)
