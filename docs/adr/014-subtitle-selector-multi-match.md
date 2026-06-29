# ADR-014: Subtitle Selector When Multiple Matches (V2 of ADR-007 D3) + Bug A Fix

## Status
Proposed (G3 — chờ G4 implement + G5 verify)

## Context

ADR-007 D3 quyết định V1 "first-match wins, no dropdown" khi 2+ subtitle cùng language match. A4 rejected dropdown với lý do "scope creep, edge case hiếm, V1 ship nhanh, V2 thêm nếu demand". Bug A evidence (console log themoviebox session 2026-06-29: `targetCueCount: 0` do multiple `AUTO_LOAD_SUBTITLES` push, lần cuối chỉ native → `loadBilingualCues([], nativeCues)` ghi đè target cues cũ = []) cho thấy:
1. **Demand thật**: sites phổ biến (themoviebox.org 2x "en", kisskh.co 2x "id") có ≥2 sub cùng lang thường xuyên.
2. **V1 có bug**: `loadBilingualCues` ghi đè unconditionally → multiple push clear cues cũ.
3. **User không có cách chọn sub cụ thể** khi first-match trúng sub hỏng.

**Forces (từ spec `docs/specs/spec-subtitle-selector-multi-match.md`)**:
- User cần chọn sub cụ thể khi ≥2 matches (US1).
- Auto-load first-match giữ nguyên (không bắt user chọn) — dropdown chỉ khi user muốn đổi (US1).
- Persist theo site (origin) — quay lại tự động áp dụng (US2).
- Bug A phải fix (US3) — `loadBilingualCues` merge thay ghi đè.
- Dropdown không che subtitle text (US4, B6).
- Re-fetch cache hit instant (ADR-007 D5 đã có cache).
- Không thêm dependency (ponytail rung 2: reuse `fetchAndParseSubtitle` + `subtitleCache` + `CustomSelect` styling).
- Không break ADR-007 V1 flow (B11) + ADR-013 appearance manager (B12).

**Constraints (MV3 + codebase)**:
- Background quyết định "load cái nào" (ADR-007 D2), content-script "hiển thị thế nào" — preference-aware match phải ở background (`findSubtitlesForOverlay`).
- Content-script re-fetch khi user chọn sub = cache hit (ADR-007 D5), không qua background (AD4 — tránh SW restart risk).
- `chrome.storage.local` 10MB quota — `subtitlePreference` object ~1KB, negligible.
- Existing migration pattern trong `popupStore.ts:170-198` (fill default `{}` cho field mới).
- `subtitleAutoLoad.ts:162` decoupled từ `SubtitleOverlayController` — dropdown reuse `fetchAndParseSubtitle` + `subtitleCache`, không phụ thuộc controller.

## Decision

### D1: Bug A fix — `loadBilingualCues` merge thay ghi đè (1 line, foundation)

```typescript
// OLD (subtitleOverlay.ts:107-113) — ghi đè unconditionally:
loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
  this.cues = targetCues;        // bug A: [] clear cues cũ
  this.nativeCues = nativeCues;
  this.bilingual = true;
  this.lastIndex = -1;
  this.lastNativeIndex = -1;
}

// NEW — merge: chỉ update side có cues mới (non-empty)
loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
  if (targetCues.length > 0) this.cues = targetCues;   // ponytail: merge thay ghi đè (bug A, ADR-014 D1)
  if (nativeCues.length > 0) this.nativeCues = nativeCues;
  this.bilingual = true;
  this.lastIndex = -1;
  this.lastNativeIndex = -1;
}
```

**Rationale**: Root cause bug A — multiple `AUTO_LOAD_SUBTITLES` push (do `onMediaDetected` fire incremental + `REQUEST_AUTO_LOAD_SUBTITLES` re-push), lần cuối chỉ native → `loadBilingualCues([], nativeCues)` → target cues bị clear. Merge giữ cues cũ khi side mới rỗng = 1 line fix, không phá contract (cả 2 non-empty → vẫn ghi đè như cũ, behavior giữ cho B11 regression).

### D2: `findPreferredMatch` pure function (preference-aware, thay `findFirstMatch`)

