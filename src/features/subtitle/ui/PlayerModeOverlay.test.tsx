import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerModeOverlay } from './PlayerModeOverlay';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { BilingualCue } from '@/entities/media';

jest.mock('./SubtitleBlock', () => ({
  SubtitleBlock: () => <div data-cell-id="subtitle-block" />,
}));

jest.mock('./NavCluster', () => ({
  NavCluster: () => <div data-cell-id="nav-cluster" />,
}));

jest.mock('./CueList', () => ({
  CueList: () => <div data-cell-id="cue-list" />,
}));

// Mock chrome.storage.local for contentPct persistence.
const storageData: Record<string, unknown> = {};
beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: ((keys?: string | string[] | null) =>
          Promise.resolve(
            keys == null
              ? { ...storageData }
              : (Array.isArray(keys) ? keys : [keys]).reduce<Record<string, unknown>>((acc, k) => {
                  if (k in storageData) acc[k] = storageData[k];
                  return acc;
                }, {}),
          )) as unknown as typeof chrome.storage.local.get,
        set: ((items: Record<string, unknown>) => {
          Object.assign(storageData, items);
          return Promise.resolve();
        }) as unknown as typeof chrome.storage.local.set,
      },
      onChanged: {
        addListener: (cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
          storageChangedListeners.add(cb);
        },
        removeListener: (cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
          storageChangedListeners.delete(cb);
        },
      },
    },
  } as unknown as typeof chrome;
});
const storageChangedListeners = new Set<
  (changes: Record<string, { newValue?: unknown }>, area: string) => void
>();
function fireStorageChanged(changes: Record<string, { newValue?: unknown }>): void {
  for (const cb of storageChangedListeners) cb(changes, 'local');
}
beforeEach(() => {
  for (const k of Object.keys(storageData)) delete storageData[k];
});

