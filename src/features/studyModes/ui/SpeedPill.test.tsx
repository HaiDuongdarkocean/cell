import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeedPill } from './SpeedPill';

const noop = (): void => undefined;

let originalResizeObserver: unknown;

beforeAll(() => {
  originalResizeObserver = global.ResizeObserver;
  global.ResizeObserver = class ResizeObserverMock {
    observe(): void { /* noop */ }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
  } as unknown as typeof ResizeObserver;
});

afterAll(() => {
  global.ResizeObserver = originalResizeObserver as typeof ResizeObserver;
});

describe('SpeedPill', () => {
  it('decreases and increases speed with the step buttons', () => {
    const onChange = jest.fn();
    render(<SpeedPill speed={1} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('speed-decrease'));
    expect(onChange).toHaveBeenCalledWith(0.75);
    fireEvent.click(screen.getByTestId('speed-increase'));
    expect(onChange).toHaveBeenCalledWith(1.25);
  });

  it('opens the speed list popover when the value is clicked', () => {
    render(<SpeedPill speed={1} onChange={noop} />);
    fireEvent.click(screen.getByTestId('speed-value'));
    expect(screen.getByRole('listbox', { name: 'Playback speed' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '1.5x' })).toBeInTheDocument();
  });

  it('calls onChange when a speed option is selected', () => {
    const onChange = jest.fn();
    render(<SpeedPill speed={1} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('speed-value'));
    fireEvent.click(screen.getByRole('option', { name: '1.5x' }));
    expect(onChange).toHaveBeenCalledWith(1.5);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders a compact circle variant', () => {
    render(<SpeedPill speed={0.75} onChange={noop} compact />);
    expect(screen.getByTestId('speed-value-circle')).toBeInTheDocument();
    expect(screen.queryByTestId('speed-pill')).not.toBeInTheDocument();
  });
});
