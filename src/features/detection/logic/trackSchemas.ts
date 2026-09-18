/**
 * Per-source DETECTED_SUBTITLES track schemas — boundary validation for the
 * `tracks` field (ADR-028 dispatch needs `source` to pick a schema).
 *
 * Zod default-strip: producers emit raw API objects carrying extra keys
 * (YouTube InnerTube captionTracks, iQIYI stl[]); schemas validate declared
 * fields and strip the rest. Array validation is all-or-nothing — one
 * malformed element rejects the whole payload.
 */
import { z } from 'zod';

export const youTubeCaptionTrackSchema = z.object({
  baseUrl: z.string(),
  languageCode: z.string(),
  kind: z.string().optional(),
  name: z.object({ simpleText: z.string().optional() }).optional(),
  vssId: z.string().optional(),
  isTranslatable: z.boolean().optional(),
});

export const iqiyiSubtitleTrackSchema = z.object({
  _name: z.string(),
  lid: z.number(),
  ss: z.number(),
  srt: z.string(),
  webvtt: z.string().optional(),
  xml: z.string().optional(),
  _limited: z.number().optional(),
  uuid: z.string().optional(),
});

export const netflixSubtitleTrackSchema = z.object({
  trackId: z.string(),
  bcp47: z.string(),
  displayName: z.string(),
  rawTrackType: z.string(),
  isNoneTrack: z.boolean(),
  isForcedNarrative: z.boolean(),
  isImageBased: z.boolean(),
  url: z.string(),
});

export const youTubeCaptionTrackArraySchema = z.array(youTubeCaptionTrackSchema);
export const iqiyiSubtitleTrackArraySchema = z.array(iqiyiSubtitleTrackSchema);
export const netflixSubtitleTrackArraySchema = z.array(netflixSubtitleTrackSchema);
