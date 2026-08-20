# Filename Samples for Subtitle Matching Algorithm

Test data for the Chrome extension video player's subtitle matching algorithm.
The algorithm strips resolution suffixes from video filenames, then matches
subtitle files by base name + language code.

## Files

### `video-filenames.json` (40 examples)

Real-world video filename patterns with expected base names after resolution
stripping. Covers:

- **Resolution suffixes** (`720p`, `1080p`, `2160p`, `4320p`, `480p`, `576p`,
  `360p`, `240p`, `144p`) with underscore, dot, dash, and space separators
- **Case variants** (`1080P` uppercase P)
- **Non-standard suffixes** (`4K`, `HDR`, `DV`, `REMUX`) that must NOT be
  stripped — the "ponytail ceiling" guard
- **Complex scene naming**: `Title.Year.Resolution.Source.Codec-Group`
- **Anime fansub naming**: `[Group] Title - EP [Resolution].mkv`
- **TV show naming**: `Show.SxxExx.Resolution.Source.Codec-Group`
- **Plex/TRaSH Guides naming**: brackets, edition tags, quality tags
- **CJK titles** (Chinese, Japanese) with resolution
- **WEB-DL source tags**: `AMZN`, `NF` (Netflix), `CR` (Criterion), `DSNP`
  (Disney+), `HMAX` (HBO Max)

### `subtitle-filenames.json` (37 examples)

Subtitle filename patterns covering language code variants:

- **ISO 639-1** (2-letter): `en`, `vi`, `ja`, `ko`, `fr`, `de`
- **ISO 639-2/B** (3-letter): `eng`, `vie`, `jpn`, `kor`, `fra`, `deu`, `spa`
- **BCP 47 with region**: `en-US`, `en-GB`, `pt-BR`, `es-419`, `zh-CN`
- **BCP 47 with script**: `zh-Hans` (Simplified Chinese), `zh-Hant`
  (Traditional Chinese)
- **Full language names**: `English`, `english` (Emby convention)
- **Case variants**: `EN`, `En` (case-insensitive matching)
- **Tags**: `forced`, `sdh`, `hi` (hearing impaired), `default`
- **Version suffixes**: `en-2` (multiple subtitles same language)
- **Fallback**: no language code (bare `.srt`)
- **Resolution in subtitle**: `Movie_1080p.en.srt` (resolution stripped from
  subtitle base too)

### `subtitle-folder-layouts.json` (15 scenarios)

Folder-level matching scenarios testing the full matching pipeline:

1. Target + native + fallback all present
2. Only fallback subtitle
3. No match at all (different base names)
4. Multiple same-language files (alphabetical sort)
5. ISO 639-2 three-letter codes
6. BCP 47 with region and script subtags
7. Case-insensitive matching
8. Multi-resolution (subtitle has different resolution than video)
9. Forced and SDH tags present
10. Year in both video and subtitle names
11. CJK title matching
12. Complex dot-separated scene naming
13. Mismatch base name (no match)
14. Full language name instead of code
15. Target only (no native or fallback)

### `match-edge-cases.json` (20 scenarios)

Edge cases for the matching algorithm:

1. Different resolution in subtitle vs video
2. CJK name exact match
3. Year preserved in base name
4. Video with no resolution suffix
5. Spaces in filenames
6. Dots as separators
7. Multiple `.en.srt` files (sort alphabetically)
8. Subtitle in subfolder (`subs/`)
9. No subtitle at all (graceful null)
10. Completely different base name (no match)
11. `4K` suffix NOT stripped (ponytail ceiling)
12. Bilingual SRT (single file serves as both target and native)
13. Case mismatch between video and subtitle
14. Uppercase `P` in resolution (`1080P`)
15. `HDR` suffix NOT stripped
16. Director's Cut with spaces (year mismatch)
17. Anime bracket naming (group prefix mismatch)
18. Complex WEB-DL with NF source
19. Long dot-separated title
20. CJK title with BCP 47 script subtag

## Naming Pattern Insights

### Resolution Strip Rule

The algorithm strips the pattern `\d+p` (digits followed by `p`, case-insensitive)
when it appears as a suffix token separated by `_`, `.`, `-`, ` `, or brackets
`[]`/`()`. Everything from the resolution token onward is stripped from the
video filename to produce the base name.

**Resolution is the "split point"** in scene naming:
`Title.Year.RESOLUTION.Source.Codec-Group` — the resolution token and
everything after it (source, codec, group) is metadata, not part of the
identifiable base name.

### Ponytail Ceiling — Non-Standard Suffixes

Tags like `4K`, `HDR`, `DV`, `REMUX`, `HDR10+` do NOT match the `\d+p` pattern
and must NOT be stripped. This is a deliberate ceiling: stripping them would
corrupt the base name and break matching with subtitles that include those tags.

### Language Code Hierarchy

Matching priority for language codes:
1. Exact 2-letter match (`en` == `en`)
2. 2-letter to 3-letter equivalence (`en` == `eng`)
3. BCP 47 prefix match (`en` matches `en-US`, `en-GB`)
4. Full name mapping (`English` == `en`, case-insensitive)
5. Fallback (no language code = matches any requested language as last resort)

### Subtitle Tag Handling

Tags (`forced`, `sdh`, `hi`, `default`) are stripped from the language token
for matching but preserved for priority sorting:
- Regular subtitle preferred over `forced`
- `sdh`/`hi` preferred over `forced` for general viewing
- `forced` used for foreign-language dialogue scenes only

### Sources

- [The Nacho Wiki — Naming Conventions](https://rendezvois.github.io/miscellaneous/naming-conventions/encodes/)
- [TRaSH Guides — Radarr Naming](https://trash-guides.info/Radarr/Radarr-recommended-naming-scheme/)
- [Plex — Adding Local Subtitles](https://support.plex.tv/articles/200471133-adding-local-subtitles-to-your-media/)
- [Emby — Subtitles Naming](https://support.emby.media/support/articles/Subtitles.html)
- [Jellyfin — BCP 47 Support PR #14410](https://github.com/jellyfin/jellyfin/pull/14410)
- [Kodi — Naming Video Files/Episodes](https://kodi.wiki/view/Naming_video_files/Episodes)
- [FileBot — {subt} subtitle language tag](https://www.filebot.net/forums/viewtopic.php?t=13519)
- [Sublarr — Subtitle Format & Naming](https://sublarr.de/docs/user-guide/settings/subtitles-format/)
- [anitomy-pure — Anime filename parser](https://lib.rs/crates/anitomy-pure)
- [thewiki.moe — Naming](https://thewiki.moe/advanced/naming/)
