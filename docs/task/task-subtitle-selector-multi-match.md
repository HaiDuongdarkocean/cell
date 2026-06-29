# Task List: Subtitle Selector When Multiple Matches (V2 of ADR-007 D3)

> **Giai đoạn**: G4 Implementation (task breakdown đầu G4 — output planning-and-task-breakdown chế độ task list)
> **Status**: Ready for implementation
> **Date**: 2026-06-29
> **Sources**: Spec (`docs/specs/spec-subtitle-selector-multi-match.md`) + Plan (`docs/plan/plan-subtitle-selector-multi-match.md`) + ADR (`docs/adr/014-subtitle-selector-multi-match.md`)
> **Lưu ý**: Mỗi task = 1 atomic commit (theo Phase Boundary Commits rule). TDD: RED → GREEN → COMMIT → REFACTOR → COMMIT.

## Dependency Graph

```
Task 1 (bug A fix: loadBilingualCues merge + unit test)
  │
  └── Task 2 (findPreferredMatch pure fn + unit test)  ← parallel sau Task 1
        │
        └── Task 3 (findSubtitlesForOverlay wire findPreferredMatch + unit test)
              │
              ├── Task 4 (subtitlePreference type + defaults + migration)  ← parallel sau Task 3
              │
              └── Task 5 (background pushAutoLoadSubtitles đọc preference + truyền preferredIndex)
                    │
                    └── Task 6 (createSubtitleDropdown UI + unit test)
                          │
                          └── Task 7 (content-script wire dropdown + re-fetch cache hit + save preference)
                                │
                                └── Task 8 (integration test: dropdown → chọn → re-fetch → persist → reload)
                                      │
                                      └── Task 9 (browser MCP verify B1-B12 + test report)
```

---

## Phase 1: Foundation — Bug A Fix + Pure Logic

### Task 1: Bug A fix — loadBilingualCues merge
**Description**: Sửa `loadBilingualCues` trong `subtitleOverlay.ts:107-113` — merge thay ghi đè. Khi `targetCues.length === 0` → giữ `this.cues` cũ. Khi `nativeCues.length === 0` → giữ `this.nativeCues` cũ. Cả 2 non-empty → vẫn ghi đè (behavior giữ cho regression B11).

**Acceptance criteria**:
- [ ] `loadBilingualCues([], nativeCues)` → `this.cues` không đổi (giữ cues cũ)
- [ ] `loadBilingualCues(targetCues, [])` → `this.nativeCues` không đổi
- [ ] `loadBilingualCues(targetCues, nativeCues)` (cả 2 non-empty) → ghi đè cả 2 (behavior giữ)
- [ ] Existing `subtitleOverlay.test.ts` tests vẫn pass (B11 regression)

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns subtitleOverlay`
- [ ] `npx tsc --noEmit`

**Dependencies**: None

**Files likely touched**:
- `src/content/subtitleOverlay.ts` (1 line change: `if (targetCues.length > 0) this.cues = targetCues; if (nativeCues.length > 0) this.nativeCues = nativeCues;`)
- `tests/unit/content/subtitleOverlay.test.ts` (thêm test case merge)

**Estimated scope**: XS (1-2 files)

---

### Task 2: findPreferredMatch pure function + unit tests
**Description**: Thêm `findPreferredMatch(subtitles, language, preferredIndex?)` vào `subtitleService.ts`. Pure function — filter sub cùng lang, trả sub theo preference index, fallback first-match (index 0) khi `preferredIndex` undefined hoặc out of range.

**Acceptance criteria**:
- [ ] `findPreferredMatch(subs, 'en', undefined)` → first en match (fallback)
- [ ] `findPreferredMatch(subs, 'en', 1)` → second en match (khi có 2+ en)
- [ ] `findPreferredMatch(subs, 'en', 5)` khi chỉ 2 en → first match (out of range fallback, B8)
- [ ] `findPreferredMatch(subs, 'zh', 0)` khi không có zh → null
- [ ] `findPreferredMatch(subs, '', 0)` → null (empty language)
- [ ] Case-insensitive: `findPreferredMatch(subs, 'EN', 0)` match sub `language: 'en'`

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns subtitleService`
- [ ] `npx tsc --noEmit`

**Dependencies**: Task 1 (foundation, không phụ thuộc logic nhưng cùng phase)

**Files likely touched**:
- `src/background/subtitleService.ts` (thêm `findPreferredMatch` export)
- `tests/unit/background/subtitleService.test.ts` (thêm test cases)

**Estimated scope**: XS (1-2 files)

---

## Phase 2: Background Wire — Preference-Aware Auto-Load

### Task 3: findSubtitlesForOverlay dùng findPreferredMatch
**Description**: Refactor `findSubtitlesForOverlay` trong `subtitleService.ts` — gọi `findPreferredMatch(subtitles, targetLang, preferredTargetIndex)` thay `findFirstMatch(subtitles, targetLang)`. Tương tự native. Thêm param `preferences?: { target?: number; native?: number }` vào `findSubtitlesForOverlay` signature.

