# Spec Review: Subtitle Drag Integrated

> **Model**: Opus 4.8 (subagent)
> **Date**: 2026-06-30
> **Spec**: `docs/specs/spec-subtitle-drag-integrated.md`
> **Intent**: `docs/intent/intent-subtitle-drag-integrated.md`
> **Reviewer**: spec-reviewer skill (subagent)

## Status

**APPROVED_WITH_CONDITIONS** → conditions applied → **APPROVED** (post-update)

Refactor nhỏ, math giữ nguyên, scope rõ. 1 CRITICAL implementation trap (`applyStyle` querySelector sẽ break sau khi `role="slider"` chuyển lên overlay div) + 1 HIGH edge case (bilingual 2 overlay overlap). Cả 2 đã apply vào spec (Assumptions #10 warning + Edge Cases #1 + Success #1 cả target+native).

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 3/4 | 0/4 | 1/4 | F1-F4 |
| Testability (QA) | 1/3 | 1/3 | 1/3 | T1-T3 |
| Scope (Product) | 3/3 | 0/3 | 0/3 | S1-S3 |
| **Total** | 5/10 | 1/10 | 2/10 |  |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | PASS | HIGH | "No new dependency — native Pointer Events (đã dùng)". Không external dep, không cần fallback. |
| F2 | Architecture considerations section exists? | PASS | MEDIUM | "Project Structure" liệt kê 3 file MODIFY + 4 file NOT touched + data flow (createOverlayLayer → createDragHandle → applyStyle). |
| F3 | Technical constraints reviewed? | PASS | HIGH | Tech Stack section: Chrome Extension MV3, React 19, TS 6, Jest 30, Vite 8, Windows/PowerShell. |
| F4 | Rollback strategy for stateful changes? | NA | HIGH | Refactor stateless UI, không storage schema change. `yOffsetPercent` persist logic giữ nguyên (existing behavior). |

### Testability (QA)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | PASS | CRITICAL | 9 success criteria đều có verify cụ thể: `querySelector returns null`, `getComputedStyle().cursor`, `window.getSelection().toString()`, `npm run test:unit`, `npx tsc --noEmit`, Edge MCP. |
| T2 | Edge cases ≥2 per user story? | FAIL → FIXED | HIGH | Ban đầu không có dedicated edge-case section. **FIXED**: thêm Edge Cases section 6 item (bilingual overlap, fullscreen, touch, pointer capture fail, drag start trên text span, drag qua text span). |
| T3 | Error states defined? | NA | HIGH | Refactor không có fetch/parse/detect. Error path duy nhất (setPointerCapture throw, storage persist fail) đã có try/catch trong code hiện tại + test coverage (`subtitleAppearanceEdgeCases.test.ts:112-131`). |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | PASS | HIGH | Objective mở bằng problem (icon `move-vertical` chiếm chỗ, rối mắt) rồi mới đến solution. |
| S2 | Out-of-scope ≥3 tempting extensions? | PASS | HIGH | 6 item: keyboard a11y, hint UI, drag math, applyStyle display, popup slider, mobile/touch UX. |
| S3 | Success metrics are measurable? | PASS | CRITICAL | 9 criteria đều testable bằng querySelector/getComputedStyle/test command/MCP. Không có "improve/better". |

## Risks

| # | Severity | Section | Question | Resolution |
|---|----------|---------|----------|------------|
| 1 | CRITICAL | Assumptions #10 / Project Structure | `applyStyle` (`subtitleUI.ts:184`) + `createDragHandle` (`subtitleDragPosition.ts:21`) đều dùng `overlay.querySelector('[role="slider"]')` để tìm handle button **as descendant**. Sau refactor, `role="slider"` chuyển lên chính overlay div → querySelector trả về `null` (không match self) → (a) `applyStyle` ngừng update `aria-valuenow`, (b) `createDragHandle` rơi vào fallback branch tạo button mới (sai spec). | **APPLIED**: Assumptions #10 thêm warning + implementation note "Refactor phải đổi thành `overlay.setAttribute('aria-valuenow', ...)` trực tiếp + bỏ querySelector handle-discovery trong `createDragHandle`." |
| 2 | HIGH | Success Criteria / Testing Strategy | Bilingual mode có 2 overlay layer (target z-index 999999, native 999998). Sau refactor cả 2 đều `pointer-events: auto`. Khi 2 overlay overlap, pointerdown ở vùng overlap hit target (topmost) → native drag không hoạt động ở vùng bị target che. Success criterion #1 chỉ check target handle. | **APPLIED**: Success #1 đổi thành cả target + native handle returns null. Edge Cases #1 thêm "bilingual overlap — native drag ở vùng không bị target che → hoạt động; vùng overlap → hit target (acceptable, target on top)". |
| 3 | MEDIUM | Testing Strategy | `subtitleAppearanceEdgeCases.test.ts` hiện không có ARIA assertion trên handle (chỉ assert display/font/bottom). Spec claim phải modify test này cho ARIA — không khớp codebase reality. | **APPLIED**: Testing Strategy sửa thành "file hiện không có ARIA assertion trên handle; verify `[data-testid]` selector vẫn hoạt động sau xóa handle; thêm ARIA assertion trên overlay div nếu cần". |
| 4 | MEDIUM | Testing Strategy / Boundaries | `subtitleDragPosition.test.ts` hiện assert `handle.tagName === 'BUTTON'` (line 18) + dispatch pointerdown trên `handle`. Sau refactor handle = overlay div → toàn bộ 7 test rewrite. Spec nói "MODIFY" nhưng không note đây là rewrite lớn. | **APPLIED**: Testing Strategy thêm note "7 test rewrite (không phải tweak): dispatch pointerdown trên overlay div thay handle button, assert `tagName === 'DIV'`, thêm test `pointerdown trên textSpan → drag không trigger`." |
| 5 | MEDIUM | Assumptions / Out of Scope | Fullscreen không được mention. | **APPLIED**: Edge Cases #2 thêm "Fullscreen: overlay append vào video-wrapper (fullscreen-safe), `setPointerCapture` trên overlay div giữ drag — verify via Edge MCP fullscreen toggle." |

## Open Questions (resolved)

1. **Bilingual overlap drag (Risk #2)**: Acceptable (target on top, native drag ở vùng không che). **APPLIED** vào Edge Cases #1.
2. **`createOverlayLayer` return type (spec OQ #1)**: **RESOLVED — xóa field `dragHandle`, return `{ overlay, textSpan }`**. Spec-reviewer verify `subtitleOverlay.ts:65-67` chỉ dùng `.overlay` + `.textSpan`, `dragHandle` không dùng sau init → safe xóa.
3. **Text span drag prevention (spec OQ #2)**: **RESOLVED — `e.target === textSpan` check** trong overlay pointerdown handler (1 dòng, ponytail rung 6, không cần sửa text span).
4. **ARIA `aria-label` per-role (spec OQ #3)**: **RESOLVED — per-role** (`"Drag to move target subtitle"` / `"Drag to move native subtitle"`) — rõ hơn cho screen reader.

## Spec Updates Applied

1. **Assumptions #10** — thêm ⚠️ warning về querySelector trap + implementation note.
2. **Success Criteria #1** — đổi thành cả target + native handle returns null.
3. **Testing Strategy** — note rõ `subtitleDragPosition.test.ts` 7 test rewrite (không phải tweak).
4. **Testing Strategy** — sửa claim về `subtitleAppearanceEdgeCases.test.ts` (file không có ARIA assertion trên handle).
5. **Thêm Edge Cases section** — 6 item (bilingual overlap, fullscreen, touch, pointer capture fail, drag start trên text span, drag qua text span).
6. **Open Questions** — mark 3 OQ as RESOLVED với recommendation.

## Verification

- [x] All 5 input files read (intent, spec, architecture map, 3 checklists, 1 template) + 6 codebase files verified
- [x] All 3 checklists run (Feasibility, Testability, Scope)
- [x] Review report saved to `docs/reviews/review-subtitle-drag-integrated.md`
- [x] Status: APPROVED (post-update)
- [x] Every FAIL has risk entry (T2 → Risk #2 + Edge Cases section)
- [x] Every CRITICAL risk has open question (Risk #1 → resolved via Assumptions #10 update)
- [x] Model used recorded (Opus 4.8)
- [x] User presented with status + risks + open questions

## Summary

Spec matches codebase reality on all claimed file paths/line refs. CRITICAL trap (`querySelector('[role="slider"]')` doesn't match self after role moves to overlay div) + HIGH edge case (bilingual overlap) đã apply vào spec. Spec ready for G2 Plan.
