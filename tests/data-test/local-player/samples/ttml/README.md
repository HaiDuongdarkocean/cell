# TTML Subtitle Samples

Real-world TTML (Timed Text Markup Language) format samples for local video player testing.

## Format

- XML-based: `<tt>`, `<head>`, `<body>`, `<div>`, `<p>`
- Timing attributes: `begin="..."` and `end="..."` on `<p>` elements
- Multiple time formats: seconds (`1s`), frames (`25f`), ticks (`1000t`), timecode (`00:00:01.000`)
- Styling via `<style>` elements and `tts:` namespace attributes
- Layout via `<region>` elements
- UTF-8 encoded, XML well-formed

## Samples

| # | File | Edge Case Covered |
|---|------|-------------------|
| 01 | `sample-01-basic.ttml` | Basic TTML with second-based timing |
| 02 | `sample-02-styling.ttml` | Styling: style elements, regions, tts: attributes |
| 03 | `sample-03-multiline.ttml` | Multi-line via `<br/>` element |
| 04 | `sample-04-special-chars.ttml` | CJK, accents, XML entities |
| 05 | `sample-05-frame-based.ttml` | Frame-based timing (`25f`) with `ttp:frameRate` |
| 06 | `sample-06-tick-based.ttml` | Tick-based timing (`1000t`) with `ttp:tickRate` |
| 07 | `sample-07-nested-spans.ttml` | Nested `<span>` elements with style references |
| 08 | `sample-08-multiple-regions.ttml` | Multiple regions (bottom, top, left, right) |
| 09 | `sample-09-language-attrs.ttml` | Language attributes (`xml:lang`) per `<p>` and `<div>` |
| 10 | `sample-10-forced-content.ttml` | Forced content with `ttm:role="forced"` metadata |
| 11 | `sample-11-dfxp.dfxp` | DFXP variant (older namespace, `.dfxp` extension) |

## Format Quirks

- TTML supports **multiple time expressions**: seconds (`1s`), frames (`25f`), ticks (`1000t`), and timecode (`HH:MM:SS.mmm`)
- Frame-based timing requires `ttp:frameRate` parameter (e.g., `25` for PAL, `30000/1001` for NTSC)
- Tick-based timing requires `ttp:tickRate` parameter (commonly `1000` = milliseconds)
- Colors use CSS-style hex (`tts:color="red"` or `tts:color="#FF0000"`), NOT BGR like ASS
- `<br/>` creates line breaks within `<p>` elements
- `xml:lang` can be set at any level (tt, body, div, p, span)
- `tts:displayAlign="after"` = bottom-aligned, `"before"` = top-aligned
- DFXP is an older name for TTML — same structure, different profile URI
- Netflix uses `.dfxp` or `.ttml` extensions with IMSC1 profile
- `ttp:profile` attribute identifies the conformance profile
- Forced content (always-visible subtitles for on-screen text) uses `ttm:role` metadata
