# Subtitle Language Detection (hybrid script + frequency)

> **Principle**: [Hybrid detection: fast single-candidate first, disambiguation second](principles.md#hybrid-detection-fast-single-candidate-first-disambiguation-second)

## Architecture
- `subtitleDetector.extractLanguage()` parses BCP 47 tags from URL (e.g. `en-US` → `en`, `zh-Hans` → `zh`), extracts primary subtag only.
- `languageDetector.detectLanguage()` uses a **hybrid two-stage** approach:
  1. **Script detection** (`scriptDetector.ts`): identifies dominant Unicode script (26 scripts from Unicode Scripts.txt). Single-candidate scripts (Hangul→Korean, Hiragana→Japanese, Thai, Greek, etc.) resolve immediately.
  2. **Frequency disambiguation**: for multi-candidate scripts (Latin, Cyrillic, Arabic, Devanagari, Han), runs frequency profiles filtered by script. 38 profiles total.
  3. **Fallback**: if no frequency profile meets threshold, returns first candidate for the detected script.
- `isoCodeToLabel()` maps ISO 639-1 (183 codes) + ISO 639-2 (182 codes) → 183 unique language labels.

## Known limitations
- All frequency profiles use **top-10 words with 3+ characters**, ranked by corpus frequency. Short words (1-2 chars) are excluded to avoid cross-language false positives (e.g. "a" in English/Spanish/French, "я"/"с" in Russian/Ukrainian). CJK scripts (Han, Hangul, Hiragana) are exempt because CJK characters count as 1 char each and common words are often 2 chars — these scripts resolve via single-candidate script detection anyway.
- Bulgarian/Serbian/Macedonian share many common Slavic words; frequency alone cannot reliably distinguish them. Serbian is checked first (uses ј U+0458).
- Languages without frequency profiles (Marathi, Nepali, Malay, African languages, etc.) fall back to the first candidate of their script (e.g. Marathi → Hindi via Devanagari, Malay → English via Latin).
- `substringMatch: true` is only for scripts without word boundaries (Han, Hiragana, Katakana). Using it for Cyrillic/Arabic causes false positives (e.g. "а" matching inside "за").
