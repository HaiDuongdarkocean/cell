import { render, screen, fireEvent, act } from '@testing-library/react';
import { createRef } from 'react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitlesState, SubtitleStatus } from '@/entrypoints/local-player/hooks/useLocalPlayerStore';
import type { SortBy } from '@/features/local-player/logic/librarySort';
import { useLocalVideo } from '@/entrypoints/local-player/hooks/useLocalVideo';
import type { SubtitleEngineControls } from '@/entrypoints/local-player/hooks/useSubtitleEngine';
import { PlayerView } from './PlayerView';

// ─── Mocks: isolate PlayerView layout from child component internals ───

// Mock URL.createObjectURL / revokeObjectURL for jsdom
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
}
if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = jest.fn();
}

jest.mock('@/entrypoints/local-player/hooks/useLocalVideo', () => ({
  useLocalVideo: jest.fn(() => ({
    isPlaying: false,
    currentTime: 0,
    duration: 120,
    volume: 1,
    muted: false,
    playbackRate: 1,
    play: jest.fn(),
    pause: jest.fn(),
    seek: jest.fn(),
    setVolume: jest.fn(),
    setPlaybackRate: jest.fn(),
    toggleMute: jest.fn(),
    toggleFullscreen: jest.fn(),
    togglePiP: jest.fn(),
  })),
}));

jest.mock('./PlayerControls', () => ({
  PlayerControls: () => <div data-cell-id="player-controls" />,
}));

jest.mock('./EmptyState', () => ({
  EmptyState: (props: {
    onOpenFile: () => void;
  }) => (
    <div data-cell-id="empty-state">
      <button data-cell-id="empty-open-file" onClick={props.onOpenFile}>
        Open
      </button>
    </div>
  ),
}));

jest.mock('./LibraryView', () => ({
  LibraryView: (props: {
    onVideoSelect: (id: string) => void;
    onSortChange: (sortBy: SortBy) => void;
  }) => (
    <div data-cell-id="library-view">
      <button data-cell-id="library-select" onClick={() => props.onVideoSelect('v1')}>
        Select
      </button>
      <button data-cell-id="library-sort" onClick={() => props.onSortChange('title')}>
        Sort
      </button>
    </div>
  ),
}));

jest.mock('@/features/subtitle/ui/SubtitleBlock', () => ({
  SubtitleBlock: () => <div data-cell-id="subtitle-block" />,
}));

jest.mock('@/features/subtitle/ui/NavCluster', () => ({
  NavCluster: () => <div data-cell-id="nav-cluster" />,
}));

jest.mock('@/features/subtitle/ui/SubtitleOffsetPanel', () => ({
  SubtitleOffsetPanel: () => <div data-cell-id="subtitle-offset-panel" />,
}));

jest.mock('@/features/subtitle/ui/SubtitlePanels', () => ({
  SubtitlePanels: () => <div data-cell-id="subtitle-panels-root" />,
}));

jest.mock('./TrackSelector', () => ({
  TrackSelector: () => <div data-cell-id="track-selector" />,
}));

let mockTargetCues: unknown[] = [];

jest.mock('@/stores/cuesStore', () => ({
  useCuesStore: (selector: (s: { targetCues: unknown[]; nativeCues: unknown[] }) => unknown) =>
    selector({ targetCues: mockTargetCues, nativeCues: [] }),
}));

