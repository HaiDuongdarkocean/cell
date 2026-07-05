# formatFromUrl — extension-only check missed query param format

> **Principle**: [Format detection — check query params, not just file extension](principles.md#format-detection--check-query-params-not-just-file-extension)

## Problem

YouTube subtitle auto-load (commit 63fb94d, after PO Token + race condition fixes) fetched VTT content successfully (18019 bytes, `WEBVTT` header) but `parseSubtitle` returned `"No cues found in SRT content"` — 0 cues parsed. The VTT content was valid WebVTT but the parser treated it as SRT.

## Root causes

- `src/features/subtitle/logic/subtitleAutoLoad.ts` `formatFromUrl(url)` detected format by file extension ONLY:
  ```ts
  const path = url.split('?')[0]?.split('#')[0] ?? url;
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  if (ext === '.vtt') return 'vtt';
  if (ext === '.ass' || ext === '.ssa') return 'ass';
  return 'srt';  // fallback
  ```
- YouTube `timedtext` URLs have NO file extension: `https://www.youtube.com/api/timedtext?v=...&fmt=vtt`
- `path.lastIndexOf('.')` found the dot in `youtube.com` (or none in the query-stripped path `/api/timedtext`) → `ext` was not `.vtt` → returned `'srt'`.
- `parseSubtitle(content, 'srt')` → `parseSrt(content)` on WebVTT content → SRT parser doesn't recognize `WEBVTT` header / `-->` timing with `align:start position:0%` metadata → 0 cues.
- `buildVttUrl` correctly appended `&fmt=vtt` (M2 fix), but `formatFromUrl` ignored the `fmt` query param it had just added.

## Fix

**formatFromUrl — detect `fmt` query param** (`subtitleAutoLoad.ts`):
```ts
export function formatFromUrl(url: string): SubtitleFormat {
  const path = url.split('?')[0]?.split('#')[0] ?? url;
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  if (ext === '.vtt') return 'vtt';
  if (ext === '.ass' || ext === '.ssa') return 'ass';
  // YouTube timedtext URLs have no file extension — detect via `fmt` query
  // param (fmt=vtt → WebVTT, fmt=srv3/srv → XML, fmt=json3 → JSON3).
  try {
    const fmt = new URL(url).searchParams.get('fmt');
    if (fmt === 'vtt') return 'vtt';
  } catch {
    // Not a valid URL — fall through to srt default.
  }
  return 'srt';
}
```

Extension check stays first (fast path for `.vtt`/`.ass` files). Query param check is fallback for extension-less URLs (YouTube, other APIs that encode format in query params).

## Key insight

Format detection by file extension alone fails for URLs that have no file extension — common with API endpoints that encode format in query params (`?fmt=vtt`, `?format=srt`, `?output=ass`). The extension check is the fast path (no URL parsing), but a query-param fallback is required for extension-less URLs. Order: extension (fast, unambiguous) → query param (fallback for APIs) → default. This is the same "try multiple conventions" pattern as multi-separator language extraction, applied to format detection instead of language extraction.

## Verification

Browser verify on `https://www.youtube.com/watch?v=YQHsXMglC9A`:

Before fix:
- `formatFromUrl('https://www.youtube.com/api/timedtext?v=...&fmt=vtt')` → `'srt'` (no extension)
- `parseSubtitle(vttContent, 'srt')` → `parseSrt(vttContent)` → 0 cues → `"No cues found in SRT content"`

After fix:
- `formatFromUrl('https://www.youtube.com/api/timedtext?v=...&fmt=vtt')` → `'vtt'` (fmt query param) ✓
- `parseSubtitle(vttContent, 'vtt')` → `parseVtt(vttContent)` → 139 cues ✓
- Console: `[handleAutoLoadSubtitles] parse results {targetSuccess:true, targetCueCount:139}` ✓

Tests: 42 YouTube tests pass. tsc PASS, build PASS.
