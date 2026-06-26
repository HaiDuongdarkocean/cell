# Parallel fMP4 Merge (ftyp+moov stripping + tfdt offset)

> **Principle**: [Same codec config → share init segment, patch timeline offsets](learned-bugfixes.md#same-codec-config--share-init-segment-patch-timeline-offsets)

## Problem
When parallel transmuxing splits a TS file into N groups, each group creates its own `Transmuxer` instance. This causes two bugs:

1. **Multiple ftyp+moov**: Each instance emits `initSegment` (ftyp+moov) + `data` (moof+mdat). Naive concatenation produces an invalid fMP4 with N ftyp+moov pairs — players only read the first one, so the video appears incomplete (only part 0 plays).

2. **tfdt overlap**: mux.js rebases PTS to 0 for each Transmuxer instance. So parts 1+ have tfdt values starting from ~0 instead of their absolute position in the timeline. When merged, fragments from different parts overlap → player only plays part 0 → duration shows as ~1/N of actual.

## Fix
`mergePartFiles()` in `parallelTransmuxer.ts` applies three fixes:

1. **ftyp+moov stripping**: `findFirstMoofOffset()` parses the MP4 box structure of parts 1+ and skips their ftyp+moov boxes. Only part 0 keeps its ftyp+moov.

2. **tfdt offset**: After transmuxing all groups, the function:
   - Reads timescales from part 0's moov (moov → trak → mdia → mdhd)
   - Extracts per-track tfdt + trun total duration from each part's moof boxes
   - Computes cumulative offsets per track (sum of previous parts' durations)
   - Patches tfdt values in parts 1+ by adding the cumulative offset (in-place via `offsetTfdtInPlace()`)

3. **mvhd duration update**: The moov's mvhd duration is updated from part 0's duration to the total duration across all parts (via `updateMvhdDuration()`).

## Verification
Tested with real m3u8 (295 segments, 120s duration):
- Sequential: 120.48s ✓
- OLD parallel (naive merge): 43.28s ❌ (only part 0 played)
- NEW parallel (tfdt fix): 120.48s ✓ (matches sequential)

## Why this works
- All groups come from the same TS stream → same codec configuration → moov from part 0 is compatible with moof from all parts.
- HLS TS segments start with PAT/PMT (required for random access), so each group's Transmuxer can independently initialize and produce correct fMP4 fragments.
- The tfdt offset is computed from the trun sample durations (which mux.js sets correctly from PES headers), so the cumulative offset is accurate.
