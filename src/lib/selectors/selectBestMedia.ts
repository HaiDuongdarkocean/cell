import type {
  AutoSelectResult,
  DetectedSubtitle,
  DetectedVideo,
  Settings,
  VideoQuality,
} from '@/types/media';

/**
 * Numeric rank for each concrete video quality. Higher number = higher quality.
 * Used to compare variants and pick the highest or nearest quality.
 * `highest`, `auto`, and `lowest` are resolved at runtime, so they are not
 * ranked here (callers handle them explicitly).
 */
export const QUALITY_RANK: Readonly<Record<Exclude<VideoQuality, 'highest' | 'auto' | 'lowest'>, number>> = {
  '1080p': 4,
  '720p': 3,
  '480p': 2,
  '360p': 1,
};

/** Concrete qualities ordered from lowest to highest. */
const ORDERED_QUALITIES = ['360p', '480p', '720p', '1080p'] as const;
type ConcreteQuality = (typeof ORDERED_QUALITIES)[number];

/**
 * Pick the best video + matching subtitles from detected media according to
 * user preferences. Pure function — no side effects, no `chrome.*` calls.
 *
 * Selection steps:
 * 1. **Format filter** — keep videos whose `format` matches
 *    `settings.preferredVideoFormat`. If none match, fall back to all videos
 *    and set `fallbackReason = 'format'`.
 * 2. **Quality pick** — within candidates, choose the variant matching
 *    `settings.defaultQuality`. `highest`/`auto` pick the highest available
 *    variant; otherwise prefer an exact match, then the nearest lower quality,
 *    then the nearest higher quality. If no exact match, set
 *    `fallbackReason = 'quality'` (unless a format fallback already occurred).
 * 3. **Subtitle filter** — keep subtitles whose language is in
 *    `settings.selectedSubtitleLanguages` (or when `'all'` is selected). If
 *    none match, set `fallbackReason = 'subtitle'` (video is still returned).
 *
 * @param videos    Detected videos on the active tab (typically one).
 * @param subtitles Detected subtitles on the active tab.
 * @param settings  User preferences: preferred format, default quality, and
 *                  selected subtitle languages.
 * @returns `null` if no videos detected; otherwise an `AutoSelectResult`.
 */
export function selectBestMedia(
  videos: readonly DetectedVideo[],
  subtitles: readonly DetectedSubtitle[],
  settings: Pick<Settings, 'preferredVideoFormat' | 'defaultQuality' | 'selectedSubtitleLanguages'>,
): AutoSelectResult | null {
  if (videos.length === 0) return null;

  // --- Step 1: format filter (with fallback) ---
  let candidates = videos.filter((v) => v.format === settings.preferredVideoFormat);
  let fallbackReason: AutoSelectResult['fallbackReason'];
  if (candidates.length === 0) {
    candidates = [...videos];
    fallbackReason = 'format';
  }

  // --- Step 2: quality pick ---
  // Each tab typically has one video with multiple variants. Pick the best
  // candidate video + the best variant within it.
  const { video, matchedQuality, qualityFallback } = pickBestCandidate(
    candidates,
    settings.defaultQuality,
  );
  if (qualityFallback && fallbackReason === undefined) {
    fallbackReason = 'quality';
  }

  // --- Step 3: subtitle filter ---
  const wantAllSubs = settings.selectedSubtitleLanguages.includes('all');
  const matchedSubs = wantAllSubs
    ? subtitles
    : subtitles.filter((s) => settings.selectedSubtitleLanguages.includes(s.language));
  // Subtitle fallback only when subtitles exist but none match the selected
  // languages. When there are no subtitles at all, there is nothing to fall
  // back from — leave the reason untouched.
  if (subtitles.length > 0 && matchedSubs.length === 0 && fallbackReason === undefined) {
    fallbackReason = 'subtitle';
  }

  return {
    videoId: video.id,
    subtitleIds: matchedSubs.map((s) => s.id),
    matchedFormat: video.format === 'm3u8' ? 'm3u8' : 'mp4',
    matchedQuality,
    fallbackReason,
  };
}

