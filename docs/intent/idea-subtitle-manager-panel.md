# Idea: Subtitle Manager Panel (V2 of ADR-014)

## Problem Statement

How might we let users know which subtitle is active, switch easily between auto-detected + imported subs, and receive clear feedback on every change — without complicating the UI?

**Hiện trạng (ADR-014 V1)**:
- 2 dropdown icon riêng (target góc phải, native bên trái) — chỉ hiện khi ≥2 sub cùng lang.
- Import button/drag-drop là flow riêng — imported sub không xuất hiện trong dropdown list, không set làm active, không toast.
- Active state không hiện trên icon (chỉ chevron) — user không biết sub nào đang active mà không mở dropdown.
- Auto-load push mới destroy+re-create dropdown → **flicker + stale index khi matches reorder** (bug #5: chọn #2 → push mới reorder list → index #2 trỏ sang sub khác). Code hiện tại đã preserve activeIndex qua module-level var, không reset về 0 như ghi trước.
- Naming: dropdown list không có naming convention rõ ràng (chỉ "English #1", "English #2" — không phân biệt nguồn).

**Pain**:
- User import sub → sub load nhưng không thấy trong dropdown → không biết switch lại auto-detected sub thế nào.
- User không biết sub nào đang active mà không mở dropdown.
- Reload → imported sub mất (auto-load ghi đè) — user không nhận feedback rõ.
- Auto-load push mới reset activeIndex → user chọn #2 rồi bị reset về #1 mà không biết.

## Recommended Direction

**V8 Hybrid — Subtitle Manager Panel**: Gộp 2 dropdown icon riêng thành 1 panel thống nhất (Subtitle Manager), mở từ 1 icon bên cạnh import button góc trái. Panel có 2 section collapsible (Target + Native), mỗi section list sub cùng lang + active highlight + radio button. Import button giữ góc trái (không move vào panel) — drag-drop vẫn hoạt động. Active chip bên phải toolbar hiện `English #2 · Arabic #1` (compact, biết trạng thái ngay).

**Naming convention thân thiện** (không hostname — user chỉ quan tâm language + index):
- Auto-detected: `{Language} #{N}` (vd `English #2`, `Arabic #1`)
- Imported single: `{filename without extension}` (vd `my-subtitle` từ `my-subtitle.srt`)
- Imported multi: `{filename}` + role tag `→ Target` / `→ Native` trong meta
- Case guard: filename >20 chars → truncate + `…`. Extension `.srt`/`.vtt` luôn bỏ.

**Multi-file import**: detect lang mỗi file → auto-assign role (target/native) → add vào list đúng section → set active → toast. 1 file → assign theo lang detected. 2 files → 1 target + 1 native. 2+ files → first target-lang + first native-lang, rest ignore.

**Toast feedback**: `✓ Switched to English #1` (switch) / `✓ Imported 2 files → Target + Native` (import). System colors (bg + border + success green). Auto-dismiss 3s.

**Bug #5 fix**: auto-load push mới → giữ activeIndex + matches state khi re-render (không reset về #1).

**Reload behavior**: auto-load ghi đè imported sub (ponytail — imported sub chỉ dùng session hiện tại, không persist cues to storage).

## Key Assumptions to Validate

- [ ] **A1 — `detectLanguage` đủ chính xác để auto-assign role**: import sub "en" → detect "en" → assign target (nếu target lang = "en"). Bet: detectLanguage đúng ≥90% cho sub phim. Test: import sub "vi" → detect có ra "vi" không?
- [ ] **A2 — Active chip không che video quá nhiều**: `English #2 · Arabic #1` ~120px + toolbar 64px = 184px góc trái. Bet: acceptable trên 16:9. Test: browser verify trên themoviebox.
- [ ] **A3 — Imported sub add vào list không conflict auto-detected**: imported sub không có URL, không re-fetch. Bet: imported sub = last item, click → load cues từ memory (không re-fetch). Test: import → switch lại auto-detected → switch lại imported.
- [ ] **A4 — Auto-load push mới không flicker + không stale index**: hiện tại destroy/re-create dropdown gây flicker + index trỏ sai sub khi matches reorder. Bet: update-in-place (không destroy/re-create). Test: chọn #2 → wait for push → dropdown vẫn #2 + không nháy.
- [ ] **A5 — Toast không spam**: mỗi action 1 toast. Bet: OK nếu debounce 500ms. Test: rapid switch → không spam toast.
- [ ] **A6 — Light/dark mode**: tất cả màu dùng CSS tokens từ `theme.css` (primary, warning, success, surface, border). Bet: auto-adapt via `[data-theme]`. Test: browser verify cả 2 mode.

## MVP Scope

**Phase 1 — 3 tính năng (active name, highlight, toast)**:
1. Active chip trên toolbar (hiện `English #2 · Arabic #1` hoặc filename khi import)
2. Highlight active khi mở panel (radio filled + accent border + scroll into view)
3. Toast sau khi switch (`✓ Switched to English #1`)

**Phase 2 — Import → panel flow**:
4. Import button/drag-drop → parse → detect lang → auto-assign role → add vào panel list đúng section
5. Import → set làm active (highlight imported item + load cues)
6. Import → toast `✓ Imported {filename}` hoặc `✓ Imported 2 files → Target + Native`
7. Multi-file import: 6 trường hợp (1 file target, 1 file native, 1 file neither, 2 files target+native, 2 files cùng lang, 2+ files)

**Cross-phase — Bug #5 fix**:
8. Auto-load push mới → giữ activeIndex + matches state khi re-render

## Not Doing (and Why)

- **Save imported cues to chrome.storage** — anh chọn "reload ghi đè" (ponytail: imported sub chỉ dùng session hiện tại). Nếu persist → complexity cao (storage quota, stale cues, migration).
- **Keyboard shortcut cycle (V6)** — `S` cycle qua subs cùng lang. YAGNI cho V1, để sau nếu demand.
- **Smart-merge timestamp (ADR-007 A6 rejected)** — vẫn out of scope.
- **Multi-tab sync** — preference persist theo site, không sync across tabs real-time.
- **Dropdown trong Settings Dialog** — chỉ panel overlay (US4), không thêm settings section.
- **Hostname trong naming** — user chỉ quan tâm language + index, không quan tâm nguồn. `English #2` thay `themoviebox · EN #2`.

## Open Questions

- **Q1**: Panel open behavior — click sub → đóng panel hay giữ mở? (em recommend giữ mở để switch nhiều lần)
- **Q2**: Section collapsed default — cả 2 expand hay collapse native nếu chỉ 1 sub?
- **Q3**: Import sub detect lang = neither target nor native → fallback assign target hay hỏi user? (em recommend fallback target + toast ghi lang detected)

## Feasibility Go/No-Go (G0 nhẹ)

**Build-vs-buy**: Không có package "subtitle manager panel" — UI panel + import flow tự viết. Reuse `createSubtitleDropdown` (ADR-014 D3) cho panel structure, `detectLanguage` + `labelToIsoCode` cho import auto-assign. Ponytail rung 2 (reuse codebase).

**Risk thô**:
- **R1 — Panel che video**: Panel 320px góc trái có thể che subtitle overlay. Mitigation: panel position absolute, z-index cao hơn overlay, max-height 360px + scroll.
- **R2 — detectLanguage sai → assign role sai**: import sub "en" nhưng detect ra "fr" → assign native (sai). Mitigation: fallback — nếu detect không chắc → assign target + toast ghi lang detected.
- **R3 — Multi-file import edge cases**: 2 files cùng lang, 2+ files, file hỏng. Mitigation: first target-lang + first native-lang, rest ignore + toast ghi số file import thành công.
- **R4 — Bug #5 fix scope**: Giữ activeIndex khi re-render dropdown. 1 line fix (preserve state trong `onSubtitleMatches`), gộp vào feature.

**Recommendation**: GO — demand thật (user import sub thường xuyên, cần switch + biết trạng thái), reuse component hiện có (`createSubtitleDropdown`, `detectLanguage`), risk thấp (mitigation rõ). Ponytail: V2 = V1 + panel + import flow + toast, không phá V1.

## Sources

- ADR-014: Subtitle selector ≥2 matches (V1) — `docs/adr/014-subtitle-selector-multi-match.md`
- Mockup v4: `docs/mockups/subtitle-selector-mockup.html` (system colors + friendly naming + case guard + aria-label)
- theme.css: `src/popup/styles/theme.css` (design tokens — primary #2563eb, warning #f59e0b, success #10b981, light/dark mode via `[data-theme]`)
- detectLanguage + labelToIsoCode: `src/lib/detectors/languageDetector.ts`
- createSubtitleDropdown: `src/content-script/subtitleDropdown.ts` (ADR-014 D3)
- User interview (G0 session 2026-06-29): unified panel + import button góc trái + active name chip + multi-file import + naming thân thiện + system colors + light/dark mode
