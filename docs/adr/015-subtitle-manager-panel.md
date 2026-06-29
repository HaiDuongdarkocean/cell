# ADR-015: Subtitle Manager Panel (V2 of ADR-014)

## Status
Accepted — Amends ADR-014 (G3, chờ G4 implement + G5 verify)

## Date
2026-06-29

## Amends
ADR-014: `docs/adr/014-subtitle-selector-multi-match.md` (V1 — 2 dropdown icon riêng)

## Delta (what changed)

1. **2 dropdown icon riêng → 1 panel thống nhất** — `createSubtitleDropdown` (V1) refactor thành `createSubtitleManagerPanel` (create 1 lần, persistent) + `updateSubtitleDropdown` (update list in-place, không destroy/re-create).
2. **Import flow tích hợp vào panel** — imported sub add vào panel list đúng section + set active + toast. V1 import flow tách rời dropdown.
3. **Active chip trên toolbar** — `English #2 · Arabic #1` (compact, max 160px + truncate). V1 không hiển thị active state trên icon.
4. **Multi-file import + auto-detect role** — `assignImportRole(files, targetLang, nativeLang)` convert `detectLanguage` label → ISO via `labelToIsoCode` trước khi so sánh. 2 files cùng lang → cả 2 trong cùng 1 section (không ignore).
5. **Naming convention thân thiện** — `formatSubtitleName(source, language, index, filename?)`: auto `English #2`, imported `my-subtitle` (strip extension), case guard >20 chars → `…`. V1 chỉ `Sub #N`.
6. **System colors** — `injectThemeTokens(container)` inject `<style>` block với `theme.css` tokens (light + dark) vào content-script container. V1 hardcode `rgba(0,0,0,0.6)`.
7. **Toast debounce** — `createDebouncedToast(showToast, 500ms)` trailing. V1 mỗi switch 1 toast (spam khi rapid switch).
8. **Bug #5 fix (re-stated)** — V1 `onSubtitleMatches` destroy+re-create dropdown gây flicker + stale index khi matches reorder. V2 `updateSubtitleDropdown` update-in-place. (Code V1 đã preserve activeIndex qua module-level var — không reset về 0 như idea file ghi ban đầu.)

## Why changed

ADR-014 V1 đã ship nhưng user feedback (G0 session 2026-06-29) + spec review (`docs/reviews/review-subtitle-manager-panel.md`) phát hiện:
- Import flow tách rời dropdown → user import sub không thấy trong list, không switch lại auto-detected.
- Active state không hiện trên icon → user không biết sub nào đang active mà không mở dropdown.
- Destroy/re-create dropdown gây flicker + stale index khi matches reorder (bug #5).
- Naming `Sub #N` không thân thiện (user quan tâm language, không phải index thuần).
- Hardcode color không adapt light/dark mode.

Mockup v4 (`docs/mockups/subtitle-selector-mockup.html`) duyệt unified panel + active chip + friendly naming + system colors. Spec review APPROVED_WITH_CONDITIONS — 3 HIGH risks resolved (detectLanguage label-vs-ISO, `isoCodeToLabel` rename, bug #5 re-stated).

## What stays (see ADR-014 for full rationale)

- **D1 Bug A fix** — `loadBilingualCues` merge (không ghi đè khi side rỗng). V2 giữ nguyên.
- **D2 `findPreferredMatch`** — background preference-aware match. V2 giữ nguyên.
- **D4 Content-script tự re-fetch** — cache hit instant, không qua background. V2 giữ nguyên (import flow cũng re-fetch từ memory).
- **D5 Persist theo origin + lang + sub index** — `chrome.storage.local.settings.subtitlePreference[origin][lang] = index`. V2 giữ nguyên (import không persist — reload ghi đè, ponytail).
- **Architecture ADR-007 D2** — background quyết định "load cái nào", content-script "hiển thị thế nào". V2 giữ nguyên.
- **ADR-013 appearance manager** — 2 overlay div độc lập. V2 không phá.

## Consequences (delta only)

- **`createSubtitleDropdown` V1 deprecated** — giữ lại (caller khác không có, content-script là duy nhất), nhưng không dùng. V2 dùng `createSubtitleManagerPanel` + `updateSubtitleDropdown`.
- **`injectThemeTokens`** — content-script inject `<style>` block tokens (light + dark) vào container. Ponytail ceiling: nếu sau cần share tokens popup↔content → extract `src/styles/tokens.css` riêng V3.
- **Import không persist** — reload ghi đè imported sub (ponytail: không lưu cues to storage). User import lại nếu cần.
- **`assignImportRole` returns arrays** — `{ target: ParsedFile[], native: ParsedFile[], ignored: File[] }`. 2 files cùng lang → cả 2 trong cùng 1 section.
- **`formatSubtitleName` pure fn** — testable, dùng `isoCodeToLabel` (lowercase) + capitalize first letter.
- **Toast debounce 500ms trailing** — rapid switch → chỉ hiện toast cuối. Auto-dismiss 3s giữ nguyên.

## Alternatives Considered (delta only)

### A1: Amend ADR-014 in place (add V2 section)
- **Rejected**: V2 thay đổi architecture decision (2 icon → 1 panel) + thêm 5 features. Amend phá immutable nature của ADR. >50% new content → delta-only ADR mới hợp lý hơn (see skill `documentation-and-adrs` amend-vs-new policy).

### A2: Full standalone ADR-015 (duplicate ADR-014 context)
- **Rejected**: >50% duplicate ADR-014 (D1 bug A fix, D2 findPreferredMatch, D4 re-fetch, D5 persist — tất cả giữ nguyên). Delta-only tránh trùng lặp, link ADR-014 cho full context.

### A3: Keep V1 dropdown + add import flow separately
- **Rejected**: User feedback rõ — 2 dropdown icon riêng + import flow tách rời = fragmented UX. Unified panel giải quyết cả 2 pain cùng lúc.

## Sources

- Spec: `docs/specs/spec-subtitle-manager-panel.md` (reviewed)
- Review: `docs/reviews/review-subtitle-manager-panel.md`
- Plan: `docs/plan/plan-subtitle-manager-panel.md`
- ADR-014 V1: `docs/adr/014-subtitle-selector-multi-match.md`
- Mockup v4: `docs/mockups/subtitle-selector-mockup.html`
- V1 code: `src/content/subtitleSelector.ts`, `src/content/content-script.ts:400-488`
- languageDetector: `src/lib/detectors/languageDetector.ts` (`detectLanguage`, `labelToIsoCode`, `isoCodeToLabel`)
- theme.css: `src/popup/styles/theme.css` (tokens light/dark)
