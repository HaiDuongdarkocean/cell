# SRT Subtitle Samples

Real-world SRT (SubRip) format samples for local video player testing.

## Format

- Numbered cues, `HH:MM:SS,mmm --> HH:MM:SS,mmm` timestamps (comma for milliseconds)
- Blank line separates cues
- UTF-8 encoded

## Samples

| # | File | Edge Case Covered |
|---|------|-------------------|
| 01 | `sample-01-basic.srt` | Basic single-line cues |
| 02 | `sample-02-multiline.srt` | Multi-line cues (2-3 lines per cue) |
| 03 | `sample-03-special-chars.srt` | UTF-8 special chars: é, ñ, 中文, 日本語, 한국어, emoji |
| 04 | `sample-04-html-tags.srt` | HTML-like tags: `<b>`, `<i>`, `<u>`, `<font color>`, nested |
| 05 | `sample-05-long-text.srt` | Cues with text >200 chars |
| 06 | `sample-06-short-duration.srt` | Very short duration cues (<500ms, down to 50ms) |
| 07 | `sample-07-overlapping.srt` | Overlapping cue timings |
| 08 | `sample-08-negative-offset.srt` | Cues starting at 00:00:00,000 |
| 09 | `sample-09-bilingual-interleaved.srt` | Bilingual: target + native interleaved (separate cues) |
| 10 | `sample-10-bilingual-same-cue.srt` | Bilingual: target + native on separate lines in same cue |
| 11 | `sample-11-100-plus-cues.srt` | Large file with 120 cues |
| 12 | `sample-12-single-cue.srt` | File with only 1 cue |
| 13 | `sample-13-sound-effects.srt` | Sound effects: [MUSIC], (applause), [THUNDER] |
| 14 | `sample-14-ass-override-tags.srt` | ASS-style override tags {\an1}–{\an9} for positioning |

## Format Quirks

- SRT uses **comma** (`,`) for millisecond separator, unlike VTT which uses dot (`.`)
- HTML tags (`<b>`, `<i>`, `<u>`, `<font>`) are not in the official spec but are widely supported
- ASS override tags (`{\an8}`) in SRT are a non-standard but common convention for positioning
- Cue numbering is sequential but parsers should not rely on it (gaps/duplicates occur in real files)
- No BOM required, but some files in the wild have UTF-8 BOM
- Blank line at end of file is common but not strictly required
