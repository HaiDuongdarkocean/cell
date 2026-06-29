# Implementation Plan: Subtitle Manager Panel (V2 of ADR-014)

> **Giai đoạn**: G2 Plan (input = spec, output = implementation plan high-level)
> **Date**: 2026-06-29
> **Spec**: `docs/specs/spec-subtitle-manager-panel.md` (reviewed, APPROVED_WITH_CONDITIONS resolved)
> **Review**: `docs/reviews/review-subtitle-manager-panel.md`
> **Task breakdown chi tiết**: chạy ở G4 đầu (sau Spec + Plan + ADR) — file này chỉ high-level approach + risk mitigation + milestones.

## Overview

Nâng ADR-014 V1 (2 dropdown icon riêng) lên V2 — Subtitle Manager Panel thống nhất: 1 panel 320px (2 section Target + Native, collapsible), tích hợp import flow (multi-file + auto-detect role via `labelToIsoCode`), active chip trên toolbar, toast debounce, naming thân thiện (`formatSubtitleName`), system colors (inject theme.css tokens vào content-script), fix bug #5 (update-in-place thay destroy/re-create).

## Architecture Decisions

### AD1 — Refactor `createSubtitleDropdown` → 2 hàm: `createSubtitleManagerPanel` + `updateSubtitleDropdown`
- `createSubtitleManagerPanel(container, onSelect)` — tạo panel 320px + manager icon + active chip (1 lần, persistent)
- `updateSubtitleDropdown(panel, targetMatches, nativeMatches, activeTargetIndex, activeNativeIndex)` — update list items in-place (không destroy/re-create icon, không flicker)
- Lý do: bug #5 root cause = destroy/re-create gây flicker + stale index. Tách create (1 lần) vs update (mỗi push) fix cả 2.

### AD2 — Pure functions cho logic testable
- `formatSubtitleName(source, language, index, filename?)` — naming convention (auto: `English #2`, imported: `my-subtitle`, case guard >20 chars). Dùng `isoCodeToLabel` (lowercase) + capitalize.
- `assignImportRole(files, targetLang, nativeLang)` — multi-file auto-assign, return arrays `{ target: ParsedFile[], native: ParsedFile[], ignored: File[] }`. Convert `detectLanguage` label → ISO via `labelToIsoCode` trước khi so sánh.
- Lý do: ponytail rung 3-4 (pure, testable, no side effects). Unit test phủ 6 trường hợp import.

### AD3 — System colors: inject theme tokens vào content-script container
- `theme.css` chỉ import trong popup (React). Content-script MV3 không load CSS qua import (CSS isolation).
- Approach: tạo `injectThemeTokens(container)` — inject `<style>` block với `:root` + `[data-theme="dark"]` tokens (copy values từ `theme.css`) vào container. Toggle `[data-theme]` trên container dựa trên `chrome.storage.local.settings.theme`.
- Lý do: spec yêu cầu "không hardcode color, dùng theme.css tokens". Inject `<style>` là cách duy nhất expose tokens ra content-script context.
- Ponytail ceiling: nếu sau này cần share tokens popup↔content → extract ra `src/styles/tokens.css` riêng + import cả 2 nơi. Để V3 nếu demand.

### AD4 — Toast debounce wrapper
- `createDebouncedToast(showToast, 500ms)` — wrap `showToast` hiện có. Rapid switch → chỉ hiện toast cuối. Auto-dismiss 3s (giữ behavior hiện có).
- Lý do: spec C14. Wrap thay sửa `showToast` (không phá caller khác).

### AD5 — Active chip ẩn khi chưa có sub
- Chip element render luôn nhưng `display:none` khi chưa có sub (no auto-load, no import). Khi có sub → `display:flex` + update text.
- Lý do: Q4 resolved. Tránh layout shift khi chip xuất hiện/biến mất.

## Dependency Graph

