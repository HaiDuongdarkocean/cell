# Intent: Subtitle Selector When Multiple Matches (V2 of ADR-007 D3)

## Vision

Khi một trang video có **≥2 subtitle cùng language** (vd themoviebox.org có 2 sub "en"), user có thể **chọn subtitle cụ thể** thay vì bị first-match random. Feature này nâng ADR-007 D3 ceiling ("V1 first-match, V2 dropdown nếu demand") lên V2.

## Problem Statement

**Hiện trạng (ADR-007 V1)**:
- `findSubtitlesForOverlay` (background) dùng `findFirstMatch` — trả subtitle đầu tiên khớp language.
- Khi 2+ sub cùng lang → chọn sub đầu tiên (deterministic nhưng không phải sub user muốn).
- Edge case: 1 trong 2 sub bị hỏng (fetch fail/parse fail/CORS) → first-match có thể trúng sub hỏng → overlay rỗng (bug A: target overlay text rỗng do `loadBilingualCues` ghi đè cues cũ bằng cues mới = []).

**Pain**:
- User không có cách chọn sub cụ thể khi site cung cấp 2+ sub cùng lang.
- Sub hỏng không có fallback — first-match trúng sub hỏng = overlay rỗng, user không biết đổi.
- `loadBilingualCues` ghi đè cues mỗi lần `AUTO_LOAD_SUBTITLES` push → lần cuối chỉ native → target clear (bug A root cause).

## Opportunity

- **Sites phổ biến có 2+ sub cùng lang**: themoviebox.org (2x "en"), kisskh.co (2x "id"), Netflix (multi-region). Demand thật, không phải edge case hiếm.
- **Bug A tự giải quyết**: Khi user chọn sub cụ thể, background chỉ push 1 sub duy nhất (không first-match random) → không còn ghi đè cues cũ bằng cues mới = [].
- **Persist theo site**: User chọn sub #2 trên themoviebox → quay lại site → tự động áp dụng sub #2 (không chọn lại).

## User Stories

1. **US1 — Auto-load first + manual override**: Khi load page, auto-load first-match (như V1). Nếu ≥2 sub cùng lang → overlay hiện dropdown icon (góc phải). User click → list subtitle cùng lang → chọn sub khác → re-fetch + render ngay.
2. **US2 — Persist theo site**: User chọn sub #2 trên themoviebox.org → preference lưu theo URL pattern (origin). Quay lại themoviebox → auto-load sub #2 (không first-match, không chọn lại).
3. **US3 — Bug A resolved**: Khi user chọn sub cụ thể, background push 1 sub duy nhất → `loadBilingualCues` không bị ghi đè bởi push sau (chỉ 1 push, không multiple). Sub hỏng → user đổi sub khác qua dropdown.
4. **US4 — Dropdown UI**: Dropdown overlay (góc phải target/native overlay) — list subtitle cùng lang + cue count + format. Click chọn → re-fetch (cache hit nếu đã fetch) + render. Đóng dropdown khi click outside hoặc Esc.

## Out of Scope (V2 ceiling)

- **Smart-merge timestamp** (ADR-007 A6 rejected) — vẫn out of scope.
- **Offscreen document fetch** (ADR-007 D4 V2) — vẫn out of scope, CORS fallback 2 layer giữ nguyên.
- **Dropdown trong Settings Dialog** — chỉ overlay dropdown (US4), không thêm settings section.
- **Multi-tab sync** — preference persist theo site, không sync across tabs real-time.

## Feasibility Go/No-Go (G0 nhẹ)

**Build-vs-buy**: Không có package "subtitle selector" — UI dropdown + re-fetch logic tự viết. Reuse `MultiSelect`/`CustomSelect` component hiện có (SettingsDialog) cho dropdown styling. Ponytail rung 2 (reuse codebase).

**Risk thô**:
- **R1 — Dropdown overlay che subtitle text**: Dropdown góc phải overlay có thể che cue text. Mitigation: dropdown position absolute, z-index cao hơn overlay, max-height 200px, scroll nếu >5 sub.
- **R2 — Persist preference stale**: Site đổi sub URL (signed URL expire) → preference theo URL pattern không match. Mitigation: persist theo origin + language + sub index (không theo full URL), fallback first-match nếu index out of range.
- **R3 — Re-fetch latency**: User chọn sub khác → re-fetch + parse → overlay trống 1-2s. Mitigation: cache parsed cues theo URL (ADR-007 D5 đã có), cache hit = instant.
- **R4 — Bug A fix scope**: Feature này giải quyết bug A bằng cách user chọn sub cụ thể (1 push, không multiple). Nhưng nếu user KHÔNG chọn (first-match default) → bug A vẫn xảy ra. Mitigation: fix `loadBilingualCues` merge thay ghi đè (1 line fix, gộp vào feature).

**Recommendation**: GO — demand thật (sites phổ biến có 2+ sub cùng lang), bug A tự giải quyết, reuse component hiện có, risk thấp (mitigation rõ). Ponytail: V2 = V1 + dropdown + persist, không phá V1.

## Sources

- ADR-007 D3/A4: "V1 first-match, V2 dropdown nếu demand" — `docs/adr/007-bilingual-subtitle-auto-load.md`
- Bug A evidence: `[handleAutoLoadSubtitles] parse results { targetCueCount: 0 }` (console log themoviebox session 2026-06-29)
- User interview (G0 session 2026-06-29): overlay dropdown + persist theo site + auto-load first + manual override + feature giải quyết bug A
