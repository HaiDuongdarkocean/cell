import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerModeOverlay } from './PlayerModeOverlay';
import type { PlayerModeOverlayProps } from './PlayerModeOverlay';
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

type HarnessProps = Omit<PlayerModeOverlayProps, 'cueListOpen' | 'onCueListOpenChange'>;

function PlayerModeHarness(props: HarnessProps): React.JSX.Element {
  const [cueListOpen, setCueListOpen] = useState(true);
  return <PlayerModeOverlay {...props} cueListOpen={cueListOpen} onCueListOpenChange={setCueListOpen} />;
}

const splitViewPanel = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-cell-split-view="panel"]');

function renderPlayerMode(): HTMLElement {
  render(
    <PlayerModeHarness
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
  return screen.getByTestId('pm-subtitle-overlay');
}

const sampleCues: BilingualCue[] = [
  { index: 1, start: 0, end: 1000, targetText: 'Hello', nativeText: 'Xin chào' },
];

function renderPlayerModeWithCues(cues?: BilingualCue[]): HTMLElement {
  render(
    <PlayerModeHarness
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
  return screen.getByTestId('pm-subtitle-overlay');
}

describe('PlayerModeOverlay', () => {
  it('renders the shared overlay row (nav | subtitle | actions) over the video stage', () => {
    const overlay = renderPlayerMode();

    expect(overlay).toContainElement(screen.getByTestId('subtitle-block'));
    expect(overlay).toContainElement(screen.getByTestId('nav-cluster'));
    expect(overlay).toContainElement(screen.getByTestId('player-mode-actions'));
    expect(overlay).toContainElement(screen.getByTestId('generate-native-btn'));
    expect(screen.queryByTestId('overlay-player-action')).toBeNull();
    expect(screen.queryByTestId('pm-dock-restore')).toBeNull();
  });

  it('shows CueList in the shared split-view panel when cues are provided', () => {
    renderPlayerModeWithCues(sampleCues);

    const panel = splitViewPanel();
    expect(panel).not.toBeNull();
    expect(panel).toContainElement(screen.getByTestId('cue-list'));
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

  it('closing the panel removes the container and handle — no leftover gap', () => {
    renderPlayerModeWithCues(sampleCues);

    expect(splitViewPanel()).not.toBeNull();
    expect(document.querySelector('[data-cell-split-view="handle"]')).not.toBeNull();

    fireEvent.keyDown(window, { key: 't' });

    expect(splitViewPanel()).toBeNull();
    expect(document.querySelector('[data-cell-split-view="handle"]')).toBeNull();
    expect(document.querySelector('[data-cell-split-view="wrapper"]')).not.toBeNull();
    expect(document.querySelector('[data-cell-split-view="stage"]')).not.toBeNull();

    fireEvent.keyDown(window, { key: 't' });

    expect(splitViewPanel()).not.toBeNull();
  });

  it('persists contentPct to chrome.storage.local after resize drag ends', async () => {
    storageData[STORAGE_KEYS.PLAYER_MODE_CONTENT_PCT] = 45;

    renderPlayerModeWithCues(sampleCues);

    // Wait for the async load effect to apply the persisted value to the DOM
    // (contentOther uses --content-pct CSS var).
    const content = splitViewPanel();
    expect(content).not.toBeNull();
    await waitFor(() => {
      expect((content!.style.getPropertyValue('--content-pct') || '').trim()).toBe('45%');
    });

    // Stub the split container's rect so drag math has a non-zero splitWidth.
    const split = document.querySelector<HTMLElement>('[data-cell-split-view="wrapper"]');
    expect(split).not.toBeNull();
    const rectStub = { width: 1000, height: 600, left: 0, top: 0, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => '' };
    Object.defineProperty(split!, 'getBoundingClientRect', { value: () => rectStub, configurable: true });

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

  it('lets the cue list close itself while the subtitle overlay stays up', async () => {
    renderPlayerModeWithCues(sampleCues);

    fireEvent.click(screen.getByTestId('subtitle-panel-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('cue-list')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('pm-subtitle-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-block')).toBeInTheDocument();
  });
});

describe('mobile layout (<600px)', () => {
  const origW = window.innerWidth;
  const origH = window.innerHeight;

  function renderMobile(cues?: BilingualCue[]): void {
    render(
      <PlayerModeHarness
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
    expect(screen.queryByTestId('pm-subtitle-overlay')).toBeNull();
    expect(splitViewPanel()).not.toBeNull();
    expect(screen.queryByTestId('subtitle-block')).toBeNull();
    expect(document.documentElement.getAttribute('data-cell-player-mode-mobile')).toBe('true');
  });

  it('mounts the cue region as a resizable sheet — pill tap collapses and re-expands', () => {
    renderMobile(sampleCues);
    const sheet = screen.getByTestId('pm-cue-sheet');
    const pill = screen.getByTestId('card-creator-sheet-pill');
    expect(sheet).toHaveAttribute('data-snap', 'full');
    const tap = (): void => {
      const down = new MouseEvent('pointerdown', { bubbles: true });
      const up = new MouseEvent('pointerup', { bubbles: true });
      Object.assign(down, { pointerId: 1, pointerType: 'mouse' });
      Object.assign(up, { pointerId: 1, pointerType: 'mouse' });
      fireEvent(pill, down);
      fireEvent(pill, up);
    };
    tap();
    expect(sheet).toHaveAttribute('data-snap', 'collapsed');
    expect(splitViewPanel()!.className).toContain('pmCueWrapCollapsed');
    tap();
    expect(sheet).toHaveAttribute('data-snap', 'full');
    expect(splitViewPanel()!.className).not.toContain('pmCueWrapCollapsed');
  });

  it('removes the mobile attribute on unmount', () => {
    const { unmount } = render(
      <PlayerModeHarness
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
      <PlayerModeHarness
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
      <PlayerModeHarness
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
