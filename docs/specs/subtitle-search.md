# Spec: Subtitle Search

## Objective

User có thể search subtitle từ nguồn bên ngoài (SubDL primary, OpenSubtitles fallback) ngay trong SubtitleManagerPanel — gõ tên phim + chọn ngôn ngữ → nhận danh sách → click → subtitle load vào overlay như track thường. Nút search **luôn hiển thị** (kể cả khi đã có subtitle) vì user có thể muốn thay subtitle khác.

### User stories

1. **No subtitle:** Video không có subtitle → user mở Manager → gõ tên phim → chọn ngôn ngữ → nhận list → click → subtitle load.
2. **Replace subtitle:** Video có subtitle nhưng user muốn subtitle khác (bản dịch tốt hơn, ngôn ngữ khác) → user mở Manager → gõ tên → chọn → load thay thế.
3. **Power user:** User có SubDL Pro / OpenSubtitles VIP → nhập API key trong Settings → quota cao hơn.

## Tech Stack

- React + TypeScript (existing Cell stack)
- SubDL REST API (`https://subdl.com/api/v2/`) — free key, 2.000 search + 50 download/ngày
- OpenSubtitles REST API (`https://api.opensubtitles.com/api/v1/`) — free key, 5-20 download/ngày
- `fetchAndParseSubtitle` (existing) — fetch + parse SRT/VTT/ASS via background CORS fallback
- `parseAndDetectFiles` + `assignImportRole` (existing) — parse + assign role by language
- `SubtitlePanelItem` model (existing) — track list item shape

## Commands

```bash
Build:       npm run build
Dev build:   npx vite build --mode development
Typecheck:   npm run typecheck
Unit test:   npx jest --selectProjects unit --testPathPatterns="<pattern>"
Lint:        npm run lint
```

## Project Structure

```
src/
  features/
    subtitle/
      logic/
        subtitleSearch.ts          # NEW — pure search logic (SubDL + OpenSubtitles adapters)
        subtitleSearch.test.ts     # NEW — unit tests for search logic
      ui/
        SubtitleManagerPanel.tsx   # MODIFY — add SearchSection component
        SubtitleManagerPanel.module.css  # MODIFY — search section styles
        SubtitleManagerPanel.test.tsx    # MODIFY — search section tests
        SubtitleSearchPanel.tsx    # NEW — search UI (input + language select + results list)
        SubtitleSearchPanel.module.css  # NEW — search panel styles
        SubtitleSearchPanel.test.tsx    # NEW — search panel tests
        reactSubtitleController.ts # MODIFY — wire onSearch callback
        contentScriptController.ts # MODIFY — wire search → fetchAndParseSubtitle → loadBilingualCues
  entities/
    settings/
      types.ts                     # MODIFY — add subdlApiKey + opensubtitlesApiKey fields
  shared/
    config/
      config.ts                    # MODIFY — add DEFAULT_SETTINGS keys for API keys
docs/
  specs/
    subtitle-search.md             # NEW — this spec
  adr/
    NNN-subtitle-search.md          # NEW — ADR (WHY only)
```

## Code Style

Follow existing Cell conventions:
- Named exports, no default export
- Function components + hooks, no class components
- Pure logic functions in `logic/` — testable, no side effects
- `data-cell-id` attributes for test selectors
- Design tokens from `tokens.css` via CSS modules
- `import { Button, Icon, IconButton } from '@/shared/ui'`
- No `any` — strict TypeScript

### Example — search logic pure function

```typescript
// src/features/subtitle/logic/subtitleSearch.ts

export interface SubtitleSearchResult {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly format: 'srt' | 'vtt' | 'ass';
  readonly downloadUrl: string;
  readonly source: 'subdl' | 'opensubtitles';
  readonly rating?: number;
  readonly downloads?: number;
}

export async function searchSubtitles(
  query: string,
  languages: string[],
  apiKeys: { subdl?: string; opensubtitles?: string },
): Promise<SubtitleSearchResult[]> {
  const subdlResults = await searchSubdl(query, languages, apiKeys.subdl);
  if (subdlResults.length > 0) return subdlResults;
  return searchOpenSubtitles(query, languages, apiKeys.opensubtitles);
}
```

## Testing Strategy

- **Unit tests** (`tests/unit/`): pure search logic (SubDL response parsing, OpenSubtitles response parsing, fallback ordering, empty query handling, API key absence)
- **Component tests** (`SubtitleSearchPanel.test.tsx`): render states (idle, loading, results, error, empty), search trigger, result click, language select
- **Integration**: manual browser test via `testing-extension-browser` skill — search on real video page, verify subtitle loads into overlay
- **Coverage**: search logic 100% (pure functions), panel component >90%

## Boundaries

- **Always do:**
  - Run `npm run build` after code changes
  - Use `fetchAndParseSubtitle` for downloading (reuses CORS fallback)
  - Use existing `SubtitlePanelItem` model for results
  - Use design tokens, no hardcoded colors/sizes
  - API keys stored in `Settings` (chrome.storage.local), never hardcoded
  - SubDL-first, OpenSubtitles fallback only when SubDL returns 0 results
- **Ask first:**
  - Adding new npm dependency
  - Changing `manifest.json` host permissions
  - Changing `Settings` interface schema version
- **Never do:**
  - Bundle API keys in extension code
  - Store API keys in plaintext outside chrome.storage
  - Block UI while searching (always async with loading state)
  - Auto-download without user click (respect user choice)

## Success Criteria

1. **Search UI visible:** SubtitleManagerPanel luôn hiển thị search section (không phụ thuộc empty/existing state)
2. **Search by name + language:** User gõ tên phim + chọn ngôn ngữ → nhận danh sách subtitle từ SubDL
3. **Fallback:** SubDL không có kết quả → tự động query OpenSubtitles
4. **Download + load:** Click result → fetch subtitle → parse → load vào overlay → hoạt động như track thường (cues hiển thị, nav cluster update, offset reset)
5. **API key settings:** Settings dialog có 2 field nhập SubDL API key + OpenSubtitles API key. Không nhập = free tier (extension dùng key chung free hoặc anonymous)
6. **Error handling:** Network error / API error / parse error → toast + UI error state, không crash
7. **Loading state:** Search đang chạy → spinner/skeleton, không block UI
8. **Responsive:** Search section hoạt động trên mobile (320px) + desktop
9. **Accessibility:** Search input có label, results list có role="listbox", mỗi result có role="option", keyboard navigable

## Open Questions

1. **Free tier key chung:** Extension có nên bundle 1 SubDL free key chung cho tất cả user (2.000 search + 50 download/ngày shared) hay bắt buộc user tự đăng ký?
   - **Recommendation:** Bundle 1 key chung free tier (SubDL cho phép), user tự nhập key riêng để nâng quota. Nếu key chung hết quota → toast "Free quota exhausted, enter your own API key in Settings".
2. **Language selector:** Hiển thị tất cả ngôn ngữ hay chỉ target + native từ Settings?
   - **Recommendation:** Default = target + native từ Settings, nhưng có option "All languages" để search rộng.
3. **Result limit:** Hiển thị bao nhiêu result?
   - **Recommendation:** 20 results đầu, scroll để xem thêm (lazy load page 2 nếu cần).
