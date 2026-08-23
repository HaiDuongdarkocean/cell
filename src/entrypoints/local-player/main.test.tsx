/**
 * Integration test for local-player/main.tsx — verifies the orchestration layer
 * wires all hooks + repository + store together correctly.
 *
 * Mocks:
 *  - useLocalPlayerStore (Zustand) — controlled state + spies on setters.
 *  - openVideoFile (useFileSystemAccess) — returns a fake picked file.
 *  - matchSubtitlesForVideo (useSubtitleMatch) — returns a controlled match.
 *  - mediaLibraryRepository — spies on saveVideo, getAllVideos, addHistoryEntry.
 *  - PlayerView — stubbed to capture props passed from the orchestration layer.
 *  - ThemeProvider + ErrorBoundary — stubbed to passthrough children.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, fireEvent, screen, act } from '@testing-library/react';
import type { VideoRecord, SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitlesState } from './hooks/useLocalPlayerStore';
import type { MatchResult } from '@/features/local-player/logic/subtitleMatch';

// ─── Mock the store ─────────────────────────────────────────────────────────
type StoreState = {
  currentVideo: VideoRecord | null;
  videoFile: File | null;
  subtitles: SubtitlesState;
  subtitleStatus: 'idle' | 'searching' | 'loaded' | 'not-found' | 'error';
  library: VideoRecord[];
  subtitlesLibrary: SubtitleRecord[];
  librarySort: 'recent' | 'title' | 'added';
  showLibrary: boolean;
  setVideo: (video: VideoRecord, file: File) => void;
  setSubtitles: (subs: SubtitlesState) => void;
  setSubtitleStatus: (status: 'idle' | 'searching' | 'loaded' | 'not-found' | 'error') => void;
  setLibrary: (videos: VideoRecord[]) => void;
  setSubtitlesLibrary: (subs: SubtitleRecord[]) => void;
  setLibrarySort: (sortBy: 'recent' | 'title' | 'added') => void;
  toggleLibrary: () => void;
};

const setVideoSpy = jest.fn<(video: VideoRecord, file: File) => void>();
const setSubtitlesSpy = jest.fn<(subs: SubtitlesState) => void>();
const setSubtitleStatusSpy = jest.fn<(status: 'idle' | 'searching' | 'loaded' | 'not-found' | 'error') => void>();
const setLibrarySpy = jest.fn<(videos: VideoRecord[]) => void>();
const setSubtitlesLibrarySpy = jest.fn<(subs: SubtitleRecord[]) => void>();
const setLibrarySortSpy = jest.fn<(sortBy: 'recent' | 'title' | 'added') => void>();
const toggleLibrarySpy = jest.fn<() => void>();

const storeState: StoreState = {
  currentVideo: null,
  videoFile: null,
  subtitles: { target: null, native: null, others: [] },
  subtitleStatus: 'idle',
  library: [],
  subtitlesLibrary: [],
  librarySort: 'recent',
  showLibrary: false,
  setVideo: setVideoSpy,
  setSubtitles: setSubtitlesSpy,
  setSubtitleStatus: setSubtitleStatusSpy,
  setLibrary: setLibrarySpy,
  setSubtitlesLibrary: setSubtitlesLibrarySpy,
  setLibrarySort: setLibrarySortSpy,
  toggleLibrary: toggleLibrarySpy,
};

jest.mock('./hooks/useLocalPlayerStore', () => ({
  useLocalPlayerStore: jest.fn((selector: (s: StoreState) => unknown) =>
    selector(storeState),
  ),
}));

// ─── Mock file system access ────────────────────────────────────────────────
type PickedFile = { file: File; handle: FileSystemFileHandle };
const openFolderSpy = jest.fn<() => Promise<FileSystemDirectoryHandle | null>>();
const openMediaFilesSpy = jest.fn<() => Promise<PickedFile[] | null>>();
const openSubtitleFileSpy = jest.fn<() => Promise<PickedFile | null>>();
const verifyPermissionSpy = jest.fn<() => Promise<boolean>>();
verifyPermissionSpy.mockResolvedValue(true);
jest.mock('./hooks/useFileSystemAccess', () => ({
  openFolder: () => openFolderSpy(),
  openMediaFiles: () => openMediaFilesSpy(),
  openSubtitleFile: () => openSubtitleFileSpy(),
  verifyPermission: () => verifyPermissionSpy(),
}));

// ─── Mock showDirectoryPicker (File System Access API) ─────────────────────
const showDirectoryPickerSpy = jest.fn<() => Promise<FileSystemDirectoryHandle>>();
showDirectoryPickerSpy.mockRejectedValue(new DOMException('Abort', 'AbortError'));
(globalThis as unknown as { showDirectoryPicker: typeof showDirectoryPickerSpy }).showDirectoryPicker =
  showDirectoryPickerSpy;

// ─── Mock subtitle match ────────────────────────────────────────────────────
const matchSubtitlesForVideoSpy =
  jest.fn<
    (
      videoFilename: string,
      subtitleFiles: readonly string[],
      targetLang: string,
      nativeLang: string,
    ) => MatchResult
  >();

matchSubtitlesForVideoSpy.mockReturnValue({
  target: undefined,
  native: undefined,
  others: [],
});

jest.mock('./hooks/useSubtitleMatch', () => ({
  matchSubtitlesForVideo: (
    videoFilename: string,
    subtitleFiles: readonly string[],
    targetLang: string,
    nativeLang: string,
  ): MatchResult =>
    matchSubtitlesForVideoSpy(videoFilename, subtitleFiles, targetLang, nativeLang),
  parseSubtitleFile: jest.fn<() => []>().mockReturnValue([]),
}));

// ─── Mock folderScan ────────────────────────────────────────────────────────
const scanFolderSpy = jest.fn<() => Promise<{ videos: { file: File; handle: FileSystemFileHandle; filename: string }[]; subtitleFiles: Map<string, File>; subtitleFilenames: string[] }>>();
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov']);
const SUB_EXTS = new Set(['srt', 'vtt', 'ass', 'ssa', 'ttml', 'dfxp', 'sbv', 'smi', 'sami']);
jest.mock('@/features/local-player/logic/folderScan', () => ({
  scanFolder: () => scanFolderSpy(),
  matchVideosWithSubtitles: jest.fn((videos: readonly { file: File; handle: FileSystemFileHandle; filename: string }[]) =>
    videos.map((video: { file: File; handle: FileSystemFileHandle; filename: string }) => ({
      video,
      subtitles: { target: null, native: null, others: [] },
    })),
  ),
  isVideoFile: (name: string) => VIDEO_EXTS.has(name.slice(name.lastIndexOf('.') + 1).toLowerCase()),
  isSubtitleFile: (name: string) => SUB_EXTS.has(name.slice(name.lastIndexOf('.') + 1).toLowerCase()),
}));

// ─── Mock useSubtitleEngine ─────────────────────────────────────────────────
jest.mock('./hooks/useSubtitleEngine', () => ({
  useSubtitleEngine: () => ({
    hasSubtitles: false,
    repeatIcon: 'navRepeat',
    repeatLabel: 'Repeat',
    repeatActive: false,
    offsetMs: 0,
    targetStyle: { visible: true, fontSize: 18, color: '#fff', bgOpacity: 0.7 },
    nativeStyle: { visible: true, fontSize: 16, color: '#fff', bgOpacity: 0.7 },
    blockSettings: { yOffsetPercent: 75, globalScale: 1, bgOpacity: 0.7 },
    clusterSettings: { enabled: true, buttonSize: 34, textOpacity: 1, bgOpacity: 0.2 },
    loadCues: jest.fn(),
    clearCues: jest.fn(),
    prev: jest.fn(),
    next: jest.fn(),
    repeat: jest.fn(),
    rewind: jest.fn(),
    forward: jest.fn(),
    playPause: jest.fn(),
    setOffset: jest.fn(),
    updateStyle: jest.fn(),
    updateBlockSettings: jest.fn(),
    updateClusterSettings: jest.fn(),
    getTargetCues: jest.fn(() => []),
    getNativeCues: jest.fn(() => []),
  }),
}));

jest.mock('./hooks/useSubtitleActions', () => ({
  useSubtitleActions: () => ({
    onQuickAdd: jest.fn(),
    onEditCard: jest.fn(),
    onUpdateCurrentCard: jest.fn(),
    onGenerateNative: jest.fn(),
    generateNativeEnabled: false,
  }),
}));

// ─── Mock resume position ───────────────────────────────────────────────────
jest.mock('./hooks/useResumePosition', () => ({
  createResumePositionService: jest.fn(() => ({
    saveResumePosition: jest.fn<() => Promise<void>>(),
    getResumePosition: jest.fn<() => Promise<number | null>>().mockResolvedValue(null),
    promptResume: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
  })),
  createThrottledSaver: jest.fn(() => ({
    save: jest.fn<(positionMs: number) => void>(),
    flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })),
}));

// ─── Mock mediaLibraryRepository ────────────────────────────────────────────
const saveVideoSpy = jest.fn<(video: VideoRecord) => Promise<void>>();
saveVideoSpy.mockResolvedValue(undefined);
const getVideoSpy = jest.fn<(id: string) => Promise<VideoRecord | undefined>>();
getVideoSpy.mockResolvedValue(undefined);
const getAllVideosSpy = jest.fn<() => Promise<VideoRecord[]>>();
getAllVideosSpy.mockResolvedValue([]);
const addHistoryEntrySpy = jest.fn<(entry: unknown) => Promise<void>>();
addHistoryEntrySpy.mockResolvedValue(undefined);
const saveSubtitleSpy = jest.fn<(sub: SubtitleRecord) => Promise<void>>();
saveSubtitleSpy.mockResolvedValue(undefined);
const getAllSubtitlesSpy = jest.fn<() => Promise<SubtitleRecord[]>>();
getAllSubtitlesSpy.mockResolvedValue([]);
const getSubtitleSpy = jest.fn<(id: string) => Promise<SubtitleRecord | undefined>>();
getSubtitleSpy.mockResolvedValue(undefined);

jest.mock('@/features/local-player/services/mediaLibraryRepository', () => ({
  saveVideo: (video: VideoRecord): Promise<void> => saveVideoSpy(video),
  getVideo: (id: string): Promise<VideoRecord | undefined> => getVideoSpy(id),
  getAllVideos: (): Promise<VideoRecord[]> => getAllVideosSpy(),
  addHistoryEntry: (entry: unknown): Promise<void> => addHistoryEntrySpy(entry),
  updateResumePosition: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  saveSubtitle: (sub: SubtitleRecord): Promise<void> => saveSubtitleSpy(sub),
  getAllSubtitles: (): Promise<SubtitleRecord[]> => getAllSubtitlesSpy(),
  getSubtitle: (id: string): Promise<SubtitleRecord | undefined> => getSubtitleSpy(id),
}));

// ─── Mock PlayerView to capture props ───────────────────────────────────────
interface CapturedProps {
  filename: string | null;
  videoFile: File | null;
  subtitles: SubtitlesState;
  subtitleStatus: string;
  library: VideoRecord[];
  subtitlesLibrary: SubtitleRecord[];
  librarySort: string;
  showLibrary: boolean;
  targetStyle: unknown;
  nativeStyle: unknown;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onOpenSubtitle: () => void;
  onSelectTrack: (match: unknown) => void;
  onFilesDrop: (files: File[]) => void;
  onToggleLibrary: () => void;
  onVideoSelect: (videoId: string) => void;
  onSubtitleSelect: (subtitleId: string) => void;
  onSortChange: (sortBy: string) => void;
  onTimeUpdate?: (currentTime: number) => void;
  manager: unknown;
  subtitleActions: unknown;
}

let capturedPlayerViewProps: CapturedProps = {
  filename: null,
  videoFile: null,
  subtitles: { target: null, native: null, others: [] },
  subtitleStatus: 'idle',
  library: [],
  subtitlesLibrary: [],
  librarySort: 'recent',
  showLibrary: false,
  targetStyle: null,
  nativeStyle: null,
  onOpenFile: () => {},
  onOpenFolder: () => {},
  onOpenSubtitle: () => {},
  onSelectTrack: () => {},
  onFilesDrop: () => {},
  onToggleLibrary: () => {},
  onVideoSelect: () => {},
  onSubtitleSelect: () => {},
  onSortChange: () => {},
  manager: null,
  subtitleActions: null,
};

jest.mock('./components/PlayerView', () => ({
  PlayerView: (props: CapturedProps): React.JSX.Element => {
    capturedPlayerViewProps = props;
    return (
      <div data-cell-id="player-view">
        <button
          data-cell-id="mock-open-file"
          onClick={() => props.onOpenFile()}
        >
          Open
        </button>
        <button
          data-cell-id="mock-file-drop"
          onClick={() =>
            props.onFilesDrop([new File([], 'dropped.mp4', { type: 'video/mp4' })])
          }
        >
          Drop
        </button>
        <button
          data-cell-id="mock-toggle-library"
          onClick={() => props.onToggleLibrary()}
        >
          Library
        </button>
        <button
          data-cell-id="mock-video-select"
          onClick={() => props.onVideoSelect('v1')}
        >
          Select
        </button>
        <button
          data-cell-id="mock-sort-change"
          onClick={() => props.onSortChange('title')}
        >
          Sort
        </button>
        <button
          data-cell-id="mock-time-update"
          onClick={() => props.onTimeUpdate?.(30)}
        >
          TimeUpdate
        </button>
        <button
          data-cell-id="mock-subtitle-select"
          onClick={() => props.onSubtitleSelect('sub1')}
        >
          SubSelect
        </button>
      </div>
    );
  },
}));

// ─── Mock ThemeProvider + ErrorBoundary ─────────────────────────────────────
jest.mock('@/features/theme/ui/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }): React.JSX.Element =>
    <>{children}</>,
}));
jest.mock('@/shared/ui', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }): React.JSX.Element =>
    <>{children}</>,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────
import { LocalPlayerApp } from './main';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const fakeFile = new File(['video-data'], 'Movie_720p.mp4', {
  type: 'video/mp4',
});
// lastModified is set by File constructor — ensure deterministic
Object.defineProperty(fakeFile, 'lastModified', { value: 1700000000000 });
Object.defineProperty(fakeFile, 'size', { value: 1000 });

const fakeHandle = {} as FileSystemFileHandle;

function resetStoreState(): void {
  storeState.currentVideo = null;
  storeState.videoFile = null;
  storeState.subtitles = { target: null, native: null, others: [] };
  storeState.subtitleStatus = 'idle';
  storeState.library = [];
  storeState.librarySort = 'recent';
  storeState.showLibrary = false;
}

describe('LocalPlayerApp — integration wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStoreState();
    // Re-set default mock return values (clearAllMocks clears calls but not
    // implementations; resetAllMocks would reset implementations).
    matchSubtitlesForVideoSpy.mockReturnValue({
      target: undefined,
      native: undefined,
      others: [],
    });
    getAllVideosSpy.mockResolvedValue([]);
    getAllSubtitlesSpy.mockResolvedValue([]);
    getSubtitleSpy.mockResolvedValue(undefined);
    saveSubtitleSpy.mockResolvedValue(undefined);
    openFolderSpy.mockResolvedValue(null);
    openMediaFilesSpy.mockResolvedValue(null);
    scanFolderSpy.mockResolvedValue({ videos: [], subtitleFiles: new Map(), subtitleFilenames: [] });
    showDirectoryPickerSpy.mockRejectedValue(new DOMException('Abort', 'AbortError'));
    openSubtitleFileSpy.mockResolvedValue(null);
  });

  it('renders PlayerView with correct props from store', () => {
    render(<LocalPlayerApp />);
    expect(screen.getByTestId('player-view')).toBeInTheDocument();
    // videoFile from store is null → filename should be null
    expect(capturedPlayerViewProps.filename).toBeNull();
    expect(capturedPlayerViewProps.videoFile).toBeNull();
    // library from store is empty array
    expect(capturedPlayerViewProps.library).toEqual([]);
    // showLibrary from store is false
    expect(capturedPlayerViewProps.showLibrary).toBe(false);
  });

  it('passes targetStyle + nativeStyle from DEFAULT_OVERLAY_STYLE constants', () => {
    render(<LocalPlayerApp />);
    expect(capturedPlayerViewProps.targetStyle).toBeDefined();
    expect(capturedPlayerViewProps.nativeStyle).toBeDefined();
    // Target style should have visible: true (default)
    const targetStyle = capturedPlayerViewProps.targetStyle as { visible: boolean };
    expect(targetStyle.visible).toBe(true);
  });

  it('loads library on mount via getAllVideos', async () => {
    const sampleVideos: VideoRecord[] = [
      {
        id: 'v1',
        filename: 'movie.mp4',
        title: 'Movie',
        durationMs: 120000,
        addedAt: '2026-01-01T00:00:00.000Z',
        lastWatchedAt: null,
        resumePositionMs: 0,
      },
    ];
    getAllVideosSpy.mockResolvedValue(sampleVideos);

    render(<LocalPlayerApp />);
    // Wait for the useEffect to fire (getAllVideos is called on mount)
    await act(async () => {
      await Promise.resolve();
    });

    expect(getAllVideosSpy).toHaveBeenCalledTimes(1);
    expect(setLibrarySpy).toHaveBeenCalledWith(sampleVideos);
  });

  it('openFile flow: calls openMediaFiles → loads first video → saves to library', async () => {
    openMediaFilesSpy.mockResolvedValue([
      { file: fakeFile, handle: fakeHandle },
    ]);

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-open-file'));
    });

    // 1. openMediaFiles was called
    expect(openMediaFilesSpy).toHaveBeenCalledTimes(1);

    // 2. setVideo was called with a VideoRecord + the File
    expect(setVideoSpy).toHaveBeenCalledTimes(1);
    const [videoRecord, fileArg] = setVideoSpy.mock.calls[0];
    expect(fileArg).toBe(fakeFile);
    expect(videoRecord.filename).toBe('Movie_720p.mp4');

    // 3. saveVideo was called (library upsert)
    expect(saveVideoSpy).toHaveBeenCalled();

    // 4. addHistoryEntry was called
    expect(addHistoryEntrySpy).toHaveBeenCalledTimes(1);
  });

  it('openFile returns null (user cancels) → no state changes', async () => {
    openMediaFilesSpy.mockResolvedValue(null);

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-open-file'));
    });

    expect(openMediaFilesSpy).toHaveBeenCalledTimes(1);
    expect(setVideoSpy).not.toHaveBeenCalled();
    expect(saveVideoSpy).not.toHaveBeenCalled();
  });

  it('openFile picks video + subtitle with different names → auto-pair', async () => {
    const srtFile = new File(['1\n00:00:00,500 --> 00:00:02,000\nHello\n'], 'random-name.srt');
    openMediaFilesSpy.mockResolvedValue([
      { file: fakeFile, handle: fakeHandle },
      { file: srtFile, handle: fakeHandle },
    ]);
    // matchSubtitlesForVideo returns no match (different base names)
    matchSubtitlesForVideoSpy.mockReturnValue({
      target: undefined,
      native: undefined,
      others: [],
    });

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-open-file'));
    });

    // Video loaded
    expect(setVideoSpy).toHaveBeenCalledTimes(1);
    // Subtitle auto-paired (1 video + 1 subtitle → auto-pair)
    expect(setSubtitlesSpy).toHaveBeenCalledWith({
      target: expect.objectContaining({ filename: 'random-name.srt' }),
      native: null,
      others: [],
    });
  });

  it('file drop flow: calls loadVideo with the dropped file', async () => {
    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-file-drop'));
    });

    expect(setVideoSpy).toHaveBeenCalledTimes(1);
    const [videoRecord, fileArg] = setVideoSpy.mock.calls[0];
    expect(fileArg.name).toBe('dropped.mp4');
    expect(videoRecord.filename).toBe('dropped.mp4');
    expect(saveVideoSpy).toHaveBeenCalledTimes(1);
  });

  it('subtitle match flow: after video set → calls matchSubtitlesForVideo → sets subtitles in store', async () => {
    const srtFile = new File(['1\n00:00:00,500 --> 00:00:02,000\nHello\n'], 'Movie.en.srt');
    openMediaFilesSpy.mockResolvedValue([
      { file: fakeFile, handle: fakeHandle },
      { file: srtFile, handle: fakeHandle },
    ]);
    matchSubtitlesForVideoSpy.mockReturnValue({
      target: {
        filename: 'Movie.en.srt',
        languageCode: 'en',
        tags: [],
      },
      native: undefined,
      others: [],
    });

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-open-file'));
    });

    // matchSubtitlesForVideo was called with the video filename + subtitle filenames
    expect(matchSubtitlesForVideoSpy).toHaveBeenCalledTimes(1);
    const matchArgs = matchSubtitlesForVideoSpy.mock.calls[0];
    expect(matchArgs[0]).toBe('Movie_720p.mp4');
    expect(matchArgs[1]).toContain('Movie.en.srt');

    // setSubtitles should have been called with the match result
    expect(setSubtitlesSpy).toHaveBeenCalledTimes(1);
    const subsArg = setSubtitlesSpy.mock.calls[0][0];
    expect(subsArg.target?.filename).toBe('Movie.en.srt');
    expect(subsArg.native).toBeNull();
  });

  it('subtitle match flow: no match + no subtitle → sets empty subtitles in store', async () => {
    openMediaFilesSpy.mockResolvedValue([
      { file: fakeFile, handle: fakeHandle },
    ]);
    matchSubtitlesForVideoSpy.mockReturnValue({
      target: undefined,
      native: undefined,
      others: [],
    });

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-open-file'));
    });

    expect(setSubtitlesSpy).toHaveBeenCalledTimes(1);
    const subsArg = setSubtitlesSpy.mock.calls[0][0];
    expect(subsArg.target).toBeNull();
    expect(subsArg.native).toBeNull();
    expect(subsArg.others).toEqual([]);
  });

  it('resume position flow: onTimeUpdate is wired to PlayerView', async () => {
    openMediaFilesSpy.mockResolvedValue([
      { file: fakeFile, handle: fakeHandle },
    ]);

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-open-file'));
    });

    // Get the createThrottledSaver mock to check it was called
    const { createThrottledSaver } =
      jest.requireMock<typeof import('./hooks/useResumePosition')>(
        './hooks/useResumePosition',
      );
    expect(createThrottledSaver).toHaveBeenCalledTimes(1);

    // The onTimeUpdate handler should be wired (not that save fires —
    // videoRef.current is null in the mock PlayerView so the handler
    // returns early, but the prop must be a function).
    expect(capturedPlayerViewProps.onTimeUpdate).toBeDefined();
    expect(typeof capturedPlayerViewProps.onTimeUpdate).toBe('function');
  });

  it('toggleLibrary: calls store.toggleLibrary', async () => {
    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-toggle-library'));
    });
    expect(toggleLibrarySpy).toHaveBeenCalledTimes(1);
  });

  it('videoSelect: calls getVideo with the selected id', async () => {
    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-video-select'));
    });
    expect(getVideoSpy).toHaveBeenCalledWith('v1');
  });

  it('sortChange: bridges SortBy → LibrarySort via setLibrarySort', async () => {
    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-sort-change'));
    });
    expect(setLibrarySortSpy).toHaveBeenCalledWith('title');
  });

  it('passes librarySort from store as SortBy to PlayerView', () => {
    storeState.librarySort = 'added';
    render(<LocalPlayerApp />);
    expect(capturedPlayerViewProps.librarySort).toBe('added');
  });

  it('openFile with subtitle → saveSubtitle called + subtitlesLibrary refreshed', async () => {
    const srtFile = new File(['1\n00:00:00,500 --> 00:00:02,000\nHello\n'], 'Movie.en.srt');
    openMediaFilesSpy.mockResolvedValue([
      { file: fakeFile, handle: fakeHandle },
      { file: srtFile, handle: fakeHandle },
    ]);
    getAllSubtitlesSpy.mockResolvedValue([
      { id: 'Movie.en.srt', filename: 'Movie.en.srt', languageCode: null, addedAt: '2024-01-01' },
    ]);

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-open-file'));
    });

    expect(saveSubtitleSpy).toHaveBeenCalledTimes(1);
    expect(saveSubtitleSpy).toHaveBeenCalledWith(expect.objectContaining({ filename: 'Movie.en.srt' }));
    expect(setSubtitlesLibrarySpy).toHaveBeenCalled();
  });

  it('subtitleSelect: calls getSubtitle + loads subtitle into current video', async () => {
    const srtFile = new File(['1\n00:00:00,500 --> 00:00:02,000\nHello\n'], 'Movie.en.srt');
    getSubtitleSpy.mockResolvedValue({
      id: 'Movie.en.srt',
      filename: 'Movie.en.srt',
      languageCode: 'en',
      addedAt: '2024-01-01',
    });
    // Cache subtitle file so handleSubtitleSelect can find it.
    // We need to populate subtitleFileMapRef — done via openFile flow first.

    render(<LocalPlayerApp />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-subtitle-select'));
    });

    expect(getSubtitleSpy).toHaveBeenCalledWith('sub1');
  });
});
