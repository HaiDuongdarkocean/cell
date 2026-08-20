/**
 * Subtitle matching logic for Local Video Player.
 *
 * Strips resolution suffixes from video/subtitle filenames and matches
 * subtitle files to a video by base name + language code.
 *
 * Resolution is the "split point" in scene naming:
 *   Title.Year.RESOLUTION.Source.Codec-Group
 * Everything from the resolution token onward is metadata, not part of
 * the identifiable base name.
 *
 * Ponytail: tags like 4K, HDR, DV, REMUX do NOT match \d+p and must
 * NOT be stripped.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubtitleMatch {
  filename: string;
  languageCode: string | null;
  tags: string[];
  fileHandle?: FileSystemFileHandle;
}

export interface MatchResult {
  target?: SubtitleMatch;
  native?: SubtitleMatch;
  others: SubtitleMatch[];
}

// ─── Language maps ──────────────────────────────────────────────────────────

export const ISO_639_2_TO_639_1: Readonly<Record<string, string>> = {
  eng: 'en', fra: 'fr', deu: 'de', jpn: 'ja', kor: 'ko', vie: 'vi', zho: 'zh',
  spa: 'es', por: 'pt', rus: 'ru', ita: 'it', nld: 'nl', pol: 'pl', tur: 'tr',
  ara: 'ar', hin: 'hi', tha: 'th', ind: 'id',
};

export const LANGUAGE_FULL_NAME_TO_CODE: Readonly<Record<string, string>> = {
  English: 'en', Vietnamese: 'vi', Japanese: 'ja', Korean: 'ko', Chinese: 'zh',
  French: 'fr', German: 'de', Spanish: 'es', Portuguese: 'pt', Russian: 'ru',
  Italian: 'it', Dutch: 'nl', Polish: 'pl', Turkish: 'tr', Arabic: 'ar',
  Hindi: 'hi', Thai: 'th', Indonesian: 'id',
};

const ISO_639_1_CODES = new Set([
  'en', 'vi', 'ja', 'ko', 'zh', 'fr', 'de', 'es', 'pt', 'ru',
  'it', 'nl', 'pl', 'tr', 'ar', 'hi', 'th', 'id',
]);

const KNOWN_TAGS = new Set(['forced', 'sdh', 'hi', 'default']);

// ─── Resolution stripping ───────────────────────────────────────────────────

const RESOLUTIONS = '(?:4320|2160|1440|1080|720|576|480|360|240|144)';
// Match separator + optional bracket containing resolution anywhere inside,
// OR separator + resolution directly. Bracket alternative first so it wins
// at the same position (e.g. " [Bluray-1080p Proper]" over "-1080p").
const RESOLUTION_RE = new RegExp(
  `[_\\-. ]\\[[^\\]]*${RESOLUTIONS}p?[^\\]]*\\]|[_\\-. ]${RESOLUTIONS}p?`,
  'i',
);

/**
 * Strip resolution suffix + everything after it from a filename.
 * Also strips the file extension.
 *
 *   Movie_720p.mp4                              → "Movie"
 *   The.Shawshank.Redemption.1994.1080p.BluRay  → "The.Shawshank.Redemption.1994"
 *   [Group] Title - 01 [1080p].mkv              → "[Group] Title - 01"
 *   Movie_4K.mp4                                → "Movie_4K"  (4K not stripped)
 */
export function stripResolutionSuffix(filename: string): string {
  const dotIdx = filename.lastIndexOf('.');
  const withoutExt = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const match = withoutExt.match(RESOLUTION_RE);
  if (match && match.index !== undefined) {
    return withoutExt.slice(0, match.index);
  }
  return withoutExt;
}

// ─── Language code extraction ───────────────────────────────────────────────

/**
 * Normalise a raw language string to an ISO 639-1 2-letter code.
 * Handles ISO 639-1, ISO 639-2/B, BCP 47 (region/script subtag), and full names.
 */
