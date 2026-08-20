# Intent — Local Video Player

> Confirmed statement of intent cho feature local video player.
> Output của skill `interview-me` (G0 Define phase). Downstream: `spec-driven-development` → `planning-and-task-breakdown` → implement.
> Confirmed: 2026-08-20.

## Outcome

Local Player — player video local trong browser (Chrome extension page), auto-match subtitle, switch/extract audio+subtitle track, condense audio (remove silence) cho passive immersion.

## User

Language learner 10-25 tuổi, máy RAM ≥1GB available, đa số file MP4/MKV.

## Why now

Player mode hiện tại chỉ wrap host site; cần standalone player cho file local + condense audio là feature signature chưa có ở tool nào trong extension.

## Success

Double-click `.mp4` (Chrome default app) → player mở → auto-load subtitle cùng tên → play. Hoặc mở trang player → Open/drag-drop file. Switch track real-time. Extract audio/subtitle ra file. Condense audio → MP3/AAC không silence.

## Constraint

- MV3 extension, RAM nặng chỉ khi legacy codec (ffmpeg.wasm fallback).
- Toggle "Allow access to file URLs" bắt buộc (SSOT cho redirect + đọc folder).
- WebCodecs + web-demuxer cho playback (RAM thấp), ffmpeg.wasm chỉ fallback.

## Out of scope

- OS file association (extension không thể — user set Windows default Chrome).
- Cloud upload/stream.
- Video editing (cut/trim/merge video).
- Real-time transcription (Whisper).
- Burn-in subtitle.
- Thumbnail grid.
- Metadata fetch (TMDB/AniDB).
- Sync subtitle bằng audio alignment.
- Image-based subtitle (SUB/IDX/SUP/PGS) — cần OCR.

## Library (4 tính năng)

- Resume position (lưu giây hiện tại, mở lại tiếp tục)
- History (list video đã mở, click mở lại)
- Bookmark (đánh dấu thời điểm cụ thể)
- Folder watch (scan folder, browse như media library)

## Format support (3 tier)

- Tier 1: MP4/WebM/OGG (native HTML5, 0 dependency)
- Tier 2: MKV/TS (web-demuxer + WebCodecs, ~2-5MB wasm)
- Tier 3: AVI/FLV/WMV/legacy (ffmpeg.wasm fallback, ~31MB, RAM nặng — user accept)

## Subtitle format support

- Core text (0 dep): SRT, VTT
- Advanced text (+1 lib): ASS/SSA (ASS.js pure JS hoặc sweet-subtitle WASM)
- Professional/legacy (+parse): TTML/DFXP, SBV, SMI
- Image-based (SUB/IDX/SUP/PGS): OUT OF SCOPE — cần OCR

## Subtitle match algorithm

- Strip resolution suffix (`_1080p`, `_720p`...) → base name
- Match `.srt`/`.vtt`/`.ass`/`.ssa`/`.ttml`/`.sbv`/`.smi` cùng base name trong cùng folder
- Profile target ưu tiên (`Adele.en.srt` > `Adele.srt`), native ưu tiên (`Adele.vi.srt`)
- Multiple subtitle → list pick, default = profile target
- Edge cases: tự research khi implement (multi-resolution suffix, `.en.srt` vs `.eng.srt`, case sensitivity, v.v.)

## Track extraction

- Audio track: switch real-time + export ra file (MP3 192kbps default / AAC 256kbps option)
- Subtitle track (embedded MKV text): extract ra file, 2 option:
  - Giữ nguyên gốc format (`.ass` → `.ass`, `.srt` → `.srt`)
  - Convert sang `.srt` (strip ASS styling, giữ text + timing)
- Bitmap track (PGS/VOBSUB): disable extract + warn "image-based, not supported"

## Condense audio algorithm (proven từ subs2cia/condenser/shuku)

1. Parse subtitle → `(start, end)` cues
2. Merge cue gap < 1300ms (no stutter)
3. Pad ±500ms (context)
4. Filter: skip `(sound effects)`, skip OP/ED chapters, skip special chars
5. Extract audio segments → concat → output MP3 192kbps default / AAC 256kbps option
6. Re-time subtitle match condensed audio

## Player UI

Reuse `PlayerModeOverlay` (subtitle panel song ngữ, nav cluster 6 nút, AB-loop, hold-to-loop, cue list, sentence/time mode, quick-add/edit/generate card, side panel, manager) + thêm native player controls (play/pause, seek bar, volume, fullscreen, playback speed, keyboard shortcuts).

## Research notes (từ interview)

- ffmpeg.wasm RAM: ~31MB bundle, ~60MB runtime init, ~2GB heap ceiling (wasm32), input file copy toàn vào RAM (MEMFS), rule of thumb input+working < 1GB. Mobile kill tab ở ~500MB.
- web-demuxer (bilibili): mp4/mkv/webm/flv/avi/ts/wmv/m4v, ~2-5MB wasm, WebCodecs-first, hardware decode.
- mkv-subtitle-extractor (@cryguy): extract text track + fonts, HTTP Range ~3% file, support srt/ass/ssa/vtt.
- ASS renderer: sweet-subtitle (Rust WASM, full features) hoặc ASS.js (pure JS, lightweight, browser font fallback).
- Condense audio: subs2cia (Python, merge gap 1300ms, pad 150ms), condenser (Python, pad 500ms, filter parentheses), shuku (Python, fuzzy subtitle search, skip chapters).
