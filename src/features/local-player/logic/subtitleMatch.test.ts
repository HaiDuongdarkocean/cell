import {
  stripResolutionSuffix,
  extractLanguageCode,
  matchSubtitles,
  ISO_639_2_TO_639_1,
  LANGUAGE_FULL_NAME_TO_CODE,
} from './subtitleMatch';

import videoFilenames from '../../../../tests/data-test/local-player/samples/filenames/video-filenames.json';
import subtitleFilenames from '../../../../tests/data-test/local-player/samples/filenames/subtitle-filenames.json';
import folderLayouts from '../../../../tests/data-test/local-player/samples/filenames/subtitle-folder-layouts.json';
import edgeCases from '../../../../tests/data-test/local-player/samples/filenames/match-edge-cases.json';

// ─── Types for JSON fixtures ────────────────────────────────────────────────

type VideoFilenameEntry = {
  filename: string;
  expectedBaseName: string;
  notes: string;
};

type SubtitleFilenameEntry = {
  filename: string;
  languageCode: string | null;
  languageFormat: string;
  baseName: string;
  notes: string;
};

type FolderLayout = {
  scenario: string;
  videoFile: string;
  subtitleFiles: string[];
  targetLang: string;
  nativeLang: string;
  expected: {
    target: string | null;
    native: string | null;
    others: string[];
  };
};

type EdgeCase = {
  id: number;
  description: string;
  videoFile: string;
  subtitleFiles: string[];
  targetLang: string;
  nativeLang: string;
  expected: {
    target: string | null;
    native: string | null;
    others: string[];
  };
  notes: string;
};

const typedVideoFilenames = videoFilenames as VideoFilenameEntry[];
const typedSubtitleFilenames = subtitleFilenames as SubtitleFilenameEntry[];
const typedFolderLayouts = folderLayouts as FolderLayout[];
const typedEdgeCases = edgeCases as EdgeCase[];

// ─── Helpers to compute expected normalised language code from raw JSON ─────
// Defined independently from the implementation (spec-derived) to avoid
// circular testing.

const ISO_639_1_CODES = new Set([
  'en', 'vi', 'ja', 'ko', 'zh', 'fr', 'de', 'es', 'pt', 'ru',
  'it', 'nl', 'pl', 'tr', 'ar', 'hi', 'th', 'id',
]);

/** Normalise a raw language string (from JSON) to ISO 639-1 2-letter code. */
function normaliseExpectedCode(raw: string | null): string | null {
  if (raw === null) return null;
  const lower = raw.toLowerCase();

  // ISO 639-1 (2-letter)
  if (ISO_639_1_CODES.has(lower)) return lower;

  // ISO 639-2 (3-letter) → map to 2-letter
  if (ISO_639_2_TO_639_1[lower]) return ISO_639_2_TO_639_1[lower];

  // BCP 47 (contains '-')
  if (lower.includes('-')) {
    const primary = lower.split('-')[0]!;
    if (ISO_639_1_CODES.has(primary)) return primary;
    if (ISO_639_2_TO_639_1[primary]) return ISO_639_2_TO_639_1[primary];
  }

  // Full language name (try original case + capitalised)
  if (LANGUAGE_FULL_NAME_TO_CODE[raw]) return LANGUAGE_FULL_NAME_TO_CODE[raw];
  const capitalised = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (LANGUAGE_FULL_NAME_TO_CODE[capitalised]) return LANGUAGE_FULL_NAME_TO_CODE[capitalised];

  return lower;
}

/** Determine expected tags from a subtitle filename (spec-derived). */
function expectedTags(filename: string): string[] {
  const knownTags = ['forced', 'sdh', 'hi', 'default'];
  const lower = filename.toLowerCase();
  const tags: string[] = [];
  for (const tag of knownTags) {
    // Match as dot-separated token or after '-' in a lang-tag combo
    if (lower.includes(`.${tag}.`) || lower.endsWith(`.${tag}.srt`)) {
      tags.push(tag);
    }
    // Handle lang-TAG combo like eng-SDH
    const dashMatch = lower.match(new RegExp(`-(?:${knownTags.join('|')})\\b`, 'i'));
    if (dashMatch) {
      const matched = dashMatch[0].slice(1).toLowerCase();
      if (!tags.includes(matched)) tags.push(matched);
    }
  }
  return tags.sort();
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('stripResolutionSuffix — video-filenames.json (40 entries)', () => {
  it.each(typedVideoFilenames.map((e) => [e.filename, e] as const))(
    '%s',
    (_filename, entry) => {
      expect(stripResolutionSuffix(entry.filename)).toBe(entry.expectedBaseName);
    },
  );
});

describe('extractLanguageCode — subtitle-filenames.json (38 entries)', () => {
  it.each(typedSubtitleFilenames.map((e) => [e.filename, e] as const))(
    '%s',
    (_filename, entry) => {
      const result = extractLanguageCode(entry.filename);
      const expectedCode = normaliseExpectedCode(entry.languageCode);
      expect(result.code).toBe(expectedCode);
      // Verify tags are extracted correctly
      const expTags = expectedTags(entry.filename);
      expect([...result.tags].sort()).toEqual(expTags);
    },
  );
});

describe('matchSubtitles — subtitle-folder-layouts.json (15 scenarios)', () => {
  it.each(typedFolderLayouts.map((s) => [s.scenario, s] as const))(
    '%s',
    (_name, s) => {
      const result = matchSubtitles(s.videoFile, s.subtitleFiles, s.targetLang, s.nativeLang);
      expect(result.target?.filename ?? null).toBe(s.expected.target);
      expect(result.native?.filename ?? null).toBe(s.expected.native);
      expect(result.others.map((o) => o.filename)).toEqual(s.expected.others);
    },
  );
});

describe('matchSubtitles — match-edge-cases.json (20 edge cases)', () => {
  it.each(typedEdgeCases.map((e) => [`#${e.id}: ${e.description}`, e] as const))(
    '%s',
    (_name, e) => {
      const result = matchSubtitles(e.videoFile, e.subtitleFiles, e.targetLang, e.nativeLang);
      expect(result.target?.filename ?? null).toBe(e.expected.target);
      expect(result.native?.filename ?? null).toBe(e.expected.native);
      expect(result.others.map((o) => o.filename)).toEqual(e.expected.others);
    },
  );
});
