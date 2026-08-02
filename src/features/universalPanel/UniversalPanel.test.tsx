import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { UniversalPanel } from './UniversalPanel';
import { createUniversalPanelController } from './UniversalPanelController';
import type { UniversalPanelTab } from './types';
import type { TokenizePanelState } from '@/features/tokenize/types';

const TOKENIZE_OFF: TokenizePanelState = { enabled: false, showStatus: false, showFrequency: false };
const TOKENIZE_ON: TokenizePanelState = { enabled: true, showStatus: true, showFrequency: true };

describe('UniversalPanel component', () => {
  const dictionaryPanel = <div data-cell-id="dict-content">Dictionary Content</div>;
  const settingsPanel = <div data-cell-id="settings-content">Settings Content</div>;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders nothing when closed', () => {
    render(
      <UniversalPanel
        isOpen={false}
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={jest.fn()}
        tokenizeState={TOKENIZE_OFF}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    expect(screen.queryByTestId('universal-panel')).not.toBeInTheDocument();
  });

  it('renders the panel and active tab content when open', () => {
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={jest.fn()}
        tokenizeState={TOKENIZE_OFF}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    expect(screen.getByTestId('universal-panel')).toBeInTheDocument();
    expect(screen.getByTestId('dict-content')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-content')).not.toBeInTheDocument();
  });

  it('switches tab when a tab button is clicked', () => {
    const onTabChange = jest.fn();
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={onTabChange}
        onClose={jest.fn()}
        tokenizeState={TOKENIZE_OFF}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    fireEvent.click(screen.getByTestId('universal-panel-tab-settings'));
    expect(onTabChange).toHaveBeenCalledWith('settings');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={onClose}
        tokenizeState={TOKENIZE_OFF}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    fireEvent.click(screen.getByTestId('universal-panel-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={onClose}
        tokenizeState={TOKENIZE_OFF}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    fireEvent.click(screen.getByTestId('universal-panel-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn();
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={onClose}
        tokenizeState={TOKENIZE_OFF}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('universal-panel'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the universal header with 3 tokenize toggles + close button', () => {
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={jest.fn()}
        tokenizeState={TOKENIZE_ON}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    expect(screen.getByTestId('universal-panel-header')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-header-toggle-enabled')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-header-toggle-showStatus')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-header-toggle-showFrequency')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-close')).toBeInTheDocument();
  });

  it('disables Status + Frequency toggles when tokenize is off', () => {
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={jest.fn()}
        tokenizeState={TOKENIZE_OFF}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    expect(screen.getByTestId('universal-panel-header-toggle-enabled')).not.toBeDisabled();
    expect(screen.getByTestId('universal-panel-header-toggle-showStatus')).toBeDisabled();
    expect(screen.getByTestId('universal-panel-header-toggle-showFrequency')).toBeDisabled();
  });

  it('enables Status + Frequency toggles when tokenize is on', () => {
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={jest.fn()}
        tokenizeState={TOKENIZE_ON}
        onToggleTokenize={jest.fn()}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    expect(screen.getByTestId('universal-panel-header-toggle-enabled')).not.toBeDisabled();
    expect(screen.getByTestId('universal-panel-header-toggle-showStatus')).not.toBeDisabled();
    expect(screen.getByTestId('universal-panel-header-toggle-showFrequency')).not.toBeDisabled();
  });

  it('calls onToggleTokenize with the clicked key', () => {
    const onToggleTokenize = jest.fn();
    render(
      <UniversalPanel
        isOpen
        activeTab="dictionary"
        onTabChange={jest.fn()}
        onClose={jest.fn()}
        tokenizeState={TOKENIZE_ON}
        onToggleTokenize={onToggleTokenize}
        dictionaryPanel={dictionaryPanel}
        settingsPanel={settingsPanel}
      />,
    );
    fireEvent.click(screen.getByTestId('universal-panel-header-toggle-enabled'));
    expect(onToggleTokenize).toHaveBeenCalledWith('enabled');
  });
});

describe('createUniversalPanelController', () => {
  function makeController(
    initialTab: UniversalPanelTab = 'dictionary',
    persisted: UniversalPanelTab | null = null,
  ) {
    const persistFn = jest.fn((_tab: UniversalPanelTab) => Promise.resolve());
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const onTabChange = jest.fn();

    const { controller, unmount } = createUniversalPanelController({
      initialTab,
      getPersistedTab: () => Promise.resolve(persisted),
      persistTab: persistFn,
      onOpen,
      onClose,
      onTabChange,
    });

    return { controller, unmount, persistFn, onOpen, onClose, onTabChange };
  }

  it('starts closed with the initial tab', () => {
    const { controller, onOpen } = makeController('settings');
    expect(controller.isOpen()).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens and reports isOpen', async () => {
    const { controller, onOpen } = makeController();
    await controller.open();
    expect(controller.isOpen()).toBe(true);
    expect(onOpen).toHaveBeenCalledWith('dictionary');
  });

  it('restores the persisted tab on open when no tab is provided', async () => {
    const { controller, onOpen } = makeController('dictionary', 'settings');
    await controller.open();
    expect(onOpen).toHaveBeenCalledWith('settings');
  });

  it('opens to a specific tab and persists it', async () => {
    const { controller, onOpen, persistFn } = makeController();
    await controller.open('settings');
    expect(controller.isOpen()).toBe(true);
    expect(onOpen).toHaveBeenCalledWith('settings');
    expect(persistFn).toHaveBeenCalledWith('settings');
  });

  it('closes and fires onClose', async () => {
    const { controller, onClose } = makeController();
    await controller.open();
    controller.close();
    expect(controller.isOpen()).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('switchTab updates the tab and persists', async () => {
    const { controller, onTabChange, persistFn } = makeController();
    await controller.switchTab('settings');
    expect(onTabChange).toHaveBeenCalledWith('settings');
    expect(persistFn).toHaveBeenCalledWith('settings');
  });

  it('switchTab is a no-op when the tab is already active', async () => {
    const { controller, onTabChange, persistFn } = makeController('settings', 'settings');
    await controller.switchTab('settings');
    expect(onTabChange).not.toHaveBeenCalled();
    expect(persistFn).not.toHaveBeenCalled();
  });

  it('getHosts is empty until mount wires a host', () => {
    const { controller } = makeController();
    expect(controller.getHosts()).toEqual([]);
  });

  it('unmount closes without firing callbacks twice', async () => {
    const { controller, unmount, onClose } = makeController();
    await controller.open();
    onClose.mockClear();
    unmount();
    expect(controller.isOpen()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
