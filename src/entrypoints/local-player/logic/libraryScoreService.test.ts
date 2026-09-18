import {
  runLibraryScoring,
  type LibraryScoreDeps,
  type TokenCache,
} from './libraryScoreService';
import { matchSubtitlesForVideo, parseSubtitleFile } from '../hooks/useSubtitleMatch';
import type {
  SubtitleRecord,
  VideoComprehension,
  VideoRecord,
} from '@/features/local-player/services/mediaLibraryRepository';
import type { WordStatus } from '@/entities/dictionary';

if (typeof File.prototype.text !== 'function') {
  File.prototype.text = function (this: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

const NOW = '2026-10-03T12:00:00.000Z';

const srt = (text: string): string =>
  `1\n00:00:01,000 --> 00:00:02,000\n${text}\n`;

const file = (name: string, content: string, mtime = 1000): File =>
  new File([content], name, { lastModified: mtime });

const video = (over: Partial<VideoRecord> = {}): VideoRecord => ({
  id: 'v1',
  filename: 'show.1080p.mkv',
  title: 'show',
  durationMs: 60000,
  addedAt: '2026-01-01T00:00:00.000Z',
  lastWatchedAt: null,
  resumePositionMs: 0,
  ...over,
});

const sub = (filename: string, over: Partial<SubtitleRecord> = {}): SubtitleRecord => ({
  id: filename,
  filename,
  languageCode: 'en',
  addedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const fileHandle = (f: File, grantedName = 'handle'): FileSystemFileHandle =>
  ({
    kind: 'file',
    name: grantedName,
    getFile: jest.fn(async () => f),
  }) as unknown as FileSystemFileHandle;

interface Deps {
  deps: LibraryScoreDeps;
  permissions: Map<object, PermissionState>;
  statuses: Map<string, WordStatus>;
  writes: Array<{ id: string; comp: VideoComprehension }>;
  scanCalls: object[];
  parseCalls: string[];
  fetchCalls: number;
  writeShouldFail?: boolean;
}

function makeDeps(over: Partial<Deps> = {}): Deps {
  const state: Deps = {
    permissions: new Map(),
    statuses: new Map([['hello', 'known'], ['world', 'known']]),
    writes: [],
    scanCalls: [],
    parseCalls: [],
    fetchCalls: 0,
    deps: undefined as unknown as LibraryScoreDeps,
    ...over,
  };
  state.deps = {
    matchSubtitlesForVideo,
    parseSubtitleFile: (name, content) => {
      state.parseCalls.push(name);
      return parseSubtitleFile(name, content);
    },
    queryPermission: async (h) => state.permissions.get(h) ?? 'denied',
    scanSubtitlesInDir: async (h) => {
      state.scanCalls.push(h);
      return new Map();
    },
    fetchTermStatuses: async () => {
      state.fetchCalls++;
      return state.statuses;
    },
    updateVideoComprehension: async (id, comp) => {
      if (state.writeShouldFail) return false;
      state.writes.push({ id, comp });
      return true;
    },
    now: () => NOW,
  };
  return state;
}

const run = (
  d: Deps,
  videos: VideoRecord[],
  subtitles: SubtitleRecord[] = [],
  fileMap: ReadonlyMap<string, File> = new Map(),
  tokenCache: TokenCache = new Map(),
  isCurrent: () => boolean = () => true,
) =>
  runLibraryScoring({
    videos,
    subtitles,
    fileMap,
    deps: d.deps,
    tokenCache,
    isCurrent,
  });

describe('runLibraryScoring — resolution', () => {
  it('scores a video whose subtitle resolves via the session fileMap', async () => {
    const d = makeDeps();
    const res = await run(
      d,
      [video()],
      [sub('show.en.srt')],
      new Map([['show.en.srt', file('show.en.srt', srt('Hello world'))]]),
    );

    expect(res.writes).toBe(1);
    expect(d.writes[0]!.id).toBe('v1');
    expect(d.writes[0]!.comp.coverage).toBe(100);
    expect(d.writes[0]!.comp.band).toBe('comfortable');
    expect(d.writes[0]!.comp.subtitleFilename).toBe('show.en.srt');
    expect(d.writes[0]!.comp.computedAt).toBe(NOW);
  });

  it('skips when no subtitle matches the video', async () => {
    const d = makeDeps();
    const res = await run(
      d,
      [video()],
      [sub('other.en.srt'), sub('another.vi.srt')],
      new Map(),
    );
    expect(res.writes).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it('applies the sole-subtitle rule when exactly one candidate exists', async () => {
    const d = makeDeps();
    const res = await run(
      d,
      [video()],
      [sub('random-name.srt')],
      new Map([['random-name.srt', file('random-name.srt', srt('Hello world'))]]),
    );
    expect(res.writes).toBe(1);
    expect(d.writes[0]!.comp.subtitleFilename).toBe('random-name.srt');
  });

  it('resolves via a granted dirHandle scan, memoized per handle', async () => {
    const dirHandle = { kind: 'directory', name: 'media' } as FileSystemDirectoryHandle;
    const d = makeDeps();
    d.permissions.set(dirHandle, 'granted');
    d.deps.scanSubtitlesInDir = async () => {
      d.scanCalls.push(dirHandle);
      return new Map([['show.en.srt', file('show.en.srt', srt('Hello world'))]]);
    };

    const res = await run(
      d,
      [
        video({ id: 'v1', dirHandle }),
        video({ id: 'v2', filename: 'show.720p.mkv', dirHandle }),
      ],
      [sub('show.en.srt')],
      new Map(),
    );

    expect(d.scanCalls).toHaveLength(1);
    expect(res.writes).toBe(2);
  });

  it('falls back to the subtitle record fileHandle when granted', async () => {
    const f = file('show.en.srt', srt('Hello world'));
    const handle = fileHandle(f);
    const d = makeDeps();
    d.permissions.set(handle, 'granted');

    const res = await run(d, [video()], [sub('show.en.srt', { fileHandle: handle })]);
    expect(res.writes).toBe(1);
    expect(handle.getFile).toHaveBeenCalled();
  });

  it('skips silently when the fileHandle permission is prompt/denied', async () => {
    const f = file('show.en.srt', srt('Hello world'));
    const handle = fileHandle(f);
    const d = makeDeps();
    d.permissions.set(handle, 'prompt');

    const res = await run(d, [video()], [sub('show.en.srt', { fileHandle: handle })]);
    expect(res.writes).toBe(0);
    expect(handle.getFile).not.toHaveBeenCalled();
  });

  it('skips silently when queryPermission throws', async () => {
    const handle = fileHandle(file('show.en.srt', srt('Hello world')));
    const d = makeDeps();
    d.deps.queryPermission = async () => {
      throw new Error('SecurityError');
    };

    const res = await run(d, [video()], [sub('show.en.srt', { fileHandle: handle })]);
    expect(res.writes).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it('skips an unparsable subtitle without failing the run', async () => {
    const d = makeDeps();
    const res = await run(
      d,
      [video()],
      [sub('show.en.srt')],
      new Map([['show.en.srt', file('show.en.xyz', 'not a subtitle')]]),
    );
    expect(res.writes).toBe(0);
    expect(res.skipped).toBe(1);
  });
});

describe('runLibraryScoring — fail-closed + write rules', () => {
  const scored = (d: Deps) =>
    run(
      d,
      [video()],
      [sub('show.en.srt')],
      new Map([['show.en.srt', file('show.en.srt', srt('Hello world'))]]),
    );

  it('aborts without writes when fetchTermStatuses throws', async () => {
    const d = makeDeps();
    d.deps.fetchTermStatuses = async () => {
      throw new Error('IDB gone');
    };
    const res = await scored(d);
    expect(res.aborted).toBe(true);
    expect(d.writes).toHaveLength(0);
  });

  it('aborts without writes on an empty status map', async () => {
    const d = makeDeps({ statuses: new Map() });
    const res = await scored(d);
    expect(res.aborted).toBe(true);
    expect(d.writes).toHaveLength(0);
  });

  it('does not write when the computed score equals the persisted one', async () => {
    const d = makeDeps();
    const prev: VideoComprehension = {
      coverage: 100,
      band: 'comfortable',
      newTerms: 0,
      subtitleFilename: 'show.en.srt',
      computedAt: '2026-09-01T00:00:00.000Z',
    };
    const res = await run(
      d,
      [video({ comprehension: prev })],
      [sub('show.en.srt')],
      new Map([['show.en.srt', file('show.en.srt', srt('Hello world'))]]),
    );
    expect(res.writes).toBe(0);
  });

  it('skips the write when tokens are non-scorable (numeric-only)', async () => {
    const d = makeDeps();
    const res = await run(
      d,
      [video()],
      [sub('show.en.srt')],
      new Map([['show.en.srt', file('show.en.srt', srt('123 456'))]]),
    );
    expect(res.writes).toBe(0);
  });

  it('does not resurrect a deleted video (update returns false)', async () => {
    const d = makeDeps({ writeShouldFail: true });
    const res = await scored(d);
    expect(res.writes).toBe(0);
  });

  it('aborts remaining writes when the generation goes stale mid-run', async () => {
    const d = makeDeps();
    let current = true;
    d.deps.updateVideoComprehension = async () => {
      current = false;
      return true;
    };
    const res = await run(
      d,
      [video({ id: 'v1' }), video({ id: 'v2', filename: 'show.720p.mkv' })],
      [sub('show.en.srt')],
      new Map([['show.en.srt', file('show.en.srt', srt('Hello world'))]]),
      new Map(),
      () => current,
    );
    expect(res.aborted).toBe(true);
    expect(res.writes).toBe(1);
  });
});

describe('runLibraryScoring — token cache', () => {
  it('reuses tokens when subtitle filename + mtime are unchanged', async () => {
    const d = makeDeps();
    const f = file('show.en.srt', srt('Hello world'));
    const cache: TokenCache = new Map();
    const v = video();
    const s = [sub('show.en.srt')];
    const m = new Map([['show.en.srt', f]]);

    await run(d, [v], s, m, cache);
    await run(d, [v], s, m, cache);
    expect(d.parseCalls).toHaveLength(1);
    expect(d.fetchCalls).toBe(2);
  });

  it('re-parses when the file mtime changes', async () => {
    const d = makeDeps();
    const cache: TokenCache = new Map();
    const v = video();
    const s = [sub('show.en.srt')];

    await run(d, [v], s, new Map([['show.en.srt', file('show.en.srt', srt('Hello'), 1000)]]), cache);
    await run(d, [v], s, new Map([['show.en.srt', file('show.en.srt', srt('Hello'), 2000)]]), cache);
    expect(d.parseCalls).toHaveLength(2);
  });
});
