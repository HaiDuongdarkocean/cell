import { render, screen, fireEvent } from '@testing-library/react';
import { OffsetLayer } from './OffsetLayer';
import type { OffsetState } from './subtitlePanelsTypes';

function makeOffset(overrides: Partial<OffsetState> = {}): OffsetState {
  return {
    targetMs: 1000,
    nativeMs: -500,
    onTargetChange: jest.fn(),
    onNativeChange: jest.fn(),
    ...overrides,
  };
}

describe('OffsetLayer', () => {
  it('renders target + native SubtitleOffsetPanel', () => {
    render(<OffsetLayer offset={makeOffset()} />);

    const panels = screen.getAllByTestId('subtitle-offset-panel');
    expect(panels).toHaveLength(2);

    expect(screen.getAllByTestId('offset-value')[0]).toHaveTextContent('+1s');
    expect(screen.getAllByTestId('offset-value')[1]).toHaveTextContent('-0.5s');
  });

  it('has data-cell-id="subtitle-offset-layer"', () => {
    render(<OffsetLayer offset={makeOffset()} />);
    expect(screen.getByTestId('subtitle-offset-layer')).toBeInTheDocument();
  });

  it('wires onOffsetChange to offset.onTargetChange for target panel', () => {
    const onTargetChange = jest.fn();
    render(<OffsetLayer offset={makeOffset({ targetMs: 0, onTargetChange })} />);

    const targetInput = screen.getAllByTestId('offset-input')[0];
    fireEvent.change(targetInput, { target: { value: '2' } });
    fireEvent.keyDown(targetInput, { key: 'Enter' });

    expect(onTargetChange).toHaveBeenCalledWith(2000);
  });

  it('wires onOffsetChange to offset.onNativeChange for native panel', () => {
    const onNativeChange = jest.fn();
    render(<OffsetLayer offset={makeOffset({ nativeMs: 0, onNativeChange })} />);

    const nativeInput = screen.getAllByTestId('offset-input')[1];
    fireEvent.change(nativeInput, { target: { value: '-1' } });
    fireEvent.keyDown(nativeInput, { key: 'Enter' });

    expect(onNativeChange).toHaveBeenCalledWith(-1000);
  });

  it('does not crash when offset callbacks are no-ops', () => {
    const offset: OffsetState = {
      targetMs: 0,
      nativeMs: 0,
      onTargetChange: jest.fn(),
      onNativeChange: jest.fn(),
    };
    expect(() => render(<OffsetLayer offset={offset} />)).not.toThrow();
  });
});
