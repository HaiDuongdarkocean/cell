# ADR-002: Use mux.js instead of ffmpeg.wasm for TS→fMP4 conversion

## Context
Need to convert HLS TS segments to fMP4 for download. ffmpeg.wasm is a full-featured video processing library that can run in browser via WebAssembly.

## Decision
Use mux.js 6 for TS→fMP4 conversion. Do not use ffmpeg.wasm.

## Rationale
- **Bundle size**: ffmpeg.wasm ~30MB (even compressed), mux.js ~200KB. mux.js smaller by 150x.
- **Feature scope**: Project only needs TS→fMP4 transmuxing (re-mux, no re-encode). mux.js specializes in this exact use case. ffmpeg.wasm can do re-encoding, filtering, scaling — overkill.
- **Performance**: mux.js is faster for pure transmuxing (no re-encoding). ffmpeg.wasm would re-encode even if not needed.
- **Reliability**: mux.js is actively maintained by Video.js (used by many major players). ffmpeg.wasm build can be flaky.
- **Browser compatibility**: mux.js works in Web Workers for parallel transmuxing. ffmpeg.wasm WebAssembly can also work but more complex setup.

## Consequences
- Positive: 150x smaller bundle, faster downloads for extension users
- Positive: Simpler API for transmuxing (mux.js API designed for this)
- Positive: Works well in Web Workers for parallel conversion
- Negative: Cannot do re-encoding, filtering, scaling if needed later (would require switching to ffmpeg.wasm)
- Negative: Limited to TS/MP4 container conversion (not AVI, MKV, etc.)

## Alternatives Considered
- **ffmpeg.wasm**: Full-featured but too large. Chose mux.js for bundle size.
- **Native ffmpeg via native messaging**: Powerful but requires native host app, breaks cross-platform portability. Chose mux.js for pure JS solution.
- **Server-side conversion**: Offload to server but adds latency and server cost. Chose client-side for instant download.

## Status
Accepted. Implemented in `src/lib/converters/tsTransmuxer.ts` (sequential) and `src/lib/converters/parallelTransmuxer.ts` (parallel).
