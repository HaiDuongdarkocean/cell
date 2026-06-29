# Task Breakdown: Subtitle Manager Panel (V2 of ADR-014)

> **Giai đoạn**: G4 Implementation (task breakdown chi tiết — input = Spec + Plan + ADR-015)
> **Date**: 2026-06-29
> **Spec**: `docs/specs/spec-subtitle-manager-panel.md`
> **Plan**: `docs/plan/plan-subtitle-manager-panel.md`
> **ADR**: `docs/adr/015-subtitle-manager-panel.md` (amends ADR-014)

## Phase 1 — Pure foundations (no UI, fully unit-testable)

### T1: `formatSubtitleName` pure fn + unit tests
**Files**: `src/content/subtitleNaming.ts` (NEW), `tests/unit/content/subtitleNaming.test.ts` (NEW)
**Acceptance**:
- [ ] `formatSubtitleName('auto', 'en', 1)` → `English #2` (capitalize + index+1)
- [ ] `formatSubtitleName('auto', 'ar', 0)` → `Arabic #1`
- [ ] `formatSubtitleName('imported', 'en', 0, 'my-subtitle.srt')` → `my-subtitle` (strip ext)
- [ ] `formatSubtitleName('imported', 'en', 0, 'my.sub.vtt')` → `my.sub` (strip last ext)
- [ ] `formatSubtitleName('imported', 'en', 0, 'very-long-filename-here-123456.srt')` → `very-long-filename-h…` (>20 chars truncate + `…`)
- [ ] `formatSubtitleName('auto', 'xx', 0)` → `Sub #1` (unknown lang fallback)
**Verify**: `npm run test:unit -- --testPathPatterns subtitleNaming` green + `npx tsc --noEmit` green
**Deps**: None

### T2: `assignImportRole` pure fn + unit tests
**Files**: `src/content/subtitleImport.ts` (UPDATE — add `assignImportRole` + `ParsedFile` type), `tests/unit/subtitleOverlay/subtitleImport.test.ts` (UPDATE — add assignImportRole tests)
**Acceptance** (6 cases):
- [ ] 1 file target-lang → `{ target: [f], native: [], ignored: [] }`
- [ ] 1 file native-lang → `{ target: [], native: [f], ignored: [] }`
- [ ] 1 file neither → `{ target: [f], native: [], ignored: [] }` (fallback target)
- [ ] 2 files (1 target + 1 native) → `{ target: [ft], native: [fn], ignored: [] }`
- [ ] 2 files cùng lang (target) → `{ target: [f1, f2], native: [], ignored: [] }` (both in target)
- [ ] 3 files (2 target-lang + 1 neither) → `{ target: [f1, f2], native: [], ignored: [f3] }`
**Verify**: `npm run test:unit -- --testPathPatterns subtitleImport` green + tsc green
**Deps**: None (uses `labelToIsoCode` from `languageDetector.ts`)

**Checkpoint 1**: pure fns pass, `npm run test:unit` green, `npx tsc --noEmit` green.

## Phase 2 — Bug #5 fix (refactor dropdown → update-in-place)

