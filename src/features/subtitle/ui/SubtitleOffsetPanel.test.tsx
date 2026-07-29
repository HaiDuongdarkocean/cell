import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleOffsetPanel } from './SubtitleOffsetPanel';

describe('SubtitleOffsetPanel', () => {
  it('renders current offset and controls', () => {
    const onChange = jest.fn();
    render(<SubtitleOffsetPanel offsetMs={1500} onOffsetChange={onChange} />);

    expect(screen.getByText('Time offset')).toBeInTheDocument();
    expect(screen.getByTestId('offset-value')).toHaveTextContent('+1.5s');
    expect(screen.getByTestId('offset-slider')).toBeInTheDocument();
    expect(screen.getByTestId('offset-input')).toHaveValue('+1.5s');
  });

  it('clamps offset to ±60s', () => {
    const onChange = jest.fn();
    render(<SubtitleOffsetPanel offsetMs={90_000} onOffsetChange={onChange} />);
    expect(screen.getByTestId('offset-value')).toHaveTextContent('+60s');
  });

  it('applies input offset on apply button', () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    render(<SubtitleOffsetPanel offsetMs={0} onOffsetChange={onChange} onCommit={onCommit} />);

    const input = screen.getByTestId('offset-input');
    fireEvent.change(input, { target: { value: '-0.5' } });
    fireEvent.click(screen.getByTestId('offset-apply'));
    expect(onChange).toHaveBeenCalledWith(-500);
    expect(onCommit).toHaveBeenCalledWith(-500);
    expect(input).toHaveValue('-0.5s');
  });

  it('reverts invalid input to current offset', () => {
    const onChange = jest.fn();
    render(<SubtitleOffsetPanel offsetMs={1000} onOffsetChange={onChange} />);

    const input = screen.getByTestId('offset-input');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('+1s');
  });

  it('adjusts offset via stepper buttons', () => {
    const onChange = jest.fn();
    const { rerender } = render(<SubtitleOffsetPanel offsetMs={0} onOffsetChange={onChange} />);

    fireEvent.click(screen.getByTestId('offset-step-+2s'));
    expect(onChange).toHaveBeenCalledWith(2000);

    rerender(<SubtitleOffsetPanel offsetMs={2000} onOffsetChange={onChange} />);
    fireEvent.click(screen.getByTestId('offset-step--0.5s'));
    expect(onChange).toHaveBeenLastCalledWith(1500);
  });

  it('resets offset to 0', () => {
    const onChange = jest.fn();
    const onReset = jest.fn();
    const { rerender } = render(<SubtitleOffsetPanel offsetMs={2500} onOffsetChange={onChange} onReset={onReset} />);

    fireEvent.click(screen.getByTestId('offset-reset'));
    expect(onChange).toHaveBeenCalledWith(0);
    expect(onReset).toHaveBeenCalled();
    rerender(<SubtitleOffsetPanel offsetMs={0} onOffsetChange={onChange} onReset={onReset} />);
    expect(screen.getByTestId('offset-value')).toHaveTextContent('0s');
  });

  it('commits on Enter key', () => {
    const onChange = jest.fn();
    render(<SubtitleOffsetPanel offsetMs={0} onOffsetChange={onChange} />);

    const input = screen.getByTestId('offset-input');
    fireEvent.change(input, { target: { value: '1.2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(1200);
  });
});
