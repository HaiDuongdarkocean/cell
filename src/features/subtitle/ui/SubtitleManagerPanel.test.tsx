import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleManagerPanel } from './SubtitleManagerPanel';
import type { SubtitlePanelItem } from './subtitlePanelModel';

const targetItems: SubtitlePanelItem[] = [
  { id: 'en-1', name: 'English #1', format: 'srt', source: 'auto', role: 'target', index: 0, size: 1024 },
  { id: 'en-2', name: 'English #2', format: 'vtt', source: 'auto', role: 'target', index: 1, isAsr: true },
];

const nativeItems: SubtitlePanelItem[] = [
  { id: 'vi-1', name: 'vietnamese (translated)', format: 'vtt', source: 'translated', role: 'native', index: 0 },
];

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
      />,
    );

    expect(screen.getByText('Subtitle Manager')).toBeInTheDocument();
    expect(screen.getByText('Target · English')).toBeInTheDocument();
    expect(screen.getByText('2 subtitles')).toBeInTheDocument();
    expect(screen.getByText('Native · Vietnamese')).toBeInTheDocument();
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
        onOffsetChange={onOffsetChange}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-offset-dec-target'));
    expect(onOffsetChange).toHaveBeenCalledWith('target', -500);
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
        onGenerateNative={onGenerateNative}
      />,
    );

    fireEvent.click(screen.getByTestId('manager-generate-native'));
    expect(onGenerateNative).toHaveBeenCalled();
  });
});
