# ISO Code → Language Label Mapping

## Problem Statement
How might we map ISO 639-1 codes extracted from subtitle URLs (e.g. `en`, `vi`, `ko`) to display labels (e.g. "English", "Vietnamese", "Korean") without fetching subtitle content, using a full ISO 639-1 lookup table?

## Recommended Direction
Add a static `ISO_LANGUAGE_MAP: ReadonlyMap<string, string>` in `languageDetector.ts` covering all ISO 639-1 codes (~184 entries). Export `isoCodeToLabel(code: string): string | null` for lookup.

In `useSubtitleLanguage.ts`, change the logic:
- If `subtitle.language !== 'unknown'` → try `isoCodeToLabel(language)`. If found, use label immediately (no fetch).
- If `subtitle.language === 'unknown'` OR `isoCodeToLabel` returns null → fall back to content detection (existing flow).

This means **URL code wins** — subtitles with valid ISO codes in URL never trigger a network fetch. The 6 existing `LANGUAGE_PROFILES` remain for content-based detection only.

## Key Assumptions to Validate
- [ ] URL-extracted codes are reliable indicators of actual language (test with real subtitle URLs)
- [ ] ISO 639-1 (2-letter) covers all cases we encounter (check if any sites use 3-letter codes)
- [ ] `isoCodeToLabel` returning null for unknown codes falls back gracefully to content detection

## MVP Scope
**In:**
- `ISO_LANGUAGE_MAP` with all ISO 639-1 (2-letter) + ISO 639-2 (3-letter) codes → English labels
- `isoCodeToLabel()` exported function
- Update `useSubtitleLanguage.ts` to use ISO mapping before content fetch
- Update `extractLanguage()` regex to accept 2-3 letter codes (already does: `/^[a-z]{2,3}$/i`)
- Unit tests for `isoCodeToLabel()` (2-letter, 3-letter, unknown, edge cases)
- Unit tests for updated `useSubtitleLanguage` flow

**Out:**
- ISO 639-3 (less common, mostly covered by 639-2)
- Auto-detect language from URL path segments beyond filename (already handled by `extractLanguage`)
- UI changes — already showing `languageLabel ?? subtitle.language`

## Not Doing (and Why)
- **ISO 639-3** — mostly overlaps with 639-2. Add only if real-world data shows unique codes.
- **Merging ISO map into LANGUAGE_PROFILES** — mixing two concerns (frequency detection vs code lookup). Keep separate.
- **Caching ISO lookups** — Map lookup is O(1), no caching needed.
- **Custom label overrides** — out of scope. Use standard ISO names.

## Open Questions
- Should we also handle locale codes like `en-US`, `pt-BR`? (Current `extractLanguage` regex `/^[a-z]{2,3}$/i` rejects these. May need update if real-world data shows locale codes in URLs.)