```
types (SubtitleManagerState, ImportedSubtitle, ParsedFile)
    │
    ├── formatSubtitleName (pure, no dep)
    │       │
    │       └── createSubtitleManagerPanel (uses formatSubtitleName for list items + chip)
    │               │
    │               └── updateSubtitleDropdown (updates list in-place)
    │                       │
    │                       └── content-script wire (onSubtitleMatches → updateSubtitleDropdown)
    │
    ├── assignImportRole (pure, depends on labelToIsoCode from languageDetector)
    │       │
    │       ├── subtitleImport multi-file (handleFileSelect → array → detectLanguage → assignImportRole)
    │       └── subtitleDragDrop multi-file (handleFileDrop → array → same logic)
    │               │
    │               └── content-script wire import → panel add + set active + toast
    │
    ├── injectThemeTokens (independent — inject <style> vào container)
    │       │
    │       └── content-script wire (call once after container ready)
    │
    └── createDebouncedToast (independent — wraps showToast)
            │
            └── content-script wire (all toast calls go through debounced)
```

## Vertical Slicing (phases)

Mỗi phase = 1 vertical slice deliverable + testable. Task breakdown chi tiết (files, acceptance criteria, verification) chạy ở G4 đầu.

### Phase 1 — Pure foundations (no UI, fully unit-testable)
- T1: `formatSubtitleName` pure fn + unit tests (auto naming, imported naming, case guard, extension strip, unknown lang fallback)
- T2: `assignImportRole` pure fn + unit tests (6 trường hợp: 1 target, 1 native, 1 neither, 2 target+native, 2 cùng lang, 3+ files)

**Checkpoint 1**: pure fns pass, `npm run test:unit` green, `npx tsc --noEmit` green.

### Phase 2 — Bug #5 fix (refactor dropdown → update-in-place)
- T3: Extract `updateSubtitleDropdown(panel, matches, activeIndex)` từ `createSubtitleDropdown` — update list items in-place, không destroy/re-create. Unit test: update preserves activeIndex, no flicker (no element recreation).
- T4: Wire `onSubtitleMatches` (content-script) → `updateSubtitleDropdown` thay destroy/re-create.

**Checkpoint 2**: bug #5 fixed — chọn #2 → push mới → vẫn #2 + không nháy. `npm run test:unit` green.

### Phase 3 — Manager Panel UI
- T5: `createSubtitleManagerPanel(container, onSelect)` — panel 320px, 2 section collapsible (Target blue + Native amber), radio + name + format + size, active highlight, close (outside/Esc/close button), aria-label + title. Unit tests: render, section toggle, radio click → onSelect, close methods.
- T6: Active chip element — `English #2 · Arabic #1` (compact, max 160px + truncate), ẩn khi chưa có sub. Unit tests: render, update text, hide/show.
- T7: `createDebouncedToast` wrapper (500ms debounce, 3s auto-dismiss). Unit tests: rapid calls → 1 toast, single call → 1 toast.

**Checkpoint 3**: panel + chip + toast work in isolation. `npm run test:unit` green.

### Phase 4 — Import flow integration
- T8: `subtitleImport.ts` multi-file — `handleFileSelect` → accept `multiple` → array → `detectLanguage` each → `assignImportRole` → return `{ target, native, ignored }`. Unit tests: 6 trường hợp import.
- T9: `subtitleDragDrop.ts` multi-file — `handleFileDrop` → array → same logic (reuse `assignImportRole`). Unit tests.
- T10: Content-script wire import → panel add (imported sub vào list đúng section) + set active + load cues + toast `✓ Imported {filename}` hoặc `✓ Imported {N} files → Target + Native`.

**Checkpoint 4**: import → panel flow works. `npm run test:unit` + `npm run test:integration` green.

### Phase 5 — Wire content-script + system colors
- T11: Content-script wire manager icon + panel + chip + `onSubtitleMatches` → `updateSubtitleDropdown` + `onSubtitleSelect` → toast + chip update + persist preference (giữ logic ADR-014 D4 hiện có).
- T12: `injectThemeTokens(container)` — inject `<style>` với theme.css tokens (light + dark) vào container. Toggle `[data-theme]` dựa trên `chrome.storage.local.settings.theme`. Listen `chrome.storage.onChanged` → toggle realtime. Panel + chip + toast dùng `var(--color-*)`.

**Checkpoint 5**: full flow works in content-script context. `npm run test:unit` green.

