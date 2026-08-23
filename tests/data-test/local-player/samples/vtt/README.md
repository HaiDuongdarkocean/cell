# WebVTT Subtitle Samples

Real-world WebVTT (Web Video Text Tracks) format samples for local video player testing.

## Format

- `WEBVTT` header required as first line
- `HH:MM:SS.mmm --> HH:MM:SS.mmm` timestamps (**dot** for milliseconds, not comma)
- Optional cue identifiers on line before timings
- Optional cue settings after timings (line, position, size, align, vertical)
- Blank line separates cues
- UTF-8 encoded

## Samples

| # | File | Edge Case Covered |
|---|------|-------------------|
| 01 | `sample-01-basic.vtt` | Basic VTT with WEBVTT header |
| 02 | `sample-02-cue-identifiers.vtt` | Cue identifiers (strings before timings) |
| 03 | `sample-03-styling.vtt` | STYLE blocks with ::cue, ::cue(b), ::cue(i), ::cue(.class) |
| 04 | `sample-04-note-blocks.vtt` | NOTE blocks (comments, single and multi-line) |
| 05 | `sample-05-writing-modes.vtt` | Vertical writing modes (vertical:rl, vertical:lr) |
| 06 | `sample-06-line-position.vtt` | Line/position settings (line:0, line:50%, position:50%) |
| 07 | `sample-07-size-setting.vtt` | Size setting (size:100%, size:50%, size:30%) |
| 08 | `sample-08-align-settings.vtt` | Align settings (start, center, end, left, right) |
| 09 | `sample-09-special-chars.vtt` | CJK, accents, XML entities, emoji |
| 10 | `sample-10-long-content.vtt` | Large file with 60 cues |
| 11 | `sample-11-chapter-markers.vtt` | Chapter title cues with identifiers |

## Format Quirks

- VTT uses **dot** (`.`) for millisecond separator — key difference from SRT
- `WEBVTT` header is mandatory and must be the first non-BOM content
- Cue identifiers must not contain `-->` and must be on their own line
- Cue settings are space-separated after the timestamp line
- `line:-1` means bottom of video, `line:0` means top
- STYLE and REGION blocks appear before cues
- NOTE blocks can appear anywhere and are ignored by the renderer
- Hours are optional in timestamps (`00:01.000` is valid, `00:00:01.000` also valid)
- XML entities (`&amp;`, `&lt;`) are valid in cue text
