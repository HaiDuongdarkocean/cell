# Spec: Auto-select & Auto-download

## Objective
Giảm thao tác thừa cho người học ngoại ngữ: mở popup → media/subtitle đã tự chọn theo preference (chỉ bấm Download); hoặc vào trang đã whitelist → file tự về không cần mở popup.

**User story:** Là người học ngoại ngữ, tôi muốn extension tự chọn đúng video + subtitle theo preference tôi cài đặt sẵn, và tự tải khi tôi quay lại trang học, để tôi tập trung vào việc học thay vì bấm nút.

**Source intent:** [docs/intent/auto-select-auto-download.md](../intent/auto-select-auto-download.md)

## Tech Stack
- Chrome Extension MV3 (`@crxjs/vite-plugin ^2.7.0`, `@types/chrome ^0.2.0`)
- TypeScript 6, React 19, Zustand 5
- Jest 30 + ts-jest (unit), Playwright 1.61 (e2e)
- Vite 8

## Commands
```
Build:      npm run build
Typecheck:  npm run typecheck
Test:       npm test
Test watch: npm run test:watch
Coverage:   npm run test:coverage
Lint:       npm run lint
Lint fix:   npm run lint:fix
E2E:        npm run test:e2e
```

---

## Mockups

> Design tokens áp dụng (từ `reference-ui_ux_system.md` + CSS hiện tại):
> - Spacing: `--spacing-sm(8) --spacing-md(12) --spacing-lg(16)`
> - Radius: `--radius-sm(4) --radius-md(8) --radius-lg(12)`
> - Color: `--color-primary #3c83f6` (light) / `#8dd6ff` (dark), `--color-text-muted`, `--color-surface`, `--color-border`
> - Icon button: 32×32, `--radius-sm`, `--color-text-muted` default, hover `--color-surface-hover`
> - Popover: 320px, `--radius-lg`, `--shadow-md`, `--color-background`
> - Font: Inter, `--font-size-xs(12)` label, `--font-size-sm(14)` value, `--font-size-base(16)` title

### 1. Popup Header — thêm toggle "Auto Download" (SVG icon button)

Header hiện có 3 icon button 32×32 (gap 2px): `[on/off]` `[☾]` `[⚙]`.
Mới: chèn icon button `AD` ngay sau `[on/off]`, trước `[☾]` → thành `[on/off]` `[AD]` `[☾]` `[⚙]`.

**Auto Download icon button (`AD`):**
- SVG: mũi tên xuống trong khay, stroke 2, 18×18, `stroke-linecap: round`.
- Default (chưa whitelist): `color: var(--color-text-muted)` — xám, giống ☾/⚙.
- Active (đã whitelist): `color: var(--color-primary)`, filled background `var(--color-primary-subtle)`, radius-sm.
- Hover: `background: var(--color-surface-hover)`, `color: var(--color-text)`.
- Focus-visible: `outline: 2px solid var(--color-border-focus)`, offset 1px.
- `aria-pressed={isWhitelisted}`, `aria-label="Toggle auto download for this site"`.
- `title`: "Auto download: ON — URL sẽ tự tải khi ghé lại" / "Auto download: OFF — click để whitelist trang này".

