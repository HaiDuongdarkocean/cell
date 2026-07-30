import { render, screen } from '@testing-library/react';
import { Timestamp, formatTimestamp } from './Timestamp';

describe('formatTimestamp (pure function)', () => {
  it('formats absolute date', () => {
    const result = formatTimestamp(new Date('2024-01-15T10:00:00Z'), 'absolute', 'en');
    expect(result).toMatch(/2024/);
  });

  it('formats time only', () => {
    const result = formatTimestamp(new Date('2024-01-15T10:30:00Z'), 'time', 'en');
    expect(result).toMatch(/\d/);
  });

  it('formats datetime', () => {
    const result = formatTimestamp(new Date('2024-01-15T10:30:00Z'), 'datetime', 'en');
    expect(result).toMatch(/2024/);
  });

  it('formats relative for past date', () => {
    const past = Date.now() - 5000;
    const result = formatTimestamp(past, 'relative', 'en');
    expect(result).toMatch(/second|ago/i);
  });

  it('accepts ISO string input', () => {
    const result = formatTimestamp('2024-01-15T10:00:00Z', 'absolute', 'en');
    expect(result).toMatch(/2024/);
  });
});

describe('Timestamp component', () => {
  it('renders a <time> element', () => {
    const { container } = render(<Timestamp value="2024-01-15T10:00:00Z" />);
    expect(container.querySelector('time')).toBeInTheDocument();
  });

  it('sets datetime attribute to ISO string', () => {
    const { container } = render(<Timestamp value={1705312800000} />);
    const time = container.querySelector('time');
    expect(time).toHaveAttribute('datetime');
    expect(time?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('renders all formats', () => {
    const formats = ['relative', 'absolute', 'time', 'datetime'] as const;
    for (const fmt of formats) {
      const { unmount } = render(<Timestamp value="2024-01-15T10:00:00Z" format={fmt} />);
      expect(screen.getByText(/.+/)).toBeInTheDocument();
      unmount();
    }
  });

  it('merges custom className', () => {
    const { container } = render(<Timestamp value="2024-01-15T10:00:00Z" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
