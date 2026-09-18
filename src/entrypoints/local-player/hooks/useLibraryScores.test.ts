import { act, renderHook } from '@testing-library/react';
import { useLibraryScores } from './useLibraryScores';
import type { LibraryScoreDeps } from '../logic/libraryScoreService';
import type { FileCache } from '../logic/fileCache';
import { createFileCache } from '../logic/fileCache';
import {
  emitWordStatusChanged,
  emitWordStatusRemoved,
} from '@/features/dictionary/services/wordStatusEvents';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { WordStatus } from '@/entities/dictionary';
import type { RefObject } from 'react';

const getAllVideosMock = jest.fn(async (): Promise<VideoRecord[]> => []);
jest.mock('@/features/local-player/services/mediaLibraryRepository', () => ({
  ...jest.requireActual<
    typeof import('@/features/local-player/services/mediaLibraryRepository')
  >('@/features/local-player/services/mediaLibraryRepository'),
  getAllVideos: () => getAllVideosMock(),
}));

const srtFile = {
  name: 'show.en.srt',
  lastModified: 1000,
  text: async () => '1\n00:00:01,000 --> 00:00:02,000\nHello world\n',
} as File;

const video: VideoRecord = {
  id: 'v1',
  filename: 'show.1080p.mkv',
  title: 'show',
  durationMs: 60000,
  addedAt: '2026-01-01T00:00:00.000Z',
  lastWatchedAt: null,
  resumePositionMs: 0,
};

const statuses = new Map<string, WordStatus>([
  ['hello', 'known'],
  ['world', 'known'],
]);

interface DepsState {
  writes: string[];
  fetches: number;
}

function makeDeps(): { deps: Partial<LibraryScoreDeps>; state: DepsState } {
  const state: DepsState = { writes: [], fetches: 0 };
  const deps: Partial<LibraryScoreDeps> = {
    queryPermission: async () => 'denied',
    scanSubtitlesInDir: async () => new Map(),
    fetchTermStatuses: async () => {
      state.fetches++;
      return statuses;
    },
    updateVideoComprehension: async (id) => {
      state.writes.push(id);
      return true;
    },
    now: () => '2026-10-03T12:00:00.000Z',
  };
  return { deps, state };
}

function renderScores(args: {
  deps: Partial<LibraryScoreDeps>;
  setLibrary: jest.Mock;
  videos?: VideoRecord[];
  fileMap?: FileCache;
}) {
  const fileMapRef: RefObject<FileCache> = {
    current: args.fileMap ?? createFileCache(),
  };
  return renderHook(
    ({ videos }) =>
      useLibraryScores({
        videos,
        subtitles: [
          {
            id: 'show.en.srt',
            filename: 'show.en.srt',
            languageCode: 'en',
            addedAt: 'a',
          },
        ],
        fileMapRef,
        setLibrary: args.setLibrary,
        deps: args.deps,
      }),
    { initialProps: { videos: args.videos ?? [video] } },
  );
}

const fileMap = createFileCache([['show.en.srt', srtFile]]);

beforeEach(() => {
  jest.useFakeTimers();
  getAllVideosMock.mockReset().mockResolvedValue([video]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLibraryScores', () => {
  it('scores the library on mount and emits the refreshed list on writes', async () => {
    const { deps, state } = makeDeps();
    const setLibrary = jest.fn();
    renderScores({ deps, setLibrary, fileMap });

    await act(async () => {});

    expect(state.writes).toEqual(['v1']);
    expect(getAllVideosMock).toHaveBeenCalled();
    expect(setLibrary).toHaveBeenCalledWith([video]);
  });

  it('does not emit when a run writes nothing', async () => {
    const { deps } = makeDeps();
    deps.updateVideoComprehension = async () => true;
    const setLibrary = jest.fn();
    renderScores({ deps, setLibrary, videos: [] });

    await act(async () => {});
    expect(setLibrary).not.toHaveBeenCalled();
  });

  it('re-runs on a same-language status change after the debounce window', async () => {
    const { deps, state } = makeDeps();
    const setLibrary = jest.fn();
    renderScores({ deps, setLibrary, fileMap });
    await act(async () => {});
    expect(state.writes).toHaveLength(1);

    act(() => {
      emitWordStatusChanged({ langCode: 'en', term: 'hello', status: 'tracking' });
    });
    await act(async () => {
      jest.advanceTimersByTime(399);
    });
    expect(state.fetches).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(2);
    });
    expect(state.fetches).toBe(2);
  });

  it('ignores status changes in other languages', async () => {
    const { deps, state } = makeDeps();
    renderScores({ deps, setLibrary: jest.fn(), fileMap });
    await act(async () => {});

    act(() => {
      emitWordStatusChanged({ langCode: 'vi', term: 'xin', status: 'known' });
      emitWordStatusRemoved({ langCode: 'zh', term: '你好' });
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(state.fetches).toBe(1);
  });

  it('re-runs on status removal for the scoring language', async () => {
    const { deps, state } = makeDeps();
    renderScores({ deps, setLibrary: jest.fn(), fileMap });
    await act(async () => {});

    act(() => {
      emitWordStatusRemoved({ langCode: 'en', term: 'hello' });
    });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(state.fetches).toBe(2);
  });

  it('fires at max-delay when events keep arriving', async () => {
    const { deps, state } = makeDeps();
    renderScores({ deps, setLibrary: jest.fn(), fileMap });
    await act(async () => {});

    act(() => {
      for (let i = 0; i < 5; i++) {
        emitWordStatusChanged({ langCode: 'en', term: `t${i}`, status: 'tracking' });
        jest.advanceTimersByTime(350);
      }
    });
    await act(async () => {});
    expect(state.fetches).toBeGreaterThanOrEqual(2);
  });

  it('bumps the generation on unmount so in-flight writes abort', async () => {
    const { deps } = makeDeps();
    let resolveFetch: ((m: Map<string, WordStatus>) => void) | undefined;
    deps.fetchTermStatuses = () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      });
    const setLibrary = jest.fn();
    const { unmount } = renderScores({ deps, setLibrary, fileMap });

    unmount();
    await act(async () => {
      resolveFetch?.(statuses);
    });
    expect(setLibrary).not.toHaveBeenCalled();
  });
});
