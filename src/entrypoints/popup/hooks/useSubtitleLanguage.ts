import { useMemo } from 'react';
import type { DetectedSubtitle } from '@/entities/media';
import { isoCodeToLabel } from '@/features/detection';

/**
 * Map of subtitleId → detected language label (e.g. "English").
 * Subtitles not in the map have not been resolved yet (language === 'unknown').
 *
 * Resolution is owned by the **background** (`resolveUnknownSubtitleLanguages`
 * in helpers.ts, triggered from `onMediaDetected` in wireEvents.ts). It fetches
 * subtitle content via the offscreen document with a `declarativeNetRequest`
 * Referer rule (required for hotlink-protected CDNs like lostproject.club) and
 * runs frequency-based `detectLanguage`. The resolved ISO 639-1 code is written
 * back to the subtitle via `networkInterceptor.updateSubtitle`, which fires
 * `notifyListeners` → `DETECTED_MEDIA_UPDATE` broadcast → popup store updates
 * → this hook re-runs with the resolved language.
 *
 * Previously this hook duplicated the fetch + detect logic in the popup
 * context, which (a) fetched without the DNR Referer rule → 403 on
 * hotlink-protected CDNs, and (b) ran in parallel with the background path
 * causing duplicate fetches. Now the popup only maps the already-resolved
 * `subtitle.language` code to a display label — single source of truth.
 *
 * @param subtitles - Array of detected subtitles from the current tab
 * @returns Map of subtitleId → detected language label
 */
export function useSubtitleLanguage(subtitles: DetectedSubtitle[]): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const sub of subtitles) {
      if (sub.language === 'unknown') continue;
      const label = isoCodeToLabel(sub.language);
      if (label !== null) {
        map.set(sub.id, label);
      }
    }
    return map;
  }, [subtitles]);
}
