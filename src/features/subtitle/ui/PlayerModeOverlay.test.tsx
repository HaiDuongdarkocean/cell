import { render, screen } from '@testing-library/react';
import { PlayerModeOverlay } from './PlayerModeOverlay';
import type { OverlayStyleConfig } from '@/entities/subtitle';

jest.mock('./SubtitleBlock', () => ({
  SubtitleBlock: () => <div data-cell-id="subtitle-block" />,
}));

jest.mock('./NavCluster', () => ({
  NavCluster: () => <div data-cell-id="nav-cluster" />,
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

describe('PlayerModeOverlay', () => {
  it('keeps subtitle, NavCluster, and action cluster inside PlayerActionDock', () => {
    const dock = renderPlayerMode();

    expect(dock).toContainElement(screen.getByTestId('subtitle-block'));
    expect(dock).toContainElement(screen.getByTestId('nav-cluster'));
    expect(dock).toContainElement(screen.getByTestId('player-mode-actions'));
    expect(dock).toContainElement(screen.getByTestId('generate-native-btn'));
  });
});
