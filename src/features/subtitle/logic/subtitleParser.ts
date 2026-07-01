// Subtitle parser adapter — reuses existing parseSrt/parseVtt from lib/parsers.
// ponytail: no need to rewrite parsers, just thin adapter to ParseResult shape.

import { parseSrt } from '@/shared/lib/parsers/srtParser';
import { parseVtt } from '@/shared/lib/parsers/vttParser';
import type { SrtCue } from '@/entities/media';
import type { ParseResult, SubtitleFormat } from '@/entities/subtitle';

/**
 * Parse subtitle content into SrtCue[] wrapped in ParseResult.
 * Reuses existing parseSrt/parseVtt — only adapts the result shape.
 *
 * Auto-detects format when `format` is 'unknown':
 * - Starts with "WEBVTT" → vtt
 * - Otherwise → srt
 */
export function parseSubtitle(
  content: string,
  format: SubtitleFormat,
): ParseResult {
  const detected = format === 'unknown' ? detectFormat(content) : format;

  try {
    if (detected === 'vtt') {
      const vtt = parseVtt(content);
      const cues: SrtCue[] = vtt.cues.map((c, i) => ({
        index: i + 1,
        start: c.start,
        end: c.end,
        text: c.text,
      }));
      if (cues.length === 0) {
        return { success: false, cues: [], format: 'vtt', error: 'No cues found in VTT content' };
      }
      return { success: true, cues, format: 'vtt' };
    }

    // srt (also fallback for ass/ssa until converter is added in Task 13)
    const srt = parseSrt(content);
    if (srt.cues.length === 0) {
      return { success: false, cues: [], format: 'srt', error: 'No cues found in SRT content' };
    }
    return { success: true, cues: srt.cues, format: 'srt' };
  } catch (err) {
    return {
      success: false,
      cues: [],
      format: detected,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function detectFormat(content: string): SubtitleFormat {
  const stripped = content.replace(/^\uFEFF/, '').trimStart();
  if (stripped.startsWith('WEBVTT')) return 'vtt';
  return 'srt';
}
