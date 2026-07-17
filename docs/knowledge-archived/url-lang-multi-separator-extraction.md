# URL language extraction — multi-separator (kisskh.buzz kebab-case)

> **Principle**: [Multi-separator extraction — try multiple separators, validate with domain guard](principles.md#multi-separator-extraction--try-multiple-separators-validate-with-domain-guard)

## Problem

Cùng commit `e106b1e` fix kisskh.buzz auto-load, bug thứ 2: subtitle URLs detect được nhưng `language='unknown'` → không match target lang `'en'` → auto-load không trigger (kể cả khi parse SRT đã fix).

Edge MCP debug:
- URL: `https://media.angkortv.com/a-hundred-memories-episode-1-en.srt`
- `extractLanguage(url)` cũ → `'unknown'` (không phải `'en'`)
- `findSubtitlesForOverlay` không match `targetLanguage: 'en'` → `result = null` → `pushAutoLoadSubtitles` return sớm, không gửi `AUTO_LOAD_SUBTITLES`

## Root causes

`src/features/detection/logic/subtitleDetector.ts` — `extractLanguage` cũ chỉ split theo `.`:

```ts
function extractLanguage(url: string): string {
  const pathname = url.split('?')[0]?.split('#')[0] ?? url;
  const filename = pathname.split('/').pop() ?? '';
  const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');
  const parts = filenameWithoutExt.split('.');

  if (parts.length >= 2) {
    const candidate = parts[parts.length - 1] ?? '';
    if (BCP47_PATTERN.test(candidate)) {
      const primary = candidate.split('-')[0].toLowerCase();
      if (isValidIsoCode(primary)) return primary;
    }
  }
  // ... folder segment fallback ...
  return 'unknown';
}
```

URL kisskh: `a-hundred-memories-episode-1-en.srt`
- `filenameWithoutExt` = `a-hundred-memories-episode-1-en`
- `parts = filenameWithoutExt.split('.')` = `["a-hundred-memories-episode-1-en"]` (1 phần, vì không có `.`)
- `parts.length >= 2` = false → skip
- Folder segment fallback: `segments = ["https:", "media.angkortv.com", "a-hundred-memories-episode-1-en.srt"]`, `segments[length-2]` = `"media.angkortv.com"` → không phải BCP47 → skip
- Return `'unknown'`

Kisskh dùng kebab-case (`-en`) thay vì dot-separated (`episode-1.en.srt`). Convention khác → extract miss.

## Fix

`src/features/detection/logic/subtitleDetector.ts` — thêm kebab-case fallback giữa dot-split và folder segment:

```ts
// Kebab-case language suffix: some sites (kisskh.buzz) use
// `episode-1-en.srt` instead of `episode-1.en.srt`. Split by '-' and check
// the last segment as a BCP47 primary subtag. isValidIsoCode guards against
// false positives like "memories", "episode", "1" (not 2-3 letters or not
// in ISO map).
const kebabParts = filenameWithoutExt.split('-');
if (kebabParts.length >= 2) {
  const candidate = kebabParts[kebabParts.length - 1] ?? '';
  if (BCP47_PATTERN.test(candidate)) {
    const primary = candidate.split('-')[0].toLowerCase();
    if (isValidIsoCode(primary)) return primary;
  }
}
```

Logic:
1. Dot-split thử trước (convention chuẩn: `episode-1.en.srt`)
2. Nếu dot-split fail → kebab-split thử (convention kisskh: `episode-1-en.srt`)
3. `isValidIsoCode` guard: reject false positives như `"memories"` (8 chars, không phải 2-3), `"episode"` (7 chars), `"1"` (1 char, không phải 2-3)
4. Nếu cả 2 fail → folder segment fallback (như cũ) → `'unknown'`

## Key insight

Khi extract structured data (language code, version, episode number) từ URL/filename, thử nhiều separator convention (`.`, `-`, `_`) — các site khác nhau dùng convention khác nhau. Validate candidate với domain guard (`isValidIsoCode` cho language, regex cho version pattern) để tránh false positives từ word fragments. Order: most-specific convention first (dot-split cho lang suffix), broader convention second (kebab-split), structural fallback last (folder segment).

## Verification

### Unit test
`tests/unit/shared/lib/parsers/srtParser.test.ts` — test kisskh "None" format pass (Bug 1 fix). Bug 2 fix covered bởi existing `subtitleDetector` tests (196 tests pass) — kebab-case không break existing dot-split cases.

### Browser verify (Edge MCP, kisskh.buzz/2026/06/06/a-hundred-memories-2025/?episode=1)
- Trước fix: `AUTO_LOAD_SUBTITLES received { targetLang: 'unknown' }` → `findSubtitlesForOverlay` return null → không push
- Sau fix: `AUTO_LOAD_SUBTITLES received { targetUrl: 'https://media.angkortv.com/a-hundred-memories-episode-1-en.srt', targetLang: 'en' }` → `sectionHeaders: ["Target · English1 subtitle"]` — auto-load thành công ✓

### Quality gates
- `npx jest --selectProjects unit --testPathPatterns "subtitleDetector|subtitleService|detection"` → 196 tests pass
- `npm run typecheck` → pass
- `npm run build` → pass
