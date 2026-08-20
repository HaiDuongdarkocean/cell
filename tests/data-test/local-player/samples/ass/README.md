# ASS/SSA Subtitle Samples

Real-world ASS (Advanced SubStation Alpha) format samples for local video player testing.

## Format

- Three sections: `[Script Info]`, `[V4+ Styles]`, `[Events]`
- Style definitions: comma-separated fields matching `Format:` line
- Dialogue lines: `Dialogue: Layer,Start,End,Style,Actor,MarginL,MarginR,MarginV,Effect,Text`
- Timestamps: `H:MM:SS.cc` (centiseconds, dot separator)
- Override tags in text: `{\tag}` syntax
- UTF-8 encoded

## Samples

| # | File | Edge Case Covered |
|---|------|-------------------|
| 01 | `sample-01-basic.ass` | Basic ASS with single Default style |
| 02 | `sample-02-multiple-styles.ass` | Multiple styles: Default, Title, Sign |
| 03 | `sample-03-positioning.ass` | Positioning with `\pos(x,y)` tag |
| 04 | `sample-04-color-overrides.ass` | Color overrides: `\c`, `\1c`, `\3c` (BGR format) |
| 05 | `sample-05-font-size.ass` | Font size overrides: `\fs16` to `\fs96` |
| 06 | `sample-06-bold-italic.ass` | Bold/italic: `\b1`, `\i1`, `\b0`, `\i0`, weight values |
| 07 | `sample-07-karaoke.ass` | Karaoke effects: `\k`, `\kf`, `\ko` |
| 08 | `sample-08-movement.ass` | Movement: `\move(x1,y1,x2,y2)` with optional timing |
| 09 | `sample-09-fade.ass` | Fade effects: `\fad(in,out)`, `\fade()` complex |
| 10 | `sample-10-special-chars.ass` | CJK characters, accents, `\N` hard newline |
| 11 | `sample-11-comment-lines.ass` | Comment lines: `Comment:` prefix (not displayed) |

## Format Quirks

- Colors are in **BGR** (Blue-Green-Red) format with alpha: `&H00BBGGRR`
  - `&H00FFFFFF` = white, `&H000000FF` = red, `&H0000FF00` = green, `&H00FF0000` = blue
- Timestamps use **centiseconds** (`0:00:01.00`), not milliseconds
- `\N` = hard newline (line break), `\n` = soft newline (only if wrapping allows)
- Bold uses `-1` for on, `0` for off in Style definitions, but `\b1`/`\b0` in override tags
- `\b700` specifies a specific bold weight (700 = bold)
- `Layer` field allows overlapping subtitles on different layers (higher = drawn on top)
- `Alignment` field uses numpad layout: 1=bottom-left, 2=bottom-center, ..., 8=top-center
- `PlayResX`/`PlayResY` define the coordinate space for `\pos()` values
- `ScaledBorderAndShadow: yes` scales outline/shadow with PlayRes
