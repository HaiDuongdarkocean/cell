# Spec: Subtitle Selector When Multiple Matches (V2 of ADR-007 D3)

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-29
> **Intent source**: `docs/intent/intent-subtitle-selector-multi-match.md`

## Objective

Khi trang video có **≥2 subtitle cùng language** (vd themoviebox.org có 2 sub "en"), user có thể **chọn subtitle cụ thể** qua overlay dropdown thay vì bị first-match random (ADR-007 V1). Preference persist theo site (origin) — quay lại site tự động áp dụng sub đã chọn. Feature này cũng **giải quyết bug A** (target overlay rỗng do `loadBilingualCues` ghi đè cues cũ bằng cues mới = [] khi background push lần cuối chỉ native).

**User**: Người học ngoại ngữ xem phim/video với bilingual subtitle overlay trên trang web (content script).

**Why now**: ADR-007 D3/A4 đã ghi "V1 first-match, V2 dropdown nếu demand". Bug A evidence (console log themoviebox: `targetCueCount: 0` do multiple push) cho thấy demand thật + V1 có bug. Sites phổ biến (themoviebox 2x en, kisskh 2x id) có ≥2 sub cùng lang thường xuyên.

**Success**:
- Khi ≥2 sub cùng lang, overlay hiện dropdown icon (góc phải) → click → list sub cùng lang + cue count + format → chọn → re-fetch (cache hit instant) + render ngay
- Auto-load vẫn first-match (không bắt user chọn) — dropdown chỉ hiện khi ≥2 matches, user muốn đổi thì click
- Preference persist theo origin + language + sub index → quay lại site tự động áp dụng sub đã chọn
- Bug A resolved: `loadBilingualCues` merge thay ghi đè (giữ cues cũ khi side mới null/empty) + user chọn sub cụ thể = 1 push duy nhất
- Dropdown không che subtitle text (position absolute, z-index cao, max-height 200px)
- Performance: re-fetch cache hit < 50ms, cache miss < 2s (fetch + parse)

## Assumptions (surface trước khi spec nội dung)

1. **Dropdown overlay** — icon SVG `chevron-down` (Lucide-style) góc phải mỗi overlay (target + native), `pointer-events: auto` chỉ trên icon. Click → popover list sub cùng lang. Đóng khi click outside / Esc / chọn sub.
2. **Persist theo origin + language + sub index** — key: `subtitlePreference: { [origin]: { [lang]: number } }` trong `chrome.storage.local`. Sub index = vị trí trong `subtitles.filter(s => s.language === lang)` array (0-based). Fallback first-match (index 0) nếu index out of range (site đổi sub list).
3. **Auto-load first-match + manual override** — V1 behavior giữ nguyên (first-match). Dropdown chỉ hiện khi ≥2 sub cùng lang. User click dropdown → chọn sub #2 → re-fetch + render + persist preference. Lần sau load page → `findSubtitlesForOverlay` check preference trước, nếu có → dùng sub theo preference, không → first-match.
4. **Bug A fix gộp** — `loadBilingualCues(targetCues, nativeCues)` hiện ghi đè hoàn toàn. Fix: nếu `targetCues.length === 0` → giữ `this.cues` cũ; nếu `nativeCues.length === 0` → giữ `this.nativeCues` cũ. 1 line fix trong `subtitleOverlay.ts:107-113`.
5. **Background push 1 sub duy nhất khi user chọn** — khi user chọn sub qua dropdown, content-script gửi message `CHANGE_SUBTITLE` lên background → background push `AUTO_LOAD_SUBTITLES` với 1 sub duy nhất (không multiple push). Hoặc content-script tự re-fetch (cache hit) + `loadBilingualCues` với sub mới — đơn giản hơn, không qua background.
6. **Dropdown list content** — mỗi item: `Sub #1 (761 cues, SRT)`, `Sub #2 (643 cues, VTT)`. Highlight sub đang active. Click → chọn + đóng dropdown.
7. **Cache reuse** — ADR-007 D5 đã có `subtitleCache: Map<URL, { cues, format }>`. Re-fetch sub đã chọn = cache hit (instant). Sub chưa fetch = cache miss (fetch + parse, ~1-2s).
8. **z-index** — dropdown popover z-index = overlay z-index + 1 (target 1000000, native 999999). Không che overlay text vì position absolute góc phải, max-width 200px.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (manifest v3)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Testing**: Jest 30 (unit + integration), edge-devtools MCP (browser verify)
- **Platform**: Windows (PowerShell)

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
│   ├── content-script.ts          # Wire dropdown + storage.onChanged + bug A fix
│   ├── subtitleOverlay.ts         # loadBilingualCues merge fix (bug A)
│   ├── subtitleAutoLoad.ts        # handleAutoLoadSubtitles (reuse cache)
│   └── subtitleSelector.ts        # NEW — createSubtitleDropdown (overlay dropdown)
├── background/
│   ├── index.ts                   # findSubtitlesForOverlay check preference
│   └── subtitleService.ts         # findFirstMatch → findPreferredMatch (preference-aware)
├── popup/
│   └── store/popupStore.ts        # Migration: subtitlePreference default {}
├── types/
│   ├── media.ts                   # Settings + subtitlePreference field
│   └── message.ts                 # CHANGE_SUBTITLE message type (if needed)
└── constants/
    └── config.ts                  # DEFAULT_SETTINGS.subtitlePreference = {}

