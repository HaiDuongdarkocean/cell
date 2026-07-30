import { render, screen } from '@testing-library/react';
import { TimeDisplay, formatTime } from './TimeDisplay';

describe('formatTime (pure)', () => {
  it('formats seconds as M:SS', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(83)).toBe('1:23');
  });

  it('formats hours as H:MM:SS', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('handles invalid input', () => {
    expect(formatTime(-1)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});

describe('TimeDisplay', () => {
  it('renders both format by default', () => {
    render(<TimeDisplay currentTime={83} duration={120} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('1:23 / 2:00');
  });

  it('renders current format', () => {
    render(<TimeDisplay currentTime={83} duration={120} format="current" />);
    expect(screen.getByRole('timer')).toHaveTextContent('1:23');
  });

  it('renders remaining format with minus sign', () => {
    render(<TimeDisplay currentTime={83} duration={120} format="remaining" />);
    expect(screen.getByRole('timer')).toHaveTextContent('-0:37');
  });

  it('renders a <time> element with dateTime attribute', () => {
    const { container } = render(<TimeDisplay currentTime={83} duration={120} />);
    const timeEl = container.querySelector('time');
    expect(timeEl).not.toBeNull();
    expect(timeEl).toHaveAttribute('dateTime', 'PT83S');
  });

  it('merges custom className', () => {
    const { container } = render(
      <TimeDisplay currentTime={0} duration={100} className="extra" />,
    );
    expect(container.firstChild).toHaveClass('extra');
  });
});
