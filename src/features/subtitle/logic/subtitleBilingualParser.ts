// Bilingual SRT parser — reuses parseSrt, splits text block into target/native.
// ponytail: reuse parseSrt from srtParser (rung 2), only add text-split logic.
// ADR-005 D2: target = dòng lẻ (first), native = dòng chẵn (last).
// Fallback: 1 line → target only (nativeText = ''); > 2 lines → last = native, rest = target.

import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { BilingualCue } from '@/entities/media';
import type { BilingualParseResult } from '@/entities/subtitle';

/**
 * Parse bilingual SRT content into BilingualCue[].
 * Reuses parseSrt for timing/index parsing, then splits each cue's text
 * into targetText (prominent) and nativeText (muted).
 *
 * Split rules (ADR-005 D2):
 * - 1 line  → targetText = line, nativeText = ''
 * - 2 lines → targetText = line 1, nativeText = line 2
 * - > 2 lines → targetText = lines[0..n-1] joined, nativeText = last line
 */
export function parseBilingualSrt(content: string): BilingualParseResult {
  try {
    const srt = parseSrt(content);
    if (srt.cues.length === 0) {
      return { success: false, cues: [], error: 'No cues found in SRT content' };
    }

    const cues: BilingualCue[] = srt.cues.map((cue) => {
      const lines = cue.text.split('\n');
      let targetText: string;
      let nativeText: string;

      if (lines.length <= 1) {
        // Single line → target only
        targetText = lines[0] ?? '';
        nativeText = '';
      } else if (lines.length === 2) {
        // 2 lines → target + native
        targetText = lines[0];
        nativeText = lines[1];
      } else {
        // > 2 lines → last = native, rest = target
        targetText = lines.slice(0, -1).join('\n');
        nativeText = lines[lines.length - 1];
      }

      return {
        index: cue.index,
        start: cue.start,
        end: cue.end,
        targetText,
        nativeText,
      };
    });

    return { success: true, cues };
  } catch (err) {
    return {
      success: false,
      cues: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
