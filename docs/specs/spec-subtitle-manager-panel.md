# Spec: Subtitle Manager Panel (V2 of ADR-014)

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-29
> **Intent source**: `docs/intent/idea-subtitle-manager-panel.md`

## Objective

Nâng ADR-014 V1 (2 dropdown icon riêng cho ≥2 sub cùng lang) lên V2 — **Subtitle Manager Panel** thống nhất: gộp 2 dropdown thành 1 panel có 2 section (Target + Native), tích hợp import flow (multi-file + auto-detect role), active name chip trên toolbar, toast feedback rõ ràng, naming convention thân thiện, system colors (light/dark mode), và fix bug #5 (giữ activeIndex khi auto-load push mới).

**User**: Người học ngoại ngữ xem phim/video với bilingual subtitle overlay trên trang web (content script). Cả power user (import sub thường xuyên) + newbie (ít import, cần đơn giản).

**Why now**: ADR-014 V1 đã ship nhưng (a) import flow tách rời dropdown — user import sub không thấy trong list, không switch lại auto-detected được; (b) active state không hiện trên icon — user không biết sub nào đang active; (c) auto-load push mới reset activeIndex — user chọn #2 rồi bị reset về #1; (d) naming không có convention rõ ràng. Mockup v4 đã duyệt (`docs/mockups/subtitle-selector-mockup.html`).

