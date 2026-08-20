import { render, screen, fireEvent } from '@testing-library/react';
import { ClusterRightToolbar } from './ClusterRightToolbar';

const overlayHandlers = {
  onQuickAdd: jest.fn(),
  onEditCard: jest.fn(),
  onUpdateCurrentCard: jest.fn(),
  onToggleManager: jest.fn(),
  onGenerateNative: jest.fn(),
  onToggleSidePanel: jest.fn(),
  onToggleTools: jest.fn(),
  onTogglePlayerMode: jest.fn(),
};

const playerHandlers = {
  onQuickAdd: jest.fn(),
  onEditCard: jest.fn(),
  onUpdateCurrentCard: jest.fn(),
  onToggleManager: jest.fn(),
  onGenerateNative: jest.fn(),
  onToggleSidePanel: jest.fn(),
  onToggleTools: jest.fn(),
  onExit: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ClusterRightToolbar', () => {
  it('renders overlay mode with all common buttons + player-mode toggle', () => {
    render(
      <ClusterRightToolbar
        mode="overlay"
        sidePanelLabel="Open subtitle list"
        toolsExpanded={false}
        generateNativeEnabled
        {...overlayHandlers}
      />,
    );
    expect(screen.getByTestId('nav-cluster-right')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-btn')).toBeInTheDocument();
    expect(screen.getByTestId('edit-card-btn')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-tools-extra')).toBeInTheDocument();
    expect(screen.getByTestId('panel-toggle-btn')).toBeInTheDocument();
    expect(screen.getByTestId('generate-native-btn')).toBeInTheDocument();
    expect(screen.getByTestId('tools-toggle-btn')).toBeInTheDocument();
    expect(screen.getByTestId('update-current-card-btn')).toBeInTheDocument();
    expect(screen.getByTestId('manager-toggle-btn')).toBeInTheDocument();
    expect(screen.getByTestId('player-mode-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('player-mode-exit-btn')).not.toBeInTheDocument();
  });

  it('renders player mode with exit button instead of player-mode toggle', () => {
    render(
      <ClusterRightToolbar
        mode="player"
        sidePanelLabel="Toggle subtitle list"
        toolsExpanded={false}
        generateNativeEnabled
        {...playerHandlers}
      />,
    );
    expect(screen.getByTestId('player-mode-actions')).toBeInTheDocument();
    expect(screen.getByTestId('player-mode-exit-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('player-mode-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-cluster-right')).not.toBeInTheDocument();
  });

  it('omits optional buttons when callbacks are undefined', () => {
    render(
      <ClusterRightToolbar
        mode="overlay"
        sidePanelLabel="Open subtitle list"
        toolsExpanded={false}
        onToggleTools={jest.fn()}
        onTogglePlayerMode={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('quick-add-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-card-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-toggle-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('generate-native-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('update-current-card-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-toggle-btn')).not.toBeInTheDocument();
    // tools-toggle + player-mode-btn always render
    expect(screen.getByTestId('tools-toggle-btn')).toBeInTheDocument();
    expect(screen.getByTestId('player-mode-btn')).toBeInTheDocument();
  });

  it('wires click handlers in overlay mode', () => {
    render(
      <ClusterRightToolbar
        mode="overlay"
        sidePanelLabel="Open subtitle list"
        toolsExpanded={false}
        generateNativeEnabled
        {...overlayHandlers}
      />,
    );
    fireEvent.click(screen.getByTestId('quick-add-btn'));
    fireEvent.click(screen.getByTestId('edit-card-btn'));
    fireEvent.click(screen.getByTestId('panel-toggle-btn'));
    fireEvent.click(screen.getByTestId('generate-native-btn'));
    fireEvent.click(screen.getByTestId('tools-toggle-btn'));
    fireEvent.click(screen.getByTestId('update-current-card-btn'));
    fireEvent.click(screen.getByTestId('manager-toggle-btn'));
    fireEvent.click(screen.getByTestId('player-mode-btn'));

    expect(overlayHandlers.onQuickAdd).toHaveBeenCalledTimes(1);
    expect(overlayHandlers.onEditCard).toHaveBeenCalledTimes(1);
    expect(overlayHandlers.onToggleSidePanel).toHaveBeenCalledTimes(1);
    expect(overlayHandlers.onGenerateNative).toHaveBeenCalledTimes(1);
    expect(overlayHandlers.onToggleTools).toHaveBeenCalledTimes(1);
    expect(overlayHandlers.onUpdateCurrentCard).toHaveBeenCalledTimes(1);
    expect(overlayHandlers.onToggleManager).toHaveBeenCalledTimes(1);
    expect(overlayHandlers.onTogglePlayerMode).toHaveBeenCalledTimes(1);
  });

  it('wires click handlers in player mode (exit instead of player-mode toggle)', () => {
    render(
      <ClusterRightToolbar
        mode="player"
        sidePanelLabel="Toggle subtitle list"
        toolsExpanded={false}
        generateNativeEnabled
        {...playerHandlers}
      />,
    );
    fireEvent.click(screen.getByTestId('player-mode-exit-btn'));
    expect(playerHandlers.onExit).toHaveBeenCalledTimes(1);
  });

  it('does not crash when all optional callbacks are undefined', () => {
    render(
      <ClusterRightToolbar
        mode="overlay"
        sidePanelLabel="Open subtitle list"
        toolsExpanded={false}
        onToggleTools={jest.fn()}
      />,
    );
    expect(screen.getByTestId('nav-cluster-right')).toBeInTheDocument();
    // clicking the always-present tools-toggle should not throw
    fireEvent.click(screen.getByTestId('tools-toggle-btn'));
  });
});