```typescript
// NEW (subtitleService.ts) — pure function, testable độc lập
export function findPreferredMatch(
  subtitles: DetectedSubtitle[],
  language: string,
  preferredIndex: number | undefined,
): SubtitleForOverlayResult | null {
  if (!language) return null;
  const matches = subtitles.filter(
    (s) => s.language.toLowerCase() === language.toLowerCase(),
  );
  if (matches.length === 0) return null;
  const index =
    preferredIndex !== undefined && preferredIndex < matches.length
      ? preferredIndex
      : 0; // fallback first-match khi index out of range (B8)
  const match = matches[index];
  return { url: match.url, language: match.language, format: match.format };
}
```

`findSubtitlesForOverlay` gọi `findPreferredMatch(subtitles, targetLang, pref.target)` thay `findFirstMatch(subtitles, targetLang)`. Background đọc `settings.subtitlePreference[origin][lang]` trước khi gọi.

**Rationale**: Pure function testable độc lập (M2). Fallback first-match khi index out of range (site đổi sub list) = graceful degradation (B8). Giữ architecture ADR-007 D2 (background quyết định "load cái nào").

### D3: Dropdown overlay góc phải container (content-script, không che text)

```typescript
// NEW (subtitleSelector.ts) — createSubtitleDropdown
export function createSubtitleDropdown(
  role: 'target' | 'native',
  container: HTMLElement,
  subtitles: DetectedSubtitle[],
  language: string,
  activeIndex: number,
  onSelect: (index: number) => void,
): { icon: HTMLButtonElement; destroy: () => void }
```

- Icon `chevron-down` SVG position absolute top-right **container** (không overlay), z-index = overlay z-index + 1.
- Click → popover list sub cùng lang + cue count + format, highlight sub active.
- Đóng khi click outside / Esc / chọn sub.
- Chỉ 1 dropdown open tại 1 thời điểm (click dropdown thứ 2 đóng dropdown thứ 1).
- Chỉ render icon khi ≥2 sub cùng lang (1 sub → không icon, V1 behavior).

**Rationale**: Container position không che overlay text (Q1=container). Reuse SVG icon pattern từ `subtitleDragPosition.ts` (ponytail rung 2). z-index overlay+1 đảm bảo popover trên overlay.

### D4: Content-script tự re-fetch (cache hit instant, không qua background)

Khi user chọn sub trong dropdown:
1. Content-script gọi `fetchAndParseSubtitle(url, format, tabUrl)` (đã có trong `subtitleAutoLoad.ts:92`).
2. Cache hit (ADR-007 D5) → instant (< 50ms). Cache miss → fetch + parse (~1-2s) + toast "Loading...".
3. `controller.loadBilingualCues(targetCues, nativeCues)` với sub mới (D1 merge đảm bảo không clear side kia).
4. Save preference: `chrome.storage.local.set` update `subtitlePreference[origin][lang] = index`.

**Rationale**: Cache hit = instant (B9). Tránh round-trip background (MV3 SW có thể restart giữa chừng). Reuse `fetchAndParseSubtitle` + `subtitleCache` đã có (ponytail rung 2).

### D5: Persist theo origin + lang + sub index (`chrome.storage.local`)

```typescript
// Settings type extension (media.ts)
readonly subtitlePreference: Record<string, Record<string, number>>;
// key = origin (vd "themoviebox.org"), value = { [lang]: subIndex }
```

- Migration default `{}` trong `popupStore.loadPersistedSettings`.
- Content-script save khi user chọn sub.
- Background đọc khi `pushAutoLoadSubtitles` → truyền `preferredIndex` cho `findSubtitlesForOverlay`.
- Origin extracted từ `new URL(tabUrl).hostname` (vd `themoviebox.org`).

**Rationale**: Origin stable (không expire như signed URL). Sub index = vị trí trong `subtitles.filter(s => s.language === lang)` array. Fallback first-match khi index out of range (B8). Origin only đủ cho V2 (Q2=origin only, đơn giản, không quá granular).

## Alternatives Considered

### A1: Dedup push ở background (skip push nếu URL đã push)
- Background giữ set URL đã push, skip nếu URL đã push.
- **Rejected**: Không fix root cause (ghi đè vẫn xảy ra khi user manually đổi sub). Phức tạp hơn D1 (1 line). Bug A vẫn xảy ra khi background push native-only sau target+native push.

