import type { SrtCue } from '@/entities/media';
import {
  parseSrt,
  convertVttToSrt,
  convertAssToSrt,
  convertTtmlToSrt,
  convertSbvToSrt,
  convertSmiToSrt,
} from '@/shared/lib/parsers';
import {
  matchSubtitles,
  type MatchResult,
} from '@/features/local-player/logic/subtitleMatch';

/**
 * Match subtitle files to a video by base name + language code.
 *
 * Thin wrapper over {@link matchSubtitles} (T6) so the local-player UI layer
 * depends on a single hook entry point rather than the pure-logic module.
 *
 * @param videoFilename   Full video filename (e.g. "Movie_720p.mp4")
 * @param subtitleFiles   Array of subtitle filenames (may include paths)
 * @param targetLang      Target language code (ISO 639-1, e.g. "en")
 * @param nativeLang      Native language code (ISO 639-1, e.g. "vi")
 * @returns `{ target?, native?, others }` — `others` preserves original order
 */
export function matchSubtitlesForVideo(
  videoFilename: string,
  subtitleFiles: readonly string[],
  targetLang: string,
  nativeLang: string,
): MatchResult {
  return matchSubtitles(videoFilename, subtitleFiles, targetLang, nativeLang);
}

/**
 * Detect the subtitle format from a filename extension and parse the content
 * into a normalised `SrtCue[]`. Non-SRT formats are converted to SRT first,
 * then parsed, so every format flows through the single SRT parser.
 *
 * Supported extensions: `.srt`, `.vtt`, `.ass`, `.ttml`, `.dfxp`, `.sbv`,
 * `.smi`. Any other extension throws.
 *
 * @param filename  Filename used only for extension detection.
 * @param content   Raw subtitle file content (UTF-8).
 * @returns Parsed `SrtCue[]`.
 */
export function parseSubtitleFile(filename: string, content: string): SrtCue[] {
  const ext = getExtension(filename);
  const srtContent = toSrt(ext, content);
  return parseSrt(srtContent).cues;
}

/** Extract the lowercase extension (without dot) from a filename. */
function getExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === filename.length - 1) {
    return '';
  }
  return filename.slice(dotIdx + 1).toLowerCase();
}

/**
 * Convert any supported subtitle format to an SRT string.
 * SRT passes through unchanged; everything else is converted.
 */
function toSrt(ext: string, content: string): string {
  switch (ext) {
    case 'srt':
      return content;
    case 'vtt':
      return convertVttToSrt(content);
    case 'ass':
    case 'ssa':
      return convertAssToSrt(content);
    case 'ttml':
    case 'dfxp':
      return convertTtmlToSrt(content);
    case 'sbv':
      return convertSbvToSrt(content);
    case 'smi':
    case 'sami':
      return convertSmiToSrt(content);
    default:
      throw new Error(`Unsupported subtitle extension: ".${ext}"`);
  }
}
