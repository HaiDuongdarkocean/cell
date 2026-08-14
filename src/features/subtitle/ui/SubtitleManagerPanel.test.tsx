import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleManagerPanel } from './SubtitleManagerPanel';
import type { SubtitlePanelItem } from './subtitlePanelModel';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';

const targetItems: SubtitlePanelItem[] = [
  { id: 'en-1', name: 'English #1', format: 'srt', source: 'auto', role: 'target', index: 0, size: 1024 },
  { id: 'en-2', name: 'English #2', format: 'vtt', source: 'auto', role: 'target', index: 1, isAsr: true },
];

const nativeItems: SubtitlePanelItem[] = [
  { id: 'vi-1', name: 'vietnamese (translated)', format: 'vtt', source: 'translated', role: 'native', index: 0 },
];

const appearanceProps = {
  appearance: {
    targetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    nativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    blockSettings: DEFAULT_SUBTITLE_BLOCK_SETTINGS,
    clusterSettings: DEFAULT_NAV_CLUSTER_SETTINGS,
    defaultTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    defaultNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    previewTargetText: 'Target preview text',
    previewNativeText: 'Native preview text',
    onStyleChange: jest.fn(),
    onBlockSettingsChange: jest.fn(),
    onClusterSettingsChange: jest.fn(),
    onResetStyle: jest.fn(),
    onPreviewTextChange: jest.fn(),
  },
};