const style: OverlayStyleConfig = {
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

const noop = (): void => undefined;

function renderPlayerMode(): HTMLElement {
  render(
    <PlayerModeOverlay
      targetStyle={style}
      nativeStyle={style}
      isPlaying
      repeatActive={false}
      videoAspectRatio={16 / 9}
      generateNativeEnabled
      toolsExpanded={false}
      onQuickAdd={noop}
      onEditCard={noop}
      onToggleOcr={noop}
      onGenerateNative={noop}
      onToggleSidePanel={noop}
      onToggleManager={noop}
      onToggleTools={noop}
      onPrev={noop}
      onNext={noop}
      onRepeat={noop}
      onRewind={noop}
      onForward={noop}
      onPlayPause={noop}
      onToggleCollapsed={noop}
      onExit={noop}
    />,
  );
  return screen.getByTestId('overlay-player-action');
}

const sampleCues: BilingualCue[] = [
  { index: 1, start: 0, end: 1000, targetText: 'Hello', nativeText: 'Xin chào' },
];

function renderPlayerModeWithCues(cues?: BilingualCue[]): HTMLElement {
  render(
    <PlayerModeOverlay
      targetStyle={style}
      nativeStyle={style}
      isPlaying
      repeatActive={false}
      videoAspectRatio={16 / 9}
      generateNativeEnabled
      toolsExpanded={false}
      onQuickAdd={noop}
      onEditCard={noop}
      onToggleOcr={noop}
      onGenerateNative={noop}
      onToggleSidePanel={noop}
      onToggleManager={noop}
      onToggleTools={noop}
      onPrev={noop}
      onNext={noop}
      onRepeat={noop}
      onRewind={noop}
      onForward={noop}
      onPlayPause={noop}
      onToggleCollapsed={noop}
      onExit={noop}
      cues={cues}
      currentTimeMs={0}
      offsetMs={0}
      onSeek={cues ? noop : undefined}
    />,
  );
  return screen.getByTestId('overlay-player-action');
}

describe('PlayerModeOverlay', () => {
  it('keeps subtitle, NavCluster, and action cluster inside PlayerActionDock', () => {
    const dock = renderPlayerMode();

    expect(dock).toContainElement(screen.getByTestId('subtitle-block'));
    expect(dock).toContainElement(screen.getByTestId('nav-cluster'));
    expect(dock).toContainElement(screen.getByTestId('player-mode-actions'));
    expect(dock).toContainElement(screen.getByTestId('generate-native-btn'));
  });

  it('shows CueList in contentOther by default when cues are provided', () => {
    renderPlayerModeWithCues(sampleCues);

    const content = screen.getByTestId('player-mode-content');
    expect(content).toContainElement(screen.getByTestId('cue-list'));
  });

  it('does not render CueList when no cues are provided', () => {
    renderPlayerModeWithCues(undefined);

    expect(screen.queryByTestId('cue-list')).not.toBeInTheDocument();
  });

  it('shows an empty state instead of a blank panel when cues are empty', () => {
    renderPlayerModeWithCues([]);

    expect(screen.queryByTestId('cue-list')).not.toBeInTheDocument();
    expect(screen.getByText('No subtitles loaded')).toBeInTheDocument();
  });

  it('toggles CueList with the T key', () => {
    renderPlayerModeWithCues(sampleCues);

    expect(screen.getByTestId('cue-list')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 't' });
    expect(screen.queryByTestId('cue-list')).not.toBeInTheDocument();
  });

  it('persists contentPct to chrome.storage.local after resize drag ends', async () => {
    storageData[STORAGE_KEYS.PLAYER_MODE_CONTENT_PCT] = 45;

    renderPlayerModeWithCues(sampleCues);

    // Wait for the async load effect to apply the persisted value to the DOM
    // (contentOther uses --content-pct CSS var).
    const content = screen.getByTestId('player-mode-content');
    await waitFor(() => {
      expect((content.style.getPropertyValue('--content-pct') || '').trim()).toBe('45%');
    });

    // Stub the split container's rect so drag math has a non-zero splitWidth.
    const split = screen.getByTestId('player-mode-split');
    const rectStub = { width: 1000, height: 600, left: 0, top: 0, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => '' };
    Object.defineProperty(split, 'getBoundingClientRect', { value: () => rectStub, configurable: true });

    const handle = screen.getByRole('separator');
    // jsdom doesn't implement pointer capture — stub on the prototype.
    const proto = Object.getPrototypeOf(handle);
    if (typeof proto.setPointerCapture !== 'function') {
      Object.defineProperty(proto, 'setPointerCapture', { value: () => undefined, configurable: true });
      Object.defineProperty(proto, 'releasePointerCapture', { value: () => undefined, configurable: true });
    }

    // jsdom PointerEvent doesn't propagate clientX — create events manually.
    const firePointer = (type: string, clientX: number): void => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'clientX', { value: clientX });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      fireEvent(handle, event);
    };
    firePointer('pointerdown', 500);
    firePointer('pointermove', 400);
    firePointer('pointerup', 400);

    // startPct=45, deltaPx=-100, splitWidth=1000 → deltaPct=+10 → next=55.
    await waitFor(() => {
      expect(storageData[STORAGE_KEYS.PLAYER_MODE_CONTENT_PCT]).toBe(55);
    });
  });

  it('hides the dock to a floating restore button and restores on click', async () => {
    renderPlayerModeWithCues(sampleCues);

    fireEvent.click(screen.getByTestId('dock-hide-btn'));

    expect(screen.queryByTestId('overlay-player-action')).toBeNull();
    expect(screen.getByTestId('pm-dock-restore')).toBeInTheDocument();
    // Hidden dock still floats nav/subtitle/tools over the video stage.
    const float = screen.getByTestId('pm-dock-float');
    expect(float).toContainElement(screen.getByTestId('subtitle-block'));
    expect(float).toContainElement(screen.getByTestId('nav-cluster'));
    expect(float).toContainElement(screen.getByTestId('player-mode-actions'));
    // Cue list survives the hidden dock.
    expect(screen.getByTestId('cue-list')).toBeInTheDocument();
    expect(storageData[STORAGE_KEYS.PLAYER_MODE_DOCK_PLACEMENT]).toBe('hidden');

    fireEvent.click(screen.getByTestId('pm-dock-restore'));
    await waitFor(() => {
      expect(screen.getByTestId('overlay-player-action')).toBeInTheDocument();
    });
    expect(storageData[STORAGE_KEYS.PLAYER_MODE_DOCK_PLACEMENT]).toBe('bottom');
  });

  it('honours a persisted hidden dock on mount', async () => {
    storageData[STORAGE_KEYS.PLAYER_MODE_DOCK_PLACEMENT] = 'hidden';
    renderPlayerModeWithCues(sampleCues);

    await waitFor(() => {
      expect(screen.getByTestId('pm-dock-restore')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('overlay-player-action')).toBeNull();
  });

  it('lets the cue list close itself while the dock is hidden', async () => {
    renderPlayerModeWithCues(sampleCues);

    fireEvent.click(screen.getByTestId('dock-hide-btn'));
    expect(screen.queryByTestId('overlay-player-action')).toBeNull();

    fireEvent.click(screen.getByTestId('subtitle-panel-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('cue-list')).not.toBeInTheDocument();
    });
  });
});