**Acceptance criteria**:
- [ ] `findSubtitlesForOverlay(subs, settings, { target: 1 })` → target = sub #2 (preference)
- [ ] `findSubtitlesForOverlay(subs, settings, { target: 5 })` khi 2 en → target = first (fallback)
- [ ] `findSubtitlesForOverlay(subs, settings)` (no preferences) → first-match (V1 behavior, B11)
- [ ] Existing `subtitleService.test.ts` tests vẫn pass (update call signature)

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns subtitleService`
- [ ] `npx tsc --noEmit`

**Dependencies**: Task 2

**Files likely touched**:
- `src/background/subtitleService.ts` (refactor `findSubtitlesForOverlay`)
- `tests/unit/background/subtitleService.test.ts` (update tests)

**Estimated scope**: XS (1-2 files)

---

### Task 4: subtitlePreference type + defaults + migration
**Description**: Thêm `subtitlePreference: Record<string, Record<string, number>>` vào `Settings` type (`media.ts`). Default `{}` trong `DEFAULT_SETTINGS` (`config.ts`). Migration fill `{}` trong `popupStore.loadPersistedSettings` khi field thiếu.

**Acceptance criteria**:
- [ ] `Settings` type có `subtitlePreference: Record<string, Record<string, number>>`
- [ ] `DEFAULT_SETTINGS.subtitlePreference = {}`
- [ ] Migration: settings cũ thiếu field → fill `{}`
- [ ] `npx tsc --noEmit` pass

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns store`
- [ ] `npx tsc --noEmit`

**Dependencies**: Task 3 (cùng phase, parallel)

**Files likely touched**:
- `src/types/media.ts` (thêm field)
- `src/constants/config.ts` (default)
- `src/popup/store/popupStore.ts` (migration)
- `tests/unit/popup/store.test.ts` (migration test)

**Estimated scope**: S (3-4 files)

---

### Task 5: background pushAutoLoadSubtitles đọc preference
**Description**: Trong `background/index.ts pushAutoLoadSubtitles` — đọc `settings.subtitlePreference[origin][targetLang]` + `[origin][nativeLang]` → truyền vào `findSubtitlesForOverlay(subtitles, settings, { target: prefTarget, native: prefNative })`. Origin extracted từ `tab.url` (cần lấy tab URL qua `chrome.tabs.get(tabId)`).