/**
 * Among candidate videos, pick the one whose best variant is closest to the
 * requested quality. Returns the chosen video, the matched quality, and
 * whether a quality fallback (no exact match) occurred.
 */
function pickBestCandidate(
  candidates: readonly DetectedVideo[],
  defaultQuality: VideoQuality,
): { video: DetectedVideo; matchedQuality: VideoQuality; qualityFallback: boolean } {
  let best: { video: DetectedVideo; matchedQuality: VideoQuality; qualityFallback: boolean } | undefined;

  for (const video of candidates) {
    const pick = pickVariantQuality(video, defaultQuality);
    if (!best || isBetterPick(pick, best)) {
      best = { video, ...pick };
    }
  }

  // candidates is non-empty (caller guarantees videos.length > 0 and fallback
  // to all videos), so best is always defined here.
  return best!;
}

/**
 * Choose the best variant quality within a single video for the requested
 * quality setting.
 */
function pickVariantQuality(
  video: DetectedVideo,
  defaultQuality: VideoQuality,
): { matchedQuality: VideoQuality; qualityFallback: boolean } {
  const variantQualities = video.variants.map((v) => v.quality);
  const concrete = variantQualities.filter(isConcrete) as ConcreteQuality[];

  if (defaultQuality === 'highest' || defaultQuality === 'auto') {
    // Pick the highest concrete variant available; if none, fall back to
    // 'lowest' or the requested label itself.
    if (concrete.length > 0) {
      const top = concrete.reduce((acc, q) =>
        QUALITY_RANK[q] > QUALITY_RANK[acc] ? q : acc,
      );
      return { matchedQuality: top, qualityFallback: false };
    }
    return { matchedQuality: 'lowest', qualityFallback: true };
  }

  if (defaultQuality === 'lowest') {
    if (concrete.length > 0) {
      const bottom = concrete.reduce((acc, q) =>
        QUALITY_RANK[q] < QUALITY_RANK[acc] ? q : acc,
      );
      return { matchedQuality: bottom, qualityFallback: false };
    }
    return { matchedQuality: 'lowest', qualityFallback: true };
  }

  // Specific quality requested — exact match preferred, else nearest.
  const requested = defaultQuality as ConcreteQuality;
  if (concrete.includes(requested)) {
    return { matchedQuality: requested, qualityFallback: false };
  }

  const nearest = findNearestQuality(requested, concrete);
  return { matchedQuality: nearest, qualityFallback: true };
}

function isConcrete(q: VideoQuality): boolean {
  return q === '1080p' || q === '720p' || q === '480p' || q === '360p';
}

/**
 * Find the nearest concrete quality to the requested one, preferring the
 * nearest lower quality then the nearest higher quality.
 */
function findNearestQuality(
  requested: ConcreteQuality,
  available: readonly ConcreteQuality[],
): ConcreteQuality {
  const reqRank = QUALITY_RANK[requested];
  const sorted = [...available].sort((a, b) => QUALITY_RANK[a] - QUALITY_RANK[b]);

  // Prefer nearest lower (largest rank below requested).
  const lower = sorted.filter((q) => QUALITY_RANK[q] < reqRank);
  if (lower.length > 0) {
    return lower[lower.length - 1];
  }

  // Else nearest higher (smallest rank above requested).
  const higher = sorted.filter((q) => QUALITY_RANK[q] > reqRank);
  if (higher.length > 0) {
    return higher[0];
  }

  // No concrete variants at all — return requested as-is (degenerate case).
  return requested;
}

/**
 * Compare two picks to decide which is better. A non-fallback (exact) pick
 * beats a fallback pick; otherwise the higher-ranked quality wins.
 */
function isBetterPick(
  a: { matchedQuality: VideoQuality; qualityFallback: boolean },
  b: { matchedQuality: VideoQuality; qualityFallback: boolean },
): boolean {
  if (a.qualityFallback !== b.qualityFallback) {
    return !a.qualityFallback;
  }
  const rankA = concreteRank(a.matchedQuality);
  const rankB = concreteRank(b.matchedQuality);
  return rankA > rankB;
}

function concreteRank(q: VideoQuality): number {
  return isConcrete(q) ? QUALITY_RANK[q as ConcreteQuality] : 0;
}