> "Auto Select" KHÔNG ở Header — nằm trong Settings Dialog (xem mục #3).

### 2. Media Section — thay nút "Download All" bằng toggle AD + giữ "Select All"

Section header "Media" (font-size-base semibold) bên phải có `[Select All]` (btnText) + `[AD]` (icon button 32×32, cùng style Header).

**Thay đổi:**
- Nút text "Download All" → thay bằng icon button `AD`.
- Khi `AD` ON: lưu URL trang (origin + first pathname segment, bỏ query/hash và phần path còn lại) vào whitelist. Ví dụ `https://kisskh.co/Drama/Show/Episode-1` → `https://kisskh.co/Drama`. Icon sáng `--color-primary`.
- Khi `AD` OFF: gỡ URL khỏi whitelist, icon mờ `--color-text-muted`.
- Khi có partial selection (`selectionCount > 0 && !allSelected`): hiện thêm nút "Download Selected (N)" (btnText) cạnh `AD`. Không có selection → chỉ hiện `AD`.

**Auto Select hành vi trong media section:**
- Khi `autoSelectEnabled` ON (từ Settings) + mở popup: các card video/subtitle tự check (☑) theo `selectBestMedia()`. User chỉ cần bấm Download từng card hoặc "Download Selected".
- Khi OFF: không tự check, user tự check như cũ.

### 3. Settings Dialog — nhóm logic + SVG icon button cho Auto Select

Popover 320px, `--radius-lg`, `--shadow-md`, `--color-background`, border `--color-border`.
Header: "Settings" `--font-size-base semibold`, close button 28×28 iconBtnSm.
Body: padding `--spacing-md --spacing-lg --spacing-lg`, gap `--spacing-md`, overflow-y auto.

**Thứ tự field (gom nhóm logic, không thêm divider/tabs/accordion):**

Nhóm "chọn media" (đầu):
1. Auto select media — label bên trái, icon button `[✦]` 28×28 bên phải (flex row, justify-between).
2. Preferred format — CustomSelect (mp4/m3u8).
3. Default quality — CustomSelect (giữ nguyên, chỉ đổi vị trí).
4. Select subtitle — MultiSelect có search (thay "Subtitle language" single dropdown).

Nhóm "download" (giữa):
5. Downloads at once — CustomSelect.
6. Convert to MP4 — CustomSelect.
7. Parallel conversion — CustomSelect.
8. Workers — CustomSelect (chỉ hiện khi parallelConversion === 'manual').

Nhóm "filename" (cuối):
9. Filename source — CustomSelect.

Footer: hint "Parallel conversion: auto (số lượng tùy vào GPU...)" — border-top subtle, padding-top md, font-size-xs.

**Auto Select icon button (`[✦]`):**
- SVG: magic wand / sparkles, stroke 2, 18×18, `stroke-linecap: round`.
- Default (OFF): `color: var(--color-text-muted)`.
- Active (ON): `color: var(--color-primary)`, filled background `var(--color-primary-subtle)`, radius-sm.
- Hover: `background: var(--color-surface-hover)`, `color: var(--color-text)`.
- Focus-visible: `outline: 2px solid var(--color-border-focus)`, offset 1px.
- `aria-pressed={autoSelectEnabled}`, `aria-label="Toggle auto select"`.

**Multi-select "Select subtitle":**
- Container: border `--color-border`, radius-md, bg `--color-surface`, overflow hidden.
- Search input: padding 9px 12px, border-bottom `--color-border-subtle`, icon 🔍 left, placeholder "Search languages...".
- Checkbox list: max-height 180px, overflow-y auto, mỗi option padding 8px 10px, hover `--color-surface-hover`, selected `--color-primary-subtle` + text `--color-primary`.
- Footer "Selected: English, Tiếng Việt": font-size-xs, color text-muted, padding-top sm, border-top subtle.

**Thay đổi so với Settings hiện tại:**
- Thêm "Auto select" `[✦]` icon button ở đầu dialog. Field `autoSelectEnabled: boolean`, default false.
- "Subtitle language" (single CustomSelect) → "Select subtitle" (MultiSelect component có search). Field `selectedSubtitleLanguages: string[]` (thay `defaultSubtitleLanguage: string`).
- Thêm "Preferred format" dropdown (mp4/m3u8). Field `preferredVideoFormat: 'mp4' | 'm3u8'`, default `m3u8`.
- "Default quality" giữ nguyên, chỉ đổi vị trí — gom lên nhóm "chọn media".
- Gom nhóm "Download" lại gần nhau, "Filename source" đẩy xuống cuối.

---

## Data Model

### Settings (mới/thay đổi)
```typescript
export interface Settings {
  // ... existing fields ...
  readonly defaultQuality: VideoQuality;           // có sẵn, giữ nguyên
  readonly preferredVideoFormat: 'mp4' | 'm3u8';   // MỚI, default 'm3u8'
  readonly selectedSubtitleLanguages: string[];    // MỚI, thay defaultSubtitleLanguage
  readonly autoSelectEnabled: boolean;             // MỚI, default false
  // defaultSubtitleLanguage: string;              // DEPRECATED — xóa hoặc migrate
}
```

### Whitelist (mới)
```typescript
export interface WhitelistEntry {
  readonly url: string;        // origin + first pathname segment, bỏ query/hash và phần path còn lại
  readonly addedAt: number;    // timestamp
  readonly tabId?: number;     // tab khi add (debug only)
}

// Storage: chrome.storage.local 'autoDownloadWhitelist: WhitelistEntry[]'
```

### Auto-select result (mới — pure function)
```typescript
export interface AutoSelectResult {
  readonly videoId: string;
  readonly subtitleIds: string[];   // tất cả track khớp selectedSubtitleLanguages
  readonly matchedFormat: 'mp4' | 'm3u8';
  readonly matchedQuality: VideoQuality;
  readonly fallbackReason?: 'format' | 'quality' | 'subtitle';
}

// Pure function, testable
export function selectBestMedia(
  videos: DetectedVideo[],
  subtitles: DetectedSubtitle[],
  settings: Pick<Settings, 'preferredVideoFormat' | 'defaultQuality' | 'selectedSubtitleLanguages'>,
): AutoSelectResult | null;
```

---

## Logic

### selectBestMedia (pure function)
```
1. Lọc video theo FORMAT:
   - candidates = videos.filter(v => v.format === settings.preferredVideoFormat)
   - if candidates.empty: candidates = videos (fallback format — lấy tất cả)

2. Trong candidates, chọn video theo QUALITY:
   - if defaultQuality === 'highest': pick video có variant quality cao nhất
   - if defaultQuality === 'auto': same as highest
   - else: pick video có variant gần defaultQuality nhất
     (ưu tiên exact match, rồi nearest lower, rồi nearest higher)
   - Mỗi trang chỉ 1 video (per constraint), nên candidates thường là 1 video
     với nhiều variant → chọn variant đúng quality.

3. Lọc subtitle theo selectedSubtitleLanguages:
   - matchedSubs = subtitles.filter(s =>
       settings.selectedSubtitleLanguages.includes(s.language) ||
       settings.selectedSubtitleLanguages.includes('all'))
   - if matchedSubs.empty: bỏ qua subtitle (vẫn trả video)

4. Return AutoSelectResult { videoId, subtitleIds, ... }
   - fallbackReason: 'format' nếu bước 1 fallback, 'quality' nếu bước 2 không exact, 'subtitle' nếu bước 3 empty.
```

### Auto Select toggle (settings)
- Nằm trong Settings Dialog, section "Auto select", field `autoSelectEnabled`.
- ON: khi mở popup + có media → gọi `selectBestMedia` → set `selectedIds` với videoId + tất cả subtitleIds khớp.
- OFF: clear auto-selection, user tự chọn.
- State persisted trong `settings.autoSelectEnabled`.

### Auto Download toggle (popup, thay nút Download All)
- ON: lấy URL tab active → `origin + first pathname segment` (bỏ query/hash và phần path sau segment đầu) → add vào whitelist (chrome.storage.local). Ví dụ `https://kisskh.co/Drama/Show/Episode-1` whitelist `https://kisskh.co/Drama`, nên mọi episode trong `/Drama` đều tự tải.
- OFF: remove URL khỏi whitelist.
- Nút sáng khi `normalizeUrl(currentTabUrl)` ∈ whitelist.
- Khi ghé trang ∈ whitelist (background script lắng nghe `NetworkInterceptor.onMediaDetected`):
  1. Đợi media detect xong.
  2. Gọi `selectBestMedia(videos, subtitles, settings)`.
  3. Nếu result !== null → trigger download video + tất cả subtitleIds.
  4. Nếu result === null (không có media) → im lặng.
  5. Per-tab guard lưu exact tab URL để ngăn duplicate cho cùng page load (m3u8 → subtitle → variants), nhưng vẫn cho phép auto-download khi chuyển sang episode khác trong cùng whitelisted category.

### Whitelist URL normalization
```typescript
function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const trimmed = u.pathname.replace(/\/$/, '');
    const firstSlash = trimmed.indexOf('/', 1);
    const basePath = firstSlash > 0 ? trimmed.slice(0, firstSlash) : trimmed;
    return u.origin + basePath;
  } catch {
    return rawUrl; // fallback: exact string
  }
}
```

---

## Project Structure (files touched)
```
src/types/media.ts                              → thêm preferredVideoFormat, selectedSubtitleLanguages, autoSelectEnabled; deprecated defaultSubtitleLanguage
src/types/message.ts                            → thêm AUTO_DOWNLOAD_TRIGGER message (background → popup, optional)
src/constants/config.ts                         → thêm DEFAULT_PREFERRED_FORMAT='m3u8', DEFAULT_SELECTED_SUBTITLE_LANGUAGES=['all']
src/lib/selectors/selectBestMedia.ts            → MỚI: pure function pick video+subtitle
src/lib/selectors/selectBestMedia.test.ts       → MỚI: unit test (format fallback, quality nearest, subtitle multi, empty)
src/lib/utils/whitelist.ts                      → MỚI: normalizeUrl, add/remove/has/list whitelist
src/lib/utils/whitelist.test.ts                 → MỚI: unit test normalize + CRUD
src/popup/components/layout/Header.tsx          → thêm 1 toggle icon (Auto Download) sau nút on/off
src/popup/components/layout/Header.module.css   → style toggle Auto Download
src/popup/App.redesigned.tsx                    → thay nút Download All bằng toggle AD; auto-select effect khi autoSelectEnabled ON
src/popup/components/settings/SettingsDialog.tsx→ thêm toggle "Auto select" đầu dialog; đổi Subtitle language → Select subtitle (multi+search); thêm Select video
src/popup/components/settings/SettingsDialog.module.css → style multi-select + search
src/popup/components/settings/MultiSelect.tsx   → MỚI: component multi-select có search (reusable)
src/popup/store/popupStore.ts                   → thêm whitelist state, autoSelectEnabled, actions
src/popup/hooks/useWhitelist.ts                 → MỚI: hook check current tab in whitelist
src/background/index.ts                         → lắng nghe tabs.onUpdated, trigger auto-download khi whitelist match
src/background/autoDownload.ts                  → MỚI: orchestrate detect→select→download cho whitelisted tab
tests/unit/selectors/selectBestMedia.test.ts    → MỚI
tests/unit/utils/whitelist.test.ts              → MỚI
tests/unit/background/autoDownload.test.ts      → MỚI
tests/unit/popup/MultiSelect.test.tsx           → MỚI
tests/e2e/auto-select.spec.ts                   → MỚI (optional)
docs/architechture-system.md                    → cập nhật note auto-select/auto-download
```

---

## Code Style
Theo codebase hiện tại: TypeScript strict, functional style, JSDoc cho public methods, no emojis. Pure functions cho logic testable. Message handler pattern theo `handleGetDetectedMedia` hiện tại.

Ví dụ `selectBestMedia`:
```typescript
/**
 * Pick the best video + matching subtitles from detected media
 * according to user preferences. Pure function — no side effects.
 *
 * @returns null if no video detected; otherwise videoId + subtitleIds.
 */
export function selectBestMedia(
  videos: readonly DetectedVideo[],
  subtitles: readonly DetectedSubtitle[],
  settings: Pick<Settings, 'preferredVideoFormat' | 'defaultQuality' | 'selectedSubtitleLanguages'>,
): AutoSelectResult | null {
  if (videos.length === 0) return null;
  // ... format fallback → quality pick → subtitle filter
}
```

---

## Testing Strategy
- **Unit (80%):**
  - `selectBestMedia`: format fallback (m3u8→mp4), quality nearest (exact/lower/higher), subtitle multi-match, subtitle empty (still return video), no video (return null).
  - `whitelist`: normalizeUrl (bỏ query/hash, giữ first pathname segment), add/remove/has/list, idempotent add.
  - `MultiSelect` component: search filter, toggle checkbox, selected list display.
  - `autoDownload` orchestration: whitelist match → selectBestMedia → trigger download; no media → silent.
- **Integration (15%):**
  - Background `tabs.onUpdated` → whitelist check → auto-download flow.
  - Popup auto-select effect khi AS ON + media update.
- **E2E (5%):**
  - (optional) Mở trang whitelist → file tự về; mở popup AS ON → card tự check.

---

## Migration
- `defaultSubtitleLanguage: string` → `selectedSubtitleLanguages: string[]`.
  - Migration: nếu `defaultSubtitleLanguage` exist và `selectedSubtitleLanguages` undefined → `[defaultSubtitleLanguage]`.
  - Sau 1 release, xóa `defaultSubtitleLanguage`.

---

## Out of Scope
- Retry detect khi trang whitelist không có media (MVP: im lặng).
- Whitelist theo domain (chỉ origin + first pathname segment).
- Tải nhiều video cùng trang (mỗi trang = 1 video).
- Auto download trên trang không trong whitelist.
- UI quản lý whitelist (xem/xóa danh sách trang đã lưu) — có thể thêm sau.