// ─── Fixtures ───
const baseStyle: OverlayStyleConfig = {
  fontSize: 24,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  textOpacity: 1,
  textShadow: { preset: 'soft', color: '#000000', blur: 2, offsetX: 1, offsetY: 1 },
  fontFamily: 'sans-serif',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

interface RenderOpts {
  videoFile?: File | null;
  subtitleStatus?: SubtitleStatus;
  library?: VideoRecord[];
  subtitles?: SubtitlesState;
}

const mockSubtitleEngine = {
  hasSubtitles: false,
  repeatIcon: 'navRepeat' as const,
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
} as unknown as SubtitleEngineControls;

const mockManager = {
  targetItems: [],
  nativeItems: [],
  targetActiveIndex: -1,
  nativeActiveIndex: -1,
  onSelect: jest.fn(),
  hasSearchKeys: false,
  apiKeys: [],
  onApiKeysChange: jest.fn(),
  onSearchResultSelect: jest.fn(),
};

const mockSubtitleActions = {
  onQuickAdd: jest.fn(),
  onEditCard: jest.fn(),
  onUpdateCurrentCard: jest.fn(),
  onGenerateNative: jest.fn(),
  generateNativeEnabled: false,
};

function renderPlayerView(opts: RenderOpts = {}): {
  mocks: { onOpenFile: jest.Mock; onFilesDrop: jest.Mock; onVideoSelect: jest.Mock; onSortChange: jest.Mock; onOpenSubtitle: jest.Mock; onOpenFolder: jest.Mock };
} {
  return renderPlayerViewWithContainer(opts);
}

function renderPlayerViewWithContainer(opts: RenderOpts = {}): {
  mocks: { onOpenFile: jest.Mock; onFilesDrop: jest.Mock; onVideoSelect: jest.Mock; onSortChange: jest.Mock; onOpenSubtitle: jest.Mock; onOpenFolder: jest.Mock };
  container: HTMLElement;
} {
  const videoRef = createRef<HTMLVideoElement>();
  const onOpenFile = jest.fn();
  const onFilesDrop = jest.fn();
  const onVideoSelect = jest.fn();
  const onSortChange = jest.fn();
  const onOpenSubtitle = jest.fn();
  const onOpenFolder = jest.fn();
  const onSelectTrack = jest.fn();
  const { container } = render(
    <PlayerView
      videoRef={videoRef}
      videoFile={opts.videoFile ?? null}
      filename={opts.videoFile?.name ?? null}
      subtitles={opts.subtitles ?? { target: null, native: null, others: [] }}
      subtitleStatus={opts.subtitleStatus ?? 'idle'}
      library={opts.library ?? []}
      librarySort="recent"
      targetStyle={baseStyle}
      nativeStyle={baseStyle}
      onOpenFile={onOpenFile}
      onOpenFolder={onOpenFolder}
      onOpenSubtitle={onOpenSubtitle}
      onSelectTrack={onSelectTrack}
      onFilesDrop={onFilesDrop}
      onVideoSelect={onVideoSelect}
      onSortChange={onSortChange}
      currentVideoId={null}
      subtitleEngine={mockSubtitleEngine}
      manager={mockManager}
      subtitleActions={mockSubtitleActions}
      subtitlesLibrary={[]}
      onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
    />,
  ) as unknown as { container: HTMLElement };
  return { mocks: { onOpenFile, onFilesDrop, onVideoSelect, onSortChange, onOpenSubtitle, onOpenFolder }, container };
}

describe('PlayerView', () => {
  const mockedUseLocalVideo = useLocalVideo as unknown as jest.Mock;

  beforeEach(() => {
    mockedUseLocalVideo.mockClear();
  });

  it('renders the PlayerControls at the bottom', () => {
    renderPlayerView({ videoFile: new File([], 'movie.mp4', { type: 'video/mp4' }) });
    expect(screen.getByTestId('player-controls')).toBeInTheDocument();
  });

  it('renders the EmptyState when no video is loaded (videoFile=null)', () => {
    const { container } = render(
      <PlayerView
        videoRef={createRef<HTMLVideoElement>()}
        videoFile={null}
        filename={null}
        subtitleStatus="idle"
        library={[]}
        librarySort="recent"
        targetStyle={baseStyle}
        nativeStyle={baseStyle}
        onOpenFile={jest.fn()}
        onOpenFolder={jest.fn()}
        onFilesDrop={jest.fn()}
        onVideoSelect={jest.fn()}
        onSortChange={jest.fn()}
        currentVideoId={null}
        onOpenSubtitle={jest.fn()}
        onSelectTrack={jest.fn()}
        subtitles={{ target: null, native: null, others: [] }}
        subtitleEngine={mockSubtitleEngine}
      manager={mockManager}
      subtitleActions={mockSubtitleActions}
      subtitlesLibrary={[]}
      onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
      />,
    ) as unknown as { container: HTMLElement };
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
  });

  it('renders a <video> element when a video is loaded (videoFile != null)', () => {
    const { container } = render(
      <PlayerView
        videoRef={createRef<HTMLVideoElement>()}
        videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
        filename="movie.mp4"
        subtitleStatus="idle"
        library={[]}
        librarySort="recent"
        targetStyle={baseStyle}
        nativeStyle={baseStyle}
        onOpenFile={jest.fn()}
        onOpenFolder={jest.fn()}
        onFilesDrop={jest.fn()}
        onVideoSelect={jest.fn()}
        onSortChange={jest.fn()}
        currentVideoId={null}
        onOpenSubtitle={jest.fn()}
        onSelectTrack={jest.fn()}
        subtitles={{ target: null, native: null, others: [] }}
        subtitleEngine={mockSubtitleEngine}
      manager={mockManager}
      subtitleActions={mockSubtitleActions}
      subtitlesLibrary={[]}
      onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
      />,
    ) as unknown as { container: HTMLElement };
    expect(container.querySelector('video')).not.toBeNull();
  });

  it('does not render the EmptyState when a video is loaded', () => {
    render(
      <PlayerView
        videoRef={createRef<HTMLVideoElement>()}
        videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
        filename="movie.mp4"
        subtitleStatus="idle"
        library={[]}
        librarySort="recent"
        targetStyle={baseStyle}
        nativeStyle={baseStyle}
        onOpenFile={jest.fn()}
        onOpenFolder={jest.fn()}
        onFilesDrop={jest.fn()}
        onVideoSelect={jest.fn()}
        onSortChange={jest.fn()}
        currentVideoId={null}
        onOpenSubtitle={jest.fn()}
        onSelectTrack={jest.fn()}
        subtitles={{ target: null, native: null, others: [] }}
        subtitleEngine={mockSubtitleEngine}
      manager={mockManager}
      subtitleActions={mockSubtitleActions}
      subtitlesLibrary={[]}
      onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('renders the SubtitlePanels overlay when subtitles.target is loaded', () => {
    mockTargetCues = [{ index: 0, start: 0, end: 1000, text: 'Hello' }];
    mockSubtitleEngine.hasSubtitles = true;
    render(
      <PlayerView
        videoRef={createRef<HTMLVideoElement>()}
        videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
        filename="movie.mp4"
        subtitleStatus="loaded"
        library={[]}
        librarySort="recent"
        targetStyle={baseStyle}
        nativeStyle={baseStyle}
        onOpenFile={jest.fn()}
        onOpenFolder={jest.fn()}
        onFilesDrop={jest.fn()}
        onVideoSelect={jest.fn()}
        onSortChange={jest.fn()}
        currentVideoId={null}
        onOpenSubtitle={jest.fn()}
        onSelectTrack={jest.fn()}
        subtitles={{ target: null, native: null, others: [] }}
        subtitleEngine={mockSubtitleEngine}
      manager={mockManager}
      subtitleActions={mockSubtitleActions}
      subtitlesLibrary={[]}
      onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    expect(screen.getByTestId('subtitle-panels-root')).toBeInTheDocument();
    mockTargetCues = [];
    mockSubtitleEngine.hasSubtitles = false;
  });

  it('renders the SubtitlePanels overlay when a video is loaded (even without subtitles)', () => {
    render(
      <PlayerView
        videoRef={createRef<HTMLVideoElement>()}
        videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
        filename="movie.mp4"
        subtitleStatus="idle"
        library={[]}
        librarySort="recent"
        targetStyle={baseStyle}
        nativeStyle={baseStyle}
        onOpenFile={jest.fn()}
        onOpenFolder={jest.fn()}
        onFilesDrop={jest.fn()}
        onVideoSelect={jest.fn()}
        onSortChange={jest.fn()}
        currentVideoId={null}
        onOpenSubtitle={jest.fn()}
        onSelectTrack={jest.fn()}
        subtitles={{ target: null, native: null, others: [] }}
        subtitleEngine={mockSubtitleEngine}
      manager={mockManager}
      subtitleActions={mockSubtitleActions}
      subtitlesLibrary={[]}
      onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    // SubtitlePanels now renders whenever a video is loaded so the overlay
    // panel (split view, manager, tools) stays accessible even without subtitles.
    expect(screen.getByTestId('subtitle-panels-root')).toBeInTheDocument();
  });

  it('passes the video ref to useLocalVideo', () => {
    const videoRef = createRef<HTMLVideoElement>();
    render(
      <PlayerView
        videoRef={videoRef}
        videoFile={null}
        filename={null}
        subtitleStatus="idle"
        library={[]}
        librarySort="recent"
        targetStyle={baseStyle}
        nativeStyle={baseStyle}
        onOpenFile={jest.fn()}
        onOpenFolder={jest.fn()}
        onFilesDrop={jest.fn()}
        onVideoSelect={jest.fn()}
        onSortChange={jest.fn()}
        currentVideoId={null}
        onOpenSubtitle={jest.fn()}
        onSelectTrack={jest.fn()}
        subtitles={{ target: null, native: null, others: [] }}
        subtitleEngine={mockSubtitleEngine}
      manager={mockManager}
      subtitleActions={mockSubtitleActions}
      subtitlesLibrary={[]}
      onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    expect(mockedUseLocalVideo).toHaveBeenCalled();
    expect(mockedUseLocalVideo.mock.calls[0][0]).toBe(videoRef);
  });

  it('wires onOpenFile from EmptyState', () => {
    const { mocks } = renderPlayerView({ videoFile: null });
    fireEvent.click(screen.getByTestId('empty-open-file'));
    expect(mocks.onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('wires onFilesDrop when a file is dropped on the video stage (no video loaded)', () => {
    const { mocks, container } = renderPlayerViewWithContainer({ videoFile: null });
    const stage = container.querySelector('[data-cell-id="video-stage"]') as HTMLElement;
    const videoFile = new File(['dummy'], 'movie.mp4', { type: 'video/mp4' });
    fireEvent.drop(stage, { dataTransfer: { files: [videoFile], types: ['Files'] } });
    expect(mocks.onFilesDrop).toHaveBeenCalledTimes(1);
    expect(mocks.onFilesDrop).toHaveBeenCalledWith([videoFile]);
  });

  it('wires onFilesDrop when a file is dropped while a video is playing', () => {
    // Drop works even with an active video — decoupled from playback state.
    const { mocks, container } = renderPlayerViewWithContainer({
      videoFile: new File([], 'movie.mp4', { type: 'video/mp4' }),
    });
    const stage = container.querySelector('[data-cell-id="video-stage"]') as HTMLElement;
    const subFile = new File(['sub'], 'movie.en.srt', { type: 'text/plain' });
    fireEvent.drop(stage, { dataTransfer: { files: [subFile], types: ['Files'] } });
    expect(mocks.onFilesDrop).toHaveBeenCalledTimes(1);
    expect(mocks.onFilesDrop).toHaveBeenCalledWith([subFile]);
  });

  it('renders DropOverlay while dragging a file over the stage', () => {
    const { container } = renderPlayerViewWithContainer({ videoFile: null });
    const stage = container.querySelector('[data-cell-id="video-stage"]') as HTMLElement;
    expect(container.querySelector('[data-cell-id="drop-overlay"]')).toBeNull();
    fireEvent.dragEnter(stage, { dataTransfer: { files: [], types: ['Files'] } });
    expect(container.querySelector('[data-cell-id="drop-overlay"]')).not.toBeNull();
  });

  it('removes DropOverlay after the file is dropped', () => {
    const { container } = renderPlayerViewWithContainer({ videoFile: null });
    const stage = container.querySelector('[data-cell-id="video-stage"]') as HTMLElement;
    fireEvent.dragEnter(stage, { dataTransfer: { files: [], types: ['Files'] } });
    expect(container.querySelector('[data-cell-id="drop-overlay"]')).not.toBeNull();
    fireEvent.drop(stage, {
      dataTransfer: { files: [new File([], 'x.mp4', { type: 'video/mp4' })], types: ['Files'] },
    });
    expect(container.querySelector('[data-cell-id="drop-overlay"]')).toBeNull();
  });

  // ─── Bug 1: click on the video toggles play/pause ──────────────────────
  describe('video click → play/pause toggle', () => {
    it('click on <video> calls pause() when isPlaying=true', () => {
      mockedUseLocalVideo.mockReturnValueOnce({
        isPlaying: true, currentTime: 0, duration: 120, volume: 1,
        muted: false, playbackRate: 1, play: jest.fn(), pause: jest.fn(),
        seek: jest.fn(), setVolume: jest.fn(), setPlaybackRate: jest.fn(),
        toggleMute: jest.fn(), toggleFullscreen: jest.fn(), togglePiP: jest.fn(),
      });
      const { container } = render(
        <PlayerView
          videoRef={createRef<HTMLVideoElement>()}
          videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
          filename="movie.mp4"
          subtitleStatus="idle"
          library={[]}
          librarySort="recent"
            targetStyle={baseStyle}
          nativeStyle={baseStyle}
          onOpenFile={jest.fn()}
          onOpenFolder={jest.fn()}
          onFilesDrop={jest.fn()}
            onVideoSelect={jest.fn()}
          onSortChange={jest.fn()}
        currentVideoId={null}
          onOpenSubtitle={jest.fn()}
          onSelectTrack={jest.fn()}
          subtitles={{ target: null, native: null, others: [] }}
          subtitleEngine={mockSubtitleEngine}
          manager={mockManager}
          subtitleActions={mockSubtitleActions}
        subtitlesLibrary={[]}
        onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
        />,
      ) as unknown as { container: HTMLElement };
      const video = container.querySelector('video');
      expect(video).not.toBeNull();
      fireEvent.click(video!);
      const controls = mockedUseLocalVideo.mock.results[0].value as {
        play: jest.Mock; pause: jest.Mock;
      };
      expect(controls.pause).toHaveBeenCalledTimes(1);
      expect(controls.play).not.toHaveBeenCalled();
    });

    it('click on <video> calls play() when isPlaying=false', () => {
      mockedUseLocalVideo.mockReturnValueOnce({
        isPlaying: false, currentTime: 0, duration: 120, volume: 1,
        muted: false, playbackRate: 1, play: jest.fn(), pause: jest.fn(),
        seek: jest.fn(), setVolume: jest.fn(), setPlaybackRate: jest.fn(),
        toggleMute: jest.fn(), toggleFullscreen: jest.fn(), togglePiP: jest.fn(),
      });
      const { container } = render(
        <PlayerView
          videoRef={createRef<HTMLVideoElement>()}
          videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
          filename="movie.mp4"
          subtitleStatus="idle"
          library={[]}
          librarySort="recent"
            targetStyle={baseStyle}
          nativeStyle={baseStyle}
          onOpenFile={jest.fn()}
          onOpenFolder={jest.fn()}
          onFilesDrop={jest.fn()}
            onVideoSelect={jest.fn()}
          onSortChange={jest.fn()}
        currentVideoId={null}
          onOpenSubtitle={jest.fn()}
          onSelectTrack={jest.fn()}
          subtitles={{ target: null, native: null, others: [] }}
          subtitleEngine={mockSubtitleEngine}
          manager={mockManager}
          subtitleActions={mockSubtitleActions}
        subtitlesLibrary={[]}
        onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
        />,
      ) as unknown as { container: HTMLElement };
      const video = container.querySelector('video');
      fireEvent.click(video!);
      const controls = mockedUseLocalVideo.mock.results[0].value as {
        play: jest.Mock; pause: jest.Mock;
      };
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.pause).not.toHaveBeenCalled();
    });
  });

  // ─── Bug 3: subtitle panel shortcuts fire on window keydown ────────────
  describe('subtitle shortcuts (window keydown)', () => {
    function fireWindowKey(key: string, shift = false, ctrl = false): void {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key, shiftKey: shift, ctrlKey: ctrl,
          bubbles: true, cancelable: true,
        }),
      );
    }

    beforeEach(() => {
      jest.clearAllMocks();
      mockSubtitleEngine.prev = jest.fn();
      mockSubtitleEngine.next = jest.fn();
      mockSubtitleEngine.repeat = jest.fn();
      mockSubtitleActions.onQuickAdd = jest.fn();
      mockSubtitleActions.onEditCard = jest.fn();
      mockSubtitleActions.onGenerateNative = jest.fn();
    });

    function renderWithVideo(): { container: HTMLElement } {
      const result = render(
        <PlayerView
          videoRef={createRef<HTMLVideoElement>()}
          videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
          filename="movie.mp4"
          subtitleStatus="loaded"
          library={[]}
          librarySort="recent"
            targetStyle={baseStyle}
          nativeStyle={baseStyle}
          onOpenFile={jest.fn()}
          onOpenFolder={jest.fn()}
          onFilesDrop={jest.fn()}
            onVideoSelect={jest.fn()}
          onSortChange={jest.fn()}
        currentVideoId={null}
          onOpenSubtitle={jest.fn()}
          onSelectTrack={jest.fn()}
          subtitles={{ target: null, native: null, others: [] }}
          subtitleEngine={mockSubtitleEngine}
          manager={mockManager}
          subtitleActions={mockSubtitleActions}
        subtitlesLibrary={[]}
        onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
        />,
      ) as unknown as { container: HTMLElement };
      return result;
    }

    it("'a' fires subtitleEngine.prev (prev-cue)", () => {
      renderWithVideo();
      act(() => fireWindowKey('a'));
      expect(mockSubtitleEngine.prev).toHaveBeenCalledTimes(1);
    });

    it("'d' fires subtitleEngine.next (next-cue)", () => {
      renderWithVideo();
      act(() => fireWindowKey('d'));
      expect(mockSubtitleEngine.next).toHaveBeenCalledTimes(1);
    });

    it("'s' fires subtitleEngine.repeat (replay-cue)", () => {
      renderWithVideo();
      act(() => fireWindowKey('s'));
      expect(mockSubtitleEngine.repeat).toHaveBeenCalledTimes(1);
    });

    it("'q' fires subtitleActions.onQuickAdd (quick-update)", () => {
      renderWithVideo();
      act(() => fireWindowKey('q'));
      expect(mockSubtitleActions.onQuickAdd).toHaveBeenCalledTimes(1);
    });

    it("'e' fires subtitleActions.onEditCard (edit-card)", () => {
      renderWithVideo();
      act(() => fireWindowKey('e'));
      expect(mockSubtitleActions.onEditCard).toHaveBeenCalledTimes(1);
    });

    it("'h' fires subtitleActions.onGenerateNative (generate-native)", () => {
      renderWithVideo();
      act(() => fireWindowKey('h'));
      expect(mockSubtitleActions.onGenerateNative).toHaveBeenCalledTimes(1);
    });

    it("'a' inside an <input> does NOT fire prev-cue (editable guard)", () => {
      const { container } = renderWithVideo();
      const input = document.createElement('input');
      container.appendChild(input);
      input.focus();
      act(() => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a', bubbles: true, cancelable: true,
          }),
        );
      });
      expect(mockSubtitleEngine.prev).not.toHaveBeenCalled();
    });

    it("Space does NOT double-fire (useLocalVideo handles, PlayerView skips play-pause)", () => {
      renderWithVideo();
      act(() => fireWindowKey(' '));
      // subtitleEngine.playPause is NOT in the dispatch switch — PlayerView
      // skips 'play-pause' action. useLocalVideo handles Space separately.
      expect(mockSubtitleEngine.playPause).not.toHaveBeenCalled();
    });
  });

  // ─── Play/pause center flash overlay ───────────────────────────────────
  describe('play/pause flash overlay', () => {
    it('renders PlayPauseOverlay after isPlaying changes', () => {
      let controls: { isPlaying: boolean } = { isPlaying: false };
      mockedUseLocalVideo.mockImplementation(() => {
        controls = { isPlaying: false };
        return {
          ...controls, currentTime: 0, duration: 120, volume: 1,
          muted: false, playbackRate: 1, play: jest.fn(), pause: jest.fn(),
          seek: jest.fn(), setVolume: jest.fn(), setPlaybackRate: jest.fn(),
          toggleMute: jest.fn(), toggleFullscreen: jest.fn(), togglePiP: jest.fn(),
          get isPlaying() { return controls.isPlaying; },
        } as unknown as ReturnType<typeof useLocalVideo>;
      });
      const { rerender } = render(
        <PlayerView
          videoRef={createRef<HTMLVideoElement>()}
          videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
          filename="movie.mp4"
          subtitleStatus="idle"
          library={[]}
          librarySort="recent"
            targetStyle={baseStyle}
          nativeStyle={baseStyle}
          onOpenFile={jest.fn()}
          onOpenFolder={jest.fn()}
          onFilesDrop={jest.fn()}
            onVideoSelect={jest.fn()}
          onSortChange={jest.fn()}
        currentVideoId={null}
          onOpenSubtitle={jest.fn()}
          onSelectTrack={jest.fn()}
          subtitles={{ target: null, native: null, others: [] }}
          subtitleEngine={mockSubtitleEngine}
          manager={mockManager}
          subtitleActions={mockSubtitleActions}
        subtitlesLibrary={[]}
        onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
        />,
      );
      expect(screen.queryByTestId('play-pause-flash')).not.toBeInTheDocument();
      // Simulate isPlaying change → effect fires → overlay renders.
      mockedUseLocalVideo.mockImplementation(() => ({
        ...controls, isPlaying: true, currentTime: 0, duration: 120, volume: 1,
        muted: false, playbackRate: 1, play: jest.fn(), pause: jest.fn(),
        seek: jest.fn(), setVolume: jest.fn(), setPlaybackRate: jest.fn(),
        toggleMute: jest.fn(), toggleFullscreen: jest.fn(), togglePiP: jest.fn(),
      }) as unknown as ReturnType<typeof useLocalVideo>);
      act(() => {
        rerender(
          <PlayerView
            videoRef={createRef<HTMLVideoElement>()}
            videoFile={new File([], 'movie.mp4', { type: 'video/mp4' })}
            filename="movie.mp4"
            subtitleStatus="idle"
            library={[]}
            librarySort="recent"
                targetStyle={baseStyle}
            nativeStyle={baseStyle}
            onOpenFile={jest.fn()}
            onOpenFolder={jest.fn()}
            onFilesDrop={jest.fn()}
                onVideoSelect={jest.fn()}
            onSortChange={jest.fn()}
        currentVideoId={null}
            onOpenSubtitle={jest.fn()}
            onSelectTrack={jest.fn()}
            subtitles={{ target: null, native: null, others: [] }}
            subtitleEngine={mockSubtitleEngine}
            manager={mockManager}
            subtitleActions={mockSubtitleActions}
            subtitlesLibrary={[]}
            onSubtitleSelect={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
          />,
        );
      });
      expect(screen.getByTestId('play-pause-flash')).toBeInTheDocument();
    });
  });
});
