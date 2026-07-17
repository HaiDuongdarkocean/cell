# URL language extraction — lang-index pattern (aniwatch/lostproject `eng-2.vtt`)

> **Principle**: [Multi-separator extraction — try multiple separators, validate with domain guard](principles.md#multi-separator-extraction--try-multiple-separators-validate-with-domain-guard)

## Problem

aniwatch.co.at (via megaplay.buzz iframe player) serve subtitle URLs dạng:
```
https://1oe.lostproject.club/anime/.../subtitles/eng-2.vtt
https://1oe.lostproject.club/anime/.../subtitles/spa-5.vtt
https://1oe.lostproject.club/anime/.../subtitles/por-4.vtt
```

`extractLanguage` trả `'unknown'` cho tất cả → `findSubtitlesForOverlay` không match target/native lang → auto-load không trigger.

SW Console log:
```
[bg pushAutoLoadSubtitles] no match — subtitles detected but none match target/native lang
  detectedLanguages: ['unknown', 'unknown', 'unknown', 'unknown', 'unknown']
  targetLang: 'en', nativeLang: 'es'
```

## Root causes

`src/features/detection/logic/subtitleDetector.ts` — `extractLanguage` có 3 path, tất cả đều miss `eng-2.vtt`:

### Path 1: Dot-split (`parts = filenameWithoutExt.split('.')`)
- `filenameWithoutExt` = `eng-2` (sau remove `.vtt`)
- `parts = ['eng-2']` → length 1 < 2 → skip

### Path 2: Kebab-split (`kebabParts = filenameWithoutExt.split('-')`)
- `kebabParts = ['eng', '2']` → candidate = `'2'` (last segment)
- `BCP47_PATTERN.test('2')` = false (cần 2-3 letters) → skip

### Path 3: Folder segment fallback
- `segments[length-2]` = `'subtitles'` → không phải BCP47 → skip

→ Return `'unknown'`

Pattern `<lang>-<index>.vtt` (eng-2, spa-5, por-4) không match bất kỳ path nào vì:
- Dot-split: filename chỉ có 1 phần (không có `.` sau khi remove extension)
- Kebab-split: last segment là index (`2`), không phải language code
- Folder segment: folder tên là `subtitles`, không phải language

## Fix

Thêm pattern `^([a-z]{2,3})-\d+$` match filename base, extract primary = lang code:

```ts
// Language-index pattern: `<lang>-<index>.vtt` (e.g. `eng-2.vtt`,
// `spa-5.vtt`, `por-4.vtt`). Used by aniwatch/megaplay subtitle CDNs
// (lostproject.club) where the numeric suffix disambiguates multiple
// tracks of the same language. The kebab path above fails because the
// last segment is the index (`2`), not a BCP47 tag. Match the full
// filename base against `^[a-z]{2,3}-\d+$` and take the primary subtag.
const langIndexMatch = /^([a-z]{2,3})-\d+$/i.exec(filenameWithoutExt);
if (langIndexMatch) {
  const primary = langIndexMatch[1].toLowerCase();
  if (isValidIsoCode(primary)) return primary;
}
```

Placement: sau kebab-split path, trước folder segment fallback. `isValidIsoCode` guard rejects false positives như `sub-2.vtt` (`sub` không phải ISO code).

## Key insight

Pattern `<lang>-<index>` là biến thể của kebab-case nhưng index ở cuối khiến kebab-split path miss (last segment = index, không phải lang). Cần match **toàn bộ filename base** thay vì split + check last segment. `isValidIsoCode` guard vẫn bắt buộc — `sub-2.vtt` match shape nhưng `sub` không phải language code. Đây là case thứ 2 của principle "Multi-separator extraction" — mỗi site có convention khác, cần thêm path cho mỗi convention mới gặp.

## Verification

### CLI test (Node.js)
```
eng-2.vtt → eng ✓
spa-5.vtt → spa ✓
por-4.vtt → por ✓
eng.vtt (no index) → unknown (expected — no dot-split, no kebab-match, no lang-index)
episode-1-en.srt (kebab cũ) → en ✓ (không break existing case)
```

### Quality gates
- `npx tsc --noEmit` → pass
- `npm run test:unit` → 2216 passed, 4 skipped, 0 fail
- `npm run build` → pass