describe('SubtitleManagerPanel', () => {
  it('renders target and native sections with counts', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Subtitle Manager')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('2 subtitles')).toBeInTheDocument();
    expect(screen.getByText('Native')).toBeInTheDocument();
    expect(screen.getByText('1 subtitle')).toBeInTheDocument();
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={onSelect}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-item-target-1'));
    expect(onSelect).toHaveBeenCalledWith('target', 1);
  });

  it('keeps target and native sections expanded without collapse controls', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    expect(screen.getByTestId('manager-item-target-0')).toBeInTheDocument();
    expect(screen.getByTestId('manager-item-native-0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Target · English/ })).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={onClose}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('subtitle-manager-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={onClose}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onOffsetChange when offset input loses focus', () => {
    const onOffsetChange = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onOffsetChange={onOffsetChange}
      />,
    );

    const input = screen.getByTestId('manager-offset-input-target');
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(onOffsetChange).toHaveBeenCalledWith('target', 1500);
  });

  it('calls onOffsetChange when stepper + button is clicked', () => {
    const onOffsetChange = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onOffsetChange={onOffsetChange}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-offset-inc-target'));
    expect(onOffsetChange).toHaveBeenCalledWith('target', 500);
  });

  it('calls onOffsetChange when stepper − button is clicked', () => {
    const onOffsetChange = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onOffsetChange={onOffsetChange}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-offset-dec-target'));
    expect(onOffsetChange).toHaveBeenCalledWith('target', -500);
  });

  it('calls onOffsetChange with 0 when Reset is clicked', () => {
    const onOffsetChange = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onOffsetChange={onOffsetChange}
      />,
    );

    // First bump to non-zero
    fireEvent.click(screen.getByTestId('manager-offset-inc-target'));
    expect(onOffsetChange).toHaveBeenCalledWith('target', 500);

    // Then reset
    fireEvent.click(screen.getByTestId('manager-offset-reset-target'));
    expect(onOffsetChange).toHaveBeenLastCalledWith('target', 0);
  });

  it('restores last valid value when input is invalid', () => {
    const onOffsetChange = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onOffsetChange={onOffsetChange}
      />,
    );

    // Set a valid value first
    const input = screen.getByTestId('manager-offset-input-target');
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(onOffsetChange).toHaveBeenLastCalledWith('target', 1500);

    // Enter invalid value
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    // onOffsetChange should NOT have been called again (no new commit)
    expect(onOffsetChange).toHaveBeenCalledTimes(1);
    // Input should be restored to last valid value
    expect(input).toHaveValue('+1.5');
  });

  it('calls onImport when import is clicked', () => {
    const onImport = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onImport={onImport}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-import-target'));
    expect(onImport).toHaveBeenCalledWith('target');
  });

  it('calls onGenerateNative when generate button is clicked', () => {
    const onGenerateNative = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={onGenerateNative}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-generate-native'));
    expect(onGenerateNative).toHaveBeenCalled();
  });

  it('renders Off option at the top of each track list', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    expect(screen.getByTestId('manager-off-target')).toBeInTheDocument();
    expect(screen.getByTestId('manager-off-native')).toBeInTheDocument();
  });

  it('calls onSelect with -1 when Off option is clicked', () => {
    const onSelect = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={onSelect}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-off-target'));
    expect(onSelect).toHaveBeenCalledWith('target', -1);
  });

  it('marks Off option as active when activeIndex is -1 and no items', () => {
    render(
      <SubtitleManagerPanel
        targetItems={[]}
        nativeItems={[]}
        targetActiveIndex={-1}
        nativeActiveIndex={-1}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
      />,
    );

    const offTarget = screen.getByTestId('manager-off-target');
    expect(offTarget).toHaveAttribute('aria-selected', 'true');
    const offNative = screen.getByTestId('manager-off-native');
    expect(offNative).toHaveAttribute('aria-selected', 'true');
  });

  // ─── Appearance view tests ───

  it('renders Customize appearance button in tracks view footer when appearance prop is provided', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={jest.fn()}
        {...appearanceProps}
      />,
    );

    expect(screen.getByTestId('manager-customize-appearance')).toBeInTheDocument();
  });

  it('does not render Customize appearance button when appearance prop is not provided', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('manager-customize-appearance')).not.toBeInTheDocument();
  });

  it('switches to appearance view when Customize appearance is clicked', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={jest.fn()}
        {...appearanceProps}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-customize-appearance'));
    expect(screen.getByTestId('manager-back-to-subtitles')).toBeInTheDocument();
    // Block tab is active by default
    expect(screen.getByTestId('subtitle-block-settings-panel')).toBeInTheDocument();
    // Nav cluster panel is in Buttons tab — not visible by default
    expect(screen.queryByTestId('nav-cluster-settings-panel')).not.toBeInTheDocument();
    // Click Buttons tab → nav cluster panel appears
    fireEvent.click(screen.getByRole('tab', { name: 'Buttons' }));
    expect(screen.getByTestId('nav-cluster-settings-panel')).toBeInTheDocument();
  });

  it('switches back to tracks view when Back to subtitles is clicked', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={jest.fn()}
        {...appearanceProps}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-customize-appearance'));
    fireEvent.click(screen.getByTestId('manager-back-to-subtitles'));
    expect(screen.queryByTestId('manager-back-to-subtitles')).not.toBeInTheDocument();
    expect(screen.getByTestId('manager-customize-appearance')).toBeInTheDocument();
  });

  it('hides tracks view content when in appearance view', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={jest.fn()}
        {...appearanceProps}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-customize-appearance'));
    expect(screen.queryByTestId('manager-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-generate-native')).not.toBeInTheDocument();
  });

  it('Escape key closes panel from appearance view', () => {
    const onClose = jest.fn();
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={onClose}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={jest.fn()}
        {...appearanceProps}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-customize-appearance'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders appearance view with tabs (Block active by default, Target/Native/Buttons on click)', () => {
    render(
      <SubtitleManagerPanel
        targetItems={targetItems}
        nativeItems={nativeItems}
        targetActiveIndex={0}
        nativeActiveIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        hasSearchKeys={false}
        apiKeys={[]}
        onApiKeysChange={jest.fn()}
        onSearchResultSelect={jest.fn()}
        onGenerateNative={jest.fn()}
        {...appearanceProps}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-customize-appearance'));
    // Block tab is active by default — block settings panel visible
    expect(screen.getByTestId('subtitle-block-settings-panel')).toBeInTheDocument();
    // Target/Native panels not rendered (Tabs only renders active content)
    expect(screen.queryByTestId('subtitle-style-panel-target')).not.toBeInTheDocument();

    // Click Target tab → target style panel appears
    fireEvent.click(screen.getByRole('tab', { name: 'Target' }));
    expect(screen.getByTestId('subtitle-style-panel-target')).toBeInTheDocument();

    // Click Native tab → native style panel appears
    fireEvent.click(screen.getByRole('tab', { name: 'Native' }));
    expect(screen.getByTestId('subtitle-style-panel-native')).toBeInTheDocument();

    // Click Buttons tab → nav cluster panel appears
    fireEvent.click(screen.getByRole('tab', { name: 'Buttons' }));
    expect(screen.getByTestId('nav-cluster-settings-panel')).toBeInTheDocument();
  });
});