describe('mobile layout (<600px)', () => {
  const origW = window.innerWidth;
  const origH = window.innerHeight;

  function renderMobile(cues?: BilingualCue[]): void {
    render(
      <PlayerModeOverlay
        targetStyle={style}
        nativeStyle={style}
        isPlaying
        repeatActive={false}
        videoAspectRatio={16 / 9}
        generateNativeEnabled
        toolsExpanded={false}
        onQuickAdd={noop}
        onEditCard={noop}
        onToggleOcr={noop}
        onGenerateNative={noop}
        onToggleSidePanel={noop}
        onToggleManager={noop}
        onToggleTools={noop}
        onPrev={noop}
        onNext={noop}
        onRepeat={noop}
        onRewind={noop}
        onForward={noop}
        onPlayPause={noop}
        onToggleCollapsed={noop}
        onExit={noop}
        cues={cues}
        currentTimeMs={0}
        offsetMs={0}
        onSeek={cues ? noop : undefined}

        activeModeId="normal"
        onStudyModeChange={noop}
        practiceMode="off"
        onPracticeModeChange={noop}
        playbackSpeed={1}
        onPlaybackSpeedChange={noop}
      />,
    );
  }

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: origW, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: origH, configurable: true });
  });

  it('renders the mobile stack instead of the desktop dock', () => {
    renderMobile(sampleCues);
    expect(screen.getByTestId('pm-bottom-bar')).toBeInTheDocument();
    expect(screen.getByTestId('pm-cue-region')).toBeInTheDocument();
    expect(screen.getByTestId('pm-anchor-band')).toBeInTheDocument();
    expect(screen.getByTestId('pm-anchor-row')).toBeInTheDocument();
    expect(screen.queryByTestId('pm-caption')).toBeNull();
    expect(screen.getByTestId('cue-list')).toBeInTheDocument();
    expect(screen.queryByTestId('overlay-player-action')).toBeNull();
    expect(screen.getByTestId('player-mode-content')).toBeInTheDocument();
    expect(screen.queryByTestId('subtitle-block')).toBeNull();
    expect(document.documentElement.getAttribute('data-cell-player-mode-mobile')).toBe('true');
  });

  it('removes the mobile attribute on unmount', () => {
    const { unmount } = render(
      <PlayerModeOverlay
        targetStyle={style}
        nativeStyle={style}
        isPlaying
        repeatActive={false}
        videoAspectRatio={16 / 9}
        generateNativeEnabled
        toolsExpanded={false}
        onQuickAdd={noop}
        onEditCard={noop}
        onToggleOcr={noop}
        onGenerateNative={noop}
        onToggleSidePanel={noop}
        onToggleManager={noop}
        onToggleTools={noop}
        onPrev={noop}
        onNext={noop}
        onRepeat={noop}
        onRewind={noop}
        onForward={noop}
        onPlayPause={noop}
        onToggleCollapsed={noop}
        onExit={noop}
      />,
    );
    expect(document.documentElement.getAttribute('data-cell-player-mode-mobile')).toBe('true');
    unmount();
    expect(document.documentElement.getAttribute('data-cell-player-mode-mobile')).toBeNull();
  });

  it('shows prev/next with cues, rewind/forward without', () => {
    renderMobile(sampleCues);
    expect(screen.getByTestId('nav-prev')).toBeInTheDocument();
    expect(screen.getByTestId('nav-next')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-rewind')).toBeNull();
    expect(screen.queryByTestId('nav-forward')).toBeNull();
  });

  it('shows rewind/forward without cues', () => {
    renderMobile();
    expect(screen.getByTestId('nav-rewind')).toBeInTheDocument();
    expect(screen.getByTestId('nav-forward')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-prev')).toBeNull();
    expect(screen.queryByTestId('nav-next')).toBeNull();
  });

  it('renders the action rail with generate-native and the fab slot', () => {
    renderMobile(sampleCues);
    const rail = screen.getByTestId('player-mode-actions');
    expect(rail).toContainElement(screen.getByTestId('pm-fab-slot'));
    expect(rail).toContainElement(screen.getByTestId('generate-native-btn'));
    expect(screen.getByTestId('manager-toggle-btn')).toBeInTheDocument();
  });

  it('overflow menu lists cue-toggle/ocr/study/speed and no nav duplicates', () => {
    renderMobile(sampleCues);
    fireEvent.click(screen.getByTestId('pm-more-btn'));
    const menu = screen.getByTestId('pm-more-menu');
    expect(menu).toContainElement(screen.getByTestId('panel-toggle-btn'));
    expect(menu).toContainElement(screen.getByTestId('ocr-toggle-btn'));
    expect(menu).toContainElement(screen.getByTestId('study-mode-normal'));
    expect(menu).toContainElement(screen.getByTestId('pm-speed-stepper'));
    expect(screen.getByTestId('pm-speed-value')).toHaveTextContent('1×');
    expect(menu.querySelector('[data-cell-id="pm-practice-off"]')).toBeNull();
    for (const id of ['nav-prev', 'nav-next', 'nav-rewind', 'nav-forward', 'nav-repeat', 'nav-play']) {
      expect(menu.querySelector(`[data-cell-id="${id}"]`)).toBeNull();
    }
  });

  it('speed chip opens the sheet and the stepper walks the playback speeds', () => {
    const onPlaybackSpeedChange = jest.fn();
    render(
      <PlayerModeOverlay
        targetStyle={style}
        nativeStyle={style}
        isPlaying
        repeatActive={false}
        videoAspectRatio={16 / 9}
        generateNativeEnabled
        toolsExpanded={false}
        onQuickAdd={noop}
        onEditCard={noop}
        onToggleOcr={noop}
        onGenerateNative={noop}
        onToggleSidePanel={noop}
        onToggleManager={noop}
        onToggleTools={noop}
        onPrev={noop}
        onNext={noop}
        onRepeat={noop}
        onRewind={noop}
        onForward={noop}
        onPlayPause={noop}
        onToggleCollapsed={noop}
        onExit={noop}
        cues={sampleCues}
        currentTimeMs={0}
        offsetMs={0}
        onSeek={noop}
        playbackSpeed={2}
        onPlaybackSpeedChange={onPlaybackSpeedChange}
      />,
    );

    expect(screen.queryByTestId('pm-more-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('pm-more-btn'));
    expect(screen.getByTestId('pm-more-menu')).toBeInTheDocument();
    expect(screen.getByTestId('pm-speed-value')).toHaveTextContent('2×');

    fireEvent.click(screen.getByTestId('pm-speed-inc'));
    expect(onPlaybackSpeedChange).toHaveBeenCalledWith(2.5);
    fireEvent.click(screen.getByTestId('pm-speed-dec'));
    expect(onPlaybackSpeedChange).toHaveBeenCalledWith(1.5);
  });

  it('closes the menu before exiting on Escape', () => {
    const onExit = jest.fn();
    render(
      <PlayerModeOverlay
        targetStyle={style}
        nativeStyle={style}
        isPlaying
        repeatActive={false}
        videoAspectRatio={16 / 9}
        generateNativeEnabled
        toolsExpanded={false}
        onQuickAdd={noop}
        onEditCard={noop}
        onToggleOcr={noop}
        onGenerateNative={noop}
        onToggleSidePanel={noop}
        onToggleManager={noop}
        onToggleTools={noop}
        onPrev={noop}
        onNext={noop}
        onRepeat={noop}
        onRewind={noop}
        onForward={noop}
        onPlayPause={noop}
        onToggleCollapsed={noop}
        onExit={onExit}
        cues={sampleCues}
      />,
    );
    fireEvent.click(screen.getByTestId('pm-more-btn'));
    expect(screen.getByTestId('pm-more-menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('pm-more-menu')).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('live-updates cue display mode from storage', async () => {
    storageData[STORAGE_KEYS.PLAYER_MODE_CUE_DISPLAY] = 'list';
    renderMobile(sampleCues);
    fireEvent.click(screen.getByTestId('pm-more-btn'));
    expect(screen.queryByTestId('pm-show-all-cues')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('pm-more-menu')).toBeNull());

    fireStorageChanged({ [STORAGE_KEYS.PLAYER_MODE_CUE_DISPLAY]: { newValue: 'active' } });
    fireEvent.click(screen.getByTestId('pm-more-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('pm-show-all-cues')).toBeInTheDocument();
    });
  });
});