### Phase 6 — Integration + browser verify
- T13: Integration test `subtitleManagerPanel.integration.test.ts` — mock 2 sub cùng lang → auto-load first → panel hiện → click sub #2 → re-fetch + render + persist → reload → auto-load sub #2. Import file → detect lang → add panel → set active → toast. Multi-file import → 2 files → target + native.
- T14: Browser MCP verify (edge-devtools trên themoviebox.org) — C1-C15 (15 acceptance criteria từ spec). Test report saved `docs/test-reports/`.

**Checkpoint 6 (final)**: C1-C15 pass, ready for G3 Design/ADR.

## Risks and Mitigations

| # | Risk | Impact | Mitigation | Phase |
|---|------|--------|------------|-------|
| R1 | `theme.css` không expose ra content-script (popup-only) — spec yêu cầu "không hardcode color" | High | AD3: `injectThemeTokens(container)` inject `<style>` block với tokens vào container. Toggle `[data-theme]` từ `chrome.storage`. Ponytail ceiling: extract `tokens.css` riêng V3. | P5-T12 |
| R2 | `detectLanguage` async (returns Promise) — `assignImportRole` sync | Med | `assignImportRole` nhận `ParsedFile[]` đã detect lang (detect ở caller async, assign sync). Pure fn giữ sync. | P1-T2 |
| R3 | Panel 320px che subtitle overlay | Med | Panel `position:absolute`, `z-index` cao hơn overlay, `max-height:360px` + `overflow-y:auto`. Browser verify C2. | P3-T5 |
| R4 | Multi-file import: file hỏng giữa chừng (parse fail) | Med | `assignImportRole` nhận `ParsedFile[]` (chỉ file parse thành công). File hỏng → toast ghi số file fail, không vào list. | P4-T8 |
| R5 | `chrome.storage.local.settings.theme` chưa có key theme | Low | Default = light (`:root` tokens). Nếu settings.theme = 'dark' → set `[data-theme="dark"]`. | P5-T12 |
| R6 | Bug #5 fix (update-in-place) phá V1 caller khác | Low | `createSubtitleDropdown` V1 giữ lại (deprecated), `updateSubtitleDropdown` = new fn. Content-script là caller duy nhất. | P2-T3 |
| R7 | Toast debounce 500ms → user không thấy toast nếu switch nhanh | Low | Debounce = trailing (hiện toast CUỐI sau 500ms im). Không leading. Test verify. | P3-T7 |

## Milestones

| Milestone | Phases | Exit criteria |
|-----------|--------|---------------|
| M1 — Foundations + bug fix | P1-P2 | Pure fns + bug #5 fix. `npm run test:unit` green. |
| M2 — Panel + import UI | P3-P4 | Panel + chip + toast + import flow. `npm run test:unit` + `npm run test:integration` green. |
| M3 — Full flow + browser verify | P5-P6 | System colors + content-script wire + C1-C15 pass. Ready for G3. |

## Open Questions (none — all resolved in spec review)

Q1-Q4 resolved trong spec. R1-R7 có mitigation rõ.

## Out of Scope (V2 ceiling — từ spec)

- Save imported cues to chrome.storage (reload ghi đè — ponytail)
- Keyboard shortcut cycle (YAGNI V2)
- Smart-merge timestamp (ADR-007 A6 rejected)
- Multi-tab sync
- Panel trong Settings Dialog
- Hostname trong naming

## Sources

- Spec: `docs/specs/spec-subtitle-manager-panel.md`
- Review: `docs/reviews/review-subtitle-manager-panel.md`
- ADR-014 V1: `docs/adr/014-subtitle-selector-multi-match.md`
- Mockup v4: `docs/mockups/subtitle-selector-mockup.html`
- V1 code: `src/content/subtitleSelector.ts`, `src/content/subtitleImport.ts`, `src/content/subtitleDragDrop.ts`, `src/content/content-script.ts:400-488`
- languageDetector: `src/lib/detectors/languageDetector.ts` (`detectLanguage`, `labelToIsoCode`, `isoCodeToLabel`)
- theme.css: `src/popup/styles/theme.css` (tokens light/dark)
