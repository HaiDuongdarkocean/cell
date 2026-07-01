import { useEffect, useState } from 'react';
import type { DetectedSubtitle } from '@/types/media';
import { usePopupStore } from '@/entrypoints/popup/store/popupStore';
import {
  detectLanguage,
  isoCodeToLabel,
  labelToIsoCode,
} from '@/features/detection';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';

/**
 * Map of subtitleId → detected language label (e.g. "English").
 * Subtitles not in the map have not been detected yet (or detection returned null).
 */
export type LanguageMap = Map<string, string>;

/**
 * Hook that resolves subtitle language labels AND normalizes the language code
 * stored on each `DetectedSubtitle` so that `selectBestMedia` can match it
 * against `settings.selectedSubtitleLanguages` (which stores ISO 639-1 codes).
 *
 * Resolution order:
 * 1. **URL code wins** — if `subtitle.language` is a valid ISO 639-1/639-2 code,
 *    map it to a display label immediately (no network fetch). The code is
 *    already in ISO form, so no normalization is needed.
 * 2. **Content fallback** — if `subtitle.language === 'unknown'` or the code is
 *    not in the ISO map, fetch the subtitle content and run frequency-based
 *    detection via `detectLanguage`. The returned label is converted back to an
 *    ISO 639-1 code via `labelToIsoCode` and written back to the subtitle in the
 *    popup store so that `selectBestMedia` can match it.
 *
 * @param subtitles - Array of detected subtitles from the current tab
 * @returns Map of subtitleId → detected language label
 */
export function useSubtitleLanguage(subtitles: DetectedSubtitle[]): LanguageMap {
  const [languageMap, setLanguageMap] = useState<LanguageMap>(new Map());
  const setSubtitles = usePopupStore((state) => state.setSubtitles);

  useEffect(() => {
    if (subtitles.length === 0) {
      setLanguageMap(new Map());
      return;
    }

    let cancelled = false;

    // Phase 1: Map ISO codes from URL immediately (no fetch)
    const urlMapped = new Map<string, string>();
    const needFetch: DetectedSubtitle[] = [];

    for (const sub of subtitles) {
      if (sub.language === 'unknown') {
        needFetch.push(sub);
        continue;
      }
      const label = isoCodeToLabel(sub.language);
      if (label !== null) {
        urlMapped.set(sub.id, label);
      } else {
        // Code not in ISO map — fall back to content detection
        needFetch.push(sub);
      }
    }

    // Merge URL-mapped labels first
    if (urlMapped.size > 0) {
      setLanguageMap((prev) => {
        const next = new Map(prev);
        for (const [id, label] of urlMapped) {
          next.set(id, label);
        }
        return next;
      });
    }

    // Phase 2: Fetch content for unknown/unmapped subtitles
    if (needFetch.length === 0) return;

    const detectAll = async (): Promise<void> => {
      const results = await Promise.all(
        needFetch.map(async (sub) => {
          try {
            const res = await fetch(sub.url, {
              headers: { 'Accept': '*/*' },
            });
            if (!res.ok) return { id: sub.id, lang: null, isoCode: null };
            const content = await res.text();
            const detected = detectLanguage(content, sub.format);
            // Convert the detected label back to an ISO 639-1 code so that
            // selectBestMedia can match it against settings.selectedSubtitleLanguages.
            const isoCode = detected !== null ? labelToIsoCode(detected) : null;
            return { id: sub.id, lang: detected, isoCode };
          } catch {
            return { id: sub.id, lang: null, isoCode: null };
          }
        }),
      );

      if (cancelled) return;

      // Update the display label map
      setLanguageMap((prev) => {
        const next = new Map(prev);
        for (const { id, lang } of results) {
          if (lang !== null) {
            next.set(id, lang);
          }
        }
        return next;
      });

      // Write the ISO code back to the subtitle in the store so that
      // selectBestMedia can match it against settings.selectedSubtitleLanguages.
      // Only update subtitles whose language was 'unknown' and is now resolved.
      const updates: DetectedSubtitle[] = [];
      for (const { id, isoCode } of results) {
        if (isoCode === null) continue;
        const sub = subtitles.find((s) => s.id === id);
        if (!sub) continue;
        if (sub.language === isoCode) continue; // no change
        updates.push({ ...sub, language: isoCode });
      }
      if (updates.length > 0) {
        setSubtitles(
          subtitles.map((s) => updates.find((u) => u.id === s.id) ?? s),
        );
        // Push the detected language to the background so that the
        // mediaMap + networkInterceptor have the correct language for
        // download filenames (e.g. "Movie Title.en.srt" not "Movie Title.unknown.srt").
        for (const update of updates) {
          void sendMessage({
            type: MESSAGE_TYPES.UPDATE_SUBTITLE_LANGUAGE,
            payload: { subtitleId: update.id, language: update.language },
          }).catch((err) => {
            console.warn('[useSubtitleLanguage] Failed to update background:', err);
          });
        }
      }
    };

    void detectAll();

    return () => {
      cancelled = true;
    };
  }, [subtitles, setSubtitles]);

  return languageMap;
}