tests/
├── unit/
│   ├── subtitleSelector.test.ts           # NEW — dropdown render, click, close
│   ├── subtitleService.test.ts            # Update — findPreferredMatch
│   └── subtitleOverlay.test.ts            # Update — loadBilingualCues merge fix
└── integration/
    └── subtitleSelector.integration.test.ts # NEW — end-to-end dropdown flow
```

## Code Style

```typescript
// Pure function — preference-aware subtitle match (testable)
export function findPreferredMatch(
  subtitles: DetectedSubtitle[],
  language: string,
  preferredIndex: number | undefined,
): SubtitleForOverlayResult | null {
  const matches = subtitles.filter((s) => s.language.toLowerCase() === language.toLowerCase());
  if (matches.length === 0) return null;
  const index = preferredIndex !== undefined && preferredIndex < matches.length
    ? preferredIndex
    : 0;
  const match = matches[index];
  return { url: match.url, language: match.language, format: match.format };
}

// loadBilingualCues merge fix (bug A) — 1 line change
loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
  if (targetCues.length > 0) this.cues = targetCues;   // ponytail: merge thay ghi đè (bug A)
  if (nativeCues.length > 0) this.nativeCues = nativeCues;
  this.bilingual = true;
  this.lastIndex = -1;
  this.lastNativeIndex = -1;
}
```

## Testing Strategy

- **Unit**: `subtitleSelector.test.ts` (dropdown render, click chọn, close outside/Esc), `subtitleService.test.ts` (findPreferredMatch với/ko preference, index out of range), `subtitleOverlay.test.ts` (loadBilingualCues merge — target rỗng giữ cũ, native rỗng giữ cũ, cả 2 rỗng giữ cả).
- **Integration**: `subtitleSelector.integration.test.ts` — mock 2 sub cùng lang → auto-load first → dropdown hiện → click sub #2 → re-fetch + render + persist → reload → auto-load sub #2.
- **Browser MCP**: edge-devtools verify trên themoviebox.org (2x en) — dropdown hiện, chọn sub #2, target+native overlay đều có text, reload → sub #2 tự động.
- **Coverage**: ≥90% cho `subtitleSelector.ts`, `findPreferredMatch`, `loadBilingualCues` merge.

## Boundaries

- **Always do**: Run `npm run test:unit` + `npx tsc --noEmit` before commit. Browser-verify content-script changes (AGENTS.md stop-the-line).
- **Ask first**: Thêm dependency mới, đổi `manifest.json`, đổi message type contract.
- **Never do**: Commit secrets, log full subtitle URL (ADR-007 D8), phá `parseBilingualSrt` flow (ADR-007 D7).

## Success Criteria (Acceptance)

| ID | Criterion | Verify |
|----|-----------|--------|
| B1 | Khi ≥2 sub cùng lang, overlay hiện dropdown icon (góc phải target + native) | Browser MCP: inspect overlay, check dropdown icon present khi 2x en |
| B2 | Click dropdown → list sub cùng lang + cue count + format, highlight sub active | Browser MCP: click icon, snapshot list items |
| B3 | Chọn sub #2 → re-fetch (cache hit instant) + render text mới + đóng dropdown | Browser MCP: click sub #2, check overlay text đổi |
| B4 | Preference persist theo origin + lang + index → reload page → auto-load sub #2 | Browser MCP: reload, check overlay text = sub #2 |
| B5 | Bug A fix: `loadBilingualCues` merge — target rỗng giữ cues cũ | Unit test: loadBilingualCues([], nativeCues) → this.cues không đổi |
| B6 | Dropdown không che subtitle text (position absolute, z-index overlay+1, max-height 200px) | Browser MCP: screenshot overlay + dropdown open |
| B7 | Dropdown đóng khi click outside / Esc / chọn sub | Browser MCP: click outside → dropdown đóng |
| B8 | Index out of range (site đổi sub list) → fallback first-match, không crash | Unit test: findPreferredMatch(subs, 'en', 5) khi chỉ 2 sub → index 0 |
| B9 | Cache hit re-fetch < 50ms, cache miss < 2s | Unit test: mock cache, measure |
| B10 | npm run test:unit + npx tsc --noEmit pass | CI |
| B11 | Existing bilingual auto-load (ADR-007 V1) vẫn hoạt động khi chỉ 1 sub | Regression: subtitleOverlay.test.ts existing tests pass |
| B12 | Existing drag handle, appearance manager (ADR-013) không phá | Regression: subtitleDragPosition + subtitleStyleApply tests pass |

## Open Questions

1. **Dropdown icon position** — góc phải overlay (trên text) hay góc phải container (ngoài overlay)? Góc phải overlay có thể che text khi text dài. → Em đề xuất góc phải **container** (video.parentElement), position absolute top-right, không che overlay text.
2. **Persist key granularity** — origin only (themoviebox.org → 1 preference cho tất cả movie) hay origin + path (themoviebox.org/movie/A → riêng themoviebox.org/movie/B)? → Em đề xuất origin only (đơn giản, đủ cho V2).
3. **CHANGE_SUBTITLE message** — content-script tự re-fetch (cache hit) hay qua background? → Em đề xuất content-script tự re-fetch (cache hit instant, không round-trip background, đơn giản hơn).

→ Anh confirm 3 open questions trước em sang G2 Plan.