### T3: `updateSubtitleDropdown` extract + unit test
**Files**: `src/content/subtitleSelector.ts` (UPDATE — extract update logic), `tests/unit/content/subtitleSelector.test.ts` (UPDATE — add update tests)
**Acceptance**:
- [ ] `updateSubtitleDropdown(panel, matches, activeIndex)` updates list items in-place (no destroy/re-create icon)
- [ ] Preserves activeIndex across updates (chọn #2 → update → vẫn #2)
- [ ] No element recreation (icon element identity stable)
**Verify**: `npm run test:unit -- --testPathPatterns subtitleSelector` green
**Deps**: T1 (uses `formatSubtitleName`)

### T4: Wire `onSubtitleMatches` → `updateSubtitleDropdown`
**Files**: `src/content/content-script.ts` (UPDATE — onSubtitleMatches handler)
**Acceptance**:
- [ ] `onSubtitleMatches` calls `updateSubtitleDropdown` thay destroy/re-create
- [ ] No flicker (icon element không bị remove/re-append)
**Verify**: `npm run test:unit` green + browser verify (defer to P6)
**Deps**: T3

**Checkpoint 2**: bug #5 fixed — chọn #2 → push mới → vẫn #2 + không nháy.

## Phase 3 — Manager Panel UI

### T5: `createSubtitleManagerPanel` + unit tests
**Files**: `src/content/subtitleManagerPanel.ts` (NEW), `tests/unit/content/subtitleManagerPanel.test.ts` (NEW)
**Acceptance**:
- [ ] Panel 320px, 2 section collapsible (Target blue + Native amber)
- [ ] Radio + name + format + size per sub item, active highlight (filled radio + accent border)
- [ ] Close: click outside / Esc / close button
- [ ] Click sub → onSelect(index) + GIỮ panel mở
- [ ] aria-label + title cho mọi icon/button
**Verify**: `npm run test:unit -- --testPathPatterns subtitleManagerPanel` green
**Deps**: T1 (formatSubtitleName)

### T6: Active chip element + unit tests
**Files**: `src/content/subtitleManagerPanel.ts` (UPDATE — add chip), `tests/unit/content/subtitleManagerPanel.test.ts` (UPDATE)
**Acceptance**:
- [ ] Chip `English #2 · Arabic #1` (compact, max 160px + truncate)
- [ ] `display:none` khi chưa có sub, `display:flex` khi có sub
- [ ] Update text on sub switch / import
**Verify**: unit green
**Deps**: T1, T5

### T7: `createDebouncedToast` wrapper + unit tests
**Files**: `src/content/subtitleToast.ts` (NEW), `tests/unit/content/subtitleToast.test.ts` (NEW)
**Acceptance**:
- [ ] Rapid calls (3 trong 500ms) → 1 toast (trailing, cuối cùng)
- [ ] Single call → 1 toast
- [ ] Auto-dismiss 3s giữ nguyên
**Verify**: `npm run test:unit -- --testPathPatterns subtitleToast` green
**Deps**: None

**Checkpoint 3**: panel + chip + toast work in isolation.

## Phase 4 — Import flow integration

### T8: `subtitleImport.ts` multi-file + detect lang
**Files**: `src/content/subtitleImport.ts` (UPDATE — handleFileSelect multiple + detectLanguage), `tests/unit/subtitleOverlay/subtitleImport.test.ts` (UPDATE)
**Acceptance**:
- [ ] `handleFileSelect(files: File[])` → parse each → detectLanguage → ParsedFile[]
- [ ] `assignImportRole(parsedFiles, targetLang, nativeLang)` → role arrays
- [ ] File hỏng (parse fail) → không vào list + toast ghi số fail
**Verify**: unit green
**Deps**: T2

### T9: `subtitleDragDrop.ts` multi-file
**Files**: `src/content/subtitleDragDrop.ts` (UPDATE — handleFileDrop array), `tests/unit/subtitleOverlay/subtitleDragDrop.test.ts` (UPDATE)
**Acceptance**:
- [ ] `handleFileDrop(files: File[])` → array → same logic (reuse assignImportRole)
**Verify**: unit green
**Deps**: T2

### T10: Content-script wire import → panel
**Files**: `src/content/content-script.ts` (UPDATE — import handler)
**Acceptance**:
- [ ] Import → add imported sub vào panel list đúng section + set active + load cues + toast `✓ Imported {filename}`
- [ ] Multi-file → toast `✓ Imported {N} files → Target + Native`
**Verify**: unit + integration green
**Deps**: T5, T6, T7, T8, T9

**Checkpoint 4**: import → panel flow works.

## Phase 5 — Wire content-script + system colors

### T11: Content-script wire manager icon + panel + chip
**Files**: `src/content/content-script.ts` (UPDATE — wire all)
**Acceptance**:
- [ ] Manager icon click → panel open
- [ ] `onSubtitleMatches` → `updateSubtitleDropdown` + chip update
- [ ] `onSubtitleSelect` → toast (debounced) + chip update + persist preference (ADR-014 D4 giữ)
**Verify**: unit green
**Deps**: T4, T5, T6, T7, T10

### T12: `injectThemeTokens` + system colors
**Files**: `src/content/subtitleTheme.ts` (NEW), `tests/unit/content/subtitleTheme.test.ts` (NEW), `src/content/content-script.ts` (UPDATE — call injectThemeTokens)
**Acceptance**:
- [ ] `injectThemeTokens(container)` inject `<style>` block với theme.css tokens (light + dark)
- [ ] Toggle `[data-theme]` từ `chrome.storage.local.settings.theme`
- [ ] Listen `chrome.storage.onChanged` → toggle realtime
- [ ] Panel + chip + toast dùng `var(--color-*)` (không hardcode)
**Verify**: unit green + browser verify (P6)
**Deps**: T5, T6

**Checkpoint 5**: full flow works in content-script context.

## Phase 6 — Integration + browser verify

### T13: Integration test
**Files**: `tests/integration/content/subtitleManagerPanel.integration.test.ts` (NEW)
**Acceptance**:
- [ ] Mock 2 sub cùng lang → auto-load first → panel hiện → click #2 → re-fetch + render + persist → reload → auto-load #2
- [ ] Import file → detect lang → add panel → set active → toast
- [ ] Multi-file import → 2 files → target + native
**Verify**: `npm run test:integration -- --testPathPatterns subtitleManagerPanel` green
**Deps**: T11, T12

### T14: Browser MCP verify C1-C15
**Files**: `docs/test-reports/subtitle-manager-panel-browser-verify.md` (NEW)
**Acceptance**: C1-C15 pass (15 criteria từ spec) — edge-devtools trên themoviebox.org
**Verify**: all 15 criteria pass + screenshot
**Deps**: T13

**Checkpoint 6 (final)**: C1-C15 pass, ready for G5 Testing / G6 Release.