### A2: Content-script tự filter + chọn sub (không qua background)
- Content-script đọc `chrome.storage.local` trực tiếp, tự filter sub theo preference.
- **Rejected**: Sai architecture ADR-007 D2 (background quyết định "load cái nào", content-script "hiển thị thế nào"). Content-script không có `chrome.tabs`, không biết sub đã detect (chỉ background biết qua network interceptor).

### A3: Dropdown trong Side Panel
- Dropdown trong Side Panel subtitle panel, chọn sub → re-fetch.
- **Rejected**: Sai UX (user xem overlay, không nhìn panel khi muốn đổi sub). Quick switch cần inline overlay.

### A4: Dropdown trong Settings Dialog
- Settings Dialog thêm section "Subtitle selector" với 2 dropdown target/native.
- **Rejected**: Quá nặng cho quick switch. Settings Dialog đã có 3 tab (Target/Native/General), thêm section = clutter. Dropdown overlay inline đủ cho V2.

### A5: `CHANGE_SUBTITLE` message qua background
- Content-script gửi `CHANGE_SUBTITLE` lên background → background push `AUTO_LOAD_SUBTITLES` với 1 sub duy nhất.
- **Rejected**: Round-trip + SW restart risk. Cache hit instant ở content-script đơn giản hơn (D4). Background chỉ cần biết preference cho auto-load lần sau, không cần tham gia re-fetch.

### A6: Persist theo full URL
- `subtitlePreference: Record<string, number>` key = full sub URL.
- **Rejected**: Signed URL expire (themoviebox CDN signed URL có `Policy` + `Signature` + `Key-Pair-Id` query param, expire sau ~24h). Preference không match khi URL mới → fallback first-match luôn. Origin + index stable hơn.

### A7: Persist theo origin + path (per-movie)
- `subtitlePreference: Record<string, Record<string, number>>` key = origin + path.
- **Rejected**: Quá granular cho V2. Preference không share across movies cùng site. Origin only đủ (user thường ưu tiên cùng sub provider cho toàn site).

### A8: Smart-merge timestamp (nối cue khi lệch)
- Merge 2 bộ cues với logic thông minh khi user đổi sub.
- **Rejected**: Out of scope (ADR-007 A6 đã rejected). Chấp nhận lệch nhẹ, native best-effort. Smart-merge = complexity cao, edge case nhiều, ROI thấp.

## Consequences

### Positive
- User chọn sub cụ thể khi ≥2 matches (US1) — bug A tự giải quyết (US3).
- Persist theo site — quay lại tự động áp dụng (US2).
- Bug A fix (D1) — `loadBilingualCues` merge, không clear cues cũ khi side mới rỗng.
- Reuse `fetchAndParseSubtitle` + `subtitleCache` + `CustomSelect` styling (ponytail rung 2).
- 0 dependency mới, 0 manifest change, 0 break ADR-007 V1 / ADR-013.

### Negative
- Dropdown icon thêm 1 element DOM per overlay (target + native) — negligible (2 button + 1 popover).
- `subtitlePreference` object grow theo số site user visit — ~100 bytes/site, 10MB quota = ~10K sites, negligible.
- Cache miss re-fetch ~1-2s — toast "Loading..." mitigate (R3).

### Neutral
- ADR-007 D3 ceiling nâng từ V1 → V2. A4 "rejected dropdown" → superseded bởi ADR-014 D3.
- `findFirstMatch` deprecated → `findPreferredMatch` (findFirstMatch = findPreferredMatch với preferredIndex=undefined).

## Sources

- Intent: `docs/intent/intent-subtitle-selector-multi-match.md` (G0)
- Spec: `docs/specs/spec-subtitle-selector-multi-match.md` (G1)
- Plan: `docs/plan/plan-subtitle-selector-multi-match.md` (G2)
- ADR-007 D3/A4: "V1 first-match, V2 dropdown nếu demand" — `docs/adr/007-bilingual-subtitle-auto-load.md`
- Bug A evidence: console log themoviebox session 2026-06-29 (`targetCueCount: 0` do multiple push, `loadBilingualCues` ghi đè)
- User interview G0 (2026-06-29): overlay dropdown + persist theo site + auto-load first + manual override + feature giải quyết bug A
- User confirm G1 open questions: Q1=container, Q3=content-script tự re-fetch (Q2=origin only default)
