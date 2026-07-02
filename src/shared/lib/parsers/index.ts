/**
 * Subtitle + m3u8 parsers and SRT converters (shared infrastructure).
 *
 * Barrel export for cross-feature reuse. Pure functions, no side effects.
 * Return types are inferred — callers use type inference or import types
 * from entities/.
 */
export { parseAss } from './assParser';
export { parseM3u8 } from './m3u8Parser';
export { parseSrt } from './srtParser';
export { parseVtt } from './vttParser';
export { convertAssToSrt } from './assToSrt';
export { convertVttToSrt, stripVttInlineTags } from './vttToSrt';
export { normalizeSrt, stripSubtitleTags } from './srtNormalizer';
