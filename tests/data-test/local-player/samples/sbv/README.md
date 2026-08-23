# SBV Sample Files

> YouTube SubViewer caption format test samples for the local video player.

## Format Overview

SBV (SubViewer) is YouTube's legacy subtitle download format. Each cue is a
start,end timestamp line (`H:MM:SS.mmm,H:MM:SS.mmm`) followed by caption text
on the next line(s), with a blank line separating cues.

**Key format characteristics:**
- Timestamps: `H:MM:SS.mmm,H:MM:SS.mmm` (comma-separated start and end)
- No header — file starts directly with the first timestamp
- No cue indices (unlike SRT)
- Blank line separates each cue
- Text can span multiple lines within a cue
- No native styling — just timings and text (though HTML-like tags may appear)

## Sample Files

| # | File | Edge Case | Cues | Notes |
|---|------|-----------|------|-------|
| 01 | `sample-01-basic.sbv` | Basic single-line cues | 6 | Standard YouTube-style content, one line per cue |
| 02 | `sample-02-multiline.sbv` | Multi-line cues (text wraps) | 6 | Two-line text blocks with leading space on first line |
| 03 | `sample-03-special-chars.sbv` | Special characters (UTF-8) | 10 | Accented chars (é, ñ, ü, ß), CJK (中文, 日本語), apostrophes |
| 04 | `sample-04-html-tags.sbv` | HTML-like tags | 8 | `<b>`, `<i>`, `<u>`, `<font color>` tags within text |
| 05 | `sample-05-empty-cues.sbv` | Empty cues (blank text) | 7 | Timestamps with no text between them — tests parser robustness |
| 06 | `sample-06-short-cues.sbv` | Very short cues (<1s) | 11 | 300-400ms duration cues — tests timing precision |
| 07 | `sample-07-long-cues.sbv` | Very long cues (>10s) | 6 | 15-second duration cues with long text blocks |
| 08 | `sample-08-overlapping.sbv` | Overlapping timestamps | 6 | Cues whose time ranges overlap — tests overlap handling |
| 09 | `sample-09-single-cue.sbv` | Single cue file | 1 | Minimal valid file with only one cue |
| 10 | `sample-10-long-content.sbv` | Long content (50+ cues) | 60 | Full lecture transcript — tests parser at scale |
| 11 | `sample-11-sound-effects.sbv` | Sound effects in brackets | 12 | `[MUSIC]`, `[APPLAUSE]`, `[THUNDER]` style sound descriptions |
| 12 | `sample-12-parentheses.sbv` | Parenthetical descriptions | 12 | `(quietly)`, `(applause)`, `(whispering)` style speaker directions |

## Format Quirks Discovered

1. **No header**: SBV files start directly with the first timestamp — no `WEBVTT`-style header or metadata block.
2. **Leading spaces**: Real YouTube SBV files often have a leading space before speaker names (e.g., ` TIM:`) — parsers should trim whitespace.
3. **Two format variants**: Some SBV files put text inline on the timestamp line (`time1,time2,text`), while YouTube's native format puts text on the next line. Both are valid.
4. **No cue indices**: Unlike SRT, SBV has no sequential cue numbers.
5. **HTML tags are ignored by YouTube**: YouTube's docs state "No style info (markup) is recognized" — but real-world files still contain `<b>`, `<i>` tags that parsers must handle gracefully.
6. **Empty cues**: Some real files have timestamps with no text — a robust parser should skip or render these as blank.
7. **Millisecond precision**: Timestamps always use 3-digit milliseconds (`.000`), even when zero.
8. **Single-digit hours**: Hours are always single-digit (e.g., `0:00:00.000` not `00:00:00.000`).

## Sources

- Real YouTube SBV file from [tomhodgins/sbv](https://github.com/tomhodgins/sbv) test suite
- YouTube Help documentation on supported caption formats
- SBV format documentation at [gidsgoldberg.com](https://gidsgoldberg.com/sbv_docs_converter.html)
- WebTranslateIt SBV format guide
- subtitle-rs/subtitler parser test cases
