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

jest.mock('@/entrypoints/sidepanel/components/CueList', () => ({
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
    },
  } as unknown as typeof chrome;
});
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
});