function normalizeLanguageCode(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (ISO_639_1_CODES.has(lower)) return lower;
  if (ISO_639_2_TO_639_1[lower]) return ISO_639_2_TO_639_1[lower];
  if (lower.includes('-')) {
    const primary = lower.split('-')[0]!;
    if (ISO_639_1_CODES.has(primary)) return primary;
    if (ISO_639_2_TO_639_1[primary]) return ISO_639_2_TO_639_1[primary];
  }
  if (LANGUAGE_FULL_NAME_TO_CODE[raw]) return LANGUAGE_FULL_NAME_TO_CODE[raw];
  const capitalised = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (LANGUAGE_FULL_NAME_TO_CODE[capitalised]) return LANGUAGE_FULL_NAME_TO_CODE[capitalised];
  return null;
}

/**
 * Extract language code and tags from a subtitle filename.
 *
 *   Movie.en.srt          → { code: 'en', tags: [] }
 *   Movie.eng.srt         → { code: 'en', tags: [] }      (ISO 639-2)
 *   Movie.en-US.srt       → { code: 'en', tags: [] }      (BCP 47)
 *   Movie.English.srt     → { code: 'en', tags: [] }      (full name)
 *   Movie.en.forced.srt   → { code: 'en', tags: ['forced'] }
 *   Movie.eng-SDH.srt     → { code: 'en', tags: ['sdh'] }
 *   Movie.srt             → { code: null, tags: [] }      (fallback)
 *   Movie.forced.srt      → { code: null, tags: ['forced'] }
 */
export function extractLanguageCode(filename: string): { code: string | null; tags: string[] } {
  const basename = filename.split('/').pop() ?? filename;
  const dotIdx = basename.lastIndexOf('.');
  const withoutExt = dotIdx > 0 ? basename.slice(0, dotIdx) : basename;
  const segments = withoutExt.split('.');

  const tags: string[] = [];
  let code: string | null = null;

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]!;
    const lower = segment.toLowerCase();

    // Plain tag segment
    if (KNOWN_TAGS.has(lower)) {
      if (!tags.includes(lower)) tags.push(lower);
      continue;
    }

    // Compound segment (contains '-'): e.g. en-US, eng-SDH, en-2
    if (segment.includes('-')) {
      const parts = segment.split('-');
      let foundCode = false;
      for (let j = parts.length - 1; j >= 0; j--) {
        const partLower = parts[j]!.toLowerCase();
        if (KNOWN_TAGS.has(partLower)) {
          if (!tags.includes(partLower)) tags.push(partLower);
        } else if (!foundCode) {
          const partCode = normalizeLanguageCode(parts[j]!);
          if (partCode && !code) {
            code = partCode;
            foundCode = true;
          }
        }
      }
      continue;
    }

    // Plain language code segment
    const segmentCode = normalizeLanguageCode(segment);
    if (segmentCode) {
      if (!code) code = segmentCode;
      continue;
    }

    // Not language-related — stop scanning
    break;
  }

  return { code, tags: tags.sort() };
}

// ─── Subtitle base name ─────────────────────────────────────────────────────

/**
 * Compute the base name of a subtitle file for matching.
 * Strips: path, extension, language code, tags, resolution suffix.
 *
 *   Movie_1080p.en.srt       → "Movie"   (resolution stripped, lang stripped)
 *   Movie.en.forced.srt      → "Movie"   (tags + lang stripped)
 *   Movie.Title.2023.en.srt  → "Movie.Title.2023"
 *   subs/Movie.en.srt        → "Movie"   (path stripped)
 */
