import { useEffect, useState } from 'react';
import type { DetectedSubtitle } from '@/types/media';
import { detectLanguage, isoCodeToLabel } from '@/lib/detectors/languageDetector';

/**
 * Map of subtitleId → detected language label (e.g. "English").
 * Subtitles not in the map have not been detected yet (or detection returned null).
 */
export type LanguageMap = Map<string, string>;

/**
 * Hook that resolves subtitle language labels.
 *
 * Resolution order:
 * 1. **URL code wins** — if `subtitle.language` is a valid ISO 639-1/639-2 code,
 *    map it to a display label immediately (no network fetch).
 * 2. **Content fallback** — if `subtitle.language === 'unknown'` or the code is
 *    not in the ISO map, fetch the subtitle content and run frequency-based
 *    detection via `detectLanguage`.
 *
 * @param subtitles - Array of detected subtitles from the current tab
 * @returns Map of subtitleId → detected language label
 */
export function useSubtitleLanguage(subtitles: DetectedSubtitle[]): LanguageMap {
  const [languageMap, setLanguageMap] = useState<LanguageMap>(new Map());

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
            if (!res.ok) return { id: sub.id, lang: null };
            const content = await res.text();
            const detected = detectLanguage(content, sub.format);
            return { id: sub.id, lang: detected };
          } catch {
            return { id: sub.id, lang: null };
          }
        }),
      );

      if (cancelled) return;

      setLanguageMap((prev) => {
        const next = new Map(prev);
        for (const { id, lang } of results) {
          if (lang !== null) {
            next.set(id, lang);
          }
        }
        return next;
      });
    };

    void detectAll();

    return () => {
      cancelled = true;
    };
  }, [subtitles]);

  return languageMap;
}
