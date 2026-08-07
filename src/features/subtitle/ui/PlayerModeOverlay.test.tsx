import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerModeOverlay } from './PlayerModeOverlay';
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
      hasSubtitle
      isPlaying
      repeatActive={false}
      videoAspectRatio={16 / 9}
      generateNativeEnabled
      toolsExpanded={false}
      onQuickAdd={noop}
      onEditCard={noop}
      onUpdateCurrentCard={noop}
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
      hasSubtitle
      isPlaying
      repeatActive={false}
      videoAspectRatio={16 / 9}
      generateNativeEnabled
      toolsExpanded={false}
      onQuickAdd={noop}
      onEditCard={noop}
      onUpdateCurrentCard={noop}
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
});
