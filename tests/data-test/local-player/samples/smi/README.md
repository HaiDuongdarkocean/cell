# SMI / SAMI Sample Files

> Microsoft Synchronized Accessible Media Interchange caption format test samples for the local video player.

## Format Overview

SAMI (Synchronized Accessible Media Interchange) is a Microsoft-developed
subtitle format with HTML-like structure. It supports multi-language subtitles
in a single file via CSS class names, and uses `<SYNC Start=milliseconds>` tags
for timing.

**Key format characteristics:**
- HTML-like structure: `<SAMI>`, `<HEAD>`, `<BODY>` tags
- Timing via `<SYNC Start=milliseconds>` (integer milliseconds, no decimals)
- Text in `<P Class=...>` elements within each SYNC block
- Multi-language support via CSS class names (e.g., `ENUSCC`, `KRCC`, `JPCC`)
- CSS styling in `<HEAD>` via `<STYLE TYPE="text/css">` with HTML comment wrapper
- No end time — duration is implied by the next SYNC block's start time
- File extension: `.smi` or `.sami`
- Class names follow pattern: `[LANG][REGION][TYPE]` (e.g., `ENUSCC` = English US Closed Caption)

## Sample Files

| # | File | Edge Case | SYNC Blocks | Notes |
|---|------|-----------|-------------|-------|
| 01 | `sample-01-basic.smi` | Basic single-language | 6 | English-only with standard HEAD/STYLE/BODY structure |
| 02 | `sample-02-multilang.smi` | Multi-language (EN + KR) | 5 | ENUSCC + KRCC classes, two `<P>` per SYNC |
| 03 | `sample-03-html-formatting.smi` | HTML formatting | 8 | `<B>`, `<I>`, `<U>`, `<FONT COLOR>`, `<BR>` tags |
| 04 | `sample-04-empty-sync.smi` | Empty SYNC blocks | 7 | `&nbsp;` and empty `<P>` content — tests blank cue handling |
| 05 | `sample-05-cjk.smi` | CJK characters (4 languages) | 4 | English, Korean, Japanese, Chinese — 4 `<P>` per SYNC |
| 06 | `sample-06-long-text.smi` | Very long text | 4 | 10-second cues with paragraph-length text blocks |
| 07 | `sample-07-nested-tags.smi` | Nested HTML tags | 6 | `<B><I><U>...</U></I></B>`, `<FONT><B>...</B></FONT>` |
| 08 | `sample-08-css-styling.smi` | CSS styling in HEAD | 5 | Full CSS with `#Source`, `#Standard`, `#LargePrn` ID styles |
| 09 | `sample-09-sync-gaps.smi` | Sync gaps (silent periods) | 8 | Large time gaps between SYNC blocks (12-20s silence) |
| 10 | `sample-10-sound-effects.smi` | Sound effects in brackets | 10 | `[MUSIC]`, `[APPLAUSE]`, `[THUNDER]` style descriptions |
| 11 | `sample-11-minimal.smi` | Minimal SMI (no HEAD) | 3 | Only `<SAMI>`, `<BODY>`, `<SYNC>`, `<P>` — no HEAD/STYLE |
| 12 | `sample-12-multiple-p-classes.smi` | Multiple P classes per SYNC | 3 | 6 `<P>` per SYNC (3 languages × 2: Source ID + caption) |

## Format Quirks Discovered

1. **No end time**: SAMI has no explicit end time — the duration of a cue is implied by the start time of the next SYNC block. The last cue's duration is unknown until playback ends.
2. **Milliseconds only**: `Start` attribute uses integer milliseconds (e.g., `Start=3000`), not timecodes. No quotes needed around the value in practice.
3. **CSS in HTML comments**: The `<STYLE>` block content is wrapped in `<!-- ... -->` HTML comments — a legacy HTML convention that parsers must handle.
4. **Class naming convention**: Class names follow `[LANG][REGION][TYPE]` pattern: `ENUSCC` (English US Closed Caption), `KRCC` (Korean Closed Caption), `JPCC` (Japanese), etc.
5. **`&nbsp;` for empty cues**: Real-world files use `&nbsp;` (non-breaking space) to represent empty/silent cues rather than truly empty `<P>` tags.
6. **`ID=Source` for speaker labels**: The `ID=Source` attribute on `<P>` tags identifies the speaker/source line, styled separately via `#Source` CSS ID selector.
7. **No closing `</SYNC>` required**: Many real-world SAMI files omit `</SYNC>` closing tags — a new `<SYNC>` implicitly closes the previous one. Both with and without closing tags are valid.
8. **HEAD is optional**: Minimal SAMI files can omit the `<HEAD>` section entirely — only `<SAMI>`, `<BODY>`, `<SYNC>`, and `<P>` are strictly required.
9. **File extension collision**: `.smi` is also used by SMIL (Synchronized Multimedia Integration Language) and Macintosh self-mounting images — parsers should check for `<SAMI>` root tag.
10. **Font color formats**: Both named colors (`color=blue`) and hex (`color=#0000ff` or `color="#00FF00"`) are used, with or without quotes. Case-insensitive tag names (`<Font>` vs `<font>`) appear in real files.

## Sources

- Microsoft SAMI Media Source documentation ([learn.microsoft.com](https://learn.microsoft.com/en-us/windows/win32/medfound/sami-media-source))
- W3C SAMI specification ([w3.org/WAI/sami.html](https://www.w3.org/WAI/sami.html))
- Wikipedia SAMI article ([en.wikipedia.org/wiki/SAMI](https://en.wikipedia.org/wiki/SAMI))
- Real .smi test file from GitHub gist (anonymous/2be738766de9513de65c8844fdc5a2e5)
- subtitle-rs/subtitler example SAMI file ([github.com/subtitle-rs/subtitler](https://github.com/subtitle-rs/subtitler))
- VLC Wiki SAMI documentation ([wiki.videolan.org/SAMI](https://wiki.videolan.org/SAMI))
