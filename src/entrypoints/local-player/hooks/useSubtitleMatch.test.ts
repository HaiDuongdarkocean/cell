import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SrtCue } from '@/entities/media';
import { matchSubtitlesForVideo, parseSubtitleFile } from './useSubtitleMatch';

import folderLayouts from '../../../../tests/data-test/local-player/samples/filenames/subtitle-folder-layouts.json';

// ─── Types for JSON fixture ─────────────────────────────────────────────────

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

const typedFolderLayouts = folderLayouts as FolderLayout[];

// ─── Sample file loader ─────────────────────────────────────────────────────

const SAMPLES_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'tests',
  'data-test',
  'local-player',
  'samples',
);

function loadSample(subdir: string, name: string): string {
  return readFileSync(join(SAMPLES_DIR, subdir, name), 'utf-8');
}

// ─── matchSubtitlesForVideo — folder-layouts.json (15 scenarios) ────────────

describe('matchSubtitlesForVideo — subtitle-folder-layouts.json (15 scenarios)', () => {
  it.each(typedFolderLayouts.map((s) => [s.scenario, s] as const))(
    '%s',
    (_name, s) => {
      const result = matchSubtitlesForVideo(
        s.videoFile,
        s.subtitleFiles,
        s.targetLang,
        s.nativeLang,
      );
      expect(result.target?.filename ?? null).toBe(s.expected.target);
      expect(result.native?.filename ?? null).toBe(s.expected.native);
      expect(result.others.map((o) => o.filename)).toEqual(s.expected.others);
    },
  );
});

describe('matchSubtitlesForVideo — no subtitle found returns empty result', () => {
  it('returns empty result when no subtitle matches', () => {
    const result = matchSubtitlesForVideo(
      'Movie_720p.mp4',
      ['OtherMovie.en.srt', 'AnotherShow.vi.srt'],
      'en',
      'vi',
    );
    expect(result.target).toBeUndefined();
    expect(result.native).toBeUndefined();
    expect(result.others).toEqual([]);
  });
});

// ─── parseSubtitleFile — real sample files for each format ──────────────────

describe('parseSubtitleFile — SRT sample-01-basic.srt', () => {
  it('parses to 3 SrtCues with correct timestamps + text', () => {
    const content = loadSample('srt', 'sample-01-basic.srt');
    const cues = parseSubtitleFile('sample-01-basic.srt', content);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject<SrtCue>({
      index: 1,
      start: 1000,
      end: 4000,
      text: 'Hello, world!',
    });
    expect(cues[1]).toMatchObject<SrtCue>({
      index: 2,
      start: 5000,
      end: 8000,
      text: 'This is a basic subtitle.',
    });
    expect(cues[2]).toMatchObject<SrtCue>({
      index: 3,
      start: 9000,
      end: 12000,
      text: 'Goodbye, world!',
    });
  });
});

describe('parseSubtitleFile — VTT sample-01-basic.vtt', () => {
  it('converts VTT → SRT then parses to 3 SrtCues', () => {
    const content = loadSample('vtt', 'sample-01-basic.vtt');
    const cues = parseSubtitleFile('sample-01-basic.vtt', content);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject<SrtCue>({
      index: 1,
      start: 1000,
      end: 4000,
      text: 'Hello, world!',
    });
    expect(cues[2]).toMatchObject<SrtCue>({
      index: 3,
      start: 9000,
      end: 12000,
      text: 'Goodbye, world!',
    });
  });
});

describe('parseSubtitleFile — ASS sample-01-basic.ass', () => {
  it('converts ASS → SRT then parses to 3 SrtCues', () => {
    const content = loadSample('ass', 'sample-01-basic.ass');
    const cues = parseSubtitleFile('sample-01-basic.ass', content);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject<SrtCue>({
      index: 1,
      start: 1000,
      end: 4000,
      text: 'Hello, world!',
    });
  });
});

describe('parseSubtitleFile — TTML sample-01-basic.ttml', () => {
  it('converts TTML → SRT then parses to 3 SrtCues', () => {
    const content = loadSample('ttml', 'sample-01-basic.ttml');
    const cues = parseSubtitleFile('sample-01-basic.ttml', content);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject<SrtCue>({
      index: 1,
      start: 760,
      end: 3450,
      text: 'Hello, world!',
    });
  });
});

describe('parseSubtitleFile — SBV sample-01-basic.sbv', () => {
  it('converts SBV → SRT then parses to 6 SrtCues', () => {
    const content = loadSample('sbv', 'sample-01-basic.sbv');
    const cues = parseSubtitleFile('sample-01-basic.sbv', content);
    expect(cues).toHaveLength(6);
    expect(cues[0]).toMatchObject<SrtCue>({
      index: 1,
      start: 940,
      end: 5050,
      text: 'This is a test of the SBV file converter.',
    });
  });
});

describe('parseSubtitleFile — SMI sample-01-basic.smi', () => {
  it('converts SMI → SRT then parses to 6 SrtCues', () => {
    const content = loadSample('smi', 'sample-01-basic.smi');
    const cues = parseSubtitleFile('sample-01-basic.smi', content);
    expect(cues).toHaveLength(6);
    expect(cues[0]).toMatchObject<SrtCue>({
      index: 1,
      start: 0,
      end: 3000,
      text: 'Welcome to the presentation',
    });
  });
});

// ─── Format detection by extension ──────────────────────────────────────────

describe('parseSubtitleFile — format detection by extension', () => {
  it('treats .dfxp as TTML', () => {
    const content = loadSample('ttml', 'sample-01-basic.ttml');
    const cues = parseSubtitleFile('sample-01-basic.dfxp', content);
    expect(cues).toHaveLength(3);
  });

  it('throws on unsupported extension', () => {
    expect(() => parseSubtitleFile('foo.txt', 'content')).toThrow();
  });
});

// ─── Returns parsed SrtCue[] for matched subtitle ───────────────────────────

describe('matchSubtitlesForVideo + parseSubtitleFile — end-to-end cue count', () => {
  it('matches target subtitle and parses correct cue count', () => {
    const srtContent = loadSample('srt', 'sample-01-basic.srt');
    const subtitleFiles = ['Movie.en.srt', 'Movie.vi.srt'];
    const result = matchSubtitlesForVideo(
      'Movie_720p.mp4',
      subtitleFiles,
      'en',
      'vi',
    );
    expect(result.target?.filename).toBe('Movie.en.srt');
    const cues = parseSubtitleFile(result.target!.filename, srtContent);
    expect(cues).toHaveLength(3);
  });
});
