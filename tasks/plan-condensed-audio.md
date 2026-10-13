# Plan — condensed-audio

> Spec: `docs/specs/condensed-audio.md` · Design: `docs/intent/condensed-audio-design-brief.md` + `-component-mapping.md` · Mode: all · Engine: in-session sequential (lanes would collide on shared schema/i18n/wiring files — justified)

## Architecture decisions

- **IDB**: new standalone DB `Tihoka-condensed-audio` v1, store `items` — decoupled from `orca-local-player` schema, no migration risk.
- **Leg A decode path**: offscreen `ffmpegRunner` gains `condenseAudio` op. `public/ffmpeg/ffmpeg.js` (UMD `FFmpegWASM`) loaded via `<script src>` in `ffmpeg.html`; `new FFmpegWASM.FFmpeg()` + `load({coreURL, wasmURL})` pointing at `/ffmpeg/ffmpeg-core.{js,wasm}`; input mounted via WORKERFS (lazy reads, no MEMFS blowup); filtergraph `[0:a]atrim=…asetpts…[ai];…concat=n=N:v=0:a=1[out]` → `-map [out] -codec:a libmp3lame -q:a 4 out.mp3`; output MEMFS → read → OPFS `condensed/{id}.mp3`.
- **File access**: offscreen opens `orca-local-player` IDB directly (same chrome-extension origin) → `VideoRecord.fileHandle`; OPFS downloads read via existing `ensureDownloadSubdir`. Handle permission loss → job failed `needs-access` reason (user re-opens local player to re-grant).
- **Leg B**: content-script recorder session — `video.captureStream()` → `MediaRecorder({mimeType:'audio/webm;codecs=opus', audioBitsPerSecond:96000})` timeslice 5000 → chunks base64 → `CONDENSE_CHUNK` → background → offscreen appends OPFS `condensed/{id}.part.webm` (chunks concatenate into valid webm) → on finalize offscreen transcodes to mp3 same exec path. Gap-skip driver: seek over gaps between padded cue ranges (session-scoped, không đụng `advanced.skipNoDialogue`). DRM detect: no audio tracks / all muted → fail reason `capture-blocked`.
- **Drive**: add public `uploadUserFile(name, bytes, mimeType, folderName)` to `GoogleDriveStorageProvider` reusing `ensureFolderPath` + resumable session internals; folder `Tihoka/Condensed Audio`.
- **Job**: `JobKind` += `condense-audio`; JobRegistry cap 1; params `{recordId}`; leg B volatile — on SW restart reconcile → mark job + record failed `interrupted`.
- **Messages**: `CONDENSE_*` runtime messages typed in `entities/condensedAudio/messages.ts`; background handlers in `entrypoints/background/handlers/condensedAudio.ts`.

## Task breakdown

| # | Task | AC traced | Files |
|---|---|---|---|
| T1 | Entities: `CondensedAudioRecord` types + IDB repo + JobKind + settings fields + i18n keys | SC-5,6 data | entities/condensedAudio/*, entities/job/types, entities/settings/types, i18n en/vi |
| T2 | Offscreen leg A: ffmpeg.js script tag, `condenseAudio` op, WORKERFS, filtergraph, OPFS write, progress | SC-1,3,9 | ffmpeg.html, ffmpegRunner.ts, features/condensedAudio/lib/cueRanges.ts |
| T3 | Background orchestration: CONDENSE_* handlers, job runner, source resolver, export-dir write, Drive upload, delete/retry/cancel | SC-1,4,5,7,8 | background/handlers/condensedAudio.ts, features/condensedAudio/services/*, googleDriveStorageProvider.uploadUserFile |
| T4 | Content leg B: recorderSession (captureStream+MediaRecorder+gap-skip+chunk stream), record pill overlay, DRM detect | SC-2,4 | features/condensedAudio/contentScript/*, subtitle controller wiring |
| T5 | UI: PlaylistTab + rows + nav entry + SubtitleManager trigger + Settings→Media export row + empty/error states | SC-5,6 | universalPanel tabs/types/nav, SubtitleManagerPanel, SettingsDialogContent, PlaylistTab.tsx |
| T6 | Tests: cueRanges, store, resolver, job dedupe, recorder session logic, PlaylistTab render | SC-1..9 unit coverage | *.test.ts(x) alongside |
| T7 | Gates + browser verify + mockup delete + docs + commit | SC-10 | repo |

## Blocked strategy / parallel

Sequential in-session; T1→T2/T3→T4/T5→T6→T7. Blocked → mark awaiting + note, move to next backlog item.

## Accepted risks (from spec OQ)

- ffmpeg wasm MEMFS/worker mount for >1GB inputs may OOM → fail with clear reason.
- Leg B background-tab throttle — warn user to keep tab alive.
- Vendored core assumed libmp3lame — verified by strings scan (libmp3lame×6, libopus×6); runtime spike in T2 confirms; fallback m4a/opus documented.
- `chrome.tabCapture` deferred (manifest change = ask-first; mode all can't ask).
