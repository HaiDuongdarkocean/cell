import { describe, it, expect } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeedPill } from './SpeedPill';

const noop = (): void => undefined;

describe('SpeedPill', () => {
  it('decreases and increases to the adjacent playback speed', () => {
    const onChange = jest.fn();
    render(<SpeedPill speed={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /decrease playback speed/i }));
    expect(onChange).toHaveBeenCalledWith(0.75);
    fireEvent.click(screen.getByRole('button', { name: /increase playback speed/i }));
    expect(onChange).toHaveBeenCalledWith(1.25);
  });

  it('clamps speed between 0.5x and 10x', () => {
    const onChange = jest.fn();
    const { unmount } = render(<SpeedPill speed={0.5} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /decrease playback speed from 0\.5x/i }));
    expect(onChange).not.toHaveBeenCalled();
    unmount();

    const onChange2 = jest.fn();
    render(<SpeedPill speed={10} onChange={onChange2} />);
    fireEvent.click(screen.getByRole('button', { name: /increase playback speed from 10x/i }));
    expect(onChange2).not.toHaveBeenCalled();
  });

  it('opens the speed list popover when the value is clicked', () => {
    render(<SpeedPill speed={1} onChange={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /current playback speed/i }));
    expect(screen.getByRole('listbox', { name: 'Playback speed' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '1.5x' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '10x' })).toBeInTheDocument();
  });

  it('calls onChange when a speed option is selected', () => {
    const onChange = jest.fn();
    render(<SpeedPill speed={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /current playback speed/i }));
    fireEvent.click(screen.getByRole('option', { name: '2x' }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

});