**Acceptance criteria**:
- [ ] `pushAutoLoadSubtitles` đọc preference từ storage + origin
- [ ] Preference có `{ themoviebox.org: { en: 1 } }` → push sub #2 (en)
- [ ] Preference empty → first-match (V1 behavior)
- [ ] Origin extraction: `new URL(tabUrl).hostname` → `themoviebox.org`

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns integration.test`
- [ ] `npx tsc --noEmit`

**Dependencies**: Task 3 + Task 4

**Files likely touched**:
- `src/background/index.ts` (pushAutoLoadSubtitles + helper extractOrigin)
- `tests/unit/background/integration.test.ts` (update test)

**Estimated scope**: S (2 files)

---

## Phase 3: Dropdown UI + Content-Script Wire

### Task 6: createSubtitleDropdown UI + unit tests
**Description**: Tạo `src/content/subtitleSelector.ts` — `createSubtitleDropdown(role, container, subtitles, language, activeIndex, onSelect)`. Icon `chevron-down` SVG position absolute top-right container, z-index = overlay z-index + 1. Click → popover list sub cùng lang + cue count + format, highlight active. Đóng khi click outside / Esc / chọn sub. Chỉ 1 dropdown open tại 1 thời điểm.

**Acceptance criteria**:
- [ ] `createSubtitleDropdown` trả `{ icon, destroy }`
- [ ] Icon render top-right container, `pointer-events: auto`
- [ ] Click icon → popover list sub cùng lang (cue count + format)
- [ ] Highlight sub active (activeIndex)
- [ ] Click outside → đóng popover
- [ ] Esc → đóng popover
- [ ] Click sub item → gọi `onSelect(index)` + đóng popover
- [ ] `destroy()` remove icon + popover + event listeners
- [ ] Chỉ 1 dropdown open (click dropdown thứ 2 đóng dropdown thứ 1)

**Verification**:
- [ ] `npm run test:unit -- --testPathPatterns subtitleSelector`
- [ ] `npx tsc --noEmit`

**Dependencies**: Task 5 (cùng milestone, nhưng UI độc lập — có thể parallel)

**Files likely touched**:
- `src/content/subtitleSelector.ts` (NEW)
- `tests/unit/content/subtitleSelector.test.ts` (NEW)

**Estimated scope**: M (2 files, NEW module)

---

### Task 7: content-script wire dropdown + re-fetch + save preference
**Description**: Wire `createSubtitleDropdown` vào `content-script.ts` — sau khi `handleAutoLoadSubtitles` xong, check số sub cùng lang. Nếu ≥2 → render dropdown. `onSelect` callback: `fetchAndParseSubtitle` (cache hit) → `controller.loadBilingualCues` (D1 merge) → save preference `chrome.storage.local.set`. Cần list sub detected — lấy từ background qua message mới hoặc từ `AUTO_LOAD_SUBTITLES` payload mở rộng (thêm `allMatches` field).

**Acceptance criteria**:
- [ ] Sau auto-load, nếu ≥2 sub cùng lang → dropdown icon hiện
- [ ] Click dropdown → list sub cùng lang
- [ ] Chọn sub #2 → re-fetch (cache hit instant) → `loadBilingualCues` → overlay text đổi
- [ ] Save preference: `subtitlePreference[origin][lang] = index`
- [ ] Bug A không xảy ra: `loadBilingualCues` merge giữ side kia (D1)
- [ ] Dropdown destroy khi content-script re-inject

**Verification**:
- [ ] `npm run test:unit`
- [ ] `npx tsc --noEmit`

**Dependencies**: Task 5 + Task 6

**Files likely touched**:
- `src/content/content-script.ts` (wire dropdown)
- `src/content/subtitleAutoLoad.ts` (mở rộng payload hoặc helper lấy allMatches)
- `src/types/message.ts` (mở rộng AutoLoadSubtitlesPayload nếu cần)
- `tests/unit/content/content-script.test.ts` (nếu có)

**Estimated scope**: M (3-4 files)

---

## Phase 4: Integration + Browser Verify

### Task 8: Integration test — dropdown → chọn → persist → reload
**Description**: Integration test `subtitleSelector.integration.test.ts` — mock 2 sub cùng lang → auto-load first → dropdown hiện → click sub #2 → re-fetch + render + persist → simulate reload → auto-load sub #2 (preference-aware).

**Acceptance criteria**:
- [ ] Mock 2 sub "en" → auto-load first (sub #1)
- [ ] Dropdown render với 2 items
- [ ] Click sub #2 → `loadBilingualCues` với sub #2 cues
- [ ] `chrome.storage.local` save `subtitlePreference[origin].en = 1`
- [ ] Simulate reload → `findSubtitlesForOverlay` với preference → push sub #2

**Verification**:
- [ ] `npm run test:integration -- --testPathPatterns subtitleSelector`
- [ ] `npx tsc --noEmit`

**Dependencies**: Task 7

**Files likely touched**:
- `tests/integration/subtitleSelector.integration.test.ts` (NEW)

**Estimated scope**: S (1 file)

---

### Task 9: Browser MCP verify B1-B12 + test report
**Description**: Browser verify trên themoviebox.org (2x en) dùng edge-devtools MCP. Verify 12 acceptance criteria (B1-B12). Viết test report `docs/test-reports/2026-06-29-subtitle-selector-multi-match-mcp.md`.

**Acceptance criteria**:
- [ ] B1: Dropdown icon hiện khi ≥2 sub cùng lang
- [ ] B2: Click → list sub + cue count + format, highlight active
- [ ] B3: Chọn sub #2 → re-fetch + render text mới + đóng
- [ ] B4: Reload → auto-load sub #2 (preference persist)
- [ ] B5: Bug A fix — target rỗng giữ cues cũ (verify multiple push không clear)
- [ ] B6: Dropdown không che subtitle text
- [ ] B7: Click outside / Esc → đóng dropdown
- [ ] B8: Index out of range → fallback first-match
- [ ] B9: Cache hit < 50ms
- [ ] B10: `npm run test:unit` + `npx tsc --noEmit` pass
- [ ] B11: Existing bilingual auto-load (1 sub) vẫn hoạt động
- [ ] B12: Existing drag handle + appearance manager không phá

**Verification**:
- [ ] edge-devtools MCP verify trên themoviebox.org
- [ ] Test report written

**Dependencies**: Task 8

**Files likely touched**:
- `docs/test-reports/2026-06-29-subtitle-selector-multi-match-mcp.md` (NEW)

**Estimated scope**: S (1 file, docs only)

---

## Checkpoints

### Checkpoint after Task 1-2 (Foundation)
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Bug A fix verified (loadBilingualCues merge)
- [ ] findPreferredMatch pure fn verified

### Checkpoint after Task 3-5 (Background wire)
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Background push sub theo preference verified

### Checkpoint after Task 6-7 (Dropdown UI + wire)
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Dropdown render + click + re-fetch verified (unit)

### Checkpoint after Task 8-9 (Integration + browser)
- [ ] Integration test pass
- [ ] Browser MCP B1-B12 pass
- [ ] Test report written
- [ ] Ready for G5/G6 release