**Success**:
- User biết sub nào đang active mà không cần mở panel (active chip `English #2 · Arabic #1` trên toolbar)
- Import sub → xuất hiện trong panel list đúng section + set active + toast `✓ Imported {filename}`
- Multi-file import → detect lang mỗi file → auto-assign role → add vào list đúng section
- Switch sub → toast `✓ Switched to English #1` + active chip update
- Auto-load push mới → giữ activeIndex (không reset về #1)
- Panel + chip + toast dùng system colors từ `theme.css` (light/dark mode auto-adapt via `[data-theme]`)
- Naming thân thiện: `English #2` (auto) / `my-subtitle` (imported, không extension) / case guard >20 chars → truncate + `…`
- Mọi icon/button có `aria-label` + `title` giải thích cơ chế sử dụng

## Assumptions (surface trước khi spec nội dung)

1. **Panel thay 2 dropdown icon riêng** — ADR-014 V1 có 2 dropdown icon (target góc phải, native bên trái). V2 gộp thành 1 panel thống nhất mở từ 1 manager icon bên cạnh import button góc trái. Panel 320px, 2 section collapsible (Target + Native).
2. **Import button giữ góc trái** — không move vào panel. Drag-drop vẫn hoạt động. Manager icon bên cạnh import button (cùng toolbar).
3. **Active chip trên toolbar** — bên phải toolbar, hiện `English #2 · Arabic #1` (compact). Import → hiện filename (không extension). Max 160px + truncate.
4. **Naming convention thân thiện** — auto-detected: `{Language} #{N}` (vd `English #2`). Imported: `{filename without extension}` (vd `my-subtitle` từ `my-subtitle.srt`). Multi-file imported: + role tag `→ Target` / `→ Native` trong meta. Case guard: filename >20 chars → truncate + `…`.
5. **Multi-file import auto-detect role** — `detectLanguage(content, format)` đã có (`src/lib/detectors/languageDetector.ts`). Detect lang mỗi file → so sánh với target lang + native lang → assign role. Fallback: nếu detect = neither → assign target + toast ghi lang detected.
6. **Reload ghi đè imported sub** — imported sub chỉ dùng session hiện tại. Reload → auto-load từ detected subs (imported sub mất). Ponytail: không persist cues to storage.
7. **Bug #5 fix** — `onSubtitleMatches` (content-script) hiện destroy + re-create dropdown, reset `activeIndex=0`. Fix: giữ `activeIndex` + `matches` state khi re-render.
8. **System colors** — tất cả màu dùng CSS tokens từ `src/popup/styles/theme.css` (primary, warning, success, surface, border, text). Light/dark mode auto-adapt via `[data-theme]`. Panel + chip + toast inherit tokens, không hardcode color.
9. **Panel open behavior** — click sub → switch + toast + GIỮ panel mở (user switch nhiều lần liên tiếp). Click outside / Esc / close button → đóng panel.
10. **Toast debounce** — mỗi action 1 toast. Rapid switch → debounce 500ms (chỉ hiện toast cuối). Auto-dismiss 3s.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (manifest v3)
- **UI**: React 19, Zustand 5, TypeScript 6 (popup) + vanilla DOM (content-script)
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Testing**: Jest 30 (unit + integration), edge-devtools MCP (browser verify)
- **Platform**: Windows (PowerShell)
- **Design tokens**: `src/popup/styles/theme.css` (CSS custom properties, light/dark via `[data-theme]`)

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test unit:        npm run test:unit
Test integration: npm run test:integration
Lint:             npm run lint
```

## Project Structure

```
src/
├── content/
│   ├── content-script.ts              # Wire manager panel + import flow + bug #5 fix
│   ├── subtitleOverlay.ts             # (unchanged — loadBilingualCues merge đã có ADR-014 V1)
│   ├── subtitleAutoLoad.ts            # handleAutoLoadSubtitles — giữ activeIndex khi re-render (bug #5)
│   ├── subtitleSelector.ts            # REFACTOR V1→V2: createSubtitleDropdown → createSubtitleManagerPanel
│   ├── subtitleImport.ts              # UPDATE: multi-file + detect lang + auto-assign role
│   ├── subtitleDragDrop.ts            # UPDATE: multi-file drag-drop + detect lang
│   └── subtitleManagerPanel.ts        # NEW — panel UI (2 section, radio, active highlight, toast)
├── lib/
│   └── detectors/
│       └── languageDetector.ts        # REUSE — detectLanguage (auto-assign role cho import)
├── popup/
│   └── styles/
│       └── theme.css                  # REUSE — design tokens (light/dark mode)
├── types/
│   ├── media.ts                       # UPDATE: SubtitlePreference + ImportedSubtitle type
│   └── subtitle.ts                    # UPDATE: SubtitleManagerState type
└── constants/
    └── config.ts                      # (unchanged — subtitlePreference default đã có ADR-014 V1)

tests/
├── unit/
│   ├── subtitleManagerPanel.test.ts          # NEW — panel render, section, radio, active highlight
│   ├── subtitleImport.test.ts                # UPDATE — multi-file + detect lang + auto-assign role
│   ├── subtitleNaming.test.ts                # NEW — naming convention + case guard + extension strip
│   └── subtitleAutoLoad.test.ts              # UPDATE — bug #5: giữ activeIndex khi re-render
└── integration/
    └── subtitleManagerPanel.integration.test.ts # NEW — end-to-end panel + import + switch + toast
```

## Code Style

```typescript
// Naming convention — pure function (testable)
export function formatSubtitleName(
  source: 'auto' | 'imported',
  language: string,
  index: number,
  filename?: string,
): string {
  if (source === 'imported' && filename) {
    const nameWithoutExt = filename.replace(/\.(srt|vtt|ass|ssa)$/i, '');
    return nameWithoutExt.length > 20
      ? nameWithoutExt.slice(0, 20) + '…'
      : nameWithoutExt;
  }
  const langName = isoToLanguageName(language); // 'en' → 'English'
  return `${langName} #${index + 1}`;
}

// Multi-file import — auto-assign role by detected language
export function assignImportRole(
  files: ParsedFile[],
  targetLang: string,
  nativeLang: string,
): { target?: ImportedSubtitle; native?: ImportedSubtitle; ignored: File[] } {
  const target = files.find(f => f.detectedLang?.toLowerCase() === targetLang.toLowerCase());
  const native = files.find(f => f.detectedLang?.toLowerCase() === nativeLang.toLowerCase());
  const ignored = files.filter(f => f !== target && f !== native);
  return { target, native, ignored };
}

// Bug #5 fix — giữ activeIndex khi re-render
function onSubtitleMatches(payload: AutoLoadSubtitlesPayload): void {
  // ponytail: preserve activeIndex + matches state (bug #5 — không reset về #1)
  const preservedTargetIndex = state.activeTargetIndex ?? 0;
  const preservedNativeIndex = state.activeNativeIndex ?? 0;
  state.targetMatches = payload.targetMatches;
  state.nativeMatches = payload.nativeMatches;
  state.activeTargetIndex = preservedTargetIndex < payload.targetMatches.length
    ? preservedTargetIndex : 0;
  state.activeNativeIndex = preservedNativeIndex < payload.nativeMatches.length
    ? preservedNativeIndex : 0;
  renderManagerPanel();
}
```

## Testing Strategy

- **Unit**:
  - `subtitleManagerPanel.test.ts` — panel render, 2 section collapsible, radio button, active highlight, click sub → onSelect, close outside/Esc/close button
  - `subtitleImport.test.ts` — multi-file import, detect lang, auto-assign role, 6 trường hợp (1 target, 1 native, 1 neither, 2 target+native, 2 cùng lang, 2+ files)
  - `subtitleNaming.test.ts` — `formatSubtitleName` (auto: `English #2`, imported: `my-subtitle`, case guard >20 chars, strip extension)
  - `subtitleAutoLoad.test.ts` — bug #5: giữ activeIndex khi re-render (chọn #2 → push mới → vẫn #2)
- **Integration**: `subtitleManagerPanel.integration.test.ts` — mock 2 sub cùng lang → auto-load first → panel hiện → click sub #2 → re-fetch + render + persist → reload → auto-load sub #2. Import file → detect lang → add vào panel → set active → toast. Multi-file import → 2 files → target + native.
- **Browser MCP**: edge-devtools verify trên themoviebox.org — panel mở, switch sub, import file, multi-file import, toast, active chip, light/dark mode.
- **Coverage**: ≥90% cho `subtitleManagerPanel.ts`, `formatSubtitleName`, `assignImportRole`, bug #5 fix.

## Boundaries

- **Always do**: Run `npm run test:unit` + `npx tsc --noEmit` before commit. Browser-verify content-script changes (AGENTS.md stop-the-line). Dùng CSS tokens từ `theme.css` (không hardcode color). `aria-label` + `title` cho mọi icon/button.
- **Ask first**: Thêm dependency mới, đổi `manifest.json`, đổi message type contract, thêm storage key.
- **Never do**: Commit secrets, log full subtitle URL (ADR-007 D8), phá `parseBilingualSrt` flow (ADR-007 D7), hardcode color (phải dùng theme.css tokens), persist imported cues to storage (reload ghi đè — ponytail).

## Success Criteria (Acceptance)

| ID | Criterion | Verify |
|----|-----------|--------|
| C1 | Toolbar góc trái: import button + manager icon + active chip (`English #2 · Arabic #1`) | Browser MCP: inspect toolbar, check 3 elements present |
| C2 | Click manager icon → panel 320px mở, 2 section (Target blue + Native amber), collapsible | Browser MCP: click icon, snapshot panel structure |
| C3 | Panel list sub cùng lang + radio + name + format + size, active highlight (filled radio + accent border) | Browser MCP: snapshot list items, check active item style |
| C4 | Click sub → switch + toast `✓ Switched to English #1` + active chip update + GIỮ panel mở | Browser MCP: click sub, check toast + chip update + panel still open |
| C5 | Import 1 file → detect lang → auto-assign role → add vào panel list đúng section + set active + toast `✓ Imported {filename}` | Browser MCP: import file, check list + active + toast |
| C6 | Multi-file import 2 files (1 target + 1 native) → add vào cả 2 section + set active cả 2 + toast `✓ Imported 2 files → Target + Native` | Browser MCP: import 2 files, check both sections + toast |
| C7 | Multi-file import 2 files cùng lang → assign cả 2 target (hoặc native) + toast ghi số file | Unit test: `assignImportRole` 2 files cùng lang |
| C8 | Multi-file import 2+ files → first target-lang + first native-lang, rest ignore + toast `✓ Imported {N} files` | Unit test: `assignImportRole` 3 files |
| C9 | Naming: auto `English #2`, imported `my-subtitle` (không extension), case guard >20 chars → `…` | Unit test: `formatSubtitleName` |
| C10 | Bug #5 fix: chọn sub #2 → auto-load push mới → panel vẫn highlight #2 (không reset #1) | Browser MCP: chọn #2, wait for push, check active still #2 |
| C11 | Reload → auto-load ghi đè imported sub (imported sub mất, auto-detected sub load) | Browser MCP: import file, reload, check imported sub gone |
| C12 | Light/dark mode: panel + chip + toast dùng theme.css tokens, auto-adapt via `[data-theme]` | Browser MCP: toggle dark mode, check panel colors change |
| C13 | Mọi icon/button có `aria-label` + `title` (import, manager, close, section header) | Browser MCP: inspect elements, check aria-label + title |
| C14 | Toast debounce 500ms — rapid switch → chỉ hiện toast cuối | Unit test: debounce logic |
| C15 | Panel close: click outside / Esc / close button | Browser MCP: test 3 close methods |

## Open Questions

- **Q1**: Section collapsed default — cả 2 expand hay collapse native nếu chỉ 1 sub? (em recommend: cả 2 expand default, user tự collapse)
- **Q2**: Import sub detect lang = neither target nor native → fallback assign target hay hỏi user? (em recommend: fallback target + toast ghi lang detected)
- **Q3**: Panel position — popover từ manager icon (absolute, top-left) hay slide-in từ trái (full height)? (em recommend: popover 320px, simpler)
- **Q4**: Active chip khi chưa có sub (no auto-load, no import) — ẩn hay hiện "No subtitle"? (em recommend: ẩn chip khi chưa có sub)

## Out of Scope (V2 ceiling)

- **Save imported cues to chrome.storage** — reload ghi đè (ponytail). Nếu persist → complexity cao (storage quota, stale cues, migration).
- **Keyboard shortcut cycle** — `S` cycle qua subs. YAGNI cho V2, để sau nếu demand.
- **Smart-merge timestamp (ADR-007 A6 rejected)** — vẫn out of scope.
- **Multi-tab sync** — preference persist theo site, không sync across tabs real-time.
- **Panel trong Settings Dialog** — chỉ panel overlay, không thêm settings section.
- **Hostname trong naming** — user chỉ quan tâm language + index, không quan tâm nguồn.

## Sources

- Idea file: `docs/intent/idea-subtitle-manager-panel.md`
- Mockup v4: `docs/mockups/subtitle-selector-mockup.html` (system colors + friendly naming + case guard + aria-label)
- ADR-014 V1: `docs/adr/014-subtitle-selector-multi-match.md`
- theme.css: `src/popup/styles/theme.css` (design tokens — primary #2563eb, warning #f59e0b, success #10b981, light/dark via `[data-theme]`)
- detectLanguage: `src/lib/detectors/languageDetector.ts` (auto-assign role cho import)
- createSubtitleDropdown: `src/content/subtitleSelector.ts` (ADR-014 V1 — refactor V2)
- createImportButton: `src/content/subtitleImport.ts` (update multi-file + detect lang)
- handleFileDrop: `src/content/subtitleDragDrop.ts` (update multi-file + detect lang)
- User interview (G0 session 2026-06-29): unified panel + import button góc trái + active name chip + multi-file import + naming thân thiện + system colors + light/dark mode