function getSubtitleBaseName(filename: string): string {
  const basename = filename.split('/').pop() ?? filename;
  const dotIdx = basename.lastIndexOf('.');
  const withoutExt = dotIdx > 0 ? basename.slice(0, dotIdx) : basename;
  const segments = withoutExt.split('.');

  // Strip tags + language segments from the right
  let end = segments.length;
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]!;
    const lower = segment.toLowerCase();

    if (KNOWN_TAGS.has(lower)) {
      end = i;
      continue;
    }

    // Compound (en-US, eng-SDH, en-2)
    if (segment.includes('-')) {
      const firstPart = segment.split('-')[0]!;
      if (normalizeLanguageCode(firstPart) || KNOWN_TAGS.has(firstPart.toLowerCase())) {
        end = i;
        continue;
      }
      break;
    }

    // Plain language code
    if (normalizeLanguageCode(segment)) {
      end = i;
      continue;
    }

    break;
  }

  const withoutLangTags = segments.slice(0, end).join('.');

  // Strip resolution suffix
  const match = withoutLangTags.match(RESOLUTION_RE);
  if (match && match.index !== undefined) {
    return withoutLangTags.slice(0, match.index);
  }
  return withoutLangTags;
}

// ─── Sorting ────────────────────────────────────────────────────────────────

/**
 * Tag priority for sort: lower = preferred as target.
 * No tags > SDH > HI > default > forced.
 */
function tagPriority(tags: string[]): number {
  if (tags.length === 0) return 0;
  if (tags.includes('sdh')) return 1;
  if (tags.includes('hi')) return 2;
  if (tags.includes('default')) return 3;
  if (tags.includes('forced')) return 4;
  return 5;
}

/**
 * Sort comparator: tag priority first, then filename with '-' → '~'
 * (so '.' sorts before '-', making "Movie.en.srt" < "Movie.en-2.srt").
 */
function compareSubtitlePriority(a: SubtitleMatch, b: SubtitleMatch): number {
  const pa = tagPriority(a.tags);
  const pb = tagPriority(b.tags);
  if (pa !== pb) return pa - pb;
  return a.filename.replace(/-/g, '~').localeCompare(b.filename.replace(/-/g, '~'));
}

// ─── Main matching function ─────────────────────────────────────────────────

/**
 * Match subtitle files to a video by base name + language code.
 *
 * @param videoFilename   Full video filename (e.g. "Movie_720p.mp4")
 * @param subtitleFiles   Array of subtitle filenames (may include paths)
 * @param targetLang      Target language code (ISO 639-1, e.g. "en")
 * @param nativeLang      Native language code (ISO 639-1, e.g. "vi")
 * @returns `{ target?, native?, others }` where others preserves original order
 */
export function matchSubtitles(
  videoFilename: string,
  subtitleFiles: readonly string[],
  targetLang: string,
  nativeLang: string,
): MatchResult {
  const videoBase = stripResolutionSuffix(videoFilename).toLowerCase();

  // Collect matching subtitles in original input order
  const matches: SubtitleMatch[] = [];
  for (const subFile of subtitleFiles) {
    const subBase = getSubtitleBaseName(subFile).toLowerCase();
    if (subBase === videoBase) {
      const { code, tags } = extractLanguageCode(subFile);
      matches.push({ filename: subFile, languageCode: code, tags });
    }
  }

  if (matches.length === 0) {
    return { target: undefined, native: undefined, others: [] };
  }

  // Sorted copy for priority-based selection
  const sorted = [...matches].sort(compareSubtitlePriority);

  // Select target + native by language code
  let target = sorted.find((m) => m.languageCode === targetLang);
  let native = sorted.find((m) => m.languageCode === nativeLang);

  // Fallback (no language code) serves as target if no target-lang match
  const fallbacks = sorted.filter((m) => m.languageCode === null);
  if (!target && fallbacks.length > 0) {
    target = fallbacks[0];
  }

  // Bilingual SRT: if NO language-specific matches exist at all,
  // fallback also serves as native (edge case #12)
  const hasLangSpecific = matches.some((m) => m.languageCode !== null);
  if (!native && !hasLangSpecific && fallbacks.length > 0) {
    native = fallbacks[0];
  }

  // Others: matches not selected as target or native, in original order
  const targetFn = target?.filename;
  const nativeFn = native?.filename;
  const others = matches.filter(
    (m) => m.filename !== targetFn && m.filename !== nativeFn,
  );

  return { target, native, others };
}
