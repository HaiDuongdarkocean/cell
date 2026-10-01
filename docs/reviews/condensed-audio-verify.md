# Verify — condensed-audio

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/condensed-audio.md` · Intent: `docs/intent/condensed-audio.md` · Design: `docs/intent/condensed-audio-design-brief.md` + `docs/intent/condensed-audio-component-mapping.md` (vision-reader PASS, 4 rounds)

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean after all fixes |
| `npm run test:unit` | pass | 653 suites / 7720 tests — incl. `cueRanges` (12) + `condensedAudioRepository` (fake-indexeddb CRUD) + version-pin updates (DB v3, schema v33) |
| `npm run build` | pass | vite build + postbuild CSP patch; ffmpeg assets vendored unchanged |
| `check-feature-cycles` / `check-deep-imports` | pass | 26 features, 58 edges clean; new code routed through new barrels `features/local-player/index.ts`, `features/reader/index.ts` |

## Real-browser verification (Playwright + packed extension)

`e2e/extension-condensed-audio.spec.ts` — record leg, real Chromium + built `dist`, StreamFlix mock with `<track>` cues:

- `manager-condense-audio` trigger enabled once cues auto-load → `CONDENSE_AUDIO_START`
- Recording pill `condensed-audio-pill` mounts in shadow DOM over the video, REC + elapsed + stop button, video actually playing
- Chunks buffered to OPFS part file; stop → `finalizing` → offscreen ffmpeg transcode → `ready`
- Orbital badge → universal panel → **Playlist** tab (new nav entry, `audioWave` icon) lists the record: `0:08 · 119.7 KB · MP3 · Ready` with preview/export/sync/delete actions

Screenshots: `tmp/condensed-audio/{manager-condense-trigger,recording-pill,playlist-tab,playlist-ready}.png`

## Two real bugs caught by e2e (fixed)

1. **`no-source` on every stream record** — `messageBus.on()` wraps handlers with the registry zod schema, which strips the `sender.tab.id` it itself injects into the payload. Fix: `tabId`/`frameId` optional fields declared on `CondenseAudioStartPayloadSchema`; handler reads `input.tabId`. Lesson recorded in `learning-and-apply` (`bus-zod-wrap-strips-injected-tabid`).
2. **`transcode:mount ErrnoError: FS error`** — Emscripten `FS.mount(WORKERFS)` requires the mountpoint to exist; added `ffmpeg.createDir('/work')` before mount in both condense and transcode paths. Lesson recorded (`ffmpeg-workerfs-mountpoint-must-exist`).

## Requirement traceability

- Cue ranges: pad from `condensedAudio.padMs` setting, normalize/sort/merge/clamp (`cueRanges.ts`, unit-tested)
- Leg A: WORKERFS mount of FileSystemFileHandle/OPFS video — no full-file read into SW memory; `atrim`+`concat` filter graph; mp3→m4a→opus encoder fallback
- Leg B: `captureStream`/`mozCaptureStream` audio-only, 5s MediaRecorder chunks → OPFS part file, gap skipping by seek, playbackRate restored on teardown, pill with stop
- Records: `processing → recording → finalizing → ready`, `failed`/`missing` states; job registry progress + reconcile
- Playlist tab: list/preview (blob URL)/export (`chrome.downloads`, `Tihoka/condensed-audio`)/Drive sync (`uploadUserFile` → "Condensed Audio")/retry/delete/cancel; event-driven refresh
- i18n en+vi complete (`condensedAudio.*` + `panel.tab.playlist*`); a11y (`role=status`, aria-labels, 44px stop target)
- Late-chunk guard: chunks ignored once record terminal

## Known residual

- Leg A (file handle) not exercised end-to-end in e2e — `showOpenFilePicker` needs a real gesture; the shared mount/exec path it depends on is proven by leg B, and range/merge logic is unit-tested.
- Drive sync action wired to `uploadUserFile` but not exercised (needs OAuth session).
